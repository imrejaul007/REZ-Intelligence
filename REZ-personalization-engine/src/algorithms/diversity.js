const logger = require('../utils/logger');
const UserDNAProfile = require('../models/UserDNAProfile');

class DiversityManager {
  constructor(options = {}) {
    this.options = {
      minCategorySpread: options.minCategorySpread || 0.3,
      maxCategoryRatio: options.maxCategoryRatio || 0.6,
      reRankWindow: options.reRankWindow || 20,
      diversityWeight: options.diversityWeight || 0.15,
      noveltyWeight: options.noveltyWeight || 0.1,
      ...options
    };
  }

  /**
   * Apply diversity constraints to recommendation list
   * Uses MMR (Maximal Marginal Relevance) for re-ranking
   */
  applyDiversity(items, userProfile, scores = {}) {
    if (!items || items.length === 0) return items;

    const diversityTolerance = userProfile?.diversityTolerance || 0.5;
    const noveltySeeking = userProfile?.noveltySeeking || 0.5;

    // Calculate diversity weight based on user preferences
    const effectiveDiversityWeight = this.options.diversityWeight * (1 - noveltySeeking);

    // Group items by category
    const categoryGroups = this.groupByCategory(items);

    // Calculate category proportions
    const categoryProportions = this.calculateCategoryProportions(items, categoryGroups);

    // Check if diversity constraints are violated
    const violations = this.identifyViolations(categoryProportions);

    if (violations.length === 0) {
      return items;
    }

    // Re-rank using MMR
    const reRankedItems = this.mmrReRank(
      items,
      scores,
      categoryGroups,
      effectiveDiversityWeight,
      diversityTolerance
    );

    return reRankedItems;
  }

  /**
   * Group items by category
   */
  groupByCategory(items) {
    const groups = new Map();

    for (const item of items) {
      const category = item.category || 'uncategorized';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category).push(item);
    }

    return groups;
  }

  /**
   * Calculate category proportions in the list
   */
  calculateCategoryProportions(items, categoryGroups) {
    const proportions = {};
    const total = items.length;

    for (const [category, groupItems] of categoryGroups) {
      proportions[category] = {
        count: groupItems.length,
        proportion: groupItems.length / total
      };
    }

    return proportions;
  }

  /**
   * Identify category proportions that violate diversity constraints
   */
  identifyViolations(proportions) {
    const violations = [];

    for (const [category, data] of Object.entries(proportions)) {
      if (data.proportion > this.options.maxCategoryRatio) {
        violations.push({
          category,
          currentProportion: data.proportion,
          maxProportion: this.options.maxCategoryRatio,
          excess: data.proportion - this.options.maxCategoryRatio
        });
      }
    }

    return violations;
  }

  /**
   * Maximal Marginal Relevance (MMR) re-ranking
   * Balances relevance with diversity
   */
  mmrReRank(items, scores, categoryGroups, lambda, diversityTolerance) {
    if (items.length === 0) return [];

    const result = [];
    const remaining = [...items];
    const selectedCategories = new Set();

    // Calculate max items per category based on diversity tolerance
    const maxPerCategory = Math.ceil(
      items.length * this.options.maxCategoryRatio * (1 - diversityTolerance)
    );

    // Track items selected per category
    const categoryCounts = {};

    // Select first item (highest relevance)
    const firstItem = this.getHighestScoringItem(remaining, scores);
    result.push(firstItem);
    remaining.splice(remaining.indexOf(firstItem), 1);
    selectedCategories.add(firstItem.category);

    // Continue selection using MMR
    while (remaining.length > 0) {
      let bestItem = null;
      let bestMMR = -Infinity;

      for (const item of remaining) {
        const relevanceScore = scores[item.itemId] || 0;
        const diversityScore = this.calculateDiversityScore(item, result, categoryGroups);
        const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityScore;

        // Apply category cap
        const category = item.category;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;

        if (categoryCounts[category] > maxPerCategory && result.length < items.length * 0.5) {
          continue;
        }

        if (mmrScore > bestMMR) {
          bestMMR = mmrScore;
          bestItem = item;
        }
      }

      if (!bestItem) {
        // If no valid item found, pick the next highest scoring
        bestItem = this.getHighestScoringItem(remaining, scores);
      }

      result.push(bestItem);
      remaining.splice(remaining.indexOf(bestItem), 1);
      selectedCategories.add(bestItem.category);
    }

    return result;
  }

  /**
   * Calculate diversity score for an item based on already selected items
   */
  calculateDiversityScore(item, selectedItems, categoryGroups) {
    if (selectedItems.length === 0) return 1;

    let minSimilarity = 1;

    for (const selected of selectedItems) {
      const similarity = this.calculateItemSimilarity(item, selected, categoryGroups);
      minSimilarity = Math.min(minSimilarity, 1 - similarity);
    }

    return minSimilarity;
  }

  /**
   * Calculate similarity between two items
   */
  calculateItemSimilarity(item1, item2, categoryGroups) {
    let similarity = 0;
    let weight = 0;

    // Category similarity
    if (item1.category === item2.category) {
      similarity += 0.4;
    }
    weight += 0.4;

    // Subcategory similarity
    if (item1.subcategory && item1.subcategory === item2.subcategory) {
      similarity += 0.2;
    }
    weight += 0.2;

    // Brand similarity
    if (item1.brandId && item1.brandId === item2.brandId) {
      similarity += 0.2;
    }
    weight += 0.2;

    // Tag overlap
    if (item1.tags && item2.tags) {
      const overlap = item1.tags.filter(t => item2.tags.includes(t)).length;
      const union = new Set([...item1.tags, ...item2.tags]).size;
      if (union > 0) {
        similarity += 0.2 * (overlap / union);
      }
    }
    weight += 0.2;

    return similarity / weight;
  }

  /**
   * Get highest scoring item from remaining items
   */
  getHighestScoringItem(items, scores) {
    if (items.length === 0) return null;

    return items.reduce((best, item) => {
      const bestScore = scores[best.itemId] || 0;
      const itemScore = scores[item.itemId] || 0;
      return itemScore > bestScore ? item : best;
    }, items[0]);
  }

  /**
   * Ensure category spread in recommendations
   */
  ensureCategorySpread(items, minCategories = 3) {
    const categories = new Set(items.map(i => i.category));

    if (categories.size >= minCategories) {
      return items;
    }

    // Need to add more category diversity
    const categoryGroups = this.groupByCategory(items);
    const underrepresented = this.getUnderrepresentedCategories(
      categoryGroups,
      items.length,
      minCategories
    );

    // Sort to prioritize underrepresented categories
    return items.sort((a, b) => {
      const aUnder = underrepresented.includes(a.category);
      const bUnder = underrepresented.includes(b.category);

      if (aUnder && !bUnder) return -1;
      if (!aUnder && bUnder) return 1;
      return 0;
    });
  }

  /**
   * Get categories that are underrepresented
   */
  getUnderrepresentedCategories(categoryGroups, totalItems, targetCategories) {
    const idealProportion = 1 / targetCategories;
    const threshold = idealProportion * 0.5;
    const underrepresented = [];

    for (const [category, items] of categoryGroups) {
      const proportion = items.length / totalItems;
      if (proportion < threshold) {
        underrepresented.push(category);
      }
    }

    return underrepresented;
  }

  /**
   * Apply novelty filter - reduce items user has seen before
   */
  applyNoveltyFilter(items, userId, interactionHistory = [], noveltyThreshold = 0.5) {
    if (!interactionHistory || interactionHistory.length === 0) {
      return items.map(item => ({ ...item, noveltyScore: 1 }));
    }

    const seenItemIds = new Set(interactionHistory.map(i => i.itemId));
    const seenCategories = new Set(interactionHistory.map(i => i.category));
    const seenBrands = new Set(interactionHistory.map(i => i.brandId).filter(Boolean));

    return items.map(item => {
      let noveltyScore = 1;

      // Penalize seen items
      if (seenItemIds.has(item.itemId)) {
        noveltyScore *= 0.3;
      }

      // Penalize seen categories slightly
      if (seenCategories.has(item.category)) {
        noveltyScore *= 0.9;
      }

      // Penalize seen brands
      if (item.brandId && seenBrands.has(item.brandId)) {
        noveltyScore *= 0.95;
      }

      // Recency bonus - favor newer items
      const daysSinceCreation = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 7) {
        noveltyScore *= 1.1;
      }

      return {
        ...item,
        noveltyScore: Math.min(1, noveltyScore)
      };
    });
  }

  /**
   * Final re-ranking with all constraints
   */
  reRank(items, scores, userProfile, interactionHistory = []) {
    if (items.length === 0) return [];

    let result = [...items];

    // Step 1: Apply novelty filter
    result = this.applyNoveltyFilter(result, userProfile?.userId, interactionHistory);

    // Step 2: Combine relevance and novelty scores
    const combinedScores = {};
    for (const item of result) {
      const relevance = scores[item.itemId] || 0.5;
      const novelty = item.noveltyScore || 1;
      combinedScores[item.itemId] = relevance * (0.7 + 0.3 * novelty);
    }

    // Step 3: Apply diversity constraints
    const userPref = userProfile ? {
      ...userProfile.toObject(),
      diversityTolerance: userProfile.diversityTolerance || 0.5,
      noveltySeeking: userProfile.noveltySeeking || 0.5
    } : null;

    result = this.applyDiversity(result, userPref, combinedScores);

    // Step 4: Ensure minimum category spread
    result = this.ensureCategorySpread(result, Math.min(3, Math.ceil(result.length * 0.3)));

    // Step 5: Re-apply scores after diversity re-ranking
    return result.map((item, index) => ({
      ...item,
      finalScore: combinedScores[item.itemId] || (1 - index / result.length),
      rank: index + 1
    }));
  }
}

module.exports = new DiversityManager();

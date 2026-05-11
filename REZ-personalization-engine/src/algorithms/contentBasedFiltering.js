const math = require('mathjs');
const logger = require('../utils/logger');
const UserDNAProfile = require('../models/UserDNAProfile');
const ContentItem = require('../models/ContentItem');

class ContentBasedFiltering {
  constructor(options = {}) {
    this.options = {
      similarityMetric: options.similarityMetric || 'cosine',
      featureWeights: options.featureWeights || {
        category: 0.3,
        brand: 0.2,
        price_tier: 0.15,
        quality_tier: 0.1,
        tags: 0.15,
        features: 0.1
      },
      minScore: options.minScore || 0.1,
      ...options
    };
  }

  /**
   * Build user preference profile from historical interactions
   */
  async buildUserPreferenceProfile(userId) {
    const profile = await UserDNAProfile.findOne({ userId });
    if (!profile) return null;

    const preferenceProfile = {
      userId,
      preferredCategories: {},
      preferredBrands: {},
      priceTierDistribution: {},
      qualityTierDistribution: {},
      preferredTags: {},
      preferredFeatures: {}
    };

    // Process category interests
    for (const category of profile.categoryInterests) {
      preferenceProfile.preferredCategories[category.categoryId] = category.interestScore;
    }

    // Process brand preferences
    for (const brand of profile.brandPreferences) {
      preferenceProfile.preferredBrands[brand.brandId] = brand.affinity;
    }

    // Process content affinity scores
    for (const affinity of profile.contentAffinityScores) {
      if (!preferenceProfile.preferredCategories[affinity.category]) {
        preferenceProfile.preferredCategories[affinity.category] = affinity.score;
      }
    }

    // Process behavioral patterns for price/quality preferences
    for (const pattern of profile.behavioralPatterns) {
      if (pattern.type === 'price_sensitivity') {
        preferenceProfile.priceTierDistribution[pattern.metadata?.tier] = pattern.confidence;
      }
      if (pattern.type === 'quality_preference') {
        preferenceProfile.qualityTierDistribution[pattern.metadata?.tier] = pattern.confidence;
      }
    }

    // Extract from preference vector
    for (const pref of profile.preferenceVector) {
      preferenceProfile.preferredFeatures[pref.dimension] = pref.value;
    }

    return preferenceProfile;
  }

  /**
   * Extract feature vector from a content item
   */
  extractFeatureVector(item) {
    const features = [];

    // Category encoding (normalized)
    const categoryHash = this.hashString(item.category);
    features.push(categoryHash);

    // Brand encoding
    const brandHash = item.brandId ? this.hashString(item.brandId) : 0;
    features.push(brandHash);

    // Price tier
    features.push((item.features?.price_tier || 2) / 4);

    // Quality tier
    features.push((item.features?.quality_tier || 2) / 4);

    // Popularity (normalized)
    features.push(Math.min(1, (item.features?.popularity || 0) / 1000));

    // Recency (days old, normalized to 30 days)
    const ageInDays = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    features.push(Math.max(0, 1 - ageInDays / 30));

    // Engagement rate
    features.push(item.features?.engagement_rate || 0);

    // Conversion rate
    features.push(item.features?.conversion_rate || 0);

    return features;
  }

  hashString(str) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return (Math.abs(hash) % 1000) / 1000;
  }

  /**
   * Calculate similarity between user preference and item
   */
  calculateItemScore(item, userProfile) {
    let score = 0;
    let totalWeight = 0;

    // Category match
    const categoryScore = userProfile.preferredCategories[item.category] || 0;
    score += categoryScore * this.options.featureWeights.category;
    totalWeight += this.options.featureWeights.category;

    // Brand match
    const brandScore = userProfile.preferredBrands[item.brandId] || 0;
    score += brandScore * this.options.featureWeights.brand;
    totalWeight += this.options.featureWeights.brand;

    // Price tier match
    const itemPriceTier = item.features?.price_tier || 2;
    const priceTierScore = userProfile.priceTierDistribution[itemPriceTier] ||
      (1 - Math.abs(itemPriceTier - 2) / 2);
    score += priceTierScore * this.options.featureWeights.price_tier;
    totalWeight += this.options.featureWeights.price_tier;

    // Quality tier match
    const itemQualityTier = item.features?.quality_tier || 2;
    const qualityTierScore = userProfile.qualityTierDistribution[itemQualityTier] ||
      (1 - Math.abs(itemQualityTier - 2) / 2);
    score += qualityTierScore * this.options.featureWeights.quality_tier;
    totalWeight += this.options.featureWeights.quality_tier;

    // Tag overlap
    if (item.tags && item.tags.length > 0) {
      const tagScore = this.calculateTagSimilarity(item.tags, userProfile);
      score += tagScore * this.options.featureWeights.tags;
      totalWeight += this.options.featureWeights.tags;
    }

    // Feature vector similarity
    const featureScore = this.calculateFeatureSimilarity(item, userProfile);
    score += featureScore * this.options.featureWeights.features;
    totalWeight += this.options.featureWeights.features;

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  calculateTagSimilarity(itemTags, userProfile) {
    if (!userProfile.preferredTags || Object.keys(userProfile.preferredTags).length === 0) {
      return 0.5; // Neutral score if no tag preferences
    }

    let matchScore = 0;
    let maxScore = 0;

    for (const tag of itemTags) {
      const normalizedTag = tag.toLowerCase();
      const score = userProfile.preferredTags[normalizedTag] || 0;
      matchScore += score;
      maxScore += 1;
    }

    return maxScore > 0 ? matchScore / maxScore : 0;
  }

  calculateFeatureSimilarity(item, userProfile) {
    if (!userProfile.preferredFeatures || Object.keys(userProfile.preferredFeatures).length === 0) {
      return 0.5;
    }

    const itemFeatures = [
      item.features?.price_tier || 2,
      item.features?.quality_tier || 2,
      item.features?.popularity || 0,
      item.features?.recency || 0
    ];

    const userFeatures = [
      userProfile.preferredFeatures.price_tier || 2,
      userProfile.preferredFeatures.quality_tier || 2,
      userProfile.preferredFeatures.popularity || 0.5,
      userProfile.preferredFeatures.recency || 0.5
    ];

    // Normalize
    const normalizedItem = itemFeatures.map((v, i) => v / (userFeatures[i] || 1));
    const normalizedUser = userFeatures.map((v, i) => v / (v || 1));

    return this.cosineSimilarity(normalizedItem, normalizedUser);
  }

  cosineSimilarity(a, b) {
    if (a.length === 0 || b.length === 0) return 0;

    const dotProduct = math.dot(a, b);
    const magnitudeA = math.norm(a);
    const magnitudeB = math.norm(b);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(userId, itemPool, excludeItems = [], limit = 20) {
    const userProfile = await this.buildUserPreferenceProfile(userId);

    if (!userProfile) {
      logger.warn(`No preference profile found for user: ${userId}`);
      return itemPool.slice(0, limit).map(item => ({
        itemId: item.itemId,
        item,
        score: 0.5,
        source: 'content_based'
      }));
    }

    const scores = [];

    for (const item of itemPool) {
      if (excludeItems.includes(item.itemId)) continue;

      const score = this.calculateItemScore(item, userProfile);

      if (score >= this.options.minScore) {
        scores.push({
          itemId: item.itemId,
          item,
          score,
          source: 'content_based',
          reasons: this.getScoreReasons(item, userProfile)
        });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get explanations for why an item was recommended
   */
  getScoreReasons(item, userProfile) {
    const reasons = [];

    const categoryAffinity = userProfile.preferredCategories[item.category];
    if (categoryAffinity > 0.5) {
      reasons.push(`Strong interest in ${item.category} category`);
    }

    const brandAffinity = userProfile.preferredBrands[item.brandId];
    if (brandAffinity && brandAffinity > 0.5) {
      reasons.push(`You frequently engage with ${item.brandName || 'this brand'}`);
    }

    const itemPriceTier = item.features?.price_tier || 2;
    const priceMatch = userProfile.priceTierDistribution[itemPriceTier];
    if (priceMatch > 0.7) {
      reasons.push('Matches your price range preference');
    }

    return reasons;
  }

  /**
   * Find similar items based on content features
   */
  async findSimilarItems(itemId, itemPool, limit = 10) {
    const targetItem = await ContentItem.findOne({ itemId });
    if (!targetItem) return [];

    const targetFeatures = this.extractFeatureVector(targetItem);
    const similarities = [];

    for (const item of itemPool) {
      if (item.itemId === itemId) continue;

      const itemFeatures = this.extractFeatureVector(item);
      const similarity = this.cosineSimilarity(targetFeatures, itemFeatures);

      if (similarity > this.options.minScore) {
        similarities.push({
          itemId: item.itemId,
          item,
          similarity,
          source: 'content_based'
        });
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Build tag-based user profile from interactions
   */
  async buildTagProfileFromInteractions(userId, interactions) {
    const tagCounts = {};

    for (const interaction of interactions) {
      if (interaction.item?.tags) {
        for (const tag of interaction.item.tags) {
          const normalizedTag = tag.toLowerCase();
          tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
        }
      }
    }

    const totalTags = Object.values(tagCounts).reduce((a, b) => a + b, 0);

    return Object.entries(tagCounts).reduce((profile, [tag, count]) => {
      profile[tag] = count / totalTags;
      return profile;
    }, {});
  }

  /**
   * Update user preference profile based on new interaction
   */
  async updateProfile(userId, item, interactionType, value = 1) {
    const profile = await UserDNAProfile.findOne({ userId });
    if (!profile) return null;

    const learningRate = 0.1;

    // Update category affinity
    const categoryAffinity = profile.contentAffinityScores.find(
      a => a.category === item.category
    );

    if (categoryAffinity) {
      const baseValue = interactionType === 'positive' ? 0.2 :
                       interactionType === 'negative' ? -0.1 : 0.05;
      categoryAffinity.score = Math.max(0, Math.min(1,
        categoryAffinity.score + learningRate * baseValue * value
      ));
      categoryAffinity.interactionCount += 1;
      categoryAffinity.lastInteraction = new Date();
      if (interactionType === 'positive') categoryAffinity.positiveInteractions += 1;
      if (interactionType === 'negative') categoryAffinity.negativeInteractions += 1;
    } else {
      profile.contentAffinityScores.push({
        contentType: item.itemType,
        category: item.category,
        score: interactionType === 'positive' ? 0.3 : 0.1,
        interactionCount: 1,
        lastInteraction: new Date(),
        positiveInteractions: interactionType === 'positive' ? 1 : 0,
        negativeInteractions: interactionType === 'negative' ? 1 : 0
      });
    }

    // Update brand preference
    if (item.brandId) {
      const brandPref = profile.brandPreferences.find(b => b.brandId === item.brandId);

      if (brandPref) {
        const baseValue = interactionType === 'positive' ? 0.15 :
                         interactionType === 'negative' ? -0.1 : 0.05;
        brandPref.affinity = Math.max(0, Math.min(1,
          brandPref.affinity + learningRate * baseValue * value
        ));
        brandPref.interactionCount += 1;
      } else {
        profile.brandPreferences.push({
          brandId: item.brandId,
          brandName: item.brandName,
          affinity: interactionType === 'positive' ? 0.2 : 0.1,
          interactionCount: 1
        });
      }
    }

    // Update category interests
    let categoryInterest = profile.categoryInterests.find(
      c => c.categoryId === item.category
    );

    if (categoryInterest) {
      const baseValue = interactionType === 'positive' ? 0.2 :
                       interactionType === 'negative' ? -0.15 : 0.05;
      categoryInterest.interestScore = Math.max(0, Math.min(1,
        categoryInterest.interestScore + learningRate * baseValue * value
      ));
      categoryInterest.lastViewed = new Date();
    } else {
      profile.categoryInterests.push({
        categoryId: item.category,
        categoryName: item.category,
        interestScore: interactionType === 'positive' ? 0.3 : 0.1,
        lastViewed: new Date()
      });
    }

    // Add behavioral pattern
    profile.addBehavioralPattern(interactionType, {
      metadata: {
        category: item.category,
        brandId: item.brandId,
        itemId: item.itemId
      }
    });

    await profile.save();
    return profile;
  }
}

module.exports = new ContentBasedFiltering();

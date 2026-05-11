/**
 * @deprecated Migration to TypeScript in progress
 * TODO: Import types from src/types/index.ts
 * TODO: Implement interface IPersonalizedHomepageResult, ISearchResult
 */

const UserDNAProfile = require('../models/UserDNAProfile');
const ContentItem = require('../models/ContentItem');
const Interaction = require('../models/Interaction');
const collaborativeFiltering = require('../algorithms/collaborativeFiltering');
const contentBasedFiltering = require('../algorithms/contentBasedFiltering');
const contextualBandits = require('../algorithms/contextualBandits');
const diversityManager = require('../algorithms/diversity');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const aiBus = require('../utils/aiBus');

class PersonalizationService {
  constructor() {
    this.weights = {
      collaborative: parseFloat(process.env.COLLABORATIVE_FILTERING_WEIGHT) || 0.4,
      contentBased: parseFloat(process.env.CONTENT_BASED_WEIGHT) || 0.35,
      popularity: 0.15,
      diversity: parseFloat(process.env.DIVERSITY_THRESHOLD) || 0.1
    };
  }

  /**
   * Personalize homepage feed for a user
   */
  async personalizeHomepage(userId, options = {}) {
    const cacheKey = cache.generateKey('homepage', userId, options.limit || 20);
    const cached = cache.get(cacheKey);
    if (cached && !options.refresh) {
      logger.debug(`Cache hit for homepage: ${userId}`);
      return cached;
    }

    try {
      // Get user profile
      const userProfile = await UserDNAProfile.findOrCreate(userId);

      // Get candidate items (could be from different sources)
      const candidateItems = await this.getCandidateItems(options);

      // Get user interaction history
      const interactionHistory = await Interaction.find({
        userId,
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).sort({ timestamp: -1 }).limit(100);

      const excludeItems = interactionHistory.map(i => i.itemId);

      // Score items using multiple algorithms
      const scores = await this.scoreItems(userId, candidateItems, excludeItems, userProfile);

      // Combine scores
      const combinedScores = this.combineScores(scores);

      // Apply diversity constraints
      const reRankedItems = diversityManager.reRank(
        candidateItems,
        combinedScores,
        userProfile,
        interactionHistory
      );

      const result = {
        userId,
        items: reRankedItems.slice(0, options.limit || 20).map(item => ({
          itemId: item.itemId,
          title: item.title,
          category: item.category,
          price: item.price,
          imageUrl: item.imageUrl,
          score: item.finalScore,
          rank: item.rank,
          reasons: item.reasons || []
        })),
        meta: {
          totalCandidates: candidateItems.length,
          algorithm: 'hybrid',
          weights: this.weights,
          personalized: true,
          generatedAt: new Date().toISOString()
        }
      };

      cache.set(cacheKey, result, 300);

      // Emit personalization applied event
      this.emitPersonalizationApplied(userId, 'homepage', {
        totalCandidates: candidateItems.length,
        returnedItems: result.items.length
      });

      return result;

    } catch (error) {
      logger.error(`Error personalizing homepage for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Personalize search results for a user
   */
  async personalizeSearch(userId, query, searchResults, options = {}) {
    try {
      const userProfile = await UserDNAProfile.findOrCreate(userId);

      // Score each search result
      const scoredResults = searchResults.map(item => {
        let boostScore = 0;

        // Category affinity boost
        const categoryAffinity = userProfile.contentAffinityScores.find(
          a => a.category === item.category
        );
        if (categoryAffinity) {
          boostScore += categoryAffinity.score * 0.3;
        }

        // Brand preference boost
        const brandAffinity = userProfile.brandPreferences.find(
          b => b.brandId === item.brandId
        );
        if (brandAffinity) {
          boostScore += brandAffinity.affinity * 0.2;
        }

        // Price sensitivity alignment
        const priceTier = item.features?.price_tier || 2;
        const priceAlignment = this.getPriceAlignmentScore(priceTier, userProfile.priceSensitivityTier);
        boostScore += priceAlignment * 0.15;

        // Engagement potential boost
        boostScore += (item.features?.engagement_rate || 0) * 0.1;

        // Query relevance is already factored in by search, add personalization
        const personalizationBoost = boostScore;

        return {
          ...item,
          personalizationScore: personalizationBoost,
          finalScore: (item.relevanceScore || 0.5) * (1 + personalizationBoost),
          reasons: this.getBoostReasons(item, userProfile)
        };
      });

      // Sort by final score
      scoredResults.sort((a, b) => b.finalScore - a.finalScore);

      // Sort by final score
      scoredResults.sort((a, b) => b.finalScore - a.finalScore);

      const result = {
        userId,
        query,
        items: scoredResults.slice(0, options.limit || 20),
        meta: {
          totalResults: searchResults.length,
          personalized: true,
          boostApplied: true
        }
      };

      // Emit personalization applied event
      this.emitPersonalizationApplied(userId, 'search_results', {
        query,
        totalResults: searchResults.length,
        returnedItems: result.items.length
      });

      return result;

    } catch (error) {
      logger.error(`Error personalizing search for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate personalized recommendations
   */
  async getRecommendations(userId, type = 'for_you', options = {}) {
    const cacheKey = cache.generateKey('recommendations', userId, type, options.limit || 10);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const userProfile = await UserDNAProfile.findOrCreate(userId);
      const candidateItems = await this.getCandidateItems({
        type,
        userProfile,
        ...options
      });

      const excludeItems = await this.getExcludedItems(userId, type);
      const interactionHistory = await Interaction.find({ userId })
        .sort({ timestamp: -1 })
        .limit(50);

      // Get recommendations from each algorithm
      const [collabRecs, contentRecs, banditRecs] = await Promise.all([
        collaborativeFiltering.getRecommendedItems(userId, candidateItems, excludeItems, 30),
        contentBasedFiltering.getRecommendations(userId, candidateItems, excludeItems, 30),
        contextualBandits.recommend(userId, candidateItems, {}, excludeItems)
      ]);

      // Merge and weight recommendations
      const mergedScores = this.mergeRecommendations(
        collabRecs,
        contentRecs,
        banditRecs.items,
        userProfile
      );

      // Apply diversity
      const finalRecommendations = diversityManager.reRank(
        candidateItems.filter(i => mergedScores[i.itemId]),
        mergedScores,
        userProfile,
        interactionHistory
      );

      const result = {
        userId,
        type,
        items: finalRecommendations.slice(0, options.limit || 10).map(item => ({
          itemId: item.itemId,
          title: item.title,
          category: item.category,
          price: item.price,
          imageUrl: item.imageUrl,
          score: item.finalScore,
          reason: this.getRecommendationReason(item, userProfile)
        })),
        meta: {
          algorithm: 'hybrid',
          weights: this.weights,
          generatedAt: new Date().toISOString()
        }
      };

      cache.set(cacheKey, result, 300);

      // Emit personalization applied event
      this.emitPersonalizationApplied(userId, 'recommendations', {
        type,
        returnedItems: result.items.length
      });

      return result;

    } catch (error) {
      logger.error(`Error generating recommendations for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Emit personalization applied event to AI Bus
   */
  async emitPersonalizationApplied(userId, appliedTo, details = {}) {
    try {
      await aiBus.emit('personalization:applied', {
        userId,
        appliedTo,
        features: ['cuisine_preference', 'price_range', 'category', 'brand_preference'],
        ...details
      });
    } catch (error) {
      logger.warn(`Failed to emit personalization:applied event: ${error.message}`);
    }
  }

  /**
   * Emit segment updated event to AI Bus
   */
  async emitSegmentUpdated(userId, previousSegment, newSegment, confidence = 0.5) {
    try {
      await aiBus.emit('segment:updated', {
        userId,
        previousSegment,
        newSegment,
        confidence
      });
    } catch (error) {
      logger.warn(`Failed to emit segment:updated event: ${error.message}`);
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    try {
      const profile = await UserDNAProfile.findOrCreate(userId);

      // Update behavioral patterns
      if (updates.behavioralPattern) {
        profile.addBehavioralPattern(
          updates.behavioralPattern.type,
          updates.behavioralPattern
        );
      }

      // Update preference vector
      if (updates.preferenceVector) {
        for (const pref of updates.preferenceVector) {
          profile.updatePreference(pref.dimension, pref.value);
        }
      }

      // Update communication style
      if (updates.communicationStyle) {
        profile.communicationStyle = updates.communicationStyle;
      }

      // Update notification timing
      if (updates.notificationTiming) {
        profile.notificationTimingPreference = {
          ...profile.notificationTimingPreference,
          ...updates.notificationTiming
        };
      }

      // Update price sensitivity
      if (updates.priceSensitivityTier) {
        profile.priceSensitivityTier = updates.priceSensitivityTier;
      }

      // Update brand preferences
      if (updates.brandPreferences) {
        for (const brand of updates.brandPreferences) {
          const existing = profile.brandPreferences.find(b => b.brandId === brand.brandId);
          if (existing) {
            existing.affinity = brand.affinity;
          } else {
            profile.brandPreferences.push(brand);
          }
        }
      }

      // Update category interests
      if (updates.categoryInterests) {
        for (const cat of updates.categoryInterests) {
          const existing = profile.categoryInterests.find(c => c.categoryId === cat.categoryId);
          if (existing) {
            existing.interestScore = cat.interestScore;
          } else {
            profile.categoryInterests.push(cat);
          }
        }
      }

      // Update content affinity
      if (updates.contentAffinity) {
        profile.updateAffinity(
          updates.contentAffinity.contentType,
          updates.contentAffinity.category,
          updates.contentAffinity.score,
          updates.contentAffinity.interaction
        );
      }

      // Update engagement metrics
      if (updates.engagement) {
        profile.engagementScore = updates.engagement.score || profile.engagementScore;
        profile.activityFrequency = updates.engagement.frequency || profile.activityFrequency;
      }

      // Update diversity preferences
      if (updates.diversityPreferences) {
        profile.diversityTolerance = updates.diversityPreferences.diversityTolerance ?? profile.diversityTolerance;
        profile.noveltySeeking = updates.diversityPreferences.noveltySeeking ?? profile.noveltySeeking;
      }

      profile.calculateCompleteness();
      await profile.save();

      // Invalidate cache
      cache.delPattern(`^homepage:${userId}`);
      cache.delPattern(`^recommendations:${userId}`);

      logger.info(`Updated profile for user: ${userId}`);

      // Check if segments changed and emit event
      const previousSegment = profile.lastSegmentKey || '';
      const newSegmentKey = this.calculateSegmentKey(profile);
      if (previousSegment && previousSegment !== newSegmentKey) {
        const previousSegments = previousSegment.split(',');
        const newSegments = newSegmentKey.split(',');
        await this.emitSegmentUpdated(userId, previousSegments, newSegments, profile.engagementScore);
        profile.lastSegmentKey = newSegmentKey;
        await profile.save();
      } else if (!previousSegment) {
        profile.lastSegmentKey = newSegmentKey;
        await profile.save();
      }

      return profile;

    } catch (error) {
      logger.error(`Error updating profile for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Record user interaction and update profile
   */
  async recordInteraction(userId, interactionData) {
    try {
      const interaction = new Interaction({
        userId,
        ...interactionData
      });
      await interaction.save();

      // Update user profile based on interaction
      if (interactionData.itemId) {
        const item = await ContentItem.findOne({ itemId: interactionData.itemId });
        if (item) {
          const interactionType = this.getInteractionType(interactionData.type);
          await contentBasedFiltering.updateProfile(userId, item, interactionType, interactionData.value);

          // Update contextual bandit
          const userProfile = await UserDNAProfile.findOne({ userId });
          contextualBandits.updateArm(
            item.category || item.itemId,
            interaction.get('implicitRating') || interactionData.value || 0.5,
            { engagementLevel: userProfile?.engagementScore }
          );
        }
      }

      // Invalidate related caches
      cache.delPattern(`^homepage:${userId}`);
      cache.delPattern(`^recommendations:${userId}`);

      return interaction;

    } catch (error) {
      logger.error(`Error recording interaction for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get candidate items for personalization
   */
  async getCandidateItems(options = {}) {
    const { type, userProfile, limit = 100 } = options;

    let query = { available: true };

    // Filter by type if specified
    if (options.itemType) {
      query.itemType = options.itemType;
    }

    // Filter by categories if user has preferences
    if (userProfile && userProfile.categoryInterests.length > 0) {
      const topCategories = userProfile.categoryInterests
        .slice(0, 5)
        .map(c => c.categoryId);
      if (topCategories.length > 0) {
        query.category = { $in: topCategories };
      }
    }

    // Get items from MongoDB
    const items = await ContentItem.find(query)
      .sort({ popularityScore: -1, createdAt: -1 })
      .limit(limit * 2) // Get more for diversity filtering
      .lean();

    // If not enough items, get popular items regardless of category
    if (items.length < limit) {
      const additionalItems = await ContentItem.find({ available: true })
        .sort({ popularityScore: -1 })
        .limit(limit - items.length)
        .lean();
      items.push(...additionalItems);
    }

    return items.slice(0, limit);
  }

  /**
   * Get items to exclude from recommendations
   */
  async getExcludedItems(userId, type) {
    const excludeItems = [];

    // Exclude recently viewed/purchased items
    const recentInteractions = await Interaction.find({
      userId,
      type: { $in: ['view', 'purchase', 'add_to_cart'] },
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).select('itemId').lean();

    excludeItems.push(...recentInteractions.map(i => i.itemId));

    // Exclude out of stock items
    const outOfStock = await ContentItem.find({
      available: false
    }).select('itemId').lean();

    excludeItems.push(...outOfStock.map(i => i.itemId));

    return [...new Set(excludeItems)];
  }

  /**
   * Score items using multiple algorithms
   */
  async scoreItems(userId, items, excludeItems, userProfile) {
    const [collabScores, contentScores] = await Promise.all([
      collaborativeFiltering.getRecommendedItems(userId, items, excludeItems, items.length),
      contentBasedFiltering.getRecommendations(userId, items, excludeItems, items.length)
    ]);

    return {
      collaborative: collabScores,
      contentBased: contentScores,
      popularity: items.map(item => ({
        itemId: item.itemId,
        score: (item.features?.popularity || 0) / 1000
      }))
    };
  }

  /**
   * Combine scores from different algorithms
   */
  combineScores(scores) {
    const combined = {};
    const { collaborative, contentBased, popularity } = scores;

    // Initialize with collaborative filtering scores
    for (const item of collaborative) {
      combined[item.itemId] = {
        collaborative: item.score,
        contentBased: 0,
        popularity: 0,
        total: 0
      };
    }

    // Add content-based scores
    for (const item of contentBased) {
      if (!combined[item.itemId]) {
        combined[item.itemId] = { collaborative: 0, contentBased: 0, popularity: 0, total: 0 };
      }
      combined[item.itemId].contentBased = item.score;
    }

    // Add popularity scores
    for (const item of popularity) {
      if (!combined[item.itemId]) {
        combined[item.itemId] = { collaborative: 0, contentBased: 0, popularity: 0, total: 0 };
      }
      combined[item.itemId].popularity = item.score;
    }

    // Calculate weighted total
    for (const itemId of Object.keys(combined)) {
      const scores = combined[itemId];
      scores.total =
        scores.collaborative * this.weights.collaborative +
        scores.contentBased * this.weights.contentBased +
        scores.popularity * this.weights.popularity;
    }

    return combined;
  }

  /**
   * Merge recommendations from different algorithms
   */
  mergeRecommendations(collab, content, bandits, userProfile) {
    const merged = {};

    // Add collaborative filtering scores
    for (const item of collab) {
      merged[item.itemId] = item.score * this.weights.collaborative;
    }

    // Add content-based scores
    for (const item of content) {
      if (!merged[item.itemId]) merged[item.itemId] = 0;
      merged[item.itemId] += item.score * this.weights.contentBased;
    }

    // Add bandit scores (exploration/exploitation)
    for (const item of bandits) {
      if (!merged[item.itemId]) merged[item.itemId] = 0;
      // Bandits provide implicit diversity bonus
      merged[item.itemId] += 0.05;
    }

    return merged;
  }

  /**
   * Get price alignment score
   */
  getPriceAlignmentScore(itemPriceTier, userPriceSensitivity) {
    const tiers = { budget: 0, moderate: 1, premium: 2, luxury: 3, insensitive: 2 };
    const userTier = tiers[userPriceSensitivity] || 1;

    if (userPriceSensitivity === 'insensitive') return 1;
    if (userPriceSensitivity === 'budget' && itemPriceTier <= 1) return 1;
    if (userPriceSensitivity === 'luxury' && itemPriceTier >= 2) return 1;

    return 1 - Math.abs(userTier - itemPriceTier) / 3;
  }

  /**
   * Get reasons for personalization boost
   */
  getBoostReasons(item, userProfile) {
    const reasons = [];

    const categoryAffinity = userProfile.contentAffinityScores.find(
      a => a.category === item.category
    );
    if (categoryAffinity && categoryAffinity.score > 0.6) {
      reasons.push('Based on your interest in this category');
    }

    const brandAffinity = userProfile.brandPreferences.find(
      b => b.brandId === item.brandId
    );
    if (brandAffinity && brandAffinity.affinity > 0.6) {
      reasons.push(`You often engage with ${item.brandName || 'this brand'}`);
    }

    return reasons;
  }

  /**
   * Get recommendation reason
   */
  getRecommendationReason(item, userProfile) {
    const reasons = [];

    if (item.score > 0.8) {
      reasons.push('Highly recommended for you');
    } else if (item.score > 0.6) {
      reasons.push('Matches your preferences');
    } else if (item.noveltyScore > 0.8) {
      reasons.push('New item you might like');
    }

    const categoryAffinity = userProfile?.contentAffinityScores?.find(
      a => a.category === item.category
    );
    if (categoryAffinity) {
      reasons.push(`${Math.round(categoryAffinity.score * 100)}% match with your interests`);
    }

    return reasons.join('. ') || 'Recommended based on your profile';
  }

  /**
   * Get interaction type from interaction data
   */
  getInteractionType(type) {
    const positiveTypes = ['purchase', 'like', 'save', 'share', 'review'];
    const negativeTypes = ['dismiss'];

    if (positiveTypes.includes(type)) return 'positive';
    if (negativeTypes.includes(type)) return 'negative';
    return 'neutral';
  }

  /**
   * Get personalization campaign performance
   */
  async getCampaignPerformance(campaignId) {
    const interactions = await Interaction.aggregate([
      {
        $match: {
          'metadata.campaignId': campaignId,
          timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgValue: { $avg: '$value' }
        }
      }
    ]);

    return {
      campaignId,
      interactions: interactions.reduce((acc, i) => {
        acc[i._id] = { count: i.count, avgValue: i.avgValue };
        return acc;
      }, {}),
      banditStats: contextualBandits.getStats()
    };
  }

  /**
   * Calculate segment key for a user profile
   */
  calculateSegmentKey(profile) {
    const segments = [];

    // Engagement segment
    if (profile.engagementScore > 0.7) segments.push('highly_engaged');
    else if (profile.engagementScore > 0.4) segments.push('moderately_engaged');
    else segments.push('low_engaged');

    // Price sensitivity segment
    segments.push(`price_${profile.priceSensitivityTier}`);

    // Activity segment
    segments.push(profile.activityFrequency);

    // Top category interests
    const topCategories = profile.categoryInterests.slice(0, 3);
    for (const cat of topCategories) {
      if (cat.interestScore > 0.6) {
        segments.push(`interested_in_${cat.categoryId}`);
      }
    }

    return segments.sort().join(',');
  }

  /**
   * Get user segment for targeting
   */
  async getUserSegment(userId) {
    const profile = await UserDNAProfile.findOne({ userId });
    if (!profile) return null;

    const segments = [];

    // Engagement segment
    if (profile.engagementScore > 0.7) segments.push('highly_engaged');
    else if (profile.engagementScore > 0.4) segments.push('moderately_engaged');
    else segments.push('low_engaged');

    // Price sensitivity segment
    segments.push(`price_${profile.priceSensitivityTier}`);

    // Activity segment
    segments.push(profile.activityFrequency);

    // Top category interests
    const topCategories = profile.categoryInterests.slice(0, 3);
    for (const cat of topCategories) {
      if (cat.interestScore > 0.6) {
        segments.push(`interested_in_${cat.categoryId}`);
      }
    }

    const result = {
      userId,
      segments,
      profileCompleteness: profile.profileCompleteness,
      lastActiveAt: profile.lastActiveAt
    };

    // Track segment changes and emit event
    const newSegmentKey = segments.sort().join(',');
    if (profile.lastSegmentKey && profile.lastSegmentKey !== newSegmentKey) {
      const previousSegments = profile.lastSegmentKey.split(',');
      await this.emitSegmentUpdated(userId, previousSegments, segments, profile.engagementScore);
    }
    profile.lastSegmentKey = newSegmentKey;
    await profile.save();

    return result;
  }
}

module.exports = new PersonalizationService();

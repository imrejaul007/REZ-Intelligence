const mongoose = require('mongoose');
const math = require('mathjs');
const { randomInt } = require('crypto');
const logger = require('../utils/logger');
const Interaction = require('../models/Interaction');
const UserDNAProfile = require('../models/UserDNAProfile');
const ContentItem = require('../models/ContentItem');

class CollaborativeFiltering {
  constructor(options = {}) {
    this.options = {
      kNeighbors: options.kNeighbors || 20,
      minSimilarity: options.minSimilarity || 0.1,
      similarityMetric: options.similarityMetric || 'cosine',
      implicitFeedback: options.implicitFeedback || true,
      decayFactor: options.decayFactor || 0.9,
      ...options
    };
  }

  /**
   * Calculate similarity between two users based on their interaction patterns
   */
  calculateUserSimilarity(userId1, userId2) {
    const user1 = this.userProfiles.get(userId1);
    const user2 = this.userProfiles.get(userId2);

    if (!user1 || !user2) return 0;

    const items1 = new Set(user1.interactions.map(i => i.itemId));
    const items2 = new Set(user2.interactions.map(i => i.itemId));
    const commonItems = [...items1].filter(i => items2.has(i));

    if (commonItems.length === 0) return 0;

    // Get ratings for common items
    const ratings1 = commonItems.map(itemId =>
      user1.interactions.find(i => i.itemId === itemId)?.rating || 0
    );
    const ratings2 = commonItems.map(itemId =>
      user2.interactions.find(i => i.itemId === itemId)?.rating || 0
    );

    if (this.options.similarityMetric === 'cosine') {
      return this.cosineSimilarity(ratings1, ratings2);
    } else if (this.options.similarityMetric === 'pearson') {
      return this.pearsonCorrelation(ratings1, ratings2);
    } else if (this.options.similarityMetric === 'euclidean') {
      return 1 / (1 + this.euclideanDistance(ratings1, ratings2));
    }

    return 0;
  }

  cosineSimilarity(a, b) {
    if (a.length === 0 || b.length === 0) return 0;

    const dotProduct = math.dot(a, b);
    const magnitudeA = math.norm(a);
    const magnitudeB = math.norm(b);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  pearsonCorrelation(a, b) {
    if (a.length === 0) return 0;

    const meanA = math.mean(a);
    const meanB = math.mean(b);

    const centeredA = a.map(x => x - meanA);
    const centeredB = b.map(x => x - meanB);

    const dotProduct = math.dot(centeredA, centeredB);
    const magnitudeA = math.norm(centeredA);
    const magnitudeB = math.norm(centeredB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  euclideanDistance(a, b) {
    if (a.length === 0) return 0;
    return math.sqrt(
      math.sum(
        a.map((x, i) => Math.pow(x - (b[i] || 0), 2))
      )
    );
  }

  /**
   * Find k most similar users to the target user
   */
  async findSimilarUsers(targetUserId, k = null) {
    k = k || this.options.kNeighbors;

    const similarUsers = [];

    for (const [userId, profile] of this.userProfiles) {
      if (userId === targetUserId) continue;

      const similarity = this.calculateUserSimilarity(targetUserId, userId);
      if (similarity >= this.options.minSimilarity) {
        similarUsers.push({ userId, similarity });
      }
    }

    return similarUsers
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /**
   * Predict rating for a user-item pair based on similar users' ratings
   */
  predictRating(userId, itemId) {
    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) return 0;

    const similarUsers = this.similarUsersCache.get(userId);
    if (!similarUsers || similarUsers.length === 0) return 0;

    let weightedSum = 0;
    let similaritySum = 0;

    for (const { userId: similarUserId, similarity } of similarUsers) {
      const similarUserProfile = this.userProfiles.get(similarUserId);
      if (!similarUserProfile) continue;

      const interaction = similarUserProfile.interactions.find(i => i.itemId === itemId);
      if (interaction) {
        const adjustedSimilarity = similarity * Math.pow(
          this.options.decayFactor,
          this.options.decayDays - this.getDaysSince(interaction.timestamp)
        );
        weightedSum += adjustedSimilarity * interaction.rating;
        similaritySum += Math.abs(adjustedSimilarity);
      }
    }

    if (similaritySum === 0) return 0;

    const userMeanRating = this.getMeanRating(userProfile);
    return weightedSum / similaritySum + userMeanRating * 0.1;
  }

  /**
   * Get items similar users interacted with
   */
  async getRecommendedItems(userId, itemPool, excludeItems = [], limit = 20) {
    const scores = [];

    for (const item of itemPool) {
      if (excludeItems.includes(item.itemId)) continue;

      const prediction = this.predictRating(userId, item.itemId);
      scores.push({
        itemId: item.itemId,
        item,
        score: prediction,
        source: 'collaborative'
      });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Build user profiles from interactions
   */
  async buildUserProfiles(timeWindowDays = 30) {
    this.userProfiles = new Map();
    this.options.decayDays = timeWindowDays;

    const cutoffDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);

    const interactions = await Interaction.aggregate([
      {
        $match: {
          timestamp: { $gte: cutoffDate },
          userId: { $exists: true }
        }
      },
      {
        $lookup: {
          from: 'user_dna_profiles',
          localField: 'userId',
          foreignField: 'userId',
          as: 'userProfile'
        }
      },
      {
        $group: {
          _id: { userId: '$userId', itemId: '$itemId' },
          userId: { $first: '$userId' },
          itemId: { $first: '$itemId' },
          rating: { $avg: '$value' },
          interactionCount: { $sum: 1 },
          lastInteraction: { $max: '$timestamp' },
          types: { $addToSet: '$type' }
        }
      }
    ]);

    // Group by user
    const userInteractions = new Map();

    for (const interaction of interactions) {
      if (!userInteractions.has(interaction.userId)) {
        userInteractions.set(interaction.userId, []);
      }
      userInteractions.get(interaction.userId).push({
        itemId: interaction.itemId,
        rating: interaction.rating,
        count: interaction.interactionCount,
        timestamp: interaction.lastInteraction,
        types: interaction.types
      });
    }

    // Build profiles
    for (const [userId, interactions] of userInteractions) {
      this.userProfiles.set(userId, {
        interactions,
        meanRating: this.getMeanRating({ interactions }),
        totalInteractions: interactions.length
      });
    }

    // Pre-compute similar users for each user
    this.similarUsersCache = new Map();
    for (const userId of this.userProfiles.keys()) {
      this.similarUsersCache.set(userId, await this.findSimilarUsers(userId));
    }

    logger.info(`Built user profiles for ${this.userProfiles.size} users`);
    return this.userProfiles;
  }

  getMeanRating(userProfile) {
    if (!userProfile.interactions || userProfile.interactions.length === 0) return 0;
    return math.mean(userProfile.interactions.map(i => i.rating));
  }

  getDaysSince(timestamp) {
    return Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Item-to-item collaborative filtering
   */
  async getSimilarItems(itemId, limit = 10) {
    const itemInteractions = await Interaction.aggregate([
      { $match: { itemId, type: { $in: ['view', 'click', 'purchase'] } } },
      { $group: { _id: '$userId' } }
    ]);

    const userIds = itemInteractions.map(i => i._id);

    if (userIds.length === 0) return [];

    const coOccurrences = await Interaction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          itemId: { $ne: itemId },
          type: { $in: ['view', 'click', 'purchase'] }
        }
      },
      {
        $group: {
          _id: '$itemId',
          coOccurrenceCount: { $sum: 1 },
          purchasers: {
            $addToSet: {
              $cond: [{ $eq: ['$type', 'purchase'] }, '$userId', null]
            }
          }
        }
      },
      {
        $addFields: {
          purchaserCount: {
            $size: {
              $filter: {
                input: '$purchasers',
                as: 'p',
                cond: { $ne: ['$$p', null] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          lift: {
            $divide: [
              '$coOccurrenceCount',
              { $add: ['$purchaserCount', 1] }
            ]
          }
        }
      },
      { $sort: { lift: -1 } },
      { $limit: limit }
    ]);

    return coOccurrences.map(item => ({
      itemId: item._id,
      coOccurrenceCount: item.coOccurrenceCount,
      purchaserCount: item.purchaserCount,
      lift: item.lift,
      source: 'collaborative'
    }));
  }

  /**
   * Matrix factorization using SVD
   */
  async matrixFactorization(numFactors = 10, iterations = 20, learningRate = 0.005, regularization = 0.02) {
    const users = [...this.userProfiles.keys()];
    const items = new Set();

    for (const profile of this.userProfiles.values()) {
      for (const interaction of profile.interactions) {
        items.add(interaction.itemId);
      }
    }

    const itemsList = [...items];
    const numUsers = users.length;
    const numItems = itemsList.length;

    // Initialize latent factors
    const P = Array(numUsers).fill(null).map(() =>
      Array(numFactors).fill(null).map(() => randomInt(0, 1000) / 10000)
    );
    const Q = Array(numItems).fill(null).map(() =>
      Array(numFactors).fill(null).map(() => randomInt(0, 1000) / 10000)
    );

    const userIndex = new Map(users.map((u, i) => [u, i]));
    const itemIndex = new Map(itemsList.map((i, idx) => [i, idx]));

    // Build rating matrix
    const ratings = [];
    for (const [userId, profile] of this.userProfiles) {
      for (const interaction of profile.interactions) {
        const itemIdx = itemIndex.get(interaction.itemId);
        if (itemIdx !== undefined) {
          ratings.push({
            user: userIndex.get(userId),
            item: itemIdx,
            rating: interaction.rating
          });
        }
      }
    }

    // SGD training
    for (let iter = 0; iter < iterations; iter++) {
      for (const { user, item, rating } of ratings) {
        const prediction = math.dot(P[user], Q[item]);
        const error = rating - prediction;

        for (let f = 0; f < numFactors; f++) {
          const puf = P[user][f];
          const qif = Q[item][f];

          P[user][f] += learningRate * (error * qif - regularization * puf);
          Q[item][f] += learningRate * (error * puf - regularization * qif);
        }
      }
    }

    return { P, Q, userIndex, itemIndex };
  }

  /**
   * Get recommendations using matrix factorization
   */
  async getRecommendationsMF(userId, itemPool, excludeItems = [], limit = 20, numFactors = 10) {
    if (!this.mfModel) {
      this.mfModel = await this.matrixFactorization(numFactors);
    }

    const { P, Q, userIndex, itemIndex } = this.mfModel;
    const userIdx = userIndex.get(userId);

    if (userIdx === undefined) return [];

    const predictions = [];

    for (const item of itemPool) {
      if (excludeItems.includes(item.itemId)) continue;

      const itemIdx = itemIndex.get(item.itemId);
      if (itemIdx === undefined) continue;

      const score = math.dot(P[userIdx], Q[itemIdx]);
      predictions.push({
        itemId: item.itemId,
        item,
        score: 1 / (1 + Math.exp(-score)), // Sigmoid
        source: 'collaborative_mf'
      });
    }

    return predictions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

module.exports = new CollaborativeFiltering();

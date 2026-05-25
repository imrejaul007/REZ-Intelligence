import logger from './utils/logger';

/**
 * Recommendation Engine ML Model
 * Uses Collaborative Filtering + Content-Based hybrid approach
 */

class RecommendationModel {
  constructor() {
    this.userFactors = {};
    this.itemFactors = {};
    this.globalBias = 0;
    this.userBias = {};
    this.itemBias = {};
    this.isTrained = false;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const key of Object.keys(vec1)) {
      if (vec2[key] !== undefined) {
        dot += vec1[key] * vec2[key];
      }
      norm1 += vec1[key] * vec1[key];
    }

    for (const key of Object.keys(vec2)) {
      norm2 += vec2[key] * vec2[key];
    }

    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-10);
  }

  /**
   * Matrix Factorization training using SGD
   */
  train(interactions, options = {}) {
    const {
      factors = 20,
      learningRate = 0.005,
      regularization = 0.02,
      epochs = 100
    } = options;

    logger.info('🧠 Training Recommendation Model...');
    logger.info(`   Interactions: ${interactions.length}`);
    logger.info(`   Latent factors: ${factors}`);
    logger.info(`   Epochs: ${epochs}`);

    // Initialize user and item factors
    const userIds = [...new Set(interactions.map(i => i.userId))];
    const itemIds = [...new Set(interactions.map(i => i.itemId))];

    logger.info(`   Unique users: ${userIds.length}`);
    logger.info(`   Unique items: ${itemIds.length}`);

    for (const userId of userIds) {
      this.userFactors[userId] = {};
      for (let f = 0; f < factors; f++) {
        this.userFactors[userId][f] = Math.random() * 0.1 - 0.05;
      }
      this.userBias[userId] = 0;
    }

    for (const itemId of itemIds) {
      this.itemFactors[itemId] = {};
      for (let f = 0; f < factors; f++) {
        this.itemFactors[itemId][f] = Math.random() * 0.1 - 0.05;
      }
      this.itemBias[itemId] = 0;
    }

    this.globalBias = interactions.reduce((sum, i) => sum + i.rating, 0) / interactions.length;

    // Training loop
    for (let epoch = 0; epoch < epochs; epoch++) {
      const shuffled = [...interactions].sort(() => Math.random() - 0.5);
      let totalError = 0;

      for (const interaction of shuffled) {
        const { userId, itemId, rating } = interaction;

        // Predict
        let prediction = this.globalBias;
        prediction += this.userBias[userId] || 0;
        prediction += this.itemBias[itemId] || 0;

        for (let f = 0; f < factors; f++) {
          prediction += (this.userFactors[userId][f] || 0) * (this.itemFactors[itemId][f] || 0);
        }

        const error = rating - prediction;
        totalError += Math.abs(error);

        // Update biases
        if (this.userBias[userId] !== undefined) {
          this.userBias[userId] += learningRate * (error - regularization * this.userBias[userId]);
        }
        if (this.itemBias[itemId] !== undefined) {
          this.itemBias[itemId] += learningRate * (error - regularization * this.itemBias[itemId]);
        }

        // Update factors
        for (let f = 0; f < factors; f++) {
          const userF = this.userFactors[userId][f] || 0;
          const itemF = this.itemFactors[itemId][f] || 0;

          this.userFactors[userId][f] = userF + learningRate * (error * itemF - regularization * userF);
          this.itemFactors[itemId][f] = itemF + learningRate * (error * userF - regularization * itemF);
        }
      }

      if (epoch % 20 === 0) {
        const rmse = Math.sqrt(totalError / interactions.length);
        logger.info(`   Epoch ${epoch}: RMSE=${rmse.toFixed(4)}`);
      }
    }

    this.isTrained = true;
    logger.info('✅ Recommendation Model trained successfully!\n');

    return this;
  }

  /**
   * Get recommendations for a user
   */
  recommend(userId, items, options = {}) {
    const { limit = 10, includeScores = true } = options;

    if (!this.isTrained) {
      throw new Error('Model not trained yet');
    }

    const scores = items.map(item => {
      let score = this.globalBias;
      score += this.userBias[userId] || 0;
      score += this.itemBias[item.itemId] || 0;

      const userFactors = this.userFactors[userId] || {};
      const itemFactors = this.itemFactors[item.itemId] || {};

      for (const f of Object.keys(userFactors)) {
        if (itemFactors[f] !== undefined) {
          score += userFactors[f] * itemFactors[f];
        }
      }

      // Boost by item popularity/rating
      if (item.rating) {
        score += item.rating * 0.1;
      }

      return {
        itemId: item.itemId,
        itemName: item.itemName || item.itemId,
        score: Math.max(0, Math.min(1, score / 5)), // Normalize to 0-1
        scoreRaw: score,
        reasons: this._explainRecommendation(userId, item)
      };
    });

    scores.sort((a, b) => b.score - a.score);

    return {
      userId,
      recommendations: scores.slice(0, limit).map(s => ({
        itemId: s.itemId,
        itemName: s.itemName,
        score: includeScores ? s.score : undefined,
        reasons: s.reasons
      })),
      totalScored: items.length
    };
  }

  /**
   * Explain why an item was recommended
   */
  _explainRecommendation(userId, item) {
    const reasons = [];
    const userFactors = this.userFactors[userId] || {};
    const itemFactors = this.itemFactors[item.itemId] || {};

    // Check for strong factor alignment
    let maxAlignment = 0;
    let topFactor = 0;

    for (const f of Object.keys(userFactors)) {
      if (itemFactors[f] !== undefined) {
        const alignment = Math.abs(userFactors[f] * itemFactors[f]);
        if (alignment > maxAlignment) {
          maxAlignment = alignment;
          topFactor = parseInt(f);
        }
      }
    }

    if (maxAlignment > 0.01) {
      reasons.push(`Strong match on latent factor #${topFactor}`);
    }

    if (item.rating && item.rating > 4) {
      reasons.push('High item rating');
    }

    if (this.itemBias[item.itemId] > 0) {
      reasons.push('Item performs above average');
    }

    if (this.userBias[userId] > 0) {
      reasons.push('User has positive bias');
    }

    return reasons;
  }

  /**
   * Find similar items
   */
  findSimilar(itemId, allItems, limit = 10) {
    if (!this.isTrained) {
      throw new Error('Model not trained yet');
    }

    const targetFactors = this.itemFactors[itemId] || {};

    const similarities = allItems
      .filter(item => item.itemId !== itemId)
      .map(item => ({
        itemId: item.itemId,
        itemName: item.itemName || item.itemId,
        similarity: this.cosineSimilarity(targetFactors, this.itemFactors[item.itemId] || {})
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, limit);
  }

  /**
   * Export model
   */
  export() {
    return {
      userFactors: this.userFactors,
      itemFactors: this.itemFactors,
      globalBias: this.globalBias,
      userBias: this.userBias,
      itemBias: this.itemBias,
      modelType: 'recommendation',
      version: '1.0.0',
      trainedAt: new Date().toISOString()
    };
  }

  /**
   * Import model
   */
  import(modelData) {
    this.userFactors = modelData.userFactors;
    this.itemFactors = modelData.itemFactors;
    this.globalBias = modelData.globalBias;
    this.userBias = modelData.userBias;
    this.itemBias = modelData.itemBias;
    this.isTrained = true;
    return this;
  }
}

module.exports = RecommendationModel;

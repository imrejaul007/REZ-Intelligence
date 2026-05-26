const math = require('mathjs');
const { random, randomInt } = require('crypto');
const logger = require('../utils/logger');
const UserDNAProfile = require('../models/UserDNAProfile');
const Interaction = require('../models/Interaction');

class ContextualBandit {
  constructor(options = {}) {
    this.options = {
      explorationRate: options.explorationRate || 0.1,
      learningRate: options.learningRate || 0.1,
      discountFactor: options.discountFactor || 0.95,
      contextDimensions: options.contextDimensions || [
        'time_of_day',
        'day_of_week',
        'device_type',
        'location',
        'engagement_level'
      ],
      algorithm: options.algorithm || 'epsilon_greedy',
      ucbConfiance: options.ucbConfiance || 2,
      ...options
    };

    this.armStats = new Map();
    this.contextHistory = new Map();
  }

  /**
   * Initialize arm statistics
   */
  initArm(armId, context = {}) {
    if (!this.armStats.has(armId)) {
      this.armStats.set(armId, {
        count: 0,
        totalReward: 0,
        avgReward: 0,
        rewards: [],
        contextStats: new Map()
      });
    }
    return this.armStats.get(armId);
  }

  /**
   * Get context vector for current state
   */
  buildContext(context = {}) {
    const now = new Date();

    return {
      time_of_day: now.getHours(),
      day_of_week: now.getDay(),
      device_type: context.deviceType || 'unknown',
      location: context.location || 'unknown',
      engagement_level: context.engagementLevel || 0.5,
      session_count: context.sessionCount || 0,
      recent_interactions: context.recentInteractions || 0
    };
  }

  /**
   * Select arm using epsilon-greedy strategy
   */
  selectArmEpsilonGreedy(context = {}, availableArms = []) {
    const epsilon = this.options.explorationRate;

    // Explore with probability epsilon
    if (random() < epsilon) {
      return {
        armId: availableArms[randomInt(availableArms.length)],
        explore: true
      };
    }

    // Exploit: select best arm
    let bestArm = null;
    let bestScore = -Infinity;

    for (const armId of availableArms) {
      const stats = this.armStats.get(armId);
      if (!stats) continue;

      // UCB score with exploration bonus
      const ucbScore = this.calculateUCB(stats, context);

      if (ucbScore > bestScore) {
        bestScore = ucbScore;
        bestArm = armId;
      }
    }

    // If no stats, explore randomly
    if (!bestArm && availableArms.length > 0) {
      return {
        armId: availableArms[randomInt(availableArms.length)],
        explore: true
      };
    }

    return { armId: bestArm, explore: false };
  }

  /**
   * Select arm using Thompson Sampling
   */
  selectArmThompsonSampling(context = {}, availableArms = []) {
    const samples = [];

    for (const armId of availableArms) {
      const stats = this.armStats.get(armId);

      if (!stats || stats.count === 0) {
        // Unobserved arms get high variance prior
        samples.push({ armId, sample: random() * 0.5 + 0.5 });
        continue;
      }

      // Beta distribution sampling
      const alpha = stats.totalReward + 1;
      const beta = stats.count - stats.totalReward + 1;
      const sample = this.sampleBeta(alpha, beta);

      samples.push({ armId, sample });
    }

    // Select arm with highest sample
    samples.sort((a, b) => b.sample - a.sample);

    return {
      armId: samples[0].armId,
      explore: samples[0].sample < 0.5,
      allSamples: samples
    };
  }

  /**
   * Select arm using LinUCB (Linear Upper Confidence Bound)
   */
  selectArmLinUCB(context = {}, availableArms = []) {
    const contextVector = this.contextToVector(context);
    const alpha = this.options.ucbConfiance;

    let bestArm = null;
    let bestScore = -Infinity;

    for (const armId of availableArms) {
      const stats = this.armStats.get(armId);

      if (!stats || !stats.linearModel) {
        // No model yet, return random
        return {
          armId: availableArms[randomInt(availableArms.length)],
          explore: true
        };
      }

      const { theta, A, Ainv } = stats.linearModel;

      // Predicted reward
      const pred = math.dot(contextVector, theta);

      // Confidence bound
      const confidence = alpha * Math.sqrt(
        math.dot(
          math.multiply(Ainv, contextVector),
          contextVector
        )
      );

      const ucb = pred + confidence;

      if (ucb > bestScore) {
        bestScore = ucb;
        bestArm = armId;
      }
    }

    return { armId: bestArm, explore: false };
  }

  /**
   * Update arm statistics with reward
   */
  updateArm(armId, reward, context = {}) {
    const stats = this.initArm(armId, context);

    stats.count += 1;
    stats.totalReward += reward;
    stats.avgReward = stats.totalReward / stats.count;
    stats.rewards.push(reward);

    // Keep only last 1000 rewards
    if (stats.rewards.length > 1000) {
      stats.rewards.shift();
    }

    // Update context-specific stats
    const contextKey = this.contextToKey(context);
    if (!stats.contextStats.has(contextKey)) {
      stats.contextStats.set(contextKey, {
        count: 0,
        totalReward: 0
      });
    }

    const contextStats = stats.contextStats.get(contextKey);
    contextStats.count += 1;
    contextStats.totalReward += reward;

    // Update linear model if using LinUCB
    if (stats.linearModel) {
      this.updateLinearModel(stats, context, reward);
    }
  }

  /**
   * Initialize linear model for LinUCB
   */
  initLinearModel(stats, dimensions) {
    stats.linearModel = {
      theta: new Array(dimensions).fill(0),
      A: math.identity(dimensions).multiply(1).toArray(),
      Ainv: math.identity(dimensions).toArray(),
      d: dimensions
    };
  }

  /**
   * Update linear model parameters
   */
  updateLinearModel(stats, context, reward) {
    const { theta, A, Ainv, d } = stats.linearModel;
    const x = this.contextToVector(context);

    // Ridge regression update
    const AinvX = math.multiply(Ainv, x);
    const xTAinvX = math.dot(x, AinvX);

    // Update A_inv using Sherman-Morrison
    const denominator = 1 + xTAinvX;
    const outer = math.multiply(AinvX, math.transpose(AinvX));
    const scaledOuter = math.multiply(outer, xTAinvX / denominator);
    const newAinv = math.subtract(Ainv, scaledOuter);

    // Update theta
    const prediction = math.dot(x, theta);
    const error = reward - prediction;
    const thetaUpdate = math.multiply(AinvX, error);

    stats.linearModel = {
      theta: math.add(theta, thetaUpdate).toArray(),
      A: math.add(A, math.multiply(math.outer(x, x), 1)).toArray(),
      Ainv: newAinv.toArray(),
      d
    };
  }

  /**
   * Calculate UCB score
   */
  calculateUCB(stats, context) {
    if (stats.count === 0) return Infinity;

    const avg = stats.avgReward;
    const confidence = this.options.ucbConfiance * Math.sqrt(
      Math.log(this.getTotalPulls() + 1) / stats.count
    );

    return avg + confidence;
  }

  /**
   * Beta distribution sampling
   */
  sampleBeta(alpha, beta) {
    // Using gamma distribution method
    const gammaA = this.sampleGamma(alpha);
    const gammaB = this.sampleGamma(beta);
    return gammaA / (gammaA + gammaB);
  }

  /**
   * Gamma distribution sampling (simplified)
   */
  sampleGamma(shape) {
    if (shape < 1) {
      return this.sampleGamma(shape + 1) * Math.pow(random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x;
      let v;

      do {
        x = this.randn();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = random();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  /**
   * Standard normal random sample
   */
  randn() {
    const u1 = random();
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Get total number of arm pulls
   */
  getTotalPulls() {
    let total = 0;
    for (const stats of this.armStats.values()) {
      total += stats.count;
    }
    return total;
  }

  /**
   * Select arm based on configured algorithm
   */
  selectArm(context = {}, availableArms = []) {
    switch (this.options.algorithm) {
      case 'thompson':
        return this.selectArmThompsonSampling(context, availableArms);
      case 'linucb':
        return this.selectArmLinUCB(context, availableArms);
      case 'epsilon_greedy':
      default:
        return this.selectArmEpsilonGreedy(context, availableArms);
    }
  }

  /**
   * Context to vector conversion
   */
  contextToVector(context) {
    const ctx = this.buildContext(context);
    const vector = [];

    // Time of day (cyclical encoding)
    vector.push(Math.sin(2 * Math.PI * ctx.time_of_day / 24));
    vector.push(Math.cos(2 * Math.PI * ctx.time_of_day / 24));

    // Day of week (cyclical encoding)
    vector.push(Math.sin(2 * Math.PI * ctx.day_of_week / 7));
    vector.push(Math.cos(2 * Math.PI * ctx.day_of_week / 7));

    // Engagement level
    vector.push(ctx.engagement_level);

    // Session count (log scale)
    vector.push(Math.log1p(ctx.session_count));

    // Recent interactions (log scale)
    vector.push(Math.log1p(ctx.recent_interactions));

    // Device type encoding
    const deviceEncodings = { mobile: [1, 0, 0], desktop: [0, 1, 0], tablet: [0, 0, 1] };
    vector.push(...(deviceEncodings[ctx.device_type] || [0, 0, 0]));

    return vector;
  }

  /**
   * Context to string key
   */
  contextToKey(context) {
    const ctx = this.buildContext(context);
    return `${ctx.time_of_day}-${ctx.day_of_week}-${ctx.device_type}`;
  }

  /**
   * Get exploration statistics
   */
  getStats() {
    const stats = {};

    for (const [armId, armStats] of this.armStats) {
      stats[armId] = {
        count: armStats.count,
        avgReward: armStats.avgReward,
        totalReward: armStats.totalReward
      };
    }

    return {
      totalPulls: this.getTotalPulls(),
      armStats: stats,
      explorationRate: this.options.explorationRate,
      algorithm: this.options.algorithm
    };
  }

  /**
   * Reset arm statistics
   */
  reset() {
    this.armStats.clear();
    this.contextHistory.clear();
  }

  /**
   * Persist state for restore
   */
  toJSON() {
    const armStatsObj = {};

    for (const [armId, stats] of this.armStats) {
      armStatsObj[armId] = {
        count: stats.count,
        totalReward: stats.totalReward,
        avgReward: stats.avgReward,
        rewards: stats.rewards,
        linearModel: stats.linearModel
      };
    }

    return {
      options: this.options,
      armStats: armStatsObj
    };
  }

  /**
   * Restore from persisted state
   */
  fromJSON(data) {
    this.options = { ...this.options, ...data.options };
    this.armStats = new Map();

    for (const [armId, stats] of Object.entries(data.armStats)) {
      this.armStats.set(armId, {
        ...stats,
        contextStats: new Map()
      });
    }
  }

  /**
   * Full recommendation loop with bandits
   */
  async recommend(userId, items, context = {}, excludeItems = []) {
    const profile = await UserDNAProfile.findOne({ userId });
    const engagementLevel = profile?.engagementScore || 0.5;

    const enrichedContext = {
      ...context,
      engagementLevel,
      sessionCount: context.sessionCount || 0,
      recentInteractions: context.recentInteractions || 0
    };

    // Initialize arms for each item category
    const availableArms = items
      .filter(item => !excludeItems.includes(item.itemId))
      .map(item => item.category || item.itemId);

    // Ensure all arms are initialized
    const uniqueArms = [...new Set(availableArms)];
    for (const arm of uniqueArms) {
      this.initArm(arm);
    }

    // Select arm
    const { armId: selectedArm, explore } = this.selectArm(enrichedContext, uniqueArms);

    // Get items from selected arm
    let recommendedItems = items.filter(
      item => (item.category || item.itemId) === selectedArm
    );

    // If exploring, add some random items
    if (explore) {
      const exploreItems = items
        .filter(item => !excludeItems.includes(item.itemId))
        .filter(item => (item.category || item.itemId) !== selectedArm)
        .slice(0, Math.ceil(items.length * this.options.explorationRate));

      recommendedItems = [...recommendedItems, ...exploreItems];
    }

    return {
      items: recommendedItems.slice(0, 20),
      selectedArm,
      explore,
      context: enrichedContext
    };
  }
}

module.exports = new ContextualBandit();

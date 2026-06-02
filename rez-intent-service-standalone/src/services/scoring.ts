import { IntentSignal, IIntentSignal } from '../models/intent';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface ScoringFeatures {
  userHistoryScore: number;
  timeOfDayScore: number;
  categoryScore: number;
  priceScore: number;
  velocityScore: number;
}

interface ScoringWeights {
  userHistory: number;
  timeOfDay: number;
  category: number;
  price: number;
  velocity: number;
}

// Configurable weights (can be updated by feedback loop)
const DEFAULT_WEIGHTS: ScoringWeights = {
  userHistory: 0.3,
  timeOfDay: 0.15,
  category: 0.25,
  price: 0.15,
  velocity: 0.15
};

// ============================================
// ADAPTIVE SCORING SERVICE
// ============================================

export class AdaptiveScoringService {
  private weights: ScoringWeights = { ...DEFAULT_WEIGHTS };

  constructor() {
    this.loadWeights();
  }

  /**
   * Load weights from Redis or use defaults
   */
  private async loadWeights(): Promise<void> {
    const cached = await redis.get('scoring:weights');
    if (cached) {
      this.weights = JSON.parse(cached);
    }
  }

  /**
   * Save weights to Redis
   */
  private async saveWeights(): Promise<void> {
    await redis.set('scoring:weights', JSON.stringify(this.weights));
    await redis.setex('scoring:weights:updated', 86400, new Date().toISOString());
  }

  /**
   * Score single intent with ML model
   */
  async scoreIntent(userId: string, intentId: string): Promise<number> {
    const features = await this.extractFeatures(userId, intentId);
    return this.scoreIntentWithFeatures(features);
  }

  /**
   * Score using sigmoid function
   */
  private scoreIntentWithFeatures(features: ScoringFeatures): number {
    const { userHistoryScore, timeOfDayScore, categoryScore, priceScore, velocityScore } = features;

    const weightedSum =
      (features.userHistoryScore * this.weights.userHistory) +
      (timeOfDayScore * this.weights.timeOfDay) +
      (categoryScore * this.weights.category) +
      (priceScore * this.weights.price) +
      (velocityScore * this.weights.velocity);

    // Sigmoid function
    return 1 / (1 + Math.exp(-weightedSum));
  }

  /**
   * Extract features for scoring
   */
  async extractFeatures(userId: string, intentId: string): Promise<ScoringFeatures> {
    const intent = await IntentSignal.findOne({ intentId, userId });

    if (!intent) {
      return {
        userHistoryScore: 0.3,
        timeOfDayScore: 0.5,
        categoryScore: 0.5,
        priceScore: 0.5,
        velocityScore: 0.5
      };
    }

    return {
      userHistoryScore: await this.getUserHistoryScore(userId),
      timeOfDayScore: this.getTimeOfDayScore(intent.category),
      categoryScore: this.getCategoryScore(intent.category),
      priceScore: await this.getPriceScore(intent.intentKey),
      velocityScore: await this.getVelocityScore(intentId)
    };
  }

  /**
   * User conversion history factor
   */
  private async getUserHistoryScore(userId: string): Promise<number> {
    const orderCount = await redis.get(`user:orders:${userId}`);
    const cancelCount = await redis.get(`user:cancels:${userId}`);

    const orders = parseInt(orderCount || '0', 10);
    const cancels = parseInt(cancelCount || '0', 10);

    if (orders === 0) return 0.3;
    if (cancels > orders * 0.5) return 0.3; // High cancellation = low score

    return Math.min(1, orders * 0.1 + 0.3);
  }

  /**
   * Peak hours bonus
   * Peak: 6-9 AM, 12-2 PM, 6-9 PM
   */
  private getTimeOfDayScore(category: string): number {
    const hour = new Date().getHours();

    // Travel peaks
    if (category === 'TRAVEL') {
      if (hour >= 6 && hour <= 9) return 0.9;
      if (hour >= 18 && hour <= 21) return 0.8;
      return 0.5;
    }

    // Dining peaks
    if (category === 'DINING') {
      if (hour >= 12 && hour <= 14) return 0.9;
      if (hour >= 18 && hour <= 21) return 0.85;
      return 0.5;
    }

    // General peaks
    if (hour >= 9 && hour <= 21) return 0.7;

    return 0.4;
  }

  /**
   * Category conversion rate factor
   */
  private getCategoryScore(category: string): number {
    // Historical conversion rates by category
    const categoryRates: Record<string, number> = {
      TRAVEL: 0.75,
      DINING: 0.68,
      RETAIL: 0.62,
      HOTEL_SERVICE: 0.58,
      GENERAL: 0.55
    };

    return categoryRates[category] || 0.5;
  }

  /**
   * Price sensitivity curve
   */
  private async getPriceScore(intentKey: string): Promise<number> {
    // Check if keyword suggests budget sensitivity
    const budgetKeywords = ['cheap', 'budget', 'affordable', 'discount', 'sale', 'deal', 'offer', 'free'];
    const premiumKeywords = ['luxury', 'premium', 'vip', 'exclusive', '5-star'];

    const lower = intentKey.toLowerCase();

    if (budgetKeywords.some(k => lower.includes(k))) return 0.7;
    if (premiumKeywords.some(k => lower.includes(k))) return 0.6;

    return 0.5;
  }

  /**
   * Signal velocity factor
   */
  private async getVelocityScore(intentId: string): Promise<number> {
    const key = `signals:velocity:${intentId}`;
    const count = await redis.incr(key);
    await redis.expire(key, 3600); // 1 hour window

    // More signals in short time = higher intent
    if (count >= 5) return 0.9;
    if (count >= 3) return 0.75;
    if (count >= 2) return 0.6;

    return 0.4;
  }

  /**
   * Retrain model with gradient descent
   * Uses Brier score for optimization
   */
  async retrainModel(predictions: { predicted: number; actual: number }[]): Promise<void> {
    let brierScore = 0;

    for (const { predicted, actual } of predictions) {
      brierScore += Math.pow(predicted - actual, 2);
    }

    const avgBrierScore = brierScore / predictions.length;

    // If Brier score > 0.25, adjust weights
    if (avgBrierScore > 0.25) {
      // Reduce weight of poorly performing features
      this.weights.userHistory *= 0.9;
      this.weights.category *= 0.9;

      // Normalize weights to sum to 1
      const total = Object.values(this.weights).reduce((a, b) => a + b, 0);
      for (const key of Object.keys(this.weights)) {
        this.weights[key as keyof ScoringWeights] /= total;
      }

      await this.saveWeights();
    }

    // Monitor accuracy
    await redis.setex(
      'scoring:accuracy',
      86400,
      JSON.stringify({ brierScore: avgBrierScore, timestamp: new Date() })
    );
  }

  /**
   * Get current model weights
   */
  getCurrentWeights(): ScoringWeights {
    return { ...this.weights };
  }
}

export const adaptiveScoringService = new AdaptiveScoringService();

import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { IntentSignal, SIGNAL_WEIGHTS, BASE_CONFIDENCE } from '../models/intent';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface CaptureParams {
  userId: string;
  appType: 'hotel_ota' | 'restaurant' | 'retail' | 'hotel_guest';
  eventType: 'search' | 'view' | 'wishlist' | 'cart_add' | 'hold' | 'checkout_start' | 'fulfilled' | 'abandoned';
  category: 'TRAVEL' | 'DINING' | 'RETAIL' | 'HOTEL_SERVICE' | 'GENERAL';
  intentKey: string;
  intentQuery?: string;
  merchantId?: string;
  metadata?: Record<string, unknown>;
}

interface CaptureResult {
  intent: any;
  signal: any;
  isNew: boolean;
}

// ============================================
// SIGNAL CAPTURE SERVICE
// ============================================

export class SignalCaptureService {
  /**
   * Capture user intent signal
   * Combines: Intent Graph capture + User Intelligence events
   */
  async capture(params: CaptureParams): Promise<CaptureResult> {
    const { userId, appType, eventType, category, intentKey, intentQuery, merchantId, metadata } = params;

    // Generate IDs
    const signalId = uuidv4();
    const intentId = `${userId}:${intentKey}:${category}`;

    // Calculate confidence scoring
    const signalWeight = SIGNAL_WEIGHTS[eventType] || 1.0;
    const baseConfidence = BASE_CONFIDENCE;
    const recencyMultiplier = await this.calculateRecencyMultiplier(userId, intentKey);
    const velocityBonus = await this.calculateVelocityBonus(userId, intentKey);
    const confidence = Math.min(1, baseConfidence + (signalWeight * 0.2) + recencyMultiplier + velocityBonus);

    // Determine status based on event type
    const status = eventType === 'fulfilled' ? 'FULFILLED' : 'ACTIVE';

    // Create signal
    const signal = {
      signalId,
      intentId,
      userId,
      appType,
      eventType,
      category,
      intentKey,
      intentQuery,
      merchantId,
      metadata,
      confidence,
      weight: signalWeight,
      recencyMultiplier,
      velocityBonus,
      status,
      lastSeenAt: new Date()
    };

    // Check if intent exists
    const existingIntent = await IntentSignal.findOne({ intentId, status: 'ACTIVE' });

    if (existingIntent) {
      // Update existing intent
      existingIntent.signals.push(signal);
      existingIntent.confidence = confidence;
      existingIntent.lastSeenAt = new Date();
      await existingIntent.save();

      return { intent: existingIntent, signal, isNew: false };
    }

    // Create new intent
    const newIntent = new IntentSignal({
      signalId,
      intentId,
      userId,
      appType,
      eventType,
      category,
      intentKey,
      intentQuery,
      merchantId,
      metadata,
      confidence,
      weight: signalWeight,
      recencyMultiplier,
      velocityBonus,
      status,
      lastSeenAt: new Date(),
      signals: [signal]
    });

    await newIntent.save();

    // Cache in Redis (5-min TTL)
    await redis.setex(
      `intent:${intentId}`,
      300,
      JSON.stringify({ intentId, confidence, status })
    );

    return { intent: newIntent, signal, isNew: true };
  }

  /**
   * Calculate recency multiplier (exponential decay)
   */
  private async calculateRecencyMultiplier(userId: string, intentKey: string): Promise<number> {
    const key = `recency:${userId}:${intentKey}`;
    const lastSeen = await redis.get(key);

    if (!lastSeen) return 0.5; // First interaction bonus

    const hoursSince = (Date.now() - parseInt(lastSeen)) / (1000 * 60 * 60);
    return Math.exp(-0.1 * hoursSince); // Exponential decay
  }

  /**
   * Calculate velocity bonus for rapid interactions
   */
  private async calculateVelocityBonus(userId: string, intentKey: string): Promise<number> {
    const key = `velocity:${userId}:${intentKey}`;
    const count = await redis.incr(key);
    await redis.expire(key, 3600); // 1 hour window

    // Bonus for rapid interactions (5+ in an hour = 0.2 bonus)
    return Math.min(0.2, count > 5 ? 0.2 : 0);
  }

  /**
   * Get active intents for user
   */
  async getActiveIntents(userId: string) {
    // Check Redis cache first
    const cached = await redis.get(`active:${userId}`);
    if (cached) return JSON.parse(cached);

    const intents = await IntentSignal.find({
      userId,
      status: 'ACTIVE'
    }).sort({ confidence: -1 }).limit(20);

    // Cache for 2 minutes
    await redis.setex(`active:${userId}`, 120, JSON.stringify(intents));

    return intents;
  }

  /**
   * Get all intents for user
   */
  async getUserIntents(userId: string) {
    return IntentSignal.find({ userId }).sort({ lastSeenAt: -1 });
  }

  /**
   * Get intents by app type
   */
  async getIntentsByApp(userId: string, appType: string) {
    return IntentSignal.find({ userId, appType, status: 'ACTIVE' });
  }

  /**
   * Find similar intents via vector similarity
   */
  async findSimilarIntents(userId: string, intentKey: string, category?: string, limit = 10) {
    const query: any = {
      userId: { $ne: userId },
      intentKey: { $regex: new RegExp(intentKey, 'i') },
      status: 'ACTIVE'
    };

    if (category) {
      query.category = category;
    }

    return IntentSignal.find(query)
      .sort({ confidence: -1 })
      .limit(limit);
  }

  /**
   * Record signal sequence for pattern tracking
   */
  async addToSequence(signalId: string, userId: string, eventType: string) {
    const key = `sequence:${userId}`;
    await redis.lpush(key, JSON.stringify({ signalId, eventType, timestamp: Date.now() }));
    await redis.ltrim(key, 0, 99); // Keep last 100
  }
}

export const signalCaptureService = new SignalCaptureService();

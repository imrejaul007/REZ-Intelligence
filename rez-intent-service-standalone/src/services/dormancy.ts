import { IntentSignal, IIntentSignal } from '../models/intent';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface DormantIntent {
  intentId: string;
  userId: string;
  intentKey: string;
  category: string;
  confidence: number;
  dormantDays: number;
  nudgeCount: number;
  lastNudgedAt?: Date;
  revivedAt?: Date;
  createdAt: Date;
}

const DORMANT_THRESHOLD_DAYS = 7;
const REVIVAL_SWEET_SPOT_MIN = 7;
const REVIVAL_SWEET_SPOT_MAX = 14;

// ============================================
// DORMANT INTENT SERVICE
// ============================================

export class DormantIntentService {
  /**
   * Mark intent as dormant
   */
  async markDormant(intentId: string): Promise<DormantIntent | null> {
    const intent = await IntentSignal.findOne({ intentId });

    if (!intent) return null;

    intent.status = 'DORMANT';
    intent.dormantAt = new Date();
    await intent.save();

    // Cache dormant state
    await redis.setex(`dormant:${intentId}`, 86400, JSON.stringify({
      intentId: intent.intentId,
      userId: intent.userId,
      intentKey: intent.intentKey,
      category: intent.category,
      confidence: intent.confidence,
      dormantDays: 0,
      nudgeCount: 0,
      createdAt: new Date()
    }));

    return this.getDormantIntent(intent.intentId);
  }

  /**
   * Detect and mark dormant intents
   */
  async detectAndMarkDormant(daysThreshold = DORMANT_THRESHOLD_DAYS): Promise<number> {
    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

    const result = await IntentSignal.updateMany({
      lastSeenAt: { $lt: cutoff },
      status: 'ACTIVE'
    }, {
      $set: {
        status: 'DORMANT',
        dormantAt: new Date()
      }
    });

    return result.modifiedCount;
  }

  /**
   * Get user dormant intents
   */
  async getUserDormantIntents(userId: string): Promise<DormantIntent[]> {
    const intents = await IntentSignal.find({
      userId,
      status: 'DORMANT'
    }).sort({ dormantAt: -1 });

    return intents.map(i => ({
      intentId: i.intentId,
      userId: i.userId,
      intentKey: i.intentKey,
      category: i.category,
      confidence: i.confidence,
      dormantDays: Math.floor((Date.now() - i.dormantAt!.getTime()) / 86400000),
      nudgeCount: i.nudgeCount || 0,
      lastNudgedAt: i.lastNudgedAt,
      revivedAt: i.revivedAt,
      createdAt: i.createdAt
    }));
  }

  /**
   * Calculate revival score
   * Sweet spot: 7-14 days
   */
  async calculateRevivalScore(dormantIntentId: string): Promise<number> {
    const intent = await IntentSignal.findOne({ intentId: dormantIntentId });

    if (!intent || !intent.dormantAt) return 0;

    const dormantDays = Math.floor(
      (Date.now() - intent.dormantAt.getTime()) / 86400000
    );

    // Sweet spot: 7-14 days
    if (dormantDays >= REVIVAL_SWEET_SPOT_MIN && dormantDays <= REVIVAL_SWEET_SPOT_MAX) {
      const midpoint = (REVIVAL_SWEET_MIN + REVIVAL_SWEET_MAX) / 2;
      const distance = Math.abs(dormantDays - midpoint);
      return 1 - (distance / REVIVAL_SWEET_MAX);
    }

    // Outside sweet spot
    if (dormantDays < REVIVAL_SWEET_MIN) {
      return dormantDays / REVIVAL_SWEET_MIN * 0.5;
    }

    // After sweet spot, decay
    const decayRate = 0.1;
    return Math.max(0, 0.5 - (dormantDays - REVIVAL_SWEET_MAX) * decayRate);
  }

  /**
   * Calculate optimal nudge timing
   */
  calculateIdealNudgeTime(category: string, dormantDays: number): Date {
    const now = new Date();
    const hour = now.getHours();

    // Travel: morning (8-10 AM) or evening (6-8 PM)
    // Dining: meal times (12-2 PM, 7-9 PM)
    // Retail: evening (6-9 PM)
    // General: afternoon (2-4 PM)

    const timingMap: Record<string, { hour: number; minute: number }> = {
      TRAVEL: { hour: 9, minute: 0 },
      DINING: { hour: 19, minute: 0 },
      RETAIL: { hour: 19, minute: 0 },
      HOTEL_SERVICE: { hour: 14, minute: 0 },
      GENERAL: { hour: 15, minute: 0 }
    };

    const timing = timingMap[category] || { hour: 15, minute: 0 };
    const sendAt = new Date();
    sendAt.setHours(timing.hour, timing.minute, 0, 0);

    // If past timing today, schedule for tomorrow
    if (sendAt <= now) {
      sendAt.setDate(sendAt.getDate() + 1);
    }

    return sendAt;
  }

  /**
   * Trigger revival
   */
  async triggerRevival(
    dormantIntentId: string,
    triggerType: 'price_drop' | 'return_user' | 'seasonality' | 'offer_match' | 'manual'
  ): Promise<{ success: boolean; message: string }> {
    const intent = await IntentSignal.findOne({ intentId: dormantIntentId });

    if (!intent) {
      return { success: false, message: 'Intent not found' };
    }

    // Calculate revival score
    const score = await this.calculateRevivalScore(dormantIntentId);

    if (score < 0.3) {
      return { success: false, message: 'Score too low for revival' };
    }

    // Generate nudge message based on trigger type
    const message = this.generateNudgeMessage(intent.intentKey, intent.category, triggerType);

    // Create nudge record
    intent.nudgeCount = (intent.nudgeCount || 0) + 1;
    intent.lastNudgedAt = new Date();
    await intent.save();

    // Publish to Redis for nudge service
    await redis.lpush('nudge:queue', JSON.stringify({
      intentId: dormantIntentId,
      userId: intent.userId,
      intentKey: intent.intentKey,
      category: intent.category,
      message,
      triggerType,
      score,
      scheduledFor: this.calculateIdealNudgeTime(intent.category, 0).toISOString()
    }));

    return { success: true, message: 'Revival triggered' };
  }

  /**
   * Mark intent as revived
   */
  async markRevived(dormantIntentId: string): Promise<void> {
    const intent = await IntentSignal.findOne({ intentId: dormantIntentId });

    if (intent) {
      intent.status = 'FULFILLED';
      intent.revivedAt = new Date();
      await intent.save();

      // Clear from dormant cache
      await redis.del(`dormant:${dormantIntentId}`);
    }
  }

  /**
   * Get dormant intent helper
   */
  private async getDormantIntent(intentId: string): Promise<DormantIntent | null> {
    const cached = await redis.get(`dormant:${intentId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const intent = await IntentSignal.findOne({ intentId });
    if (!intent || !intent.dormantAt) return null;

    return {
      intentId: intent.intentId,
      userId: intent.userId,
      intentKey: intent.intentKey,
      category: intent.category,
      confidence: intent.confidence,
      dormantDays: Math.floor((Date.now() - intent.dormantAt.getTime()) / 86400000),
      nudgeCount: intent.nudgeCount || 0,
      lastNudgedAt: intent.lastNudgedAt,
      revivedAt: intent.revivedAt,
      createdAt: intent.createdAt
    };
  }

  /**
   * Generate nudge message based on trigger type
   */
  private generateNudgeMessage(
    intentKey: string,
    category: string,
    triggerType: string
  ): string {
    const templates: Record<string, Record<string, string>> = {
      price_drop: {
        TRAVEL: `✨ Great news! Flights to ${intentKey} are now at a lower price! Book now!`,
        DINING: `🍽️ ${intentKey} has new deals! Your favorite cuisine awaits.`,
        RETAIL: `🛍️ ${intentKey} is on sale! Don't miss out!`,
        GENERAL: `${intentKey} - special offer just for you!`
      },
      return_user: {
        TRAVEL: `We miss you! Your ${intentKey} adventure awaits!`,
        DINING: `🍕 Been craving ${intentKey}? We're still here!`,
        RETAIL: `👋 Your search for ${intentKey} had great results!`,
        GENERAL: `Hey! We noticed you were interested in ${intentKey}...`
      },
      seasonality: {
        TRAVEL: `🌴 Perfect timing for ${intentKey}! Check out these deals!`,
        DINING: `🍽️ ${intentKey} season is here! Your favorites await!`,
        RETAIL: `🎉 ${intentKey} season is here! Limited time offers!`,
        GENERAL: `🔥 ${intentKey} - trending now!`
      },
      offer_match: {
        TRAVEL: `✈️ Exclusive ${intentKey} deals just for you!`,
        DINING: `🍴 ${intentKey} + special offer = perfect match!`,
        RETAIL: `🎁 ${intentKey} + bonus = happy you!`,
        GENERAL: `🎯 We found a deal on ${intentKey} just for you!`
      },
      manual: {
        TRAVEL: `🌟 ${intentKey} - special offer inside!`,
        DINING: `🍽️ ${intentKey} - your favorite is calling!`,
        RETAIL: `🛍️ ${intentKey} - exclusive deal inside!`,
        GENERAL: `💫 ${intentKey} - something special for you!`
      }
    };

    return templates[triggerType]?.[category] || `Hey! Check out ${intentKey}!`;
  }
}

export const dormantIntentService = new DormantIntentService();

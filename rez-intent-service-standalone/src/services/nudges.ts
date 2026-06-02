import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface NudgePayload {
  userId: string;
  intentId: string;
  channel: 'push' | 'email' | 'sms' | 'in_app';
  message: string;
}

interface NudgeResult {
  success: boolean;
  nudgeId?: string;
  channel: string;
  sentAt: Date;
}

interface NudgeStats {
  total: number;
  push: number;
  email: number;
  sms: number;
  in_app: number;
}

// ============================================
// NUDGE DELIVERY SERVICE
// ============================================

export class NudgeService {
  /**
   * Send nudge via channel
   */
  async send(payload: NudgePayload): Promise<NudgeResult> {
    const { userId, intentId, channel, message } = payload;
    const nudgeId = `nudge:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    // Record nudge
    await redis.lpush(`nudges:${userId}`, JSON.stringify({
      nudgeId,
      intentId,
      channel,
      message,
      sentAt: new Date().toISOString()
    }));

    // Emit to BullMQ for delivery
    await redis.lpush('nudge:queue', JSON.stringify({
      nudgeId,
      userId,
      channel,
      message
    }));

    // Update stats
    await redis.hincrby('nudge:stats', channel, 1);
    await redis.hincrby('nudge:stats', 'total', 1);

    return {
      success: true,
      nudgeId,
      channel,
      sentAt: new Date()
    };
  }

  /**
   * Get user nudge history
   */
  async getUserHistory(userId: string): Promise<any[]> {
    const history = await redis.lrange(`nudges:${userId}`, 0, 49);
    return history.map(h => JSON.parse(h));
  }

  /**
   * Get nudge stats
   */
  async getStats(): Promise<NudgeStats> {
    const stats = await redis.hgetall('nudge:stats');
    return {
      total: parseInt(stats.total || '0'),
      push: parseInt(stats.push || '0'),
      email: parseInt(stats.email || '0'),
      sms: parseInt(stats.sms || '0'),
      in_app: parseInt(stats.in_app || '0')
    };
  }

  /**
   * Process scheduled nudges
   */
  async processScheduled(): Promise<void> {
    const nudge = await redis.rpop('nudge:scheduled');

    if (nudge) {
      const { userId, intentId, channel, message } = JSON.parse(nudge);
      await this.send({ userId, intentId, channel, message });
    }
  }
}

export const nudgeService = new NudgeService();

import { v4 as uuidv4 } from 'uuid';
import { Nudge, Order } from '../types.js';

// In-memory nudges store
const nudges: Nudge[] = [];

export class NotificationService {
  async sendNudge(userId: string, order: Order, score: number): Promise<{ success: boolean; nudge: Nudge }> {
    const nudge: Nudge = {
      id: uuidv4(),
      userId,
      orderId: order.orderId,
      message: `Time to reorder from ${order.merchantName || 'your favorite merchant'}!`,
      score,
      sentAt: new Date().toISOString(),
      status: 'sent',
    };

    nudges.push(nudge);
    return { success: true, nudge };
  }

  getNudges(): Nudge[] {
    return nudges;
  }

  getNudgesByUser(userId: string): Nudge[] {
    return nudges.filter((n) => n.userId === userId);
  }

  clearNudges(): void {
    nudges.length = 0;
  }
}

export const notificationService = new NotificationService();

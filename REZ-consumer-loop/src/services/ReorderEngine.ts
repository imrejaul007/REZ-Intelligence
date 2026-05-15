import { Order, ReorderScore, ReorderCandidate } from '../types.js';
import { identityGraph } from './IdentityGraph.js';

// In-memory reorder scores store
const reorderScores: Record<string, ReorderScore> = {};

export class ReorderEngine {
  calculateScore(orderData: Order): ReorderScore {
    const daysSinceOrder = Math.floor(
      (Date.now() - new Date(orderData.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Simple scoring algorithm
    const baseScore = 50;
    const recencyBoost = Math.max(0, 30 - daysSinceOrder * 2);
    const frequencyBoost = Math.min(20, orderData.items.length * 5);

    const score = Math.min(100, baseScore + recencyBoost + frequencyBoost);

    return {
      score,
      factors: {
        daysSinceOrder,
        recencyBoost,
        frequencyBoost,
        itemCount: orderData.items.length,
      },
      threshold: 60,
      shouldNudge: score >= 60,
    };
  }

  async processReorders(): Promise<ReorderCandidate[]> {
    const results: ReorderCandidate[] = [];
    const orders = identityGraph.getOrders();

    for (const order of orders) {
      const scoreData = this.calculateScore(order);
      reorderScores[order.orderId] = scoreData;

      if (scoreData.shouldNudge) {
        results.push({
          orderId: order.orderId,
          userId: order.userId,
          merchantId: order.merchantId,
          scoreData,
          action: 'nudge',
        });
      }
    }

    return results;
  }

  getScore(orderId: string): ReorderScore | null {
    return reorderScores[orderId] || null;
  }

  getAllScores(): Record<string, ReorderScore> {
    return reorderScores;
  }

  clearScores(): void {
    Object.keys(reorderScores).forEach((key) => delete reorderScores[key]);
  }
}

export const reorderEngine = new ReorderEngine();

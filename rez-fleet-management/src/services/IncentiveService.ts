/**
 * REZ Fleet Management - Rider Incentive Service
 */

import { RiderIncentive, IncentiveCondition } from '../types';

export class IncentiveService {
  /**
   * Create peak hour incentive
   */
  async createPeakBonus(
    riderId: string,
    conditions: IncentiveCondition[]
  ): Promise<RiderIncentive> {
    const incentive: RiderIncentive = {
      id: `incentive-${Date.now()}`,
      riderId,
      type: 'peak_bonus',
      amount: 50, // ₹50 bonus
      conditions,
      earnedAt: new Date(),
      status: 'pending',
    };

    return incentive;
  }

  /**
   * Calculate distance incentive
   */
  async calculateDistanceBonus(
    riderId: string,
    totalDistance: number
  ): Promise<number> {
    // ₹2 per km beyond 20km
    if (totalDistance > 20) {
      return (totalDistance - 20) * 2;
    }
    return 0;
  }

  /**
   * Create order streak incentive
   */
  async createStreakBonus(
    riderId: string,
    orderCount: number
  ): Promise<RiderIncentive | null> {
    // Streak bonus: 10 orders = ₹100
    if (orderCount >= 10) {
      return {
        id: `streak-${Date.now()}`,
        riderId,
        type: 'streak_bonus',
        amount: 100,
        conditions: [{ metric: 'orders', operator: 'gte', value: 10 }],
        earnedAt: new Date(),
        status: 'earned',
      };
    }
    return null;
  }
}

export const incentiveService = new IncentiveService();

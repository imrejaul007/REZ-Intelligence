import { RFMScore } from '../models/RFMScore.js';
import { RFMAnalyticsResponse, SegmentAnalytics, SEGMENTS } from '../types/index.js';

/**
 * Analytics Service
 * Handles RFM analytics and insights
 */
class AnalyticsService {
  /**
   * Get comprehensive RFM analytics
   */
  async getAnalytics(): Promise<RFMAnalyticsResponse> {
    const [
      totalCustomers,
      segmentDistribution,
    ] = await Promise.all([
      RFMScore.countDocuments(),
      RFMScore.getSegmentDistribution(),
    ]);

    const segments: SegmentAnalytics[] = [];
    const distribution: Record<string, number> = {};

    for (const [segmentCode] of Object.entries(SEGMENTS)) {
      const customerCount = segmentDistribution[segmentCode] || 0;
      const percentage = totalCustomers > 0 ? (customerCount / totalCustomers) * 100 : 0;

      // Get segment-specific stats
      const segmentStats = await this.getSegmentMetrics(segmentCode);

      segments.push({
        segment: segmentCode,
        customerCount,
        percentage: Math.round(percentage * 100) / 100,
        avgRecency: segmentStats.avgRecency,
        avgFrequency: segmentStats.avgFrequency,
        avgMonetary: segmentStats.avgMonetary,
        totalRevenue: segmentStats.totalRevenue,
      });

      distribution[segmentCode] = Math.round(percentage * 100) / 100;
    }

    return {
      totalCustomers,
      segments,
      distribution,
      generatedAt: new Date(),
    };
  }

  /**
   * Get global RFM statistics
   */
  async getGlobalStats(): Promise<{
    avgRecency: number;
    avgFrequency: number;
    avgMonetary: number;
    totalRevenue: number;
    avgOrderValue: number;
    maxSpent: number;
    minSpent: number;
  }> {
    const stats = await RFMScore.aggregate([
      {
        $group: {
          _id: null,
          avgRecency: { $avg: '$recency' },
          avgFrequency: { $avg: '$frequency' },
          avgMonetary: { $avg: '$monetary' },
          totalRevenue: { $sum: '$metadata.totalSpent' },
          avgOrderValue: { $avg: '$metadata.totalSpent' },
          maxSpent: { $max: '$metadata.totalSpent' },
          minSpent: { $min: '$metadata.totalSpent' },
          totalCustomers: { $sum: 1 },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        avgRecency: 0,
        avgFrequency: 0,
        avgMonetary: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        maxSpent: 0,
        minSpent: 0,
      };
    }

    const result = stats[0];
    return {
      avgRecency: Math.round((result.avgRecency || 0) * 100) / 100,
      avgFrequency: Math.round((result.avgFrequency || 0) * 100) / 100,
      avgMonetary: Math.round((result.avgMonetary || 0) * 100) / 100,
      totalRevenue: Math.round((result.totalRevenue || 0) * 100) / 100,
      avgOrderValue: Math.round((result.avgOrderValue || 0) * 100) / 100,
      maxSpent: result.maxSpent || 0,
      minSpent: result.minSpent || 0,
    };
  }

  /**
   * Get metrics for a specific segment
   */
  async getSegmentMetrics(segmentCode: string): Promise<{
    customerCount: number;
    avgRecency: number;
    avgFrequency: number;
    avgMonetary: number;
    totalRevenue: number;
    avgTotalSpent: number;
  }> {
    const stats = await RFMScore.aggregate([
      { $match: { segment: segmentCode } },
      {
        $group: {
          _id: null,
          customerCount: { $sum: 1 },
          avgRecency: { $avg: '$recency' },
          avgFrequency: { $avg: '$frequency' },
          avgMonetary: { $avg: '$monetary' },
          totalRevenue: { $sum: '$metadata.totalSpent' },
          avgTotalSpent: { $avg: '$metadata.totalSpent' },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        customerCount: 0,
        avgRecency: 0,
        avgFrequency: 0,
        avgMonetary: 0,
        totalRevenue: 0,
        avgTotalSpent: 0,
      };
    }

    const result = stats[0];
    return {
      customerCount: result.customerCount,
      avgRecency: Math.round((result.avgRecency || 0) * 100) / 100,
      avgFrequency: Math.round((result.avgFrequency || 0) * 100) / 100,
      avgMonetary: Math.round((result.avgMonetary || 0) * 100) / 100,
      totalRevenue: Math.round((result.totalRevenue || 0) * 100) / 100,
      avgTotalSpent: Math.round((result.avgTotalSpent || 0) * 100) / 100,
    };
  }

  /**
   * Get RFM code distribution
   */
  async getRFMDistribution(): Promise<Record<string, number>> {
    const distribution = await RFMScore.aggregate([
      { $group: { _id: '$rfmCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return distribution.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get customer journey insights
   */
  async getCustomerJourneyInsights(): Promise<{
    newCustomers: number;
    returningCustomers: number;
    atRiskCustomers: number;
    churnedCustomers: number;
  }> {
    const [
      newCustomers,
      returningCustomers,
      atRiskCustomers,
      churnedCustomers,
    ] = await Promise.all([
      RFMScore.countDocuments({ segment: 'recent' }),
      RFMScore.countDocuments({ segment: { $in: ['champions', 'loyal', 'potentialLoyalist'] } }),
      RFMScore.countDocuments({ segment: { $in: ['atRisk', 'needsAttention'] } }),
      RFMScore.countDocuments({ segment: { $in: ['lost', 'lostCheap'] } }),
    ]);

    return {
      newCustomers,
      returningCustomers,
      atRiskCustomers,
      churnedCustomers,
    };
  }

  /**
   * Get segment comparison data
   */
  async getSegmentComparison(): Promise<Array<{
    segment: string;
    avgRecency: number;
    avgFrequency: number;
    avgMonetary: number;
    customerCount: number;
    revenue: number;
  }>> {
    const stats = await RFMScore.aggregate([
      {
        $group: {
          _id: '$segment',
          avgRecency: { $avg: '$recency' },
          avgFrequency: { $avg: '$frequency' },
          avgMonetary: { $avg: '$monetary' },
          customerCount: { $sum: 1 },
          revenue: { $sum: '$metadata.totalSpent' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return stats.map((s) => ({
      segment: s._id,
      avgRecency: Math.round((s.avgRecency || 0) * 100) / 100,
      avgFrequency: Math.round((s.avgFrequency || 0) * 100) / 100,
      avgMonetary: Math.round((s.avgMonetary || 0) * 100) / 100,
      customerCount: s.customerCount,
      revenue: Math.round(s.revenue * 100) / 100,
    }));
  }

  /**
   * Get high-value customers (Champions segment)
   */
  async getHighValueCustomers(limit: number = 10): Promise<Array<{
    customerId: string;
    rfmCode: string;
    totalSpent: number;
    totalOrders: number;
    lastCalculatedAt: Date;
  }>> {
    const customers = await RFMScore.find({ segment: 'champions' })
      .sort({ 'metadata.totalSpent': -1 })
      .limit(limit)
      .select('customerId rfmCode metadata.lastCalculatedAt');

    return customers.map((c) => ({
      customerId: c.customerId,
      rfmCode: c.rfmCode,
      totalSpent: c.metadata?.totalSpent || 0,
      totalOrders: c.metadata?.totalOrders || 0,
      lastCalculatedAt: c.lastCalculatedAt,
    }));
  }

  /**
   * Get customers needing attention
   */
  async getAtRiskCustomers(limit: number = 10): Promise<Array<{
    customerId: string;
    rfmCode: string;
    segment: string;
    daysSinceLastOrder: number;
    totalSpent: number;
  }>> {
    const customers = await RFMScore.find({
      segment: { $in: ['atRisk', 'cantLoseThem', 'needsAttention'] },
    })
      .sort({ 'metadata.daysSinceLastOrder': -1 })
      .limit(limit)
      .select('customerId rfmCode segment metadata');

    return customers.map((c) => ({
      customerId: c.customerId,
      rfmCode: c.rfmCode,
      segment: c.segment,
      daysSinceLastOrder: c.metadata?.daysSinceLastOrder || 0,
      totalSpent: c.metadata?.totalSpent || 0,
    }));
  }

  /**
   * Get scoring thresholds reference
   */
  getScoringThresholds(): { r: number[]; f: number[]; m: number[] } {
    return {
      r: [0, 30, 60, 90, 180],
      f: [1, 2, 5, 10, 20],
      m: [0, 500, 1000, 5000, 10000],
    };
  }
}

export const analyticsService = new AnalyticsService();

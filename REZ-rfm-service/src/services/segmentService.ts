import { Segment } from '../models/Segment.js';
import { RFMScore } from '../models/RFMScore.js';
import { SEGMENTS, UNKNOWN_SEGMENT } from '../types/index.js';
import { logger } from '../middleware/utils/logger.js';

/**
 * Segment Service
 * Handles segment management and queries
 */
class SegmentService {
  /**
   * Initialize segments in the database
   */
  async initializeSegments(): Promise<void> {
    const segmentEntries = Object.values(SEGMENTS);

    for (const segment of segmentEntries) {
      await Segment.findOneAndUpdate(
        { code: segment.code },
        {
          $set: {
            name: segment.name,
            code: segment.code,
            rfmCodes: segment.rfmCodes,
            description: segment.description,
            color: segment.color,
          },
        },
        { upsert: true, new: true }
      );
    }

    logger.info(`Initialized ${segmentEntries.length} segments`);
  }

  /**
   * Get all segments
   */
  async getAllSegments(): Promise<ISegment[]> {
    const dbSegments = await Segment.getAllOrdered();

    if (dbSegments.length === 0) {
      // Return from types if DB is empty
      return Object.values(SEGMENTS);
    }

    return dbSegments.map((s) => ({
      name: s.name,
      code: s.code,
      rfmCodes: s.rfmCodes,
      description: s.description,
      color: s.color,
    }));
  }

  /**
   * Get segment by code
   */
  async getSegmentByCode(code: string): Promise<ISegment | null> {
    const segment = await Segment.findByCode(code);

    if (segment) {
      return {
        name: segment.name,
        code: segment.code,
        rfmCodes: segment.rfmCodes,
        description: segment.description,
        color: segment.color,
      };
    }

    // Check static segments
    if (SEGMENTS[code]) {
      return SEGMENTS[code];
    }

    return null;
  }

  /**
   * Get customers in a segment
   */
  async getCustomersInSegment(
    segmentCode: string,
    options?: { page?: number; limit?: number }
  ): Promise<{
    customers: IRFMScoreDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      RFMScore.find({ segment: segmentCode })
        .sort({ lastCalculatedAt: -1 })
        .skip(skip)
        .limit(limit),
      RFMScore.countDocuments({ segment: segmentCode }),
    ]);

    return {
      customers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get segment statistics
   */
  async getSegmentStats(segmentCode: string): Promise<{
    customerCount: number;
    percentage: number;
    totalCustomers: number;
    avgRecency: number;
    avgFrequency: number;
    avgMonetary: number;
    avgTotalSpent: number;
    totalRevenue: number;
    rfmCodeDistribution: Record<string, number>;
  }> {
    const segment = await this.getSegmentByCode(segmentCode);

    if (!segment) {
      throw new Error(`Segment not found: ${segmentCode}`);
    }

    const totalCustomers = await RFMScore.countDocuments();

    const stats = await RFMScore.aggregate([
      { $match: { segment: segmentCode } },
      {
        $group: {
          _id: null,
          customerCount: { $sum: 1 },
          avgRecency: { $avg: '$recency' },
          avgFrequency: { $avg: '$frequency' },
          avgMonetary: { $avg: '$monetary' },
          avgTotalSpent: { $avg: '$metadata.totalSpent' },
          totalRevenue: { $sum: '$metadata.totalSpent' },
        },
      },
    ]);

    const rfmDistribution = await RFMScore.aggregate([
      { $match: { segment: segmentCode } },
      { $group: { _id: '$rfmCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const result = stats[0] || {
      customerCount: 0,
      avgRecency: 0,
      avgFrequency: 0,
      avgMonetary: 0,
      avgTotalSpent: 0,
      totalRevenue: 0,
    };

    return {
      customerCount: result.customerCount,
      percentage: totalCustomers > 0 ? (result.customerCount / totalCustomers) * 100 : 0,
      totalCustomers,
      avgRecency: Math.round((result.avgRecency || 0) * 100) / 100,
      avgFrequency: Math.round((result.avgFrequency || 0) * 100) / 100,
      avgMonetary: Math.round((result.avgMonetary || 0) * 100) / 100,
      avgTotalSpent: Math.round((result.avgTotalSpent || 0) * 100) / 100,
      totalRevenue: Math.round((result.totalRevenue || 0) * 100) / 100,
      rfmCodeDistribution: rfmDistribution.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Get all segments with customer counts
   */
  async getAllSegmentsWithCounts(): Promise<Array<ISegment & { customerCount: number; percentage: number }>> {
    const totalCustomers = await RFMScore.countDocuments();
    const distribution = await RFMScore.getSegmentDistribution();

    const segments = await this.getAllSegments();

    return segments.map((segment) => ({
      ...segment,
      customerCount: distribution[segment.code] || 0,
      percentage: totalCustomers > 0 ? ((distribution[segment.code] || 0) / totalCustomers) * 100 : 0,
    }));
  }

  /**
   * Get RFM codes for a segment
   */
  getRFMCodesForSegment(segmentCode: string): string[] {
    if (SEGMENTS[segmentCode]) {
      return SEGMENTS[segmentCode].rfmCodes;
    }
    return [];
  }

  /**
   * Validate segment code
   */
  isValidSegment(code: string): boolean {
    return code in SEGMENTS;
  }
}

export const segmentService = new SegmentService();

import { RFMScore, IRFMScoreDocument } from '../models/RFMScore.js';
import { Segment } from '../models/Segment.js';
import {
  IRFMScore,
  RFMScoreValue,
  ICustomerOrderData,
  SEGMENTS,
  UNKNOWN_SEGMENT,
} from '../types/index.js';
import config from '../config/index.js';
import logger from './utils/logger.js';

/**
 * RFM Scoring Service
 * Handles calculation of Recency, Frequency, and Monetary scores
 */
class ScoringService {
  /**
   * Calculate RFM score for a single customer
   */
  async calculateForCustomer(customerId: string, orders: ICustomerOrderData['orders']): Promise<IRFMScore> {
    const now = new Date();

    // Sort orders by date descending
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );

    // Calculate metrics
    const totalOrders = sortedOrders.length;
    const totalSpent = sortedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const lastOrderDate = sortedOrders.length > 0 ? new Date(sortedOrders[0].orderDate) : null;
    const daysSinceLastOrder = lastOrderDate
      ? Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    // Calculate individual scores
    const recency = this.calculateRecencyScore(daysSinceLastOrder);
    const frequency = this.calculateFrequencyScore(totalOrders);
    const monetary = this.calculateMonetaryScore(totalSpent);

    // Generate RFM code
    const rfmCode = `${recency}${frequency}${monetary}`;

    // Determine segment
    const segment = this.determineSegment(rfmCode);

    logger.debug(`Calculated RFM for customer ${customerId}: ${rfmCode} -> ${segment}`);

    return {
      customerId,
      recency,
      frequency,
      monetary,
      rfmCode,
      segment,
      lastCalculatedAt: now,
      metadata: {
        daysSinceLastOrder: daysSinceLastOrder === Infinity ? -1 : daysSinceLastOrder,
        totalOrders,
        totalSpent,
      },
    };
  }

  /**
   * Calculate RFM score and save to database
   */
  async calculateAndSave(customerId: string, orders: ICustomerOrderData['orders']): Promise<IRFMScoreDocument> {
    const rfmScore = await this.calculateForCustomer(customerId, orders);

    const savedScore = await RFMScore.findOneAndUpdate(
      { customerId },
      {
        $set: {
          recency: rfmScore.recency,
          frequency: rfmScore.frequency,
          monetary: rfmScore.monetary,
          rfmCode: rfmScore.rfmCode,
          segment: rfmScore.segment,
          lastCalculatedAt: rfmScore.lastCalculatedAt,
          metadata: rfmScore.metadata,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return savedScore;
  }

  /**
   * Calculate Recency score based on days since last order
   * 5 = 0-30 days
   * 4 = 31-60 days
   * 3 = 61-90 days
   * 2 = 91-180 days
   * 1 = 180+ days
   */
  calculateRecencyScore(daysSinceLastOrder: number): RFMScoreValue {
    if (daysSinceLastOrder === Infinity || daysSinceLastOrder < 0) {
      return 1; // No orders or invalid data
    }
    if (daysSinceLastOrder <= 30) return 5;
    if (daysSinceLastOrder <= 60) return 4;
    if (daysSinceLastOrder <= 90) return 3;
    if (daysSinceLastOrder <= 180) return 2;
    return 1;
  }

  /**
   * Calculate Frequency score based on number of orders
   * 5 = 10+ orders
   * 4 = 7-9 orders
   * 3 = 4-6 orders
   * 2 = 2-3 orders
   * 1 = 1 order
   */
  calculateFrequencyScore(totalOrders: number): RFMScoreValue {
    if (totalOrders >= 10) return 5;
    if (totalOrders >= 7) return 4;
    if (totalOrders >= 4) return 3;
    if (totalOrders >= 2) return 2;
    if (totalOrders === 1) return 1;
    return 1; // No orders
  }

  /**
   * Calculate Monetary score based on total spent
   * 5 = ₹10,000+
   * 4 = ₹5,000-9,999
   * 3 = ₹2,000-4,999
   * 2 = ₹500-1,999
   * 1 = ₹0-499
   */
  calculateMonetaryScore(totalSpent: number): RFMScoreValue {
    if (totalSpent >= 10000) return 5;
    if (totalSpent >= 5000) return 4;
    if (totalSpent >= 2000) return 3;
    if (totalSpent >= 500) return 2;
    return 1;
  }

  /**
   * Determine segment based on RFM code
   */
  determineSegment(rfmCode: string): string {
    for (const [segmentCode, segment] of Object.entries(SEGMENTS)) {
      if (segment.rfmCodes.includes(rfmCode)) {
        return segmentCode;
      }
    }
    return UNKNOWN_SEGMENT.code;
  }

  /**
   * Get RFM score for a customer
   */
  async getScore(customerId: string): Promise<IRFMScoreDocument | null> {
    return RFMScore.findByCustomerId(customerId);
  }

  /**
   * Get all scores for a segment
   */
  async getScoresBySegment(
    segment: string,
    options?: { limit?: number; skip?: number }
  ): Promise<IRFMScoreDocument[]> {
    return RFMScore.findBySegment(segment, options);
  }

  /**
   * Calculate all RFM scores (batch processing)
   * This method expects an external data source to provide customer order data
   */
  async calculateAll(
    customerData: ICustomerOrderData[],
    options?: { onProgress?: (processed: number, total: number) => void }
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    const batchSize = 50;

    for (let i = 0; i < customerData.length; i += batchSize) {
      const batch = customerData.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((customer) => this.calculateAndSave(customer.customerId, customer.orders))
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          failed++;
          logger.error('Failed to calculate RFM for customer', result.reason);
        }
      });

      if (options?.onProgress) {
        options.onProgress(processed + failed, customerData.length);
      }
    }

    logger.info(`RFM calculation completed: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  }

  /**
   * Get scoring thresholds for reference
   */
  getThresholds(): {
    recency: Array<{ maxDays: number; score: RFMScoreValue }>;
    frequency: Array<{ minOrders: number; maxOrders: number; score: RFMScoreValue }>;
    monetary: Array<{ minAmount: number; maxAmount: number; score: RFMScoreValue }>;
  } {
    return {
      recency: [
        { maxDays: 30, score: 5 },
        { maxDays: 60, score: 4 },
        { maxDays: 90, score: 3 },
        { maxDays: 180, score: 2 },
        { maxDays: Infinity, score: 1 },
      ],
      frequency: [
        { minOrders: 10, maxOrders: Infinity, score: 5 },
        { minOrders: 7, maxOrders: 9, score: 4 },
        { minOrders: 4, maxOrders: 6, score: 3 },
        { minOrders: 2, maxOrders: 3, score: 2 },
        { minOrders: 0, maxOrders: 1, score: 1 },
      ],
      monetary: [
        { minAmount: 10000, maxAmount: Infinity, score: 5 },
        { minAmount: 5000, maxAmount: 9999, score: 4 },
        { minAmount: 2000, maxAmount: 4999, score: 3 },
        { minAmount: 500, maxAmount: 1999, score: 2 },
        { minAmount: 0, maxAmount: 499, score: 1 },
      ],
    };
  }
}

export const scoringService = new ScoringService();

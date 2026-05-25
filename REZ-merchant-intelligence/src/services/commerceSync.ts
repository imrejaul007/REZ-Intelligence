import logger from './utils/logger';

/**
 * REZ-merchant-intelligence → Commerce Graph Sync
 *
 * Syncs merchant intelligence to the unified commerce graph
 */

import axios from 'axios';

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

interface MerchantData {
  merchantId: string;
  name: string;
  category: string;
  subcategory?: string;
  location?: { lat: number; lng: number; address: string; area: string };
  tier?: 'basic' | 'standard' | 'premium' | 'elite';
  metrics?: {
    totalRevenue?: number;
    totalOrders?: number;
    avgOrderValue?: number;
    totalCustomers?: number;
    repeatCustomerRate?: number;
    churnRate?: number;
  };
  offers?: {
    active?: number;
    total?: number;
    avgCashback?: number;
  };
  competitors?: string[];
  targetAudience?: string[];
  peakHours?: string[];
}

interface CustomerMetrics {
  merchantId: string;
  customerId: string;
  visits: number;
  totalSpend: number;
  avgBill: number;
  lastVisit: Date;
}

// ============================================
// COMMERCE GRAPH SYNC
// ============================================

class MerchantCommerceSync {
  /**
   * Sync merchant data to Commerce Graph
   */
  async syncMerchant(merchant: MerchantData): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/merchants/${merchant.merchantId}`,
        {
          $set: {
            name: merchant.name,
            category: merchant.category,
            subcategory: merchant.subcategory,
            location: merchant.location,
            tier: merchant.tier,
            'metrics.totalRevenue': merchant.metrics?.totalRevenue,
            'metrics.totalOrders': merchant.metrics?.totalOrders,
            'metrics.avgOrderValue': merchant.metrics?.avgOrderValue,
            'metrics.totalCustomers': merchant.metrics?.totalCustomers,
            'metrics.repeatCustomerRate': merchant.metrics?.repeatCustomerRate,
            'metrics.churnRate': merchant.metrics?.churnRate,
            'offers.active': merchant.offers?.active,
            'offers.total': merchant.offers?.total,
            'offers.avgCashback': merchant.offers?.avgCashback,
            competitors: merchant.competitors,
            targetAudience: merchant.targetAudience,
            peakHours: merchant.peakHours,
            updatedAt: new Date()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[MerchantSync] Merchant synced: ${merchant.merchantId}`);
    } catch (error) {
      logger.error(`[MerchantSync] Failed to sync merchant: ${error.message}`);
    }
  }

  /**
   * Create merchant node
   */
  async createMerchant(merchant: MerchantData): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/merchants`,
        merchant,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[MerchantSync] Merchant created: ${merchant.merchantId}`);
    } catch (error) {
      if (error.message?.includes('409')) {
        // Already exists, update instead
        await this.syncMerchant(merchant);
      } else {
        logger.error(`[MerchantSync] Failed to create merchant: ${error.message}`);
      }
    }
  }

  /**
   * Sync customer metrics for merchant
   */
  async syncCustomerMetrics(metrics: CustomerMetrics): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/merchants/${metrics.merchantId}/customers`,
        {
          customerId: metrics.customerId,
          visits: metrics.visits,
          totalSpend: metrics.totalSpend,
          avgBill: metrics.avgBill,
          lastVisit: metrics.lastVisit
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
    } catch (error) {
      logger.error(`[MerchantSync] Failed to sync customer metrics: ${error.message}`);
    }
  }

  /**
   * Sync cross-sell relationships
   */
  async syncCrossSellRelationship(data: {
    fromMerchantId: string;
    toMerchantId: string;
    fromCategory: string;
    toCategory: string;
    strength: number;
    conversionRate?: number;
  }): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/cross-sell`,
        {
          fromMerchantId: data.fromMerchantId,
          toMerchantId: data.toMerchantId,
          fromCategory: data.fromCategory,
          toCategory: data.toCategory,
          strength: data.strength,
          avgConversionRate: data.conversionRate,
          customerOverlap: 0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[MerchantSync] Cross-sell relationship synced`);
    } catch (error) {
      logger.error(`[MerchantSync] Failed to sync cross-sell: ${error.message}`);
    }
  }

  /**
   * Get merchant from Commerce Graph
   */
  async getMerchant(merchantId: string): Promise<unknown> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/merchants/${merchantId}`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data;
    } catch (error) {
      logger.error(`[MerchantSync] Failed to get merchant: ${error.message}`);
      return null;
    }
  }

  /**
   * Get competitor merchants
   */
  async getCompetitors(merchantId: string): Promise<unknown[]> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/merchants/${merchantId}/competitors`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data || [];
    } catch (error) {
      logger.error(`[MerchantSync] Failed to get competitors: ${error.message}`);
      return [];
    }
  }

  /**
   * Get cross-sell partners
   */
  async getCrossSellPartners(merchantId: string): Promise<unknown[]> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/merchants/${merchantId}/cross-sell-partners`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data || [];
    } catch (error) {
      logger.error(`[MerchantSync] Failed to get cross-sell partners: ${error.message}`);
      return [];
    }
  }

  /**
   * Update merchant metrics
   */
  async updateMetrics(merchantId: string, metrics: MerchantData['metrics']): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/merchants/${merchantId}/metrics`,
        {
          $inc: {
            'metrics.totalRevenue': metrics?.totalRevenue || 0,
            'metrics.totalOrders': metrics?.totalOrders || 0,
            'metrics.totalCustomers': metrics?.totalCustomers || 0
          },
          $set: {
            'metrics.avgOrderValue': metrics?.avgOrderValue,
            'metrics.repeatCustomerRate': metrics?.repeatCustomerRate,
            'metrics.churnRate': metrics?.churnRate,
            updatedAt: new Date()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[MerchantSync] Metrics updated for ${merchantId}`);
    } catch (error) {
      logger.error(`[MerchantSync] Failed to update metrics: ${error.message}`);
    }
  }
}

export const merchantCommerceSync = new MerchantCommerceSync();

import logger from './utils/logger';

/**
 * REZ-signal-aggregator → Commerce Graph Sync
 *
 * Syncs behavioral signals to the unified commerce graph
 */

import axios from 'axios';

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

interface Signal {
  userId: string;
  type: 'search' | 'click' | 'save' | 'share' | 'view' | 'purchase' | 'visit';
  category?: string;
  merchantId?: string;
  productId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

interface SignalBatch {
  signals: Signal[];
  source: string;
}

// ============================================
// COMMERCE GRAPH SYNC
// ============================================

class SignalCommerceSync {
  /**
   * Sync individual signal to Commerce Graph
   */
  async syncSignal(signal: Signal): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/signals`,
        {
          customerId: signal.userId,
          eventType: `signal_${signal.type}`,
          category: signal.category,
          merchantId: signal.merchantId,
          productId: signal.productId,
          metadata: signal.metadata,
          timestamp: signal.timestamp || new Date()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
    } catch (error) {
      logger.error(`[SignalSync] Failed to sync signal: ${error.message}`);
    }
  }

  /**
   * Sync batch of signals
   */
  async syncBatch(batch: SignalBatch): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/signals/batch`,
        {
          signals: batch.signals.map(s => ({
            customerId: s.userId,
            eventType: `signal_${s.type}`,
            category: s.category,
            merchantId: s.merchantId,
            productId: s.productId,
            metadata: s.metadata,
            timestamp: s.timestamp
          })),
          source: batch.source
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[SignalSync] Batch synced ${batch.signals.length} signals`);
    } catch (error) {
      logger.error(`[SignalSync] Failed to sync batch: ${error.message}`);
    }
  }

  /**
   * Update customer intent signals
   */
  async updateCustomerIntents(userId: string, intents: {
    categoryIntents: Array<{ category: string; confidence: number }>;
    merchantIntents: Array<{ merchantId: string; confidence: number }>;
  }): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}/signals`,
        {
          categoryIntents: intents.categoryIntents,
          merchantIntents: intents.merchantIntents,
          lastUpdated: new Date()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[SignalSync] Intents updated for ${userId}`);
    } catch (error) {
      logger.error(`[SignalSync] Failed to update intents: ${error.message}`);
    }
  }

  /**
   * Get moment triggers based on signals
   */
  async getMomentTriggers(userId: string): Promise<unknown[]> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}/moments`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data?.moments || [];
    } catch (error) {
      logger.error(`[SignalSync] Failed to get moments: ${error.message}`);
      return [];
    }
  }

  /**
   * Get cross-sell opportunities based on signals
   */
  async getCrossSellOpportunities(userId: string): Promise<unknown[]> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}/cross-sells`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data?.recommendations || [];
    } catch (error) {
      logger.error(`[SignalSync] Failed to get cross-sells: ${error.message}`);
      return [];
    }
  }

  /**
   * Record intent prediction
   */
  async recordIntentPrediction(userId: string, prediction: {
    category: string;
    confidence: number;
    signals: string[];
  }): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/intent-predictions`,
        {
          customerId: userId,
          ...prediction,
          timestamp: new Date()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
    } catch (error) {
      logger.error(`[SignalSync] Failed to record intent: ${error.message}`);
    }
  }
}

export const signalCommerceSync = new SignalCommerceSync();

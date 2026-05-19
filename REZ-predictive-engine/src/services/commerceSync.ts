/**
 * REZ-predictive-engine → Commerce Graph Sync
 *
 * Syncs predictions to the unified commerce graph
 */

import axios from 'axios';

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

interface PredictionUpdate {
  userId: string;
  churnRisk?: number;
  ltvScore?: number;
  ltvValue?: number;
  revisitProbability?: number;
  spendProbability?: number;
  avgBill?: number;
  nextVisitPrediction?: Date;
}

interface BatchPrediction {
  userId: string;
  predictions: PredictionUpdate;
  modelVersion: string;
}

// ============================================
// COMMERCE GRAPH SYNC
// ============================================

class PredictionCommerceSync {
  /**
   * Sync prediction update to Commerce Graph
   */
  async syncPrediction(update: PredictionUpdate): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/customers/${update.userId}/predictions`,
        {
          $set: {
            'predictions.churnRisk': update.churnRisk,
            'predictions.ltvScore': update.ltvScore,
            'predictions.ltvValue': update.ltvValue,
            'predictions.revisitProbability': update.revisitProbability,
            'predictions.spendProbability': update.spendProbability,
            'predictions.avgBill': update.avgBill,
            'predictions.lastUpdated': new Date()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      console.log(`[PredictionSync] Predictions synced for ${update.userId}`);
    } catch (error) {
      console.error(`[PredictionSync] Failed to sync predictions: ${error.message}`);
    }
  }

  /**
   * Sync LTV update
   */
  async syncLTVUpdate(userId: string, ltv: {
    score: number;
    value: number;
    byChannel?: Record<string, number>;
    predictedMonths?: number;
  }): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}/predictions`,
        {
          $set: {
            'predictions.ltvScore': ltv.score,
            'predictions.ltvValue': ltv.value,
            'predictions.ltvByChannel': ltv.byChannel,
            'predictions.predictedLTVMonths': ltv.predictedMonths,
            'lifetimeValue': ltv.value,
            'predictions.lastUpdated': new Date()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      console.log(`[PredictionSync] LTV synced for ${userId}`);
    } catch (error) {
      console.error(`[PredictionSync] Failed to sync LTV: ${error.message}`);
    }
  }

  /**
   * Sync churn risk update
   */
  async syncChurnRisk(userId: string, churn: {
    risk: number;
    factors: string[];
    recommendedAction?: string;
  }): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}/predictions`,
        {
          $set: {
            'predictions.churnRisk': churn.risk,
            'predictions.churnFactors': churn.factors,
            'predictions.churnRecommendation': churn.recommendedAction,
            'predictions.lastUpdated': new Date()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      console.log(`[PredictionSync] Churn risk synced for ${userId}`);
    } catch (error) {
      console.error(`[PredictionSync] Failed to sync churn risk: ${error.message}`);
    }
  }

  /**
   * Sync spend prediction
   */
  async syncSpendPrediction(userId: string, spend: {
    probability: number;
    avgBill: number;
    maxBill: number;
    minBill: number;
    categoryBreakdown?: Record<string, number>;
  }): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}/predictions`,
        {
          $set: {
            'predictions.spendProbability': spend.probability,
            'predictions.avgBill': spend.avgBill,
            'predictions.maxBill': spend.maxBill,
            'predictions.minBill': spend.minBill,
            'predictions.spendByCategory': spend.categoryBreakdown,
            'predictions.lastUpdated': new Date()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      console.log(`[PredictionSync] Spend prediction synced for ${userId}`);
    } catch (error) {
      console.error(`[PredictionSync] Failed to sync spend prediction: ${error.message}`);
    }
  }

  /**
   * Batch sync predictions
   */
  async syncBatch(predictions: BatchPrediction[]): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/predictions/batch`,
        {
          predictions: predictions.map(p => ({
            customerId: p.userId,
            ...p.predictions,
            modelVersion: p.modelVersion
          }))
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      console.log(`[PredictionSync] Batch synced ${predictions.length} predictions`);
    } catch (error) {
      console.error(`[PredictionSync] Failed to sync batch: ${error.message}`);
    }
  }

  /**
   * Get moment triggers based on predictions
   */
  async getChurnMoments(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/moments/churn-risk`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data?.moments || [];
    } catch (error) {
      console.error(`[PredictionSync] Failed to get churn moments: ${error.message}`);
      return [];
    }
  }

  /**
   * Get high-value customers for targeting
   */
  async getHighValueCustomers(threshold: number = 5000): Promise<string[]> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/customers?minLTV=${threshold}`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data?.customers || [];
    } catch (error) {
      console.error(`[PredictionSync] Failed to get high-value customers: ${error.message}`);
      return [];
    }
  }
}

export const predictionCommerceSync = new PredictionCommerceSync();

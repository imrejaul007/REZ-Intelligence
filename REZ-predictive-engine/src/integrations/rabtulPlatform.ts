/**
 * RABTUL Platform Integration for Predictive Engine
 * Connects ML predictions to RABTUL actions
 */

const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

async function internalRequest(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Platform API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// PREDICTION TRIGGERS
// ============================================

export interface ChurnPrediction {
  userId: string;
  probability: number;
  risk: 'high' | 'medium' | 'low';
  factors: string[];
}

export interface LTVPrediction {
  userId: string;
  ltv: number;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  confidence: number;
}

export const predictionActions = {
  /**
   * Trigger retention campaign for high churn risk
   */
  async triggerRetentionCampaign(prediction: ChurnPrediction): Promise<void> {
    if (prediction.risk !== 'high') return;

    const retentionOffers = [
      { type: 'discount', value: 20, message: '20% off your next order!' },
      { type: 'free_delivery', value: 0, message: 'Free delivery on your next order!' },
      { type: 'bonus_points', value: 100, message: '100 bonus points on your next order!' },
    ];

    // Send notification
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId: prediction.userId,
        notification: {
          title: 'We miss you!',
          body: retentionOffers[0].message,
          data: {
            action: 'retention_offer',
            offer_type: retentionOffers[0].type,
            expires_in: '7_days',
          },
        },
      }),
    });

    // Track analytics
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'retention_campaign_triggered',
        properties: {
          user_id: prediction.userId,
          churn_probability: prediction.probability,
          risk_level: prediction.risk,
        },
      }),
    });
  },

  /**
   * Reward high-value customers
   */
  async rewardHighValueCustomer(prediction: LTVPrediction): Promise<void> {
    if (prediction.tier !== 'platinum' && prediction.tier !== 'gold') return;

    const rewards: Record<string, number> = {
      platinum: 500,
      gold: 200,
    };

    // Award bonus coins
    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId: prediction.userId,
        amount: rewards[prediction.tier],
        reason: 'high_value_customer_reward',
        metadata: {
          ltv: prediction.ltv,
          tier: prediction.tier,
        },
      }),
    });

    // Track analytics
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'high_value_reward_sent',
        properties: {
          user_id: prediction.userId,
          ltv: prediction.ltv,
          tier: prediction.tier,
          reward_amount: rewards[prediction.tier],
        },
      }),
    });
  },

  /**
   * Update user profile with predictions
   */
  async updateProfileWithPredictions(
    userId: string,
    predictions: {
      churnRisk?: number;
      ltv?: number;
      ltvTier?: string;
      revisitProbability?: number;
    }
  ): Promise<void> {
    await internalRequest(`${PROFILE_URL}/api/profiles/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        predictive: {
          churnRisk: predictions.churnRisk,
          ltv: predictions.ltv,
          ltvTier: predictions.ltvTier,
          revisitProbability: predictions.revisitProbability,
          lastUpdated: new Date().toISOString(),
        },
      }),
    });
  },

  /**
   * Alert sales team for high LTV prospects
   */
  async alertSalesForHighLTV(userId: string, ltv: number, tier: string): Promise<void> {
    if (ltv < 20000) return;

    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId: 'sales_team',
        notification: {
          title: 'High-Value Prospect Alert',
          body: `User ${userId} has ${tier} LTV potential: ₹${ltv.toLocaleString()}`,
          data: {
            action: 'view_prospect',
            user_id: userId,
            ltv,
            tier,
          },
        },
      }),
    });
  },
};

// ============================================
// WALLET OPERATIONS
// ============================================

export const walletOperations = {
  /**
   * Award retention bonus
   */
  async awardRetentionBonus(userId: string, amount: number): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        amount,
        reason: 'churn_retention_bonus',
        metadata: { source: 'predictive_engine' },
      }),
    });
  },

  /**
   * Award loyalty upgrade bonus
   */
  async awardLoyaltyBonus(userId: string, amount: number, newTier: string): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        amount,
        reason: `loyalty_upgrade_${newTier}`,
        metadata: { new_tier: newTier },
      }),
    });
  },

  /**
   * Get balance for context
   */
  async getBalance(userId: string): Promise<number> {
    const data = await internalRequest(`${WALLET_URL}/api/wallet/balance/${userId}`);
    return data.coins || 0;
  },
};

// ============================================
// ANALYTICS OPERATIONS
// ============================================

export const analyticsOperations = {
  /**
   * Log prediction for ML observability
   */
  async logPrediction(modelId: string, userId: string, prediction: any, latencyMs: number): Promise<void> {
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'ml_prediction_made',
        properties: {
          model_id: modelId,
          user_id: userId,
          prediction_type: prediction.type,
          prediction_value: prediction.score,
          latency_ms: latencyMs,
          confidence: prediction.confidence,
        },
      }),
    });
  },

  /**
   * Track prediction accuracy
   */
  async trackAccuracy(
    modelId: string,
    userId: string,
    predicted: number,
    actual: number,
    correct: boolean
  ): Promise<void> {
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'ml_prediction_outcome',
        properties: {
          model_id: modelId,
          user_id: userId,
          predicted_value: predicted,
          actual_value: actual,
          correct,
        },
      }),
    });
  },
};

export default {
  actions: predictionActions,
  wallet: walletOperations,
  analytics: analyticsOperations,
};

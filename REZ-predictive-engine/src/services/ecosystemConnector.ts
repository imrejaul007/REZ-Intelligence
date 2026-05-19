/**
 * REZ Predictive Engine - Ecosystem Connector
 * Sends predictions back to ecosystem
 */

import axios from 'axios';

const ECOSYSTEM_URL = process.env.ECOSYSTEM_URL || 'http://localhost:4105';
const LOYALTY_URL = process.env.LOYALTY_URL || 'http://localhost:4097';

// ============================================
// PREDICTIONS
// ============================================

export interface ChurnPrediction {
  userId: string;
  risk: number; // 0-1
  factors: string[];
  recommendedAction?: string;
}

export interface LTVPrediction {
  userId: string;
  predictedLTV: number;
  confidence: number;
  timeframe: string;
}

export interface ConversionPrediction {
  userId: string;
  probability: number;
  optimalOffer?: string;
}

// ============================================
// SEND TO ECOSYSTEM
// ============================================

export async function onChurnRisk(userId: string, risk: number): Promise<void> {
  // High churn risk → trigger retention action
  if (risk > 0.7) {
    // Notify loyalty to send retention offer
    await axios.post(`${LOYALTY_URL}/api/loyalty/retention`, {
      userId,
      riskLevel: risk > 0.9 ? 'critical' : 'high',
      offer: 'retention_bonus',
    });
  }

  // Send to ecosystem hub
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'PREDICTIVE_ENGINE',
    action: 'churn_risk_calculated',
    data: { risk },
  });
}

export async function onLTVUpdate(userId: string, ltv: number): Promise<void> {
  // High LTV → upgrade tier consideration
  if (ltv > 50000) {
    await axios.post(`${LOYALTY_URL}/api/tier/evaluate`, {
      userId,
      predictedLTV: ltv,
    });
  }

  // Send to ecosystem
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'PREDICTIVE_ENGINE',
    action: 'ltv_predicted',
    data: { ltv },
  });
}

export async function onConversionLikelihood(userId: string, probability: number): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'PREDICTIVE_ENGINE',
    action: 'conversion_predicted',
    data: { probability },
  });
}

// ============================================
// GET CONTEXT FROM ECOSYSTEM
// ============================================

export async function getUserHistory(userId: string): Promise<any[]> {
  const response = await axios.get(`${ECOSYSTEM_URL}/api/v1/profile/${userId}/history`);
  return response.data.transactions || [];
}

export async function getUserSignals(userId: string): Promise<any[]> {
  const response = await axios.get(`${ECOSYSTEM_URL}/api/v1/profile/${userId}/signals`);
  return response.data.signals || [];
}

// ============================================
// RETENTION TRIGGERS
// ============================================

export async function triggerRetentionAction(userId: string, action: string): Promise<void> {
  switch (action) {
    case 'bonus_coins':
      await axios.post(`${LOYALTY_URL}/api/earn`, {
        userId,
        amount: 50,
        source: 'PREDICTIVE_RETENTION',
        description: 'Churn prevention bonus',
      });
      break;

    case 'exclusive_offer':
      await axios.post(`${ECOSYSTEM_URL}/api/notifications/send`, {
        userId,
        type: 'push',
        title: 'Special offer just for you!',
        body: 'We miss you! Here is a special discount.',
      });
      break;

    case 're_engagement':
      await axios.post(`${ECOSYSTEM_URL}/api/campaigns/trigger`, {
        campaignId: 'win_back',
        userId,
      });
      break;
  }
}

// ============================================
// HEALTH
// ============================================

export async function healthCheck(): Promise<boolean> {
  try {
    await axios.get(`${ECOSYSTEM_URL}/health`);
    return true;
  } catch {
    return false;
  }
}

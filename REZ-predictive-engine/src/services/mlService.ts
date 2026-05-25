import logger from './utils/logger';

/**
 * ML Service Integration
 *
 * Connects the predictive engine to the ML Production service (Python models)
 * Falls back to RFM-based heuristics when ML service is unavailable
 *
 * ML Service: http://localhost:4080 (REZ-ml-production)
 */

import { UserFeatures } from './mlModels';
import { ChurnRisk, CustomerTier } from '../types';

// ML Service configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:4080';
const ML_SERVICE_TIMEOUT = 5000; // 5 seconds
const ML_SERVICE_BATCH_TIMEOUT = 30000; // 30 seconds for batch

export interface MLChurnResult {
  churn_probability: number;
  will_churn: boolean;
  risk: 'high' | 'medium' | 'low';
  method: 'ml' | 'rfm_fallback';
  confidence: number;
  factors: Array<{
    name: string;
    impact: number;
    value: string;
  }>;
}

export interface ML_LTVResult {
  ltv: number;
  ltv_segment: 'premium' | 'high' | 'medium' | 'low';
  ltv30: number;
  ltv90: number;
  ltv365: number;
  confidence: 'high' | 'medium' | 'low';
  currency: string;
  method: 'ml' | 'rfm_fallback';
}

export interface MLNextPurchaseResult {
  days_until_next_purchase: number;
  predicted_categories: string[];
  estimated_order_value: number;
  confidence: number;
  optimal_channel: string;
  method: 'ml' | 'rfm_fallback';
}

export interface MLPropensityResult {
  action: string;
  score: number;
  factors: Array<{
    name: string;
    impact: number;
    value: string;
  }>;
  recommendations: string[];
}

/**
 * Convert UserFeatures to ML service input format
 */
function featuresToMLInput(features: UserFeatures): Record<string, unknown> {
  return {
    user_id: 'unknown',
    engagement_score: features.engagementScore,
    recency_days: features.daysSinceOrder,
    frequency_score: features.orderFrequency,
    monetary_score: Math.min(features.avgOrderValue / 1000, 10),
    tenure_days: features.tenureDays,
    current_spend: features.totalSpend,
    monthly_spend: features.avgOrderValue * Math.max(1, features.orderFrequency / 6),
    order_count: features.orderFrequency,
    avg_order_value: features.avgOrderValue,
    tenure_months: Math.ceil(features.tenureDays / 30),
    category_diversity: features.preferredCategories.length,
    app_adoption: features.loginFrequency / 30,
    support_tickets: 0,
    session_duration: 0,
    app_opens: 0,
    searches: 0,
    bookings: 0,
  };
}

/**
 * Call ML service with timeout
 */
async function callMLService<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeout: number = ML_SERVICE_TIMEOUT
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      return result as T;
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(`[MLService] Timeout calling ${endpoint}`);
    } else {
      console.warn(`[MLService] Failed to call ${endpoint}:`, error);
    }
    return null;
  }
}

/**
 * Get ML service health status
 */
export async function isMLServiceHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Predict churn using ML service (with RFM fallback)
 */
export async function predictChurnML(
  features: UserFeatures
): Promise<MLChurnResult> {
  const mlInput = featuresToMLInput(features);

  // Try ML service first
  const mlResult = await callMLService<{
    success: boolean;
    prediction: {
      churn_probability: number;
      will_churn: boolean;
      churn_risk: 'high' | 'medium' | 'low';
    };
  }>('/api/predict/churn', mlInput);

  if (mlResult?.success) {
    return {
      churn_probability: mlResult.prediction.churn_probability,
      will_churn: mlResult.prediction.will_churn,
      risk: mlResult.prediction.churn_risk,
      method: 'ml',
      confidence: 0.85,
      factors: [
        { name: 'Days Since Order', impact: 0.3, value: `${features.daysSinceOrder} days` },
        { name: 'Order Frequency', impact: 0.25, value: `${features.orderFrequency} orders` },
        { name: 'Engagement', impact: 0.2, value: `${features.engagementScore}/100` },
      ],
    };
  }

  // Fallback to RFM-based prediction
  return predictChurnRFM(features);
}

/**
 * RFM-based churn fallback prediction
 */
function predictChurnRFM(features: UserFeatures): MLChurnResult {
  let score = 0;

  // Recency component
  if (features.daysSinceOrder > 60) score += 0.5;
  else if (features.daysSinceOrder > 30) score += 0.3;
  else if (features.daysSinceOrder > 14) score += 0.15;

  // Frequency component
  if (features.orderFrequency < 2) score += 0.25;
  else if (features.orderFrequency < 5) score += 0.1;

  // Engagement component
  if (features.engagementScore < 30) score += 0.15;
  else if (features.engagementScore < 60) score += 0.05;

  // Tenure component
  if (features.tenureDays < 30) score += 0.1;

  const probability = Math.min(1, Math.max(0, score));
  const risk: 'high' | 'medium' | 'low' =
    probability > 0.5 ? 'high' : probability > 0.3 ? 'medium' : 'low';

  return {
    churn_probability: probability,
    will_churn: probability > 0.5,
    risk,
    method: 'rfm_fallback',
    confidence: 0.65,
    factors: [
      { name: 'Days Since Order', impact: probability > 0.5 ? 0.5 : 0.2, value: `${features.daysSinceOrder} days` },
      { name: 'Order Frequency', impact: 0.25, value: `${features.orderFrequency} orders` },
      { name: 'Engagement', impact: 0.15, value: `${features.engagementScore}/100` },
    ],
  };
}

/**
 * Predict LTV using ML service (with RFM fallback)
 */
export async function predictLTVML(
  features: UserFeatures
): Promise<ML_LTVResult> {
  const mlInput = featuresToMLInput(features);

  // Try ML service first
  const mlResult = await callMLService<{
    success: boolean;
    prediction: {
      ltv: number;
      ltv_segment: 'premium' | 'high' | 'medium' | 'low';
      confidence: 'high' | 'medium' | 'low';
    };
  }>('/api/predict/ltv', mlInput);

  if (mlResult?.success) {
    const ltv = mlResult.prediction.ltv;
    return {
      ltv,
      ltv_segment: mlResult.prediction.ltv_segment,
      ltv30: Math.round(ltv / 12),
      ltv90: Math.round(ltv / 4),
      ltv365: ltv,
      confidence: mlResult.prediction.confidence,
      currency: 'INR',
      method: 'ml',
    };
  }

  // Fallback to RFM-based LTV
  return predictLTVRFM(features);
}

/**
 * RFM-based LTV fallback prediction
 */
function predictLTVRFM(features: UserFeatures): ML_LTVResult {
  const monthlySpend = features.avgOrderValue * Math.max(1, features.orderFrequency / 6);
  const engagementMultiplier = features.engagementScore / 50;
  const ltv = Math.round(monthlySpend * 12 * Math.max(0.5, Math.min(2, engagementMultiplier)));

  let segment: ML_LTVResult['ltv_segment'] = 'medium';
  if (ltv >= 50000) segment = 'premium';
  else if (ltv >= 25000) segment = 'high';
  else if (ltv >= 10000) segment = 'medium';
  else segment = 'low';

  return {
    ltv,
    ltv_segment: segment,
    ltv30: Math.round(ltv / 12),
    ltv90: Math.round(ltv / 4),
    ltv365: ltv,
    confidence: 'medium',
    currency: 'INR',
    method: 'rfm_fallback',
  };
}

/**
 * Predict next purchase using ML service
 */
export async function predictNextPurchaseML(
  features: UserFeatures
): Promise<MLNextPurchaseResult> {
  // Try ML service first
  const mlResult = await callMLService<{
    success: boolean;
    prediction: {
      days_until_next_purchase: number;
      predicted_categories: string[];
      estimated_order_value: number;
      confidence: number;
      optimal_channel: string;
    };
  }>('/api/predict/next-purchase', featuresToMLInput(features));

  if (mlResult?.success) {
    return {
      ...mlResult.prediction,
      method: 'ml',
    };
  }

  // Fallback to heuristic prediction
  return predictNextPurchaseHeuristic(features);
}

/**
 * Heuristic next purchase prediction
 */
function predictNextPurchaseHeuristic(features: UserFeatures): MLNextPurchaseResult {
  let predictedDays = 14;
  predictedDays += Math.min(features.daysSinceOrder / 6, 1) * 5;
  predictedDays -= Math.min(features.orderFrequency / 10, 1) * 3;
  predictedDays -= features.engagementScore / 200;

  const predictedCategories = features.preferredCategories.slice(0, 3);
  const estimatedValue = features.avgOrderValue * (1 + (Math.random() * 0.2 - 0.1));

  let optimalChannel = 'whatsapp';
  if ((features.signals?.behavioral?.urgencyResponsiveness ?? 0) > 70) {
    optimalChannel = 'push';
  } else if ((features.signals?.behavioral?.luxuryAffinity ?? 0) > 60) {
    optimalChannel = 'email';
  }

  return {
    days_until_next_purchase: Math.max(1, Math.round(predictedDays)),
    predicted_categories: predictedCategories,
    estimated_order_value: Math.round(estimatedValue),
    confidence: 0.6,
    optimal_channel: optimalChannel,
    method: 'rfm_fallback',
  };
}

/**
 * Batch predict churn for multiple users
 */
export async function predictBatchChurnML(
  usersData: UserFeatures[]
): Promise<MLChurnResult[]> {
  const mlInput = usersData.map(featuresToMLInput);

  const mlResult = await callMLService<{
    success: boolean;
    predictions: Array<{
      churn_probability: number;
      will_churn: boolean;
      churn_risk: 'high' | 'medium' | 'low';
    }>;
  }>('/api/batch/churn', { users: mlInput }, ML_SERVICE_BATCH_TIMEOUT);

  if (mlResult?.success) {
    return mlResult.predictions.map((pred, idx) => ({
      churn_probability: pred.churn_probability,
      will_churn: pred.will_churn,
      risk: pred.churn_risk,
      method: 'ml' as const,
      confidence: 0.85,
      factors: [
        { name: 'Days Since Order', impact: 0.3, value: `${usersData[idx].daysSinceOrder} days` },
      ],
    }));
  }

  // Fallback to RFM for all users
  return usersData.map(predictChurnRFM);
}

/**
 * Batch predict LTV for multiple users
 */
export async function predictBatchLTVML(
  usersData: UserFeatures[]
): Promise<ML_LTVResult[]> {
  const mlInput = usersData.map(featuresToMLInput);

  const mlResult = await callMLService<{
    success: boolean;
    predictions: Array<{
      ltv: number;
      ltv_segment: 'premium' | 'high' | 'medium' | 'low';
      confidence: 'high' | 'medium' | 'low';
    }>;
  }>('/api/batch/ltv', { users: mlInput }, ML_SERVICE_BATCH_TIMEOUT);

  if (mlResult?.success) {
    return mlResult.predictions.map((pred) => ({
      ltv: pred.ltv,
      ltv_segment: pred.ltv_segment,
      ltv30: Math.round(pred.ltv / 12),
      ltv90: Math.round(pred.ltv / 4),
      ltv365: pred.ltv,
      confidence: pred.confidence,
      currency: 'INR',
      method: 'ml' as const,
    }));
  }

  // Fallback to RFM for all users
  return usersData.map(predictLTVRFM);
}

/**
 * Get ML service status and capabilities
 */
export async function getMLServiceStatus(): Promise<{
  available: boolean;
  url: string;
  endpoints: string[];
  fallbackMode: boolean;
}> {
  const healthy = await isMLServiceHealthy();

  return {
    available: healthy,
    url: ML_SERVICE_URL,
    endpoints: healthy
      ? ['/api/predict/churn', '/api/predict/ltv', '/api/predict/next-purchase']
      : [],
    fallbackMode: !healthy,
  };
}

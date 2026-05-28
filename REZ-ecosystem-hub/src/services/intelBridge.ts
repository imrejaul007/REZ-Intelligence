import { logger } from '../utils/logger';

/**
 * REZ Intelligence Bridge
 * Sends data to REZ Intelligence services
 * - Signals Aggregator
 * - Identity Graph
 * - Predictive Engine
 * - Recommendation Engine
 */

import axios from 'axios';

const INTELLIGENCE_SERVICES = {
  // Signal Aggregator (Port 4121)
  signals: process.env.REZ_SIGNALS_URL || 'http://localhost:4121',

  // Identity Graph (Port 4050)
  identity: process.env.REZ_IDENTITY_URL || 'http://localhost:4050',

  // Predictive Engine (Port 4123)
  predictive: process.env.REZ_PREDICTIVE_URL || 'http://localhost:4123',

  // Recommendation Engine (Port 3001)
  recommendation: process.env.REZ_RECOMMENDATION_URL || 'http://localhost:3001',

  // Unified Profile (Port 4120)
  unifiedProfile: process.env.REZ_UNIFIED_PROFILE_URL || 'http://localhost:4120',
};

interface Signal {
  userId: string;
  action: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface IdentityLink {
  userId: string;
  identifiers: {
    phone?: string;
    email?: string;
    deviceId?: string;
  };
}

// ============================================
// SIGNALS AGGREGATOR
// ============================================

export async function sendToSignals(signal: Signal): Promise<void> {
  try {
    await axios.post(`${INTELLIGENCE_SERVICES.signals}/api/signals`, {
      userId: signal.userId,
      action: signal.action,
      source: signal.source,
      data: signal.data,
      timestamp: signal.timestamp,
      metadata: signal.metadata,
    });
    logger.info(`Signal sent: ${signal.action} from ${signal.source}`);
  } catch (error) {
    console.error('Failed to send signal:', error);
    // Don't throw - continue processing
  }
}

export async function getUserSignals(userId: string): Promise<Signal[]> {
  try {
    const response = await axios.get(`${INTELLIGENCE_SERVICES.signals}/api/users/${userId}/signals`);
    return response.data.signals;
  } catch (error) {
    console.error('Failed to get signals:', error);
    return [];
  }
}

export async function getUserAggregate(userId: string): Promise<Record<string, unknown>> {
  try {
    const response = await axios.get(`${INTELLIGENCE_SERVICES.signals}/api/users/${userId}/aggregate`);
    return response.data;
  } catch (error) {
    console.error('Failed to get aggregate:', error);
    return {};
  }
}

// ============================================
// IDENTITY GRAPH
// ============================================

export async function resolveIdentity(identifiers: IdentityLink['identifiers']): Promise<string | null> {
  try {
    const response = await axios.post(`${INTELLIGENCE_SERVICES.identity}/api/resolve`, identifiers);
    return response.data.userId;
  } catch (error) {
    console.error('Failed to resolve identity:', error);
    return null;
  }
}

export async function linkIdentity(userId: string, identifiers: IdentityLink['identifiers']): Promise<void> {
  try {
    await axios.post(`${INTELLIGENCE_SERVICES.identity}/api/users/${userId}/link`, identifiers);
  } catch (error) {
    console.error('Failed to link identity:', error);
  }
}

export async function getIdentityProfile(userId: string): Promise<Record<string, unknown>> {
  try {
    const response = await axios.get(`${INTELLIGENCE_SERVICES.identity}/api/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get profile:', error);
    return {};
  }
}

// ============================================
// PREDICTIVE ENGINE
// ============================================

export async function predictChurn(userId: string): Promise<{ risk: number; factors: string[] }> {
  try {
    const response = await axios.get(`${INTELLIGENCE_SERVICES.predictive}/api/churn/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to predict churn:', error);
    return { risk: 0, factors: [] };
  }
}

export async function predictLTV(userId: string): Promise<{ ltv: number; confidence: number }> {
  try {
    const response = await axios.get(`${INTELLIGENCE_SERVICES.predictive}/api/ltv/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to predict LTV:', error);
    return { ltv: 0, confidence: 0 };
  }
}

export async function predictNextAction(userId: string): Promise<string> {
  try {
    const response = await axios.get(`${INTELLIGENCE_SERVICES.predictive}/api/next-action/${userId}`);
    return response.data.action;
  } catch (error) {
    console.error('Failed to predict action:', error);
    return 'unknown';
  }
}

// ============================================
// UNIFIED PROFILE
// ============================================

export async function updateUnifiedProfile(
  userId: string,
  data: {
    action: string;
    source: string;
    data: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await axios.post(`${INTELLIGENCE_SERVICES.unifiedProfile}/api/profiles/${userId}/events`, {
      events: [data],
    });
  } catch (error) {
    console.error('Failed to update profile:', error);
  }
}

export async function getUnifiedProfile(userId: string): Promise<Record<string, unknown>> {
  try {
    const response = await axios.get(`${INTELLIGENCE_SERVICES.unifiedProfile}/api/profiles/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get profile:', error);
    return {};
  }
}

// ============================================
// RECOMMENDATIONS
// ============================================

export async function getRecommendations(
  userId: string,
  context: { type: string; limit?: number }
): Promise<Array<{ id: string; score: number }>> {
  try {
    const response = await axios.post(`${INTELLIGENCE_SERVICES.recommendation}/api/recommend`, {
      userId,
      ...context,
    });
    return response.data.recommendations || [];
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    return [];
  }
}

// ============================================
// BATCH PROCESSING
// ============================================

export async function sendBatchSignals(signals: Signal[]): Promise<void> {
  try {
    await axios.post(`${INTELLIGENCE_SERVICES.signals}/api/signals/batch`, {
      signals,
    });
    logger.info(`Batch sent: ${signals.length} signals`);
  } catch (error) {
    console.error('Failed to send batch signals:', error);
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkIntelligenceHealth(): Promise<Record<string, boolean>> {
  const services = ['signals', 'identity', 'predictive', 'unifiedProfile', 'recommendation'];
  const results: Record<string, boolean> = {};

  await Promise.all(
    services.map(async (service) => {
      try {
        await axios.get(`${INTELLIGENCE_SERVICES[service as keyof typeof INTELLIGENCE_SERVICES]}/health`);
        results[service] = true;
      } catch {
        results[service] = false;
      }
    })
  );

  return results;
}

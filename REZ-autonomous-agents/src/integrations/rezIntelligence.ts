/**
 * REZ Intelligence Integration for Autonomous Agents
 * Connects agents to AI/ML services
 */

const INTENT_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4018';
const PREDICT_URL = process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123';
const IDENTITY_URL = process.env.IDENTITY_URL || 'http://localhost:4050';
const SEGMENTS_URL = process.env.REALTIME_SEGMENTS_URL || 'http://localhost:4126';
const SIGNAL_URL = process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4121';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface IntelligenceConfig {
  baseUrl: string;
  token: string;
}

const config: IntelligenceConfig = {
  baseUrl: INTENT_URL,
  token: INTERNAL_TOKEN,
};

async function intelligenceRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': config.token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Intelligence API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// INTENT PREDICTION
// ============================================

export const intentPrediction = {
  /**
   * Predict user intent
   */
  async predict(userId: string, context?: Record<string, unknown>): Promise<{
    intents: { intent: string; confidence: number }[];
    primaryIntent: string;
    confidence: number;
  }> {
    return intelligenceRequest('/api/intent/predict', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, context }),
    });
  },

  /**
   * Capture user signal
   */
  async captureSignal(signal: {
    userId: string;
    signalType: 'search' | 'view' | 'click' | 'add_to_cart' | 'purchase' | 'wishlist';
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await intelligenceRequest('/api/intent/capture', {
      method: 'POST',
      body: JSON.stringify(signal),
    });
  },

  /**
   * Get active intents for user
   */
  async getActiveIntents(userId: string): Promise<unknown> {
    return intelligenceRequest(`/api/intent/active/${userId}`);
  },
};

// ============================================
// PREDICTIVE ENGINE (Churn, LTV, Revisit)
// ============================================

const predictConfig: IntelligenceConfig = {
  baseUrl: PREDICT_URL,
  token: INTERNAL_TOKEN,
};

async function predictRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${predictConfig.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': predictConfig.token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Predict API error: ${response.status}`);
  }

  return response.json();
}

export const predictiveEngine = {
  /**
   * Predict churn probability
   */
  async predictChurn(userId: string): Promise<{ probability: number; risk: 'high' | 'medium' | 'low'; factors: string[] }> {
    return predictRequest('/api/predict/churn', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  /**
   * Predict customer LTV
   */
  async predictLTV(userId: string): Promise<{ ltv: number; confidence: number; tier: 'high' | 'medium' | 'low' }> {
    return predictRequest('/api/predict/ltv', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  /**
   * Predict revisit probability
   */
  async predictRevisit(userId: string): Promise<{ probability: number; daysUntilExpected: number }> {
    return predictRequest('/api/predict/revisit', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  /**
   * Predict conversion probability
   */
  async predictConversion(userId: string, offerId?: string): Promise<{ probability: number; recommendation: string }> {
    return predictRequest('/api/predict/conversion', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, offer_id: offerId }),
    });
  },

  /**
   * Get user risk score
   */
  async getRiskScore(userId: string): Promise<{ score: number; factors: Record<string, number> }> {
    return predictRequest(`/api/risk/${userId}`);
  },
};

// ============================================
// REAL-TIME SEGMENTS
// ============================================

const segmentsConfig: IntelligenceConfig = {
  baseUrl: SEGMENTS_URL,
  token: INTERNAL_TOKEN,
};

async function segmentsRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${segmentsConfig.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': segmentsConfig.token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Segments API error: ${response.status}`);
  }

  return response.json();
}

export const realtimeSegments = {
  /**
   * Get user segments
   */
  async getUserSegments(userId: string): Promise<{ segments: string[]; scores: Record<string, number> }> {
    return segmentsRequest(`/api/segments/${userId}`);
  },

  /**
   * Get segment members
   */
  async getSegmentMembers(segmentName: string): Promise<{ users: string[]; count: number }> {
    return segmentsRequest(`/api/segments/${segmentName}/members`);
  },

  /**
   * Get DOOH segments
   */
  async getDOOHSegments(userId: string): Promise<{ segments: string[]; scores: Record<string, number> }> {
    return segmentsRequest(`/api/dooh/${userId}`);
  },
};

// ============================================
// SIGNAL AGGREGATOR
// ============================================

const signalConfig: IntelligenceConfig = {
  baseUrl: SIGNAL_URL,
  token: INTERNAL_TOKEN,
};

async function signalRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${signalConfig.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': signalConfig.token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Signal API error: ${response.status}`);
  }

  return response.json();
}

export const signalAggregator = {
  /**
   * Record user signal
   */
  async recordSignal(signal: {
    userId: string;
    type: string;
    source: string;
    properties?: Record<string, unknown>;
  }): Promise<void> {
    await signalRequest('/api/signals', {
      method: 'POST',
      body: JSON.stringify(signal),
    });
  },

  /**
   * Get user signals
   */
  async getUserSignals(userId: string, limit = 50): Promise<unknown[]> {
    return signalRequest(`/api/signals/${userId}`, {
      method: 'GET',
    });
  },

  /**
   * Query signals
   */
  async querySignals(filters: Record<string, unknown>): Promise<unknown[]> {
    return signalRequest('/api/signals/query', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  },
};

// ============================================
// IDENTITY GRAPH
// ============================================

const identityConfig: IntelligenceConfig = {
  baseUrl: IDENTITY_URL,
  token: INTERNAL_TOKEN,
};

async function identityRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${identityConfig.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': identityConfig.token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Identity API error: ${response.status}`);
  }

  return response.json();
}

export const identityGraph = {
  /**
   * Resolve user identity
   */
  async resolve(identifier: string, type: 'email' | 'phone' | 'device' | 'cookie'): Promise<{
    resolved: boolean;
    userId?: string;
    confidence: number;
  }> {
    return identityRequest('/api/identity/resolve', {
      method: 'POST',
      body: JSON.stringify({ identifier, type }),
    });
  },

  /**
   * Link identities
   */
  async linkIdentities(userId: string, identifier: string, type: string): Promise<void> {
    await identityRequest('/api/identity/link', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, identifier, type }),
    });
  },

  /**
   * Get user devices
   */
  async getUserDevices(userId: string): Promise<{ deviceId: string; type: string; lastSeen: string }[]> {
    return identityRequest(`/api/identity/${userId}/devices`);
  },
};

// ============================================
// AGENT-SPECIFIC HELPERS
// ============================================

export const agentHelpers = {
  /**
   * DemandSignalAgent: Get demand trends from signals
   */
  async getDemandTrends(): Promise<{ category: string; velocity: number; trend: string }[]> {
    const signals = await signalAggregator.querySignals({
      type: { $in: ['purchase', 'add_to_cart', 'view'] },
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const byCategory: Record<string, number> = {};
    for (const signal of signals) {
      const cat = signal.properties?.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return Object.entries(byCategory).map(([category, count]) => ({
      category,
      velocity: count,
      trend: count > 100 ? 'high' : count > 50 ? 'medium' : 'low',
    }));
  },

  /**
   * PersonalizationAgent: Get personalized recommendations
   */
  async getPersonalizedOffers(userId: string): Promise<{ offerId: string; title: string; discount: number }[]> {
    const [segments, intent] = await Promise.all([
      realtimeSegments.getUserSegments(userId),
      intentPrediction.predict(userId),
    ]);

    // Combine segments + intent to generate offers
    const primaryIntent = intent.primaryIntent;
    const segmentScores = segments.scores;

    return [
      { offerId: 'offer_1', title: `${primaryIntent} Deal`, discount: 15 },
      { offerId: 'offer_2', title: 'Welcome Back', discount: 20 },
    ];
  },

  /**
   * AttributionAgent: Track conversion attribution
   */
  async trackAttribution(userId: string, channel: string, conversion: boolean): Promise<void> {
    await signalAggregator.recordSignal({
      userId,
      type: conversion ? 'conversion' : 'touchpoint',
      source: channel,
      properties: { conversion },
    });
  },

  /**
   * ScarcityAgent: Get inventory alerts
   */
  async getInventoryAlerts(): Promise<{ productId: string; name: string; ratio: number }[]> {
    // Query signals for low inventory mentions
    const signals = await signalAggregator.querySignals({
      type: 'low_inventory',
    });

    return signals.map((s) => ({
      productId: s.properties?.productId,
      name: s.properties?.productName,
      ratio: s.properties?.ratio || 0,
    }));
  },
};

export default {
  intent: intentPrediction,
  predict: predictiveEngine,
  segments: realtimeSegments,
  signals: signalAggregator,
  identity: identityGraph,
  helpers: agentHelpers,
};

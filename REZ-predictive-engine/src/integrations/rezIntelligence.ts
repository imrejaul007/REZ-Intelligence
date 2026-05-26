/**
 * REZ Intelligence Integration for Predictive Engine
 * Connect predictions to other AI services
 */

const SIGNAL_URL = process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4121';
const SEGMENTS_URL = process.env.REALTIME_SEGMENTS_URL || 'http://localhost:4126';
const IDENTITY_URL = process.env.IDENTITY_URL || 'http://localhost:4050';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

async function intelligenceRequest(url: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Intelligence API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// SIGNAL AGGREGATION
// ============================================

export const signalIntegration = {
  /**
   * Send prediction signals to aggregator
   */
  async sendPredictionSignal(
    userId: string,
    predictionType: string,
    score: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await intelligenceRequest(`${SIGNAL_URL}/api/signals`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        type: `prediction_${predictionType}`,
        source: 'predictive_engine',
        properties: {
          prediction_type: predictionType,
          score,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      }),
    });
  },

  /**
   * Enrich prediction with user signals
   */
  async getUserSignals(userId: string): Promise<Array<{ timestamp: string; type: string; [key: string]: unknown }>> {
    return intelligenceRequest(`${SIGNAL_URL}/api/signals/${userId}`) as Promise<Array<{ timestamp: string; type: string; [key: string]: unknown }>>;
  },

  /**
   * Query behavioral signals
   */
  async querySignals(filters: Record<string, unknown>): Promise<Array<{ timestamp: string; type: string; [key: string]: unknown }>> {
    return intelligenceRequest(`${SIGNAL_URL}/api/signals/query`, {
      method: 'POST',
      body: JSON.stringify(filters),
    }) as Promise<Array<{ timestamp: string; type: string; [key: string]: unknown }>>;
  },
};

// ============================================
// SEGMENTATION
// ============================================

export const segmentIntegration = {
  /**
   * Update user segments based on predictions
   */
  async updateUserSegments(
    userId: string,
    segments: { name: string; score: number }[]
  ): Promise<void> {
    await intelligenceRequest(`${SEGMENTS_URL}/api/segments/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ segments }),
    });
  },

  /**
   * Get at-risk segment
   */
  async getAtRiskSegment(): Promise<{ users: string[]; count: number }> {
    return intelligenceRequest('/api/segments/at_risk/members') as Promise<{ users: string[]; count: number }>;
  },

  /**
   * Get high-value segment
   */
  async getHighValueSegment(): Promise<{ users: string[]; count: number }> {
    return intelligenceRequest('/api/segments/high_value/members') as Promise<{ users: string[]; count: number }>;
  },

  /**
   * Get loyal customers segment
   */
  async getLoyalSegment(): Promise<{ users: string[]; count: number }> {
    return intelligenceRequest('/api/segments/loyal/members') as Promise<{ users: string[]; count: number }>;
  },

  /**
   * Get dormant users segment
   */
  async getDormantSegment(): Promise<{ users: string[]; count: number }> {
    return intelligenceRequest('/api/segments/dormant/members') as Promise<{ users: string[]; count: number }>;
  },
};

// ============================================
// IDENTITY GRAPH
// ============================================

export const identityIntegration = {
  /**
   * Get unified user profile from identity graph
   */
  async getUnifiedProfile(userId: string): Promise<unknown> {
    return intelligenceRequest(`${IDENTITY_URL}/api/identity/${userId}/profile`);
  },

  /**
   * Get all linked identities
   */
  async getLinkedIdentities(userId: string): Promise<{ identifier: string; type: string }[]> {
    return intelligenceRequest(`${IDENTITY_URL}/api/identity/${userId}/links`) as Promise<{ identifier: string; type: string }[]>;
  },

  /**
   * Resolve cross-device user
   */
  async resolveCrossDevice(deviceId: string): Promise<{ resolved: boolean; userId?: string }> {
    const data = await intelligenceRequest(`${IDENTITY_URL}/api/identity/resolve`, {
      method: 'POST',
      body: JSON.stringify({ identifier: deviceId, type: 'device' }),
    }) as { resolved: boolean; userId?: string };
    return { resolved: data.resolved, userId: data.userId };
  },
};

// ============================================
// FEATURE ENRICHMENT
// ============================================

export const featureEnrichment = {
  /**
   * Enrich prediction with behavioral features
   */
  async enrichWithFeatures(
    userId: string,
    predictionType: string
  ): Promise<Record<string, number | string | boolean>> {
    // Get user signals for the last 30 days
    const signals = await signalIntegration.getUserSignals(userId);
    const recentSignals = signals.filter((s) => {
      const signalDate = new Date(s.timestamp);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return signalDate > thirtyDaysAgo;
    });

    // Calculate behavioral features
    const features: Record<string, number | string | boolean> = {
      total_signals_30d: recentSignals.length,
      last_signal_days_ago: recentSignals.length > 0
        ? Math.floor((Date.now() - new Date(recentSignals[0].timestamp).getTime()) / (24 * 60 * 60 * 1000))
        : 999,
    };

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const signal of recentSignals) {
      typeCounts[signal.type] = (typeCounts[signal.type] || 0) + 1;
    }

    return {
      ...features,
      purchase_count_30d: typeCounts['purchase'] || 0,
      view_count_30d: typeCounts['view'] || 0,
      search_count_30d: typeCounts['search'] || 0,
      add_to_cart_count_30d: typeCounts['add_to_cart'] || 0,
    };
  },

  /**
   * Get segment-level features for batch predictions
   */
  async getSegmentFeatures(segmentName: string): Promise<unknown> {
    return intelligenceRequest(`${SEGMENTS_URL}/api/segments/${segmentName}/features`);
  },
};

// ============================================
// PREDICTION PIPELINE
// ============================================

export const predictionPipeline = {
  /**
   * Full prediction pipeline with enrichment
   */
  async runFullPipeline(userId: string): Promise<{
    churn: Record<string, unknown>;
    ltv: Record<string, unknown>;
    revisit: Record<string, unknown>;
    features: Record<string, unknown>;
    segments: string[];
  }> {
    // Run enrichment first
    const features = await featureEnrichment.enrichWithFeatures(userId, 'all');

    // Get segments
    await segmentIntegration.updateUserSegments(userId, []);
    const segments: string[] = [];

    // Return prediction context (actual predictions are in predictionEngine)
    return {
      churn: { features },
      ltv: { features },
      revisit: { features },
      features,
      segments,
    };
  },

  /**
   * Trigger downstream actions based on predictions
   */
  async triggerActions(
    predictions: {
      userId: string;
      churnRisk?: number;
      ltv?: number;
      ltvTier?: string;
      revisitProbability?: number;
    }
  ): Promise<void> {
    const actions: Promise<void>[] = [];

    // Send signals
    if (predictions.churnRisk !== undefined) {
      actions.push(
        signalIntegration.sendPredictionSignal(
          predictions.userId,
          'churn',
          predictions.churnRisk,
          { risk_level: predictions.churnRisk > 0.7 ? 'high' : 'medium' }
        )
      );
    }

    if (predictions.ltv !== undefined) {
      actions.push(
        signalIntegration.sendPredictionSignal(
          predictions.userId,
          'ltv',
          predictions.ltv,
          { tier: predictions.ltvTier }
        )
      );
    }

    // Update segments
    const segments: { name: string; score: number }[] = [];

    if (predictions.churnRisk !== undefined) {
      segments.push({
        name: predictions.churnRisk > 0.7 ? 'at_risk' : predictions.churnRisk > 0.4 ? 'at_risk_moderate' : 'active',
        score: predictions.churnRisk,
      });
    }

    if (predictions.ltvTier !== undefined) {
      segments.push({
        name: `ltv_${predictions.ltvTier.toLowerCase()}`,
        score: predictions.ltv || 0,
      });
    }

    if (segments.length > 0) {
      actions.push(segmentIntegration.updateUserSegments(predictions.userId, segments));
    }

    await Promise.all(actions);
  },
};

export default {
  signals: signalIntegration,
  segments: segmentIntegration,
  identity: identityIntegration,
  features: featureEnrichment,
  pipeline: predictionPipeline,
};

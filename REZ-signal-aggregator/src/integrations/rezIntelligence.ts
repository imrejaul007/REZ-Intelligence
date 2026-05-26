/**
 * REZ Intelligence Integration for Signal Aggregator
 * Connect signals to other AI services
 */

const PREDICT_URL = process.env['PREDICTIVE_ENGINE_URL'] || 'http://localhost:4123';
const SEGMENTS_URL = process.env['REALTIME_SEGMENTS_URL'] || 'http://localhost:4126';
const IDENTITY_URL = process.env['IDENTITY_URL'] || 'http://localhost:4050';
const INTERNAL_TOKEN = process.env['INTERNAL_SERVICE_TOKEN'] || '';

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
// PREDICTIVE ENGINE
// ============================================

const predictConfig = { baseUrl: PREDICT_URL, token: INTERNAL_TOKEN };

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

export const predictiveIntegration = {
  /**
   * Enrich signals with churn prediction
   */
  async enrichWithChurnRisk(userId: string): Promise<{ probability: number; risk: string } | null> {
    try {
      const result = await predictRequest('/api/predict/churn', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }) as { probability: number; risk: string } | null;
      return result ?? { probability: 0, risk: 'unknown' };
    } catch {
      return null;
    }
  },

  /**
   * Enrich signals with LTV prediction
   */
  async enrichWithLTV(userId: string): Promise<{ ltv: number; tier: string } | null> {
    try {
      const result = await predictRequest('/api/predict/ltv', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }) as { ltv: number; tier: string } | null;
      return result ?? { ltv: 0, tier: 'unknown' };
    } catch {
      return null;
    }
  },
};

// ============================================
// REALTIME SEGMENTS
// ============================================

const segmentsConfig = { baseUrl: SEGMENTS_URL, token: INTERNAL_TOKEN };

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
   * Update segments based on signal scores
   */
  async updateSegmentsFromSignals(
    userId: string,
    scores: {
      overall: number;
      behavioral: number;
      engagement: number;
      social: number;
      competitor: number;
      location: number;
    }
  ): Promise<void> {
    const segments: { name: string; score: number }[] = [];

    // Overall segments
    if (scores.overall >= 75) segments.push({ name: 'high_value', score: scores.overall });
    if (scores.overall <= 40) segments.push({ name: 'at_risk', score: 1 - scores.overall / 100 });
    if (scores.engagement >= 60) segments.push({ name: 'engaged', score: scores.engagement });
    if (scores.engagement >= 80) segments.push({ name: 'power_user', score: scores.engagement });
    if (scores.social >= 70) segments.push({ name: 'social_butterfly', score: scores.social });
    if (scores.competitor >= 70) segments.push({ name: 'competitor_conscious', score: scores.competitor });
    if (scores.location >= 65) segments.push({ name: 'location_sensitive', score: scores.location });

    // Update segments service
    await segmentsRequest(`/api/segments/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ segments }),
    });
  },

  /**
   * Get existing segments for enrichment
   */
  async getSegments(userId: string): Promise<{ segments: string[]; scores: Record<string, number> }> {
    const result = await segmentsRequest(`/api/segments/${userId}`) as { segments: string[]; scores: Record<string, number> } | null;
    return result ?? { segments: [], scores: {} };
  },
};

// ============================================
// IDENTITY GRAPH
// ============================================

const identityConfig = { baseUrl: IDENTITY_URL, token: INTERNAL_TOKEN };

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

export const identityIntegration = {
  /**
   * Get all user identifiers for cross-device signal aggregation
   */
  async getAllUserIdentifiers(userId: string): Promise<{
    email?: string;
    phone?: string;
    devices: string[];
  }> {
    try {
      const profile = await identityRequest(`/api/identity/${userId}/profile`) as { email?: string; phone?: string; devices?: string[] };
      return {
        email: profile.email,
        phone: profile.phone,
        devices: profile.devices || [],
      };
    } catch {
      return { devices: [] };
    }
  },

  /**
   * Link signal to unified identity
   */
  async linkSignalToIdentity(identifier: string, type: string, signalData: Record<string, unknown>): Promise<void> {
    await identityRequest('/api/identity/signal', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        type,
        signal: signalData,
      }),
    });
  },
};

// ============================================
// SIGNAL ENRICHMENT
// ============================================

export const signalEnrichment = {
  /**
   * Full signal enrichment pipeline
   */
  async enrichSignals(
    userId: string,
    baseScores: {
      overall: number;
      behavioral: number;
      engagement: number;
      social: number;
      competitor: number;
      location: number;
    }
  ): Promise<{
    signals: typeof baseScores;
    predictions: {
      churnRisk?: number;
      ltv?: number;
      ltvTier?: string;
    };
    segments: string[];
  }> {
    const [churnRisk, ltv, segments] = await Promise.all([
      predictiveIntegration.enrichWithChurnRisk(userId),
      predictiveIntegration.enrichWithLTV(userId),
      realtimeSegments.getSegments(userId),
    ]);

    return {
      signals: baseScores,
      predictions: {
        churnRisk: churnRisk?.probability,
        ltv: ltv?.ltv,
        ltvTier: ltv?.tier,
      },
      segments: segments.segments || [],
    };
  },

  /**
   * Get behavioral context from signals
   */
  async getBehavioralContext(userId: string): Promise<{
    engagementLevel: 'high' | 'medium' | 'low';
    socialLevel: 'high' | 'medium' | 'low';
    purchaseIntent: number;
    brandAffinity: number;
  }> {
    const segments = await realtimeSegments.getSegments(userId);

    const engagementLevel = segments.scores?.engagement >= 70
      ? 'high'
      : segments.scores?.engagement >= 40
        ? 'medium'
        : 'low';

    const socialLevel = segments.scores?.social >= 70
      ? 'high'
      : segments.scores?.social >= 40
        ? 'medium'
        : 'low';

    return {
      engagementLevel,
      socialLevel,
      purchaseIntent: segments.scores?.behavioral || 50,
      brandAffinity: segments.scores?.competitor || 50,
    };
  },
};

export default {
  predict: predictiveIntegration,
  segments: realtimeSegments,
  identity: identityIntegration,
  enrichment: signalEnrichment,
};

/**
 * REZ Intelligence Integration for Realtime Segments
 * Connect segments to other AI services
 */

const SIGNAL_URL = process.env['SIGNAL_AGGREGATOR_URL'] || 'http://localhost:4121';
const PREDICT_URL = process.env['PREDICTIVE_ENGINE_URL'] || 'http://localhost:4123';
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
// SIGNAL AGGREGATION
// ============================================

const signalConfig = { baseUrl: SIGNAL_URL, token: INTERNAL_TOKEN };

interface SignalResponse {
  overall?: number;
  behavioral?: number;
  engagement?: number;
  social?: number;
  competitor?: number;
  location?: number;
}

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

export const signalIntegration = {
  /**
   * Get user signals for segment evaluation
   */
  async getUserSignals(userId: string): Promise<{
    overall: number;
    behavioral: number;
    engagement: number;
    social: number;
    competitor: number;
    location: number;
  }> {
    const data = await signalRequest(`/signals/${userId}/summary`) as SignalResponse;
    return {
      overall: data?.overall || 50,
      behavioral: data?.behavioral || 50,
      engagement: data?.engagement || 50,
      social: data?.social || 50,
      competitor: data?.competitor || 50,
      location: data?.location || 50,
    };
  },

  /**
   * Record segment change as signal
   */
  async recordSegmentSignal(
    userId: string,
    segmentId: string,
    entered: boolean
  ): Promise<void> {
    await signalRequest('/api/signals', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        type: `segment_${segmentId}`,
        source: 'realtime_segments',
        properties: {
          segment_id: segmentId,
          entered,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  },
};

// ============================================
// PREDICTIVE ENGINE
// ============================================

const predictConfig = { baseUrl: PREDICT_URL, token: INTERNAL_TOKEN };

interface ChurnResponse { probability?: number; daysUntilChurn?: number; }
interface LTVResponse { predictedLTV365?: number; tier?: string; }
interface RevisitResponse { probability?: number; }
interface ProfileResponse { devices?: Array<{ id: string }>; [key: string]: unknown; }

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
   * Get predictions for segment enrichment
   */
  async getUserPredictions(userId: string): Promise<{
    churnRisk?: number;
    churnDaysUntil?: number;
    ltv?: number;
    ltvTier?: string;
    revisitProbability?: number;
  }> {
    const [churn, ltv, revisit] = await Promise.all([
      predictRequest('/api/predict/churn', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => null),
      predictRequest('/api/predict/ltv', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => null),
      predictRequest('/api/predict/revisit', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => null),
    ]);

    const churnData = churn as ChurnResponse | null;
    const ltvData = ltv as LTVResponse | null;
    const revisitData = revisit as RevisitResponse | null;

    return {
      churnRisk: churnData?.probability,
      churnDaysUntil: churnData?.daysUntilChurn,
      ltv: ltvData?.predictedLTV365,
      ltvTier: ltvData?.tier,
      revisitProbability: revisitData?.probability,
    };
  },

  /**
   * Trigger retention for at-risk segment
   */
  async triggerRetentionIfAtRisk(_userId: string, churnRisk?: number): Promise<boolean> {
    if (!churnRisk || churnRisk < 0.5) return false;

    // Trigger is handled by segment handlers in rabtulPlatform
    return true;
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
   * Get user profile for segment evaluation
   */
  async getUserProfileForSegments(userId: string): Promise<unknown> {
    return identityRequest(`/api/identity/${userId}/profile`);
  },

  /**
   * Enrich segment with cross-device data
   */
  async enrichWithCrossDevice(userId: string): Promise<{
    deviceCount: number;
    crossDeviceSegments: string[];
  }> {
    try {
      const profile = await identityRequest(`/api/identity/${userId}/profile`) as ProfileResponse;
      const deviceCount = profile?.devices?.length || 0;
      return {
        deviceCount,
        crossDeviceSegments: deviceCount > 1 ? ['multi_device'] : [],
      };
    } catch {
      return { deviceCount: 0, crossDeviceSegments: [] };
    }
  },
};

// ============================================
// SEGMENT EVALUATION HELPERS
// ============================================

export const segmentHelpers = {
  /**
   * Full segment context enrichment
   */
  async enrichSegmentContext(userId: string): Promise<{
    signals: { overall: number; behavioral: number; engagement: number; social: number; competitor: number; location: number; };
    predictions: { churnRisk?: number; churnDaysUntil?: number; ltv?: number; ltvTier?: string; revisitProbability?: number; };
    crossDevice: { deviceCount: number; crossDeviceSegments: string[]; };
  }> {
    const [signals, predictions, crossDevice] = await Promise.all([
      signalIntegration.getUserSignals(userId),
      predictiveIntegration.getUserPredictions(userId),
      identityIntegration.enrichWithCrossDevice(userId),
    ]);

    return { signals, predictions, crossDevice };
  },

  /**
   * Get segment recommendations
   */
  async getSegmentRecommendations(userId: string): Promise<{
    recommendedSegments: string[];
    excludedSegments: string[];
  }> {
    const { signals, predictions } = await this.enrichSegmentContext(userId);

    const recommended: string[] = [];
    const excluded: string[] = [];

    // Signal-based recommendations
    if (signals.engagement >= 70) recommended.push('power_user');
    if (signals.social >= 70) recommended.push('influencer');
    if (signals.behavioral >= 80) recommended.push('frequent_visitor');

    // Prediction-based recommendations
    if (predictions.churnRisk && predictions.churnRisk > 0.7) excluded.push('loyal_customer');
    if (predictions.ltvTier === 'platinum') recommended.push('high_spender');

    return {
      recommendedSegments: [...new Set(recommended)],
      excludedSegments: [...new Set(excluded)],
    };
  },

  /**
   * Get DOOH targeting segments
   */
  async getDOOHTargetingSegments(userId: string): Promise<string[]> {
    const { signals, crossDevice } = await this.enrichSegmentContext(userId);

    const segments: string[] = [];

    // Location-based
    if (signals.location >= 65) {
      segments.push('location_sensitive');
    }

    // Social-based
    if (signals.social >= 70) {
      segments.push('social_audience');
    }

    // Engagement-based
    if (signals.engagement >= 60) {
      segments.push('engaged_audience');
    }

    // Cross-device
    if (crossDevice.deviceCount > 1) {
      segments.push('connected_audience');
    }

    return segments;
  },
};

export default {
  signals: signalIntegration,
  predict: predictiveIntegration,
  identity: identityIntegration,
  helpers: segmentHelpers,
};

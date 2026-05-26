/**
 * REZ Intelligence Integration
 * Connects to AI/ML services
 */

const INTENT_SERVICE_URL = process.env.INTENT_SERVICE_URL || 'https://rez-intent-predictor.onrender.com';
const PREDICTIVE_SERVICE_URL = process.env.PREDICTIVE_ENGINE_URL || 'https://REZ-predictive-engine.onrender.com';
const SIGNAL_SERVICE_URL = process.env.SIGNAL_AGGREGATOR_URL || 'https://REZ-signal-aggregator.onrender.com';
const RECOMMEND_SERVICE_URL = process.env.RECOMMENDATION_ENGINE_URL || 'https://REZ-recommendation-engine.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface SignalsResponse {
  signals?: unknown[];
  [key: string]: unknown;
}

interface RecommendationsResponse {
  recommendations?: unknown[];
  [key: string]: unknown;
}

/**
 * Make authenticated internal API request
 */
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Make authenticated internal API request
 */
async function internalRequest<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
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

  return response.json() as T;
}

// ============================================
// INTENT OPERATIONS
// ============================================

export const intentOperations = {
  async predict(userId, context = {}) {
    try {
      const res = await internalRequest(`${INTENT_SERVICE_URL}/api/intent/predict`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, context }),
      });
      return res;
    } catch {
      return null;
    }
  },

  async captureSignal(signal) {
    try {
      await internalRequest(`${INTENT_SERVICE_URL}/api/intent/capture`, {
        method: 'POST',
        body: JSON.stringify(signal),
      });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// PREDICTIVE OPERATIONS
// ============================================

export const predictiveOperations = {
  async predictChurn(userId) {
    try {
      const res = await internalRequest(`${PREDICTIVE_SERVICE_URL}/predict/${userId}/churn`);
      return res;
    } catch {
      return null;
    }
  },

  async predictLTV(userId) {
    try {
      const res = await internalRequest(`${PREDICTIVE_SERVICE_URL}/predict/${userId}/ltv`);
      return res;
    } catch {
      return null;
    }
  },

  async predictRevisit(userId) {
    try {
      const res = await internalRequest(`${PREDICTIVE_SERVICE_URL}/predict/${userId}/revisit`);
      return res;
    } catch {
      return null;
    }
  },
};

// ============================================
// SIGNAL OPERATIONS
// ============================================

export const signalOperations = {
  async record(signal) {
    try {
      await internalRequest(`${SIGNAL_SERVICE_URL}/api/signals`, {
        method: 'POST',
        body: JSON.stringify(signal),
      });
      return true;
    } catch {
      return false;
    }
  },

  async query(userId, filters = {}) {
    try {
      const res = await internalRequest<SignalsResponse>(`${SIGNAL_SERVICE_URL}/api/signals/${userId}`, {
        method: 'GET',
        body: JSON.stringify(filters),
      });
      return res.signals || [];
    } catch {
      return [];
    }
  },
};

// ============================================
// RECOMMENDATION OPERATIONS
// ============================================

export const recommendationOperations = {
  async get(userId, slot = 'general') {
    try {
      const res = await internalRequest<RecommendationsResponse>(`${RECOMMEND_SERVICE_URL}/api/recommendations/${userId}`, {
        method: 'GET',
        body: JSON.stringify({ slot }),
      });
      return res.recommendations || [];
    } catch {
      return [];
    }
  },
};

// Default export
export default {
  intent: intentOperations,
  predictive: predictiveOperations,
  signals: signalOperations,
  recommendations: recommendationOperations,
};

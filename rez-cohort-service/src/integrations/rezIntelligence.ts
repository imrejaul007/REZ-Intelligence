/**
 * REZ Intelligence Integration
 * Service: 
 */

const INTENT_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4018';
const PREDICT_URL = process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123';
const SEGMENTS_URL = process.env.REALTIME_SEGMENTS_URL || 'http://localhost:4126';
const SIGNAL_URL = process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4121';
const IDENTITY_URL = process.env.IDENTITY_URL || 'http://localhost:4050';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

async function request(url: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const intent = {
  predict: async (userId: string, context?: Record<string, unknown>) =>
    request(`${INTENT_URL}/api/intent/predict`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, context }),
    }),
  captureSignal: async (signal: Record<string, unknown>) =>
    request(`${INTENT_URL}/api/intent/capture`, {
      method: 'POST',
      body: JSON.stringify(signal),
    }),
};

export const predict = {
  churn: async (userId: string) =>
    request(`${PREDICT_URL}/api/predict/churn`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  ltv: async (userId: string) =>
    request(`${PREDICT_URL}/api/predict/ltv`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  conversion: async (userId: string) =>
    request(`${PREDICT_URL}/api/predict/conversion`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
};

export const segments = {
  get: async (userId: string) =>
    request(`${SEGMENTS_URL}/api/segments/${userId}`),
  update: async (userId: string, segs: { name: string; score: number }[]) =>
    request(`${SEGMENTS_URL}/api/segments/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ segments: segs }),
    }),
};

export const signals = {
  record: async (signal: Record<string, unknown>) =>
    request(`${SIGNAL_URL}/api/signals`, {
      method: 'POST',
      body: JSON.stringify(signal),
    }),
  query: async (filters: Record<string, unknown>) =>
    request(`${SIGNAL_URL}/api/signals/query`, {
      method: 'POST',
      body: JSON.stringify(filters),
    }),
};

export const identity = {
  resolve: async (identifier: string, type: string) =>
    request(`${IDENTITY_URL}/api/identity/resolve`, {
      method: 'POST',
      body: JSON.stringify({ identifier, type }),
    }),
  getProfile: async (userId: string) =>
    request(`${IDENTITY_URL}/api/identity/${userId}/profile`),
};

export default { intent, predict, segments, signals, identity };

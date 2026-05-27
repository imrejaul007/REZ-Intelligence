/**
 * REZ Intelligence Integration
 */

const INTENT_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4018';
const PREDICT_URL = process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123';
const SEGMENTS_URL = process.env.REALTIME_SEGMENTS_URL || 'http://localhost:4126';
const SIGNAL_URL = process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4121';
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
  predict: async (userId: string) =>
    request(`${INTENT_URL}/api/intent/predict`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
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
};

export const segments = {
  get: async (userId: string) =>
    request(`${SEGMENTS_URL}/api/segments/${userId}`),
};

export const signals = {
  record: async (signal: Record<string, unknown>) =>
    request(`${SIGNAL_URL}/api/signals`, {
      method: 'POST',
      body: JSON.stringify(signal),
    }),
};

export default { intent, predict, segments, signals };

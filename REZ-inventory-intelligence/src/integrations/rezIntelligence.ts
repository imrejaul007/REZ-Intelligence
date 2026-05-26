/**
 * REZ Intelligence Integration
 */

const INTENT_URL = process.env.INTENT_SERVICE_URL || 'https://rez-intent-predictor.onrender.com';
const PREDICT_URL = process.env.PREDICTIVE_ENGINE_URL || 'https://REZ-predictive-engine.onrender.com';
const SIGNAL_URL = process.env.SIGNAL_AGGREGATOR_URL || 'https://REZ-signal-aggregator.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function request(url: string, options: RequestOptions = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export const intent = {
  predict: async (userId: string, context: Record<string, unknown> = {}): Promise<unknown> =>
    request(`${INTENT_URL}/api/intent/predict`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, context }),
    }),
  captureSignal: async (signal: Record<string, unknown>): Promise<boolean> => {
    try {
      await request(`${INTENT_URL}/api/intent/capture`, {
        method: 'POST',
        body: JSON.stringify(signal),
      });
      return true;
    } catch { return false; }
  },
};

export const predict = {
  churn: async (userId: string): Promise<unknown> =>
    request(`${PREDICT_URL}/api/predict/churn`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  ltv: async (userId: string): Promise<unknown> =>
    request(`${PREDICT_URL}/api/predict/ltv`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
};

export const signals = {
  record: async (signal: Record<string, unknown>): Promise<boolean> => {
    try {
      await request(`${SIGNAL_URL}/api/signals`, {
        method: 'POST',
        body: JSON.stringify(signal),
      });
      return true;
    } catch { return false; }
  },
};

export default { intent, predict, signals };

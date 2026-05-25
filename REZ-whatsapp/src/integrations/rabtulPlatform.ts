/**
 * RABTUL Platform Integration
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
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

export const auth = {
  verify: async (token: string) => request(`${AUTH_URL}/api/auth/verify`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),
};

export const wallet = {
  addCoins: async (userId: string, amount: number, reason: string) =>
    request(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({ userId, amount, reason }),
    }),
  getBalance: async (userId: string) => request(`${WALLET_URL}/api/wallet/balance/${userId}`),
};

export const notifications = {
  send: async (params: { userId: string; title: string; message: string }) =>
    request(`${NOTIFICATION_URL}/api/notifications/send`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

export const analytics = {
  track: async (event: string, properties: Record<string, unknown> = {}) =>
    request(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({ event, properties }),
    }),
};

export const events = {
  publish: async (type: string, category: string, data) =>
    request(`${EVENT_BUS_URL}/api/events`, {
      method: 'POST',
      body: JSON.stringify({ type, category, data, source: 'REZ-whatsapp' }),
    }),
};

export default { auth, wallet, notifications, analytics, events };

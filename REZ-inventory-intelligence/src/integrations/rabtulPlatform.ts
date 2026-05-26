/**
 * RABTUL Platform Integration
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'https://rez-analytics-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface APIResponse {
  success?: boolean;
  user?: Record<string, unknown>;
  valid?: boolean;
  balance?: number;
  transactions?: unknown[];
  events?: unknown[];
  [key: string]: unknown;
}

async function request(url: string, options: RequestOptions = {}): Promise<APIResponse> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json() as Promise<APIResponse>;
}

export const authOperations = {
  async verify(token: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await request(`${AUTH_URL}/api/auth/verify`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return res.success ? res.user ?? null : null;
    } catch { return null; }
  },
  async validateInternalToken(): Promise<boolean> {
    try {
      const res = await request(`${AUTH_URL}/api/auth/internal/validate`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      return res.valid ?? false;
    } catch { return false; }
  },
};

export const walletOperations = {
  async getBalance(userId: string): Promise<number> {
    try {
      const res = await request(`${WALLET_URL}/api/wallet/${userId}/balance`);
      return res.balance ?? 0;
    } catch { return 0; }
  },
  async addCoins(userId: string, amount: number, reason: string): Promise<boolean> {
    try {
      await request(`${WALLET_URL}/api/wallet/add`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason }),
      });
      return true;
    } catch { return false; }
  },
  async deductCoins(userId: string, amount: number, reason: string): Promise<boolean> {
    try {
      await request(`${WALLET_URL}/api/wallet/deduct`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason }),
      });
      return true;
    } catch { return false; }
  },
  async getTransactions(userId: string, limit = 20): Promise<unknown[]> {
    try {
      const res = await request(`${WALLET_URL}/api/wallet/${userId}/transactions?limit=${limit}`);
      return res.transactions ?? [];
    } catch { return []; }
  },
};

export const notificationOperations = {
  async send(params: { userId: string; title: string; message: string; channel?: string }): Promise<boolean> {
    try {
      await request(`${NOTIFICATION_URL}/api/notifications/send`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return true;
    } catch { return false; }
  },
};

export const analyticsOperations = {
  async track(event: string, properties: Record<string, unknown> = {}): Promise<boolean> {
    try {
      await request(`${ANALYTICS_URL}/api/track`, {
        method: 'POST',
        body: JSON.stringify({ event, properties, timestamp: new Date().toISOString() }),
      });
      return true;
    } catch { return false; }
  },
};

export default { auth: authOperations, wallet: walletOperations, notifications: notificationOperations, analytics: analyticsOperations };

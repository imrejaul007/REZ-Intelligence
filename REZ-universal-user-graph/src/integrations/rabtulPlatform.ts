/**
 * RABTUL Platform Integration
 * Connects service to RABTUL infrastructure
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'https://rez-analytics-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Make authenticated internal API request
 */
async function internalRequest<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    throw new Error(`Platform API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ============================================
// AUTH OPERATIONS
// ============================================

interface AuthResponse { success?: boolean; user?: { id: string }; valid?: boolean }

export const authOperations = {
  async verify(token: string): Promise<{ id: string } | null> {
    try {
      const res = await internalRequest<AuthResponse>(`${AUTH_URL}/api/auth/verify`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return res.success ? (res.user || { id: '' }) : null;
    } catch {
      return null;
    }
  },

  async validateInternalToken(): Promise<boolean> {
    try {
      const res = await internalRequest<{ valid?: boolean }>(`${AUTH_URL}/api/auth/internal/validate`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      return res.valid ?? false;
    } catch {
      return false;
    }
  },
};

// ============================================
// WALLET OPERATIONS
// ============================================

interface WalletBalance { balance?: number }
interface WalletAdd { success?: boolean }

export const walletOperations = {
  async getBalance(userId: string): Promise<number> {
    try {
      const res = await internalRequest<WalletBalance>(`${WALLET_URL}/api/wallet/${userId}/balance`);
      return res.balance || 0;
    } catch {
      return 0;
    }
  },

  async addCoins(userId: string, amount: number, reason: string, metadata: Record<string, unknown> = {}): Promise<boolean> {
    try {
      const res = await internalRequest<WalletAdd>(`${WALLET_URL}/api/wallet/add`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason, ...metadata }),
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  },

  async deductCoins(userId: string, amount: number, reason: string): Promise<boolean> {
    try {
      const res = await internalRequest<WalletAdd>(`${WALLET_URL}/api/wallet/deduct`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason }),
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  },
};

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

interface Notification { success?: boolean }

export const notificationOperations = {
  async send(params: { userId: string; type: string; message: string; title?: string; data?: Record<string, unknown> }): Promise<boolean> {
    try {
      const res = await internalRequest<Notification>(`${NOTIFICATION_URL}/api/notifications/send`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  },

  async sendBulk(notifications: Array<{ userId: string; type: string; message: string }>): Promise<{ sent: number }> {
    try {
      const res = await internalRequest<{ sent: number }>(`${NOTIFICATION_URL}/api/notifications/bulk`, {
        method: 'POST',
        body: JSON.stringify({ notifications }),
      });
      return res;
    } catch {
      return { sent: 0 };
    }
  },
};

// ============================================
// ANALYTICS OPERATIONS
// ============================================

interface AnalyticsEvent { success?: boolean }

export const analyticsOperations = {
  async trackEvent(event: string, properties: Record<string, unknown> = {}): Promise<boolean> {
    try {
      const res = await internalRequest<AnalyticsEvent>(`${ANALYTICS_URL}/api/events`, {
        method: 'POST',
        body: JSON.stringify({ event, properties, timestamp: new Date().toISOString() }),
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  },
};

// ============================================
// EVENT BUS OPERATIONS
// ============================================

interface EventPublish { success?: boolean }

export const eventBusOperations = {
  async publish(type: string, category: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await internalRequest<EventPublish>(`${EVENT_BUS_URL}/api/events/publish`, {
        method: 'POST',
        body: JSON.stringify({ type, category, data, timestamp: new Date().toISOString() }),
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  },

  async query(filters: Record<string, unknown>): Promise<{ events: unknown[] }> {
    try {
      const res = await internalRequest<{ events: unknown[] }>(`${EVENT_BUS_URL}/api/events/query`, {
        method: 'POST',
        body: JSON.stringify(filters),
      });
      return res;
    } catch {
      return { events: [] };
    }
  },
};

export default {
  auth: authOperations,
  wallet: walletOperations,
  notification: notificationOperations,
  analytics: analyticsOperations,
  eventBus: eventBusOperations,
};

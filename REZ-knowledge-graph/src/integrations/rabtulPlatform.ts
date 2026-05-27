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

// Response types
interface ApiResponse {
  success?: boolean;
  user?: Record<string, unknown>;
  valid?: boolean;
  data?: unknown;
  balance?: number;
  transactions?: unknown[];
  events?: unknown[];
  [key: string]: unknown;
}

// Wallet types
interface WalletMetadata {
  [key: string]: unknown;
}

// Notification types
interface NotificationParams {
  userId: string;
  channel?: string;
  type?: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface BulkNotification {
  userId: string;
  channel?: string;
  type?: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// Event types
interface EventFilters {
  [key: string]: unknown;
}

/**
 * Make authenticated internal API request
 */
async function internalRequest<T = ApiResponse>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = (options.headers as Record<string, string>) || {};
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...headers,
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

export const authOperations = {
  async verify(token: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await internalRequest<{ success: boolean; user?: unknown }>(`${AUTH_URL}/api/auth/verify`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return res.success ? res.user as Record<string, unknown> : null;
    } catch {
      return null;
    }
  },

  async validateInternalToken(): Promise<boolean> {
    try {
      const res = await internalRequest<{ valid: boolean }>(`${AUTH_URL}/api/auth/internal/validate`, {
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

export const walletOperations = {
  async getBalance(userId: string): Promise<number> {
    try {
      const res = await internalRequest<{ balance: number }>(`${WALLET_URL}/api/wallet/${userId}/balance`);
      return res.balance || 0;
    } catch {
      return 0;
    }
  },

  async addCoins(userId: string, amount: number, reason: string, metadata: WalletMetadata = {}): Promise<boolean> {
    try {
      await internalRequest(`${WALLET_URL}/api/wallet/add`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason, metadata }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async deductCoins(userId: string, amount: number, reason: string, metadata: WalletMetadata = {}): Promise<boolean> {
    try {
      await internalRequest(`${WALLET_URL}/api/wallet/deduct`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason, metadata }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async getTransactions(userId: string, limit = 20): Promise<unknown[]> {
    try {
      const res = await internalRequest<{ transactions: unknown[] }>(`${WALLET_URL}/api/wallet/${userId}/transactions?limit=${limit}`);
      return res.transactions || [];
    } catch {
      return [];
    }
  },
};

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

export const notificationOperations = {
  async send(params: NotificationParams): Promise<boolean> {
    try {
      await internalRequest(`${NOTIFICATION_URL}/api/notifications/send`, {
        method: 'POST',
        body: JSON.stringify({
          userId: params.userId,
          channel: params.channel || 'push',
          type: params.type || 'info',
          title: params.title,
          message: params.message,
          data: params.data,
        }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async sendBulk(notifications: BulkNotification[]): Promise<boolean> {
    try {
      await internalRequest(`${NOTIFICATION_URL}/api/notifications/send/batch`, {
        method: 'POST',
        body: JSON.stringify({ notifications }),
      });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// ANALYTICS OPERATIONS
// ============================================

export const analyticsOperations = {
  async track(event: string, properties: Record<string, unknown> = {}): Promise<boolean> {
    try {
      await internalRequest(`${ANALYTICS_URL}/api/track`, {
        method: 'POST',
        body: JSON.stringify({
          event,
          properties,
          timestamp: new Date().toISOString(),
        }),
      });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// EVENT BUS OPERATIONS
// ============================================

export const eventBusOperations = {
  async publish(type: string, category: string, data: Record<string, unknown>, context: Record<string, unknown> = {}): Promise<boolean> {
    try {
      await internalRequest(`${EVENT_BUS_URL}/api/events`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          category,
          version: '1.0.0',
          source: 'REZ-knowledge-graph',
          data,
          ...context,
          timestamp: new Date().toISOString(),
        }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async queryEvents(filters: EventFilters, limit = 100): Promise<unknown[]> {
    try {
      const res = await internalRequest<{ events: unknown[] }>(`${EVENT_BUS_URL}/api/events/query`, {
        method: 'POST',
        body: JSON.stringify({ filters, limit }),
      });
      return res.events || [];
    } catch {
      return [];
    }
  },
};

// Default export
export default {
  auth: authOperations,
  wallet: walletOperations,
  notifications: notificationOperations,
  analytics: analyticsOperations,
  events: eventBusOperations,
};

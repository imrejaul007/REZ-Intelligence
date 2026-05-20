/**
 * REZ Intelligence - RABTUL Platform Integration
 *
 * Canonical integration module for connecting REZ-Intelligence services
 * to RABTUL platform services (Auth, Payment, Wallet, Notifications, etc.)
 *
 * USAGE:
 * ```typescript
 * import { createRABTULIntegration } from '@rez/rabtul-integration';
 *
 * const rabtul = createRABTULIntegration({
 *   serviceName: 'my-service',
 *   internalToken: process.env.INTERNAL_SERVICE_TOKEN
 * });
 *
 * // Authenticate
 * const user = await rabtul.auth.verify(token);
 *
 * // Send notification
 * await rabtul.notifications.send({ userId, type: 'push', message });
 *
 * // Add coins to wallet
 * await rabtul.wallet.add(userId, 100, 'reward');
 * ```
 */

import axios, { AxiosInstance } from 'axios';

// ============================================================================
// Configuration Types
// ============================================================================

export interface RABTULConfig {
  serviceName: string;
  internalToken?: string;
  authUrl?: string;
  paymentUrl?: string;
  walletUrl?: string;
  notificationUrl?: string;
  orderUrl?: string;
  catalogUrl?: string;
  profileUrl?: string;
  eventBusUrl?: string;
  timeout?: number;
}

export const DEFAULT_CONFIG: Partial<RABTULConfig> = {
  timeout: 10000,
  authUrl: process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com',
  paymentUrl: process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com',
  walletUrl: process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com',
  notificationUrl: process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com',
  orderUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:4006',
  catalogUrl: process.env.CATALOG_SERVICE_URL || 'http://localhost:4007',
  profileUrl: process.env.PROFILE_SERVICE_URL || 'http://localhost:4013',
  eventBusUrl: process.env.EVENT_BUS_URL || 'http://localhost:4025',
  internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
};

// ============================================================================
// API Client Factory
// ============================================================================

function createApiClient(baseURL: string, internalToken?: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: DEFAULT_CONFIG.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': internalToken || DEFAULT_CONFIG.internalToken || '',
      'X-Service-Name': 'rez-intelligence',
    },
  });
}

// ============================================================================
// Auth Service
// ============================================================================

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role?: string;
  name?: string;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  expiresAt?: string;
  user: AuthUser;
}

export const createAuthService = (config: RABTULConfig) => {
  const client = createApiClient(config.authUrl || DEFAULT_CONFIG.authUrl!, config.internalToken);

  return {
    /**
     * Verify JWT token and get user info
     */
    async verify(token: string): Promise<AuthUser | null> {
      try {
        const res = await client.post<{ success: boolean; user?: AuthUser }>('/api/auth/verify', { token });
        return res.data.success ? res.data.user || null : null;
      } catch {
        return null;
      }
    },

    /**
     * Send OTP to phone number
     */
    async sendOTP(phone: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<boolean> {
      try {
        const res = await client.post<{ success: boolean }>('/api/auth/send-otp', { phone, channel });
        return res.data.success ?? false;
      } catch {
        return false;
      }
    },

    /**
     * Verify OTP code
     */
    async verifyOTP(phone: string, otp: string): Promise<AuthSession | null> {
      try {
        const res = await client.post<{ success: boolean; token?: string; user?: AuthUser }>('/api/auth/verify-otp', { phone, otp });
        if (res.data.success && res.data.token) {
          return {
            token: res.data.token,
            user: res.data.user || { id: phone },
          };
        }
        return null;
      } catch {
        return null;
      }
    },

    /**
     * Refresh access token
     */
    async refresh(refreshToken: string): Promise<AuthSession | null> {
      try {
        const res = await client.post<{ success: boolean; token?: string; user?: AuthUser }>('/api/auth/refresh', { refreshToken });
        if (res.data.success && res.data.token) {
          return {
            token: res.data.token,
            refreshToken,
            user: res.data.user || {},
          };
        }
        return null;
      } catch {
        return null;
      }
    },

    /**
     * Logout / invalidate token
     */
    async logout(token: string): Promise<boolean> {
      try {
        await client.post('/api/auth/logout', { token });
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Validate internal service token
     */
    async validateInternalToken(token: string): Promise<boolean> {
      try {
        const res = await client.get<{ valid: boolean }>('/api/auth/internal/validate', {
          headers: { 'X-Internal-Token': token },
        });
        return res.data.valid ?? false;
      } catch {
        return false;
      }
    },
  };
};

// ============================================================================
// Payment Service
// ============================================================================

export interface PaymentRequest {
  userId: string;
  amount: number;
  currency?: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  paymentId: string;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  gatewayUrl?: string;
}

export const createPaymentService = (config: RABTULConfig) => {
  const client = createApiClient(config.paymentUrl || DEFAULT_CONFIG.paymentUrl!, config.internalToken);

  return {
    /**
     * Create a new payment order
     */
    async createOrder(request: PaymentRequest): Promise<PaymentResult | null> {
      try {
        const res = await client.post<{ paymentId: string; status: string }>('/api/payments/create', {
          userId: request.userId,
          amount: request.amount,
          description: request.description,
          metadata: { source: config.serviceName, ...request.metadata },
        });
        return {
          paymentId: res.data.paymentId,
          status: res.data.status as 'pending' | 'completed' | 'failed',
          amount: request.amount,
        };
      } catch {
        return null;
      }
    },

    /**
     * Get payment status
     */
    async getStatus(paymentId: string): Promise<PaymentResult | null> {
      try {
        const res = await client.get<{ paymentId: string; status: string; amount: number }>(`/api/payments/${paymentId}`);
        return {
          paymentId: res.data.paymentId,
          status: res.data.status as 'pending' | 'completed' | 'failed',
          amount: res.data.amount,
        };
      } catch {
        return null;
      }
    },

    /**
     * Refund a payment
     */
    async refund(paymentId: string, amount?: number): Promise<boolean> {
      try {
        await client.post(`/api/payments/${paymentId}/refund`, { amount });
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Verify webhook signature
     */
    async verifyWebhook(payload: string, signature: string): Promise<boolean> {
      try {
        const res = await client.post<{ valid: boolean }>('/api/webhooks/verify', { payload, signature });
        return res.data.valid ?? false;
      } catch {
        return false;
      }
    },
  };
};

// ============================================================================
// Wallet Service
// ============================================================================

export interface WalletBalance {
  userId: string;
  coins: number;
  currency: string;
}

export interface WalletTransaction {
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  timestamp: string;
}

export const createWalletService = (config: RABTULConfig) => {
  const client = createApiClient(config.walletUrl || DEFAULT_CONFIG.walletUrl!, config.internalToken);

  return {
    /**
     * Get user wallet balance
     */
    async getBalance(userId: string): Promise<WalletBalance | null> {
      try {
        const res = await client.get<{ userId: string; balance: number; currency?: string }>(`/api/wallet/${userId}/balance`);
        return {
          userId: res.data.userId,
          coins: res.data.balance || 0,
          currency: res.data.currency || 'REZ',
        };
      } catch {
        return null;
      }
    },

    /**
     * Add coins to user wallet
     */
    async addCoins(userId: string, amount: number, reason: string, metadata?: Record<string, string>): Promise<boolean> {
      try {
        await client.post('/api/wallet/add', {
          userId,
          amount,
          reason,
          source: config.serviceName,
          metadata,
        });
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Deduct coins from user wallet
     */
    async deductCoins(userId: string, amount: number, reason: string, metadata?: Record<string, string>): Promise<boolean> {
      try {
        await client.post('/api/wallet/deduct', {
          userId,
          amount,
          reason,
          source: config.serviceName,
          metadata,
        });
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Get transaction history
     */
    async getTransactions(userId: string, limit = 20): Promise<WalletTransaction[]> {
      try {
        const res = await client.get<{ transactions: WalletTransaction[] }>(`/api/wallet/${userId}/transactions?limit=${limit}`);
        return res.data.transactions || [];
      } catch {
        return [];
      }
    },
  };
};

// ============================================================================
// Notification Service
// ============================================================================

export interface NotificationRequest {
  userId?: string;
  phone?: string;
  email?: string;
  channel: 'push' | 'email' | 'sms' | 'whatsapp';
  type: string;
  title?: string;
  message: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  notificationId: string;
  status: string;
}

export const createNotificationService = (config: RABTULConfig) => {
  const client = createApiClient(config.notificationUrl || DEFAULT_CONFIG.notificationUrl!, config.internalToken);

  return {
    /**
     * Send a notification
     */
    async send(request: NotificationRequest): Promise<NotificationResult | null> {
      try {
        const res = await client.post<{ notificationId: string; status: string }>('/api/notifications/send', {
          ...request,
          source: config.serviceName,
        });
        return {
          notificationId: res.data.notificationId,
          status: res.data.status,
        };
      } catch {
        return null;
      }
    },

    /**
     * Send bulk notifications
     */
    async sendBulk(requests: NotificationRequest[]): Promise<{ sent: number; failed: number }> {
      try {
        const res = await client.post<{ sent: number; failed: number }>('/api/notifications/send/batch', {
          notifications: requests.map((r) => ({ ...r, source: config.serviceName })),
        });
        return { sent: res.data.sent || 0, failed: res.data.failed || 0 };
      } catch {
        return { sent: 0, failed: requests.length };
      }
    },

    /**
     * Get notification history
     */
    async getHistory(userId: string, limit = 50): Promise<unknown[]> {
      try {
        const res = await client.get<{ notifications: unknown[] }>(`/api/notifications/${userId}/history?limit=${limit}`);
        return res.data.notifications || [];
      } catch {
        return [];
      }
    },
  };
};

// ============================================================================
// Order Service
// ============================================================================

export interface OrderRequest {
  userId: string;
  items: { productId: string; quantity: number; price: number }[];
  totalAmount: number;
  paymentMethod: string;
  metadata?: Record<string, string>;
}

export interface OrderResult {
  orderId: string;
  status: string;
  totalAmount: number;
}

export const createOrderService = (config: RABTULConfig) => {
  const client = createApiClient(config.orderUrl || DEFAULT_CONFIG.orderUrl!, config.internalToken);

  return {
    /**
     * Create a new order
     */
    async create(request: OrderRequest): Promise<OrderResult | null> {
      try {
        const res = await client.post<{ orderId: string; status: string; totalAmount: number }>('/api/orders/create', {
          ...request,
          source: config.serviceName,
        });
        return {
          orderId: res.data.orderId,
          status: res.data.status,
          totalAmount: res.data.totalAmount,
        };
      } catch {
        return null;
      }
    },

    /**
     * Get order status
     */
    async getStatus(orderId: string): Promise<OrderResult | null> {
      try {
        const res = await client.get<{ orderId: string; status: string; totalAmount: number }>(`/api/orders/${orderId}/status`);
        return {
          orderId: res.data.orderId,
          status: res.data.status,
          totalAmount: res.data.totalAmount,
        };
      } catch {
        return null;
      }
    },

    /**
     * Update order status
     */
    async updateStatus(orderId: string, status: string): Promise<boolean> {
      try {
        await client.patch(`/api/orders/${orderId}/status`, { status });
        return true;
      } catch {
        return false;
      }
    },
  };
};

// ============================================================================
// Profile Service
// ============================================================================

export interface UserProfile {
  userId: string;
  email?: string;
  phone?: string;
  name?: string;
  avatar?: string;
  preferences?: Record<string, unknown>;
}

export const createProfileService = (config: RABTULConfig) => {
  const client = createApiClient(config.profileUrl || DEFAULT_CONFIG.profileUrl!, config.internalToken);

  return {
    /**
     * Get user profile
     */
    async get(userId: string): Promise<UserProfile | null> {
      try {
        const res = await client.get<UserProfile>(`/api/profiles/user/${userId}`);
        return res.data;
      } catch {
        return null;
      }
    },

    /**
     * Update user profile
     */
    async update(userId: string, data: Partial<UserProfile>): Promise<boolean> {
      try {
        await client.patch(`/api/profiles/user/${userId}`, data);
        return true;
      } catch {
        return false;
      }
    },
  };
};

// ============================================================================
// Event Bus Service
// ============================================================================

export interface REZEvent {
  type: string;
  category: string;
  version?: string;
  source?: string;
  userId?: string;
  merchantId?: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export const createEventBusService = (config: RABTULConfig) => {
  const client = createApiClient(config.eventBusUrl || DEFAULT_CONFIG.eventBusUrl!, config.internalToken);

  return {
    /**
     * Publish an event
     */
    async publish(event: REZEvent): Promise<string | null> {
      try {
        const res = await client.post<{ eventId: string }>('/api/events', {
          ...event,
          source: event.source || config.serviceName,
          version: event.version || '1.0.0',
          timestamp: event.timestamp || new Date().toISOString(),
        });
        return res.data.eventId;
      } catch {
        return null;
      }
    },

    /**
     * Publish commerce event
     */
    async publishCommerce(type: string, data: Record<string, unknown>, context?: { userId?: string; merchantId?: string }): Promise<string | null> {
      return this.publish({
        type: `commerce.${type}`,
        category: 'commerce',
        source: config.serviceName,
        data,
        ...context,
      });
    },

    /**
     * Publish intelligence event
     */
    async publishIntelligence(type: string, data: Record<string, unknown>, context?: { userId?: string }): Promise<string | null> {
      return this.publish({
        type: `intelligence.${type}`,
        category: 'intelligence',
        source: config.serviceName,
        data,
        ...context,
      });
    },

    /**
     * Query events
     */
    async query(filters: Record<string, unknown>, limit = 100): Promise<REZEvent[]> {
      try {
        const res = await client.post<{ events: REZEvent[] }>('/api/events/query', { filters, limit });
        return res.data.events || [];
      } catch {
        return [];
      }
    },
  };
};

// ============================================================================
// Main Integration Factory
// ============================================================================

export interface RABTULIntegration {
  auth: ReturnType<typeof createAuthService>;
  payment: ReturnType<typeof createPaymentService>;
  wallet: ReturnType<typeof createWalletService>;
  notifications: ReturnType<typeof createNotificationService>;
  order: ReturnType<typeof createOrderService>;
  profile: ReturnType<typeof createProfileService>;
  events: ReturnType<typeof createEventBusService>;
  config: RABTULConfig;
}

/**
 * Create a fully configured RABTUL integration
 */
export function createRABTULIntegration(config: RABTULConfig): RABTULIntegration {
  return {
    auth: createAuthService(config),
    payment: createPaymentService(config),
    wallet: createWalletService(config),
    notifications: createNotificationService(config),
    order: createOrderService(config),
    profile: createProfileService(config),
    events: createEventBusService(config),
    config,
  };
}

/**
 * Default integration instance
 */
export function getDefaultIntegration(serviceName: string): RABTULIntegration {
  return createRABTULIntegration({
    serviceName,
    internalToken: process.env.INTERNAL_SERVICE_TOKEN,
  });
}

// ============================================================================
// Express Middleware Helpers
// ============================================================================

export interface AuthenticatedRequest {
  user?: AuthUser;
  token?: string;
}

/**
 * Create authentication middleware for Express
 */
export function createAuthMiddleware(rabtul: RABTULIntegration) {
  return async (req: Record<string, unknown>, res: Record<string, unknown>, next: () => void) => {
    const authHeader = req.headers?.['authorization'] as string;

    if (!authHeader?.startsWith('Bearer ')) {
      (res as Record<string, unknown>).status = 401;
      (res as Record<string, unknown>).json = { error: 'Missing or invalid authorization header' };
      return;
    }

    const token = authHeader.slice(7);
    const user = await rabtul.auth.verify(token);

    if (!user) {
      (res as Record<string, unknown>).status = 401;
      (res as Record<string, unknown>).json = { error: 'Invalid or expired token' };
      return;
    }

    (req as AuthenticatedRequest).user = user;
    (req as AuthenticatedRequest).token = token;
    next();
  };
}

/**
 * Create internal token validation middleware
 */
export function createInternalAuthMiddleware(rabtul: RABTULIntegration) {
  return (req: Record<string, unknown>, res: Record<string, unknown>, next: () => void) => {
    const internalToken = req.headers?.['x-internal-token'] as string;

    if (!internalToken || internalToken !== rabtul.config.internalToken) {
      (res as Record<string, unknown>).status = 401;
      (res as Record<string, unknown>).json = { error: 'Invalid internal token' };
      return;
    }

    next();
  };
}

// ============================================================================
// Exports
// ============================================================================

export default createRABTULIntegration;

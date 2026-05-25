/**
 * Shared RABTUL Integration Package
 *
 * Common RABTUL integration for all REZ-Intelligence services:
 * - Auth: Token verification, OTP
 * - Wallet: Balance, coins add/deduct
 * - Payment: Create/verify payments
 * - Notifications: Push, SMS, Email, WhatsApp
 * - Event Bus: Publish events
 */

import axios, { AxiosInstance } from 'axios';

// Configuration
export const RABTUL_CONFIG = {
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com',
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com',
  WALLET_SERVICE_URL: process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com',
  EVENT_BUS_URL: process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com',
  INTERNAL_TOKEN: process.env.INTERNAL_SERVICE_TOKEN || '',
};

// Create axios instance with defaults
const createAxiosInstance = (baseURL: string): AxiosInstance => {
  return axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN,
    },
  });
};

// ============================================
// AUTH INTEGRATION
// ============================================

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  role?: string;
  name?: string;
}

export interface AuthResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

export const auth = {
  /**
   * Verify user token via RABTUL Auth Service
   */
  async verifyToken(token: string): Promise<AuthResult> {
    try {
      const response = await axios.get(`${RABTUL_CONFIG.AUTH_SERVICE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN,
        },
      });

      if (response.data.success && response.data.user) {
        return {
          valid: true,
          user: response.data.user,
        };
      }
      return { valid: false, error: 'Invalid token' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },

  /**
   * Send OTP to phone
   */
  async sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.AUTH_SERVICE_URL}/api/auth/send-otp`,
        { phone },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return { success: response.data.success ?? true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Verify OTP
   */
  async verifyOTP(phone: string, otp: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.AUTH_SERVICE_URL}/api/auth/verify-otp`,
        { phone, otp },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data.success) {
        return { success: true, token: response.data.token };
      }
      return { success: false, error: 'Invalid OTP' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Register new user
   */
  async register(data: { phone?: string; email?: string; name?: string; password?: string }): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.AUTH_SERVICE_URL}/api/auth/register`,
        data,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data.success) {
        return { success: true, userId: response.data.userId };
      }
      return { success: false, error: response.data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate service token for internal use
   */
  async generateServiceToken(serviceId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.AUTH_SERVICE_URL}/api/auth/service-token`,
        { serviceId },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      if (response.data.token) {
        return { success: true, token: response.data.token };
      }
      return { success: false, error: 'No token returned' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================
// WALLET INTEGRATION
// ============================================

export interface WalletBalance {
  balance: number;
  coins: number;
  currency?: string;
}

export const wallet = {
  /**
   * Get user wallet balance
   */
  async getBalance(userId: string): Promise<WalletBalance | null> {
    try {
      const response = await axios.get(`${RABTUL_CONFIG.WALLET_SERVICE_URL}/api/wallet/${userId}/balance`, {
        headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN },
      });
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Add coins to user wallet
   */
  async addCoins(userId: string, amount: number, reason: string, metadata?: Record<string, string>): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.WALLET_SERVICE_URL}/api/wallet/add`,
        { userId, amount, reason, metadata },
        { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, transactionId: response.data.transactionId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Deduct coins from user wallet
   */
  async deductCoins(userId: string, amount: number, reason: string, metadata?: Record<string, string>): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.WALLET_SERVICE_URL}/api/wallet/deduct`,
        { userId, amount, reason, metadata },
        { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, transactionId: response.data.transactionId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Transfer coins between users
   */
  async transferCoins(fromUserId: string, toUserId: string, amount: number, reason: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.WALLET_SERVICE_URL}/api/wallet/transfer`,
        { fromUserId, toUserId, amount, reason },
        { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, transactionId: response.data.transactionId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get transaction history
   */
  async getTransactions(userId: string, limit = 20): Promise<{ transactions: unknown[]; error?: string }> {
    try {
      const response = await axios.get(`${RABTUL_CONFIG.WALLET_SERVICE_URL}/api/wallet/${userId}/transactions`, {
        headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN },
        params: { limit },
      });
      return { transactions: response.data.transactions || [] };
    } catch (error) {
      return { transactions: [], error: error.message };
    }
  },
};

// ============================================
// PAYMENT INTEGRATION
// ============================================

export interface PaymentResult {
  paymentId?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}

export const payment = {
  /**
   * Create payment order
   */
  async createPayment(params: {
    userId: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.PAYMENT_SERVICE_URL}/api/payments/create`,
        {
          userId: params.userId,
          amount: params.amount,
          currency: params.currency || 'INR',
          description: params.description,
          metadata: params.metadata,
        },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { paymentId: response.data.paymentId, status: 'pending' };
    } catch (error) {
      return { error: error.message };
    }
  },

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId: string): Promise<PaymentResult> {
    try {
      const response = await axios.get(`${RABTUL_CONFIG.PAYMENT_SERVICE_URL}/api/payments/${paymentId}`, {
        headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN },
      });
      return { status: response.data.status };
    } catch (error) {
      return { error: error.message };
    }
  },

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string, amount?: number): Promise<PaymentResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.PAYMENT_SERVICE_URL}/api/payments/${paymentId}/refund`,
        { amount },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { status: 'completed', paymentId: response.data.refundId };
    } catch (error) {
      return { error: error.message };
    }
  },
};

// ============================================
// NOTIFICATION INTEGRATION
// ============================================

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

export const notifications = {
  /**
   * Send push notification
   */
  async sendPush(params: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<NotificationResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.NOTIFICATION_SERVICE_URL}/api/notifications/push`,
        { ...params, type: 'push' },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, notificationId: response.data.notificationId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Send SMS
   */
  async sendSMS(params: {
    phone: string;
    message: string;
  }): Promise<NotificationResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.NOTIFICATION_SERVICE_URL}/api/notifications/sms`,
        { ...params, type: 'sms' },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, notificationId: response.data.notificationId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Send Email
   */
  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<NotificationResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.NOTIFICATION_SERVICE_URL}/api/notifications/email`,
        { ...params, type: 'email' },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, notificationId: response.data.notificationId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(params: {
    phone: string;
    message: string;
    template?: string;
  }): Promise<NotificationResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.NOTIFICATION_SERVICE_URL}/api/notifications/whatsapp`,
        { ...params, type: 'whatsapp' },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, notificationId: response.data.notificationId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Send multi-channel notification
   */
  async sendMultiChannel(params: {
    userId: string;
    channels: ('push' | 'sms' | 'email' | 'whatsapp')[];
    title?: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<NotificationResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.NOTIFICATION_SERVICE_URL}/api/notifications/send`,
        params,
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, notificationId: response.data.notificationId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================
// EVENT BUS INTEGRATION
// ============================================

export interface EventResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

export interface IntelligenceEvent {
  type: string;
  source: string;
  data: Record<string, unknown>;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
}

export const eventBus = {
  /**
   * Publish intelligence event
   */
  async publish(event: IntelligenceEvent): Promise<EventResult> {
    try {
      const response = await axios.post(
        `${RABTUL_CONFIG.EVENT_BUS_URL}/api/events/publish`,
        {
          ...event,
          timestamp: event.timestamp || new Date().toISOString(),
          source: event.source || 'rez-intelligence',
        },
        { headers: { 'X-Internal-Token': RABTUL_CONFIG.INTERNAL_TOKEN } }
      );
      return { success: true, eventId: response.data.eventId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Publish intent signal
   */
  async publishIntent(userId: string, intent: string, confidence: number, context: Record<string, unknown>): Promise<EventResult> {
    return this.publish({
      type: 'intelligence.intent',
      data: { userId, intent, confidence, context },
    });
  },

  /**
   * Publish churn prediction
   */
  async publishChurnPrediction(userId: string, probability: number, factors: string[]): Promise<EventResult> {
    return this.publish({
      type: 'intelligence.churn',
      data: { userId, probability, factors },
    });
  },

  /**
   * Publish LTV update
   */
  async publishLTVUpdate(userId: string, ltv: number, tier: string): Promise<EventResult> {
    return this.publish({
      type: 'intelligence.ltv',
      data: { userId, ltv, tier },
    });
  },

  /**
   * Publish recommendation event
   */
  async publishRecommendation(userId: string, type: string, items: string[]): Promise<EventResult> {
    return this.publish({
      type: 'commerce.recommendation',
      data: { userId, type, items },
    });
  },

  /**
   * Publish signal event
   */
  async publishSignal(signalType: string, entityType: string, entityId: string, data: Record<string, unknown>): Promise<EventResult> {
    return this.publish({
      type: `signal.${signalType}`,
      data: { entityType, entityId, ...data },
    });
  },

  /**
   * Publish support ticket
   */
  async publishSupportTicket(ticketId: string, userId: string, category: string, priority: string): Promise<EventResult> {
    return this.publish({
      type: 'support.ticket',
      data: { ticketId, userId, category, priority },
    });
  },

  /**
   * Publish customer 360 update
   */
  async publishCustomer360(userId: string, profile: Record<string, unknown>): Promise<EventResult> {
    return this.publish({
      type: 'customer.360',
      data: { userId, profile },
    });
  },
};

// ============================================
// DEFAULT EXPORT
// ============================================

export const rezIntelligence = {
  auth,
  wallet,
  payment,
  notifications,
  eventBus,
  config: RABTUL_CONFIG,
};

export default rezIntelligence;

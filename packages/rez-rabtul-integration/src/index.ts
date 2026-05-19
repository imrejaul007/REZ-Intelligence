/**
 * REZ-Intelligence RABTUL Integration
 *
 * Shared integration module for connecting to RABTUL platform services.
 * All REZ-Intelligence services should use this module for:
 * - Authentication (rez-auth-service)
 * - Payments (rez-payment-service)
 * - Wallet (rez-wallet-service)
 * - Notifications (rez-notifications-service)
 */

export const RABTUL_ENDPOINTS = {
  // Core RABTUL Services (as defined in RABTUL-Technologies/RAP.md)
  auth: process.env.RABTUL_AUTH_URL || process.env.AUTH_SERVICE_URL || 'http://localhost:4002',
  payment: process.env.RABTUL_PAYMENT_URL || process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001',
  wallet: process.env.RABTUL_WALLET_URL || process.env.WALLET_SERVICE_URL || 'http://localhost:4004',
  notifications: process.env.RABTUL_NOTIFICATIONS_URL || process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011',
  order: process.env.RABTUL_ORDER_URL || process.env.ORDER_SERVICE_URL || 'http://localhost:4006',
  catalog: process.env.RABTUL_CATALOG_URL || process.env.CATALOG_SERVICE_URL || 'http://localhost:4007',
  profile: process.env.RABTUL_PROFILE_URL || process.env.PROFILE_SERVICE_URL || 'http://localhost:4013',
} as const;

export const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Headers for service-to-service communication
 */
export function getServiceHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Token': INTERNAL_TOKEN,
  };
}

/**
 * Base fetch wrapper for RABTUL services
 */
export async function rabtulFetch<T = unknown>(
  service: keyof typeof RABTUL_ENDPOINTS,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${RABTUL_ENDPOINTS[service]}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getServiceHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`RABTUL ${service} error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================
// Auth Service Integration
// ============================================

export interface AuthVerifyResponse {
  valid: boolean;
  userId?: string;
  sessionId?: string;
  channel?: string;
  email?: string;
  phone?: string;
}

export const authService = {
  /**
   * Verify a JWT token via RABTUL Auth Service
   */
  async verify(token: string): Promise<AuthVerifyResponse> {
    try {
      return await rabtulFetch<AuthVerifyResponse>('auth', '/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('[RABTUL Auth] Verification failed:', error);
      return { valid: false };
    }
  },

  /**
   * Generate a service-to-service token
   */
  async generateServiceToken(serviceId: string, serviceSecret: string): Promise<string> {
    const response = await rabtulFetch<{ token: string }>('auth', '/api/auth/service-token', {
      method: 'POST',
      body: JSON.stringify({ serviceId, serviceSecret }),
    });
    return response.token;
  },

  /**
   * Send OTP for authentication
   */
  async sendOTP(phone: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<{ success: boolean }> {
    return rabtulFetch('auth', '/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone, channel }),
    });
  },

  /**
   * Verify OTP
   */
  async verifyOTP(phone: string, otp: string): Promise<{ success: boolean; token?: string }> {
    return rabtulFetch('auth', '/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  },
};

// ============================================
// Payment Service Integration
// ============================================

export interface PaymentRequest {
  orderId: string;
  amount: number;
  paymentMethod: 'upi' | 'card' | 'wallet' | 'netbanking' | 'cod';
  purpose?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  gatewayUrl?: string;
}

export const paymentService = {
  /**
   * Initiate a payment
   */
  async initiate(request: PaymentRequest): Promise<PaymentResponse> {
    return rabtulFetch('payment', '/api/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get payment status
   */
  async getStatus(paymentId: string): Promise<PaymentResponse> {
    return rabtulFetch('payment', `/api/payments/${paymentId}/status`);
  },

  /**
   * Refund a payment
   */
  async refund(paymentId: string, amount?: number): Promise<{ success: boolean }> {
    return rabtulFetch('payment', `/api/payments/${paymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  /**
   * Verify webhook signature
   */
  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    const response = await rabtulFetch<{ valid: boolean }>('payment', '/api/webhooks/verify', {
      method: 'POST',
      body: JSON.stringify({ payload, signature }),
    });
    return response.valid;
  },
};

// ============================================
// Wallet Service Integration
// ============================================

export interface CoinRequest {
  userId: string;
  amount: number;
  reason: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export const walletService = {
  /**
   * Add coins to user wallet
   */
  async addCoins(request: CoinRequest): Promise<{ success: boolean; balance: number }> {
    return rabtulFetch('wallet', '/api/wallet/coins/add', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Deduct coins from user wallet
   */
  async deductCoins(request: CoinRequest): Promise<{ success: boolean; balance: number }> {
    return rabtulFetch('wallet', '/api/wallet/coins/deduct', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get user wallet balance
   */
  async getBalance(userId: string): Promise<{ balance: number; lifetimeEarnings: number }> {
    return rabtulFetch('wallet', `/api/wallet/${userId}/balance`);
  },

  /**
   * Get transaction history
   */
  async getTransactions(userId: string, limit = 50): Promise<{ transactions: unknown[] }> {
    return rabtulFetch('wallet', `/api/wallet/${userId}/transactions?limit=${limit}`);
  },
};

// ============================================
// Notification Service Integration
// ============================================

export interface NotificationRequest {
  userId?: string;
  phone?: string;
  email?: string;
  channel: 'push' | 'sms' | 'email' | 'whatsapp';
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export const notificationService = {
  /**
   * Send a notification
   */
  async send(request: NotificationRequest): Promise<{ success: boolean; notificationId: string }> {
    return rabtulFetch('notifications', '/api/notifications/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Send batch notifications
   */
  async sendBatch(requests: NotificationRequest[]): Promise<{ success: boolean; sent: number }> {
    return rabtulFetch('notifications', '/api/notifications/send/batch', {
      method: 'POST',
      body: JSON.stringify({ notifications: requests }),
    });
  },

  /**
   * Get notification history
   */
  async getHistory(userId: string, limit = 50): Promise<{ notifications: unknown[] }> {
    return rabtulFetch('notifications', `/api/notifications/${userId}/history?limit=${limit}`);
  },
};

// ============================================
// Order Service Integration
// ============================================

export interface OrderRequest {
  userId: string;
  merchantId: string;
  items: { productId: string; quantity: number; price: number }[];
  totalAmount: number;
  paymentMethod: string;
  metadata?: Record<string, unknown>;
}

export const orderService = {
  /**
   * Create a new order
   */
  async create(request: OrderRequest): Promise<{ orderId: string; status: string }> {
    return rabtulFetch('order', '/api/orders/create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get order status
   */
  async getStatus(orderId: string): Promise<{ orderId: string; status: string }> {
    return rabtulFetch('order', `/api/orders/${orderId}/status`);
  },

  /**
   * Update order status
   */
  async updateStatus(orderId: string, status: string): Promise<{ success: boolean }> {
    return rabtulFetch('order', `/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// ============================================
// Catalog Service Integration
// ============================================

export const catalogService = {
  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<unknown> {
    return rabtulFetch('catalog', `/api/products/${productId}`);
  },

  /**
   * Search products
   */
  async searchProducts(query: string, limit = 20): Promise<{ products: unknown[] }> {
    return rabtulFetch('catalog', `/api/products/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  /**
   * Get merchant products
   */
  async getMerchantProducts(merchantId: string): Promise<{ products: unknown[] }> {
    return rabtulFetch('catalog', `/api/merchants/${merchantId}/products`);
  },
};

// ============================================
// Profile Service Integration
// ============================================

export const profileService = {
  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<unknown> {
    return rabtulFetch('profile', `/api/profiles/user/${userId}`);
  },

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, data: Record<string, unknown>): Promise<{ success: boolean }> {
    return rabtulFetch('profile', `/api/profiles/user/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get merchant profile
   */
  async getMerchantProfile(merchantId: string): Promise<unknown> {
    return rabtulFetch('profile', `/api/profiles/merchant/${merchantId}`);
  },
};

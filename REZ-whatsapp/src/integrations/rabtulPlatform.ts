/**
 * RABTUL Platform Integration
 * Fixed: Added axios with timeouts, proper error handling, and typed responses
 */

import axios, { AxiosError } from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

const REQUEST_TIMEOUT_MS = 5000; // 5 second timeout

// Typed response wrapper
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Axios request wrapper with timeout and proper error handling
 */
async function request<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    timeout?: number;
  } = {}
): Promise<ServiceResponse<T>> {
  const timeout = options.timeout || REQUEST_TIMEOUT_MS;

  try {
    const response = await axios.post<T>(url, options.body, {
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
      validateStatus: (status) => status < 500, // Don't throw for 4xx errors
    });

    // Check for API-level errors
    if (response.status >= 400) {
      const errorData = response.data as Record<string, unknown> | null;
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: `Request failed with status ${response.status}`,
          details: errorData || response.statusText,
        },
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (err) {
    const error = err as AxiosError;

    // Timeout error
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: `Request to ${url} timed out after ${timeout}ms`,
        },
      };
    }

    // Connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: `Cannot connect to ${url}`,
        },
      };
    }

    // Other axios errors
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data as Record<string, unknown> | null;
      return {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: `Server error: ${error.response.status}`,
          details: errorData,
        },
      };
    }

    // Network/request error
    return {
      success: false,
      error: {
        code: 'REQUEST_FAILED',
        message: error.message || 'Request failed',
      },
    };
  }
}

export interface AuthVerifyResponse {
  valid: boolean;
  userId?: string;
  expiresAt?: string;
}

export interface WalletAddCoinsResponse {
  transactionId: string;
  newBalance: number;
}

export interface WalletBalanceResponse {
  balance: number;
  coins: number;
}

export interface NotificationSendResponse {
  notificationId: string;
  channel: string;
}

export interface AnalyticsTrackResponse {
  eventId: string;
  processed: boolean;
}

export interface EventPublishResponse {
  eventId: string;
  published: boolean;
}

export const auth = {
  verify: async (token: string): Promise<ServiceResponse<AuthVerifyResponse>> => {
    return request<AuthVerifyResponse>(`${AUTH_URL}/api/auth/verify`, {
      method: 'POST',
      body: { token },
    });
  },
};

export const wallet = {
  addCoins: async (
    userId: string,
    amount: number,
    reason: string
  ): Promise<ServiceResponse<WalletAddCoinsResponse>> => {
    return request<WalletAddCoinsResponse>(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: { userId, amount, reason },
    });
  },
  getBalance: async (
    userId: string
  ): Promise<ServiceResponse<WalletBalanceResponse>> => {
    return request<WalletBalanceResponse>(
      `${WALLET_URL}/api/wallet/balance/${userId}`
    );
  },
};

export const notifications = {
  send: async (params: {
    userId: string;
    title: string;
    message: string;
  }): Promise<ServiceResponse<NotificationSendResponse>> => {
    return request<NotificationSendResponse>(
      `${NOTIFICATION_URL}/api/notifications/send`,
      {
        method: 'POST',
        body: params,
      }
    );
  },
};

export const analytics = {
  track: async (
    event: string,
    properties: Record<string, unknown> = {}
  ): Promise<ServiceResponse<AnalyticsTrackResponse>> => {
    return request<AnalyticsTrackResponse>(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: { event, properties },
    });
  },
};

export const events = {
  publish: async (
    type: string,
    category: string,
    data: unknown
  ): Promise<ServiceResponse<EventPublishResponse>> => {
    return request<EventPublishResponse>(`${EVENT_BUS_URL}/api/events`, {
      method: 'POST',
      body: { type, category, data, source: 'REZ-whatsapp' },
    });
  },
};

export default { auth, wallet, notifications, analytics, events };

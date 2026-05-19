/**
 * REZ Care Service - Integration Helpers
 *
 * Helper functions for connecting to other services.
 * These provide consistent error handling and retries.
 */

import axios, { AxiosError } from 'axios';
import { logger } from './logger';

// Default timeout for service calls
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

// Error types
export class ServiceError extends Error {
  constructor(
    message: string,
    public serviceName: string,
    public statusCode?: number,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  serviceName: string,
  operation: string
): Promise<T> {
  let lastError: Error | undefined;
  let delay = RETRY_CONFIG.retryDelay;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const axiosError = error as AxiosError;

      // Check if retryable
      if (axiosError.response) {
        const status = axiosError.response.status;
        // Don't retry client errors (4xx except 429)
        if (status >= 400 && status < 500 && status !== 429) {
          throw new ServiceError(
            `${operation} failed: ${status} ${axiosError.response.statusText}`,
            serviceName,
            status,
            false
          );
        }
      }

      if (attempt < RETRY_CONFIG.maxRetries) {
        logger.warn(`Retrying ${serviceName}.${operation}`, {
          attempt,
          maxRetries: RETRY_CONFIG.maxRetries,
          delay,
          error: lastError.message,
        });
        await sleep(delay);
        delay *= RETRY_CONFIG.backoffMultiplier;
      }
    }
  }

  throw new ServiceError(
    `${operation} failed after ${RETRY_CONFIG.maxRetries} retries: ${lastError?.message}`,
    serviceName,
    undefined,
    false
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Auth Service Integration
export async function getCustomerIdentity(phone: string, authUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${authUrl}/api/auth/lookup`,
      { phone },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'auth', 'getCustomerIdentity');
}

// Payment Service Integration
export async function getPaymentHistory(customerId: string, paymentUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.get(
      `${paymentUrl}/api/payments/customer/${customerId}`,
      {
        headers: {
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'payment', 'getPaymentHistory');
}

export async function retryPayment(orderId: string, customerId: string, paymentUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${paymentUrl}/api/payments/retry`,
      { orderId, customerId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'payment', 'retryPayment');
}

// Wallet Service Integration
export async function getWalletBalance(customerId: string, walletUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${walletUrl}/api/wallet/balance`,
      { customerId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'wallet', 'getWalletBalance');
}

export async function creditWallet(
  customerId: string,
  amount: number,
  reason: string,
  walletUrl: string,
  token: string
) {
  return withRetry(async () => {
    const response = await axios.post(
      `${walletUrl}/api/wallet/credit`,
      {
        userId: customerId,
        amount,
        reason,
        type: 'credit',
        metadata: {
          source: 'REZ Care',
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'wallet', 'creditWallet');
}

export async function retryCashback(customerId: string, transactionId: string | undefined, walletUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${walletUrl}/api/wallet/retry-cashback`,
      { customerId, transactionId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'wallet', 'retryCashback');
}

export async function syncWallet(customerId: string, walletUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${walletUrl}/api/wallet/sync`,
      { customerId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: 15000, // Longer timeout for sync operations
      }
    );
    return response.data;
  }, 'wallet', 'syncWallet');
}

// Order Service Integration
export async function getCustomerOrders(customerId: string, orderUrl: string, token: string, limit = 20) {
  return withRetry(async () => {
    const response = await axios.get(
      `${orderUrl}/api/orders/customer/${customerId}`,
      {
        params: { limit },
        headers: {
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'order', 'getCustomerOrders');
}

export async function getOrderMetrics(customerId: string, orderUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${orderUrl}/api/orders/customer-metrics`,
      { customerId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'order', 'getOrderMetrics');
}

// Booking Service Integration
export async function getActiveBookings(customerId: string, bookingUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.get(
      `${bookingUrl}/api/bookings/active/${customerId}`,
      {
        headers: {
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'booking', 'getActiveBookings');
}

// Gamification/Karma Service Integration
export async function getKarmaProfile(customerId: string, gamificationUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${gamificationUrl}/api/karma/profile`,
      { customerId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'gamification', 'getKarmaProfile');
}

// Profile Service Integration
export async function getCustomerProfile(customerId: string, profileUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${profileUrl}/api/profile/lookup`,
      { customerId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'profile', 'getCustomerProfile');
}

// Support Dashboard Integration
export async function createSupportTicket(
  ticket: {
    customerId: string;
    subject: string;
    description: string;
    priority: string;
    tags?: string[];
  },
  supportUrl: string,
  token: string
) {
  return withRetry(async () => {
    const response = await axios.post(
      `${supportUrl}/api/tickets`,
      {
        ...ticket,
        sourceService: 'REZ Care',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'support', 'createSupportTicket');
}

export async function getTicketMetrics(start: Date, end: Date, supportUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${supportUrl}/api/metrics/summary`,
      { start, end },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'support', 'getTicketMetrics');
}

// Notifications Service Integration
export async function sendNotification(
  notification: {
    userId: string;
    type: string;
    channel: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  },
  notificationsUrl: string,
  token: string
) {
  return withRetry(async () => {
    const response = await axios.post(
      `${notificationsUrl}/api/notifications/send`,
      notification,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'notifications', 'sendNotification');
}

// Predictive Engine Integration
export async function getRiskScores(customerId: string, predictiveUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.post(
      `${predictiveUrl}/api/predict/risk`,
      { customerId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'predictive', 'getRiskScores');
}

// Merchant Service Integration
export async function getMerchantContext(merchantId: string, merchantUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.get(
      `${merchantUrl}/api/merchants/${merchantId}/context`,
      {
        headers: {
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'merchant', 'getMerchantContext');
}

export async function getMerchantHealth(merchantId: string, merchantUrl: string, token: string) {
  return withRetry(async () => {
    const response = await axios.get(
      `${merchantUrl}/api/merchants/${merchantId}/health`,
      {
        headers: {
          'X-Internal-Token': token,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );
    return response.data;
  }, 'merchant', 'getMerchantHealth');
}

// Health check for a service
export async function checkServiceHealth(url: string): Promise<boolean> {
  try {
    const response = await axios.get(`${url}/health`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

// Get all service health statuses
export async function getAllServiceHealth(
  services: { name: string; url: string }[]
): Promise<{ name: string; url: string; healthy: boolean }[]> {
  const results = await Promise.all(
    services.map(async (service) => ({
      name: service.name,
      url: service.url,
      healthy: await checkServiceHealth(service.url),
    }))
  );
  return results;
}

/**
 * Service Connectors Index
 *
 * Exports all service connectors for the ReZ Orchestrator.
 * Each connector provides typed methods to interact with backend services.
 *
 * Usage:
 * ```typescript
 * import { PaymentConnector, WalletConnector, OrderConnector } from '@rez/service-connectors';
 *
 * const payment = new PaymentConnector({ baseUrl: 'http://localhost:4001' });
 * const result = await payment.initiate({ orderId: '...', amount: 100, paymentMethod: 'upi' });
 * ```
 */

// Connectors
import { PaymentConnector, getPaymentConnector } from './connectors/payment';
import { WalletConnector, getWalletConnector } from './connectors/wallet';
import { OrderConnector, getOrderConnector } from './connectors/order';
import { BookingConnector, getBookingConnector } from './connectors/booking';
import { NotificationConnector, getNotificationConnector } from './connectors/notification';
import { AnalyticsConnector, getAnalyticsConnector } from './connectors/analytics';

export { PaymentConnector, getPaymentConnector };
export { WalletConnector, getWalletConnector };
export type { TransactionRecord, PayoutRequest, TopupRequest } from './connectors/wallet';
export { OrderConnector, getOrderConnector };
export type { OrderListParams } from './connectors/order';
export { BookingConnector, getBookingConnector };
export type { BookingListParams, CancellationRequest } from './connectors/booking';
export { NotificationConnector, getNotificationConnector };
export type { NotificationRecord, BulkNotificationRequest, ScheduledNotificationRequest } from './connectors/notification';
export { AnalyticsConnector, getAnalyticsConnector };
export type { ChartData, ReportRequest, ExportRequest } from './connectors/analytics';

// Types
export type {
  ServiceConfig,
  ServiceResponse,
  ServiceError,
  PaginationParams,
  PaginatedResponse,
  // Payment types
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  CapturePaymentRequest,
  RefundRequest,
  // Wallet types
  CoinType,
  WalletBalance,
  CreditRequest,
  DebitRequest,
  // Order types
  OrderStatus,
  CreateOrderRequest,
  OrderResponse,
  UpdateOrderStatusRequest,
  // Booking types
  BookingType,
  BookingStatus,
  GuestInfo,
  PricingInfo,
  CreateBookingRequest,
  BookingResponse,
  UpdateBookingStatusRequest,
  // Notification types
  NotificationChannel,
  NotificationPriority,
  SendNotificationRequest,
  NotificationResponse,
  NotificationListParams,
  // Analytics types
  DateRange,
  DashboardSummary,
  KPIResponse,
  AnalyticsQueryParams,
} from './types';

// Utility classes
export { ServiceClient } from './utils/client';
export type { ClientConfig } from './utils/client';

/**
 * Orchestrator Service Manager
 *
 * Provides a unified interface to manage all service connectors.
 * Useful for health checks and batch operations.
 */
export class ServiceManager {
  private connectors: {
    payment: PaymentConnector;
    wallet: WalletConnector;
    order: OrderConnector;
    booking: BookingConnector;
    notification: NotificationConnector;
    analytics: AnalyticsConnector;
  };

  constructor() {
    this.connectors = {
      payment: getPaymentConnector(),
      wallet: getWalletConnector(),
      order: getOrderConnector(),
      booking: getBookingConnector(),
      notification: getNotificationConnector(),
      analytics: getAnalyticsConnector(),
    };
  }

  /**
   * Get all service health statuses
   *
   * @returns Map of service name to health status
   */
  async getAllHealthStatuses(): Promise<Record<string, { healthy: boolean; latency?: number }>> {
    const results = await Promise.allSettled([
      this.connectors.payment.healthCheck().then((r) => ['payment', r] as const),
      this.connectors.wallet.healthCheck().then((r) => ['wallet', r] as const),
      this.connectors.order.healthCheck().then((r) => ['order', r] as const),
      this.connectors.booking.healthCheck().then((r) => ['booking', r] as const),
      this.connectors.notification.healthCheck().then((r) => ['notification', r] as const),
      this.connectors.analytics.healthCheck().then((r) => ['analytics', r] as const),
    ]);

    const healthMap: Record<string, { healthy: boolean; latency?: number }> = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        healthMap[result.value[0]] = result.value[1];
      } else {
        healthMap[result.reason?.service || 'unknown'] = { healthy: false };
      }
    }

    return healthMap;
  }

  /**
   * Check if all services are healthy
   *
   * @returns true if all services are healthy
   */
  async isHealthy(): Promise<boolean> {
    const statuses = await this.getAllHealthStatuses();
    return Object.values(statuses).every((s) => s.healthy);
  }

  // Convenience getters for individual connectors
  get payment(): PaymentConnector {
    return this.connectors.payment;
  }

  get wallet(): WalletConnector {
    return this.connectors.wallet;
  }

  get order(): OrderConnector {
    return this.connectors.order;
  }

  get booking(): BookingConnector {
    return this.connectors.booking;
  }

  get notification(): NotificationConnector {
    return this.connectors.notification;
  }

  get analytics(): AnalyticsConnector {
    return this.connectors.analytics;
  }
}

// Default singleton instance
let serviceManagerInstance: ServiceManager | null = null;

export function getServiceManager(): ServiceManager {
  if (!serviceManagerInstance) {
    serviceManagerInstance = new ServiceManager();
  }
  return serviceManagerInstance;
}

export default ServiceManager;

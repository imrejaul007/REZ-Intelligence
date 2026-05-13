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
export type { ServiceConfig, ServiceResponse, ServiceError, PaginationParams, PaginatedResponse, PaymentMethod, PaymentPurpose, PaymentStatus, InitiatePaymentRequest, InitiatePaymentResponse, CapturePaymentRequest, RefundRequest, CoinType, WalletBalance, CreditRequest, DebitRequest, OrderStatus, CreateOrderRequest, OrderResponse, UpdateOrderStatusRequest, BookingType, BookingStatus, GuestInfo, PricingInfo, CreateBookingRequest, BookingResponse, UpdateBookingStatusRequest, NotificationChannel, NotificationPriority, SendNotificationRequest, NotificationResponse, NotificationListParams, DateRange, DashboardSummary, KPIResponse, AnalyticsQueryParams, } from './types';
export { ServiceClient } from './utils/client';
export type { ClientConfig } from './utils/client';
/**
 * Orchestrator Service Manager
 *
 * Provides a unified interface to manage all service connectors.
 * Useful for health checks and batch operations.
 */
export declare class ServiceManager {
    private connectors;
    constructor();
    /**
     * Get all service health statuses
     *
     * @returns Map of service name to health status
     */
    getAllHealthStatuses(): Promise<Record<string, {
        healthy: boolean;
        latency?: number;
    }>>;
    /**
     * Check if all services are healthy
     *
     * @returns true if all services are healthy
     */
    isHealthy(): Promise<boolean>;
    get payment(): PaymentConnector;
    get wallet(): WalletConnector;
    get order(): OrderConnector;
    get booking(): BookingConnector;
    get notification(): NotificationConnector;
    get analytics(): AnalyticsConnector;
}
export declare function getServiceManager(): ServiceManager;
export default ServiceManager;
//# sourceMappingURL=index.d.ts.map
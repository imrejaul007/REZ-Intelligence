import type { SDKConfig, PaymentResult, OrderResult, OrderItem, WalletBalanceResult, NotificationResult, AnalyticsResult, HealthStatus } from './types';
import { PaymentConnector, WalletConnector, OrderConnector, BookingConnector, NotificationConnector, AnalyticsConnector, CatalogConnector } from './connectors';
import type { CreditRequest, DebitRequest } from './connectors';
import { EventPublisher } from './events/eventBus';
import type { ProductSearchFilters, ProductSearchResult, Product, CreateBookingRequest, BookingResult } from './types';
export declare class UnifiedAgentSDK {
    private config;
    private logger;
    private eventBus;
    private eventPublisher;
    private payment;
    private wallet;
    private order;
    private booking;
    private notification;
    private analytics;
    private catalog;
    private initialized;
    constructor(config: SDKConfig);
    /**
     * Initialize all service connectors
     */
    initialize(): Promise<void>;
    /**
     * Process a payment
     */
    processPayment(orderId: string, amount: number, method: string, options?: {
        currency?: string;
        customerEmail?: string;
        customerPhone?: string;
        description?: string;
        metadata?: Record<string, unknown>;
    }): Promise<PaymentResult>;
    /**
     * Get wallet balance for a user
     */
    getBalance(userId: string): Promise<WalletBalanceResult>;
    /**
     * Credit wallet
     */
    creditWallet(request: CreditRequest): Promise<import('./types').WalletTransactionResult>;
    /**
     * Debit wallet
     */
    debitWallet(request: DebitRequest): Promise<import('./types').WalletTransactionResult>;
    /**
     * Create a new order
     */
    createOrder(items: OrderItem[], options?: {
        customerId: string;
        shippingAddress?: import('./types').Address;
        billingAddress?: import('./types').Address;
        paymentMethod?: string;
        metadata?: Record<string, unknown>;
    }): Promise<OrderResult>;
    /**
     * Update order status
     */
    updateOrderStatus(orderId: string, status: string): Promise<OrderResult>;
    /**
     * Get order by ID
     */
    getOrder(orderId: string): Promise<OrderResult>;
    /**
     * Create a booking
     */
    createBooking(request: CreateBookingRequest): Promise<BookingResult>;
    /**
     * Get booking by ID
     */
    getBooking(bookingId: string): Promise<BookingResult>;
    /**
     * Cancel booking
     */
    cancelBooking(bookingId: string, reason: string, requestRefund?: boolean): Promise<void>;
    /**
     * Send notification
     */
    sendNotification(userId: string, template: string, data: Record<string, unknown>, options?: {
        channel?: string | string[];
        priority?: 'high' | 'normal' | 'low';
        scheduledAt?: string;
    }): Promise<NotificationResult>;
    /**
     * Track an event
     */
    trackEvent(event: string, data?: Record<string, unknown>): Promise<AnalyticsResult>;
    /**
     * Identify user
     */
    identifyUser(userId: string, properties?: Record<string, unknown>): Promise<void>;
    /**
     * Search products
     */
    searchProducts(filters: ProductSearchFilters, options?: {
        page?: number;
        pageSize?: number;
    }): Promise<ProductSearchResult>;
    /**
     * Get product by ID
     */
    getProduct(productId: string): Promise<Product>;
    /**
     * Publish an event to the event bus
     */
    publishEvent(eventType: string, payload: unknown, metadata?: Record<string, unknown>): Promise<void>;
    /**
     * Subscribe to events
     */
    on(eventType: string, handler: (payload: import('./types').EventPayload) => void): () => void;
    /**
     * Subscribe once
     */
    once(eventType: string, handler: (payload: import('./types').EventPayload) => void): () => void;
    /**
     * Subscribe to pattern
     */
    onPattern(pattern: string, handler: (payload: import('./types').EventPayload) => void): () => void;
    /**
     * Get event history
     */
    getEventHistory(limit?: number): import('./types').EventPayload[];
    /**
     * Check health of all configured services
     */
    checkServicesHealth(): Promise<HealthStatus>;
    /**
     * Get circuit breaker stats for a service
     */
    getCircuitBreakerStats(service: string): {
        enabled: boolean;
        opened: boolean;
        halfOpen: boolean;
        failures: number;
        successes: number;
        fallbacks: number;
        rejects: number;
    } | null;
    get connectors(): {
        payment: PaymentConnector | null;
        wallet: WalletConnector | null;
        order: OrderConnector | null;
        booking: BookingConnector | null;
        notification: NotificationConnector | null;
        analytics: AnalyticsConnector | null;
        catalog: CatalogConnector | null;
    };
    get events(): EventPublisher;
    get agentId(): string;
    /**
     * Close all connections and cleanup
     */
    close(): Promise<void>;
    private ensureInitialized;
    private getConnector;
}
export declare function createSDK(config: SDKConfig): UnifiedAgentSDK;
//# sourceMappingURL=sdk.d.ts.map
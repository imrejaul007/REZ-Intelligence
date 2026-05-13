import type {
  SDKConfig,
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  PaymentResult,
  OrderResult,
  OrderItem,
  WalletBalanceResult,
  NotificationResult,
  AnalyticsResult,
  HealthStatus,
  ServiceHealth,
  OrderStatus,
} from './types';
import { createDefaultLogger, DEFAULT_TIMEOUT, DEFAULT_RETRY, DEFAULT_CIRCUIT_BREAKER } from './config';
import {
  PaymentConnector,
  WalletConnector,
  OrderConnector,
  BookingConnector,
  NotificationConnector,
  AnalyticsConnector,
  CatalogConnector,
} from './connectors';
import type {
  SendNotificationOptions,
  CreditRequest,
  DebitRequest,
  TrackEventOptions,
} from './connectors';
import { EventBus, EventPublisher, createEventBus, createEventPublisher } from './events/eventBus';
import type {
  ProductSearchFilters,
  ProductSearchResult,
  Product,
  CreateBookingRequest,
  BookingResult,
  CreateOrderRequest,
} from './types';

// ============================================================================
// Unified Agent SDK
// ============================================================================

export class UnifiedAgentSDK {
  private config: SDKConfig;
  private logger: Logger;
  private eventBus: EventBus;
  private eventPublisher: EventPublisher;
  private payment: PaymentConnector | null = null;
  private wallet: WalletConnector | null = null;
  private order: OrderConnector | null = null;
  private booking: BookingConnector | null = null;
  private notification: NotificationConnector | null = null;
  private analytics: AnalyticsConnector | null = null;
  private catalog: CatalogConnector | null = null;
  private initialized: boolean = false;

  constructor(config: SDKConfig) {
    this.config = config;
    this.logger = config.logger || createDefaultLogger(config.agentId);
    this.eventBus = createEventBus({ logger: this.logger });
    this.eventPublisher = createEventPublisher(this.eventBus, { logger: this.logger });

    this.logger.info('UnifiedAgentSDK initialized', {
      agentId: config.agentId,
      services: Object.keys(config.services).filter(
        (key) => config.services[key as keyof typeof config.services],
      ),
    });
  }

  /**
   * Initialize all service connectors
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing service connectors');

    const connectorOptions = {
      logger: this.logger,
      timeout: this.config.timeout || DEFAULT_TIMEOUT,
      retry: this.config.retry || DEFAULT_RETRY,
      circuitBreaker: this.config.circuitBreaker || DEFAULT_CIRCUIT_BREAKER,
    };

    // Initialize payment connector
    if (this.config.services.paymentService && this.config.internalTokens.payment) {
      this.payment = new PaymentConnector(
        this.config.services.paymentService,
        this.config.internalTokens.payment,
        connectorOptions,
      );
    }

    // Initialize wallet connector
    if (this.config.services.walletService && this.config.internalTokens.wallet) {
      this.wallet = new WalletConnector(
        this.config.services.walletService,
        this.config.internalTokens.wallet,
        connectorOptions,
      );
    }

    // Initialize order connector
    if (this.config.services.orderService && this.config.internalTokens.order) {
      this.order = new OrderConnector(
        this.config.services.orderService,
        this.config.internalTokens.order,
        connectorOptions,
      );
    }

    // Initialize booking connector
    if (this.config.services.bookingService && this.config.internalTokens.booking) {
      this.booking = new BookingConnector(
        this.config.services.bookingService,
        this.config.internalTokens.booking,
        connectorOptions,
      );
    }

    // Initialize notification connector
    if (this.config.services.notificationService && this.config.internalTokens.notification) {
      this.notification = new NotificationConnector(
        this.config.services.notificationService,
        this.config.internalTokens.notification,
        connectorOptions,
      );
    }

    // Initialize analytics connector
    if (this.config.services.analyticsService && this.config.internalTokens.analytics) {
      this.analytics = new AnalyticsConnector(
        this.config.services.analyticsService,
        this.config.internalTokens.analytics,
        connectorOptions,
      );
    }

    // Initialize catalog connector
    if (this.config.services.catalogService && this.config.internalTokens.catalog) {
      this.catalog = new CatalogConnector(
        this.config.services.catalogService,
        this.config.internalTokens.catalog,
        connectorOptions,
      );
    }

    this.initialized = true;
    this.logger.info('Service connectors initialized');
  }

  // ============================================================================
  // Payment Methods
  // ============================================================================

  /**
   * Process a payment
   */
  async processPayment(
    orderId: string,
    amount: number,
    method: string,
    options?: {
      currency?: string;
      customerEmail?: string;
      customerPhone?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PaymentResult> {
    await this.ensureInitialized();

    if (!this.payment) {
      throw new Error('Payment service not configured');
    }

    await this.publishEvent('payment.initiated', {
      orderId,
      amount,
      method,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.payment.processPayment(orderId, amount, method, {
        currency: options?.currency || 'INR',
        customerEmail: options?.customerEmail,
        customerPhone: options?.customerPhone,
        description: options?.description,
        metadata: options?.metadata,
      });

      await this.publishEvent('payment.completed', {
        paymentId: result.paymentId,
        orderId,
        amount,
        status: result.status,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      await this.publishEvent('payment.failed', {
        orderId,
        amount,
        method,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  // ============================================================================
  // Wallet Methods
  // ============================================================================

  /**
   * Get wallet balance for a user
   */
  async getBalance(userId: string): Promise<WalletBalanceResult> {
    await this.ensureInitialized();

    if (!this.wallet) {
      throw new Error('Wallet service not configured');
    }

    return this.wallet.getBalance(userId);
  }

  /**
   * Credit wallet
   */
  async creditWallet(request: CreditRequest): Promise<import('./types').WalletTransactionResult> {
    await this.ensureInitialized();

    if (!this.wallet) {
      throw new Error('Wallet service not configured');
    }

    return this.wallet.credit(request);
  }

  /**
   * Debit wallet
   */
  async debitWallet(request: DebitRequest): Promise<import('./types').WalletTransactionResult> {
    await this.ensureInitialized();

    if (!this.wallet) {
      throw new Error('Wallet service not configured');
    }

    return this.wallet.debit(request);
  }

  // ============================================================================
  // Order Methods
  // ============================================================================

  /**
   * Create a new order
   */
  async createOrder(
    items: OrderItem[],
    options?: {
      customerId: string;
      shippingAddress?: import('./types').Address;
      billingAddress?: import('./types').Address;
      paymentMethod?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<OrderResult> {
    await this.ensureInitialized();

    if (!this.order) {
      throw new Error('Order service not configured');
    }

    await this.publishEvent('order.created', {
      customerId: options?.customerId,
      itemCount: items.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const request: CreateOrderRequest = {
        items,
        customerId: options?.customerId || '',
        shippingAddress: options?.shippingAddress,
        billingAddress: options?.billingAddress,
        paymentMethod: options?.paymentMethod as CreateOrderRequest['paymentMethod'],
        metadata: options?.metadata,
      };

      const result = await this.order.createOrder(items, request);

      await this.publishEvent('order.confirmed', {
        orderId: result.orderId,
        customerId: result.customerId,
        total: result.total,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      await this.publishEvent('order.failed', {
        customerId: options?.customerId,
        itemCount: items.length,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
  ): Promise<OrderResult> {
    await this.ensureInitialized();

    if (!this.order) {
      throw new Error('Order service not configured');
    }

    const result = await this.order.updateOrderStatus(orderId, status);

    await this.publishEvent('order.status_updated', {
      orderId,
      status,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<OrderResult> {
    await this.ensureInitialized();

    if (!this.order) {
      throw new Error('Order service not configured');
    }

    return this.order.getOrder(orderId);
  }

  // ============================================================================
  // Booking Methods
  // ============================================================================

  /**
   * Create a booking
   */
  async createBooking(request: CreateBookingRequest): Promise<BookingResult> {
    await this.ensureInitialized();

    if (!this.booking) {
      throw new Error('Booking service not configured');
    }

    await this.publishEvent('booking.created', {
      serviceType: request.serviceType,
      serviceId: request.serviceId,
      customerId: request.customerId,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.booking.createBooking(request);

      await this.publishEvent('booking.confirmed', {
        bookingId: result.bookingId,
        confirmationCode: result.confirmationCode,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      await this.publishEvent('booking.failed', {
        serviceType: request.serviceType,
        serviceId: request.serviceId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: string): Promise<BookingResult> {
    await this.ensureInitialized();

    if (!this.booking) {
      throw new Error('Booking service not configured');
    }

    return this.booking.getBooking(bookingId);
  }

  /**
   * Cancel booking
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
    requestRefund?: boolean,
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.booking) {
      throw new Error('Booking service not configured');
    }

    await this.booking.cancelBooking(bookingId, reason, requestRefund);

    await this.publishEvent('booking.cancelled', {
      bookingId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================================
  // Notification Methods
  // ============================================================================

  /**
   * Send notification
   */
  async sendNotification(
    userId: string,
    template: string,
    data: Record<string, unknown>,
    options?: {
      channel?: string | string[];
      priority?: 'high' | 'normal' | 'low';
      scheduledAt?: string;
    },
  ): Promise<NotificationResult> {
    await this.ensureInitialized();

    if (!this.notification) {
      throw new Error('Notification service not configured');
    }

    const request: SendNotificationOptions = {
      userId,
      template,
      data,
      channel: options?.channel,
      priority: options?.priority || 'normal',
      scheduledAt: options?.scheduledAt,
    };

    return this.notification.send(request);
  }

  // ============================================================================
  // Analytics Methods
  // ============================================================================

  /**
   * Track an event
   */
  async trackEvent(
    event: string,
    data?: Record<string, unknown>,
  ): Promise<AnalyticsResult> {
    await this.ensureInitialized();

    if (!this.analytics) {
      throw new Error('Analytics service not configured');
    }

    const options: TrackEventOptions = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    return this.analytics.trackEvent(options);
  }

  /**
   * Identify user
   */
  async identifyUser(
    userId: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.analytics) {
      throw new Error('Analytics service not configured');
    }

    await this.analytics.identifyUser(userId, properties);
  }

  // ============================================================================
  // Catalog Methods
  // ============================================================================

  /**
   * Search products
   */
  async searchProducts(
    filters: ProductSearchFilters,
    options?: {
      page?: number;
      pageSize?: number;
    },
  ): Promise<ProductSearchResult> {
    await this.ensureInitialized();

    if (!this.catalog) {
      throw new Error('Catalog service not configured');
    }

    return this.catalog.searchProducts(filters, options);
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<Product> {
    await this.ensureInitialized();

    if (!this.catalog) {
      throw new Error('Catalog service not configured');
    }

    return this.catalog.getProduct(productId);
  }

  // ============================================================================
  // Event Publishing
  // ============================================================================

  /**
   * Publish an event to the event bus
   */
  async publishEvent(
    eventType: string,
    payload: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.eventPublisher.publish(eventType, payload, {
        source: this.config.agentId,
        metadata,
      });
    } catch (error) {
      this.logger.error('Failed to publish event', {
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - event publishing should not break the main flow
    }
  }

  /**
   * Subscribe to events
   */
  on(eventType: string, handler: (payload: import('./types').EventPayload) => void): () => void {
    return this.eventPublisher.on(eventType, handler);
  }

  /**
   * Subscribe once
   */
  once(
    eventType: string,
    handler: (payload: import('./types').EventPayload) => void,
  ): () => void {
    return this.eventPublisher.once(eventType, handler);
  }

  /**
   * Subscribe to pattern
   */
  onPattern(
    pattern: string,
    handler: (payload: import('./types').EventPayload) => void,
  ): () => void {
    return this.eventPublisher.onPattern(pattern, handler);
  }

  /**
   * Get event history
   */
  getEventHistory(limit?: number): import('./types').EventPayload[] {
    return this.eventPublisher.getHistory(limit);
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  /**
   * Check health of all configured services
   */
  async checkServicesHealth(): Promise<HealthStatus> {
    await this.ensureInitialized();

    const services: Record<string, import('./types').ServiceHealth> = {};
    const checks: Promise<void>[] = [];

    const addServiceHealth = async (
      name: string,
      connector: { checkHealth(): Promise<{ status: string; latency?: number; error?: string }> } | null,
    ) => {
      if (!connector) {
        services[name] = {
          status: 'unknown',
          lastChecked: new Date().toISOString(),
          error: 'Service not configured',
        };
        return;
      }

      try {
        const health = await connector.checkHealth();
        services[name] = {
          status: health.status as ServiceHealth['status'],
          latency: health.latency,
          lastChecked: new Date().toISOString(),
          error: health.error,
        };
      } catch (error) {
        services[name] = {
          status: 'unhealthy',
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    };

    checks.push(
      addServiceHealth('payment', this.payment),
      addServiceHealth('wallet', this.wallet),
      addServiceHealth('order', this.order),
      addServiceHealth('booking', this.booking),
      addServiceHealth('notification', this.notification),
      addServiceHealth('analytics', this.analytics),
      addServiceHealth('catalog', this.catalog),
    );

    await Promise.all(checks);

    // Determine overall health
    const healthValues = Object.values(services).map((s) => s.status);
    let overall: HealthStatus['overall'] = 'healthy';

    if (healthValues.includes('unhealthy')) {
      overall = 'unhealthy';
    } else if (healthValues.includes('degraded') || healthValues.includes('unknown')) {
      overall = 'degraded';
    }

    return {
      overall,
      services,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Get circuit breaker stats for a service
   */
  getCircuitBreakerStats(
    service: string,
  ): {
    enabled: boolean;
    opened: boolean;
    halfOpen: boolean;
    failures: number;
    successes: number;
    fallbacks: number;
    rejects: number;
  } | null {
    const connector = this.getConnector(service);
    if (!connector) {
      return null;
    }
    return connector.getCircuitBreakerStats();
  }

  // ============================================================================
  // Accessors for Raw Connectors
  // ============================================================================

  get connectors() {
    return {
      payment: this.payment,
      wallet: this.wallet,
      order: this.order,
      booking: this.booking,
      notification: this.notification,
      analytics: this.analytics,
      catalog: this.catalog,
    };
  }

  get events() {
    return this.eventPublisher;
  }

  get agentId(): string {
    return this.config.agentId;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    this.logger.info('Closing UnifiedAgentSDK');

    const closePromises: Promise<void>[] = [];

    if (this.payment) closePromises.push(this.payment.close());
    if (this.wallet) closePromises.push(this.wallet.close());
    if (this.order) closePromises.push(this.order.close());
    if (this.booking) closePromises.push(this.booking.close());
    if (this.notification) closePromises.push(this.notification.close());
    if (this.analytics) closePromises.push(this.analytics.close());
    if (this.catalog) closePromises.push(this.catalog.close());

    await Promise.all(closePromises);
    this.eventBus.clear();

    this.logger.info('UnifiedAgentSDK closed');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getConnector(service: string): any {
    switch (service) {
      case 'payment':
        return this.payment;
      case 'wallet':
        return this.wallet;
      case 'order':
        return this.order;
      case 'booking':
        return this.booking;
      case 'notification':
        return this.notification;
      case 'analytics':
        return this.analytics;
      case 'catalog':
        return this.catalog;
      default:
        return null;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSDK(config: SDKConfig): UnifiedAgentSDK {
  return new UnifiedAgentSDK(config);
}

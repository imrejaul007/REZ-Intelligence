// Main SDK exports
export { UnifiedAgentSDK, createSDK } from './sdk';

// Service connectors
export {
  // Base connector
  BaseConnector,

  // Individual connectors
  PaymentConnector,
  createPaymentConnector,
  WalletConnector,
  createWalletConnector,
  OrderConnector,
  createOrderConnector,
  BookingConnector,
  createBookingConnector,
  NotificationConnector,
  createNotificationConnector,
  AnalyticsConnector,
  createAnalyticsConnector,
  CatalogConnector,
  createCatalogConnector,
} from './connectors';

// Connector types
export type {
  RefundRequest,
  RefundResult,
  PaymentStatusResult,
  PaymentHistoryResult,
  CreditRequest,
  DebitRequest,
  WalletTransactionListResult,
  WalletSummaryResult,
  UpdateOrderRequest,
  OrderListResult,
  OrderStatusUpdate,
  OrderCancellation,
  BookingSearchParams,
  BookingListResult,
  BookingCancellation,
  BookingModification,
  SendNotificationOptions,
  NotificationListResult,
  NotificationTemplateInfo,
  UserPreferences,
  TrackEventOptions,
  UserPropertyUpdate,
  ConversionEvent,
  AnalyticsQuery,
  AnalyticsQueryResult,
  FunnelStep,
  FunnelResult,
  RetentionCohort,
  RetentionResult,
  RealTimeMetrics,
  ProductCreateRequest,
  ProductUpdateRequest,
  Category,
  InventoryUpdate,
  InventoryStatus,
} from './connectors';

// Event system
export {
  EventBus,
  EventPublisher,
  createEventBus,
  createEventPublisher,
  AGENT_EVENTS,
  PAYMENT_EVENTS,
  ORDER_EVENTS,
  BOOKING_EVENTS,
  NOTIFICATION_EVENTS,
} from './events/eventBus';

export type {
  EventHandler,
  Subscription,
  EventBusConfig,
  EventPublisherConfig,
} from './events/eventBus';

// Configuration
export {
  DEFAULT_TIMEOUT,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_RETRY,
  DEFAULT_SERVICE_ENDPOINTS,
  loadInternalTokens,
  createDefaultLogger,
  validateConfig,
  ConfigBuilder,
  createConfig,
} from './config';

export type {
  ServiceEndpoints,
  InternalTokenConfig,
} from './config';

// Types
export {
  // Error classes
  SDKError,
  ServiceError,
  CircuitOpenError,
  ValidationError,
  AuthenticationError,
  TimeoutError,
  RetryExhaustedError,

  // Configuration schemas
  CircuitBreakerOptionsSchema,
  RetryOptionsSchema,
  SDKConfigSchema,
  ProcessPaymentRequestSchema,
  CreateOrderRequestSchema,
  CreateBookingRequestSchema,
  SendNotificationRequestSchema,
  TrackEventRequestSchema,
  ProductSearchFiltersSchema,

  // Enums and schemas
  PaymentMethodSchema,
  PaymentStatusSchema,
  WalletTransactionTypeSchema,
  OrderStatusSchema,
  BookingServiceTypeSchema,
  BookingStatusSchema,
  NotificationChannelSchema,
  NotificationTemplateSchema,
} from './types';

export type {
  // Configuration types
  CircuitBreakerOptions,
  RetryOptions,
  SDKConfig,

  // Payment types
  PaymentMethod,
  PaymentStatus,
  ProcessPaymentOptions,
  ProcessPaymentRequest,
  PaymentResult,

  // Wallet types
  WalletTransactionType,
  WalletBalanceResult,
  WalletTransactionResult,

  // Order types
  OrderItem,
  Address,
  OrderStatus,
  CreateOrderRequest,
  OrderResult,

  // Booking types
  BookingServiceType,
  BookingStatus,
  CreateBookingRequest,
  BookingResult,

  // Notification types
  NotificationChannel,
  NotificationTemplate,
  SendNotificationRequest,
  NotificationResult,

  // Analytics types
  TrackEventRequest,
  AnalyticsResult,

  // Catalog types
  ProductSearchFilters,
  Product,
  ProductSearchResult,

  // Health types
  ServiceHealth,
  HealthStatus,

  // Event types
  EventPayload,

  // HTTP types
  HttpRequestConfig,
  HttpResponse,
  HttpClient,

  // Logger types
  Logger,
} from './types';

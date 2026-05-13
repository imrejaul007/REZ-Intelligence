import { z } from 'zod';

// ============================================================================
// Core Configuration Types
// ============================================================================

export const CircuitBreakerOptionsSchema = z.object({
  timeout: z.number().positive().default(5000),
  errorThresholdPercentage: z.number().min(0).max(100).default(50),
  resetTimeout: z.number().positive().default(30000),
  volumeThreshold: z.number().int().positive().default(10),
});

export type CircuitBreakerOptions = z.infer<typeof CircuitBreakerOptionsSchema>;

export const RetryOptionsSchema = z.object({
  maxAttempts: z.number().int().positive().default(3),
  initialDelay: z.number().positive().default(100),
  maxDelay: z.number().positive().default(5000),
  factor: z.number().positive().default(2),
  jitter: z.boolean().default(true),
});

export type RetryOptions = z.infer<typeof RetryOptionsSchema>;

export const SDKConfigSchema = z.object({
  agentId: z.string().min(1),
  internalTokens: z.record(z.string()),
  services: z.object({
    paymentService: z.string().url().optional(),
    walletService: z.string().url().optional(),
    orderService: z.string().url().optional(),
    bookingService: z.string().url().optional(),
    notificationService: z.string().url().optional(),
    analyticsService: z.string().url().optional(),
    catalogService: z.string().url().optional(),
  }),
  circuitBreaker: CircuitBreakerOptionsSchema.optional(),
  retry: RetryOptionsSchema.optional(),
  timeout: z.number().positive().default(30000),
  logger: z.custom<Logger>().optional(),
});

export type SDKConfig = z.infer<typeof SDKConfigSchema>;

// ============================================================================
// Payment Types
// ============================================================================

export const PaymentMethodSchema = z.enum([
  'upi',
  'card',
  'netbanking',
  'wallet',
  'cod',
  'bank_transfer',
]);

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStatusSchema = z.enum([
  'created',
  'pending',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
  'cancelled',
]);

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const ProcessPaymentOptionsSchema = z.object({
  currency: z.string().length(3).default('INR'),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ProcessPaymentOptions = z.infer<typeof ProcessPaymentOptionsSchema>;

export const ProcessPaymentRequestSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
  method: PaymentMethodSchema,
  options: ProcessPaymentOptionsSchema.optional(),
});

export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentRequestSchema>;

export const PaymentResultSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  status: PaymentStatusSchema,
  amount: z.number().int(),
  currency: z.string(),
  method: PaymentMethodSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  receiptUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PaymentResult = z.infer<typeof PaymentResultSchema>;

// ============================================================================
// Wallet Types
// ============================================================================

export const WalletTransactionTypeSchema = z.enum([
  'credit',
  'debit',
  'refund',
  'cashback',
  'reversal',
]);

export type WalletTransactionType = z.infer<typeof WalletTransactionTypeSchema>;

export const WalletBalanceResultSchema = z.object({
  userId: z.string(),
  balance: z.number().int(),
  currency: z.string(),
  availableBalance: z.number().int(),
  pendingBalance: z.number().int(),
  lastUpdated: z.string().datetime(),
});

export type WalletBalanceResult = z.infer<typeof WalletBalanceResultSchema>;

export const WalletTransactionResultSchema = z.object({
  transactionId: z.string(),
  userId: z.string(),
  type: WalletTransactionTypeSchema,
  amount: z.number().int(),
  currency: z.string(),
  balance: z.number().int(),
  status: z.enum(['pending', 'completed', 'failed', 'reversed']),
  description: z.string().optional(),
  reference: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type WalletTransactionResult = z.infer<typeof WalletTransactionResultSchema>;

// ============================================================================
// Order Types
// ============================================================================

export const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().int().positive(),
  name: z.string().optional(),
  sku: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const AddressSchema = z.object({
  name: z.string().optional(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string().default('IN'),
  phone: z.string().optional(),
});

export type Address = z.infer<typeof AddressSchema>;

export const OrderStatusSchema = z.enum([
  'created',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const CreateOrderRequestSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  customerId: z.string().min(1),
  shippingAddress: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const OrderResultSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  status: OrderStatusSchema,
  items: z.array(OrderItemSchema),
  subtotal: z.number().int(),
  tax: z.number().int(),
  shipping: z.number().int(),
  total: z.number().int(),
  currency: z.string(),
  shippingAddress: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
  paymentId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type OrderResult = z.infer<typeof OrderResultSchema>;

// ============================================================================
// Booking Types
// ============================================================================

export const BookingServiceTypeSchema = z.enum([
  'hotel',
  'flight',
  'train',
  'bus',
  'cab',
  'experience',
  'restaurant',
  'spa',
  'event',
]);

export type BookingServiceType = z.infer<typeof BookingServiceTypeSchema>;

export const BookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'failed',
  'on_hold',
]);

export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const CreateBookingRequestSchema = z.object({
  serviceType: BookingServiceTypeSchema,
  serviceId: z.string().min(1),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  guestDetails: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    adults: z.number().int().positive().default(1),
    children: z.number().int().nonnegative().default(0),
  }).optional(),
  customerId: z.string().min(1),
  paymentMethod: PaymentMethodSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const BookingResultSchema = z.object({
  bookingId: z.string(),
  serviceType: BookingServiceTypeSchema,
  serviceId: z.string(),
  customerId: z.string(),
  status: BookingStatusSchema,
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  confirmationCode: z.string().optional(),
  totalAmount: z.number().int(),
  currency: z.string(),
  paymentId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type BookingResult = z.infer<typeof BookingResultSchema>;

// ============================================================================
// Notification Types
// ============================================================================

export const NotificationChannelSchema = z.enum([
  'email',
  'sms',
  'push',
  'whatsapp',
  'in_app',
]);

export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationTemplateSchema = z.enum([
  'order_confirmation',
  'order_shipped',
  'order_delivered',
  'payment_success',
  'payment_failed',
  'refund_initiated',
  'refund_completed',
  'booking_confirmed',
  'booking_cancelled',
  'promo_offer',
  'welcome',
  'password_reset',
  'custom',
]);

export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>;

export const SendNotificationRequestSchema = z.object({
  userId: z.string().min(1),
  template: NotificationTemplateSchema,
  channel: z.union([NotificationChannelSchema, z.array(NotificationChannelSchema)]).default('email'),
  data: z.record(z.unknown()),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>;

export const NotificationResultSchema = z.object({
  notificationId: z.string(),
  userId: z.string(),
  template: NotificationTemplateSchema,
  channel: NotificationChannelSchema,
  status: z.enum(['queued', 'sent', 'delivered', 'failed']),
  sentAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type NotificationResult = z.infer<typeof NotificationResultSchema>;

// ============================================================================
// Analytics Types
// ============================================================================

export const TrackEventRequestSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export type TrackEventRequest = z.infer<typeof TrackEventRequestSchema>;

export const AnalyticsResultSchema = z.object({
  eventId: z.string(),
  event: z.string(),
  timestamp: z.string().datetime(),
  processed: z.boolean(),
});

export type AnalyticsResult = z.infer<typeof AnalyticsResultSchema>;

// ============================================================================
// Catalog Types
// ============================================================================

export const ProductSearchFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  priceRange: z.tuple([z.number(), z.number()]).optional(),
  rating: z.number().min(0).max(5).optional(),
  inStock: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['price', 'rating', 'popularity', 'newest']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ProductSearchFilters = z.infer<typeof ProductSearchFiltersSchema>;

export const ProductSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().int(),
  currency: z.string(),
  images: z.array(z.string().url()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  inStock: z.boolean(),
  availableQuantity: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const ProductSearchResultSchema = z.object({
  products: z.array(ProductSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
});

export type ProductSearchResult = z.infer<typeof ProductSearchResultSchema>;

// ============================================================================
// Health Check Types
// ============================================================================

export const ServiceHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  latency: z.number().nonnegative().optional(),
  lastChecked: z.string().datetime(),
  error: z.string().optional(),
});

export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const HealthStatusSchema = z.object({
  overall: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  services: z.record(ServiceHealthSchema),
  checkedAt: z.string().datetime(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// ============================================================================
// Event Types
// ============================================================================

export const EventPayloadSchema = z.object({
  type: z.string().min(1),
  payload: z.unknown(),
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type EventPayload = z.infer<typeof EventPayloadSchema>;

// ============================================================================
// Error Types
// ============================================================================

export class SDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SDKError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ServiceError extends SDKError {
  constructor(
    message: string,
    statusCode: number,
    public readonly service: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'SERVICE_ERROR', statusCode, details);
    this.name = 'ServiceError';
  }
}

export class CircuitOpenError extends SDKError {
  constructor(
    public readonly service: string,
    public readonly failureCount: number,
  ) {
    super(`Circuit breaker is open for ${service}`, 'CIRCUIT_OPEN');
    this.name = 'CircuitOpenError';
  }
}

export class ValidationError extends SDKError {
  constructor(
    message: string,
    public readonly validationErrors: z.ZodError['errors'],
  ) {
    super(message, 'VALIDATION_ERROR', undefined, {
      validationErrors: validationErrors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends SDKError {
  constructor(
    message: string,
    public readonly service: string,
  ) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class TimeoutError extends SDKError {
  constructor(
    public readonly service: string,
    public readonly timeout: number,
  ) {
    super(`Request to ${service} timed out after ${timeout}ms`, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

export class RetryExhaustedError extends SDKError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message, 'RETRY_EXHAUSTED');
    this.name = 'RetryExhaustedError';
  }
}

// ============================================================================
// HTTP Client Types
// ============================================================================

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface HttpClient {
  request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
}

// ============================================================================
// Logger Types
// ============================================================================

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}


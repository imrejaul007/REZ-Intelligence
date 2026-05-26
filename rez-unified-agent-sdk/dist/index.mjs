import winston from 'winston';
import { z } from 'zod';
import axios, { AxiosError } from 'axios';
import CircuitBreaker from 'opossum';
import { randomInt, randomUUID } from 'crypto';
import EventEmitter from 'eventemitter3';

// src/config/index.ts
var CircuitBreakerOptionsSchema = z.object({
  timeout: z.number().positive().default(5e3),
  errorThresholdPercentage: z.number().min(0).max(100).default(50),
  resetTimeout: z.number().positive().default(3e4),
  volumeThreshold: z.number().int().positive().default(10)
});
var RetryOptionsSchema = z.object({
  maxAttempts: z.number().int().positive().default(3),
  initialDelay: z.number().positive().default(100),
  maxDelay: z.number().positive().default(5e3),
  factor: z.number().positive().default(2),
  jitter: z.boolean().default(true)
});
var SDKConfigSchema = z.object({
  agentId: z.string().min(1),
  internalTokens: z.record(z.string()),
  services: z.object({
    paymentService: z.string().url().optional(),
    walletService: z.string().url().optional(),
    orderService: z.string().url().optional(),
    bookingService: z.string().url().optional(),
    notificationService: z.string().url().optional(),
    analyticsService: z.string().url().optional(),
    catalogService: z.string().url().optional()
  }),
  circuitBreaker: CircuitBreakerOptionsSchema.optional(),
  retry: RetryOptionsSchema.optional(),
  timeout: z.number().positive().default(3e4),
  logger: z.custom().optional()
});
var PaymentMethodSchema = z.enum([
  "upi",
  "card",
  "netbanking",
  "wallet",
  "cod",
  "bank_transfer"
]);
var PaymentStatusSchema = z.enum([
  "created",
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
  "cancelled"
]);
var ProcessPaymentOptionsSchema = z.object({
  currency: z.string().length(3).default("INR"),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
var ProcessPaymentRequestSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
  method: PaymentMethodSchema,
  options: ProcessPaymentOptionsSchema.optional()
});
z.object({
  paymentId: z.string(),
  orderId: z.string(),
  status: PaymentStatusSchema,
  amount: z.number().int(),
  currency: z.string(),
  method: PaymentMethodSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  receiptUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional()
});
var WalletTransactionTypeSchema = z.enum([
  "credit",
  "debit",
  "refund",
  "cashback",
  "reversal"
]);
z.object({
  userId: z.string(),
  balance: z.number().int(),
  currency: z.string(),
  availableBalance: z.number().int(),
  pendingBalance: z.number().int(),
  lastUpdated: z.string().datetime()
});
z.object({
  transactionId: z.string(),
  userId: z.string(),
  type: WalletTransactionTypeSchema,
  amount: z.number().int(),
  currency: z.string(),
  balance: z.number().int(),
  status: z.enum(["pending", "completed", "failed", "reversed"]),
  description: z.string().optional(),
  reference: z.string().optional(),
  createdAt: z.string().datetime()
});
var OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().int().positive(),
  name: z.string().optional(),
  sku: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
var AddressSchema = z.object({
  name: z.string().optional(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string().default("IN"),
  phone: z.string().optional()
});
var OrderStatusSchema = z.enum([
  "created",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
]);
var CreateOrderRequestSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  customerId: z.string().min(1),
  shippingAddress: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});
z.object({
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
  metadata: z.record(z.unknown()).optional()
});
var BookingServiceTypeSchema = z.enum([
  "hotel",
  "flight",
  "train",
  "bus",
  "cab",
  "experience",
  "restaurant",
  "spa",
  "event"
]);
var BookingStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "failed",
  "on_hold"
]);
var CreateBookingRequestSchema = z.object({
  serviceType: BookingServiceTypeSchema,
  serviceId: z.string().min(1),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  guestDetails: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    adults: z.number().int().positive().default(1),
    children: z.number().int().nonnegative().default(0)
  }).optional(),
  customerId: z.string().min(1),
  paymentMethod: PaymentMethodSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});
z.object({
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
  metadata: z.record(z.unknown()).optional()
});
var NotificationChannelSchema = z.enum([
  "email",
  "sms",
  "push",
  "whatsapp",
  "in_app"
]);
var NotificationTemplateSchema = z.enum([
  "order_confirmation",
  "order_shipped",
  "order_delivered",
  "payment_success",
  "payment_failed",
  "refund_initiated",
  "refund_completed",
  "booking_confirmed",
  "booking_cancelled",
  "promo_offer",
  "welcome",
  "password_reset",
  "custom"
]);
var SendNotificationRequestSchema = z.object({
  userId: z.string().min(1),
  template: NotificationTemplateSchema,
  channel: z.union([NotificationChannelSchema, z.array(NotificationChannelSchema)]).default("email"),
  data: z.record(z.unknown()),
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional()
});
z.object({
  notificationId: z.string(),
  userId: z.string(),
  template: NotificationTemplateSchema,
  channel: NotificationChannelSchema,
  status: z.enum(["queued", "sent", "delivered", "failed"]),
  sentAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional()
});
var TrackEventRequestSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional()
});
z.object({
  eventId: z.string(),
  event: z.string(),
  timestamp: z.string().datetime(),
  processed: z.boolean()
});
var ProductSearchFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  priceRange: z.tuple([z.number(), z.number()]).optional(),
  rating: z.number().min(0).max(5).optional(),
  inStock: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(["price", "rating", "popularity", "newest"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});
var ProductSchema = z.object({
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
  metadata: z.record(z.unknown()).optional()
});
z.object({
  products: z.array(ProductSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int()
});
var ServiceHealthSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
  latency: z.number().nonnegative().optional(),
  lastChecked: z.string().datetime(),
  error: z.string().optional()
});
z.object({
  overall: z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
  services: z.record(ServiceHealthSchema),
  checkedAt: z.string().datetime()
});
z.object({
  type: z.string().min(1),
  payload: z.unknown(),
  timestamp: z.string().datetime().default(() => (/* @__PURE__ */ new Date()).toISOString()),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
var SDKError = class extends Error {
  constructor(message, code, statusCode, details) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = "SDKError";
    Error.captureStackTrace(this, this.constructor);
  }
  code;
  statusCode;
  details;
};
var ServiceError = class extends SDKError {
  constructor(message, statusCode, service, details) {
    super(message, "SERVICE_ERROR", statusCode, details);
    this.service = service;
    this.name = "ServiceError";
  }
  service;
};
var CircuitOpenError = class extends SDKError {
  constructor(service, failureCount) {
    super(`Circuit breaker is open for ${service}`, "CIRCUIT_OPEN");
    this.service = service;
    this.failureCount = failureCount;
    this.name = "CircuitOpenError";
  }
  service;
  failureCount;
};
var ValidationError = class extends SDKError {
  constructor(message, validationErrors) {
    super(message, "VALIDATION_ERROR", void 0, {
      validationErrors: validationErrors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
        code: e.code
      }))
    });
    this.validationErrors = validationErrors;
    this.name = "ValidationError";
  }
  validationErrors;
};
var AuthenticationError = class extends SDKError {
  constructor(message, service) {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.service = service;
    this.name = "AuthenticationError";
  }
  service;
};
var TimeoutError = class extends SDKError {
  constructor(service, timeout) {
    super(`Request to ${service} timed out after ${timeout}ms`, "TIMEOUT");
    this.service = service;
    this.timeout = timeout;
    this.name = "TimeoutError";
  }
  service;
  timeout;
};
var RetryExhaustedError = class extends SDKError {
  constructor(message, service, attempts, lastError) {
    super(message, "RETRY_EXHAUSTED");
    this.service = service;
    this.attempts = attempts;
    this.lastError = lastError;
    this.name = "RetryExhaustedError";
  }
  service;
  attempts;
  lastError;
};

// src/config/index.ts
var DEFAULT_TIMEOUT = 3e4;
var DEFAULT_CIRCUIT_BREAKER = {
  timeout: 5e3,
  errorThresholdPercentage: 50,
  resetTimeout: 3e4,
  volumeThreshold: 10
};
var DEFAULT_RETRY = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5e3,
  factor: 2,
  jitter: true
};
var DEFAULT_SERVICE_ENDPOINTS = {
  paymentService: process.env.PAYMENT_SERVICE_URL || "http://localhost:4001",
  walletService: process.env.WALLET_SERVICE_URL || "http://localhost:4002",
  orderService: process.env.ORDER_SERVICE_URL || "http://localhost:4003",
  bookingService: process.env.BOOKING_SERVICE_URL || "http://localhost:4004",
  notificationService: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4005",
  analyticsService: process.env.ANALYTICS_SERVICE_URL || "http://localhost:4006",
  catalogService: process.env.CATALOG_SERVICE_URL || "http://localhost:4007"
};
function loadInternalTokens() {
  const tokens = {};
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (tokensJson) {
    try {
      const parsed = JSON.parse(tokensJson);
      Object.assign(tokens, parsed);
    } catch (error) {
      console.warn("Failed to parse INTERNAL_SERVICE_TOKENS_JSON:", error);
    }
  }
  tokens.payment = tokens.payment || process.env.PAYMENT_SERVICE_TOKEN;
  tokens.wallet = tokens.wallet || process.env.WALLET_SERVICE_TOKEN;
  tokens.order = tokens.order || process.env.ORDER_SERVICE_TOKEN;
  tokens.booking = tokens.booking || process.env.BOOKING_SERVICE_TOKEN;
  tokens.notification = tokens.notification || process.env.NOTIFICATION_SERVICE_TOKEN;
  tokens.analytics = tokens.analytics || process.env.ANALYTICS_SERVICE_TOKEN;
  tokens.catalog = tokens.catalog || process.env.CATALOG_SERVICE_TOKEN;
  return tokens;
}
function createDefaultLogger(label) {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
          const labelStr = label ? `[${label}] ` : "";
          return `${timestamp} ${level}: ${labelStr}${message} ${metaStr}`;
        })
      )
    })
  ];
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    transports
  });
  return {
    error: (message, meta) => logger.error(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    info: (message, meta) => logger.info(message, meta),
    debug: (message, meta) => logger.debug(message, meta)
  };
}
function validateConfig(config) {
  const result = SDKConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(
      (e) => `Field '${e.path.join(".")}' ${e.message}`
    );
    throw new Error(`SDK Configuration validation failed:
${errors.join("\n")}`);
  }
  return result.data;
}
var ConfigBuilder = class {
  config = {};
  withAgentId(agentId) {
    this.config.agentId = agentId;
    return this;
  }
  withInternalTokens(tokens) {
    this.config.internalTokens = {
      payment: tokens.payment || "",
      wallet: tokens.wallet || "",
      order: tokens.order || "",
      booking: tokens.booking || "",
      notification: tokens.notification || "",
      analytics: tokens.analytics || "",
      catalog: tokens.catalog || ""
    };
    return this;
  }
  withServices(endpoints) {
    this.config.services = {
      paymentService: endpoints.paymentService,
      walletService: endpoints.walletService,
      orderService: endpoints.orderService,
      bookingService: endpoints.bookingService,
      notificationService: endpoints.notificationService,
      analyticsService: endpoints.analyticsService,
      catalogService: endpoints.catalogService
    };
    return this;
  }
  withTimeout(timeout) {
    this.config.timeout = timeout;
    return this;
  }
  withCircuitBreaker(options) {
    this.config.circuitBreaker = options;
    return this;
  }
  withRetry(options) {
    this.config.retry = options;
    return this;
  }
  build() {
    const tokens = this.config.internalTokens || loadInternalTokens();
    const defaults = {
      agentId: this.config.agentId || "default-agent",
      internalTokens: {
        ...DEFAULT_SERVICE_ENDPOINTS,
        ...tokens
      },
      services: this.config.services || DEFAULT_SERVICE_ENDPOINTS,
      timeout: this.config.timeout || DEFAULT_TIMEOUT
    };
    const merged = { ...defaults, ...this.config };
    return validateConfig(merged);
  }
};
function createConfig(partial) {
  const builder = new ConfigBuilder();
  if (partial?.agentId) {
    builder.withAgentId(partial.agentId);
  }
  if (partial?.internalTokens) {
    builder.withInternalTokens(partial.internalTokens);
  }
  if (partial?.services) {
    builder.withServices(partial.services);
  }
  if (partial?.timeout) {
    builder.withTimeout(partial.timeout);
  }
  if (partial?.circuitBreaker) {
    builder.withCircuitBreaker(partial.circuitBreaker);
  }
  if (partial?.retry) {
    builder.withRetry(partial.retry);
  }
  return builder.build();
}
var BaseConnector = class {
  httpClient;
  logger;
  circuitBreaker;
  retryOptions;
  circuitBreakerOptions;
  serviceName;
  baseUrl;
  timeout;
  constructor(serviceName, baseUrl, authToken, options = {}) {
    this.serviceName = serviceName;
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.retryOptions = { ...DEFAULT_RETRY, ...options.retry };
    this.circuitBreakerOptions = { ...DEFAULT_CIRCUIT_BREAKER, ...options.circuitBreaker };
    this.logger = options.logger || {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.log.bind(console),
      debug: console.debug.bind(console)
    };
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": authToken,
        "X-Service-Name": "unified-agent-sdk"
      }
    });
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`[${this.serviceName}] Request`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        this.logger.error(`[${this.serviceName}] Request Error`, { error: error.message });
        return Promise.reject(error);
      }
    );
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`[${this.serviceName}] Response`, {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error(`[${this.serviceName}] Response Error`, {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
    this.circuitBreaker = new CircuitBreaker(
      async (config) => this.executeRequest(config),
      {
        timeout: this.circuitBreakerOptions.timeout,
        errorThresholdPercentage: this.circuitBreakerOptions.errorThresholdPercentage,
        resetTimeout: this.circuitBreakerOptions.resetTimeout,
        volumeThreshold: this.circuitBreakerOptions.volumeThreshold
      }
    );
    this.circuitBreaker.on("open", () => {
      this.logger.warn(`Circuit breaker OPEN for ${this.serviceName}`);
    });
    this.circuitBreaker.on("halfOpen", () => {
      this.logger.info(`Circuit breaker HALF-OPEN for ${this.serviceName}`);
    });
    this.circuitBreaker.on("close", () => {
      this.logger.info(`Circuit breaker CLOSED for ${this.serviceName}`);
    });
    this.circuitBreaker.on("fallback", () => {
      this.logger.warn(`Circuit breaker fallback triggered for ${this.serviceName}`);
    });
  }
  /**
   * Execute HTTP request with retry logic
   */
  async executeRequest(config) {
    return this.withRetry(async () => {
      const response = await this.httpClient.request({
        ...config,
        timeout: config.timeout || this.timeout
      });
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      };
    });
  }
  /**
   * Execute request through circuit breaker
   */
  async executeWithCircuitBreaker(config) {
    if (this.circuitBreaker.opened) {
      throw new CircuitOpenError(this.serviceName, this.circuitBreaker.stats.failures);
    }
    try {
      const result = await this.circuitBreaker.fire(config);
      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw error;
      }
      throw this.transformError(error, config.url);
    }
  }
  /**
   * Execute GET request
   */
  async get(path, params) {
    return this.executeWithCircuitBreaker({
      method: "GET",
      url: path,
      params
    });
  }
  /**
   * Execute POST request
   */
  async post(path, data) {
    return this.executeWithCircuitBreaker({
      method: "POST",
      url: path,
      data
    });
  }
  /**
   * Execute PUT request
   */
  async put(path, data) {
    return this.executeWithCircuitBreaker({
      method: "PUT",
      url: path,
      data
    });
  }
  /**
   * Execute PATCH request
   */
  async patch(path, data) {
    return this.executeWithCircuitBreaker({
      method: "PATCH",
      url: path,
      data
    });
  }
  /**
   * Execute DELETE request
   */
  async delete(path) {
    return this.executeWithCircuitBreaker({
      method: "DELETE",
      url: path
    });
  }
  /**
   * Retry logic with exponential backoff
   */
  async withRetry(fn) {
    let lastError;
    let delay = this.retryOptions.initialDelay;
    for (let attempt = 1; attempt <= this.retryOptions.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        if (this.circuitBreaker.opened) {
          throw new CircuitOpenError(this.serviceName, this.circuitBreaker.stats.failures);
        }
        if (attempt < this.retryOptions.maxAttempts) {
          const actualDelay = this.retryOptions.jitter ? this.calculateJitterDelay(delay) : delay;
          this.logger.warn(`[${this.serviceName}] Retrying after ${actualDelay}ms`, {
            attempt,
            maxAttempts: this.retryOptions.maxAttempts,
            error: lastError.message
          });
          await this.sleep(actualDelay);
          delay = Math.min(delay * this.retryOptions.factor, this.retryOptions.maxDelay);
        }
      }
    }
    throw new RetryExhaustedError(
      `Failed after ${this.retryOptions.maxAttempts} attempts`,
      this.serviceName,
      this.retryOptions.maxAttempts,
      lastError
    );
  }
  /**
   * Check if error is non-retryable
   */
  isNonRetryableError(error) {
    if (error instanceof CircuitOpenError) {
      return true;
    }
    if (error instanceof SDKError) {
      return true;
    }
    if (error instanceof AxiosError) {
      if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
        if (error.response.status !== 429) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Calculate jitter delay
   */
  calculateJitterDelay(delay) {
    const jitterFactor = 0.5 + randomInt(0, 1e3) / 1e3;
    return Math.floor(delay * jitterFactor);
  }
  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Transform error to SDK error types
   */
  transformError(error, url) {
    if (error instanceof SDKError) {
      return error;
    }
    if (error instanceof AxiosError) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return new TimeoutError(this.serviceName, this.timeout);
      }
      if (error.response?.status === 401) {
        return new ServiceError(
          `Authentication failed for ${this.serviceName}`,
          401,
          this.serviceName
        );
      }
      if (error.response?.status === 403) {
        return new ServiceError(
          `Access denied for ${this.serviceName}`,
          403,
          this.serviceName
        );
      }
      const message = error.response?.data ? typeof error.response.data === "string" ? error.response.data : JSON.stringify(error.response.data) : error.message;
      return new ServiceError(message, error.response?.status || 500, this.serviceName, {
        url,
        originalError: error.message
      });
    }
    return new SDKError(
      error.message || `Unknown error in ${this.serviceName}`,
      "UNKNOWN_ERROR",
      void 0,
      { originalError: error.message }
    );
  }
  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return {
      enabled: true,
      opened: this.circuitBreaker.opened,
      halfOpen: this.circuitBreaker.halfOpen,
      failures: this.circuitBreaker.stats.failures,
      successes: this.circuitBreaker.stats.successes,
      fallbacks: this.circuitBreaker.stats.fallbacks,
      rejects: this.circuitBreaker.stats.rejects
    };
  }
  /**
   * Check service health
   */
  async checkHealth() {
    const start = Date.now();
    try {
      const response = await this.httpClient.get("/health", { timeout: 5e3 });
      const latency = Date.now() - start;
      if (response.status === 200) {
        return {
          status: latency > 1e3 ? "degraded" : "healthy",
          latency
        };
      }
      return { status: "unhealthy", latency, error: `Unexpected status: ${response.status}` };
    } catch (error) {
      const latency = Date.now() - start;
      if (error instanceof AxiosError) {
        if (error.response?.status) {
          return {
            status: "unhealthy",
            latency,
            error: error.message
          };
        }
        return {
          status: "unhealthy",
          latency,
          error: `Connection failed: ${error.message}`
        };
      }
      return {
        status: "unknown",
        latency,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  /**
   * Close connections and cleanup
   */
  async close() {
    this.circuitBreaker.close();
  }
};

// src/connectors/payment.ts
var PaymentConnector = class extends BaseConnector {
  constructor(baseUrl, authToken, options = {}) {
    super("payment-service", baseUrl, authToken, options);
  }
  /**
   * Process a payment
   */
  async processPayment(orderId, amount, method, options) {
    this.logger.info("Processing payment", { orderId, amount, method });
    try {
      const request = {
        orderId,
        amount,
        method,
        options
      };
      const response = await this.post("/payments", request);
      this.logger.info("Payment processed successfully", {
        paymentId: response.data.paymentId,
        orderId
      });
      return response.data;
    } catch (error) {
      this.logger.error("Payment processing failed", {
        orderId,
        amount,
        method,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  /**
   * Get payment status
   */
  async getPayment(paymentId) {
    this.logger.debug("Getting payment status", { paymentId });
    const response = await this.get(`/payments/${paymentId}`);
    return response.data;
  }
  /**
   * Get payment history for a customer
   */
  async getPaymentHistory(customerId, options) {
    this.logger.debug("Getting payment history", { customerId, options });
    const params = {
      customerId
    };
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;
    const response = await this.get("/payments/history", params);
    return response.data;
  }
  /**
   * Initiate a refund
   */
  async refund(request) {
    this.logger.info("Initiating refund", {
      paymentId: request.paymentId,
      amount: request.amount
    });
    const response = await this.post("/refunds", request);
    this.logger.info("Refund initiated", {
      refundId: response.data.refundId,
      paymentId: request.paymentId
    });
    return response.data;
  }
  /**
   * Get refund status
   */
  async getRefund(refundId) {
    this.logger.debug("Getting refund status", { refundId });
    const response = await this.get(`/refunds/${refundId}`);
    return response.data;
  }
  /**
   * Cancel a pending payment
   */
  async cancelPayment(paymentId, reason) {
    this.logger.info("Cancelling payment", { paymentId, reason });
    const response = await this.post(`/payments/${paymentId}/cancel`, {
      reason
    });
    return response.data;
  }
  /**
   * Verify payment signature (for webhook validation)
   */
  async verifySignature(paymentId, signature) {
    this.logger.debug("Verifying payment signature", { paymentId });
    const response = await this.post("/payments/verify", {
      paymentId,
      signature
    });
    return response.data;
  }
  /**
   * Get payment methods available
   */
  async getAvailableMethods() {
    this.logger.debug("Getting available payment methods");
    const response = await this.get("/methods");
    return response.data;
  }
};
function createPaymentConnector(baseUrl, authToken, options) {
  return new PaymentConnector(baseUrl, authToken, options);
}

// src/connectors/wallet.ts
var WalletConnector = class extends BaseConnector {
  constructor(baseUrl, authToken, options = {}) {
    super("wallet-service", baseUrl, authToken, options);
  }
  /**
   * Get wallet balance for a user
   */
  async getBalance(userId) {
    this.logger.debug("Getting wallet balance", { userId });
    const response = await this.get(`/wallets/${userId}/balance`);
    return response.data;
  }
  /**
   * Get wallet summary (credits, debits, etc.)
   */
  async getSummary(userId) {
    this.logger.debug("Getting wallet summary", { userId });
    const response = await this.get(`/wallets/${userId}/summary`);
    return response.data;
  }
  /**
   * Credit wallet
   */
  async credit(request) {
    this.logger.info("Crediting wallet", {
      userId: request.userId,
      amount: request.amount,
      type: request.type
    });
    const response = await this.post("/wallets/credit", request);
    this.logger.info("Wallet credited successfully", {
      transactionId: response.data.transactionId,
      userId: request.userId
    });
    return response.data;
  }
  /**
   * Debit wallet
   */
  async debit(request) {
    this.logger.info("Debiting wallet", {
      userId: request.userId,
      amount: request.amount,
      type: request.type
    });
    const response = await this.post("/wallets/debit", request);
    this.logger.info("Wallet debited successfully", {
      transactionId: response.data.transactionId,
      userId: request.userId
    });
    return response.data;
  }
  /**
   * Transfer between wallets
   */
  async transfer(fromUserId, toUserId, amount, description) {
    this.logger.info("Transferring between wallets", {
      fromUserId,
      toUserId,
      amount
    });
    const response = await this.post("/wallets/transfer", {
      fromUserId,
      toUserId,
      amount,
      description
    });
    this.logger.info("Wallet transfer completed", {
      debitTransactionId: response.data.debitTransaction.transactionId,
      creditTransactionId: response.data.creditTransaction.transactionId
    });
    return response.data;
  }
  /**
   * Get transaction history
   */
  async getTransactions(userId, options) {
    this.logger.debug("Getting transaction history", { userId, options });
    const params = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.type) params.type = options.type;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;
    if (options?.reference) params.reference = options.reference;
    const response = await this.get(
      `/wallets/${userId}/transactions`,
      params
    );
    return response.data;
  }
  /**
   * Get specific transaction
   */
  async getTransaction(transactionId) {
    this.logger.debug("Getting transaction", { transactionId });
    const response = await this.get(`/transactions/${transactionId}`);
    return response.data;
  }
  /**
   * Reverse a transaction
   */
  async reverseTransaction(transactionId, reason) {
    this.logger.info("Reversing transaction", { transactionId, reason });
    const response = await this.post(`/transactions/${transactionId}/reverse`, {
      reason
    });
    this.logger.info("Transaction reversed", { transactionId });
    return response.data;
  }
  /**
   * Check if user has sufficient balance
   */
  async hasSufficientBalance(userId, amount) {
    this.logger.debug("Checking balance", { userId, amount });
    const response = await this.post(
      `/wallets/${userId}/check-balance`,
      { amount }
    );
    return response.data;
  }
  /**
   * Freeze wallet amount
   */
  async freezeAmount(userId, amount, reason) {
    this.logger.info("Freezing wallet amount", { userId, amount, reason });
    const response = await this.post(`/wallets/${userId}/freeze`, {
      amount,
      reason
    });
    return response.data;
  }
  /**
   * Unfreeze wallet amount
   */
  async unfreezeAmount(userId, amount, reason) {
    this.logger.info("Unfreezing wallet amount", { userId, amount, reason });
    const response = await this.post(`/wallets/${userId}/unfreeze`, {
      amount,
      reason
    });
    return response.data;
  }
  /**
   * Create or activate wallet for user
   */
  async ensureWallet(userId) {
    this.logger.debug("Ensuring wallet exists", { userId });
    const response = await this.post("/wallets", { userId });
    return response.data;
  }
};
function createWalletConnector(baseUrl, authToken, options) {
  return new WalletConnector(baseUrl, authToken, options);
}

// src/connectors/order.ts
var OrderConnector = class extends BaseConnector {
  constructor(baseUrl, authToken, options = {}) {
    super("order-service", baseUrl, authToken, options);
  }
  /**
   * Create a new order
   */
  async createOrder(items, request) {
    this.logger.info("Creating order", {
      customerId: request.customerId,
      itemCount: items.length
    });
    const fullRequest = {
      ...request,
      items
    };
    const response = await this.post("/orders", fullRequest);
    this.logger.info("Order created successfully", {
      orderId: response.data.orderId,
      customerId: request.customerId
    });
    return response.data;
  }
  /**
   * Get order by ID
   */
  async getOrder(orderId) {
    this.logger.debug("Getting order", { orderId });
    const response = await this.get(`/orders/${orderId}`);
    return response.data;
  }
  /**
   * Update order
   */
  async updateOrder(orderId, updates) {
    this.logger.info("Updating order", { orderId });
    const response = await this.patch(`/orders/${orderId}`, updates);
    this.logger.info("Order updated successfully", { orderId });
    return response.data;
  }
  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status, metadata) {
    this.logger.info("Updating order status", { orderId, status });
    const response = await this.post(`/orders/${orderId}/status`, {
      status,
      metadata
    });
    this.logger.info("Order status updated", { orderId, status });
    return response.data;
  }
  /**
   * Cancel order
   */
  async cancelOrder(orderId, reason, requestRefund) {
    this.logger.info("Cancelling order", { orderId, reason });
    const response = await this.post(`/orders/${orderId}/cancel`, {
      reason,
      requestRefund
    });
    this.logger.info("Order cancelled", { orderId });
    return response.data;
  }
  /**
   * Get orders for a customer
   */
  async getCustomerOrders(customerId, options) {
    this.logger.debug("Getting customer orders", { customerId, options });
    const params = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;
    const response = await this.get(`/orders/customer/${customerId}`, params);
    return response.data;
  }
  /**
   * Get orders by status
   */
  async getOrdersByStatus(status, options) {
    this.logger.debug("Getting orders by status", { status, options });
    const params = { status };
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    const response = await this.get("/orders", params);
    return response.data;
  }
  /**
   * Add items to order
   */
  async addItems(orderId, items) {
    this.logger.info("Adding items to order", {
      orderId,
      itemCount: items.length
    });
    const response = await this.post(`/orders/${orderId}/items`, { items });
    this.logger.info("Items added to order", { orderId });
    return response.data;
  }
  /**
   * Remove items from order
   */
  async removeItems(orderId, itemIds) {
    this.logger.info("Removing items from order", {
      orderId,
      itemCount: itemIds.length
    });
    const response = await this.delete(`/orders/${orderId}/items`);
    return response.data;
  }
  /**
   * Update shipping address
   */
  async updateShippingAddress(orderId, address) {
    this.logger.info("Updating shipping address", { orderId });
    const response = await this.put(`/orders/${orderId}/shipping`, { address });
    return response.data;
  }
  /**
   * Get order status history
   */
  async getOrderStatusHistory(orderId) {
    this.logger.debug("Getting order status history", { orderId });
    const response = await this.get(`/orders/${orderId}/status-history`);
    return response.data;
  }
  /**
   * Confirm order
   */
  async confirmOrder(orderId, paymentId) {
    this.logger.info("Confirming order", { orderId, paymentId });
    const response = await this.post(`/orders/${orderId}/confirm`, {
      paymentId
    });
    this.logger.info("Order confirmed", { orderId });
    return response.data;
  }
  /**
   * Ship order
   */
  async shipOrder(orderId, trackingInfo) {
    this.logger.info("Shipping order", { orderId, trackingInfo });
    const response = await this.post(`/orders/${orderId}/ship`, {
      trackingInfo
    });
    this.logger.info("Order shipped", { orderId });
    return response.data;
  }
  /**
   * Mark order as delivered
   */
  async deliverOrder(orderId) {
    this.logger.info("Marking order as delivered", { orderId });
    const response = await this.post(`/orders/${orderId}/deliver`);
    this.logger.info("Order delivered", { orderId });
    return response.data;
  }
  /**
   * Calculate order totals
   */
  async calculateTotals(items, shippingAddress) {
    this.logger.debug("Calculating order totals", { itemCount: items.length });
    const response = await this.post("/orders/calculate", {
      items,
      shippingAddress
    });
    return response.data;
  }
};
function createOrderConnector(baseUrl, authToken, options) {
  return new OrderConnector(baseUrl, authToken, options);
}

// src/connectors/booking.ts
var BookingConnector = class extends BaseConnector {
  constructor(baseUrl, authToken, options = {}) {
    super("booking-service", baseUrl, authToken, options);
  }
  /**
   * Create a new booking
   */
  async createBooking(request) {
    this.logger.info("Creating booking", {
      serviceType: request.serviceType,
      serviceId: request.serviceId,
      customerId: request.customerId
    });
    const response = await this.post("/bookings", request);
    this.logger.info("Booking created successfully", {
      bookingId: response.data.bookingId,
      serviceType: request.serviceType
    });
    return response.data;
  }
  /**
   * Get booking by ID
   */
  async getBooking(bookingId) {
    this.logger.debug("Getting booking", { bookingId });
    const response = await this.get(`/bookings/${bookingId}`);
    return response.data;
  }
  /**
   * Search bookings
   */
  async searchBookings(params) {
    this.logger.debug("Searching bookings", params);
    const queryParams = {};
    if (params.serviceType) queryParams.serviceType = params.serviceType;
    if (params.serviceId) queryParams.serviceId = params.serviceId;
    if (params.customerId) queryParams.customerId = params.customerId;
    if (params.status) queryParams.status = params.status;
    if (params.fromDate) queryParams.fromDate = params.fromDate;
    if (params.toDate) queryParams.toDate = params.toDate;
    if (params.page !== void 0) queryParams.page = String(params.page);
    if (params.pageSize !== void 0) queryParams.pageSize = String(params.pageSize);
    const response = await this.get("/bookings/search", queryParams);
    return response.data;
  }
  /**
   * Get bookings by customer
   */
  async getCustomerBookings(customerId, options) {
    this.logger.debug("Getting customer bookings", { customerId, options });
    const params = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.serviceType) params.serviceType = options.serviceType;
    const response = await this.get(
      `/bookings/customer/${customerId}`,
      params
    );
    return response.data;
  }
  /**
   * Cancel booking
   */
  async cancelBooking(bookingId, reason, requestRefund) {
    this.logger.info("Cancelling booking", { bookingId, reason });
    const response = await this.post(`/bookings/${bookingId}/cancel`, {
      reason,
      requestRefund
    });
    this.logger.info("Booking cancelled", { bookingId });
    return response.data;
  }
  /**
   * Confirm booking
   */
  async confirmBooking(bookingId, paymentId) {
    this.logger.info("Confirming booking", { bookingId, paymentId });
    const response = await this.post(`/bookings/${bookingId}/confirm`, {
      paymentId
    });
    this.logger.info("Booking confirmed", { bookingId });
    return response.data;
  }
  /**
   * Modify booking
   */
  async modifyBooking(bookingId, modifications) {
    this.logger.info("Modifying booking", { bookingId, modifications });
    const response = await this.patch(
      `/bookings/${bookingId}`,
      modifications
    );
    this.logger.info("Booking modified", { bookingId });
    return response.data;
  }
  /**
   * Get booking by confirmation code
   */
  async getByConfirmationCode(confirmationCode) {
    this.logger.debug("Getting booking by confirmation code", { confirmationCode });
    const response = await this.get(
      `/bookings/confirmation/${confirmationCode}`
    );
    return response.data;
  }
  /**
   * Get service availability
   */
  async getAvailability(serviceType, serviceId, dateRange, guests) {
    this.logger.debug("Checking availability", { serviceType, serviceId, dateRange });
    const response = await this.post("/bookings/availability", {
      serviceType,
      serviceId,
      dateRange,
      guests
    });
    return response.data;
  }
  /**
   * Check-in for booking
   */
  async checkIn(bookingId, checkInDetails) {
    this.logger.info("Checking in booking", { bookingId });
    const response = await this.post(`/bookings/${bookingId}/check-in`, {
      checkInDetails
    });
    this.logger.info("Booking checked in", { bookingId });
    return response.data;
  }
  /**
   * Check-out from booking
   */
  async checkOut(bookingId, checkOutDetails) {
    this.logger.info("Checking out booking", { bookingId });
    const response = await this.post(`/bookings/${bookingId}/check-out`, {
      checkOutDetails
    });
    this.logger.info("Booking checked out", { bookingId });
    return response.data;
  }
  /**
   * Get booking history
   */
  async getBookingHistory(bookingId) {
    this.logger.debug("Getting booking history", { bookingId });
    const response = await this.get(`/bookings/${bookingId}/history`);
    return response.data;
  }
};
function createBookingConnector(baseUrl, authToken, options) {
  return new BookingConnector(baseUrl, authToken, options);
}

// src/connectors/notification.ts
var NotificationConnector = class extends BaseConnector {
  constructor(baseUrl, authToken, options = {}) {
    super("notification-service", baseUrl, authToken, options);
  }
  /**
   * Send notification
   */
  async send(request) {
    this.logger.info("Sending notification", {
      userId: request.userId,
      template: request.template,
      channel: request.channel
    });
    const fullRequest = {
      userId: request.userId,
      template: request.template,
      channel: Array.isArray(request.channel) ? request.channel : request.channel || "email",
      data: request.data || {},
      priority: request.priority || "normal",
      scheduledAt: request.scheduledAt,
      metadata: request.metadata
    };
    const response = await this.post("/notifications", fullRequest);
    this.logger.info("Notification sent", {
      notificationId: response.data.notificationId,
      userId: request.userId
    });
    return response.data;
  }
  /**
   * Send bulk notifications
   */
  async sendBulk(notifications) {
    this.logger.info("Sending bulk notifications", {
      count: notifications.length
    });
    const response = await this.post("/notifications/bulk", { notifications });
    this.logger.info("Bulk notifications sent", {
      successful: response.data.successful,
      failed: response.data.failed
    });
    return response.data;
  }
  /**
   * Get notification by ID
   */
  async getNotification(notificationId) {
    this.logger.debug("Getting notification", { notificationId });
    const response = await this.get(`/notifications/${notificationId}`);
    return response.data;
  }
  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, options) {
    this.logger.debug("Getting user notifications", { userId, options });
    const params = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.channel) params.channel = options.channel;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;
    const response = await this.get(
      `/notifications/user/${userId}`,
      params
    );
    return response.data;
  }
  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    this.logger.debug("Getting unread notification count", { userId });
    const response = await this.get(
      `/notifications/user/${userId}/unread-count`
    );
    return response.data;
  }
  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    this.logger.debug("Marking notification as read", { notificationId });
    const response = await this.post(
      `/notifications/${notificationId}/read`
    );
    return response.data;
  }
  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId) {
    this.logger.debug("Marking all notifications as read", { userId });
    const response = await this.post(
      `/notifications/user/${userId}/read-all`
    );
    return response.data;
  }
  /**
   * Delete notification
   */
  async deleteNotification(notificationId) {
    this.logger.debug("Deleting notification", { notificationId });
    await this.delete(`/notifications/${notificationId}`);
  }
  /**
   * Get available templates
   */
  async getTemplates() {
    this.logger.debug("Getting notification templates");
    const response = await this.get("/templates");
    return response.data;
  }
  /**
   * Get template by name
   */
  async getTemplate(templateName) {
    this.logger.debug("Getting notification template", { templateName });
    const response = await this.get(`/templates/${templateName}`);
    return response.data;
  }
  /**
   * Preview notification with template
   */
  async previewNotification(templateName, data) {
    this.logger.debug("Previewing notification", { templateName });
    const response = await this.post(
      "/notifications/preview",
      { templateName, data }
    );
    return response.data;
  }
  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId) {
    this.logger.debug("Getting user notification preferences", { userId });
    const response = await this.get(`/preferences/${userId}`);
    return response.data;
  }
  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId, preferences) {
    this.logger.info("Updating user notification preferences", { userId });
    const response = await this.put(`/preferences/${userId}`, preferences);
    return response.data;
  }
  /**
   * Send OTP
   */
  async sendOTP(userId, phone, email, channel = "sms", purpose = "verification") {
    this.logger.info("Sending OTP", { userId, channel, purpose });
    const response = await this.post("/otp/send", {
      userId,
      phone,
      email,
      channel,
      purpose
    });
    return response.data;
  }
  /**
   * Verify OTP
   */
  async verifyOTP(otpId, otp) {
    this.logger.debug("Verifying OTP", { otpId });
    const response = await this.post(
      "/otp/verify",
      { otpId, otp }
    );
    return response.data;
  }
  /**
   * Cancel scheduled notification
   */
  async cancelScheduled(notificationId) {
    this.logger.info("Cancelling scheduled notification", { notificationId });
    await this.post(`/notifications/${notificationId}/cancel`);
  }
  /**
   * Retry failed notification
   */
  async retryFailed(notificationId) {
    this.logger.info("Retrying failed notification", { notificationId });
    const response = await this.post(
      `/notifications/${notificationId}/retry`
    );
    return response.data;
  }
};
function createNotificationConnector(baseUrl, authToken, options) {
  return new NotificationConnector(baseUrl, authToken, options);
}

// src/connectors/analytics.ts
var AnalyticsConnector = class extends BaseConnector {
  constructor(baseUrl, authToken, options = {}) {
    super("analytics-service", baseUrl, authToken, options);
  }
  /**
   * Track an event
   */
  async trackEvent(options) {
    this.logger.debug("Tracking event", {
      event: options.event,
      userId: options.userId
    });
    const request = {
      event: options.event,
      data: options.data || {},
      timestamp: options.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      userId: options.userId,
      sessionId: options.sessionId
    };
    const response = await this.post("/events/track", request);
    return response.data;
  }
  /**
   * Track multiple events
   */
  async trackEvents(events) {
    this.logger.debug("Tracking batch events", { count: events.length });
    const requests = events.map((event) => ({
      event: event.event,
      data: event.data || {},
      timestamp: event.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      userId: event.userId,
      sessionId: event.sessionId
    }));
    const response = await this.post("/events/track/batch", { events: requests });
    return response.data;
  }
  /**
   * Track conversion
   */
  async trackConversion(conversion) {
    this.logger.debug("Tracking conversion", {
      event: conversion.event,
      userId: conversion.userId,
      value: conversion.value
    });
    const response = await this.post("/events/conversion", conversion);
    return response.data;
  }
  /**
   * Update user properties
   */
  async updateUserProperties(update) {
    this.logger.debug("Updating user properties", {
      userId: update.userId,
      propertyCount: Object.keys(update.properties).length
    });
    await this.post("/users/properties", update);
  }
  /**
   * Identify user
   */
  async identifyUser(userId, properties) {
    this.logger.debug("Identifying user", { userId });
    await this.post("/users/identify", {
      userId,
      properties,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  /**
   * Query analytics data
   */
  async query(query) {
    this.logger.debug("Querying analytics", {
      event: query.event,
      fromDate: query.fromDate,
      toDate: query.toDate
    });
    const response = await this.post("/analytics/query", query);
    return response.data;
  }
  /**
   * Get funnel analysis
   */
  async getFunnel(name, steps, fromDate, toDate, filters) {
    this.logger.debug("Getting funnel analysis", {
      name,
      stepCount: steps.length,
      fromDate,
      toDate
    });
    const response = await this.post("/analytics/funnel", {
      name,
      steps,
      fromDate,
      toDate,
      filters
    });
    return response.data;
  }
  /**
   * Get retention analysis
   */
  async getRetention(event, fromDate, toDate, cohortType = "daily") {
    this.logger.debug("Getting retention analysis", {
      event,
      fromDate,
      toDate,
      cohortType
    });
    const response = await this.post("/analytics/retention", {
      event,
      fromDate,
      toDate,
      cohortType
    });
    return response.data;
  }
  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics() {
    this.logger.debug("Getting real-time metrics");
    const response = await this.get("/analytics/realtime");
    return response.data;
  }
  /**
   * Get event counts
   */
  async getEventCounts(event, fromDate, toDate, granularity = "day") {
    this.logger.debug("Getting event counts", {
      event,
      fromDate,
      toDate,
      granularity
    });
    const response = await this.get("/analytics/counts", {
      event,
      fromDate,
      toDate,
      granularity
    });
    return response.data;
  }
  /**
   * Get unique users count
   */
  async getUniqueUsers(fromDate, toDate, event) {
    this.logger.debug("Getting unique users", {
      fromDate,
      toDate,
      event
    });
    const params = { fromDate, toDate };
    if (event) params.event = event;
    const response = await this.get("/analytics/unique-users", params);
    return response.data;
  }
  /**
   * Get dashboard summary
   */
  async getDashboardSummary(fromDate, toDate) {
    this.logger.debug("Getting dashboard summary", { fromDate, toDate });
    const response = await this.get("/analytics/dashboard", { fromDate, toDate });
    return response.data;
  }
  /**
   * Get user timeline
   */
  async getUserTimeline(userId, options) {
    this.logger.debug("Getting user timeline", { userId });
    const params = {};
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;
    if (options?.limit) params.limit = String(options.limit);
    const response = await this.get(`/analytics/users/${userId}/timeline`, params);
    return response.data;
  }
};
function createAnalyticsConnector(baseUrl, authToken, options) {
  return new AnalyticsConnector(baseUrl, authToken, options);
}

// src/connectors/catalog.ts
var CatalogConnector = class extends BaseConnector {
  constructor(baseUrl, authToken, options = {}) {
    super("catalog-service", baseUrl, authToken, options);
  }
  /**
   * Search products
   */
  async searchProducts(filters, options) {
    this.logger.debug("Searching products", { filters, options });
    const params = {};
    if (filters.query) params.query = filters.query;
    if (filters.category) params.category = filters.category;
    if (filters.priceRange) {
      params.minPrice = String(filters.priceRange[0]);
      params.maxPrice = String(filters.priceRange[1]);
    }
    if (filters.rating) params.rating = String(filters.rating);
    if (filters.inStock !== void 0) params.inStock = String(filters.inStock);
    if (filters.tags?.length) params.tags = filters.tags.join(",");
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    const response = await this.get("/products/search", params);
    return response.data;
  }
  /**
   * Get product by ID
   */
  async getProduct(productId) {
    this.logger.debug("Getting product", { productId });
    const response = await this.get(`/products/${productId}`);
    return response.data;
  }
  /**
   * Get products by IDs
   */
  async getProductsByIds(productIds) {
    this.logger.debug("Getting products by IDs", { count: productIds.length });
    const response = await this.post("/products/batch", { ids: productIds });
    return response.data;
  }
  /**
   * Create product
   */
  async createProduct(product) {
    this.logger.info("Creating product", {
      name: product.name,
      price: product.price
    });
    const response = await this.post("/products", product);
    this.logger.info("Product created", { productId: response.data.productId });
    return response.data;
  }
  /**
   * Update product
   */
  async updateProduct(productId, updates) {
    this.logger.info("Updating product", { productId });
    const response = await this.patch(`/products/${productId}`, updates);
    this.logger.info("Product updated", { productId });
    return response.data;
  }
  /**
   * Delete product
   */
  async deleteProduct(productId) {
    this.logger.info("Deleting product", { productId });
    await this.delete(`/products/${productId}`);
    this.logger.info("Product deleted", { productId });
  }
  /**
   * Get all categories
   */
  async getCategories(options) {
    this.logger.debug("Getting categories");
    const params = {};
    if (options?.includeProducts) params.includeProducts = "true";
    const response = await this.get("/categories", params);
    return response.data;
  }
  /**
   * Get category by ID or slug
   */
  async getCategory(identifier) {
    this.logger.debug("Getting category", { identifier });
    const response = await this.get(`/categories/${identifier}`);
    return response.data;
  }
  /**
   * Get products in category
   */
  async getCategoryProducts(categoryId, options) {
    this.logger.debug("Getting category products", { categoryId });
    const params = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.sortBy) params.sortBy = options.sortBy;
    if (options?.sortOrder) params.sortOrder = options.sortOrder;
    const response = await this.get(
      `/categories/${categoryId}/products`,
      params
    );
    return response.data;
  }
  /**
   * Get inventory status
   */
  async getInventoryStatus(productId) {
    this.logger.debug("Getting inventory status", { productId });
    const response = await this.get(`/inventory/${productId}`);
    return response.data;
  }
  /**
   * Update inventory
   */
  async updateInventory(update) {
    this.logger.info("Updating inventory", {
      productId: update.productId,
      quantity: update.quantity,
      reason: update.reason
    });
    const response = await this.post("/inventory/update", update);
    this.logger.info("Inventory updated", { productId: update.productId });
    return response.data;
  }
  /**
   * Reserve inventory
   */
  async reserveInventory(productId, quantity, orderId, expiresIn) {
    this.logger.debug("Reserving inventory", { productId, quantity, orderId });
    const response = await this.post("/inventory/reserve", {
      productId,
      quantity,
      orderId,
      expiresIn
    });
    return response.data;
  }
  /**
   * Release reserved inventory
   */
  async releaseInventory(reservationId, reason) {
    this.logger.debug("Releasing inventory", { reservationId });
    const response = await this.post("/inventory/release", {
      reservationId,
      reason
    });
    return response.data;
  }
  /**
   * Confirm inventory reservation
   */
  async confirmReservation(reservationId) {
    this.logger.debug("Confirming inventory reservation", { reservationId });
    const response = await this.post("/inventory/confirm", {
      reservationId
    });
    return response.data;
  }
  /**
   * Get related products
   */
  async getRelatedProducts(productId, limit) {
    this.logger.debug("Getting related products", { productId });
    const params = {};
    if (limit) params.limit = String(limit);
    const response = await this.get(`/products/${productId}/related`, params);
    return response.data;
  }
  /**
   * Get featured products
   */
  async getFeaturedProducts(category, limit) {
    this.logger.debug("Getting featured products", { category });
    const params = {};
    if (category) params.category = category;
    if (limit) params.limit = String(limit);
    const response = await this.get("/products/featured", params);
    return response.data;
  }
  /**
   * Get new arrivals
   */
  async getNewArrivals(category, limit) {
    this.logger.debug("Getting new arrivals", { category });
    const params = {};
    if (category) params.category = category;
    if (limit) params.limit = String(limit);
    const response = await this.get("/products/new", params);
    return response.data;
  }
  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold) {
    this.logger.debug("Getting low stock products");
    const params = {};
    if (threshold) params.threshold = String(threshold);
    const response = await this.get("/products/low-stock", params);
    return response.data;
  }
  /**
   * Check product availability
   */
  async checkAvailability(productId, quantity) {
    this.logger.debug("Checking availability", { productId, quantity });
    const response = await this.post("/products/availability", {
      productId,
      quantity
    });
    return response.data;
  }
  /**
   * Get product reviews
   */
  async getProductReviews(productId, options) {
    this.logger.debug("Getting product reviews", { productId });
    const params = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.rating) params.rating = String(options.rating);
    const response = await this.get(`/products/${productId}/reviews`, params);
    return response.data;
  }
};
function createCatalogConnector(baseUrl, authToken, options) {
  return new CatalogConnector(baseUrl, authToken, options);
}
var EventBus = class {
  emitter;
  subscriptions = /* @__PURE__ */ new Map();
  logger;
  eventHistory = [];
  maxHistorySize;
  config;
  constructor(config = {}) {
    this.emitter = new EventEmitter();
    this.logger = config.logger || {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.log.bind(console),
      debug: console.debug.bind(console)
    };
    this.maxHistorySize = 1e3;
    this.config = config;
  }
  /**
   * Subscribe to an event type
   */
  on(eventType, handler) {
    const id = `${eventType}:${Date.now()}:${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const subscription = {
      id,
      eventType,
      handler
    };
    this.subscriptions.set(id, subscription);
    this.emitter.on(eventType, this.createHandlerWrapper(eventType, handler));
    this.logger.debug(`Subscribed to event: ${eventType}`, { subscriptionId: id });
    return () => this.off(id);
  }
  /**
   * Subscribe to an event type only once
   */
  once(eventType, handler) {
    const id = `${eventType}:once:${Date.now()}:${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const subscription = {
      id,
      eventType,
      handler
    };
    this.subscriptions.set(id, subscription);
    this.emitter.once(eventType, this.createHandlerWrapper(eventType, handler));
    this.logger.debug(`Subscribed once to event: ${eventType}`, { subscriptionId: id });
    return () => this.off(id);
  }
  /**
   * Subscribe to event pattern (e.g., 'agent.*')
   */
  onPattern(pattern, handler) {
    const id = `pattern:${pattern}:${Date.now()}:${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const subscription = {
      id,
      eventType: pattern,
      handler,
      pattern
    };
    this.subscriptions.set(id, subscription);
    this.emitter.on(pattern, this.createHandlerWrapper(pattern, handler));
    this.logger.debug(`Subscribed to pattern: ${pattern}`, { subscriptionId: id });
    return () => this.off(id);
  }
  /**
   * Unsubscribe by subscription ID
   */
  off(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }
    this.emitter.off(subscription.eventType, this.createHandlerWrapper(subscription.eventType, subscription.handler));
    this.subscriptions.delete(subscriptionId);
    this.logger.debug(`Unsubscribed: ${subscription.eventType}`, { subscriptionId });
    return true;
  }
  /**
   * Publish an event
   */
  async emit(eventType, payload, metadata) {
    const event = {
      type: eventType,
      payload,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata
    };
    this.addToHistory(event);
    this.logger.debug(`Emitting event: ${eventType}`, {
      timestamp: event.timestamp,
      payloadSize: JSON.stringify(payload).length
    });
    try {
      this.emitter.emit(eventType, event);
    } catch (error) {
      this.logger.error(`Error emitting event ${eventType}`, { error });
      throw error;
    }
  }
  /**
   * Get event history
   */
  getHistory(limit) {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }
  /**
   * Get subscriptions count
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }
  /**
   * Get subscriptions for an event type
   */
  getSubscriptions(eventType) {
    const all = Array.from(this.subscriptions.values());
    if (eventType) {
      return all.filter((s) => s.eventType === eventType);
    }
    return all;
  }
  /**
   * Clear all subscriptions
   */
  clear() {
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
    this.logger.info("Event bus cleared");
  }
  /**
   * Remove event from history
   */
  addToHistory(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }
  /**
   * Create handler wrapper with error handling
   */
  createHandlerWrapper(eventType, handler) {
    return async (payload) => {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        this.logger.error(`Error in event handler for ${eventType}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : void 0
        });
      }
    };
  }
};
var EventPublisher = class {
  eventBus;
  logger;
  externalEndpoints;
  useExternal;
  constructor(eventBus, config = {}) {
    this.eventBus = eventBus;
    this.logger = config.logger || {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.log.bind(console),
      debug: console.debug.bind(console)
    };
    this.externalEndpoints = config.endpoints;
    this.useExternal = !!(config.endpoints?.kafka || config.endpoints?.redis || config.endpoints?.nats);
  }
  /**
   * Publish event to both internal bus and external system
   */
  async publish(eventType, payload, options = {}) {
    const fullMetadata = {
      ...options.metadata,
      source: options.source,
      correlationId: options.correlationId,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.eventBus.emit(eventType, payload, fullMetadata);
    if (this.useExternal) {
      await this.publishExternal(eventType, payload, fullMetadata);
    }
    this.logger.debug(`Published event: ${eventType}`, {
      hasExternal: this.useExternal,
      metadata: fullMetadata
    });
  }
  /**
   * Subscribe to events
   */
  on(eventType, handler) {
    return this.eventBus.on(eventType, handler);
  }
  /**
   * Subscribe once
   */
  once(eventType, handler) {
    return this.eventBus.once(eventType, handler);
  }
  /**
   * Subscribe to pattern
   */
  onPattern(pattern, handler) {
    return this.eventBus.onPattern(pattern, handler);
  }
  /**
   * Get event history
   */
  getHistory(limit) {
    return this.eventBus.getHistory(limit);
  }
  /**
   * Publish to external system (Kafka/Redis/NATS)
   */
  async publishExternal(_eventType, _payload, _metadata) {
    this.logger.debug("External event publishing would occur here", {
      kafka: !!this.externalEndpoints?.kafka,
      redis: !!this.externalEndpoints?.redis,
      nats: !!this.externalEndpoints?.nats
    });
  }
};
var AGENT_EVENTS = {
  ACTION_STARTED: "agent.action.started",
  ACTION_COMPLETED: "agent.action.completed",
  ACTION_FAILED: "agent.action.failed",
  INTENT_DETECTED: "agent.intent.detected",
  INTENT_CONFIRMED: "agent.intent.confirmed",
  DECISION_MADE: "agent.decision.made",
  ERROR_OCCURRED: "agent.error.occurred"
};
var PAYMENT_EVENTS = {
  INITIATED: "payment.initiated",
  COMPLETED: "payment.completed",
  FAILED: "payment.failed",
  REFUNDED: "payment.refunded"
};
var ORDER_EVENTS = {
  CREATED: "order.created",
  CONFIRMED: "order.confirmed",
  SHIPPED: "order.shipped",
  DELIVERED: "order.delivered",
  CANCELLED: "order.cancelled"
};
var BOOKING_EVENTS = {
  CREATED: "booking.created",
  CONFIRMED: "booking.confirmed",
  CANCELLED: "booking.cancelled",
  COMPLETED: "booking.completed"
};
var NOTIFICATION_EVENTS = {
  SENT: "notification.sent",
  DELIVERED: "notification.delivered",
  FAILED: "notification.failed"
};
function createEventBus(config) {
  return new EventBus(config);
}
function createEventPublisher(eventBus, config) {
  return new EventPublisher(eventBus, config);
}

// src/sdk.ts
var UnifiedAgentSDK = class {
  config;
  logger;
  eventBus;
  eventPublisher;
  payment = null;
  wallet = null;
  order = null;
  booking = null;
  notification = null;
  analytics = null;
  catalog = null;
  initialized = false;
  constructor(config) {
    this.config = config;
    this.logger = config.logger || createDefaultLogger(config.agentId);
    this.eventBus = createEventBus({ logger: this.logger });
    this.eventPublisher = createEventPublisher(this.eventBus, { logger: this.logger });
    this.logger.info("UnifiedAgentSDK initialized", {
      agentId: config.agentId,
      services: Object.keys(config.services).filter(
        (key) => config.services[key]
      )
    });
  }
  /**
   * Initialize all service connectors
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    this.logger.info("Initializing service connectors");
    const connectorOptions = {
      logger: this.logger,
      timeout: this.config.timeout || DEFAULT_TIMEOUT,
      retry: this.config.retry || DEFAULT_RETRY,
      circuitBreaker: this.config.circuitBreaker || DEFAULT_CIRCUIT_BREAKER
    };
    if (this.config.services.paymentService && this.config.internalTokens.payment) {
      this.payment = new PaymentConnector(
        this.config.services.paymentService,
        this.config.internalTokens.payment,
        connectorOptions
      );
    }
    if (this.config.services.walletService && this.config.internalTokens.wallet) {
      this.wallet = new WalletConnector(
        this.config.services.walletService,
        this.config.internalTokens.wallet,
        connectorOptions
      );
    }
    if (this.config.services.orderService && this.config.internalTokens.order) {
      this.order = new OrderConnector(
        this.config.services.orderService,
        this.config.internalTokens.order,
        connectorOptions
      );
    }
    if (this.config.services.bookingService && this.config.internalTokens.booking) {
      this.booking = new BookingConnector(
        this.config.services.bookingService,
        this.config.internalTokens.booking,
        connectorOptions
      );
    }
    if (this.config.services.notificationService && this.config.internalTokens.notification) {
      this.notification = new NotificationConnector(
        this.config.services.notificationService,
        this.config.internalTokens.notification,
        connectorOptions
      );
    }
    if (this.config.services.analyticsService && this.config.internalTokens.analytics) {
      this.analytics = new AnalyticsConnector(
        this.config.services.analyticsService,
        this.config.internalTokens.analytics,
        connectorOptions
      );
    }
    if (this.config.services.catalogService && this.config.internalTokens.catalog) {
      this.catalog = new CatalogConnector(
        this.config.services.catalogService,
        this.config.internalTokens.catalog,
        connectorOptions
      );
    }
    this.initialized = true;
    this.logger.info("Service connectors initialized");
  }
  // ============================================================================
  // Payment Methods
  // ============================================================================
  /**
   * Process a payment
   */
  async processPayment(orderId, amount, method, options) {
    await this.ensureInitialized();
    if (!this.payment) {
      throw new Error("Payment service not configured");
    }
    await this.publishEvent("payment.initiated", {
      orderId,
      amount,
      method,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    try {
      const result = await this.payment.processPayment(orderId, amount, method, {
        currency: options?.currency || "INR",
        customerEmail: options?.customerEmail,
        customerPhone: options?.customerPhone,
        description: options?.description,
        metadata: options?.metadata
      });
      await this.publishEvent("payment.completed", {
        paymentId: result.paymentId,
        orderId,
        amount,
        status: result.status,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return result;
    } catch (error) {
      await this.publishEvent("payment.failed", {
        orderId,
        amount,
        method,
        error: error instanceof Error ? error.message : String(error),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
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
  async getBalance(userId) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error("Wallet service not configured");
    }
    return this.wallet.getBalance(userId);
  }
  /**
   * Credit wallet
   */
  async creditWallet(request) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error("Wallet service not configured");
    }
    return this.wallet.credit(request);
  }
  /**
   * Debit wallet
   */
  async debitWallet(request) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error("Wallet service not configured");
    }
    return this.wallet.debit(request);
  }
  // ============================================================================
  // Order Methods
  // ============================================================================
  /**
   * Create a new order
   */
  async createOrder(items, options) {
    await this.ensureInitialized();
    if (!this.order) {
      throw new Error("Order service not configured");
    }
    await this.publishEvent("order.created", {
      customerId: options?.customerId,
      itemCount: items.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    try {
      const request = {
        items,
        customerId: options?.customerId || "",
        shippingAddress: options?.shippingAddress,
        billingAddress: options?.billingAddress,
        paymentMethod: options?.paymentMethod,
        metadata: options?.metadata
      };
      const result = await this.order.createOrder(items, request);
      await this.publishEvent("order.confirmed", {
        orderId: result.orderId,
        customerId: result.customerId,
        total: result.total,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return result;
    } catch (error) {
      await this.publishEvent("order.failed", {
        customerId: options?.customerId,
        itemCount: items.length,
        error: error instanceof Error ? error.message : String(error),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      throw error;
    }
  }
  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status) {
    await this.ensureInitialized();
    if (!this.order) {
      throw new Error("Order service not configured");
    }
    const result = await this.order.updateOrderStatus(orderId, status);
    await this.publishEvent("order.status_updated", {
      orderId,
      status,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return result;
  }
  /**
   * Get order by ID
   */
  async getOrder(orderId) {
    await this.ensureInitialized();
    if (!this.order) {
      throw new Error("Order service not configured");
    }
    return this.order.getOrder(orderId);
  }
  // ============================================================================
  // Booking Methods
  // ============================================================================
  /**
   * Create a booking
   */
  async createBooking(request) {
    await this.ensureInitialized();
    if (!this.booking) {
      throw new Error("Booking service not configured");
    }
    await this.publishEvent("booking.created", {
      serviceType: request.serviceType,
      serviceId: request.serviceId,
      customerId: request.customerId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    try {
      const result = await this.booking.createBooking(request);
      await this.publishEvent("booking.confirmed", {
        bookingId: result.bookingId,
        confirmationCode: result.confirmationCode,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return result;
    } catch (error) {
      await this.publishEvent("booking.failed", {
        serviceType: request.serviceType,
        serviceId: request.serviceId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      throw error;
    }
  }
  /**
   * Get booking by ID
   */
  async getBooking(bookingId) {
    await this.ensureInitialized();
    if (!this.booking) {
      throw new Error("Booking service not configured");
    }
    return this.booking.getBooking(bookingId);
  }
  /**
   * Cancel booking
   */
  async cancelBooking(bookingId, reason, requestRefund) {
    await this.ensureInitialized();
    if (!this.booking) {
      throw new Error("Booking service not configured");
    }
    await this.booking.cancelBooking(bookingId, reason, requestRefund);
    await this.publishEvent("booking.cancelled", {
      bookingId,
      reason,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  // ============================================================================
  // Notification Methods
  // ============================================================================
  /**
   * Send notification
   */
  async sendNotification(userId, template, data, options) {
    await this.ensureInitialized();
    if (!this.notification) {
      throw new Error("Notification service not configured");
    }
    const request = {
      userId,
      template,
      data,
      channel: options?.channel,
      priority: options?.priority || "normal",
      scheduledAt: options?.scheduledAt
    };
    return this.notification.send(request);
  }
  // ============================================================================
  // Analytics Methods
  // ============================================================================
  /**
   * Track an event
   */
  async trackEvent(event, data) {
    await this.ensureInitialized();
    if (!this.analytics) {
      throw new Error("Analytics service not configured");
    }
    const options = {
      event,
      data,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    return this.analytics.trackEvent(options);
  }
  /**
   * Identify user
   */
  async identifyUser(userId, properties) {
    await this.ensureInitialized();
    if (!this.analytics) {
      throw new Error("Analytics service not configured");
    }
    await this.analytics.identifyUser(userId, properties);
  }
  // ============================================================================
  // Catalog Methods
  // ============================================================================
  /**
   * Search products
   */
  async searchProducts(filters, options) {
    await this.ensureInitialized();
    if (!this.catalog) {
      throw new Error("Catalog service not configured");
    }
    return this.catalog.searchProducts(filters, options);
  }
  /**
   * Get product by ID
   */
  async getProduct(productId) {
    await this.ensureInitialized();
    if (!this.catalog) {
      throw new Error("Catalog service not configured");
    }
    return this.catalog.getProduct(productId);
  }
  // ============================================================================
  // Event Publishing
  // ============================================================================
  /**
   * Publish an event to the event bus
   */
  async publishEvent(eventType, payload, metadata) {
    try {
      await this.eventPublisher.publish(eventType, payload, {
        source: this.config.agentId,
        metadata
      });
    } catch (error) {
      this.logger.error("Failed to publish event", {
        eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  /**
   * Subscribe to events
   */
  on(eventType, handler) {
    return this.eventPublisher.on(eventType, handler);
  }
  /**
   * Subscribe once
   */
  once(eventType, handler) {
    return this.eventPublisher.once(eventType, handler);
  }
  /**
   * Subscribe to pattern
   */
  onPattern(pattern, handler) {
    return this.eventPublisher.onPattern(pattern, handler);
  }
  /**
   * Get event history
   */
  getEventHistory(limit) {
    return this.eventPublisher.getHistory(limit);
  }
  // ============================================================================
  // Health Checks
  // ============================================================================
  /**
   * Check health of all configured services
   */
  async checkServicesHealth() {
    await this.ensureInitialized();
    const services = {};
    const checks = [];
    const addServiceHealth = async (name, connector) => {
      if (!connector) {
        services[name] = {
          status: "unknown",
          lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
          error: "Service not configured"
        };
        return;
      }
      try {
        const health = await connector.checkHealth();
        services[name] = {
          status: health.status,
          latency: health.latency,
          lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
          error: health.error
        };
      } catch (error) {
        services[name] = {
          status: "unhealthy",
          lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    };
    checks.push(
      addServiceHealth("payment", this.payment),
      addServiceHealth("wallet", this.wallet),
      addServiceHealth("order", this.order),
      addServiceHealth("booking", this.booking),
      addServiceHealth("notification", this.notification),
      addServiceHealth("analytics", this.analytics),
      addServiceHealth("catalog", this.catalog)
    );
    await Promise.all(checks);
    const healthValues = Object.values(services).map((s) => s.status);
    let overall = "healthy";
    if (healthValues.includes("unhealthy")) {
      overall = "unhealthy";
    } else if (healthValues.includes("degraded") || healthValues.includes("unknown")) {
      overall = "degraded";
    }
    return {
      overall,
      services,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Get circuit breaker stats for a service
   */
  getCircuitBreakerStats(service) {
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
      catalog: this.catalog
    };
  }
  get events() {
    return this.eventPublisher;
  }
  get agentId() {
    return this.config.agentId;
  }
  // ============================================================================
  // Lifecycle
  // ============================================================================
  /**
   * Close all connections and cleanup
   */
  async close() {
    this.logger.info("Closing UnifiedAgentSDK");
    const closePromises = [];
    if (this.payment) closePromises.push(this.payment.close());
    if (this.wallet) closePromises.push(this.wallet.close());
    if (this.order) closePromises.push(this.order.close());
    if (this.booking) closePromises.push(this.booking.close());
    if (this.notification) closePromises.push(this.notification.close());
    if (this.analytics) closePromises.push(this.analytics.close());
    if (this.catalog) closePromises.push(this.catalog.close());
    await Promise.all(closePromises);
    this.eventBus.clear();
    this.logger.info("UnifiedAgentSDK closed");
  }
  // ============================================================================
  // Private Methods
  // ============================================================================
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getConnector(service) {
    switch (service) {
      case "payment":
        return this.payment;
      case "wallet":
        return this.wallet;
      case "order":
        return this.order;
      case "booking":
        return this.booking;
      case "notification":
        return this.notification;
      case "analytics":
        return this.analytics;
      case "catalog":
        return this.catalog;
      default:
        return null;
    }
  }
};
function createSDK(config) {
  return new UnifiedAgentSDK(config);
}

export { AGENT_EVENTS, AnalyticsConnector, AuthenticationError, BOOKING_EVENTS, BaseConnector, BookingConnector, BookingServiceTypeSchema, BookingStatusSchema, CatalogConnector, CircuitBreakerOptionsSchema, CircuitOpenError, ConfigBuilder, CreateBookingRequestSchema, CreateOrderRequestSchema, DEFAULT_CIRCUIT_BREAKER, DEFAULT_RETRY, DEFAULT_SERVICE_ENDPOINTS, DEFAULT_TIMEOUT, EventBus, EventPublisher, NOTIFICATION_EVENTS, NotificationChannelSchema, NotificationConnector, NotificationTemplateSchema, ORDER_EVENTS, OrderConnector, OrderStatusSchema, PAYMENT_EVENTS, PaymentConnector, PaymentMethodSchema, PaymentStatusSchema, ProcessPaymentRequestSchema, ProductSearchFiltersSchema, RetryExhaustedError, RetryOptionsSchema, SDKConfigSchema, SDKError, SendNotificationRequestSchema, ServiceError, TimeoutError, TrackEventRequestSchema, UnifiedAgentSDK, ValidationError, WalletConnector, WalletTransactionTypeSchema, createAnalyticsConnector, createBookingConnector, createCatalogConnector, createConfig, createDefaultLogger, createEventBus, createEventPublisher, createNotificationConnector, createOrderConnector, createPaymentConnector, createSDK, createWalletConnector, loadInternalTokens, validateConfig };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map
import winston from 'winston';
import type { Logger, RetryOptions, CircuitBreakerOptions, SDKConfig } from '../types';
import { SDKConfigSchema } from '../types';

// ============================================================================
// Default Configuration Values
// ============================================================================

export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_CIRCUIT_BREAKER: Required<CircuitBreakerOptions> = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 10,
};
export const DEFAULT_RETRY: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5000,
  factor: 2,
  jitter: true,
};

// ============================================================================
// Service Endpoints
// ============================================================================

export interface ServiceEndpoints {
  paymentService?: string;
  walletService?: string;
  orderService?: string;
  bookingService?: string;
  notificationService?: string;
  analyticsService?: string;
  catalogService?: string;
}

export const DEFAULT_SERVICE_ENDPOINTS: ServiceEndpoints = {
  paymentService: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001',
  walletService: process.env.WALLET_SERVICE_URL || 'http://localhost:4002',
  orderService: process.env.ORDER_SERVICE_URL || 'http://localhost:4003',
  bookingService: process.env.BOOKING_SERVICE_URL || 'http://localhost:4004',
  notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005',
  analyticsService: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4006',
  catalogService: process.env.CATALOG_SERVICE_URL || 'http://localhost:4007',
};

// ============================================================================
// Internal Token Configuration
// ============================================================================

export interface InternalTokenConfig {
  payment?: string;
  wallet?: string;
  order?: string;
  booking?: string;
  notification?: string;
  analytics?: string;
  catalog?: string}

export function loadInternalTokens(): InternalTokenConfig {
  const tokens: InternalTokenConfig = {};

  // Try to load from JSON string environment variable
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (tokensJson) {
    try {
      const parsed = JSON.parse(tokensJson);
      Object.assign(tokens, parsed);
    } catch (error) {
      console.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON:', error);
    }
  }

  // Also support individual environment variables
  tokens.payment = tokens.payment || process.env.PAYMENT_SERVICE_TOKEN;
  tokens.wallet = tokens.wallet || process.env.WALLET_SERVICE_TOKEN;
  tokens.order = tokens.order || process.env.ORDER_SERVICE_TOKEN;
  tokens.booking = tokens.booking || process.env.BOOKING_SERVICE_TOKEN;
  tokens.notification = tokens.notification || process.env.NOTIFICATION_SERVICE_TOKEN;
  tokens.analytics = tokens.analytics || process.env.ANALYTICS_SERVICE_TOKEN;
  tokens.catalog = tokens.catalog || process.env.CATALOG_SERVICE_TOKEN;

  return tokens;
}

// ============================================================================
// Logger Configuration
// ============================================================================

export function createDefaultLogger(label?: string): Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }: { timestamp?: string; level: string; message: string; [key: string]: unknown }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          const labelStr = label ? `[${label}] ` : '';
          return `${timestamp} ${level}: ${labelStr}${message} ${metaStr}`;
        }),
      ),
    }),
  ];

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports,
  });

  return {
    error: (message, meta) => logger.error(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    info: (message, meta) => logger.info(message, meta),
    debug: (message, meta) => logger.debug(message, meta),
  };
}

// ============================================================================
// Configuration Validation
// ============================================================================

export function validateConfig(config: unknown): SDKConfig {
  const result = SDKConfigSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues.map(
      (e) => `Field '${e.path.join('.')}' ${e.message}`,
    );
    throw new Error(`SDK Configuration validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}

// ============================================================================
// Config Builder
// ============================================================================

export class ConfigBuilder {
  private config: Partial<SDKConfig> = {};

  withAgentId(agentId: string): this {
    this.config.agentId = agentId;
    return this;
  }

  withInternalTokens(tokens: InternalTokenConfig): this {
    this.config.internalTokens = {
      payment: tokens.payment || '',
      wallet: tokens.wallet || '',
      order: tokens.order || '',
      booking: tokens.booking || '',
      notification: tokens.notification || '',
      analytics: tokens.analytics || '',
      catalog: tokens.catalog || '',
    };
    return this;
  }

  withServices(endpoints: ServiceEndpoints): this {
    this.config.services = {
      paymentService: endpoints.paymentService,
      walletService: endpoints.walletService,
      orderService: endpoints.orderService,
      bookingService: endpoints.bookingService,
      notificationService: endpoints.notificationService,
      analyticsService: endpoints.analyticsService,
      catalogService: endpoints.catalogService,
    };
    return this;
  }

  withTimeout(timeout: number): this {
    this.config.timeout = timeout;
    return this;
  }

  withCircuitBreaker(options: CircuitBreakerOptions): this {
    this.config.circuitBreaker = options;
    return this;
  }

  withRetry(options: RetryOptions): this {
    this.config.retry = options;
    return this;
  }

  build(): SDKConfig {
    // Fill in defaults
    const tokens = this.config.internalTokens || loadInternalTokens();
    const defaults: SDKConfig = {
      agentId: this.config.agentId || 'default-agent',
      internalTokens: {
        ...DEFAULT_SERVICE_ENDPOINTS,
        ...tokens,
      } as Record<string, string>,
      services: this.config.services || DEFAULT_SERVICE_ENDPOINTS,
      timeout: this.config.timeout || DEFAULT_TIMEOUT,
    };

    const merged = { ...defaults, ...this.config };
    return validateConfig(merged);
  }
}

export function createConfig(partial?: Partial<SDKConfig>): SDKConfig {
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

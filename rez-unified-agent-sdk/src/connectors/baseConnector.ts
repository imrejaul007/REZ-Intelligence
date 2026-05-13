import axios, { AxiosInstance, AxiosError } from 'axios';
import CircuitBreaker from 'opossum';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  HttpRequestConfig,
  HttpResponse,
} from '../types';
import {
  SDKError,
  ServiceError,
  CircuitOpenError,
  TimeoutError,
  RetryExhaustedError,
} from '../types';
import { DEFAULT_TIMEOUT, DEFAULT_RETRY, DEFAULT_CIRCUIT_BREAKER } from '../config';

// ============================================================================
// Base Connector
// ============================================================================

export abstract class BaseConnector {
  protected httpClient: AxiosInstance;
  protected logger: Logger;
  protected circuitBreaker: CircuitBreaker;
  protected retryOptions: Required<RetryOptions>;
  protected circuitBreakerOptions: Required<CircuitBreakerOptions>;
  protected serviceName: string;
  protected baseUrl: string;
  protected timeout: number;

  constructor(
    serviceName: string,
    baseUrl: string,
    authToken: string,
    options: {
      logger?: Logger;
      timeout?: number;
      retry?: RetryOptions;
      circuitBreaker?: CircuitBreakerOptions;
    } = {},
  ) {
    this.serviceName = serviceName;
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.retryOptions = { ...DEFAULT_RETRY, ...options.retry };
    this.circuitBreakerOptions = { ...DEFAULT_CIRCUIT_BREAKER, ...options.circuitBreaker };

    this.logger = options.logger || {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.log.bind(console),
      debug: console.debug.bind(console),
    };

    // Create HTTP client with auth header
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': authToken,
        'X-Service-Name': 'unified-agent-sdk',
      },
    });

    // Add request/response logging interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`[${this.serviceName}] Request`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        this.logger.error(`[${this.serviceName}] Request Error`, { error: error.message });
        return Promise.reject(error);
      },
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`[${this.serviceName}] Response`, {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        this.logger.error(`[${this.serviceName}] Response Error`, {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );

    // Setup circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      async (config: HttpRequestConfig) => this.executeRequest(config),
      {
        timeout: this.circuitBreakerOptions.timeout,
        errorThresholdPercentage: this.circuitBreakerOptions.errorThresholdPercentage,
        resetTimeout: this.circuitBreakerOptions.resetTimeout,
        volumeThreshold: this.circuitBreakerOptions.volumeThreshold,
      },
    );

    this.circuitBreaker.on('open', () => {
      this.logger.warn(`Circuit breaker OPEN for ${this.serviceName}`);
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info(`Circuit breaker HALF-OPEN for ${this.serviceName}`);
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info(`Circuit breaker CLOSED for ${this.serviceName}`);
    });

    this.circuitBreaker.on('fallback', () => {
      this.logger.warn(`Circuit breaker fallback triggered for ${this.serviceName}`);
    });
  }

  /**
   * Execute HTTP request with retry logic
   */
  protected async executeRequest<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.withRetry(async () => {
      const response = await this.httpClient.request<unknown>({
        ...config,
        timeout: config.timeout || this.timeout,
      });

      return {
        data: response.data as T,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
      };
    });
  }

  /**
   * Execute request through circuit breaker
   */
  protected async executeWithCircuitBreaker<T>(
    config: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    if (this.circuitBreaker.opened) {
      throw new CircuitOpenError(this.serviceName, this.circuitBreaker.stats.failures);
    }

    try {
      const result = await this.circuitBreaker.fire(config);
      return result as HttpResponse<T>;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw error;
      }
      throw this.transformError(error as Error, config.url);
    }
  }

  /**
   * Execute GET request
   */
  protected async get<T>(path: string, params?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.executeWithCircuitBreaker<T>({
      method: 'GET',
      url: path,
      params,
    });
  }

  /**
   * Execute POST request
   */
  protected async post<T>(path: string, data?: unknown): Promise<HttpResponse<T>> {
    return this.executeWithCircuitBreaker<T>({
      method: 'POST',
      url: path,
      data,
    });
  }

  /**
   * Execute PUT request
   */
  protected async put<T>(path: string, data?: unknown): Promise<HttpResponse<T>> {
    return this.executeWithCircuitBreaker<T>({
      method: 'PUT',
      url: path,
      data,
    });
  }

  /**
   * Execute PATCH request
   */
  protected async patch<T>(path: string, data?: unknown): Promise<HttpResponse<T>> {
    return this.executeWithCircuitBreaker<T>({
      method: 'PATCH',
      url: path,
      data,
    });
  }

  /**
   * Execute DELETE request
   */
  protected async delete<T>(path: string): Promise<HttpResponse<T>> {
    return this.executeWithCircuitBreaker<T>({
      method: 'DELETE',
      url: path,
    });
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.retryOptions.initialDelay;

    for (let attempt = 1; attempt <= this.retryOptions.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.isNonRetryableError(error as Error)) {
          throw error;
        }

        // Check if circuit is open
        if (this.circuitBreaker.opened) {
          throw new CircuitOpenError(this.serviceName, this.circuitBreaker.stats.failures);
        }

        // If not last attempt, wait before retrying
        if (attempt < this.retryOptions.maxAttempts) {
          const actualDelay = this.retryOptions.jitter
            ? this.calculateJitterDelay(delay)
            : delay;

          this.logger.warn(`[${this.serviceName}] Retrying after ${actualDelay}ms`, {
            attempt,
            maxAttempts: this.retryOptions.maxAttempts,
            error: lastError.message,
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
      lastError!,
    );
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    if (error instanceof CircuitOpenError) {
      return true;
    }

    if (error instanceof SDKError) {
      return true;
    }

    if (error instanceof AxiosError) {
      // Don't retry on client errors (4xx)
      if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
        // Except 429 (Too Many Requests) which is retryable
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
  private calculateJitterDelay(delay: number): number {
    const jitterFactor = 0.5 + Math.random();
    return Math.floor(delay * jitterFactor);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Transform error to SDK error types
   */
  private transformError(error: Error, url?: string): SDKError {
    if (error instanceof SDKError) {
      return error;
    }

    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return new TimeoutError(this.serviceName, this.timeout);
      }

      if (error.response?.status === 401) {
        return new ServiceError(
          `Authentication failed for ${this.serviceName}`,
          401,
          this.serviceName,
        );
      }

      if (error.response?.status === 403) {
        return new ServiceError(
          `Access denied for ${this.serviceName}`,
          403,
          this.serviceName,
        );
      }

      const message = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data)
        : error.message;

      return new ServiceError(message, error.response?.status || 500, this.serviceName, {
        url,
        originalError: error.message,
      });
    }

    return new SDKError(
      error.message || `Unknown error in ${this.serviceName}`,
      'UNKNOWN_ERROR',
      undefined,
      { originalError: error.message },
    );
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats(): {
    enabled: boolean;
    opened: boolean;
    halfOpen: boolean;
    failures: number;
    successes: number;
    fallbacks: number;
    rejects: number;
  } {
    return {
      enabled: true,
      opened: this.circuitBreaker.opened,
      halfOpen: this.circuitBreaker.halfOpen,
      failures: this.circuitBreaker.stats.failures,
      successes: this.circuitBreaker.stats.successes,
      fallbacks: this.circuitBreaker.stats.fallbacks,
      rejects: this.circuitBreaker.stats.rejects,
    };
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'; latency?: number; error?: string }> {
    const start = Date.now();

    try {
      const response = await this.httpClient.get('/health', { timeout: 5000 });
      const latency = Date.now() - start;

      if (response.status === 200) {
        return {
          status: latency > 1000 ? 'degraded' : 'healthy',
          latency,
        };
      }

      return { status: 'unhealthy', latency, error: `Unexpected status: ${response.status}` };
    } catch (error) {
      const latency = Date.now() - start;

      if (error instanceof AxiosError) {
        if (error.response?.status) {
          return {
            status: 'unhealthy',
            latency,
            error: error.message,
          };
        }

        // Network error
        return {
          status: 'unhealthy',
          latency,
          error: `Connection failed: ${error.message}`,
        };
      }

      return {
        status: 'unknown',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close connections and cleanup
   */
  async close(): Promise<void> {
    this.circuitBreaker.close();
    // axios doesn't have a close method, connections are released when request completes
  }
}

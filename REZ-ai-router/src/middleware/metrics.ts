/**
 * Metrics Middleware - Observability Layer for AI Router
 *
 * Provides comprehensive metrics collection and exposure:
 * - Token usage metrics
 * - Cost tracking metrics
 * - Latency histograms
 * - Error rates
 * - Prometheus-compatible endpoints
 *
 * Usage:
 * import { metricsMiddleware, metricsCollector } from './middleware/metrics';
 *
 * // In Express app:
 * app.use(metricsMiddleware);
 *
 * // Expose metrics endpoint:
 * app.get('/metrics', metricsEndpoint);
 */

import { Request, Response, NextFunction } from 'express';
import { AIProvider, ModelTier } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface TokenMetrics {
  total: number;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  byUser: Record<string, number>;
}

export interface CostMetrics {
  totalUSD: number;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  byUser: Record<string, number>;
  dailyBudgetUSD: number;
  dailyBudgetUsed: number;
}

export interface LatencyMetrics {
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  byModel: Record<string, LatencyBucket>;
  byProvider: Record<string, LatencyBucket>;
}

export interface LatencyBucket {
  count: number;
  sumMs: number;
  minMs: number;
  maxMs: number;
  buckets: Record<string, number>;
}

export interface ErrorMetrics {
  total: number;
  byType: Record<string, number>;
  byProvider: Record<string, number>;
  rate: number;
}

export interface RateLimitMetrics {
  total: number;
  rejected: number;
  byUser: Record<string, number>;
}

export interface CircuitBreakerMetrics {
  byProvider: Record<string, {
    state: string;
    failures: number;
    lastFailure: number;
  }>;
  totalTrips: number;
}

export interface ComprehensiveMetrics {
  timestamp: number;
  uptime: number;
  tokenMetrics: TokenMetrics;
  costMetrics: CostMetrics;
  latencyMetrics: LatencyMetrics;
  errorMetrics: ErrorMetrics;
  rateLimitMetrics: RateLimitMetrics;
  circuitBreakerMetrics: CircuitBreakerMetrics;
  requestMetrics: {
    total: number;
    success: number;
    fallback: number;
    error: number;
  };
}

export interface MetricsConfig {
  histogramBuckets: number[];
  maxLatencySamples: number;
  maxErrorSamples: number;
  enablePrometheusFormat: boolean;
}

// ============================================================================
// HISTOGRAM IMPLEMENTATION
// ============================================================================

class Histogram {
  private buckets: Map<number, number> = new Map();
  private _count = 0;
  private _sum = 0;
  private values: number[] = [];
  private maxSamples: number;

  constructor(buckets: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000], maxSamples = 10000) {
    this.maxSamples = maxSamples;
    buckets.forEach(b => this.buckets.set(b, 0));
    this.buckets.set(Infinity, 0);
  }

  observe(value: number): void {
    this._count++;
    this._sum += value;
    this.values.push(value);

    // Keep values array bounded
    if (this.values.length > this.maxSamples) {
      this.values.shift();
    }

    // Increment bucket
    for (const [threshold, count] of this.buckets) {
      if (value <= threshold) {
        this.buckets.set(threshold, count + 1);
        break;
      }
    }
  }

  get count(): number { return this._count; }
  get sum(): number { return this._sum; }

  getPercentile(p: number): number {
    if (this.values.length === 0) return 0;

    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[index] || 0;
  }

  getStats(): { avg: number; min: number; max: number; p50: number; p95: number; p99: number } {
    return {
      avg: this._count > 0 ? this._sum / this._count : 0,
      min: this.values.length > 0 ? Math.min(...this.values) : 0,
      max: this.values.length > 0 ? Math.max(...this.values) : 0,
      p50: this.getPercentile(0.5),
      p95: this.getPercentile(0.95),
      p99: this.getPercentile(0.99),
    };
  }

  getHistogram(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [threshold, count] of this.buckets) {
      if (threshold === Infinity) {
        result['+Inf'] = count;
      } else {
        result[`<=${threshold}`] = count;
      }
    }
    return result;
  }
}

// ============================================================================
// METRICS COLLECTOR
// ============================================================================

class MetricsCollector {
  private startTime: number;
  private tokenMetrics: TokenMetrics = {
    total: 0,
    byModel: {},
    byProvider: {},
    byUser: {},
  };
  private costMetrics: CostMetrics = {
    totalUSD: 0,
    byModel: {},
    byProvider: {},
    byUser: {},
    dailyBudgetUSD: 100,
    dailyBudgetUsed: 0,
  };
  private latencyHistogram: Histogram;
  private errorHistogram: Histogram;
  private errorMetrics: ErrorMetrics = {
    total: 0,
    byType: {},
    byProvider: {},
    rate: 0,
  };
  private rateLimitMetrics: RateLimitMetrics = {
    total: 0,
    rejected: 0,
    byUser: {},
  };
  private circuitBreakerMetrics: CircuitBreakerMetrics = {
    byProvider: {},
    totalTrips: 0,
  };
  private requestMetrics = {
    total: 0,
    success: 0,
    fallback: 0,
    error: 0,
  };
  private latencyByModel: Map<string, Histogram> = new Map();
  private latencyByProvider: Map<string, Histogram> = new Map();

  constructor(config?: Partial<MetricsConfig>) {
    this.startTime = Date.now();
    this.latencyHistogram = new Histogram(config?.histogramBuckets || [
      10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
    ]);
    this.errorHistogram = new Histogram(config?.histogramBuckets || [
      1, 5, 10, 25, 50, 100, 250, 500
    ]);
  }

  /**
   * Record token usage
   */
  recordTokens(params: {
    model: string;
    provider: string;
    userId?: string;
    promptTokens: number;
    completionTokens: number;
  }): void {
    const { model, provider, userId, promptTokens, completionTokens } = params;
    const total = promptTokens + completionTokens;

    this.tokenMetrics.total += total;
    this.tokenMetrics.byModel[model] = (this.tokenMetrics.byModel[model] || 0) + total;
    this.tokenMetrics.byProvider[provider] = (this.tokenMetrics.byProvider[provider] || 0) + total;

    if (userId) {
      this.tokenMetrics.byUser[userId] = (this.tokenMetrics.byUser[userId] || 0) + total;
    }
  }

  /**
   * Record cost
   */
  recordCost(params: {
    model: string;
    provider: string;
    userId?: string;
    costUSD: number;
  }): void {
    const { model, provider, userId, costUSD } = params;

    this.costMetrics.totalUSD += costUSD;
    this.costMetrics.dailyBudgetUsed += costUSD;
    this.costMetrics.byModel[model] = (this.costMetrics.byModel[model] || 0) + costUSD;
    this.costMetrics.byProvider[provider] = (this.costMetrics.byProvider[provider] || 0) + costUSD;

    if (userId) {
      this.costMetrics.byUser[userId] = (this.costMetrics.byUser[userId] || 0) + costUSD;
    }
  }

  /**
   * Record latency
   */
  recordLatency(params: {
    model: string;
    provider: string;
    latencyMs: number;
    status: string;
  }): void {
    const { model, provider, latencyMs } = params;

    this.latencyHistogram.observe(latencyMs);

    // Per-model histogram
    if (!this.latencyByModel.has(model)) {
      this.latencyByModel.set(model, new Histogram());
    }
    this.latencyByModel.get(model)!.observe(latencyMs);

    // Per-provider histogram
    if (!this.latencyByProvider.has(provider)) {
      this.latencyByProvider.set(provider, new Histogram());
    }
    this.latencyByProvider.get(provider)!.observe(latencyMs);
  }

  /**
   * Record error
   */
  recordError(params: {
    type: string;
    provider?: string;
    isTimeout?: boolean;
  }): void {
    const { type, provider } = params;

    this.errorMetrics.total++;
    this.errorMetrics.byType[type] = (this.errorMetrics.byType[type] || 0) + 1;
    this.errorMetrics.rate = this.requestMetrics.total > 0
      ? this.errorMetrics.total / this.requestMetrics.total
      : 0;

    if (provider) {
      this.errorMetrics.byProvider[provider] = (this.errorMetrics.byProvider[provider] || 0) + 1;
    }

    this.requestMetrics.error++;
  }

  /**
   * Record fallback
   */
  recordFallback(): void {
    this.requestMetrics.fallback++;
  }

  /**
   * Record success
   */
  recordSuccess(): void {
    this.requestMetrics.success++;
  }

  /**
   * Record request
   */
  recordRequest(): void {
    this.requestMetrics.total++;
  }

  /**
   * Record rate limit
   */
  recordRateLimit(userId?: string): void {
    this.rateLimitMetrics.total++;
    this.rateLimitMetrics.rejected++;

    if (userId) {
      this.rateLimitMetrics.byUser[userId] = (this.rateLimitMetrics.byUser[userId] || 0) + 1;
    }
  }

  /**
   * Record circuit breaker trip
   */
  recordCircuitTrip(provider: string): void {
    this.circuitBreakerMetrics.totalTrips++;
    if (!this.circuitBreakerMetrics.byProvider[provider]) {
      this.circuitBreakerMetrics.byProvider[provider] = {
        state: 'CLOSED',
        failures: 0,
        lastFailure: 0,
      };
    }
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitState(provider: string, state: string, failures: number, lastFailure: number): void {
    this.circuitBreakerMetrics.byProvider[provider] = {
      state,
      failures,
      lastFailure,
    };
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): ComprehensiveMetrics {
    const latencyStats = this.latencyHistogram.getStats();
    const latencyByModel: Record<string, LatencyBucket> = {};
    const latencyByProvider: Record<string, LatencyBucket> = {};

    for (const [model, histogram] of this.latencyByModel) {
      const stats = histogram.getStats();
      latencyByModel[model] = {
        count: histogram.count,
        sumMs: histogram.sum,
        minMs: stats.min,
        maxMs: stats.max,
        buckets: histogram.getHistogram(),
      };
    }

    for (const [provider, histogram] of this.latencyByProvider) {
      const stats = histogram.getStats();
      latencyByProvider[provider] = {
        count: histogram.count,
        sumMs: histogram.sum,
        minMs: stats.min,
        maxMs: stats.max,
        buckets: histogram.getHistogram(),
      };
    }

    return {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      tokenMetrics: { ...this.tokenMetrics },
      costMetrics: { ...this.costMetrics },
      latencyMetrics: {
        avgMs: latencyStats.avg,
        p50Ms: latencyStats.p50,
        p95Ms: latencyStats.p95,
        p99Ms: latencyStats.p99,
        byModel: latencyByModel,
        byProvider: latencyByProvider,
      },
      errorMetrics: { ...this.errorMetrics },
      rateLimitMetrics: { ...this.rateLimitMetrics },
      circuitBreakerMetrics: { ...this.circuitBreakerMetrics },
      requestMetrics: { ...this.requestMetrics },
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // Header
    lines.push('# HELP ai_router_uptime AI Router uptime in milliseconds');
    lines.push('# TYPE ai_router_uptime gauge');
    lines.push(`ai_router_uptime ${metrics.uptime}`);

    lines.push('# HELP ai_router_requests_total Total number of requests');
    lines.push('# TYPE ai_router_requests_total counter');
    lines.push(`ai_router_requests_total ${metrics.requestMetrics.total}`);

    lines.push('# HELP ai_router_requests_success_total Successful requests');
    lines.push('# TYPE ai_router_requests_success_total counter');
    lines.push(`ai_router_requests_success_total ${metrics.requestMetrics.success}`);

    lines.push('# HELP ai_router_requests_fallback_total Requests that used fallback');
    lines.push('# TYPE ai_router_requests_fallback_total counter');
    lines.push(`ai_router_requests_fallback_total ${metrics.requestMetrics.fallback}`);

    lines.push('# HELP ai_router_requests_error_total Failed requests');
    lines.push('# TYPE ai_router_requests_error_total counter');
    lines.push(`ai_router_requests_error_total ${metrics.requestMetrics.error}`);

    lines.push('# HELP ai_router_tokens_total Total tokens processed');
    lines.push('# TYPE ai_router_tokens_total counter');
    lines.push(`ai_router_tokens_total ${metrics.tokenMetrics.total}`);

    lines.push('# HELP ai_router_tokens_by_model Tokens by model');
    lines.push('# TYPE ai_router_tokens_by_model gauge');
    for (const [model, count] of Object.entries(metrics.tokenMetrics.byModel)) {
      lines.push(`ai_router_tokens_by_model{model="${model}"} ${count}`);
    }

    lines.push('# HELP ai_router_cost_total_usd Total cost in USD');
    lines.push('# TYPE ai_router_cost_total_usd gauge');
    lines.push(`ai_router_cost_total_usd ${metrics.costMetrics.totalUSD.toFixed(6)}`);

    lines.push('# HELP ai_router_cost_by_model Cost by model in USD');
    lines.push('# TYPE ai_router_cost_by_model gauge');
    for (const [model, cost] of Object.entries(metrics.costMetrics.byModel)) {
      lines.push(`ai_router_cost_by_model{model="${model}"} ${cost.toFixed(6)}`);
    }

    lines.push('# HELP ai_router_latency_ms Latency in milliseconds');
    lines.push('# TYPE ai_router_latency_ms summary');
    lines.push(`ai_router_latency_ms{quantile="0.5"} ${metrics.latencyMetrics.p50Ms}`);
    lines.push(`ai_router_latency_ms{quantile="0.95"} ${metrics.latencyMetrics.p95Ms}`);
    lines.push(`ai_router_latency_ms{quantile="0.99"} ${metrics.latencyMetrics.p99Ms}`);

    lines.push('# HELP ai_router_latency_avg_ms Average latency in milliseconds');
    lines.push('# TYPE ai_router_latency_avg_ms gauge');
    lines.push(`ai_router_latency_avg_ms ${metrics.latencyMetrics.avgMs.toFixed(2)}`);

    lines.push('# HELP ai_router_errors_total Total errors');
    lines.push('# TYPE ai_router_errors_total counter');
    lines.push(`ai_router_errors_total ${metrics.errorMetrics.total}`);

    lines.push('# HELP ai_router_error_rate Error rate');
    lines.push('# TYPE ai_router_error_rate gauge');
    lines.push(`ai_router_error_rate ${metrics.errorMetrics.rate.toFixed(6)}`);

    lines.push('# HELP ai_router_rate_limit_total Rate limit checks');
    lines.push('# TYPE ai_router_rate_limit_total counter');
    lines.push(`ai_router_rate_limit_total ${metrics.rateLimitMetrics.total}`);

    lines.push('# HELP ai_router_rate_limit_rejected Rate limit rejections');
    lines.push('# TYPE ai_router_rate_limit_rejected counter');
    lines.push(`ai_router_rate_limit_rejected ${metrics.rateLimitMetrics.rejected}`);

    lines.push('# HELP ai_router_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)');
    lines.push('# TYPE ai_router_circuit_breaker_state gauge');
    for (const [provider, data] of Object.entries(metrics.circuitBreakerMetrics.byProvider)) {
      const stateValue = data.state === 'CLOSED' ? 0 : data.state === 'OPEN' ? 1 : 2;
      lines.push(`ai_router_circuit_breaker_state{provider="${provider}"} ${stateValue}`);
    }

    lines.push('# HELP ai_router_circuit_breaker_trips_total Circuit breaker trips');
    lines.push('# TYPE ai_router_circuit_breaker_trips_total counter');
    lines.push(`ai_router_circuit_breaker_trips_total ${metrics.circuitBreakerMetrics.totalTrips}`);

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.tokenMetrics = { total: 0, byModel: {}, byProvider: {}, byUser: {} };
    this.costMetrics = { totalUSD: 0, byModel: {}, byProvider: {}, byUser: {}, dailyBudgetUSD: 100, dailyBudgetUsed: 0 };
    this.errorMetrics = { total: 0, byType: {}, byProvider: {}, rate: 0 };
    this.rateLimitMetrics = { total: 0, rejected: 0, byUser: {} };
    this.circuitBreakerMetrics = { byProvider: {}, totalTrips: 0 };
    this.requestMetrics = { total: 0, success: 0, fallback: 0, error: 0 };
    this.startTime = Date.now();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const metricsCollector = new MetricsCollector();

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Add timing header
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  // Track request metrics
  metricsCollector.recordRequest();

  next();
}

// ============================================================================
// METRICS ENDPOINTS
// ============================================================================

/**
 * JSON metrics endpoint
 */
export async function metricsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const metrics = metricsCollector.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
}

/**
 * Prometheus format metrics endpoint
 */
export async function prometheusMetricsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(metricsCollector.getPrometheusMetrics());
  } catch (error) {
    res.status(500).send('# Error getting metrics');
  }
}

/**
 * Health check endpoint with basic metrics
 */
export async function healthEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const metrics = metricsCollector.getMetrics();
    const healthy = metrics.requestMetrics.total === 0 ||
      (metrics.requestMetrics.success / metrics.requestMetrics.total) > 0.9;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      uptime: metrics.uptime,
      requests: {
        total: metrics.requestMetrics.total,
        success: metrics.requestMetrics.success,
        fallback: metrics.requestMetrics.fallback,
        error: metrics.requestMetrics.error,
      },
      errorRate: metrics.errorMetrics.rate,
      avgLatency: metrics.latencyMetrics.avgMs,
    });
  } catch (error) {
    res.status(500).json({ status: 'error' });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Wrap a function to automatically record metrics
 */
export function withMetrics<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: { model?: string; provider?: string; userId?: string }
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    const startTime = Date.now();

    try {
      const result = fn(...args) as ReturnType<T>;

      // If async, handle promise
      if (result instanceof Promise) {
        return result.then((value) => {
          metricsCollector.recordLatency({
            model: options?.model || 'unknown',
            provider: options?.provider || 'unknown',
            latencyMs: Date.now() - startTime,
            status: 'success',
          });
          metricsCollector.recordSuccess();
          return value;
        }).catch((error) => {
          metricsCollector.recordLatency({
            model: options?.model || 'unknown',
            provider: options?.provider || 'unknown',
            latencyMs: Date.now() - startTime,
            status: 'error',
          });
          metricsCollector.recordError({ type: error.name || 'Error', provider: options?.provider });
          throw error;
        }) as ReturnType<T>;
      }

      metricsCollector.recordLatency({
        model: options?.model || 'unknown',
        provider: options?.provider || 'unknown',
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
      metricsCollector.recordSuccess();
      return result;
    } catch (error) {
      metricsCollector.recordLatency({
        model: options?.model || 'unknown',
        provider: options?.provider || 'unknown',
        latencyMs: Date.now() - startTime,
        status: 'error',
      });
      metricsCollector.recordError({
        type: error instanceof Error ? error.name : 'Error',
        provider: options?.provider,
      });
      throw error;
    }
  };
}

/**
 * Create metrics recording hooks for AIRouter
 */
export function createAIRouterMetricsHooks() {
  return {
    onRequest: (params: { model: string; provider: string; userId?: string }) => {
      return {
        onTokens: (promptTokens: number, completionTokens: number) => {
          metricsCollector.recordTokens({
            ...params,
            promptTokens,
            completionTokens,
          });
        },
        onCost: (costUSD: number) => {
          metricsCollector.recordCost({
            ...params,
            costUSD,
          });
        },
        onLatency: (latencyMs: number, status: string) => {
          metricsCollector.recordLatency({
            ...params,
            latencyMs,
            status,
          });
        },
        onSuccess: () => {
          metricsCollector.recordSuccess();
        },
        onError: (errorType: string) => {
          metricsCollector.recordError({
            ...params,
            type: errorType,
          });
        },
        onFallback: () => {
          metricsCollector.recordFallback();
        },
      };
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MetricsCollector, Histogram };

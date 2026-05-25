/**
 * Prometheus Metrics Middleware
 *
 * Provides observability for the predictive engine with:
 * - HTTP request metrics (latency, status codes, throughput)
 * - Prediction metrics (churn, LTV, etc.)
 * - Cache hit/miss metrics
 * - Error rates
 */

import { Request, Response, NextFunction } from 'express';

// Metrics storage (in-memory for simplicity, use Redis for distributed)
interface Counter {
  value: number;
  labels: Record<string, string>;
}

interface Histogram {
  count: number;
  sum: number;
  buckets: Record<number, number>;
}

interface Gauge {
  value: number;
  labels: Record<string, string>;
}

// Metric storage
const counters: Map<string, Counter> = new Map();
const histograms: Map<string, Histogram> = new Map();
const gauges: Map<string, Gauge> = new Map();

// Histogram buckets for latency (in ms)
const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Generate metric name with labels
 */
function metricKey(name: string, labels: Record<string, string> = {}): string {
  const sortedLabels = Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
  return sortedLabels ? `${name}{${sortedLabels}}` : name;
}

/**
 * Increment a counter
 */
export function incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
  const key = metricKey(name, labels);
  const existing = counters.get(key);
  if (existing) {
    existing.value += value;
  } else {
    counters.set(key, { value, labels });
  }
}

/**
 * Observe a value in a histogram
 */
export function observeHistogram(name: string, labels: Record<string, string>, value: number): void {
  const key = metricKey(name, labels);
  const existing = histograms.get(key);

  if (existing) {
    existing.count++;
    existing.sum += value;
    for (const bucket of LATENCY_BUCKETS) {
      if (value <= bucket) {
        existing.buckets[bucket]++;
      }
    }
  } else {
    const buckets: Record<number, number> = {};
    for (const bucket of LATENCY_BUCKETS) {
      buckets[bucket] = value <= bucket ? 1 : 0;
    }
    histograms.set(key, { count: 1, sum: value, buckets });
  }
}

/**
 * Set a gauge value
 */
export function setGauge(name: string, labels: Record<string, string>, value: number): void {
  const key = metricKey(name, labels);
  gauges.set(key, { value, labels });
}

/**
 * Get gauge value
 */
export function getGauge(name: string, labels: Record<string, string> = {}): number | undefined {
  const key = metricKey(name, labels);
  return gauges.get(key)?.value;
}

/**
 * Generate Prometheus text format output
 */
export function generatePrometheusMetrics(): string {
  const lines: string[] = [];

  // Add counters
  lines.push('# HELP rez_predictions_total Total number of predictions');
  lines.push('# TYPE rez_predictions_total counter');
  for (const [key, counter] of counters) {
    const name = key.replace(/\{.*/, '');
    lines.push(`rez_predictions_total${key.substring(key.indexOf('{')),} ${counter.value}`);
  }

  // Add histograms
  lines.push('');
  lines.push('# HELP rez_prediction_latency_seconds Prediction latency in seconds');
  lines.push('# TYPE rez_prediction_latency_seconds histogram');
  for (const [key, hist] of histograms) {
    const name = key.replace(/\{.*/, '');
    const labelPart = key.includes('{') ? key.substring(key.indexOf('{')) : '';

    for (const [bucket, count] of Object.entries(hist.buckets)) {
      lines.push(`rez_prediction_latency_seconds_bucket${labelPart} le="${bucket}" ${count}`);
    }
    lines.push(`rez_prediction_latency_seconds_bucket${labelPart} le="+Inf" ${hist.count}`);
    lines.push(`rez_prediction_latency_seconds_sum${labelPart} ${(hist.sum / 1000).toFixed(6)}`);
    lines.push(`rez_prediction_latency_seconds_count${labelPart} ${hist.count}`);
  }

  // Add gauges
  lines.push('');
  lines.push('# HELP rez_active_predictions Current number of active predictions');
  lines.push('# TYPE rez_active_predictions gauge');
  for (const [key, gauge] of gauges) {
    const name = key.replace(/\{.*/, '');
    const labelPart = key.includes('{') ? key.substring(key.indexOf('{')) : '';
    lines.push(`rez_active_predictions${labelPart} ${gauge.value}`);
  }

  return lines.join('\n');
}

/**
 * Request timing middleware
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode.toString(),
    };

    // HTTP request metrics
    incrementCounter('http_requests_total', labels);
    observeHistogram('http_request_duration_ms', labels, durationMs);

    // Error rate tracking
    if (res.statusCode >= 400) {
      incrementCounter('http_errors_total', { ...labels, error_type: getErrorType(res.statusCode) });
    }
  });

  next();
}

/**
 * Get error type from status code
 */
function getErrorType(statusCode: number): string {
  if (statusCode === 400) return 'bad_request';
  if (statusCode === 401) return 'unauthorized';
  if (statusCode === 403) return 'forbidden';
  if (statusCode === 404) return 'not_found';
  if (statusCode === 429) return 'rate_limited';
  if (statusCode >= 500) return 'server_error';
  return 'client_error';
}

/**
 * Prediction metrics helper
 */
export const predictionMetrics = {
  /**
   * Record a churn prediction
   */
  recordChurn(userId: string, score: number, risk: string, method: string, durationMs: number): void {
    const labels = { risk, method };
    incrementCounter('predictions_churn_total', labels);
    observeHistogram('prediction_latency_ms', { type: 'churn', method }, durationMs);
    observeHistogram('churn_score_distribution', { risk }, score);

    // Track prediction by risk level
    setGauge('predictions_last_risk_count', { risk }, getGauge('predictions_last_risk_count', { risk }) || 0 + 1);
  },

  /**
   * Record an LTV prediction
   */
  recordLTV(userId: string, ltv365: number, tier: string, method: string, durationMs: number): void {
    const labels = { tier, method };
    incrementCounter('predictions_ltv_total', labels);
    observeHistogram('prediction_latency_ms', { type: 'ltv', method }, durationMs);
    observeHistogram('ltv_value_distribution', { tier }, ltv365);
  },

  /**
   * Record a next purchase prediction
   */
  recordNextPurchase(userId: string, daysUntil: number, method: string, durationMs: number): void {
    const labels = { method };
    incrementCounter('predictions_next_purchase_total', labels);
    observeHistogram('prediction_latency_ms', { type: 'next_purchase', method }, durationMs);
    observeHistogram('days_until_purchase_distribution', {}, daysUntil);
  },

  /**
   * Record a conversion prediction
   */
  recordConversion(userId: string, probability: number, method: string, durationMs: number): void {
    const labels = { method };
    incrementCounter('predictions_conversion_total', labels);
    observeHistogram('prediction_latency_ms', { type: 'conversion', method }, durationMs);
  },

  /**
   * Record cache hit/miss
   */
  recordCacheHit(hit: boolean, predictionType: string): void {
    const labels = { type: predictionType, result: hit ? 'hit' : 'miss' };
    incrementCounter('cache_operations_total', labels);
  },

  /**
   * Record ML service fallback
   */
  recordMLFallback(predictionType: string): void {
    const labels = { type: predictionType, fallback: 'rfm' };
    incrementCounter('ml_service_total', labels);
  },

  /**
   * Record ML service success
   */
  recordMLSuccess(predictionType: string): void {
    const labels = { type: predictionType, fallback: 'none' };
    incrementCounter('ml_service_total', labels);
  },
};

/**
 * Get metrics snapshot for health checks
 */
export function getMetricsSnapshot(): {
  counters: Array<{ name: string; labels: Record<string, string>; value: number }>;
  histograms: Array<{ name: string; labels: Record<string, string>; count: number; avg: number }>;
  gauges: Array<{ name: string; labels: Record<string, string>; value: number }>;
} {
  const snapshot = {
    counters: [] as Array<{ name: string; labels: Record<string, string>; value: number }>,
    histograms: [] as Array<{ name: string; labels: Record<string, string>; count: number; avg: number }>,
    gauges: [] as Array<{ name: string; labels: Record<string, string>; value: number }>,
  };

  for (const [key, counter] of counters) {
    const name = key.replace(/\{.*/, '');
    const labelsStr = key.match(/\{.*\}/)?.[0] || '{}';
    snapshot.counters.push({
      name,
      labels: JSON.parse(labelsStr || '{}'),
      value: counter.value,
    });
  }

  for (const [key, hist] of histograms) {
    const name = key.replace(/\{.*/, '');
    const labelsStr = key.match(/\{.*\}/)?.[0] || '{}';
    snapshot.histograms.push({
      name,
      labels: JSON.parse(labelsStr || '{}'),
      count: hist.count,
      avg: hist.count > 0 ? hist.sum / hist.count : 0,
    });
  }

  for (const [key, gauge] of gauges) {
    const name = key.replace(/\{.*/, '');
    const labelsStr = key.match(/\{.*\}/)?.[0] || '{}';
    snapshot.gauges.push({
      name,
      labels: JSON.parse(labelsStr || '{}'),
      value: gauge.value,
    });
  }

  return snapshot;
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
  gauges.clear();
}

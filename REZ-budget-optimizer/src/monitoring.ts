/**
 * Prometheus Metrics for Merchant Growth OS
 *
 * Usage:
 * ```
 * import { metricsMiddleware, registerMetrics } from './monitoring';
 * app.use(metricsMiddleware);
 * app.get('/metrics', async (req, res) => {
 *   res.set('Content-Type', registerMetrics.contentType);
 *   res.end(await registerMetrics.metrics());
 * });
 * ```
 */

import { Request, Response } from 'express';

// ============== METRICS STORE ==============

class MetricsStore {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private labels: Map<string, Map<string, string>> = new Map();

  // Counter operations
  incrementCounter(name: string, labels?: Record<string, string>, value: number = 1) {
    const key = this.getKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
    if (labels) {
      this.labels.set(key, labels);
    }
  }

  // Gauge operations
  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    if (labels) {
      this.labels.set(key, labels);
    }
  }

  incrementGauge(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, (this.gauges.get(key) || 0) + value);
  }

  // Histogram operations
  observeHistogram(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    if (values.length > 1000) values.shift(); // Keep last 1000
    this.histograms.set(key, values);
    if (labels) {
      this.labels.set(key, labels);
    }
  }

  // Generate metrics output
  generate(): string {
    const lines: string[] = [];

    // Add HELP and TYPE for each metric
    for (const [name] of this.counters) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${this.formatLabels(name)} ${this.counters.get(name)}`);
    }

    for (const [name] of this.gauges) {
      lines.push(`# HELP ${name} Gauge metric`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${this.formatLabels(name)} ${this.gauges.get(name)}`);
    }

    for (const [name, values] of this.histograms) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;

      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);

      // Buckets
      const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
      for (const bucket of buckets) {
        const bucketCount = sorted.filter(v => v <= bucket).length;
        lines.push(`${name}_bucket{le="${bucket}"} ${bucketCount}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${count}`);
      lines.push(`${name}_sum ${sum}`);
      lines.push(`${name}_count ${count}`);
    }

    return lines.join('\n');
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
    return `${name}{${labelStr}}`;
  }

  private formatLabels(name: string): string {
    const labels = this.labels.get(name);
    if (!labels) return '';
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
    return `{${labelStr}}`;
  }
}

export const metricsStore = new MetricsStore();

// ============== PREDEFINED METRICS ==============

export function recordHttpRequest(req: Request, res: Response, duration: number) {
  const labels = {
    method: req.method,
    path: req.route?.path || req.path,
    status: res.statusCode.toString()
  };

  metricsStore.incrementCounter('http_requests_total', labels);
  metricsStore.observeHistogram('http_request_duration_seconds', duration / 1000, labels);
}

export function recordApiCall(service: string, endpoint: string, success: boolean, duration: number) {
  const labels = { service, endpoint, success: success.toString() };

  metricsStore.incrementCounter('api_calls_total', labels);
  metricsStore.observeHistogram('api_call_duration_seconds', duration / 1000, labels);
}

export function recordBudgetOptimization(merchantId: string, channels: number, totalBudget: number) {
  metricsStore.incrementCounter('budget_optimizations_total', { status: 'success' });
  metricsStore.observeHistogram('budget_optimization_amount', totalBudget);
  metricsStore.setGauge('active_campaigns', channels, { merchantId });
}

export function recordHealthScore(merchantId: string, score: number, tier: string) {
  metricsStore.setGauge('merchant_health_score', score, { merchantId, tier });
}

export function recordOfferRedemption(merchantId: string, offerType: string, value: number) {
  metricsStore.incrementCounter('offer_redemptions_total', { merchantId, type: offerType });
  metricsStore.observeHistogram('offer_value', value);
}

export function recordConversion(merchantId: string, channel: string, revenue: number) {
  metricsStore.incrementCounter('conversions_total', { merchantId, channel });
  metricsStore.observeHistogram('conversion_revenue', revenue, { merchantId });
}

// ============== EXPRESS MIDDLEWARE ==============

export function metricsMiddleware() {
  return (req: Request, res: Response, next: Function) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      recordHttpRequest(req, res, duration);
    });

    next();
  };
}

// ============== METRICS ENDPOINT ==============

export async function getMetrics() {
  return metricsStore.generate();
}

// ============== DEFAULT METRICS ==============

// Node.js default metrics
metricsStore.setGauge('nodejs_version_info', 1, { version: process.version });
metricsStore.setGauge('process_uptime_seconds', process.uptime());

// Memory metrics
setInterval(() => {
  const mem = process.memoryUsage();
  metricsStore.setGauge('process_memory_heap_used_bytes', mem.heapUsed);
  metricsStore.setGauge('process_memory_heap_total_bytes', mem.heapTotal);
  metricsStore.setGauge('process_memory_rss_bytes', mem.rss);
}, 10000);

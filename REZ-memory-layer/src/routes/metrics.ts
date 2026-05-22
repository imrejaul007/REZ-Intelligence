/**
 * REZ Memory Layer - Prometheus Metrics Endpoint
 * Exposes metrics in Prometheus format for scraping
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth';
import { checkMongoHealth } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { eventConsumer } from '../services/eventConsumer';

const router = Router();

// Service name constant
const SERVICE_NAME = 'REZ-memory-layer';
const VERSION = '1.0.0';

// ==================== METRICS STORAGE ====================

interface EndpointMetrics {
  total: number;
  errors: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
}

interface Metrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    byEndpoint: Record<string, EndpointMetrics>;
  };
  timelines: {
    total: number;
    avgEvents: number;
  };
  events: {
    processed: number;
    failed: number;
    pending: number;
    avgProcessingTime: number;
  };
  cache: {
    hits: number;
    misses: number;
    size: number;
  };
  memory: {
    used: number;
    total: number;
    rss: number;
  };
  uptime: number;
  lastUpdated: number;
}

// In-memory metrics storage (reset on restart)
const metrics: Metrics = {
  requests: { total: 0, success: 0, errors: 0, byEndpoint: {} },
  timelines: { total: 0, avgEvents: 0 },
  events: { processed: 0, failed: 0, pending: 0, avgProcessingTime: 0 },
  cache: { hits: 0, misses: 0, size: 0 },
  memory: { used: 0, total: 0, rss: 0 },
  uptime: process.uptime(),
  lastUpdated: Date.now()
};

/**
 * Update request metrics
 */
export function updateRequestMetrics(endpoint: string, statusCode: number, duration: number): void {
  metrics.requests.total++;
  metrics.lastUpdated = Date.now();

  if (statusCode >= 400) {
    metrics.requests.errors++;
  } else {
    metrics.requests.success++;
  }

  // Initialize endpoint metrics if not exists
  if (!metrics.requests.byEndpoint[endpoint]) {
    metrics.requests.byEndpoint[endpoint] = {
      total: 0,
      errors: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: Infinity
    };
  }

  const ep = metrics.requests.byEndpoint[endpoint];
  ep.total++;
  if (statusCode >= 400) ep.errors++;

  // Calculate rolling average duration (70% old, 30% new)
  ep.avgDuration = (ep.avgDuration * 0.7) + (duration * 0.3);
  ep.maxDuration = Math.max(ep.maxDuration, duration);
  ep.minDuration = Math.min(ep.minDuration, duration);
}

/**
 * Update event processing metrics
 */
export function updateEventMetrics(processed: number, failed: number, pending: number, avgProcessingTime: number): void {
  metrics.events.processed += processed;
  metrics.events.failed += failed;
  metrics.events.pending = pending;
  metrics.events.avgProcessingTime = avgProcessingTime;
  metrics.lastUpdated = Date.now();
}

/**
 * Update cache metrics
 */
export function updateCacheMetrics(hits: number, misses: number, size: number): void {
  metrics.cache.hits = hits;
  metrics.cache.misses = misses;
  metrics.cache.size = size;
  metrics.lastUpdated = Date.now();
}

/**
 * Get current metrics
 */
export function getMetrics(): Metrics {
  const memUsage = process.memoryUsage();
  metrics.memory = {
    used: memUsage.heapUsed,
    total: memUsage.heapTotal,
    rss: memUsage.rss
  };
  metrics.uptime = process.uptime();

  // Update event consumer status
  if (eventConsumer.isHealthy()) {
    const status = eventConsumer.getStatus();
    metrics.events.pending = status.subscriptions;
  }

  return metrics;
}

// ==================== METRICS ENDPOINT ====================

/**
 * GET /metrics - Prometheus metrics endpoint (public)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Update memory and uptime
    const memUsage = process.memoryUsage();
    metrics.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      rss: memUsage.rss
    };
    metrics.uptime = process.uptime();
    metrics.lastUpdated = Date.now();

    // Generate Prometheus format
    const prometheusMetrics = generatePrometheusMetrics();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
  } catch (error) {
    res.status(500).send('# Error generating metrics\n');
  }
});

/**
 * GET /metrics/json - JSON metrics endpoint (authenticated)
 */
router.get('/json', authMiddleware, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: getMetrics(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'METRICS_ERROR', message: 'Failed to generate metrics' }
    });
  }
});

/**
 * Generate Prometheus-formatted metrics string
 */
function generatePrometheusMetrics(): string {
  const m = getMetrics();

  const lines: string[] = [
    `# HELP ${SERVICE_NAME}_info Service information`,
    `# TYPE ${SERVICE_NAME}_info gauge`,
    `${SERVICE_NAME}_info{version="${VERSION}",service="${SERVICE_NAME}"} 1`,

    `# HELP ${SERVICE_NAME}_uptime_seconds Service uptime in seconds`,
    `# TYPE ${SERVICE_NAME}_uptime_seconds gauge`,
    `${SERVICE_NAME}_uptime_seconds ${m.uptime}`,

    // Request metrics
    `# HELP ${SERVICE_NAME}_http_requests_total Total HTTP requests`,
    `# TYPE ${SERVICE_NAME}_http_requests_total counter`,
    `${SERVICE_NAME}_http_requests_total{type="total"} ${m.requests.total}`,
    `${SERVICE_NAME}_http_requests_total{type="success"} ${m.requests.success}`,
    `${SERVICE_NAME}_http_requests_total{type="errors"} ${m.requests.errors}`,

    // Endpoint metrics
    `# HELP ${SERVICE_NAME}_http_request_duration_ms_avg Average request duration by endpoint`,
    `# TYPE ${SERVICE_NAME}_http_request_duration_ms_avg gauge`,
    ...Object.entries(m.requests.byEndpoint).map(([endpoint, data]) =>
      `${SERVICE_NAME}_http_request_duration_ms_avg{endpoint="${sanitizeLabel(endpoint)}"} ${data.avgDuration.toFixed(2)}`
    ),

    `# HELP ${SERVICE_NAME}_http_requests_by_endpoint_total Total requests by endpoint`,
    `# TYPE ${SERVICE_NAME}_http_requests_by_endpoint_total counter`,
    ...Object.entries(m.requests.byEndpoint).map(([endpoint, data]) =>
      `${SERVICE_NAME}_http_requests_by_endpoint_total{endpoint="${sanitizeLabel(endpoint)}",type="total"} ${data.total}`
    ),

    // Event metrics
    `# HELP ${SERVICE_NAME}_events_processed_total Total events processed`,
    `# TYPE ${SERVICE_NAME}_events_processed_total counter`,
    `${SERVICE_NAME}_events_processed_total{type="success"} ${m.events.processed}`,
    `${SERVICE_NAME}_events_processed_total{type="failed"} ${m.events.failed}`,
    `${SERVICE_NAME}_events_processed_total{type="pending"} ${m.events.pending}`,

    `# HELP ${SERVICE_NAME}_events_avg_processing_time_ms Average event processing time`,
    `# TYPE ${SERVICE_NAME}_events_avg_processing_time_ms gauge`,
    `${SERVICE_NAME}_events_avg_processing_time_ms ${m.events.avgProcessingTime.toFixed(2)}`,

    // Cache metrics
    `# HELP ${SERVICE_NAME}_cache_hits_total Cache hits`,
    `# TYPE ${SERVICE_NAME}_cache_hits_total counter`,
    `${SERVICE_NAME}_cache_hits_total ${m.cache.hits}`,

    `# HELP ${SERVICE_NAME}_cache_misses_total Cache misses`,
    `# TYPE ${SERVICE_NAME}_cache_misses_total counter`,
    `${SERVICE_NAME}_cache_misses_total ${m.cache.misses}`,

    `# HELP ${SERVICE_NAME}_cache_size Current cache size`,
    `# TYPE ${SERVICE_NAME}_cache_size gauge`,
    `${SERVICE_NAME}_cache_size ${m.cache.size}`,

    // Memory metrics
    `# HELP nodejs_memory_heap_used_bytes Node.js heap used bytes`,
    `# TYPE nodejs_memory_heap_used_bytes gauge`,
    `nodejs_memory_heap_used_bytes ${m.memory.used}`,

    `# HELP nodejs_memory_heap_total_bytes Node.js heap total bytes`,
    `# TYPE nodejs_memory_heap_total_bytes gauge`,
    `nodejs_memory_heap_total_bytes ${m.memory.total}`,

    `# HELP nodejs_memory_rss_bytes Node.js RSS bytes`,
    `# TYPE nodejs_memory_rss_bytes gauge`,
    `nodejs_memory_rss_bytes ${m.memory.rss}`,

    // MongoDB connection status
    `# HELP ${SERVICE_NAME}_mongodb_connected MongoDB connection status (1=connected, 0=disconnected)`,
    `# TYPE ${SERVICE_NAME}_mongodb_connected gauge`,
    `${SERVICE_NAME}_mongodb_connected ${mongoose.connection.readyState === 1 ? 1 : 0}`,

    // Event bus status
    `# HELP ${SERVICE_NAME}_event_bus_connected Event bus connection status`,
    `# TYPE ${SERVICE_NAME}_event_bus_connected gauge`,
    `${SERVICE_NAME}_event_bus_connected ${eventConsumer.isHealthy() ? 1 : 0}`
  ];

  return lines.filter(line => !line.includes('Infinity')).join('\n');
}

/**
 * Sanitize label values for Prometheus format
 */
function sanitizeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

export default router;

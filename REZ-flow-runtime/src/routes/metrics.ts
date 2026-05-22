/**
 * REZ Flow Runtime - Prometheus Metrics Endpoint
 * Exposes metrics in Prometheus format for scraping
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateInternal } from '../middleware/auth';

const router = Router();

// Service name constant
const SERVICE_NAME = 'REZ-flow-runtime';
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
  workflows: {
    total: number;
    byStatus: Record<string, number>;
  };
  executions: {
    total: number;
    byStatus: Record<string, number>;
    avgDuration: number;
  };
  dlq: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
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
  workflows: { total: 0, byStatus: {} },
  executions: { total: 0, byStatus: {}, avgDuration: 0 },
  dlq: { pending: 0, processing: 0, completed: 0, failed: 0 },
  memory: { used: 0, total: 0, rss: 0 },
  uptime: process.uptime(),
  lastUpdated: Date.now()
};

// Track metrics from incoming requests
let totalExecutions = 0;
let executionDurations: number[] = [];

/**
 * Update request metrics
 */
function updateRequestMetrics(endpoint: string, statusCode: number, duration: number): void {
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
 * Update workflow metrics
 */
function updateWorkflowMetrics(byStatus: Record<string, number>): void {
  metrics.workflows.byStatus = byStatus;
  metrics.workflows.total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  metrics.lastUpdated = Date.now();
}

/**
 * Update execution metrics
 */
function updateExecutionMetrics(byStatus: Record<string, number>, avgDuration: number): void {
  metrics.executions.byStatus = byStatus;
  metrics.executions.total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  metrics.executions.avgDuration = avgDuration;
  metrics.lastUpdated = Date.now();
}

/**
 * Update DLQ metrics
 */
function updateDLQMetrics(stats: { pending: number; processing: number; completed: number; failed: number }): void {
  metrics.dlq = stats;
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
 * GET /metrics/json - JSON metrics endpoint (internal)
 */
router.get('/json', authenticateInternal, async (req: Request, res: Response) => {
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

    `# HELP ${SERVICE_NAME}_http_request_duration_ms_max Max request duration by endpoint`,
    `# TYPE ${SERVICE_NAME}_http_request_duration_ms_max gauge`,
    ...Object.entries(m.requests.byEndpoint).map(([endpoint, data]) =>
      `${SERVICE_NAME}_http_request_duration_ms_max{endpoint="${sanitizeLabel(endpoint)}"} ${data.maxDuration}`
    ),

    `# HELP ${SERVICE_NAME}_http_requests_by_endpoint_total Total requests by endpoint`,
    `# TYPE ${SERVICE_NAME}_http_requests_by_endpoint_total counter`,
    ...Object.entries(m.requests.byEndpoint).map(([endpoint, data]) =>
      `${SERVICE_NAME}_http_requests_by_endpoint_total{endpoint="${sanitizeLabel(endpoint)}",type="total"} ${data.total}`
    ),

    // Workflow metrics
    `# HELP ${SERVICE_NAME}_workflows_total Total workflows`,
    `# TYPE ${SERVICE_NAME}_workflows_total gauge`,
    `${SERVICE_NAME}_workflows_total ${m.workflows.total}`,

    `# HELP ${SERVICE_NAME}_workflows_by_status Workflow count by status`,
    `# TYPE ${SERVICE_NAME}_workflows_by_status gauge`,
    ...Object.entries(m.workflows.byStatus).map(([status, count]) =>
      `${SERVICE_NAME}_workflows_by_status{status="${status}"} ${count}`
    ),

    // Execution metrics
    `# HELP ${SERVICE_NAME}_executions_total Total executions`,
    `# TYPE ${SERVICE_NAME}_executions_total counter`,
    `${SERVICE_NAME}_executions_total ${m.executions.total}`,

    `# HELP ${SERVICE_NAME}_executions_by_status Execution count by status`,
    `# TYPE ${SERVICE_NAME}_executions_by_status gauge`,
    ...Object.entries(m.executions.byStatus).map(([status, count]) =>
      `${SERVICE_NAME}_executions_by_status{status="${status}"} ${count}`
    ),

    `# HELP ${SERVICE_NAME}_executions_avg_duration_ms Average execution duration`,
    `# TYPE ${SERVICE_NAME}_executions_avg_duration_ms gauge`,
    `${SERVICE_NAME}_executions_avg_duration_ms ${m.executions.avgDuration.toFixed(2)}`,

    // DLQ metrics
    `# HELP ${SERVICE_NAME}_dlq_messages Dead letter queue message count`,
    `# TYPE ${SERVICE_NAME}_dlq_messages gauge`,
    `${SERVICE_NAME}_dlq_messages{status="pending"} ${m.dlq.pending}`,
    `${SERVICE_NAME}_dlq_messages{status="processing"} ${m.dlq.processing}`,
    `${SERVICE_NAME}_dlq_messages{status="completed"} ${m.dlq.completed}`,
    `${SERVICE_NAME}_dlq_messages{status="failed"} ${m.dlq.failed}`,

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
    `${SERVICE_NAME}_mongodb_connected ${mongoose.connection.readyState === 1 ? 1 : 0}`
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
export { metrics, updateRequestMetrics, updateWorkflowMetrics, updateExecutionMetrics, updateDLQMetrics };

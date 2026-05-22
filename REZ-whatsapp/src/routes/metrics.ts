/**
 * REZ WhatsApp - Prometheus Metrics Endpoint
 * Exposes metrics in Prometheus format for scraping
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Service name constant
const SERVICE_NAME = 'REZ-whatsapp';
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
  whatsapp: {
    messagesReceived: number;
    messagesSent: number;
    templateMessages: number;
    webhookReceived: number;
    sessionsActive: number;
  };
  cart: {
    created: number;
    updated: number;
    converted: number;
    abandoned: number;
  };
  orders: {
    created: number;
    pending: number;
    confirmed: number;
    completed: number;
    failed: number;
  };
  broadcast: {
    scheduled: number;
    sent: number;
    delivered: number;
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
  whatsapp: {
    messagesReceived: 0,
    messagesSent: 0,
    templateMessages: 0,
    webhookReceived: 0,
    sessionsActive: 0
  },
  cart: {
    created: 0,
    updated: 0,
    converted: 0,
    abandoned: 0
  },
  orders: {
    created: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    failed: 0
  },
  broadcast: {
    scheduled: 0,
    sent: 0,
    delivered: 0,
    failed: 0
  },
  memory: { used: 0, total: 0, rss: 0 },
  uptime: process.uptime(),
  lastUpdated: Date.now()
};

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
 * Update WhatsApp metrics
 */
function updateWhatsAppMetrics(data: Partial<Metrics['whatsapp']>): void {
  if (data.messagesReceived !== undefined) metrics.whatsapp.messagesReceived += data.messagesReceived;
  if (data.messagesSent !== undefined) metrics.whatsapp.messagesSent += data.messagesSent;
  if (data.templateMessages !== undefined) metrics.whatsapp.templateMessages += data.templateMessages;
  if (data.webhookReceived !== undefined) metrics.whatsapp.webhookReceived += data.webhookReceived;
  if (data.sessionsActive !== undefined) metrics.whatsapp.sessionsActive = data.sessionsActive;
  metrics.lastUpdated = Date.now();
}

/**
 * Update cart metrics
 */
function updateCartMetrics(data: Partial<Metrics['cart']>): void {
  if (data.created !== undefined) metrics.cart.created += data.created;
  if (data.updated !== undefined) metrics.cart.updated += data.updated;
  if (data.converted !== undefined) metrics.cart.converted += data.converted;
  if (data.abandoned !== undefined) metrics.cart.abandoned += data.abandoned;
  metrics.lastUpdated = Date.now();
}

/**
 * Update order metrics
 */
function updateOrderMetrics(data: Partial<Metrics['orders']>): void {
  if (data.created !== undefined) metrics.orders.created += data.created;
  if (data.pending !== undefined) metrics.orders.pending += data.pending;
  if (data.confirmed !== undefined) metrics.orders.confirmed += data.confirmed;
  if (data.completed !== undefined) metrics.orders.completed += data.completed;
  if (data.failed !== undefined) metrics.orders.failed += data.failed;
  metrics.lastUpdated = Date.now();
}

/**
 * Update broadcast metrics
 */
function updateBroadcastMetrics(data: Partial<Metrics['broadcast']>): void {
  if (data.scheduled !== undefined) metrics.broadcast.scheduled += data.scheduled;
  if (data.sent !== undefined) metrics.broadcast.sent += data.sent;
  if (data.delivered !== undefined) metrics.broadcast.delivered += data.delivered;
  if (data.failed !== undefined) metrics.broadcast.failed += data.failed;
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
  metrics.lastUpdated = Date.now();

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
router.get('/json', async (req: Request, res: Response) => {
  // Verify internal token
  const internalToken = req.headers['x-internal-token'];
  if (internalToken !== process.env.INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid internal token' }
    });
    return;
  }

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

    // WhatsApp metrics
    `# HELP ${SERVICE_NAME}_whatsapp_messages_total WhatsApp messages`,
    `# TYPE ${SERVICE_NAME}_whatsapp_messages_total counter`,
    `${SERVICE_NAME}_whatsapp_messages_total{type="received"} ${m.whatsapp.messagesReceived}`,
    `${SERVICE_NAME}_whatsapp_messages_total{type="sent"} ${m.whatsapp.messagesSent}`,
    `${SERVICE_NAME}_whatsapp_messages_total{type="template"} ${m.whatsapp.templateMessages}`,
    `${SERVICE_NAME}_whatsapp_messages_total{type="webhook"} ${m.whatsapp.webhookReceived}`,

    `# HELP ${SERVICE_NAME}_whatsapp_sessions_active Active WhatsApp sessions`,
    `# TYPE ${SERVICE_NAME}_whatsapp_sessions_active gauge`,
    `${SERVICE_NAME}_whatsapp_sessions_active ${m.whatsapp.sessionsActive}`,

    // Cart metrics
    `# HELP ${SERVICE_NAME}_cart_total Cart operations`,
    `# TYPE ${SERVICE_NAME}_cart_total counter`,
    `${SERVICE_NAME}_cart_total{type="created"} ${m.cart.created}`,
    `${SERVICE_NAME}_cart_total{type="updated"} ${m.cart.updated}`,
    `${SERVICE_NAME}_cart_total{type="converted"} ${m.cart.converted}`,
    `${SERVICE_NAME}_cart_total{type="abandoned"} ${m.cart.abandoned}`,

    // Order metrics
    `# HELP ${SERVICE_NAME}_orders_total Order operations`,
    `# TYPE ${SERVICE_NAME}_orders_total counter`,
    `${SERVICE_NAME}_orders_total{type="created"} ${m.orders.created}`,
    `${SERVICE_NAME}_orders_total{type="pending"} ${m.orders.pending}`,
    `${SERVICE_NAME}_orders_total{type="confirmed"} ${m.orders.confirmed}`,
    `${SERVICE_NAME}_orders_total{type="completed"} ${m.orders.completed}`,
    `${SERVICE_NAME}_orders_total{type="failed"} ${m.orders.failed}`,

    // Broadcast metrics
    `# HELP ${SERVICE_NAME}_broadcast_total Broadcast operations`,
    `# TYPE ${SERVICE_NAME}_broadcast_total counter`,
    `${SERVICE_NAME}_broadcast_total{type="scheduled"} ${m.broadcast.scheduled}`,
    `${SERVICE_NAME}_broadcast_total{type="sent"} ${m.broadcast.sent}`,
    `${SERVICE_NAME}_broadcast_total{type="delivered"} ${m.broadcast.delivered}`,
    `${SERVICE_NAME}_broadcast_total{type="failed"} ${m.broadcast.failed}`,

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
export { metrics, updateRequestMetrics, updateWhatsAppMetrics, updateCartMetrics, updateOrderMetrics, updateBroadcastMetrics };

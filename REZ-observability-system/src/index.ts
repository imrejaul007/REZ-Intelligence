import express from 'express';
import fs from 'fs';
import path from 'path';
import routes from './routes';
import { logger } from './logger';
import { metrics } from './metrics';
import { alerts } from './alerts';

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const traceId = req.headers['x-trace-id'] as string;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel as 'info' | 'warn'](
      `${req.method} ${req.path} ${res.statusCode}`,
      'api',
      {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.headers['user-agent']
      },
      traceId
    );

    // Record HTTP metrics
    metrics.incrementCounter('http_requests_total', {
      method: req.method,
      route: req.path,
      status: res.statusCode.toString()
    });

    metrics.observeHistogram('http_request_duration_seconds', duration / 1000, {
      method: req.method,
      route: req.path
    });
  });

  next();
});

// Mount routes
app.use('/', routes);

// Alert evaluation interval (every 30 seconds)
setInterval(() => {
  try {
    const results = alerts.evaluateRules();
    const firingAlerts = results.filter(r => r.isViolated);

    if (firingAlerts.length > 0) {
      logger.info(
        `Alert evaluation: ${firingAlerts.length} rule(s) violated`,
        'alerts',
        { results }
      );
    }
  } catch (error) {
    logger.error('Alert evaluation failed', 'alerts', { error: String(error) });
  }
}, 30000);

// Memory usage tracking
setInterval(() => {
  const memUsage = process.memoryUsage();
  metrics.setGauge('memory_usage_bytes', memUsage.heapUsed, { type: 'heap' });
  metrics.setGauge('memory_usage_bytes', memUsage.heapTotal, { type: 'heapTotal' });
  metrics.setGauge('memory_usage_bytes', memUsage.external, { type: 'external' });
  metrics.setGauge('memory_usage_bytes', memUsage.rss, { type: 'rss' });
}, 10000);

// Start server
app.listen(PORT, () => {
  logger.info(`REZ Observability System running on port ${PORT}`, 'system');

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   REZ OBSERVABILITY SYSTEM                                    ║
║   ─────────────────────────                                   ║
║                                                               ║
║   Server:     http://localhost:${PORT}                          ║
║   Health:     http://localhost:${PORT}/health                  ║
║                                                               ║
║   LOGS                                                        ║
║   ────                                                        ║
║   GET  /logs              - Query logs                        ║
║   GET  /logs/stats        - Log statistics                    ║
║   GET  /logs/:id          - Get log by ID                     ║
║   POST /logs              - Create log entry                 ║
║                                                               ║
║   METRICS                                                     ║
║   ───────                                                     ║
║   GET  /metrics            - Prometheus format               ║
║   GET  /metrics/time-series - Time series data               ║
║   GET  /metrics/all        - All time series metrics         ║
║   GET  /metrics/summary    - Metrics summary                 ║
║   POST /metrics/counter   - Increment counter               ║
║   POST /metrics/gauge     - Set gauge value                 ║
║   POST /metrics/histogram - Observe histogram               ║
║                                                               ║
║   TRACES                                                      ║
║   ──────                                                      ║
║   GET  /traces             - Query traces                    ║
║   GET  /traces/stats      - Trace statistics                ║
║   GET  /traces/:traceId   - Get trace by ID                ║
║   GET  /spans/:spanId     - Get span by ID                 ║
║   POST /traces/span/start - Start a new span               ║
║   POST /traces/span/end   - End a span                    ║
║   POST /traces/span/event - Add span event                 ║
║                                                               ║
║   ALERTS                                                      ║
║   ──────                                                      ║
║   GET  /alerts             - Get all alerts                  ║
║   GET  /alerts/stats      - Alert statistics                ║
║   GET  /alerts/history    - Alert history                   ║
║   GET  /alerts/:alertId   - Get alert by ID                ║
║   POST /alerts/:id/ack    - Acknowledge alert              ║
║   POST /alerts/:id/resolve - Resolve alert                 ║
║   GET  /alerts/rules      - Get all alert rules            ║
║   POST /alerts/rules      - Create alert rule              ║
║   POST /alerts/evaluate   - Evaluate all rules            ║
║   POST /alerts/metric     - Set metric value               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;

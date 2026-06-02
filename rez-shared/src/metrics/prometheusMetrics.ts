import { Counter, Histogram, Gauge, Summary } from 'prom-client';

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const walletBalanceGauge = new Gauge({
  name: 'wallet_balance',
  help: 'Current wallet balance',
  labelNames: ['userId'],
});

export const orderCountTotal = new Counter({
  name: 'orders_total',
  help: 'Total orders processed',
  labelNames: ['status', 'merchantId'],
});

export const paymentAmountTotal = new Counter({
  name: 'payment_amount_total',
  help: 'Total payment amount',
  labelNames: ['currency', 'status'],
});

export const activeConnectionsGauge = new Gauge({
  name: 'active_connections',
  help: 'Active database connections',
});

export const cacheHitRate = new Summary({
  name: 'cache_hit_rate',
  help: 'Cache hit rate',
  percentiles: [0.5, 0.9, 0.99],
});

// Express middleware
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
      },
      duration,
    );
  });

  next();
}

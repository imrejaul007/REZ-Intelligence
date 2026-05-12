/**
 * Express middleware for automatic request tracing
 */
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { trackRequest } = require('./metrics');

function tracingMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    const tracer = trace.getTracer('rez-intelligence');

    // Create span for this request
    tracer.startActiveSpan(`${req.method} ${req.path}`, (span) => {
      // Add request attributes
      span.setAttributes({
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.user_agent': req.get('user-agent'),
        'http.scheme': req.protocol,
        'http.client_ip': req.ip
      });

      // Add custom attributes from request
      if (req.headers['x-request-id']) {
        span.setAttribute('request.id', req.headers['x-request-id']);
      }

      if (req.apiKey?.keyId) {
        span.setAttribute('api.key_id', req.apiKey.keyId);
        span.setAttribute('api.app_id', req.apiKey.appId);
      }

      // Capture response
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - startTime;

        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_time_ms': duration
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        // Record metrics
        trackRequest(req.method, req.path, res.statusCode, duration);

        span.end();
        originalEnd.apply(res, args);
      };

      next();
    });
  };
}

// Error handling middleware
function errorTracingMiddleware() {
  return (err, req, res, next) => {
    const span = trace.getActiveSpan();

    if (span) {
      span.recordException(err);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message
      });
      span.setAttributes({
        'error.type': err.name,
        'error.message': err.message,
        'error.stack': err.stack
      });
    }

    next(err);
  };
}

// Request logging with trace context
function loggingMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Get trace ID for logging
    const span = trace.getActiveSpan();
    const traceId = span?.spanContext()?.traceId || 'no-trace';

    // Add to request for downstream use
    req.traceId = traceId;

    // Log request
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'request',
      traceId,
      method: req.method,
      path: req.path,
      duration: 0 // Will be updated
    }));

    // Log response on finish
    res.on('finish', () => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 400 ? 'error' : 'info',
        type: 'response',
        traceId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: Date.now() - startTime,
        userAgent: req.get('user-agent')
      }));
    });

    next();
  };
}

module.exports = {
  tracingMiddleware,
  errorTracingMiddleware,
  loggingMiddleware
};

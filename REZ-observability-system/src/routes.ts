import { Router, Request, Response } from 'express';
import { logger, LogQuery } from './logger';
import { metrics } from './metrics';
import { traces, TraceQuery } from './traces';
import { alerts, AlertStatus, AlertSeverity } from './alerts';

const router = Router();

// Internal auth middleware
function requireInternalAuth(req: Request, res: Response, next: Function): void {
  const apiKey = req.headers['x-internal-token'] as string;
  const validKey = process.env.INTERNAL_SERVICE_TOKEN;

  if (!validKey) {
    if (process.env.NODE_ENV === 'development') return next();
    res.status(503).json({ success: false, error: 'Service not configured' });
    return;
  }

  if (apiKey !== validKey) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}

// Health check (public)
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ==================== LOGS (Protected) ====================

router.get('/logs', requireInternalAuth, (req: Request, res: Response) => {
  const query: LogQuery = {
    level: req.query.level as string,
    service: req.query.service as string,
    startTime: req.query.startTime as string,
    endTime: req.query.endTime as string,
    traceId: req.query.traceId as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0
  };

  const result = logger.queryLogs(query);
  res.json({
    logs: result.logs,
    total: result.total,
    limit: query.limit,
    offset: query.offset
  });
});

router.get('/logs/stats', requireInternalAuth, (_req: Request, res: Response) => {
  res.json(logger.getLogStats());
});

router.get('/logs/:id', requireInternalAuth, (req: Request, res: Response) => {
  const log = logger.getLogById(req.params.id);
  if (!log) {
    return res.status(404).json({ error: 'Log not found' });
  }
  res.json(log);
});

router.post('/logs', requireInternalAuth, (req: Request, res: Response) => {
  const { level, message, service, metadata, traceId, spanId } = req.body;

  if (!level || !message || !service) {
    return res.status(400).json({ error: 'level, message, and service are required' });
  }

  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: `Invalid level. Must be one of: ${validLevels.join(', ')}` });
  }

  const log = logger[level as 'debug' | 'info' | 'warn' | 'error']!(
    message,
    service,
    metadata,
    traceId,
    spanId
  );

  res.status(201).json(log);
});

// ==================== METRICS ====================

router.get('/metrics', requireInternalAuth, async (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain');
  res.send(await metrics.getPrometheusMetrics());
});

router.get('/metrics/time-series', requireInternalAuth, (req: Request, res: Response) => {
  const { name, startTime, endTime } = req.query;
  const timeSeries = metrics.getTimeSeries(
    name as string,
    startTime as string,
    endTime as string
  );
  res.json({ name, dataPoints: timeSeries });
});

router.get('/metrics/all', requireInternalAuth, (_req: Request, res: Response) => {
  res.json(metrics.getAllTimeSeries());
});

router.get('/metrics/summary', (_req: Request, res: Response) => {
  res.json(metrics.getMetricsSummary());
});

router.post('/metrics/counter', requireInternalAuth, (req: Request, res: Response) => {
  const { name, labels } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  metrics.incrementCounter(name, labels || {});
  res.json({ success: true, name });
});

router.post('/metrics/gauge', requireInternalAuth, (req: Request, res: Response) => {
  const { name, value, labels } = req.body;
  if (!name || value === undefined) {
    return res.status(400).json({ error: 'name and value are required' });
  }
  metrics.setGauge(name, value, labels || {});
  res.json({ success: true, name, value });
});

router.post('/metrics/histogram', (req: Request, res: Response) => {
  const { name, value, labels } = req.body;
  if (!name || value === undefined) {
    return res.status(400).json({ error: 'name and value are required' });
  }
  metrics.observeHistogram(name, value, labels || {});
  res.json({ success: true, name, value });
});

// ==================== TRACES ====================

router.get('/traces', (req: Request, res: Response) => {
  const query: TraceQuery = {
    service: req.query.service as string,
    operationName: req.query.operationName as string,
    startTime: req.query.startTime as string,
    endTime: req.query.endTime as string,
    status: req.query.status as TraceQuery['status'],
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0
  };

  const result = traces.queryTraces(query);
  res.json({
    traces: result.traces,
    total: result.total,
    limit: query.limit,
    offset: query.offset
  });
});

router.get('/traces/stats', (_req: Request, res: Response) => {
  res.json(traces.getTraceStats());
});

router.get('/traces/:traceId', (req: Request, res: Response) => {
  const trace = traces.getTrace(req.params.traceId);
  if (!trace) {
    return res.status(404).json({ error: 'Trace not found' });
  }
  res.json(trace);
});

router.get('/spans/:spanId', (req: Request, res: Response) => {
  const span = traces.getSpan(req.params.spanId);
  if (!span) {
    return res.status(404).json({ error: 'Span not found' });
  }
  res.json(span);
});

router.post('/traces/span/start', (req: Request, res: Response) => {
  const { name, service, traceId, parentId, kind, attributes } = req.body;
  if (!name || !service) {
    return res.status(400).json({ error: 'name and service are required' });
  }
  const span = traces.startSpan(name, service, traceId, parentId, kind, attributes);
  res.status(201).json(span);
});

router.post('/traces/span/end', (req: Request, res: Response) => {
  const { spanId, status, attributes } = req.body;
  if (!spanId) {
    return res.status(400).json({ error: 'spanId is required' });
  }
  const span = traces.endSpan(spanId, status, attributes);
  if (!span) {
    return res.status(404).json({ error: 'Span not found' });
  }
  res.json(span);
});

router.post('/traces/span/event', (req: Request, res: Response) => {
  const { spanId, name, attributes } = req.body;
  if (!spanId || !name) {
    return res.status(400).json({ error: 'spanId and name are required' });
  }
  traces.addSpanEvent(spanId, name, attributes);
  res.json({ success: true });
});

// ==================== ALERTS ====================

router.get('/alerts', (req: Request, res: Response) => {
  const { status, severity, service } = req.query;

  let result;
  if (status) {
    result = alerts.getAlertsByStatus(status as AlertStatus);
  } else if (severity) {
    result = alerts.getAlertsBySeverity(severity as AlertSeverity);
  } else if (service) {
    result = alerts.getAlertsByService(service as string);
  } else {
    result = Array.from(alerts['alerts'].values());
  }

  res.json(result);
});

router.get('/alerts/stats', (_req: Request, res: Response) => {
  res.json(alerts.getAlertStats());
});

router.get('/alerts/history', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  res.json(alerts.getAlertHistory(limit));
});

router.get('/alerts/:alertId', (req: Request, res: Response) => {
  const alert = alerts.getAlert(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
});

router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  const { acknowledgedBy } = req.body;
  const alert = alerts.acknowledgeAlert(req.params.alertId, acknowledgedBy || 'unknown');
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
});

router.post('/alerts/:alertId/resolve', (req: Request, res: Response) => {
  const alert = alerts.resolveAlert(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
});

router.get('/alerts/rules', (_req: Request, res: Response) => {
  res.json(alerts.getAllRules());
});

router.get('/alerts/rules/:ruleId', (req: Request, res: Response) => {
  const rule = alerts.getRule(req.params.ruleId);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json(rule);
});

router.post('/alerts/rules', (req: Request, res: Response) => {
  const { name, description, service, condition, severity, type, enabled, cooldownMinutes } = req.body;

  if (!name || !service || !condition || !severity) {
    return res.status(400).json({ error: 'name, service, condition, and severity are required' });
  }

  const rule = alerts.createRule({
    name,
    description: description || '',
    service,
    condition,
    severity,
    type: type || 'threshold',
    enabled: enabled !== false,
    cooldownMinutes: cooldownMinutes || 5
  });

  res.status(201).json(rule);
});

router.post('/alerts/evaluate', (_req: Request, res: Response) => {
  const results = alerts.evaluateRules();
  res.json({ results, evaluatedAt: new Date().toISOString() });
});

router.post('/alerts/metric', (req: Request, res: Response) => {
  const { metric, value } = req.body;
  if (!metric || value === undefined) {
    return res.status(400).json({ error: 'metric and value are required' });
  }
  alerts.setMetricValue(metric, value);
  res.json({ success: true, metric, value });
});

export default router;

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Event } from '../events/schema-registry';
import { logger } from '../utils/logger';
import { config } from '../config';

// ============================================
// Event Logger Model - Tracks ALL events sent
// ============================================

export interface IEventLogger extends Document {
  eventId: string;
  correlationId?: string;
  type: string;
  version: string;
  source: string;
  payload: Record<string, unknown>;
  // Emit tracking
  emittedAt: Date;
  emitLatencyMs: number;
  emitStatus: 'pending' | 'emitted' | 'stored' | 'queued' | 'failed';
  emitError?: string;
  // Acknowledgment tracking
  acknowledgedAt?: Date;
  acknowledgmentLatencyMs?: number;
  acknowledgmentReceived: boolean;
  acknowledgmentSource?: string;
  // Processing tracking
  processingStartedAt?: Date;
  processedAt?: Date;
  processingLatencyMs?: number;
  processedBy?: string;
  // DLQ tracking
  movedToDlqAt?: Date;
  dlqReason?: string;
  // Latency metrics
  totalLatencyMs: number;
  // Status
  status: 'pending' | 'emitted' | 'processing' | 'completed' | 'failed' | 'dlq';
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventLoggerSchema = new Schema<IEventLogger>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    correlationId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    // Emit tracking
    emittedAt: {
      type: Date,
      required: true,
      index: true,
    },
    emitLatencyMs: {
      type: Number,
      default: 0,
    },
    emitStatus: {
      type: String,
      enum: ['pending', 'emitted', 'stored', 'queued', 'failed'],
      default: 'pending',
      index: true,
    },
    emitError: {
      type: String,
    },
    // Acknowledgment tracking
    acknowledgedAt: {
      type: Date,
    },
    acknowledgmentLatencyMs: {
      type: Number,
    },
    acknowledgmentReceived: {
      type: Boolean,
      default: false,
    },
    acknowledgmentSource: {
      type: String,
    },
    // Processing tracking
    processingStartedAt: {
      type: Date,
    },
    processedAt: {
      type: Date,
    },
    processingLatencyMs: {
      type: Number,
    },
    processedBy: {
      type: String,
    },
    // DLQ tracking
    movedToDlqAt: {
      type: Date,
    },
    dlqReason: {
      type: String,
    },
    // Latency metrics
    totalLatencyMs: {
      type: Number,
      default: 0,
      index: true,
    },
    // Status
    status: {
      type: String,
      enum: ['pending', 'emitted', 'processing', 'completed', 'failed', 'dlq'],
      default: 'pending',
      index: true,
    },
    failureReason: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'event_tracking',
  }
);

// Compound indexes for common queries
EventLoggerSchema.index({ type: 1, emittedAt: -1 });
EventLoggerSchema.index({ status: 1, emittedAt: -1 });
EventLoggerSchema.index({ acknowledgmentReceived: 1, emittedAt: -1 });
EventLoggerSchema.index({ totalLatencyMs: 1, type: 1 });
EventLoggerSchema.index({ correlationId: 1, emittedAt: -1 });

// TTL index for automatic cleanup (configurable retention)
EventLoggerSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: (config.events?.deadLetterRetentionDays || 30) * 24 * 60 * 60 }
);

export const EventLogger: Model<IEventLogger> = mongoose.model<IEventLogger>(
  'EventLogger',
  EventLoggerSchema
);

// ============================================
// Alert Configuration Model
// ============================================

export interface IAlertConfig extends Document {
  name: string;
  type: 'dlq_growth' | 'latency_threshold' | 'failure_rate' | 'no_acknowledgment';
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
  lastTriggeredAt?: Date;
  alertChannel?: string;
  cooldownMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const AlertConfigSchema = new Schema<IAlertConfig>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['dlq_growth', 'latency_threshold', 'failure_rate', 'no_acknowledgment'],
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    windowMinutes: {
      type: Number,
      default: 5,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    lastTriggeredAt: {
      type: Date,
    },
    alertChannel: {
      type: String,
    },
    cooldownMinutes: {
      type: Number,
      default: 15,
    },
  },
  {
    timestamps: true,
    collection: 'event_alert_configs',
  }
);

export const AlertConfig: Model<IAlertConfig> = mongoose.model<IAlertConfig>(
  'AlertConfig',
  AlertConfigSchema
);

// ============================================
// Alert Log Model
// ============================================

export interface IAlertLog extends Document {
  alertConfigId: Types.ObjectId;
  alertName: string;
  alertType: string;
  triggeredAt: Date;
  metricValue: number;
  threshold: number;
  eventIds: string[];
  details: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  createdAt: Date;
}

const AlertLogSchema = new Schema<IAlertLog>(
  {
    alertConfigId: {
      type: Schema.Types.ObjectId,
      ref: 'AlertConfig',
      required: true,
    },
    alertName: {
      type: String,
      required: true,
    },
    alertType: {
      type: String,
      required: true,
    },
    triggeredAt: {
      type: Date,
      required: true,
      index: true,
    },
    metricValue: {
      type: Number,
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    eventIds: {
      type: [String],
      default: [],
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'event_alert_logs',
  }
);

AlertLogSchema.index({ alertType: 1, triggeredAt: -1 });
AlertLogSchema.index({ acknowledged: 1, triggeredAt: -1 });

export const AlertLog: Model<IAlertLog> = mongoose.model<IAlertLog>(
  'AlertLog',
  AlertLogSchema
);

// ============================================
// Default Alert Configurations
// ============================================

export const DEFAULT_ALERT_CONFIGS = [
  {
    name: 'dlq_growth_rate',
    type: 'dlq_growth',
    threshold: 10, // Alert if more than 10 events moved to DLQ
    windowMinutes: 5,
    cooldownMinutes: 15,
  },
  {
    name: 'high_latency',
    type: 'latency_threshold',
    threshold: 5000, // Alert if latency exceeds 5 seconds
    windowMinutes: 5,
    cooldownMinutes: 10,
  },
  {
    name: 'failure_rate',
    type: 'failure_rate',
    threshold: 0.1, // Alert if failure rate exceeds 10%
    windowMinutes: 5,
    cooldownMinutes: 15,
  },
  {
    name: 'no_acknowledgment',
    type: 'no_acknowledgment',
    threshold: 60, // Alert if events not acknowledged within 60 seconds
    windowMinutes: 5,
    cooldownMinutes: 10,
  },
];

// ============================================
// Track Event Middleware
// ============================================

export interface TrackEventOptions {
  eventId: string;
  correlationId?: string;
  type: string;
  version: string;
  source: string;
  payload: Record<string, unknown>;
  startTime?: number;
}

/**
 * Middleware to track event emission
 * Use this to log ALL events as they are emitted
 */
export function trackEventMiddleware() {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();

    // Store start time on request for later use
    (req as any)._eventTrackingStartTime = startTime;
    (req as any)._eventTrackingId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Hook into response to track completion
    res.on('finish', async () => {
      const trackingId = (req as any)._eventTrackingId;
      const eventId = res.get('X-Event-Id') || trackingId;

      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await updateEventTracking(eventId, {
            emitStatus: 'emitted',
            emitLatencyMs: Date.now() - startTime,
            status: res.get('X-Event-Acknowledged') === 'true' ? 'processing' : 'emitted',
          });
        } else {
          await updateEventTracking(eventId, {
            emitStatus: 'failed',
            emitLatencyMs: Date.now() - startTime,
            status: 'failed',
            emitError: `HTTP ${res.statusCode}: ${res.statusMessage}`,
          });
        }
      } catch (error) {
        logger.error('Failed to update event tracking', {
          trackingId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    });

    next();
  };
}

/**
 * Track an event emission
 */
export async function trackEventEmission(
  options: TrackEventOptions
): Promise<IEventLogger> {
  const startTime = options.startTime || Date.now();
  const now = new Date();

  try {
    // Check if already exists (idempotency)
    let eventLog = await EventLogger.findOne({ eventId: options.eventId });

    if (eventLog) {
      // Update existing entry
      eventLog.emittedAt = now;
      eventLog.emitLatencyMs = Date.now() - startTime;
      eventLog.emitStatus = 'emitted';
      await eventLog.save();
    } else {
      // Create new tracking entry
      eventLog = new EventLogger({
        eventId: options.eventId,
        correlationId: options.correlationId,
        type: options.type,
        version: options.version,
        source: options.source,
        payload: options.payload,
        emittedAt: now,
        emitLatencyMs: Date.now() - startTime,
        emitStatus: 'emitted',
        status: 'emitted',
        totalLatencyMs: 0,
        acknowledgmentReceived: false,
        retryCount: 0,
      });
      await eventLog.save();
    }

    logger.debug('Event emission tracked', {
      eventId: options.eventId,
      type: options.type,
      emitLatencyMs: eventLog.emitLatencyMs,
    });

    return eventLog;
  } catch (error) {
    logger.error('Failed to track event emission', {
      eventId: options.eventId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Update event tracking entry
 */
export async function updateEventTracking(
  eventId: string,
  updates: Partial<{
    emitStatus: string;
    emitLatencyMs: number;
    emitError: string;
    acknowledgmentReceived: boolean;
    acknowledgedAt: Date;
    acknowledgmentSource: string;
    processingStartedAt: Date;
    processedAt: Date;
    processedBy: string;
    movedToDlqAt: Date;
    dlqReason: string;
    status: string;
    failureReason: string;
    retryCount: number;
  }>
): Promise<IEventLogger | null> {
  try {
    const eventLog = await EventLogger.findOneAndUpdate(
      { eventId },
      { $set: updates },
      { new: true }
    );

    if (eventLog) {
      // Calculate total latency if processing is complete
      if (eventLog.processedAt && eventLog.emittedAt) {
        eventLog.totalLatencyMs =
          new Date(eventLog.processedAt).getTime() -
          new Date(eventLog.emittedAt).getTime();
        eventLog.processingLatencyMs =
          eventLog.totalLatencyMs - eventLog.emitLatencyMs;
        await eventLog.save();
      }
    }

    return eventLog;
  } catch (error) {
    logger.error('Failed to update event tracking', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

// ============================================
// Event Delivery Verification
// ============================================

export interface DeliveryVerificationResult {
  eventId: string;
  delivered: boolean;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  acknowledgmentLatencyMs?: number;
  processingLatencyMs?: number;
  totalLatencyMs?: number;
  status: string;
  issues: string[];
}

/**
 * Verify event delivery - check if downstream services received the event
 */
export async function verifyEventDelivery(
  eventId: string,
  timeoutMs: number = 30000
): Promise<DeliveryVerificationResult> {
  const issues: string[] = [];
  let eventLog = await EventLogger.findOne({ eventId });

  if (!eventLog) {
    return {
      eventId,
      delivered: false,
      acknowledged: false,
      status: 'not_found',
      issues: ['Event not found in tracking table'],
    };
  }

  // Check if event was emitted
  if (!eventLog.emittedAt) {
    issues.push('Event was never emitted');
  }

  // Check acknowledgment
  if (!eventLog.acknowledgmentReceived) {
    const elapsedMs = Date.now() - new Date(eventLog.emittedAt).getTime();
    if (elapsedMs > timeoutMs) {
      issues.push(`No acknowledgment received within ${timeoutMs}ms timeout`);
    }
  }

  // Check processing status
  if (!eventLog.processedAt && eventLog.emitStatus === 'queued') {
    const elapsedMs = Date.now() - new Date(eventLog.emittedAt).getTime();
    if (elapsedMs > timeoutMs) {
      issues.push(`Event not processed within ${timeoutMs}ms timeout`);
    }
  }

  // Check for failures
  if (eventLog.status === 'failed') {
    issues.push(`Event processing failed: ${eventLog.failureReason || 'Unknown'}`);
  }

  // Check DLQ
  if (eventLog.status === 'dlq') {
    issues.push(`Event moved to DLQ: ${eventLog.dlqReason || 'Unknown'}`);
  }

  return {
    eventId,
    delivered: eventLog.emitStatus === 'queued' || eventLog.emitStatus === 'stored',
    acknowledged: eventLog.acknowledgmentReceived,
    acknowledgedAt: eventLog.acknowledgedAt,
    acknowledgedBy: eventLog.acknowledgmentSource,
    acknowledgmentLatencyMs: eventLog.acknowledgmentLatencyMs,
    processingLatencyMs: eventLog.processingLatencyMs,
    totalLatencyMs: eventLog.totalLatencyMs,
    status: eventLog.status,
    issues,
  };
}

/**
 * Batch verify multiple event deliveries
 */
export async function verifyBatchEventDelivery(
  eventIds: string[],
  timeoutMs: number = 30000
): Promise<Map<string, DeliveryVerificationResult>> {
  const results = new Map<string, DeliveryVerificationResult>();

  const events = await EventLogger.find({ eventId: { $in: eventIds } });
  const foundIds = new Set(events.map((e) => e.eventId));

  // Add missing events
  for (const eventId of eventIds) {
    if (!foundIds.has(eventId)) {
      results.set(eventId, {
        eventId,
        delivered: false,
        acknowledged: false,
        status: 'not_found',
        issues: ['Event not found in tracking table'],
      });
    }
  }

  // Verify found events
  const verifications = await Promise.all(
    events.map((e) => verifyEventDelivery(e.eventId, timeoutMs))
  );

  for (const verification of verifications) {
    results.set(verification.eventId, verification);
  }

  return results;
}

/**
 * Record event acknowledgment from downstream service
 */
export async function recordEventAcknowledgment(
  eventId: string,
  source: string
): Promise<IEventLogger | null> {
  const eventLog = await EventLogger.findOne({ eventId });

  if (!eventLog) {
    logger.warn('Acknowledgment received for unknown event', { eventId, source });
    return null;
  }

  const now = new Date();
  const acknowledgmentLatencyMs =
    now.getTime() - new Date(eventLog.emittedAt).getTime();

  eventLog.acknowledgmentReceived = true;
  eventLog.acknowledgedAt = now;
  eventLog.acknowledgmentSource = source;
  eventLog.acknowledgmentLatencyMs = acknowledgmentLatencyMs;
  eventLog.status = 'processing';

  await eventLog.save();

  logger.info('Event acknowledgment recorded', {
    eventId,
    source,
    acknowledgmentLatencyMs,
  });

  return eventLog;
}

// ============================================
// Event Latency Tracking
// ============================================

export interface LatencyMetrics {
  eventType: string;
  emitLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    count: number;
  };
  acknowledgmentLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    count: number;
  };
  processingLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    count: number;
  };
  totalLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    count: number;
  };
}

/**
 * Calculate latency percentiles
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get latency metrics for events
 */
export async function getEventLatencyMetrics(
  eventType?: string,
  windowMinutes: number = 60
): Promise<LatencyMetrics> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const query: Record<string, unknown> = { emittedAt: { $gte: since } };

  if (eventType) {
    query.type = eventType;
  }

  const events = await EventLogger.find(query).lean();

  const emitLatencies = events
    .map((e) => e.emitLatencyMs)
    .filter((l): l is number => l > 0);
  const ackLatencies = events
    .map((e) => e.acknowledgmentLatencyMs)
    .filter((l): l is number => l !== undefined && l > 0);
  const procLatencies = events
    .map((e) => e.processingLatencyMs)
    .filter((l): l is number => l !== undefined && l > 0);
  const totalLatencies = events
    .map((e) => e.totalLatencyMs)
    .filter((l): l is number => l > 0);

  const calculateMetrics = (values: number[]) => ({
    avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    p50: calculatePercentile(values, 50),
    p95: calculatePercentile(values, 95),
    p99: calculatePercentile(values, 99),
    max: Math.max(...values, 0),
    min: Math.min(...values, 0),
    count: values.length,
  });

  return {
    eventType: eventType || 'all',
    emitLatency: calculateMetrics(emitLatencies),
    acknowledgmentLatency: calculateMetrics(ackLatencies),
    processingLatency: calculateMetrics(procLatencies),
    totalLatency: calculateMetrics(totalLatencies),
  };
}

/**
 * Get events with high latency
 */
export async function getHighLatencyEvents(
  thresholdMs: number = 5000,
  limit: number = 100
): Promise<IEventLogger[]> {
  return EventLogger.find({
    $or: [
      { emitLatencyMs: { $gt: thresholdMs } },
      { totalLatencyMs: { $gt: thresholdMs } },
    ],
    emittedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
    .sort({ totalLatencyMs: -1 })
    .limit(limit);
}

// ============================================
// DLQ Monitoring
// ============================================

export interface DLQMetrics {
  totalDlqEvents: number;
  dlqGrowthRate: number; // events per minute
  dlqByType: Record<string, number>;
  oldestDlqEvent?: Date;
  recentDlqEvents: IEventLogger[];
}

/**
 * Get DLQ metrics and monitor for growth
 */
export async function getDlqMetrics(
  windowMinutes: number = 5
): Promise<DLQMetrics> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const dlqEvents = await EventLogger.find({
    status: 'dlq',
    movedToDlqAt: { $gte: since },
  });

  const allDlqEvents = await EventLogger.find({
    status: 'dlq',
  }).sort({ movedToDlqAt: -1 });

  // Calculate growth rate (events per minute)
  const growthRate =
    windowMinutes > 0 ? dlqEvents.length / windowMinutes : 0;

  // Group by type
  const dlqByType: Record<string, number> = {};
  for (const event of allDlqEvents) {
    dlqByType[event.type] = (dlqByType[event.type] || 0) + 1;
  }

  return {
    totalDlqEvents: allDlqEvents.length,
    dlqGrowthRate: growthRate,
    dlqByType,
    oldestDlqEvent:
      allDlqEvents.length > 0
        ? allDlqEvents[allDlqEvents.length - 1].movedToDlqAt
        : undefined,
    recentDlqEvents: dlqEvents.slice(0, 10),
  };
}

/**
 * Check if DLQ is growing excessively
 */
export async function checkDlqGrowth(): Promise<{
  isGrowing: boolean;
  growthRate: number;
  thresholdExceeded: boolean;
  threshold: number;
}> {
  const metrics = await getDlqMetrics(5);

  // Default threshold: 10 events per minute
  const threshold =
    (await AlertConfig.findOne({ name: 'dlq_growth_rate' }))?.threshold || 10;

  return {
    isGrowing: metrics.dlqGrowthRate > 0,
    growthRate: metrics.dlqGrowthRate,
    thresholdExceeded: metrics.dlqGrowthRate > threshold,
    threshold,
  };
}

// ============================================
// Alert Functions
// ============================================

export interface AlertResult {
  alertName: string;
  alertType: string;
  triggered: boolean;
  message: string;
  metricValue: number;
  threshold: number;
  eventIds: string[];
}

/**
 * Alert on event failure - check for failure conditions and trigger alerts
 */
export async function alertOnEventFailure(): Promise<AlertResult[]> {
  const results: AlertResult[] = [];

  // Ensure alert configs exist
  await ensureAlertConfigs();

  // Get all enabled alert configs
  const alertConfigs = await AlertConfig.find({ enabled: true });
  const now = new Date();

  for (const config of alertConfigs) {
    // Check cooldown
    if (
      config.lastTriggeredAt &&
      now.getTime() - new Date(config.lastTriggeredAt).getTime() <
        config.cooldownMinutes * 60 * 1000
    ) {
      continue; // Still in cooldown
    }

    let result: AlertResult | null = null;

    switch (config.type) {
      case 'dlq_growth':
        result = await checkDlqGrowthAlert(config);
        break;
      case 'latency_threshold':
        result = await checkLatencyThresholdAlert(config);
        break;
      case 'failure_rate':
        result = await checkFailureRateAlert(config);
        break;
      case 'no_acknowledgment':
        result = await checkNoAcknowledgmentAlert(config);
        break;
    }

    if (result && result.triggered) {
      results.push(result);

      // Update last triggered time
      config.lastTriggeredAt = now;
      await config.save();

      // Log the alert
      logger.warn('Event alert triggered', {
        alertName: result.alertName,
        alertType: result.alertType,
        metricValue: result.metricValue,
        threshold: result.threshold,
        eventCount: result.eventIds.length,
      });
    }
  }

  return results;
}

/**
 * Check DLQ growth alert
 */
async function checkDlqGrowthAlert(
  alertConfig: IAlertConfig
): Promise<AlertResult | null> {
  const metrics = await getDlqMetrics(alertConfig.windowMinutes);

  if (metrics.dlqGrowthRate > alertConfig.threshold) {
    // Log alert
    await logAlert(alertConfig, metrics.dlqGrowthRate, alertConfig.threshold, {
      dlqGrowthRate: metrics.dlqGrowthRate,
      totalDlqEvents: metrics.totalDlqEvents,
      dlqByType: metrics.dlqByType,
    });

    return {
      alertName: alertConfig.name,
      alertType: alertConfig.type,
      triggered: true,
      message: `DLQ growth rate exceeded threshold: ${metrics.dlqGrowthRate.toFixed(
        2
      )} events/min > ${alertConfig.threshold} events/min`,
      metricValue: metrics.dlqGrowthRate,
      threshold: alertConfig.threshold,
      eventIds: metrics.recentDlqEvents.map((e) => e.eventId),
    };
  }

  return null;
}

/**
 * Check latency threshold alert
 */
async function checkLatencyThresholdAlert(
  alertConfig: IAlertConfig
): Promise<AlertResult | null> {
  const since = new Date(
    Date.now() - alertConfig.windowMinutes * 60 * 1000
  );

  const highLatencyEvents = await EventLogger.find({
    totalLatencyMs: { $gt: alertConfig.threshold },
    emittedAt: { $gte: since },
  }).limit(100);

  if (highLatencyEvents.length > 0) {
    const avgLatency =
      highLatencyEvents.reduce((sum, e) => sum + e.totalLatencyMs, 0) /
      highLatencyEvents.length;

    await logAlert(alertConfig, avgLatency, alertConfig.threshold, {
      eventCount: highLatencyEvents.length,
      avgLatency,
      maxLatency: Math.max(...highLatencyEvents.map((e) => e.totalLatencyMs)),
    });

    return {
      alertName: alertConfig.name,
      alertType: alertConfig.type,
      triggered: true,
      message: `High event latency detected: ${highLatencyEvents.length} events with avg ${avgLatency.toFixed(
        0
      )}ms > ${alertConfig.threshold}ms threshold`,
      metricValue: avgLatency,
      threshold: alertConfig.threshold,
      eventIds: highLatencyEvents.slice(0, 20).map((e) => e.eventId),
    };
  }

  return null;
}

/**
 * Check failure rate alert
 */
async function checkFailureRateAlert(
  alertConfig: IAlertConfig
): Promise<AlertResult | null> {
  const since = new Date(
    Date.now() - alertConfig.windowMinutes * 60 * 1000
  );

  const [totalEvents, failedEvents] = await Promise.all([
    EventLogger.countDocuments({ emittedAt: { $gte: since } }),
    EventLogger.countDocuments({
      emittedAt: { $gte: since },
      status: 'failed',
    }),
  ]);

  if (totalEvents > 0) {
    const failureRate = failedEvents / totalEvents;

    if (failureRate > alertConfig.threshold) {
      const failedEventDocs = await EventLogger.find({
        emittedAt: { $gte: since },
        status: 'failed',
      }).limit(50);

      await logAlert(alertConfig, failureRate, alertConfig.threshold, {
        totalEvents,
        failedEvents,
        failureRate,
      });

      return {
        alertName: alertConfig.name,
        alertType: alertConfig.type,
        triggered: true,
        message: `Event failure rate exceeded threshold: ${(
          failureRate * 100
        ).toFixed(1)}% > ${(alertConfig.threshold * 100).toFixed(1)}%`,
        metricValue: failureRate,
        threshold: alertConfig.threshold,
        eventIds: failedEventDocs.map((e) => e.eventId),
      };
    }
  }

  return null;
}

/**
 * Check no acknowledgment alert
 */
async function checkNoAcknowledgmentAlert(
  alertConfig: IAlertConfig
): Promise<AlertResult | null> {
  const thresholdMs = alertConfig.threshold * 1000;
  const cutoff = new Date(Date.now() - thresholdMs);

  const unacknowledgedEvents = await EventLogger.find({
    emittedAt: { $lt: cutoff },
    acknowledgmentReceived: false,
    status: { $nin: ['completed', 'failed', 'dlq'] },
  }).limit(50);

  if (unacknowledgedEvents.length > 0) {
    await logAlert(alertConfig, unacknowledgedEvents.length, 0, {
      unacknowledgedCount: unacknowledgedEvents.length,
      oldestUnacknowledged: unacknowledgedEvents[0]?.emittedAt,
    });

    return {
      alertName: alertConfig.name,
      alertType: alertConfig.type,
      triggered: true,
      message: `${unacknowledgedEvents.length} events not acknowledged within ${alertConfig.threshold} seconds`,
      metricValue: unacknowledgedEvents.length,
      threshold: alertConfig.threshold,
      eventIds: unacknowledgedEvents.map((e) => e.eventId),
    };
  }

  return null;
}

/**
 * Ensure default alert configs exist
 */
async function ensureAlertConfigs(): Promise<void> {
  for (const config of DEFAULT_ALERT_CONFIGS) {
    const existing = await AlertConfig.findOne({ name: config.name });
    if (!existing) {
      await AlertConfig.create(config);
    }
  }
}

/**
 * Log alert to database
 */
async function logAlert(
  alertConfig: IAlertConfig,
  metricValue: number,
  threshold: number,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await AlertLog.create({
      alertConfigId: alertConfig._id,
      alertName: alertConfig.name,
      alertType: alertConfig.type,
      triggeredAt: new Date(),
      metricValue,
      threshold,
      eventIds: [],
      details,
      acknowledged: false,
    });
  } catch (error) {
    logger.error('Failed to log alert', {
      alertName: alertConfig.name,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Get unacknowledged alerts
 */
export async function getUnacknowledgedAlerts(): Promise<IAlertLog[]> {
  return AlertLog.find({ acknowledged: false })
    .sort({ triggeredAt: -1 })
    .limit(50)
    .populate('alertConfigId');
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<boolean> {
  try {
    await AlertLog.findByIdAndUpdate(alertId, {
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy,
    });
    return true;
  } catch (error) {
    logger.error('Failed to acknowledge alert', {
      alertId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

// ============================================
// Event Status Update Helpers
// ============================================

/**
 * Mark event as processing started
 */
export async function markEventProcessingStarted(
  eventId: string,
  processorId?: string
): Promise<void> {
  await updateEventTracking(eventId, {
    processingStartedAt: new Date(),
    status: 'processing',
    processedBy: processorId,
  });
}

/**
 * Mark event as completed
 */
export async function markEventCompleted(
  eventId: string,
  processorId?: string
): Promise<void> {
  await updateEventTracking(eventId, {
    processedAt: new Date(),
    status: 'completed',
    processedBy: processorId,
  });
}

/**
 * Mark event as failed
 */
export async function markEventFailedByTracker(
  eventId: string,
  reason: string,
  incrementRetry: boolean = false
): Promise<void> {
  const update: Parameters<typeof updateEventTracking>[1] = {
    status: 'failed',
    failureReason: reason,
  };

  if (incrementRetry) {
    update.retryCount = 1; // Will be incremented via atomic operation
  }

  await EventLogger.findOneAndUpdate(
    { eventId },
    {
      $set: {
        status: 'failed',
        failureReason: reason,
        ...(update.processingStartedAt !== undefined && {
          processedAt: new Date(),
        }),
      },
      $inc: incrementRetry ? { retryCount: 1 } : {},
    }
  );
}

/**
 * Move event to DLQ
 */
export async function moveEventToDlq(
  eventId: string,
  reason: string
): Promise<void> {
  await updateEventTracking(eventId, {
    movedToDlqAt: new Date(),
    dlqReason: reason,
    status: 'dlq',
  });
}

// ============================================
// Scheduled Alert Checker
// ============================================

let alertCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic alert checking
 */
export function startAlertChecker(intervalMs: number = 60000): void {
  if (alertCheckInterval) {
    clearInterval(alertCheckInterval);
  }

  alertCheckInterval = setInterval(async () => {
    try {
      const alerts = await alertOnEventFailure();
      if (alerts.length > 0) {
        logger.info('Event alerts triggered', {
          count: alerts.length,
          alerts: alerts.map((a) => ({
            name: a.alertName,
            type: a.alertType,
            message: a.message,
          })),
        });
      }
    } catch (error) {
      logger.error('Alert check failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }, intervalMs);

  logger.info('Alert checker started', { intervalMs });
}

/**
 * Stop periodic alert checking
 */
export function stopAlertChecker(): void {
  if (alertCheckInterval) {
    clearInterval(alertCheckInterval);
    alertCheckInterval = null;
    logger.info('Alert checker stopped');
  }
}

// ============================================
// API Endpoints for Event Tracking
// ============================================

import { Router } from 'express';

const trackingRouter = Router();

/**
 * GET /tracking/events - Get tracked events
 */
trackingRouter.get('/events', async (req, res) => {
  try {
    const {
      type,
      status,
      limit = 100,
      offset = 0,
      since,
    } = req.query;

    const query: Record<string, unknown> = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (since) query.emittedAt = { $gte: new Date(since as string) };

    const [events, total] = await Promise.all([
      EventLogger.find(query)
        .sort({ emittedAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit)),
      EventLogger.countDocuments(query),
    ]);

    res.json({ events, total, offset, limit });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get tracked events',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * GET /tracking/events/:eventId - Get specific tracked event
 */
trackingRouter.get('/events/:eventId', async (req, res) => {
  try {
    const event = await EventLogger.findOne({ eventId: req.params.eventId });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get tracked event',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * GET /tracking/events/:eventId/verify - Verify event delivery
 */
trackingRouter.get('/events/:eventId/verify', async (req, res) => {
  try {
    const timeoutMs = Number(req.query.timeout) || 30000;
    const result = await verifyEventDelivery(req.params.eventId, timeoutMs);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to verify event delivery',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * POST /tracking/events/:eventId/acknowledge - Record acknowledgment
 */
trackingRouter.post('/events/:eventId/acknowledge', async (req, res) => {
  try {
    const { source } = req.body;
    const event = await recordEventAcknowledgment(req.params.eventId, source);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to record acknowledgment',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * GET /tracking/metrics - Get latency metrics
 */
trackingRouter.get('/metrics', async (req, res) => {
  try {
    const { eventType, windowMinutes = 60 } = req.query;
    const metrics = await getEventLatencyMetrics(
      eventType as string | undefined,
      Number(windowMinutes)
    );
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * GET /tracking/dlq - Get DLQ metrics
 */
trackingRouter.get('/dlq', async (req, res) => {
  try {
    const { windowMinutes = 5 } = req.query;
    const metrics = await getDlqMetrics(Number(windowMinutes));
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get DLQ metrics',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * GET /tracking/alerts - Get unacknowledged alerts
 */
trackingRouter.get('/alerts', async (req, res) => {
  try {
    const alerts = await getUnacknowledgedAlerts();
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * POST /tracking/alerts/:alertId/acknowledge - Acknowledge an alert
 */
trackingRouter.post('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { acknowledgedBy = 'system' } = req.body;
    const success = await acknowledgeAlert(req.params.alertId, acknowledgedBy);
    res.json({ success });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * POST /tracking/alerts/check - Trigger alert check
 */
trackingRouter.post('/alerts/check', async (req, res) => {
  try {
    const alerts = await alertOnEventFailure();
    res.json({ triggered: alerts.length, alerts });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check alerts',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

/**
 * GET /tracking/high-latency - Get high latency events
 */
trackingRouter.get('/high-latency', async (req, res) => {
  try {
    const { thresholdMs = 5000, limit = 100 } = req.query;
    const events = await getHighLatencyEvents(
      Number(thresholdMs),
      Number(limit)
    );
    res.json({ events });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get high latency events',
      message: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

export { trackingRouter };

// ============================================
// Utility Functions
// ============================================

/**
 * Get tracking summary stats
 */
export async function getTrackingSummary(): Promise<{
  totalTracked: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  avgLatencyMs: number;
  dlqCount: number;
}> {
  const [events, dlqMetrics] = await Promise.all([
    EventLogger.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgLatency: { $avg: '$totalLatencyMs' },
          byStatus: { $addToSet: '$status' },
          byType: { $addToSet: '$type' },
        },
      },
    ]),
    EventLogger.countDocuments({ status: 'dlq' }),
  ]);

  const statusCounts = await EventLogger.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const typeCounts = await EventLogger.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  const byStatus: Record<string, number> = {};
  for (const item of statusCounts) {
    byStatus[item._id] = item.count;
  }

  const byType: Record<string, number> = {};
  for (const item of typeCounts) {
    byType[item._id] = item.count;
  }

  return {
    totalTracked: events[0]?.total || 0,
    byStatus,
    byType,
    avgLatencyMs: events[0]?.avgLatency || 0,
    dlqCount: dlqMetrics,
  };
}

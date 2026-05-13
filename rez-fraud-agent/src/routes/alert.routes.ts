import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { FraudCase, FraudCaseSeverity } from '../models/FraudCase';
import { logger, logFraudAlert } from '../utils/logger';

const router = Router();

// Alert severity levels
export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertChannel {
  WEBHOOK = 'WEBHOOK',
  SLACK = 'SLACK',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

// Alert configuration
interface AlertConfig {
  webhookUrl?: string;
  slackWebhook?: string;
  emailRecipients?: string[];
  smsRecipients?: string[];
}

const alertConfig: AlertConfig = {
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  slackWebhook: process.env.ALERT_SLACK_WEBHOOK,
};

// Alert types
export interface FraudAlert {
  alertId: string;
  type: 'FRAUD_CASE' | 'VELOCITY_VIOLATION' | 'BLACKLIST_MATCH' | 'HIGH_RISK_TRANSACTION';
  severity: AlertSeverity;
  timestamp: Date;
  data: {
    fraudCaseId?: string;
    transactionId?: string;
    userId?: string;
    riskScore?: number;
    decision?: string;
    patterns?: string[];
    message: string;
  };
  channels: AlertChannel[];
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt?: Date;
  retryCount: number;
}

// Alert storage (in production, use Redis or database)
const alertQueue: FraudAlert[] = [];
const sentAlerts: FraudAlert[] = [];

// Validation schemas
const alertCreateSchema = z.object({
  type: z.enum(['FRAUD_CASE', 'VELOCITY_VIOLATION', 'BLACKLIST_MATCH', 'HIGH_RISK_TRANSACTION']),
  severity: z.nativeEnum(AlertSeverity),
  fraudCaseId: z.string().optional(),
  transactionId: z.string().optional(),
  userId: z.string().optional(),
  riskScore: z.number().optional(),
  decision: z.string().optional(),
  patterns: z.array(z.string()).optional(),
  message: z.string().min(1),
  channels: z.array(z.nativeEnum(AlertChannel)).optional().default([AlertChannel.WEBHOOK]),
});

// Severity to alert severity mapping
function mapCaseSeverityToAlertSeverity(severity: FraudCaseSeverity): AlertSeverity {
  switch (severity) {
    case FraudCaseSeverity.CRITICAL:
      return AlertSeverity.CRITICAL;
    case FraudCaseSeverity.HIGH:
      return AlertSeverity.HIGH;
    case FraudCaseSeverity.MEDIUM:
      return AlertSeverity.MEDIUM;
    default:
      return AlertSeverity.LOW;
  }
}

// Generate alert ID
function generateAlertId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `ALT-${timestamp}-${random}`.toUpperCase();
}

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware for internal service authentication
const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-internal-token'] as string;
  const expectedTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');

  if (Object.keys(expectedTokens).length === 0 && process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!token || !Object.values(expectedTokens).includes(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// ============= ALERT CREATION =============

/**
 * POST /api/alerts
 * Create a new alert
 */
router.post(
  '/',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = alertCreateSchema.parse(req.body);

    const alert: FraudAlert = {
      alertId: generateAlertId(),
      type: validatedData.type,
      severity: validatedData.severity,
      timestamp: new Date(),
      data: {
        fraudCaseId: validatedData.fraudCaseId,
        transactionId: validatedData.transactionId,
        userId: validatedData.userId,
        riskScore: validatedData.riskScore,
        decision: validatedData.decision,
        patterns: validatedData.patterns,
        message: validatedData.message,
      },
      channels: validatedData.channels,
      status: 'PENDING',
      retryCount: 0,
    };

    // Add to queue
    alertQueue.push(alert);

    // Log the alert
    logFraudAlert(`Alert created: ${alert.type}`, {
      alertId: alert.alertId,
      severity: alert.severity,
      fraudCaseId: alert.data.fraudCaseId,
      transactionId: alert.data.transactionId,
      riskScore: alert.data.riskScore,
    });

    // Send alert asynchronously
    sendAlert(alert);

    res.status(201).json({
      success: true,
      alert: {
        alertId: alert.alertId,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        timestamp: alert.timestamp,
      },
    });
  })
);

/**
 * POST /api/alerts/from-case/:caseId
 * Create alert from existing fraud case
 */
router.post(
  '/from-case/:caseId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { caseId } = req.params;

    const fraudCase = await FraudCase.findOne({ caseId }).lean();

    if (!fraudCase) {
      res.status(404).json({ error: 'Fraud case not found' });
      return;
    }

    const alertType = fraudCase.severity === FraudCaseSeverity.CRITICAL
      ? 'HIGH_RISK_TRANSACTION'
      : 'FRAUD_CASE';

    const alert: FraudAlert = {
      alertId: generateAlertId(),
      type: alertType as FraudAlert['type'],
      severity: mapCaseSeverityToAlertSeverity(fraudCase.severity),
      timestamp: new Date(),
      data: {
        fraudCaseId: fraudCase.caseId,
        transactionId: fraudCase.transactionId,
        userId: fraudCase.userId,
        riskScore: fraudCase.riskScore,
        patterns: fraudCase.detectedPatterns.map(p => p.patternName),
        message: `Fraud case ${caseId} requires attention. Risk score: ${fraudCase.riskScore}`,
      },
      channels: [AlertChannel.WEBHOOK],
      status: 'PENDING',
      retryCount: 0,
    };

    alertQueue.push(alert);
    sendAlert(alert);

    logFraudAlert(`Alert created from fraud case`, {
      alertId: alert.alertId,
      caseId,
      severity: alert.severity,
    });

    res.status(201).json({
      success: true,
      alert: {
        alertId: alert.alertId,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
      },
    });
  })
);

// ============= ALERT SENDING =============

async function sendAlert(alert: FraudAlert): Promise<void> {
  for (const channel of alert.channels) {
    try {
      switch (channel) {
        case AlertChannel.WEBHOOK:
          await sendWebhookAlert(alert);
          break;
        case AlertChannel.SLACK:
          await sendSlackAlert(alert);
          break;
        case AlertChannel.EMAIL:
          await sendEmailAlert(alert);
          break;
        case AlertChannel.SMS:
          await sendSMSAlert(alert);
          break;
      }
    } catch (error) {
      logger.error('Failed to send alert via channel', {
        alertId: alert.alertId,
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Update alert status
  alert.status = 'SENT';
  alert.sentAt = new Date();
  sentAlerts.push(alert);

  // Remove from queue
  const queueIndex = alertQueue.findIndex(a => a.alertId === alert.alertId);
  if (queueIndex !== -1) {
    alertQueue.splice(queueIndex, 1);
  }
}

async function sendWebhookAlert(alert: FraudAlert): Promise<void> {
  if (!alertConfig.webhookUrl) {
    logger.warn('Webhook URL not configured');
    return;
  }

  const payload = {
    alertId: alert.alertId,
    type: alert.type,
    severity: alert.severity,
    timestamp: alert.timestamp,
    data: alert.data,
    source: 'rez-fraud-agent',
  };

  await axios.post(alertConfig.webhookUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Alert-Id': alert.alertId,
      'X-Alert-Severity': alert.severity,
    },
    timeout: 10000,
  });

  logger.info('Webhook alert sent', { alertId: alert.alertId });
}

async function sendSlackAlert(alert: FraudAlert): Promise<void> {
  if (!alertConfig.slackWebhook) {
    logger.warn('Slack webhook not configured');
    return;
  }

  const severityEmoji = {
    [AlertSeverity.LOW]: ':large_yellow_circle:',
    [AlertSeverity.MEDIUM]: ':large_orange_circle:',
    [AlertSeverity.HIGH]: ':red_circle:',
    [AlertSeverity.CRITICAL]: ':fire:',
  };

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji[alert.severity]} Fraud Alert: ${alert.type}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${alert.severity}`,
          },
          {
            type: 'mrkdwn',
            text: `*Risk Score:*\n${alert.data.riskScore || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Case ID:*\n${alert.data.fraudCaseId || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Transaction:*\n${alert.data.transactionId || 'N/A'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Message:*\n${alert.data.message}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Alert ID: ${alert.alertId} | ${new Date(alert.timestamp).toISOString()}`,
          },
        ],
      },
    ],
  };

  await axios.post(alertConfig.slackWebhook, payload, {
    timeout: 10000,
  });

  logger.info('Slack alert sent', { alertId: alert.alertId });
}

async function sendEmailAlert(alert: FraudAlert): Promise<void> {
  // Email implementation would go here
  // Use nodemailer or email service like SendGrid
  logger.info('Email alert queued', { alertId: alert.alertId });
}

async function sendSMSAlert(alert: FraudAlert): Promise<void> {
  // SMS implementation would go here
  // Use Twilio or similar service
  logger.info('SMS alert queued', { alertId: alert.alertId });
}

// ============= ALERT RETRIEVAL =============

/**
 * GET /api/alerts
 * List alerts with filtering
 */
router.get(
  '/',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      type,
      severity,
      status,
      limit = '50',
      offset = '0',
    } = req.query;

    let filtered = [...sentAlerts];

    if (type) {
      filtered = filtered.filter(a => a.type === type);
    }
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }
    if (status) {
      filtered = filtered.filter(a => a.status === status);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = filtered.length;
    const parsedLimit = Math.min(parseInt(limit as string, 10), 100);
    const parsedOffset = parseInt(offset as string, 10);

    const paginated = filtered.slice(parsedOffset, parsedOffset + parsedLimit);

    res.json({
      alerts: paginated.map(alert => ({
        alertId: alert.alertId,
        type: alert.type,
        severity: alert.severity,
        timestamp: alert.timestamp,
        sentAt: alert.sentAt,
        status: alert.status,
        data: {
          fraudCaseId: alert.data.fraudCaseId,
          transactionId: alert.data.transactionId,
          riskScore: alert.data.riskScore,
          message: alert.data.message,
        },
      })),
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + paginated.length < total,
      },
    });
  })
);

/**
 * GET /api/alerts/queue
 * Get pending alerts in queue
 */
router.get(
  '/queue',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      queueSize: alertQueue.length,
      alerts: alertQueue.map(alert => ({
        alertId: alert.alertId,
        type: alert.type,
        severity: alert.severity,
        timestamp: alert.timestamp,
        retryCount: alert.retryCount,
      })),
    });
  })
);

/**
 * GET /api/alerts/:alertId
 * Get alert details
 */
router.get(
  '/:alertId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;

    const alert = [...alertQueue, ...sentAlerts].find(a => a.alertId === alertId);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json({ alert });
  })
);

// ============= ALERT MANAGEMENT =============

/**
 * POST /api/alerts/:alertId/retry
 * Retry sending a failed alert
 */
router.post(
  '/:alertId/retry',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;

    const alert = sentAlerts.find(a => a.alertId === alertId);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    if (alert.status !== 'FAILED') {
      res.status(400).json({ error: 'Alert is not in failed state' });
      return;
    }

    alert.status = 'PENDING';
    alert.retryCount += 1;

    await sendAlert(alert);

    res.json({
      success: true,
      alert: {
        alertId: alert.alertId,
        status: alert.status,
        retryCount: alert.retryCount,
      },
    });
  })
);

/**
 * DELETE /api/alerts/:alertId
 * Delete/cancel an alert
 */
router.delete(
  '/:alertId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;

    const queueIndex = alertQueue.findIndex(a => a.alertId === alertId);
    if (queueIndex !== -1) {
      alertQueue.splice(queueIndex, 1);
      res.json({ success: true, message: 'Alert removed from queue' });
      return;
    }

    const sentIndex = sentAlerts.findIndex(a => a.alertId === alertId);
    if (sentIndex !== -1) {
      sentAlerts.splice(sentIndex, 1);
      res.json({ success: true, message: 'Alert removed from history' });
      return;
    }

    res.status(404).json({ error: 'Alert not found' });
  })
);

// ============= ALERT STATS =============

/**
 * GET /api/alerts/stats
 * Get alert statistics
 */
router.get(
  '/stats',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const totalSent = sentAlerts.length;
    const queueSize = alertQueue.length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const alert of sentAlerts) {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byStatus[alert.status] = (byStatus[alert.status] || 0) + 1;
    }

    res.json({
      totalSent,
      queueSize,
      byType,
      bySeverity,
      byStatus,
    });
  })
);

// ============= HEALTH CHECK =============

/**
 * GET /api/alerts/health
 * Health check for alert service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-fraud-agent-alerts',
    queueSize: alertQueue.length,
    sentCount: sentAlerts.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;

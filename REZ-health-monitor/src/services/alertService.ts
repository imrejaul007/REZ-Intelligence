import { logger } from './logger.js';

/**
 * Alert Service
 * Sends alerts when services fail or circuit breakers open
 */

import axios from 'axios';
import { getHealthMonitorConfig } from '../config/index.js';
import { CircuitState } from './circuitBreaker.js';
import { randomUUID } from 'crypto';

export interface AlertPayload {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  error: string | null;
  circuitState: CircuitState;
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'service_down' | 'circuit_opened' | 'circuit_recovered' | 'service_recovered';
  serviceName: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Alert history (in-memory for simplicity)
const alertHistory: Alert[] = [];
const MAX_ALERT_HISTORY = 100;

const _ALERT_SEVERITY_COLORS: Record<Alert['severity'], string> = {
  critical: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
};

/**
 * Send an alert for a service failure
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const config = getHealthMonitorConfig();

  const alert: Alert = {
    id: `alert_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 9)}`,
    type: payload.circuitState === CircuitState.OPEN ? 'circuit_opened' : 'service_down',
    serviceName: payload.serviceName,
    message: `${payload.serviceName} is ${payload.status}${payload.error ? `: ${payload.error}` : ''}`,
    severity: payload.status === 'down' ? 'critical' : 'warning',
    timestamp: payload.timestamp,
    metadata: {
      circuitState: payload.circuitState,
      error: payload.error,
    },
  };

  // Store in history
  addToHistory(alert);

  // Send webhook notification if configured
  if (config.alert.webhookUrl) {
    await sendWebhookAlert(config.alert.webhookUrl, alert);
  }

  // Log the alert
  console.log(
    `[ALERT] ${alert.severity.toUpperCase()} - ${alert.serviceName}: ${alert.message}`
  );
}

/**
 * Send a recovery notification
 */
export async function sendRecoveryAlert(
  serviceName: string,
  circuitState: CircuitState
): Promise<void> {
  const config = getHealthMonitorConfig();

  const alert: Alert = {
    id: `alert_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 9)}`,
    type: circuitState === CircuitState.HALF_OPEN ? 'circuit_recovered' : 'service_recovered',
    serviceName,
    message: `${serviceName} has recovered. Circuit state: ${circuitState}`,
    severity: 'info',
    timestamp: new Date().toISOString(),
    metadata: {
      circuitState,
    },
  };

  addToHistory(alert);

  if (config.alert.webhookUrl) {
    await sendWebhookAlert(config.alert.webhookUrl, alert);
  }

  logger.info(`[RECOVERY] ${serviceName}: ${alert.message}`);
}

/**
 * Send alert via webhook
 */
async function sendWebhookAlert(webhookUrl: string, alert: Alert): Promise<void> {
  try {
    await axios.post(webhookUrl, {
      text: formatSlackMessage(alert),
      blocks: formatSlackBlocks(alert),
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error(`Failed to send webhook alert for ${alert.serviceName}:`, error);
  }
}

/**
 * Format alert as Slack message
 */
function formatSlackMessage(alert: Alert): string {
  const emoji = alert.severity === 'critical' ? ':red_circle:' :
                alert.severity === 'warning' ? ':warning:' : ':information_source:';

  return `${emoji} *${alert.type.replace('_', ' ').toUpperCase()}*\n` +
         `*Service:* ${alert.serviceName}\n` +
         `*Message:* ${alert.message}\n` +
         `*Time:* ${alert.timestamp}`;
}

/**
 * Format alert as Slack blocks
 */
function formatSlackBlocks(alert: Alert): object[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${alert.type.replace('_', ' ').toUpperCase()}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Service:*\n${alert.serviceName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Severity:*\n${alert.severity.toUpperCase()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Time:*\n${alert.timestamp}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Message:*\n${alert.message}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Alert ID: ${alert.id}`,
        },
      ],
    },
  ];
}

/**
 * Get recent alerts
 */
export function getRecentAlerts(limit: number = 50): Alert[] {
  return alertHistory.slice(-limit);
}

/**
 * Get alerts for a specific service
 */
export function getAlertsForService(serviceName: string, limit: number = 20): Alert[] {
  return alertHistory
    .filter(alert => alert.serviceName === serviceName)
    .slice(-limit);
}

/**
 * Get alert summary
 */
export function getAlertSummary(): {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byService: Record<string, number>;
  last24Hours: number;
} {
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const summary = {
    total: alertHistory.length,
    critical: 0,
    warning: 0,
    info: 0,
    byService: {} as Record<string, number>,
    last24Hours: 0,
  };

  for (const alert of alertHistory) {
    summary[alert.severity]++;
    summary.byService[alert.serviceName] = (summary.byService[alert.serviceName] || 0) + 1;

    const alertTime = new Date(alert.timestamp).getTime();
    if (alertTime >= twentyFourHoursAgo) {
      summary.last24Hours++;
    }
  }

  return summary;
}

/**
 * Clear old alerts
 */
export function clearAlertHistory(): void {
  alertHistory.length = 0;
}

function addToHistory(alert: Alert): void {
  alertHistory.push(alert);

  // Keep history bounded
  while (alertHistory.length > MAX_ALERT_HISTORY) {
    alertHistory.shift();
  }
}

/**
 * Format alerts for dashboard display
 */
export function formatAlertsForDashboard(): {
  alerts: Alert[];
  summary: ReturnType<typeof getAlertSummary>;
} {
  return {
    alerts: getRecentAlerts(20),
    summary: getAlertSummary(),
  };
}

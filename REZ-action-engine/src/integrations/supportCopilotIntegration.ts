/**
 * Support Copilot Integration Module
 * Handles REZ-action-engine → REZ-support-copilot integrations
 *
 * Integrations:
 * - Notify support when action is triggered
 * - Create support ticket when action fails
 * - Log action events for support context
 */

import axios from 'axios';
import { logger } from '../config/logger';
import { config } from '../config';

const SUPPORT_COPILOT_URL = process.env.SUPPORT_COPILOT_URL || 'https://rez-support-copilot.onrender.com';

export interface ActionNotification {
  actionId: string;
  actionName: string;
  eventId: string;
  userId?: string;
  merchantId?: string;
  payload: Record<string, unknown>;
  status: 'triggered' | 'completed' | 'failed' | 'pending_approval';
  result?: Record<string, unknown>;
  error?: string;
  executionId: string;
  executionTimeMs: number;
  timestamp: Date;
}

export interface SupportTicketData {
  ticketId: string;
  category: 'action_failure' | 'action_issue' | 'system_error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  userId?: string;
  merchantId?: string;
  actionId?: string;
  eventId?: string;
}

/**
 * Notify support when an action is triggered
 * @param notification - Action notification data
 */
export async function notifySupportActionTriggered(notification: ActionNotification): Promise<void> {
  try {
    logger.info('Notifying support of action trigger', {
      actionId: notification.actionId,
      executionId: notification.executionId,
    });

    // Only notify for significant actions (not all triggers)
    const significantActions = [
      'inventory.critical.alert',
      'customer.refund.request',
      'order.issue.escalation',
      'merchant.suspension',
      'payment.failed',
    ];

    if (!significantActions.includes(notification.actionId)) {
      logger.debug('Action not significant enough for support notification', { actionId: notification.actionId });
      return;
    }

    await axios.post(`${SUPPORT_COPILOT_URL}/api/action/notification`, {
      type: 'action_triggered',
      notification: {
        actionId: notification.actionId,
        actionName: notification.actionName,
        eventId: notification.eventId,
        userId: notification.userId,
        merchantId: notification.merchantId,
        status: notification.status,
        payload: notification.payload,
        executionId: notification.executionId,
        timestamp: notification.timestamp.toISOString(),
      },
    }, { timeout: 5000 });

    logger.info('Support notified of action trigger', { actionId: notification.actionId });
  } catch (error) {
    logger.warn('Failed to notify support of action trigger', {
      actionId: notification.actionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Notify support when an action is completed
 * @param notification - Action notification data
 */
export async function notifySupportActionCompleted(notification: ActionNotification): Promise<void> {
  try {
    logger.info('Notifying support of action completion', {
      actionId: notification.actionId,
      executionId: notification.executionId,
    });

    // Only notify for completed critical actions
    const criticalActions = [
      'inventory.critical.alert',
      'customer.refund.approved',
      'order.issue.resolved',
      'merchant.reinstatement',
    ];

    if (!criticalActions.includes(notification.actionId)) {
      return;
    }

    await axios.post(`${SUPPORT_COPILOT_URL}/api/action/notification`, {
      type: 'action_completed',
      notification: {
        actionId: notification.actionId,
        actionName: notification.actionName,
        eventId: notification.eventId,
        userId: notification.userId,
        merchantId: notification.merchantId,
        status: 'completed',
        result: notification.result,
        executionId: notification.executionId,
        executionTimeMs: notification.executionTimeMs,
        timestamp: notification.timestamp.toISOString(),
      },
    }, { timeout: 5000 });

    logger.info('Support notified of action completion', { actionId: notification.actionId });
  } catch (error) {
    logger.warn('Failed to notify support of action completion', {
      actionId: notification.actionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create support ticket when action fails
 * @param notification - Action notification with failure details
 * @returns Created ticket ID if successful
 */
export async function createSupportTicketForFailure(notification: ActionNotification): Promise<string | null> {
  try {
    logger.warn('Creating support ticket for action failure', {
      actionId: notification.actionId,
      executionId: notification.executionId,
      error: notification.error,
    });

    const ticketData: SupportTicketData = {
      ticketId: `ACTION-FAILURE-${notification.executionId}`,
      category: 'action_failure',
      priority: determinePriority(notification.actionId),
      title: `Action Failed: ${notification.actionName}`,
      description: formatFailureDescription(notification),
      metadata: {
        actionId: notification.actionId,
        actionName: notification.actionName,
        eventId: notification.eventId,
        userId: notification.userId,
        merchantId: notification.merchantId,
        payload: notification.payload,
        error: notification.error,
        executionId: notification.executionId,
        executionTimeMs: notification.executionTimeMs,
        source: 'action_engine',
        createdAt: new Date().toISOString(),
      },
      userId: notification.userId,
      merchantId: notification.merchantId,
      actionId: notification.actionId,
      eventId: notification.eventId,
    };

    const response = await axios.post(`${SUPPORT_COPILOT_URL}/webhook/ticket`, {
      ticket_id: ticketData.ticketId,
      user_id: ticketData.userId || 'system',
      category: ticketData.category,
      priority: ticketData.priority,
      content: ticketData.description,
      metadata: ticketData.metadata,
    }, { timeout: 5000 });

    logger.info('Support ticket created for action failure', {
      ticketId: response.data.ticket_id,
      actionId: notification.actionId,
    });

    return response.data.ticket_id;
  } catch (error) {
    logger.error('Failed to create support ticket for action failure', {
      actionId: notification.actionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Determine ticket priority based on action ID
 */
function determinePriority(actionId: string): 'low' | 'medium' | 'high' | 'urgent' {
  const urgentActions = [
    'payment.process',
    'customer.refund.request',
    'order.issue.escalation',
  ];

  const highPriorityActions = [
    'inventory.critical.alert',
    'merchant.suspension',
    'account.suspension',
  ];

  if (urgentActions.some(a => actionId.includes(a))) return 'urgent';
  if (highPriorityActions.some(a => actionId.includes(a))) return 'high';
  return 'medium';
}

/**
 * Format failure description for support ticket
 */
function formatFailureDescription(notification: ActionNotification): string {
  return `Action Execution Failed

Action ID: ${notification.actionId}
Action Name: ${notification.actionName}
Event ID: ${notification.eventId}
Execution ID: ${notification.executionId}

User ID: ${notification.userId || 'N/A'}
Merchant ID: ${notification.merchantId || 'N/A'}

Error Details:
${notification.error || 'Unknown error occurred'}

Payload:
${JSON.stringify(notification.payload, null, 2)}

Execution Time: ${notification.executionTimeMs}ms

This ticket was automatically created by the Action Engine due to action failure.`;
}

/**
 * Log action event for support context
 * @param eventType - Type of event
 * @param data - Event data
 */
export async function logActionEventForSupport(
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Also log to event platform
    const EVENT_PLATFORM = process.env.REZ_EVENT_PLATFORM_URL || 'https://REZ-event-platform.onrender.com';

    await axios.post(`${EVENT_PLATFORM}/api/events`, {
      source: 'rez-action-engine',
      type: eventType,
      data: {
        ...data,
        supportLogged: true,
        timestamp: new Date().toISOString(),
      },
    }, { timeout: 3000 });

    logger.debug('Action event logged for support', { eventType });
  } catch (error) {
    logger.warn('Failed to log action event', { eventType, error });
  }
}

/**
 * Get action context for support agent
 * @param executionId - Execution ID
 */
export async function getActionContextForSupport(executionId: string): Promise<Record<string, unknown> | null> {
  try {
    // This would typically query the action engine's history
    // For now, return null as we don't have access to the execution history
    return null;
  } catch (error) {
    logger.warn('Failed to get action context', { executionId });
    return null;
  }
}

/**
 * Notify support of approval queue item
 * @param approvalId - Approval request ID
 * @param actionId - Action ID
 * @param payload - Action payload
 */
export async function notifySupportApprovalRequired(
  approvalId: string,
  actionId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    logger.info('Notifying support of approval requirement', { approvalId, actionId });

    await axios.post(`${SUPPORT_COPILOT_URL}/api/action/notification`, {
      type: 'approval_required',
      notification: {
        approvalId,
        actionId,
        payload,
        timestamp: new Date().toISOString(),
      },
    }, { timeout: 5000 });
  } catch (error) {
    logger.warn('Failed to notify support of approval requirement', {
      approvalId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Wrapper function to handle action notification workflow
 * Call this after each action execution
 * @param result - Action execution result
 */
export async function handleActionNotification(
  result: {
    actionId: string;
    actionName: string;
    eventId: string;
    userId?: string;
    merchantId?: string;
    payload: Record<string, unknown>;
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
    executionId: string;
    executionTimeMs: number;
  }
): Promise<void> {
  const notification: ActionNotification = {
    ...result,
    status: result.success ? 'completed' : 'failed',
    timestamp: new Date(),
  };

  if (result.success) {
    await notifySupportActionCompleted(notification);
  } else {
    // Create support ticket for failures
    const ticketId = await createSupportTicketForFailure(notification);
    if (ticketId) {
      notification.result = { supportTicketId: ticketId };
    }
  }

  // Log event
  await logActionEventForSupport(
    result.success ? 'action.completed' : 'action.failed',
    {
      actionId: notification.actionId,
      executionId: notification.executionId,
      userId: notification.userId,
      merchantId: notification.merchantId,
      success: result.success,
    }
  );
}

import { v4 as uuidv4 } from 'uuid';
import { ActionRequest, ActionResult, ActionStatus, ActionLevel, ACTION_POLICIES } from '../types/action-levels';
import { getAction, requiresApproval } from '../rules/action-registry';
import { ApprovalQueue } from './approval-queue';
import { logger } from '../config/logger';
import { config } from '../config';
import { executeNextaBiZAction } from '../integrations/nextabizz';
import {
  handleActionNotification,
  notifySupportApprovalRequired,
} from '../integrations/supportCopilotIntegration';

/**
 * Core Action Engine
 *
 * Evaluates and executes actions based on:
 * - Action level and policy
 * - Auto-execute settings
 * - Approval requirements
 */
export class ActionEngine {
  private static instance: ActionEngine;
  private approvalQueue: ApprovalQueue;
  private executionHistory: ActionResult[] = [];

  private constructor() {
    this.approvalQueue = ApprovalQueue.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ActionEngine {
    if (!ActionEngine.instance) {
      ActionEngine.instance = new ActionEngine();
    }
    return ActionEngine.instance;
  }

  /**
   * Main entry point for executing an action
   */
  async executeAction(request: ActionRequest): Promise<ActionResult> {
    const startTime = Date.now();
    const executionId = uuidv4();

    logger.info('Processing action request', {
      executionId,
      actionId: request.actionId,
      eventId: request.eventId,
    });

    // Validate action exists
    const action = getAction(request.actionId);
    if (!action) {
      const result: ActionResult = {
        success: false,
        actionId: request.actionId,
        executionId,
        status: ActionStatus.FAILED,
        error: `Unknown action: ${request.actionId}`,
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
      this.executionHistory.push(result);
      return result;
    }

    // Check if action is forbidden
    if (action.level === ActionLevel.FORBIDDEN) {
      logger.warn('Forbidden action attempted', {
        executionId,
        actionId: request.actionId,
      });

      const result: ActionResult = {
        success: false,
        actionId: request.actionId,
        executionId,
        status: ActionStatus.FAILED,
        error: 'Action is forbidden and cannot be executed',
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
      this.executionHistory.push(result);
      return result;
    }

    // Get policy for this action level
    const policy = ACTION_POLICIES[action.level];

    // Check rate limiting
    if (policy.maxExecutionsPerHour) {
      const recentExecutions = this.getRecentExecutions(request.actionId, 60 * 60 * 1000);
      if (recentExecutions >= policy.maxExecutionsPerHour) {
        const result: ActionResult = {
          success: false,
          actionId: request.actionId,
          executionId,
          status: ActionStatus.FAILED,
          error: `Rate limit exceeded for action ${request.actionId}`,
          executedAt: new Date(),
          executionTimeMs: Date.now() - startTime,
        };
        this.executionHistory.push(result);
        return result;
      }
    }

    // Determine if approval is required
    const needsApproval = action.requiresApproval || (!action.autoExecute && requiresApproval(request.actionId));

    if (needsApproval) {
      // Queue for approval
      logger.info('Action requires approval', {
        executionId,
        actionId: request.actionId,
        level: action.level,
      });

      const approvalRequest = await this.approvalQueue.createApprovalRequest(
        request.actionId,
        request.eventId,
        request.payload,
        request.userId
      );

      // Notify support of approval requirement
      await notifySupportApprovalRequired(
        approvalRequest.id,
        request.actionId,
        request.payload
      );

      return {
        success: true,
        actionId: request.actionId,
        executionId,
        status: ActionStatus.PENDING,
        output: { approvalId: approvalRequest.id },
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Execute directly
    return this.performExecution(request, action, executionId, startTime);
  }

  /**
   * Perform the actual action execution
   */
  private async performExecution(
    request: ActionRequest,
    action: NonNullable<ReturnType<typeof getAction>>,
    executionId: string,
    startTime: number
  ): Promise<ActionResult> {
    logger.info('Executing action', {
      executionId,
      actionId: request.actionId,
      name: action.name,
    });

    try {
      // Execute the action based on its type
      const output = await this.executeActionLogic(action.id, request.payload);

      const result: ActionResult = {
        success: true,
        actionId: request.actionId,
        executionId,
        status: ActionStatus.COMPLETED,
        output,
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
      };

      this.executionHistory.push(result);

      // Notify support of action completion
      await handleActionNotification({
        actionId: request.actionId,
        actionName: action.name,
        eventId: request.eventId,
        userId: request.userId,
        payload: request.payload,
        success: true,
        result: output,
        executionId,
        executionTimeMs: result.executionTimeMs ?? Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Action execution failed', {
        executionId,
        actionId: request.actionId,
        error: errorMessage,
      });

      const result: ActionResult = {
        success: false,
        actionId: request.actionId,
        executionId,
        status: ActionStatus.FAILED,
        error: errorMessage,
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
      };

      this.executionHistory.push(result);

      // Notify support of action failure (creates support ticket)
      await handleActionNotification({
        actionId: request.actionId,
        actionName: action.name,
        eventId: request.eventId,
        userId: request.userId,
        payload: request.payload,
        success: false,
        error: errorMessage,
        executionId,
        executionTimeMs: result.executionTimeMs ?? Date.now() - startTime,
      });

      // Retry if configured
      if (action.retryable && action.maxRetries && action.maxRetries > 0) {
        logger.info('Scheduling retry', {
          executionId,
          actionId: request.actionId,
          maxRetries: action.maxRetries,
        });
        // Retry logic would go here
      }

      return result;
    }
  }

  /**
   * Execute action-specific logic
   */
  private async executeActionLogic(
    actionId: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Route to appropriate integration based on action type
    switch (actionId) {
      // Inventory actions
      case 'inventory.low.reorder_suggestion':
        return this.handleReorderSuggestion(payload);
      case 'inventory.critical.alert':
        return this.handleCriticalAlert(payload);

      // Customer actions
      case 'customer.order.ship_notification':
        return this.handleShipNotification(payload);
      case 'customer.abandoned_cart.reminder':
        return this.handleAbandonedCartReminder(payload);

      // Supplier actions
      case 'supplier.delivery.delay_notification':
        return this.handleDelayNotification(payload);

      // Financial actions
      case 'finance.invoice.auto_generation':
        return this.handleInvoiceGeneration(payload);

      // Dashboard actions
      case 'dashboard.daily_report':
        return this.handleDailyReport(payload);

      // Default: delegate to NextaBiZ integration
      default:
        return executeNextaBiZAction(actionId, payload);
    }
  }

  // Action handlers
  private async handleReorderSuggestion(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('Creating reorder suggestion', { payload });
    // Integration with inventory/procurement system
    return {
      type: 'reorder_suggestion',
      status: 'created',
      itemId: payload.itemId,
      suggestedQuantity: payload.suggestedQuantity || 100,
    };
  }

  private async handleCriticalAlert(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('Sending critical inventory alert', { payload });
    return {
      type: 'critical_alert',
      status: 'sent',
      channels: ['sms', 'email', 'push'],
    };
  }

  private async handleShipNotification(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('Sending shipment notification', { payload });
    return {
      type: 'ship_notification',
      status: 'sent',
      customerId: payload.customerId,
      orderId: payload.orderId,
    };
  }

  private async handleAbandonedCartReminder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('Sending abandoned cart reminder', { payload });
    return {
      type: 'cart_reminder',
      status: 'sent',
      customerId: payload.customerId,
      cartId: payload.cartId,
    };
  }

  private async handleDelayNotification(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('Sending delay notification', { payload });
    return {
      type: 'delay_notification',
      status: 'sent',
      supplierId: payload.supplierId,
      eta: payload.newEta,
    };
  }

  private async handleInvoiceGeneration(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('Generating invoice', { payload });
    return {
      type: 'invoice',
      status: 'generated',
      invoiceId: uuidv4(),
      orderId: payload.orderId,
    };
  }

  private async handleDailyReport(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('Generating daily report', { payload });
    return {
      type: 'daily_report',
      status: 'generated',
      reportId: uuidv4(),
      date: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Get recent executions for an action
   */
  private getRecentExecutions(actionId: string, timeWindowMs: number): number {
    const cutoff = Date.now() - timeWindowMs;
    return this.executionHistory.filter(
      (e) => e.actionId === actionId && e.executedAt.getTime() > cutoff
    ).length;
  }

  /**
   * Get execution history
   */
  getHistory(limit: number = 100): ActionResult[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get approval queue instance
   */
  getApprovalQueue(): ApprovalQueue {
    return this.approvalQueue;
  }
}

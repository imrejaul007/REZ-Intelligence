/**
 * REZ Flow Runtime - Node Handlers
 * Handler functions for each node type
 */

import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosError } from 'axios';
import {
  NodeType,
  NodeData,
  NodeResult,
  NodeStatus,
  ExecutionContext,
  WorkflowNode,
  TriggerType,
  TriggerConfig,
  ActionConfig,
  ConditionConfig,
  DelayConfig,
  SplitConfig,
  MergeConfig
} from '../types/workflow';
import logger from './logger';

export interface NodeHandlerContext {
  context: ExecutionContext;
  nodeResults: Map<string, NodeResult>;
  workflowNodes: WorkflowNode[];
}

export interface HandlerResult {
  output?: unknown;
  nextNodeIds: string[];
  shouldWait?: boolean;
  waitUntil?: Date;
}

// ==================== BASE HANDLER ====================

async function createNodeResult(
  nodeId: string,
  status: NodeStatus,
  output?: unknown,
  error?: string,
  errorDetails?: NodeResult['errorDetails']
): Promise<NodeResult> {
  return {
    nodeId,
    status,
    output,
    error,
    errorDetails,
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 0,
    retryCount: 0
  };
}

// ==================== TRIGGER HANDLERS ====================

export const triggerHandlers: Record<string, (config: TriggerConfig, context: ExecutionContext) => Promise<HandlerResult>> = {
  [TriggerType.EVENT]: async (config, context) => {
    logger.info(`Event trigger fired: ${config.eventName}`, { context: context.executionId });

    return {
      output: { eventName: config.eventName, eventData: context.triggerData },
      nextNodeIds: []
    };
  },

  [TriggerType.SCHEDULE]: async (config, context) => {
    logger.info('Schedule trigger executed', { context: context.executionId });

    return {
      output: { schedule: config.schedule },
      nextNodeIds: []
    };
  },

  [TriggerType.MANUAL]: async (config, context) => {
    logger.info('Manual trigger executed', { context: context.executionId });

    return {
      output: { initiatedBy: 'manual' },
      nextNodeIds: []
    };
  },

  [TriggerType.WEBHOOK]: async (config, context) => {
    logger.info(`Webhook trigger received at ${config.webhookPath}`, { context: context.executionId });

    return {
      output: { webhookPath: config.webhookPath, payload: context.triggerData },
      nextNodeIds: []
    };
  },

  [TriggerType.API]: async (config, context) => {
    logger.info('API trigger executed', { context: context.executionId });

    return {
      output: { apiTrigger: true, payload: context.triggerData },
      nextNodeIds: []
    };
  }
};

// ==================== ACTION HANDLERS ====================

export const actionHandlers: Record<string, (config: ActionConfig, context: ExecutionContext, nodeId: string) => Promise<HandlerResult>> = {
  async send_email(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    // Extract email parameters
    const { to, subject, body, templateId } = params as {
      to?: string;
      subject?: string;
      body?: string;
      templateId?: string;
    };

    // Get user email from context if not provided
    const recipientEmail = to || (context.variables.userEmail as string) || (context.variables.email as string);

    if (!recipientEmail) {
      throw new Error('Email recipient not found in context or params');
    }

    // In production, integrate with email service (SendGrid, SES, etc.)
    // For now, simulate the action
    const emailPayload = {
      to: recipientEmail,
      subject: subject || 'REZ Workflow Notification',
      body: body || '',
      templateId,
      sentAt: new Date().toISOString(),
      workflowExecutionId: context.executionId
    };

    logger.info(`Email action completed`, { nodeId, emailPayload });

    return {
      output: {
        action: actionType,
        success: true,
        emailId: uuidv4(),
        payload: emailPayload
      },
      nextNodeIds: []
    };
  },

  async send_sms(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    const { to, message, templateId } = params as {
      to?: string;
      message?: string;
      templateId?: string;
    };

    const recipientPhone = to || (context.variables.phone as string) || (context.variables.userPhone as string);

    if (!recipientPhone) {
      throw new Error('Phone number not found in context or params');
    }

    // In production, integrate with SMS service (Twilio, MSG91, etc.)
    const smsPayload = {
      to: recipientPhone,
      message: message || '',
      templateId,
      sentAt: new Date().toISOString(),
      workflowExecutionId: context.executionId
    };

    logger.info(`SMS action completed`, { nodeId, smsPayload });

    return {
      output: {
        action: actionType,
        success: true,
        messageId: uuidv4(),
        payload: smsPayload
      },
      nextNodeIds: []
    };
  },

  async send_whatsapp(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    const { to, message, templateName } = params as {
      to?: string;
      message?: string;
      templateName?: string;
    };

    const recipientPhone = to || (context.variables.phone as string) || (context.variables.whatsappNumber as string);

    if (!recipientPhone) {
      throw new Error('WhatsApp number not found in context or params');
    }

    // In production, integrate with WhatsApp Business API
    const whatsappPayload = {
      to: recipientPhone,
      message: message || '',
      templateName,
      sentAt: new Date().toISOString(),
      workflowExecutionId: context.executionId
    };

    logger.info(`WhatsApp action completed`, { nodeId, whatsappPayload });

    return {
      output: {
        action: actionType,
        success: true,
        messageId: uuidv4(),
        payload: whatsappPayload
      },
      nextNodeIds: []
    };
  },

  async send_push(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    const { userId, title, body, data } = params as {
      userId?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    };

    const targetUserId = userId || context.userId;

    if (!targetUserId) {
      throw new Error('User ID not found in context or params');
    }

    // In production, integrate with push notification service (FCM, Expo, etc.)
    const pushPayload = {
      userId: targetUserId,
      title: title || 'REZ Notification',
      body: body || '',
      data: data || {},
      sentAt: new Date().toISOString(),
      workflowExecutionId: context.executionId
    };

    logger.info(`Push notification action completed`, { nodeId, pushPayload });

    return {
      output: {
        action: actionType,
        success: true,
        notificationId: uuidv4(),
        payload: pushPayload
      },
      nextNodeIds: []
    };
  },

  async update_user(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    const { field, value } = params as { field: string; value: unknown };

    if (!context.userId) {
      throw new Error('User ID not found in context');
    }

    // In production, call RABTUL Profile Service or other user service
    const updatePayload = {
      userId: context.userId,
      field,
      value,
      updatedAt: new Date().toISOString(),
      workflowExecutionId: context.executionId
    };

    logger.info(`User update action completed`, { nodeId, updatePayload });

    return {
      output: {
        action: actionType,
        success: true,
        payload: updatePayload
      },
      nextNodeIds: []
    };
  },

  async create_order(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    const { items, totalAmount, currency } = params as {
      items?: Array<{ productId: string; quantity: number; price: number }>;
      totalAmount?: number;
      currency?: string;
    };

    // In production, call RABTUL Order Service
    const orderPayload = {
      orderId: `ORD-${uuidv4().slice(0, 8).toUpperCase()}`,
      userId: context.userId,
      items: items || [],
      totalAmount: totalAmount || 0,
      currency: currency || 'INR',
      status: 'pending',
      createdAt: new Date().toISOString(),
      workflowExecutionId: context.executionId
    };

    logger.info(`Order creation action completed`, { nodeId, orderPayload });

    return {
      output: {
        action: actionType,
        success: true,
        orderId: orderPayload.orderId,
        payload: orderPayload
      },
      nextNodeIds: []
    };
  },

  async webhook_call(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    const { url, method, headers, body, timeout } = params as {
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      headers?: Record<string, string>;
      body?: unknown;
      timeout?: number;
    };

    if (!url) {
      throw new Error('Webhook URL is required');
    }

    try {
      const response = await axios({
        method: method || 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          'X-Workflow-Execution-Id': context.executionId,
          'X-Workflow-Id': context.workflowId,
          ...headers
        },
        data: body || context.variables,
        timeout: timeout || 30000,
        validateStatus: () => true // Accept any status code
      });

      logger.info(`Webhook call completed`, { nodeId, statusCode: response.status });

      return {
        output: {
          action: actionType,
          success: response.status >= 200 && response.status < 300,
          statusCode: response.status,
          response: response.data,
          payload: { url, method, body }
        },
        nextNodeIds: []
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(`Webhook call failed`, { nodeId, error: axiosError.message });

      throw new Error(`Webhook call failed: ${axiosError.message}`);
    }
  }
};

// ==================== CONDITION HANDLERS ====================

export const conditionHandlers: Record<string, (config: ConditionConfig, context: ExecutionContext) => Promise<boolean>> = {
  async if_user_segment(config: ConditionConfig, context: ExecutionContext): Promise<boolean> {
    logger.info('Evaluating user segment condition', { config, userId: context.userId });

    // In production, integrate with REZ Intelligence or user service
    const { operator, value, field } = config;
    const userSegment = context.variables.userSegment || context.variables.segment || 'default';

    return evaluateCondition(userSegment, operator, value);
  },

  async if_time(config: ConditionConfig, context: ExecutionContext): Promise<boolean> {
    logger.info('Evaluating time condition', { config });

    const { operator, value } = config;
    const now = new Date();

    let checkValue: Date | number;
    if (typeof value === 'string' && value.includes(':')) {
      // Time string like "14:00"
      const [hours, minutes] = value.split(':').map(Number);
      checkValue = new Date();
      checkValue.setHours(hours, minutes, 0, 0);
      checkValue = checkValue.getTime();
    } else if (typeof value === 'number') {
      checkValue = value;
    } else {
      checkValue = now.getTime();
    }

    const currentTime = now.getTime();

    switch (operator) {
      case 'greater_than':
        return currentTime > checkValue;
      case 'less_than':
        return currentTime < checkValue;
      case 'equals':
        return currentTime === checkValue;
      default:
        return false;
    }
  },

  async if_purchase_history(config: ConditionConfig, context: ExecutionContext): Promise<boolean> {
    logger.info('Evaluating purchase history condition', { config, userId: context.userId });

    const { operator, value, field } = config;
    const purchaseCount = context.variables.purchaseCount || context.variables.orderCount || 0;

    return evaluateCondition(purchaseCount, operator, value);
  },

  async if_location(config: ConditionConfig, context: ExecutionContext): Promise<boolean> {
    logger.info('Evaluating location condition', { config, userId: context.userId });

    const { operator, value } = config;
    const userLocation = context.variables.location || context.variables.city || context.variables.userCity;

    if (!userLocation && operator === 'equals') {
      return false;
    }

    if (Array.isArray(value)) {
      return operator === 'in'
        ? value.includes(userLocation)
        : !value.includes(userLocation);
    }

    return evaluateCondition(userLocation, operator, value);
  }
};

function evaluateCondition(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case 'equals':
      return left === right;
    case 'not_equals':
      return left !== right;
    case 'greater_than':
      return Number(left) > Number(right);
    case 'less_than':
      return Number(left) < Number(right);
    case 'contains':
      return String(left).includes(String(right));
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'not_in':
      return Array.isArray(right) && !right.includes(left);
    default:
      return false;
  }
}

// ==================== DELAY HANDLERS ====================

export const delayHandlers: Record<string, (config: DelayConfig, context: ExecutionContext) => Promise<HandlerResult>> = {
  async wait_minutes(config: DelayConfig, context: ExecutionContext): Promise<HandlerResult> {
    const { value } = config;
    const minutes = typeof value === 'number' ? value : parseInt(String(value), 10);

    if (isNaN(minutes) || minutes < 0) {
      throw new Error('Invalid delay value for minutes');
    }

    const waitUntil = new Date(Date.now() + minutes * 60 * 1000);

    logger.info(`Delay scheduled: ${minutes} minutes`, { executionId: context.executionId, waitUntil });

    return {
      output: { delayType: 'minutes', value: minutes, waitUntil: waitUntil.toISOString() },
      nextNodeIds: [],
      shouldWait: true,
      waitUntil
    };
  },

  async wait_hours(config: DelayConfig, context: ExecutionContext): Promise<HandlerResult> {
    const { value } = config;
    const hours = typeof value === 'number' ? value : parseInt(String(value), 10);

    if (isNaN(hours) || hours < 0) {
      throw new Error('Invalid delay value for hours');
    }

    const waitUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    logger.info(`Delay scheduled: ${hours} hours`, { executionId: context.executionId, waitUntil });

    return {
      output: { delayType: 'hours', value: hours, waitUntil: waitUntil.toISOString() },
      nextNodeIds: [],
      shouldWait: true,
      waitUntil
    };
  },

  async wait_days(config: DelayConfig, context: ExecutionContext): Promise<HandlerResult> {
    const { value } = config;
    const days = typeof value === 'number' ? value : parseInt(String(value), 10);

    if (isNaN(days) || days < 0) {
      throw new Error('Invalid delay value for days');
    }

    const waitUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    logger.info(`Delay scheduled: ${days} days`, { executionId: context.executionId, waitUntil });

    return {
      output: { delayType: 'days', value: days, waitUntil: waitUntil.toISOString() },
      nextNodeIds: [],
      shouldWait: true,
      waitUntil
    };
  },

  async wait_until(config: DelayConfig, context: ExecutionContext): Promise<HandlerResult> {
    const { value, timezone } = config;

    let waitUntil: Date;
    if (typeof value === 'string') {
      // Try to parse as ISO date string
      waitUntil = new Date(value);

      // If timezone is provided, adjust for timezone
      if (timezone) {
        // Simple timezone adjustment (in production, use a proper timezone library)
        // This is a placeholder - actual implementation would need proper TZ handling
      }
    } else if (typeof value === 'number') {
      // Assume it's a Unix timestamp
      waitUntil = new Date(value);
    } else {
      throw new Error('Invalid delay value for wait_until');
    }

    if (isNaN(waitUntil.getTime())) {
      throw new Error('Invalid date format for wait_until');
    }

    logger.info(`Delay scheduled until: ${waitUntil.toISOString()}`, { executionId: context.executionId });

    return {
      output: { delayType: 'until', value, timezone, waitUntil: waitUntil.toISOString() },
      nextNodeIds: [],
      shouldWait: true,
      waitUntil
    };
  }
};

// ==================== SPLIT HANDLERS ====================

export const splitHandlers: Record<string, (config: SplitConfig, context: ExecutionContext, workflowNodes: WorkflowNode[], currentNodeId: string) => Promise<string[]>> = {
  async fan_out(config: SplitConfig, context: ExecutionContext, workflowNodes: WorkflowNode[], currentNodeId: string): Promise<string[]> {
    logger.info('Executing fan_out split', { config, executionId: context.executionId });

    // Find all nodes that this split points to
    const targetNodes: string[] = [];

    for (const node of workflowNodes) {
      // This is a simplified version - in production, use edge information
      if (node.id !== currentNodeId) {
        targetNodes.push(node.id);
      }
    }

    // Apply parallel limit
    const limit = config.parallelLimit || 10;
    const limitedNodes = targetNodes.slice(0, limit);

    logger.info(`Fan out to ${limitedNodes.length} parallel branches`, { executionId: context.executionId });

    return limitedNodes;
  }
};

// ==================== MERGE HANDLERS ====================

export const mergeHandlers: Record<string, (config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>) => Promise<boolean>> = {
  async wait_all(config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>): Promise<boolean> {
    const { timeout } = config;

    // Check if all expected branches have completed
    const totalBranches = completedBranches.size;
    const completedBranchCount = Array.from(completedBranches.values()).filter(
      branches => branches.length > 0
    ).length;

    if (timeout) {
      const timeoutMs = timeout * 1000;
      // This would need to be checked against actual timing in production
    }

    logger.info(`Merge wait_all check: ${completedBranchCount}/${totalBranches} branches completed`, {
      executionId: context.executionId
    });

    // For now, return true to continue
    // In production, this would check if all branches have reported completion
    return true;
  },

  async wait_one(config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>): Promise<boolean> {
    // Wait for first branch to complete
    const hasAnyCompleted = Array.from(completedBranches.values()).some(
      branches => branches.length > 0
    );

    logger.info(`Merge wait_one check: ${hasAnyCompleted ? 'branch completed' : 'waiting'}`, {
      executionId: context.executionId
    });

    return hasAnyCompleted;
  },

  async race(config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>): Promise<boolean> {
    // Similar to wait_one but logs which branch completed first
    const hasAnyCompleted = Array.from(completedBranches.values()).some(
      branches => branches.length > 0
    );

    logger.info(`Merge race: ${hasAnyCompleted ? 'winner selected' : 'waiting for race'}`, {
      executionId: context.executionId
    });

    return hasAnyCompleted;
  }
};

// ==================== UTILITY HANDLERS ====================

export async function handleLog(nodeData: NodeData, context: ExecutionContext): Promise<HandlerResult> {
  const { label, config } = nodeData;
  const { level = 'info', message } = config as { level?: string; message?: string };

  const logMessage = message || label;
  const logFn = level === 'error' ? logger.error : level === 'warn' ? logger.warn : level === 'debug' ? logger.debug : logger.info;

  logFn(`Workflow log: ${logMessage}`, { executionId: context.executionId });

  return {
    output: { logged: true, level, message: logMessage },
    nextNodeIds: []
  };
}

export async function handleTransform(nodeData: NodeData, context: ExecutionContext): Promise<HandlerResult> {
  const { config } = nodeData;
  const { transformType, field, operations } = config as {
    transformType: string;
    field: string;
    operations?: Array<{ type: string; value?: unknown }>;
  };

  let value = context.variables[field];

  // Apply transformations
  if (operations) {
    for (const op of operations) {
      switch (op.type) {
        case 'uppercase':
          value = String(value).toUpperCase();
          break;
        case 'lowercase':
          value = String(value).toLowerCase();
          break;
        case 'trim':
          value = String(value).trim();
          break;
        case 'to_number':
          value = Number(value);
          break;
        case 'to_string':
          value = String(value);
          break;
        case 'json_parse':
          value = JSON.parse(String(value));
          break;
        case 'json_stringify':
          value = JSON.stringify(value);
          break;
      }
    }
  }

  // Store result
  context.variables[`${field}_transformed`] = value;

  logger.info(`Transform completed: ${transformType}`, { executionId: context.executionId, field, result: value });

  return {
    output: { transformType, field, result: value },
    nextNodeIds: []
  };
}

export async function handleFilter(nodeData: NodeData, context: ExecutionContext): Promise<HandlerResult> {
  const { config } = nodeData;
  const { field, condition } = config as {
    field: string;
    condition: { operator: string; value: unknown };
  };

  const value = context.variables[field];
  const passes = evaluateCondition(value, condition.operator, condition.value);

  logger.info(`Filter check: ${field} ${condition.operator} ${condition.value} = ${passes}`, {
    executionId: context.executionId
  });

  return {
    output: { filterPassed: passes, field, condition },
    nextNodeIds: []
  };
}

// ==================== MAIN NODE HANDLER ====================

export async function handleNode(
  node: WorkflowNode,
  context: ExecutionContext,
  nodeResults: Map<string, NodeResult>,
  workflowNodes: WorkflowNode[]
): Promise<HandlerResult> {
  const { id, type, data } = node;

  logger.info(`Handling node: ${id} (${type})`, { executionId: context.executionId });

  try {
    // Handle based on node type category
    if (type.startsWith('trigger_')) {
      const triggerType = type.replace('trigger_', '') as TriggerType;
      if (triggerHandlers[triggerType]) {
        return await triggerHandlers[triggerType](data.config as TriggerConfig, context);
      }
    }

    if (type === 'trigger') {
      // Generic trigger handler
      return await triggerHandlers[TriggerType.MANUAL](data.config as TriggerConfig, context);
    }

    if (type.startsWith('action_')) {
      const actionName = type.replace('action_', '');
      if (actionHandlers[actionName]) {
        return await actionHandlers[actionName](data.config as ActionConfig, context, id);
      }
    }

    if (type === 'action') {
      // Generic action handler
      const actionType = (data.config as ActionConfig).actionType;
      if (actionHandlers[actionType]) {
        return await actionHandlers[actionType](data.config as ActionConfig, context, id);
      }
    }

    if (type.startsWith('condition_')) {
      const conditionType = type.replace('condition_', '');
      if (conditionHandlers[conditionType]) {
        const passes = await conditionHandlers[conditionType](data.config as ConditionConfig, context);
        return {
          output: { conditionType, passes },
          nextNodeIds: passes ? ['true'] : ['false']
        };
      }
    }

    if (type === 'condition' || type === 'condition_if') {
      const conditionType = (data.config as ConditionConfig).conditionType;
      if (conditionHandlers[conditionType]) {
        const passes = await conditionHandlers[conditionType](data.config as ConditionConfig, context);
        return {
          output: { conditionType, passes },
          nextNodeIds: passes ? ['true'] : ['false']
        };
      }
    }

    if (type.startsWith('delay_')) {
      const delayType = type.replace('delay_', '');
      if (delayHandlers[delayType]) {
        return await delayHandlers[delayType](data.config as DelayConfig, context);
      }
    }

    if (type === 'delay') {
      const delayType = (data.config as DelayConfig).delayType;
      if (delayHandlers[delayType]) {
        return await delayHandlers[delayType](data.config as DelayConfig, context);
      }
    }

    if (type === 'split' || type === 'split_fan_out') {
      const branches = await splitHandlers.fan_out(
        data.config as SplitConfig,
        context,
        workflowNodes,
        id
      );
      return {
        output: { splitType: 'fan_out', branchCount: branches.length },
        nextNodeIds: branches
      };
    }

    if (type === 'merge' || type === 'merge_wait_all') {
      const isReady = await mergeHandlers.wait_all(
        data.config as MergeConfig,
        context,
        new Map()
      );
      return {
        output: { mergeType: 'wait_all', ready: isReady },
        nextNodeIds: isReady ? [] : []
      };
    }

    if (type === 'log') {
      return await handleLog(data, context);
    }

    if (type === 'transform') {
      return await handleTransform(data, context);
    }

    if (type === 'filter') {
      return await handleFilter(data, context);
    }

    // Unknown node type
    logger.warn(`Unknown node type: ${type}`, { nodeId: id, executionId: context.executionId });
    return {
      output: { warning: `Unknown node type: ${type}` },
      nextNodeIds: []
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Node execution failed: ${id}`, { nodeId: id, error: errorMessage, executionId: context.executionId });
    throw error;
  }
}

export default {
  triggerHandlers,
  actionHandlers,
  conditionHandlers,
  delayHandlers,
  splitHandlers,
  mergeHandlers,
  handleNode
};

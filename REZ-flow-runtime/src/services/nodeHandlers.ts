/**
 * REZ Flow Runtime - Node Handlers
 * Handler functions for each node type with REAL service integrations
 * PRODUCTION-READY: Circuit breakers, retries, idempotency, PII masking
 */

import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { z } from 'zod';
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
import { CircuitBreaker, circuitBreakerRegistry } from '../../../shared/src/circuitBreaker';

/**
 * Generate a random number between 0 and 1 using crypto
 */
function cryptoRandom(): number {
  return Number(randomBytes(4).readUInt32BE(0)) / 0xFFFFFFFF;
}

// ==================== SERVICE URLS ====================

const SERVICE_URLS = {
  NOTIFY: process.env.NOTIFY_SERVICE_URL || 'http://localhost:4011',
  WHATSAPP: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:4202',
  WALLET: process.env.WALLET_SERVICE_URL || 'http://localhost:4004',
  ORDER: process.env.ORDER_SERVICE_URL || 'http://localhost:4006',
  PROFILE: process.env.PROFILE_SERVICE_URL || 'http://localhost:4013',
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:4002'
};

// ==================== TYPES ====================

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

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  retryable?: boolean;
}

export interface SMSResponse {
  messageId: string;
  status: string;
  sentAt: string;
}

export interface WhatsAppResponse {
  messageId: string;
  status: string;
  waId: string;
}

export interface PushResponse {
  notificationId: string;
  status: string;
  delivered: boolean;
}

export interface EmailResponse {
  emailId: string;
  messageId: string;
  accepted: boolean[];
}

export interface WalletResponse {
  transactionId: string;
  balance: number;
  coinsAdded: number;
}

export interface OrderResponse {
  orderId: string;
  status: string;
  totalAmount: number;
}

// ==================== VALIDATION SCHEMAS ====================

const PhoneSchema = z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number');
const EmailSchema = z.string().email('Invalid email address');
const AmountSchema = z.number().positive('Amount must be positive');
const UserIdSchema = z.string().min(1, 'User ID required');

// ==================== UTILITIES ====================

/**
 * Mask PII for logging
 */
function maskPII(value: string): string {
  if (!value) return value;
  if (value.includes('@')) {
    return value.replace(/(.{2}).*(@.*)/, '$1***$2');
  }
  if (/^\+?[0-9]{10,}$/.test(value.replace(/\s/g, ''))) {
    return value.replace(/(.{3}).*(.{4})$/, '$1****$2');
  }
  if (value.length > 6) {
    return value.slice(0, 3) + '***' + value.slice(-3);
  }
  return '***';
}

/**
 * Timing-safe string comparison
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Safe JSON parse
 */
function safeJsonParse<T = unknown>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

// ==================== CIRCUIT BREAKERS ====================

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(serviceName: string): CircuitBreaker {
  let cb = circuitBreakers.get(serviceName);
  if (!cb) {
    cb = circuitBreakerRegistry.get(serviceName, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      volumeThreshold: 10
    });
    circuitBreakers.set(serviceName, cb);
  }
  return cb;
}

// ==================== RETRY UTILITIES ====================

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryableStatuses = [408, 429, 500, 502, 503, 504]
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const isRetryable = (error as AxiosError)?.response?.status
        ? retryableStatuses.includes((error as AxiosError).response?.status || 0)
        : true;

      if (attempt === maxRetries || !isRetryable) {
        throw lastError;
      }

      const jitter = cryptoRandom() * 0.3 * delay;
      const actualDelay = Math.min(delay + jitter, maxDelayMs);

      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

// ==================== SERVICE CALL ====================

function getInternalHeaders(context?: ExecutionContext): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
    'X-Service-Name': 'REZ-flow-runtime',
    'X-Trace-Id': context?.executionId || uuidv4()
  };
}

async function serviceCall<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown,
  options: { timeout?: number; retry?: boolean; context?: ExecutionContext } = {}
): Promise<T> {
  const config: AxiosRequestConfig = {
    method,
    url,
    headers: getInternalHeaders(options.context),
    timeout: options.timeout || 30000
  };

  if (data) {
    config.data = data;
  }

  const makeRequest = async () => {
    const response = await axios(config);
    if (response.status >= 400) {
      const error = new Error(`Service returned ${response.status}: ${JSON.stringify(response.data)}`) as AxiosError;
      error.response = response;
      throw error;
    }
    return response.data as T;
  };

  if (options.retry !== false) {
    return withRetry(makeRequest);
  }
  return makeRequest();
}

/**
 * Service call with circuit breaker protection
 */
async function serviceCallWithCircuitBreaker<T>(
  serviceName: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown,
  options: { timeout?: number; fallback?: T; context?: ExecutionContext } = {}
): Promise<T> {
  const cb = getCircuitBreaker(serviceName);

  return cb.executeWithFallback(
    async () => {
      return serviceCall<T>(method, url, data, { timeout: options.timeout, context: options.context });
    },
    options.fallback ?? (() => {
      throw new Error(`Circuit breaker open for ${serviceName}`);
    }) as T
  );
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
    return { output: { eventName: config.eventName, eventData: context.triggerData }, nextNodeIds: [] };
  },

  [TriggerType.SCHEDULE]: async (config, context) => {
    logger.info('Schedule trigger executed', { context: context.executionId });
    return { output: { schedule: config.schedule }, nextNodeIds: [] };
  },

  [TriggerType.MANUAL]: async (config, context) => {
    logger.info('Manual trigger executed', { context: context.executionId });
    return { output: { initiatedBy: 'manual' }, nextNodeIds: [] };
  },

  [TriggerType.WEBHOOK]: async (config, context) => {
    logger.info(`Webhook trigger received at ${config.webhookPath}`, { context: context.executionId });
    return { output: { webhookPath: config.webhookPath, payload: context.triggerData }, nextNodeIds: [] };
  },

  [TriggerType.API]: async (config, context) => {
    logger.info('API trigger executed', { context: context.executionId });
    return { output: { apiTrigger: true, payload: context.triggerData }, nextNodeIds: [] };
  }
};

// ==================== ACTION HANDLERS ====================

export const actionHandlers: Record<string, (config: ActionConfig, context: ExecutionContext, nodeId: string) => Promise<HandlerResult>> = {
  async send_sms(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    logger.info(`Executing action: ${actionType}`, { nodeId, executionId: context.executionId });

    const { to, message, templateId, senderId } = params as {
      to?: string;
      message?: string;
      templateId?: string;
      senderId?: string;
    };

    const recipientPhone = to || (context.variables.phone as string) || (context.variables.userPhone as string);

    if (!recipientPhone) {
      throw new Error('Phone number not found in context or params');
    }

    // Validate phone number
    const validation = PhoneSchema.safeParse(recipientPhone);
    if (!validation.success) {
      throw new Error(`Invalid phone number: ${validation.error.message}`);
    }

    if (!message) {
      throw new Error('SMS message is required');
    }

    logger.info(`Sending SMS to ${maskPII(recipientPhone)}`, { nodeId, executionId: context.workflowId });

    try {
      const response = await serviceCallWithCircuitBreaker<SMSResponse & { success: boolean }>(
        'notify-service',
        'POST',
        `${SERVICE_URLS.NOTIFY}/api/notifications/sms/send`,
        {
          phone: recipientPhone,
          message,
          templateId,
          senderId,
          metadata: {
            workflowId: context.workflowId,
            executionId: context.executionId,
            nodeId
          }
        },
        { context }
      );

      logger.info(`SMS sent successfully`, { nodeId, messageId: response.messageId });

      return {
        output: { action: actionType, success: true, messageId: response.messageId, status: response.status, recipientPhone, sentAt: response.sentAt },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`SMS send failed`, { nodeId, error: errorMessage, recipientPhone: maskPII(recipientPhone) });
      return { output: { action: actionType, success: false, error: errorMessage, recipientPhone }, nextNodeIds: [] };
    }
  },

  async send_whatsapp(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { to, message, templateName, components, mediaUrl } = params as {
      to?: string;
      message?: string;
      templateName?: string;
      components?: Array<{ type: string; parameters: unknown[] }>;
      mediaUrl?: string;
    };

    const recipientPhone = to || (context.variables.phone as string) ||
      (context.variables.whatsappNumber as string) ||
      (context.variables.userPhone as string);

    if (!recipientPhone) {
      throw new Error('WhatsApp number not found in context or params');
    }

    if (!message && !templateName) {
      throw new Error('Either message or templateName is required');
    }

    logger.info(`Sending WhatsApp to ${maskPII(recipientPhone)}`, { nodeId, executionId: context.executionId, templateName });

    try {
      const response = await serviceCallWithCircuitBreaker<WhatsAppResponse & { success: boolean }>(
        'whatsapp-service',
        'POST',
        `${SERVICE_URLS.WHATSAPP}/api/whatsapp/send`,
        { to: recipientPhone, message, templateName, components, mediaUrl, metadata: { workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { context }
      );

      logger.info(`WhatsApp message sent successfully`, { nodeId, messageId: response.messageId });

      return {
        output: { action: actionType, success: true, messageId: response.messageId, waId: response.waId, status: response.status, recipientPhone },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`WhatsApp send failed`, { nodeId, error: errorMessage, recipientPhone: maskPII(recipientPhone) });
      return { output: { action: actionType, success: false, error: errorMessage, recipientPhone }, nextNodeIds: [] };
    }
  },

  async send_push(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { userId, title, body, data, badge, sound, channelId } = params as {
      userId?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
      badge?: number;
      sound?: string;
      channelId?: string;
    };

    const targetUserId = userId || context.userId || (context.variables.targetUserId as string);

    if (!targetUserId) {
      throw new Error('User ID not found in context or params');
    }

    if (!title && !body) {
      throw new Error('Either title or body is required for push notification');
    }

    logger.info(`Sending push notification to ${targetUserId}`, { nodeId, executionId: context.executionId, title });

    try {
      const response = await serviceCallWithCircuitBreaker<PushResponse & { success: boolean }>(
        'notify-service',
        'POST',
        `${SERVICE_URLS.NOTIFY}/api/notifications/push/send`,
        { userId: targetUserId, title: title || 'REZ Notification', body: body || '', data: { ...data, workflowId: context.workflowId, executionId: context.executionId, nodeId }, badge, sound: sound || 'default', channelId, metadata: { workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { context }
      );

      logger.info(`Push notification sent successfully`, { nodeId, notificationId: response.notificationId });

      return {
        output: { action: actionType, success: true, notificationId: response.notificationId, delivered: response.delivered, status: response.status, targetUserId },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Push notification failed`, { nodeId, error: errorMessage, targetUserId });
      return { output: { action: actionType, success: false, error: errorMessage, targetUserId }, nextNodeIds: [] };
    }
  },

  async send_email(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { to, subject, body, htmlContent, templateId, fromName } = params as {
      to?: string;
      subject?: string;
      body?: string;
      htmlContent?: string;
      templateId?: string;
      fromName?: string;
    };

    const recipientEmail = to || (context.variables.userEmail as string) ||
      (context.variables.email as string) ||
      (context.variables.recipientEmail as string);

    if (!recipientEmail) {
      throw new Error('Email recipient not found in context or params');
    }

    // Validate email
    const validation = EmailSchema.safeParse(recipientEmail);
    if (!validation.success) {
      throw new Error(`Invalid email: ${validation.error.message}`);
    }

    if (!subject) {
      throw new Error('Email subject is required');
    }

    logger.info(`Sending email to ${maskPII(recipientEmail)}`, { nodeId, executionId: context.executionId, subject });

    try {
      const response = await serviceCallWithCircuitBreaker<EmailResponse & { success: boolean }>(
        'notify-service',
        'POST',
        `${SERVICE_URLS.NOTIFY}/api/notifications/email/send`,
        { to: recipientEmail, subject, body: htmlContent || body || '', html: htmlContent, templateId, fromName: fromName || 'REZ', metadata: { workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { context }
      );

      logger.info(`Email sent successfully`, { nodeId, emailId: response.emailId });

      return {
        output: { action: actionType, success: true, emailId: response.emailId, messageId: response.messageId, recipientEmail, accepted: response.accepted },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Email send failed`, { nodeId, error: errorMessage, recipientEmail: maskPII(recipientEmail) });
      return { output: { action: actionType, success: false, error: errorMessage, recipientEmail }, nextNodeIds: [] };
    }
  },

  async add_coins(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { userId, amount, reason, source } = params as {
      userId?: string;
      amount: number;
      reason?: string;
      source?: string;
    };

    const targetUserId = userId || context.userId || (context.variables.targetUserId as string);

    if (!targetUserId) {
      throw new Error('User ID not found in context or params');
    }

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Valid positive amount is required');
    }

    logger.info(`Adding ${amount} coins to user ${targetUserId}`, { nodeId, executionId: context.executionId, reason });

    try {
      // Idempotency key to prevent double-crediting
      const idempotencyKey = `wallet:add:${context.executionId}:${nodeId}`;

      const response = await serviceCallWithCircuitBreaker<WalletResponse & { success: boolean }>(
        'wallet-service',
        'POST',
        `${SERVICE_URLS.WALLET}/api/wallet/add`,
        { userId: targetUserId, amount, reason: reason || `Workflow: ${context.workflowId}`, source: source || 'workflow', idempotencyKey, metadata: { workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { context }
      );

      logger.info(`Coins added successfully`, { nodeId, transactionId: response.transactionId, balance: response.balance });

      return {
        output: { action: actionType, success: true, transactionId: response.transactionId, balance: response.balance, coinsAdded: response.coinsAdded, targetUserId, amount },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Add coins failed`, { nodeId, error: errorMessage, targetUserId, amount });
      throw new Error(`Failed to add coins: ${errorMessage}`);
    }
  },

  async deduct_coins(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { userId, amount, reason, source } = params as {
      userId?: string;
      amount: number;
      reason?: string;
      source?: string;
    };

    const targetUserId = userId || context.userId || (context.variables.targetUserId as string);

    if (!targetUserId) {
      throw new Error('User ID not found in context or params');
    }

    if (!amount || amount <= 0) {
      throw new Error('Valid positive amount is required');
    }

    logger.info(`Deducting ${amount} coins from user ${targetUserId}`, { nodeId, executionId: context.executionId, reason });

    try {
      const idempotencyKey = `wallet:deduct:${context.executionId}:${nodeId}`;

      const response = await serviceCallWithCircuitBreaker<WalletResponse & { success: boolean }>(
        'wallet-service',
        'POST',
        `${SERVICE_URLS.WALLET}/api/wallet/deduct`,
        { userId: targetUserId, amount, reason: reason || `Workflow: ${context.workflowId}`, source: source || 'workflow', idempotencyKey, metadata: { workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { context }
      );

      logger.info(`Coins deducted successfully`, { nodeId, transactionId: response.transactionId, balance: response.balance });

      return {
        output: { action: actionType, success: true, transactionId: response.transactionId, balance: response.balance, coinsDeducted: response.coinsAdded, targetUserId, amount },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Deduct coins failed`, { nodeId, error: errorMessage, targetUserId, amount });
      throw new Error(`Failed to deduct coins: ${errorMessage}`);
    }
  },

  async get_balance(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { userId } = params as { userId?: string };
    const targetUserId = userId || context.userId || (context.variables.targetUserId as string);

    if (!targetUserId) {
      throw new Error('User ID not found in context or params');
    }

    logger.info(`Getting balance for user ${targetUserId}`, { nodeId, executionId: context.executionId });

    try {
      const response = await serviceCallWithCircuitBreaker<{ balance: number; coins: number; lastUpdated: string }>(
        'wallet-service',
        'GET',
        `${SERVICE_URLS.WALLET}/api/wallet/balance/${targetUserId}`,
        undefined,
        { context }
      );

      logger.info(`Balance retrieved`, { nodeId, balance: response.balance, coins: response.coins });

      return {
        output: { action: actionType, success: true, balance: response.balance, coins: response.coins, lastUpdated: response.lastUpdated, targetUserId },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Get balance failed`, { nodeId, error: errorMessage, targetUserId });
      throw new Error(`Failed to get balance: ${errorMessage}`);
    }
  },

  async create_order(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { items, totalAmount, currency, metadata, shippingAddress, couponCode } = params as {
      items?: Array<{ productId: string; name?: string; quantity: number; price: number; sku?: string }>;
      totalAmount?: number;
      currency?: string;
      metadata?: Record<string, unknown>;
      shippingAddress?: Record<string, string>;
      couponCode?: string;
    };

    const userId = context.userId || (context.variables.userId as string);

    if (!userId) {
      throw new Error('User ID not found in context');
    }

    if (!items || items.length === 0) {
      throw new Error('Order items are required');
    }

    const calculatedTotal = totalAmount || items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    logger.info(`Creating order for user ${userId}`, { nodeId, executionId: context.executionId, itemCount: items.length, total: calculatedTotal });

    try {
      const idempotencyKey = `order:create:${context.executionId}:${nodeId}`;

      const response = await serviceCallWithCircuitBreaker<OrderResponse & { success: boolean }>(
        'order-service',
        'POST',
        `${SERVICE_URLS.ORDER}/api/orders`,
        { userId, items, totalAmount: calculatedTotal, currency: currency || 'INR', shippingAddress, couponCode, idempotencyKey, metadata: { ...metadata, workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { timeout: 60000, context }
      );

      logger.info(`Order created successfully`, { nodeId, orderId: response.orderId, status: response.status, totalAmount: response.totalAmount });

      return {
        output: { action: actionType, success: true, orderId: response.orderId, status: response.status, totalAmount: response.totalAmount, userId, itemCount: items.length },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Create order failed`, { nodeId, error: errorMessage, userId });
      throw new Error(`Failed to create order: ${errorMessage}`);
    }
  },

  async get_order(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { orderId } = params as { orderId: string };

    if (!orderId) {
      throw new Error('Order ID is required');
    }

    logger.info(`Fetching order ${orderId}`, { nodeId, executionId: context.executionId });

    try {
      const response = await serviceCallWithCircuitBreaker<{
        orderId: string;
        status: string;
        items: unknown[];
        totalAmount: number;
        createdAt: string;
        updatedAt: string;
      }>(
        'order-service',
        'GET',
        `${SERVICE_URLS.ORDER}/api/orders/${orderId}`,
        undefined,
        { context }
      );

      logger.info(`Order fetched`, { nodeId, orderId, status: response.status });

      return {
        output: { action: actionType, success: true, order: response },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Get order failed`, { nodeId, error: errorMessage, orderId });
      throw new Error(`Failed to get order: ${errorMessage}`);
    }
  },

  async update_order_status(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { orderId, status, reason } = params as {
      orderId: string;
      status: string;
      reason?: string;
    };

    if (!orderId || !status) {
      throw new Error('Order ID and status are required');
    }

    logger.info(`Updating order ${orderId} status to ${status}`, { nodeId, executionId: context.executionId });

    try {
      const response = await serviceCallWithCircuitBreaker<{
        orderId: string;
        status: string;
        updatedAt: string;
      }>(
        'order-service',
        'PATCH',
        `${SERVICE_URLS.ORDER}/api/orders/${orderId}/status`,
        { status, reason, metadata: { workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { context }
      );

      logger.info(`Order status updated`, { nodeId, orderId, newStatus: response.status });

      return {
        output: { action: actionType, success: true, orderId: response.orderId, status: response.status, updatedAt: response.updatedAt },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Update order status failed`, { nodeId, error: errorMessage, orderId, newStatus: status });
      throw new Error(`Failed to update order status: ${errorMessage}`);
    }
  },

  async update_user(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { userId, field, value, fields } = params as {
      userId?: string;
      field?: string;
      value?: unknown;
      fields?: Record<string, unknown>;
    };

    const targetUserId = userId || context.userId || (context.variables.targetUserId as string);

    if (!targetUserId) {
      throw new Error('User ID not found in context');
    }

    const updateData = fields || (field ? { [field]: value } : {});

    if (Object.keys(updateData).length === 0) {
      throw new Error('At least one field to update is required');
    }

    logger.info(`Updating user ${targetUserId} profile`, { nodeId, executionId: context.executionId, fields: Object.keys(updateData) });

    try {
      const response = await serviceCallWithCircuitBreaker<{
        userId: string;
        updated: boolean;
        updatedAt: string;
      }>(
        'profile-service',
        'PATCH',
        `${SERVICE_URLS.PROFILE}/api/profiles/${targetUserId}`,
        { ...updateData, metadata: { workflowId: context.workflowId, executionId: context.executionId, nodeId } },
        { context }
      );

      logger.info(`User profile updated`, { nodeId, userId: response.userId, updated: response.updated });

      return {
        output: { action: actionType, success: true, userId: response.userId, updated: response.updated, updatedAt: response.updatedAt },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`User update failed`, { nodeId, error: errorMessage, targetUserId });
      throw new Error(`Failed to update user profile: ${errorMessage}`);
    }
  },

  async get_user(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
    const { userId, fields } = params as { userId?: string; fields?: string[] };
    const targetUserId = userId || context.userId || (context.variables.targetUserId as string);

    if (!targetUserId) {
      throw new Error('User ID not found in context');
    }

    logger.info(`Fetching user ${targetUserId} profile`, { nodeId, executionId: context.executionId });

    try {
      const queryString = fields ? `?fields=${fields.join(',')}` : '';
      const response = await serviceCallWithCircuitBreaker<Record<string, unknown>>(
        'profile-service',
        'GET',
        `${SERVICE_URLS.PROFILE}/api/profiles/${targetUserId}${queryString}`,
        undefined,
        { context }
      );

      logger.info(`User profile fetched`, { nodeId, userId: targetUserId });

      return {
        output: { action: actionType, success: true, user: response },
        nextNodeIds: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Get user failed`, { nodeId, error: errorMessage, targetUserId });
      throw new Error(`Failed to get user profile: ${errorMessage}`);
    }
  },

  async webhook_call(config: ActionConfig, context: ExecutionContext, nodeId: string): Promise<HandlerResult> {
    const { actionType, params } = config;
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
        validateStatus: () => true
      });

      logger.info(`Webhook call completed`, { nodeId, statusCode: response.status });

      return {
        output: { action: actionType, success: response.status >= 200 && response.status < 300, statusCode: response.status, response: response.data, payload: { url, method, body } },
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
    const { operator, value } = config;
    const userSegment = context.variables.userSegment || context.variables.segment || 'default';
    return evaluateCondition(userSegment, operator, value);
  },

  async if_time(config: ConditionConfig, context: ExecutionContext): Promise<boolean> {
    const { operator, value } = config;
    const now = new Date();

    let checkValue: number;
    if (typeof value === 'string' && value.includes(':')) {
      const [hours, minutes] = value.split(':').map(Number);
      checkValue = new Date().setHours(hours, minutes, 0, 0);
    } else {
      checkValue = typeof value === 'number' ? value : now.getTime();
    }

    const currentTime = now.getTime();

    switch (operator) {
      case 'greater_than': return currentTime > checkValue;
      case 'less_than': return currentTime < checkValue;
      case 'equals': return currentTime === checkValue;
      default: return false;
    }
  },

  async if_purchase_history(config: ConditionConfig, context: ExecutionContext): Promise<boolean> {
    const { operator, value } = config;
    const purchaseCount = context.variables.purchaseCount || context.variables.orderCount || 0;
    return evaluateCondition(purchaseCount, operator, value);
  },

  async if_location(config: ConditionConfig, context: ExecutionContext): Promise<boolean> {
    const { operator, value } = config;
    const userLocation = context.variables.location || context.variables.city || context.variables.userCity;

    if (!userLocation && operator === 'equals') {
      return false;
    }

    if (Array.isArray(value)) {
      return operator === 'in' ? value.includes(userLocation) : !value.includes(userLocation);
    }

    return evaluateCondition(userLocation, operator, value);
  }
};

function evaluateCondition(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case 'equals': return left === right;
    case 'not_equals': return left !== right;
    case 'greater_than': return Number(left) > Number(right);
    case 'less_than': return Number(left) < Number(right);
    case 'contains': return String(left).includes(String(right));
    case 'in': return Array.isArray(right) && right.includes(left);
    case 'not_in': return Array.isArray(right) && !right.includes(left);
    default: return false;
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

    return { output: { delayType: 'minutes', value: minutes, waitUntil: waitUntil.toISOString() }, nextNodeIds: [], shouldWait: true, waitUntil };
  },

  async wait_hours(config: DelayConfig, context: ExecutionContext): Promise<HandlerResult> {
    const { value } = config;
    const hours = typeof value === 'number' ? value : parseInt(String(value), 10);

    if (isNaN(hours) || hours < 0) {
      throw new Error('Invalid delay value for hours');
    }

    const waitUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    logger.info(`Delay scheduled: ${hours} hours`, { executionId: context.executionId, waitUntil });

    return { output: { delayType: 'hours', value: hours, waitUntil: waitUntil.toISOString() }, nextNodeIds: [], shouldWait: true, waitUntil };
  },

  async wait_days(config: DelayConfig, context: ExecutionContext): Promise<HandlerResult> {
    const { value } = config;
    const days = typeof value === 'number' ? value : parseInt(String(value), 10);

    if (isNaN(days) || days < 0) {
      throw new Error('Invalid delay value for days');
    }

    const waitUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    logger.info(`Delay scheduled: ${days} days`, { executionId: context.executionId, waitUntil });

    return { output: { delayType: 'days', value: days, waitUntil: waitUntil.toISOString() }, nextNodeIds: [], shouldWait: true, waitUntil };
  },

  async wait_until(config: DelayConfig, context: ExecutionContext): Promise<HandlerResult> {
    const { value, timezone } = config;
    let waitUntil: Date;

    if (typeof value === 'string') {
      waitUntil = new Date(value);
    } else if (typeof value === 'number') {
      waitUntil = new Date(value);
    } else {
      throw new Error('Invalid delay value for wait_until');
    }

    if (isNaN(waitUntil.getTime())) {
      throw new Error('Invalid date format for wait_until');
    }

    logger.info(`Delay scheduled until: ${waitUntil.toISOString()}`, { executionId: context.executionId });

    return { output: { delayType: 'until', value, timezone, waitUntil: waitUntil.toISOString() }, nextNodeIds: [], shouldWait: true, waitUntil };
  }
};

// ==================== SPLIT HANDLERS ====================

export const splitHandlers: Record<string, (config: SplitConfig, context: ExecutionContext, workflowNodes: WorkflowNode[], currentNodeId: string) => Promise<string[]>> = {
  async fan_out(config: SplitConfig, context: ExecutionContext, workflowNodes: WorkflowNode[], currentNodeId: string): Promise<string[]> {
    logger.info('Executing fan_out split', { config, executionId: context.executionId });

    const targetNodes: string[] = [];
    for (const node of workflowNodes) {
      if (node.id !== currentNodeId) {
        targetNodes.push(node.id);
      }
    }

    const limit = config.parallelLimit || 10;
    const limitedNodes = targetNodes.slice(0, limit);

    logger.info(`Fan out to ${limitedNodes.length} parallel branches`, { executionId: context.executionId });

    return limitedNodes;
  }
};

// ==================== MERGE HANDLERS ====================

export const mergeHandlers: Record<string, (config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>) => Promise<boolean>> = {
  async wait_all(config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>): Promise<boolean> {
    const totalBranches = completedBranches.size;
    const completedBranchCount = Array.from(completedBranches.values()).filter(branches => branches.length > 0).length;

    logger.info(`Merge wait_all check: ${completedBranchCount}/${totalBranches} branches completed`, { executionId: context.executionId });

    return completedBranchCount === totalBranches;
  },

  async wait_one(config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>): Promise<boolean> {
    const hasAnyCompleted = Array.from(completedBranches.values()).some(branches => branches.length > 0);
    logger.info(`Merge wait_one check: ${hasAnyCompleted ? 'branch completed' : 'waiting'}`, { executionId: context.executionId });
    return hasAnyCompleted;
  },

  async race(config: MergeConfig, context: ExecutionContext, completedBranches: Map<string, string[]>): Promise<boolean> {
    const hasAnyCompleted = Array.from(completedBranches.values()).some(branches => branches.length > 0);
    logger.info(`Merge race: ${hasAnyCompleted ? 'winner selected' : 'waiting for race'}`, { executionId: context.executionId });
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
  return { output: { logged: true, level, message: logMessage }, nextNodeIds: [] };
}

export async function handleTransform(nodeData: NodeData, context: ExecutionContext): Promise<HandlerResult> {
  const { config } = nodeData;
  const { transformType, field, operations } = config as { transformType: string; field: string; operations?: Array<{ type: string; value?: unknown }> };
  let value = context.variables[field];

  if (operations) {
    for (const op of operations) {
      switch (op.type) {
        case 'uppercase': value = String(value).toUpperCase(); break;
        case 'lowercase': value = String(value).toLowerCase(); break;
        case 'trim': value = String(value).trim(); break;
        case 'to_number': value = Number(value); break;
        case 'to_string': value = String(value); break;
        case 'json_parse': value = safeJsonParse(String(value)); break;
        case 'json_stringify': value = JSON.stringify(value); break;
      }
    }
  }

  context.variables[`${field}_transformed`] = value;
  logger.info(`Transform completed: ${transformType}`, { executionId: context.executionId, field, result: value });

  return { output: { transformType, field, result: value }, nextNodeIds: [] };
}

export async function handleFilter(nodeData: NodeData, context: ExecutionContext): Promise<HandlerResult> {
  const { config } = nodeData;
  const { field, condition } = config as { field: string; condition: { operator: string; value: unknown } };
  const value = context.variables[field];
  const passes = evaluateCondition(value, condition.operator, condition.value);

  logger.info(`Filter check: ${field} ${condition.operator} ${condition.value} = ${passes}`, { executionId: context.executionId });

  return { output: { filterPassed: passes, field, condition }, nextNodeIds: [] };
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
    if (type.startsWith('trigger_')) {
      const triggerType = type.replace('trigger_', '') as TriggerType;
      if (triggerHandlers[triggerType]) {
        return await triggerHandlers[triggerType](data.config as TriggerConfig, context);
      }
    }

    if (type === 'trigger') {
      return await triggerHandlers[TriggerType.MANUAL](data.config as TriggerConfig, context);
    }

    if (type.startsWith('action_')) {
      const actionName = type.replace('action_', '');
      if (actionHandlers[actionName]) {
        return await actionHandlers[actionName](data.config as ActionConfig, context, id);
      }
    }

    if (type === 'action') {
      const actionType = (data.config as ActionConfig).actionType;
      if (actionHandlers[actionType]) {
        return await actionHandlers[actionType](data.config as ActionConfig, context, id);
      }
    }

    if (type.startsWith('condition_')) {
      const conditionType = type.replace('condition_', '');
      if (conditionHandlers[conditionType]) {
        const passes = await conditionHandlers[conditionType](data.config as ConditionConfig, context);
        return { output: { conditionType, passes }, nextNodeIds: passes ? ['true'] : ['false'] };
      }
    }

    if (type === 'condition' || type === 'condition_if') {
      const conditionType = (data.config as ConditionConfig).conditionType;
      if (conditionHandlers[conditionType]) {
        const passes = await conditionHandlers[conditionType](data.config as ConditionConfig, context);
        return { output: { conditionType, passes }, nextNodeIds: passes ? ['true'] : ['false'] };
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
      const branches = await splitHandlers.fan_out(data.config as SplitConfig, context, workflowNodes, id);
      return { output: { splitType: 'fan_out', branchCount: branches.length }, nextNodeIds: branches };
    }

    if (type === 'merge' || type === 'merge_wait_all') {
      const isReady = await mergeHandlers.wait_all(data.config as MergeConfig, context, new Map());
      return { output: { mergeType: 'wait_all', ready: isReady }, nextNodeIds: [] };
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

    logger.warn(`Unknown node type: ${type}`, { nodeId: id, executionId: context.executionId });
    return { output: { warning: `Unknown node type: ${type}` }, nextNodeIds: [] };
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

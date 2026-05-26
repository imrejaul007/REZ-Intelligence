import { z } from 'zod';
import { logger } from '../utils/logger';
import { pushService } from './pushService';
import { v4 as uuidv4 } from 'uuid';

// Validation schemas
const MessageSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1).max(5000),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const InAppNotificationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  type: z.enum(['info', 'success', 'warning', 'error', 'chat', 'order', 'payment', 'system']),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  data: z.record(z.unknown()).optional(),
  actionUrl: z.string().url().optional(),
  expiresAt: z.date().optional(),
});

// Types
export interface AppResponse {
  success: boolean;
  responseId: string;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface InAppNotification {
  userId: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'chat' | 'order' | 'payment' | 'system';
  priority?: 'low' | 'normal' | 'high';
  data?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface Message {
  userId: string;
  message: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface OrchestratorRequest {
  intent: string;
  entities: Record<string, unknown>;
  userId: string;
  sessionId?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface OrchestratorResponse {
  responseId: string;
  reply: string;
  actions?: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  context?: Record<string, unknown>;
  confidence?: number;
}

export class AppService {
  private orchestratorUrl: string;
  private internalToken: string;

  constructor() {
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:4006';
    this.internalToken = this.getInternalToken();
  }

  private getInternalToken(): string {
    try {
      const tokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');
      return tokens['app-bridge'] || '';
    } catch {
      return '';
    }
  }

  /**
   * Handle incoming message from the app
   * Routes to orchestrator for processing
   */
  async handleMessage(userId: string, message: string): Promise<AppResponse> {
    const responseId = uuidv4();

    try {
      // Validate input
      const validated = MessageSchema.safeParse({ userId, message });
      if (!validated.success) {
        logger.warn('Invalid message format', { userId, errors: validated.error.issues });
        return {
          success: false,
          responseId,
          error: 'Invalid message format',
        };
      }

      logger.info('Processing app message', { userId, responseId, messageLength: message.length });

      // Prepare orchestrator request
      const orchestratorRequest: OrchestratorRequest = {
        intent: 'user_message',
        entities: {
          message: validated.data.message,
        },
        userId,
        sessionId: validated.data.sessionId || uuidv4(),
        context: validated.data.metadata,
        metadata: {
          source: 'app-bridge',
          timestamp: new Date().toISOString(),
        },
      };

      // Call orchestrator
      const orchestratorResponse = await this.callOrchestrator(orchestratorRequest);

      if (!orchestratorResponse) {
        return {
          success: false,
          responseId,
          error: 'Failed to reach orchestrator service',
        };
      }

      // Process orchestrator response
      const response: AppResponse = {
        success: true,
        responseId,
        message: orchestratorResponse.reply,
        data: {
          actions: orchestratorResponse.actions,
          context: orchestratorResponse.context,
          confidence: orchestratorResponse.confidence,
        },
      };

      // Execute any actions from orchestrator
      if (orchestratorResponse.actions && orchestratorResponse.actions.length > 0) {
        await this.executeActions(orchestratorResponse.actions, userId);
      }

      return response;
    } catch (error) {
      logger.error('Error handling app message', { userId, responseId, error });
      return {
        success: false,
        responseId,
        error: error instanceof Error ? error.message : 'Internal error',
      };
    }
  }

  /**
   * Call the orchestrator service
   */
  private async callOrchestrator(request: OrchestratorRequest): Promise<OrchestratorResponse | null> {
    try {
      const controller = new AbortController();

      // Set timeout using Promise.race
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000);
      });

      const fetchPromise = fetch(`${this.orchestratorUrl}/api/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.internalToken,
          'X-Service-Name': 'app-bridge',
        },
        body: JSON.stringify(request),
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        logger.error('Orchestrator returned error', {
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const data = await response.json() as OrchestratorResponse;
      return data;
    } catch (error) {
      if (error instanceof Error && error.message === 'Request timeout') {
        logger.error('Orchestrator request timed out', { request });
      } else {
        logger.error('Failed to call orchestrator', { error });
      }
      return null;
    }
  }

  /**
   * Execute actions returned by orchestrator
   */
  private async executeActions(
    actions: Array<{ type: string; params: Record<string, unknown> }>,
    userId: string
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'send_push':
            await pushService.sendPush(
              userId,
              action.params.title as string,
              action.params.body as string,
              action.params.data as object
            );
            break;

          case 'send_notification':
            await this.sendInAppNotification(userId, {
              userId,
              title: action.params.title as string,
              body: action.params.body as string,
              type: (action.params.notificationType as InAppNotification['type']) || 'info',
              data: action.params.data as Record<string, unknown>,
            });
            break;

          case 'subscribe_topic':
            await pushService.subscribeToTopic(userId, action.params.topic as string);
            break;

          default:
            logger.warn('Unknown action type', { actionType: action.type });
        }
      } catch (error) {
        logger.error('Failed to execute action', { action, error });
      }
    }
  }

  /**
   * Send in-app notification (stored and delivered via WebSocket)
   */
  async sendInAppNotification(userId: string, notification: InAppNotification): Promise<void> {
    try {
      const validated = InAppNotificationSchema.safeParse(notification);
      if (!validated.success) {
        logger.warn('Invalid notification format', { errors: validated.error.issues });
        throw new Error('Invalid notification format');
      }

      const fullNotification = {
        ...validated.data,
        id: uuidv4(),
        createdAt: new Date(),
        read: false,
      };

      logger.info('In-app notification created', {
        userId,
        notificationId: fullNotification.id,
        type: fullNotification.type,
      });

      // Store notification (in production, this would go to MongoDB)
      // For now, we'll emit via WebSocket directly
      this.emitNotification(userId, fullNotification);
    } catch (error) {
      logger.error('Failed to send in-app notification', { userId, error });
      throw error;
    }
  }

  /**
   * Emit notification via WebSocket
   * This will be connected to WebSocketService
   */
  private emitNotification(userId: string, notification: InAppNotification & { id: string; createdAt: Date; read: boolean }): void {
    // This will be implemented by WebSocketService
    // We use a simple event emitter pattern here
    if (typeof global !== 'undefined' && (global as unknown).emitNotification) {
      (global as unknown).emitNotification(userId, notification);
    }
  }

  /**
   * Get user session context from orchestrator
   */
  async getUserContext(userId: string): Promise<Record<string, unknown> | null> {
    try {
      // Set timeout using Promise.race
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });

      const fetchPromise = fetch(`${this.orchestratorUrl}/api/context/${userId}`, {
        method: 'GET',
        headers: {
          'X-Internal-Token': this.internalToken,
          'X-Service-Name': 'app-bridge',
        },
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as Record<string, unknown>;
      return data;
    } catch (error) {
      logger.error('Failed to get user context', { userId, error });
      return null;
    }
  }
}

export const appService = new AppService();

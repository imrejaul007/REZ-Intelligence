import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { MessageBridge, OrchestratorResponse } from './messageBridge';

export interface ResponseContext {
  sessionId: string;
  phoneNumber: string;
  userId: string;
  messageId: string;
  timestamp: string;
  expertName?: string;
}

export interface ResponseQueueItem {
  id: string;
  context: ResponseContext;
  response: OrchestratorResponse;
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
  scheduledFor?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface ResponseBridgeConfig {
  messageBridge: MessageBridge;
  maxRetries: number;
  retryDelayMs: number;
  processingIntervalMs: number;
  maxQueueSize: number;
}

export class ResponseBridge {
  private messageBridge: MessageBridge;
  private config: ResponseBridgeConfig;
  private processingQueue: Map<string, ResponseQueueItem> = new Map();
  private isProcessing: boolean = false;
  private isRunning: boolean = false;
  private processingTimer?: NodeJS.Timeout;

  constructor(config: ResponseBridgeConfig) {
    this.messageBridge = config.messageBridge;
    this.config = config;
  }

  /**
   * Queue a response for delivery
   */
  async queueResponse(
    context: ResponseContext,
    response: OrchestratorResponse,
    options: {
      priority?: 'high' | 'normal' | 'low';
      scheduledFor?: string;
    } = {}
  ): Promise<string> {
    const item: ResponseQueueItem = {
      id: uuidv4(),
      context,
      response,
      priority: options.priority || 'normal',
      createdAt: new Date().toISOString(),
      scheduledFor: options.scheduledFor,
      status: 'pending',
      retryCount: 0,
    };

    // Check queue size limit
    if (this.processingQueue.size >= this.config.maxQueueSize) {
      // Remove lowest priority item
      await this.removeLowestPriority();
    }

    this.processingQueue.set(item.id, item);

    logger.info('Response queued', {
      id: item.id,
      phoneNumber: context.phoneNumber,
      priority: item.priority,
      scheduledFor: item.scheduledFor,
    });

    return item.id;
  }

  /**
   * Process a single response immediately
   */
  async processResponse(
    context: ResponseContext,
    response: OrchestratorResponse
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Mark message as read
      if (context.messageId) {
        await this.messageBridge.markAsRead(
          process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          context.messageId
        );
      }

      // Send the response
      const messageId = await this.messageBridge.processAndSendResponse(
        context.phoneNumber,
        response
      );

      logger.info('Response processed successfully', {
        phoneNumber: context.phoneNumber,
        messageId,
        expertName: context.expertName,
      });

      return { success: true, messageId: messageId || undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to process response', {
        phoneNumber: context.phoneNumber,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send typing indicator to user
   */
  async sendTypingIndicator(phoneNumberId: string): Promise<void> {
    // Note: WhatsApp Business API has limited support for typing indicators
    // This would require WebSocket connection or polling
    logger.debug('Typing indicator requested', { phoneNumberId });
  }

  /**
   * Start processing queue
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.processQueue();

    logger.info('Response Bridge started');
  }

  /**
   * Stop processing queue
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = undefined;
    }

    // Process remaining items
    await this.processRemaining();

    logger.info('Response Bridge stopped');
  }

  /**
   * Main queue processing loop
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (!this.isProcessing) {
        await this.processNextBatch();
      }
    } catch (error) {
      logger.error('Queue processing error', { error });
    }

    // Schedule next processing
    this.processingTimer = setTimeout(() => {
      this.processQueue();
    }, this.config.processingIntervalMs);
  }

  /**
   * Process next batch of queued responses
   */
  private async processNextBatch(): Promise<void> {
    this.isProcessing = true;

    const now = new Date();
    const items = Array.from(this.processingQueue.values())
      .filter(item => item.status === 'pending')
      .filter(item => !item.scheduledFor || new Date(item.scheduledFor) <= now)
      .sort((a, b) => {
        // Sort by priority first, then by creation time
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .slice(0, 10); // Process max 10 items at a time

    for (const item of items) {
      if (!this.isRunning) break;

      try {
        item.status = 'processing';

        const result = await this.processResponse(item.context, item.response);

        if (result.success) {
          item.status = 'completed';
          this.processingQueue.delete(item.id);
        } else {
          item.retryCount++;
          item.lastError = result.error;

          if (item.retryCount >= this.config.maxRetries) {
            item.status = 'failed';
            logger.error('Response permanently failed after max retries', {
              id: item.id,
              phoneNumber: item.context.phoneNumber,
              retryCount: item.retryCount,
            });
            this.processingQueue.delete(item.id);
          } else {
            item.status = 'pending';
            // Schedule retry
            item.scheduledFor = new Date(
              Date.now() + this.config.retryDelayMs * item.retryCount
            ).toISOString();
          }
        }
      } catch (error) {
        logger.error('Error processing queue item', {
          id: item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Remove lowest priority item from queue
   */
  private async removeLowestPriority(): Promise<void> {
    const items = Array.from(this.processingQueue.values())
      .filter(item => item.status === 'pending');

    if (items.length > 0) {
      // Remove the oldest low priority item
      const toRemove = items
        .filter(item => item.priority === 'low')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

      if (toRemove) {
        this.processingQueue.delete(toRemove.id);
        logger.warn('Queue full, removed lowest priority item', { id: toRemove.id });
      }
    }
  }

  /**
   * Process all remaining items before shutdown
   */
  private async processRemaining(): Promise<void> {
    const remaining = Array.from(this.processingQueue.values())
      .filter(item => item.status === 'pending');

    logger.info('Processing remaining queue items before shutdown', { count: remaining.length });

    for (const item of remaining) {
      try {
        await this.processResponse(item.context, item.response);
        this.processingQueue.delete(item.id);
      } catch (error) {
        logger.error('Failed to process remaining item', {
          id: item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    processing: number;
    failed: number;
    byPriority: Record<string, number>;
  } {
    const items = Array.from(this.processingQueue.values());
    const byPriority: Record<string, number> = { high: 0, normal: 0, low: 0 };

    items.forEach(item => {
      byPriority[item.priority]++;
    });

    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      processing: items.filter(i => i.status === 'processing').length,
      failed: items.filter(i => i.status === 'failed').length,
      byPriority,
    };
  }

  /**
   * Cancel a queued response
   */
  cancelResponse(id: string): boolean {
    const item = this.processingQueue.get(id);
    if (item && item.status === 'pending') {
      this.processingQueue.delete(id);
      logger.info('Response cancelled', { id });
      return true;
    }
    return false;
  }

  /**
   * Reschedule a failed response
   */
  async rescheduleResponse(
    id: string,
    scheduledFor: string
  ): Promise<boolean> {
    const item = this.processingQueue.get(id);
    if (item && (item.status === 'failed' || item.status === 'pending')) {
      item.status = 'pending';
      item.scheduledFor = scheduledFor;
      item.retryCount = 0;
      item.lastError = undefined;
      logger.info('Response rescheduled', { id, scheduledFor });
      return true;
    }
    return false;
  }
}

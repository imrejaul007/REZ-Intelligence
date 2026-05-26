import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import twilio from 'twilio';
import { Broadcast, IBroadcast, IBroadcastModel } from '../models/Broadcast';
import { Template, ITemplate } from '../models/Template';
import {
  BroadcastStatus,
  BroadcastCreateInput,
  BroadcastSegment,
  MessageType,
  TemplateComponent,
} from '../types/whatsapp';
import { logger } from '../utils/logger.js';

interface UserProfile {
  userId: string;
  phone: string;
  name?: string;
  tags?: string[];
  merchantId?: string;
}

interface BroadcastResult {
  success: boolean;
  broadcast?: IBroadcast;
  error?: string;
}

export class BroadcastService {
  private twilioClient: twilio.Twilio;
  private whatsappPhoneNumber: string;
  private userServiceUrl: string;
  private maxBatchSize: number = 100;
  private batchDelayMs: number = 1000; // 1 second between batches

  constructor(
    twilioClient: twilio.Twilio,
    whatsappPhoneNumber: string,
    options?: {
      userServiceUrl?: string;
      maxBatchSize?: number;
      batchDelayMs?: number;
    }
  ) {
    this.twilioClient = twilioClient;
    this.whatsappPhoneNumber = whatsappPhoneNumber;
    this.userServiceUrl = options?.userServiceUrl || process.env.USER_SERVICE_URL || 'http://localhost:4013';
    this.maxBatchSize = options?.maxBatchSize || 100;
    this.batchDelayMs = options?.batchDelayMs || 1000;
  }

  /**
   * Create a new broadcast campaign
   */
  async createBroadcast(
    input: BroadcastCreateInput,
    merchantId?: string
  ): Promise<BroadcastResult> {
    try {
      // Validate template exists
      const template = await Template.findOne({ templateId: input.templateId });
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      if (template.status !== 'approved') {
        return { success: false, error: 'Template is not approved' };
      }

      const broadcastId = uuidv4();
      const broadcast = await Broadcast.create({
        broadcastId,
        name: input.name,
        merchantId: input.merchantId || merchantId,
        templateId: input.templateId,
        segment: input.segment,
        status: input.scheduledAt
          ? BroadcastStatus.SCHEDULED
          : BroadcastStatus.DRAFT,
        scheduledAt: input.scheduledAt,
        progress: {
          total: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        },
        results: [],
        metadata: input.metadata || {},
      });

      logger.info('Broadcast created', {
        broadcastId,
        name: input.name,
        templateId: input.templateId,
        scheduledAt: input.scheduledAt,
      });

      return { success: true, broadcast };
    } catch (error) {
      logger.error('Failed to create broadcast', { error });
      return { success: false, error: 'Failed to create broadcast' };
    }
  }

  /**
   * Start a broadcast campaign
   */
  async startBroadcast(broadcastId: string): Promise<BroadcastResult> {
    const broadcast = await Broadcast.findOne({ broadcastId });
    if (!broadcast) {
      return { success: false, error: 'Broadcast not found' };
    }

    const broadcastDoc = broadcast as IBroadcast;
    if (!broadcastDoc.canStart()) {
      return { success: false, error: 'Cannot start broadcast in current state' };
    }

    try {
      // Get recipients based on segment
      const recipients = await this.getRecipients(broadcastDoc.segment, broadcastDoc.merchantId);

      if (recipients.length === 0) {
        return { success: false, error: 'No recipients found for segment' };
      }

      // Initialize broadcast with recipients
      await broadcastDoc.start(recipients);

      // Get template for sending
      const template = await Template.findOne({ templateId: broadcastDoc.templateId });
      if (!template) {
        broadcastDoc.status = BroadcastStatus.FAILED;
        await broadcastDoc.save();
        return { success: false, error: 'Template not found' };
      }

      await broadcast.save();

      // Start sending in background
      this.executeBroadcast(broadcastId, template, recipients).catch((error) => {
        logger.error('Broadcast execution failed', {
          broadcastId,
          error,
        });
      });

      logger.info('Broadcast started', {
        broadcastId,
        recipientCount: recipients.length,
      });

      return { success: true, broadcast };
    } catch (error) {
      logger.error('Failed to start broadcast', {
        broadcastId,
        error,
      });
      broadcast.status = BroadcastStatus.FAILED;
      await broadcast.save();
      return { success: false, error: 'Failed to start broadcast' };
    }
  }

  /**
   * Execute broadcast sending
   */
  private async executeBroadcast(
    broadcastId: string,
    template: ITemplate,
    recipients: UserProfile[]
  ): Promise<void> {
    let successCount = 0;
    let failCount = 0;

    // Process in batches
    for (let i = 0; i < recipients.length; i += this.maxBatchSize) {
      const batch = recipients.slice(i, i + this.maxBatchSize);

      const results = await Promise.allSettled(
        batch.map((recipient) => this.sendBroadcastMessage(broadcastId, template, recipient))
      );

      results.forEach((result, index) => {
        const globalIndex = i + index;
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      });

      // Update progress in database
      await Broadcast.updateOne(
        { broadcastId },
        {
          $set: {
            'progress.sent': successCount,
            'progress.failed': failCount,
          },
        }
      );

      // Delay between batches
      if (i + this.maxBatchSize < recipients.length) {
        await this.delay(this.batchDelayMs);
      }
    }

    // Mark broadcast as completed
    await Broadcast.updateOne(
      { broadcastId },
      {
        $set: {
          status: BroadcastStatus.COMPLETED,
          completedAt: new Date(),
          'progress.endTime': new Date(),
        },
      }
    );

    logger.info('Broadcast completed', {
      broadcastId,
      successCount,
      failCount,
    });
  }

  /**
   * Send a single broadcast message
   */
  private async sendBroadcastMessage(
    broadcastId: string,
    template: ITemplate,
    recipient: UserProfile
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Build message with template variables
      const variables = this.extractTemplateVariables(recipient);
      const rendered = this.renderTemplate(template, variables);

      // Send via Twilio
      await this.twilioClient.messages.create({
        from: `whatsapp:${this.whatsappPhoneNumber}`,
        to: `whatsapp:${recipient.phone}`,
        body: rendered.body,
      });

      // Update result status
      await Broadcast.updateOne(
        {
          broadcastId,
          'results.userId': recipient.userId,
        },
        {
          $set: {
            'results.$.status': 'sent',
            'results.$.sentAt': new Date(),
          },
        }
      );

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await Broadcast.updateOne(
        {
          broadcastId,
          'results.userId': recipient.userId,
        },
        {
          $set: {
            'results.$.status': 'failed',
            'results.$.error': errorMessage,
          },
        }
      );

      logger.error('Broadcast message failed', {
        broadcastId,
        userId: recipient.userId,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Cancel a broadcast
   */
  async cancelBroadcast(broadcastId: string): Promise<BroadcastResult> {
    const broadcast = await Broadcast.findOne({ broadcastId });
    if (!broadcast) {
      return { success: false, error: 'Broadcast not found' };
    }

    const cancelled = broadcast.cancel();
    if (!cancelled) {
      return { success: false, error: 'Cannot cancel this broadcast' };
    }

    await broadcast.save();

    logger.info('Broadcast cancelled', { broadcastId });

    return { success: true, broadcast };
  }

  /**
   * Get broadcast status
   */
  async getBroadcastStatus(broadcastId: string): Promise<{
    success: boolean;
    broadcast?: IBroadcast;
    progress?: {
      total: number;
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      startTime: Date;
      endTime?: Date;
    };
    error?: string;
  }> {
    const broadcast = await Broadcast.findOne({ broadcastId });
    if (!broadcast) {
      return { success: false, error: 'Broadcast not found' };
    }

    const broadcastDoc = broadcast as IBroadcast;
    return {
      success: true,
      broadcast: broadcastDoc,
      progress: broadcastDoc.getProgress(),
    };
  }

  /**
   * Get recipients based on segment
   */
  private async getRecipients(
    segment: BroadcastSegment,
    merchantId?: string
  ): Promise<UserProfile[]> {
    try {
      switch (segment.type) {
        case 'all':
          return this.getAllUsers(merchantId);
        case 'merchant':
          return this.getUsersByMerchant(segment.merchantId || merchantId);
        case 'tag':
          return this.getUsersByTags(segment.tags || []);
        case 'custom':
          return this.getCustomRecipients(segment.userIds || []);
        default:
          return [];
      }
    } catch (error) {
      logger.error('Failed to get recipients', { segment, error });
      return [];
    }
  }

  private async getAllUsers(merchantId?: string): Promise<UserProfile[]> {
    const USER_SERVICE_TIMEOUT_MS = 8000; // 8 second timeout

    // Call user service to get all users
    try {
      const response = await axios.get(`${this.userServiceUrl}/api/users`, {
        params: merchantId ? { merchantId } : {},
        headers: {
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
        },
        timeout: USER_SERVICE_TIMEOUT_MS,
      });

      // Validate response structure
      if (!response.data || !Array.isArray(response.data.users)) {
        logger.error('Invalid user service response structure', {
          orderId: 'N/A',
          response: typeof response.data,
        });
        return [];
      }

      return response.data.users.map((user: Record<string, unknown>) => ({
        userId: user.id as string,
        phone: user.phone as string,
        name: user.name as string,
        merchantId: user.merchantId as string,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get users from user service', {
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
        merchantId: merchantId || 'all',
      });

      // CRITICAL FIX: Return empty array instead of silently falling back to mock data
      // This prevents broadcast from sending to unintended test users
      // Only use mock data in development:
      if (process.env.NODE_ENV === 'development') {
        logger.warn('DEV MODE: Using mock users due to service failure', { error: errorMessage });
        return [
          { userId: 'user1', phone: '+919876543210', name: 'Test User 1' },
          { userId: 'user2', phone: '+919876543211', name: 'Test User 2' },
        ];
      }

      return [];
    }
  }

  private async getUsersByMerchant(merchantId?: string): Promise<UserProfile[]> {
    const USER_SERVICE_TIMEOUT_MS = 8000; // 8 second timeout

    if (!merchantId) {
      return [];
    }

    try {
      const response = await axios.get(
        `${this.userServiceUrl}/api/users/merchant/${merchantId}`,
        {
          headers: {
            'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          },
          timeout: USER_SERVICE_TIMEOUT_MS,
        }
      );

      // Validate response structure
      if (!response.data || !Array.isArray(response.data.users)) {
        logger.error('Invalid merchant users response', { merchantId });
        return [];
      }

      return response.data.users.map((user: Record<string, unknown>) => ({
        userId: user.id as string,
        phone: user.phone as string,
        name: user.name as string,
        merchantId: merchantId,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get merchant users', {
        merchantId,
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
      });
      return [];
    }
  }

  private async getUsersByTags(tags: string[]): Promise<UserProfile[]> {
    const USER_SERVICE_TIMEOUT_MS = 8000; // 8 second timeout

    if (!tags || tags.length === 0) {
      return [];
    }

    try {
      const response = await axios.post(
        `${this.userServiceUrl}/api/users/by-tags`,
        { tags },
        {
          headers: {
            'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          },
          timeout: USER_SERVICE_TIMEOUT_MS,
        }
      );

      // Validate response structure
      if (!response.data || !Array.isArray(response.data.users)) {
        logger.error('Invalid users by tags response', { tags });
        return [];
      }

      return response.data.users.map((user: Record<string, unknown>) => ({
        userId: user.id as string,
        phone: user.phone as string,
        name: user.name as string,
        tags: user.tags as string[],
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get users by tags', {
        tags,
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
      });
      return [];
    }
  }

  private async getCustomRecipients(userIds: string[]): Promise<UserProfile[]> {
    const USER_SERVICE_TIMEOUT_MS = 8000; // 8 second timeout

    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      const response = await axios.post(
        `${this.userServiceUrl}/api/users/batch`,
        { userIds },
        {
          headers: {
            'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          },
          timeout: USER_SERVICE_TIMEOUT_MS,
        }
      );

      // Validate response structure
      if (!response.data || !Array.isArray(response.data.users)) {
        logger.error('Invalid batch users response', { userIds: userIds.length });
        return [];
      }

      return response.data.users.map((user: Record<string, unknown>) => ({
        userId: user.id as string,
        phone: user.phone as string,
        name: user.name as string,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get custom recipients', {
        userIds: userIds.length,
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
      });
      return [];
    }
  }

  /**
   * Extract template variables from user profile
   */
  private extractTemplateVariables(user: UserProfile): Record<string, string> {
    return {
      '1': user.name || 'Customer',
      '2': new Date().toLocaleDateString('en-IN'),
    };
  }

  /**
   * Render template with variables
   */
  private renderTemplate(
    template: ITemplate,
    variables: Record<string, string>
  ): { body: string; header?: string; footer?: string } {
    const bodyComponent = template.components.find((c) => c.type === 'body');
    const headerComponent = template.components.find((c) => c.type === 'header');
    const footerComponent = template.components.find((c) => c.type === 'footer');

    let body = bodyComponent?.text || '';
    Object.entries(variables).forEach(([key, value]) => {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    let header: string | undefined;
    if (headerComponent?.text) {
      header = headerComponent.text;
      Object.entries(variables).forEach(([key, value]) => {
        header = header!.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    const footer = footerComponent?.text;

    return { body, header, footer };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * List broadcasts
   */
  async listBroadcasts(options?: {
    merchantId?: string;
    status?: BroadcastStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    broadcasts: IBroadcast[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (options?.merchantId) {
      query.merchantId = options.merchantId;
    }
    if (options?.status) {
      query.status = options.status;
    }

    const [broadcasts, total] = await Promise.all([
      Broadcast.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Broadcast.countDocuments(query),
    ]);

    return { broadcasts, total, page, limit };
  }

  /**
   * Get broadcast statistics
   */
  async getBroadcastStats(merchantId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    avgDeliveryRate: number;
    avgReadRate: number;
  }> {
    const stats = await (Broadcast as IBroadcastModel).getBroadcastStats(merchantId);
    if (!stats || typeof stats !== 'object') {
      return { total: 0, byStatus: {}, avgDeliveryRate: 0, avgReadRate: 0 };
    }
    // Transform stats to expected format
    const s = stats as Record<string, unknown>;
    return {
      total: (s.total as number) || 0,
      byStatus: (s.byStatus as Record<string, number>) || {},
      avgDeliveryRate: (s.avgDeliveryRate as number) || 0,
      avgReadRate: (s.avgReadRate as number) || 0,
    };
  }

  /**
   * Process scheduled broadcasts
   */
  async processScheduledBroadcasts(): Promise<number> {
    const scheduled = await (Broadcast as IBroadcastModel).findScheduled();
    let processed = 0;

    for (const broadcast of scheduled) {
      const result = await this.startBroadcast(broadcast.broadcastId);
      if (result.success) {
        processed++;
      }
    }

    if (processed > 0) {
      logger.info('Scheduled broadcasts processed', { count: processed });
    }

    return processed;
  }
}

export default BroadcastService;

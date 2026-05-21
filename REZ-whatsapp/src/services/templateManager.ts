import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import { Template, ITemplate } from '../models/Template';
import {
  TemplateCategory,
  TemplateStatus,
  TemplateCreateInput,
  TemplateComponent,
} from '../types/whatsapp';
import { logger } from '../utils/logger';

export class TemplateManager {
  private twilioClient: twilio.Twilio;
  private businessAccountId: string;

  constructor(twilioClient: twilio.Twilio, businessAccountId: string) {
    this.twilioClient = twilioClient;
    this.businessAccountId = businessAccountId;
  }

  /**
   * Create a new WhatsApp template
   */
  async createTemplate(
    input: TemplateCreateInput,
    businessAccountId?: string
  ): Promise<ITemplate> {
    const templateId = uuidv4();
    const accountId = businessAccountId || this.businessAccountId;

    // Validate template structure
    this.validateTemplate(input);

    const template = await Template.create({
      templateId,
      name: input.name,
      businessAccountId: accountId,
      category: input.category,
      language: input.language || 'en',
      components: input.components,
      status: TemplateStatus.PENDING,
      merchantId: input.merchantId,
      metadata: input.metadata || {},
    });

    logger.info('Template created', {
      templateId,
      name: input.name,
      category: input.category,
    });

    return template;
  }

  /**
   * Register template with Twilio WhatsApp Business API
   */
  async registerWithTwilio(templateId: string): Promise<ITemplate> {
    const template = await Template.findOne({ templateId });
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      // Build Twilio template format
      const twilioTemplate = this.buildTwilioTemplate(template);

      // Submit to Twilio for approval
      const result = await this.twilioClient.conversations.v1
        .conversations(template.businessAccountId)
        .messages.create({
          contentSid: twilioTemplate.contentSid,
          contentVariables: twilioTemplate.contentVariables,
        });

      template.twilioTemplateSid = result.sid;
      template.status = TemplateStatus.PENDING;
      await template.save();

      logger.info('Template registered with Twilio', {
        templateId,
        twilioSid: result.sid,
      });

      return template;
    } catch (error) {
      logger.error('Failed to register template with Twilio', {
        templateId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<ITemplate | null> {
    return Template.findOne({ templateId });
  }

  /**
   * Get template by Twilio SID
   */
  async getTemplateBySid(twilioSid: string): Promise<ITemplate | null> {
    return Template.findOne({ twilioTemplateSid: twilioSid });
  }

  /**
   * Get template by name and language
   */
  async getTemplateByName(
    name: string,
    language: string = 'en'
  ): Promise<ITemplate | null> {
    return Template.findOne({ name, language });
  }

  /**
   * List templates with filtering
   */
  async listTemplates(options: {
    merchantId?: string;
    status?: TemplateStatus;
    category?: TemplateCategory;
    language?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    templates: ITemplate[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (options.merchantId) {
      query.$or = [
        { merchantId: options.merchantId },
        { merchantId: { $exists: false } },
      ];
    }
    if (options.status) {
      query.status = options.status;
    }
    if (options.category) {
      query.category = options.category;
    }
    if (options.language) {
      query.language = options.language;
    }

    const [templates, total] = await Promise.all([
      Template.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Template.countDocuments(query),
    ]);

    return { templates, total, page, limit };
  }

  /**
   * Update template status
   */
  async updateTemplateStatus(
    templateId: string,
    status: TemplateStatus,
    twilioSid?: string
  ): Promise<ITemplate | null> {
    const update: Record<string, unknown> = { status };
    if (twilioSid) {
      update.twilioTemplateSid = twilioSid;
    }

    const template = await Template.findOneAndUpdate(
      { templateId },
      { $set: update },
      { new: true }
    );

    if (template) {
      logger.info('Template status updated', { templateId, status });
    }

    return template;
  }

  /**
   * Update template content
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<TemplateCreateInput>
  ): Promise<ITemplate | null> {
    const template = await Template.findOne({ templateId });
    if (!template) {
      return null;
    }

    // Can only update pending templates
    if (template.status !== TemplateStatus.PENDING) {
      throw new Error(
        `Cannot update template with status: ${template.status}`
      );
    }

    if (updates.name) template.name = updates.name;
    if (updates.category) template.category = updates.category;
    if (updates.language) template.language = updates.language;
    if (updates.components) template.components = updates.components;
    if (updates.metadata) {
      template.metadata = { ...template.metadata, ...updates.metadata };
    }

    await template.save();

    logger.info('Template updated', { templateId });

    return template;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const template = await Template.findOne({ templateId });
    if (!template) {
      return false;
    }

    // Can only delete pending templates
    if (template.status === TemplateStatus.APPROVED) {
      throw new Error('Cannot delete approved templates');
    }

    await Template.deleteOne({ templateId });

    logger.info('Template deleted', { templateId });

    return true;
  }

  /**
   * Validate template for sending
   */
  async validateForSending(templateId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      return { valid: false, errors: ['Template not found'] };
    }

    return template.validateForSending();
  }

  /**
   * Render template with variables
   */
  renderTemplate(
    template: ITemplate,
    variables: Record<string, string>
  ): {
    body: string;
    header?: string;
    footer?: string;
    buttons?: Array<{ type: string; text: string; url?: string }>;
  } {
    const bodyComponent = template.components.find((c) => c.type === 'body');
    const headerComponent = template.components.find((c) => c.type === 'header');
    const footerComponent = template.components.find((c) => c.type === 'footer');
    const buttonComponent = template.components.find((c) => c.type === 'button');

    let body = bodyComponent?.text || '';

    // Replace {{1}}, {{2}}, etc. with variable values
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      body = body.replace(regex, value);
    });

    let header: string | undefined;
    if (headerComponent?.text) {
      header = headerComponent.text;
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        header = header!.replace(regex, value);
      });
    }

    const footer = footerComponent?.text;

    const buttons = buttonComponent?.buttons?.map((btn) => ({
      type: btn.type,
      text: btn.text,
      url: btn.url,
    }));

    return { body, header, footer, buttons };
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: TemplateCategory,
    merchantId?: string
  ): Promise<ITemplate[]> {
    const query: Record<string, unknown> = {
      category,
      status: TemplateStatus.APPROVED,
    };

    if (merchantId) {
      query.$or = [
        { merchantId },
        { merchantId: { $exists: false } },
      ];
    }

    return Template.find(query).sort({ name: 1 });
  }

  /**
   * Sync templates from Twilio
   */
  async syncFromTwilio(): Promise<{
    synced: number;
    errors: number;
  }> {
    let synced = 0;
    let errors = 0;

    try {
      // Get approved templates from Twilio - use v1 as fallback
      const twilioClient = this.twilioClient as any;
      const twilioTemplates =
        await (twilioClient.whatsapp?.v1
          ?.services?.(this.businessAccountId)
          ?.templates?.list?.() || []);

      for (const twilioTemplate of twilioTemplates) {
        try {
          const existingTemplate = await this.getTemplateBySid(twilioTemplate.sid);

          const statusMap: Record<string, TemplateStatus> = {
            PENDING: TemplateStatus.PENDING,
            APPROVED: TemplateStatus.APPROVED,
            REJECTED: TemplateStatus.REJECTED,
            PAUSED: TemplateStatus.PAUSED,
          };

          if (existingTemplate) {
            existingTemplate.status = statusMap[twilioTemplate.status] || TemplateStatus.PENDING;
            await existingTemplate.save();
          } else {
            await Template.create({
              templateId: uuidv4(),
              name: twilioTemplate.name,
              businessAccountId: this.businessAccountId,
              category: this.mapTwilioCategory(twilioTemplate.category),
              language: twilioTemplate.language,
              components: this.parseTwilioComponents(twilioTemplate.components || []),
              status: statusMap[twilioTemplate.status] || TemplateStatus.PENDING,
              twilioTemplateSid: twilioTemplate.sid,
            });
          }

          synced++;
        } catch (error) {
          logger.error('Failed to sync Twilio template', {
            sid: twilioTemplate.sid,
            error,
          });
          errors++;
        }
      }
    } catch (error) {
      logger.error('Failed to fetch Twilio templates', { error });
      throw error;
    }

    logger.info('Twilio templates synced', { synced, errors });

    return { synced, errors };
  }

  /**
   * Get template statistics
   */
  async getStats(merchantId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const matchStage: Record<string, unknown> = {};
    if (merchantId) {
      matchStage.merchantId = merchantId;
    }

    const [statusStats, categoryStats, totalCount] = await Promise.all([
      Template.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Template.aggregate([
        { $match: matchStage },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      Template.countDocuments(matchStage),
    ]);

    const byStatus: Record<string, number> = {};
    statusStats.forEach((s) => {
      byStatus[s._id] = s.count;
    });

    const byCategory: Record<string, number> = {};
    categoryStats.forEach((s) => {
      byCategory[s._id] = s.count;
    });

    return { total: totalCount, byStatus, byCategory };
  }

  // Private helper methods

  private validateTemplate(input: TemplateCreateInput): void {
    const errors: string[] = [];

    // Must have body component
    const hasBody = input.components.some((c) => c.type === 'body');
    if (!hasBody) {
      errors.push('Template must have a body component');
    }

    // Validate body text length
    const body = input.components.find((c) => c.type === 'body');
    if (body?.text && body.text.length > 1024) {
      errors.push('Body text must be 1024 characters or less');
    }

    // Validate header
    const header = input.components.find((c) => c.type === 'header');
    if (header) {
      if (header.format === 'text' && header.text && header.text.length > 60) {
        errors.push('Header text must be 60 characters or less');
      }
      if (['image', 'video', 'document'].includes(header.format || '') &&
          !header.example?.header_text?.[0]) {
        errors.push('Media header requires example header text');
      }
    }

    // Validate buttons
    const buttons = input.components.find((c) => c.type === 'button')?.buttons;
    if (buttons && buttons.length > 10) {
      errors.push('Maximum 10 buttons allowed');
    }

    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }
  }

  private buildTwilioTemplate(template: ITemplate): {
    contentSid: string;
    contentVariables: string;
  } {
    // This would use Twilio's Content API
    // For now, return a placeholder structure
    const body = template.components.find((c) => c.type === 'body');
    const variables = body?.example?.body_text?.[0] || [];

    return {
      contentSid: template.twilioTemplateSid || '',
      contentVariables: JSON.stringify(
        variables.reduce((acc, val, idx) => {
          acc[(idx + 1).toString()] = val;
          return acc;
        }, {} as Record<string, string>)
      ),
    };
  }

  private mapTwilioCategory(category: string): TemplateCategory {
    const categoryMap: Record<string, TemplateCategory> = {
      MARKETING: TemplateCategory.MARKETING,
      UTILITY: TemplateCategory.UTILITY,
      AUTHENTICATION: TemplateCategory.AUTHENTICATION,
    };
    return categoryMap[category] || TemplateCategory.MARKETING;
  }

  private parseTwilioComponents(components: Array<{
    type: string;
    text?: string;
    format?: string;
  }>): TemplateComponent[] {
    return components.map((c) => ({
      type: c.type as 'header' | 'body' | 'footer' | 'button',
      format: c.format as 'text' | 'image' | 'video' | 'document' | undefined,
      text: c.text,
    }));
  }
}

export default TemplateManager;

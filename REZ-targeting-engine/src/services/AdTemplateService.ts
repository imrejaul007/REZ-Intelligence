import logger from './utils/logger.js';

import { AdTemplate, IAdTemplate } from '../models';
import { AdTemplate as AdTemplateType, TemplateContent, TemplateDesign } from '../types';
import { CHANNEL_CONFIG } from '../config/constants';

export interface CreateTemplateInput {
  name: string;
  channel: AdTemplateType['channel'];
  content: TemplateContent;
  design?: TemplateDesign;
  targeting?: {
    min_age?: number;
    max_age?: number;
    preferred_segments?: string[];
  };
}

export interface UpdateTemplateInput {
  name?: string;
  content?: TemplateContent;
  design?: TemplateDesign;
  targeting?: {
    min_age?: number;
    max_age?: number;
    preferred_segments?: string[];
  };
  is_active?: boolean;
}

class AdTemplateService {
  /**
   * Create a new ad template
   */
  async createTemplate(input: CreateTemplateInput): Promise<IAdTemplate> {
    const templateId = this.generateTemplateId(input.name, input.channel);

    // Validate required content fields based on channel
    this.validateContentFields(input.content, input.channel);

    const template = new AdTemplate({
      template_id: templateId,
      name: input.name,
      channel: input.channel,
      content: input.content,
      design: input.design || { layout: 'standard' },
      targeting: input.targeting,
      is_active: true
    });

    await template.save();
    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<IAdTemplate | null> {
    return AdTemplate.findOne({ template_id: templateId });
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, input: UpdateTemplateInput): Promise<IAdTemplate | null> {
    const updateData: unknown = {};

    if (input.name) updateData.name = input.name;
    if (input.content) {
      this.validateContentFields(input.content, (await this.getTemplate(templateId))?.channel || 'banner');
      updateData.content = input.content;
    }
    if (input.design) updateData.design = input.design;
    if (input.targeting) updateData.targeting = input.targeting;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    return AdTemplate.findOneAndUpdate(
      { template_id: templateId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete template (soft delete - deactivate)
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const result = await AdTemplate.updateOne(
      { template_id: templateId },
      { $set: { is_active: false } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * List templates with filtering
   */
  async listTemplates(options: {
    channel?: AdTemplateType['channel'];
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ templates: IAdTemplate[]; total: number }> {
    const filter: unknown = {};

    if (options.channel) filter.channel = options.channel;
    if (options.is_active !== undefined) filter.is_active = options.is_active;

    const [templates, total] = await Promise.all([
      AdTemplate.find(filter)
        .sort({ created_at: -1 })
        .skip(options.offset || 0)
        .limit(options.limit || 20),
      AdTemplate.countDocuments(filter)
    ]);

    return { templates, total };
  }

  /**
   * Get templates by channel
   */
  async getTemplatesByChannel(channel: AdTemplateType['channel']): Promise<IAdTemplate[]> {
    return AdTemplate.find({ channel, is_active: true });
  }

  /**
   * Get default templates for each channel
   */
  async getDefaultTemplates(): Promise<Record<AdTemplateType['channel'], IAdTemplate[]>> {
    const channels: AdTemplateType['channel'][] = ['banner', 'push', 'in_app', 'sms', 'email'];
    const result: Record<string, IAdTemplate[]> = {};

    for (const channel of channels) {
      result[channel] = await AdTemplate.find({ channel, is_active: true }).limit(5);
    }

    return result as Record<AdTemplateType['channel'], IAdTemplate[]>;
  }

  /**
   * Personalize template content for a user
   */
  async personalizeContent(
    templateId: string,
    userData: {
      first_name?: string;
      last_name?: string;
      name?: string;
      preferred_categories?: string[];
      last_order_item?: string;
      loyalty_tier?: string;
      [key: string];
    }
  ): Promise<TemplateContent | null> {
    const template = await this.getTemplate(templateId);
    if (!template) return null;

    const content = { ...template.content };

    // Personalize headline
    if (content.headline) {
      content.headline = this.interpolateVariables(content.headline, userData);
    }

    // Personalize body
    if (content.body) {
      content.body = this.interpolateVariables(content.body, userData);
    }

    // Personalize CTA
    if (content.cta_text) {
      content.cta_text = this.interpolateVariables(content.cta_text, userData);
    }

    return content;
  }

  /**
   * Render template for specific channel format
   */
  async renderForChannel(
    templateId: string,
    channel: AdTemplateType['channel']
  ): Promise<{
    success: boolean;
    rendered;
    errors?: string[];
  }> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      return { success: false, rendered: null, errors: ['Template not found'] };
    }

    const errors: string[] = [];
    const channelConfig = CHANNEL_CONFIG[channel];

    // Validate channel compatibility
    if (template.channel !== channel) {
      errors.push(`Template was designed for ${template.channel}, not ${channel}`);
    }

    // Check required fields for channel
    const missingFields = channelConfig.min_template_fields.filter(
      field => !template.content[field as keyof typeof template.content]
    );

    if (missingFields.length > 0) {
      errors.push(`Missing required fields for ${channel}: ${missingFields.join(', ')}`);
    }

    // Render based on channel
    let rendered: unknown = {
      template_id: template.template_id,
      channel,
      content: { ...template.content },
      design: { ...template.design },
      metadata: {
        rendered_at: new Date().toISOString(),
        channel_config: {
          name: channelConfig.name,
          cost_multiplier: channelConfig.cost_multiplier,
          delivery_rate: channelConfig.delivery_rate
        }
      }
    };

    // Channel-specific rendering
    switch (channel) {
      case 'sms':
        // SMS has character limits
        rendered.sms_specific = {
          body_length: template.content.body.length,
          supports_unicode: true,
          recommended_max_length: 160,
          is_within_limit: template.content.body.length <= 160
        };
        break;

      case 'push':
        rendered.push_specific = {
          title_required: !!template.content.headline,
          body_max_length: 200,
          body_length: template.content.body.length
        };
        break;

      case 'email':
        rendered.email_specific = {
          subject_line: template.content.headline || template.content.body.substring(0, 60),
          preview_text: template.content.body.substring(0, 100),
          has_cta: !!template.content.cta_text
        };
        break;

      case 'banner':
        rendered.banner_specific = {
          image_required: !!template.content.image_url,
          image_aspect_ratio: '16:9',
          supports_responsive: true
        };
        break;

      case 'in_app':
        rendered.in_app_specific = {
          layout: template.design.layout,
          dismissible: true,
          auto_dismiss_seconds: 5
        };
        break;
    }

    return {
      success: errors.length === 0,
      rendered,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(templateId: string, newName: string): Promise<IAdTemplate | null> {
    const original = await this.getTemplate(templateId);
    if (!original) return null;

    return this.createTemplate({
      name: newName,
      channel: original.channel,
      content: original.content,
      design: original.design,
      targeting: original.targeting
    });
  }

  /**
   * Validate content fields for a channel
   */
  private validateContentFields(content: TemplateContent, channel: string): void {
    const channelConfig = CHANNEL_CONFIG[channel as keyof typeof CHANNEL_CONFIG];

    if (!channelConfig) {
      throw new Error(`Unknown channel: ${channel}`);
    }

    for (const field of channelConfig.min_template_fields) {
      if (!content[field as keyof TemplateContent]) {
        throw new Error(`Template content must include '${field}' for ${channelConfig.name}`);
      }
    }

    // Channel-specific validation
    if (channel === 'sms' && content.body.length > 160) {
      logger.warn(`SMS body exceeds recommended 160 character limit (${content.body.length} characters)`);
    }
  }

  /**
   * Generate unique template ID
   */
  private generateTemplateId(name: string, channel: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 20);
    const timestamp = Date.now().toString(36);
    const channelPrefix = channel.substring(0, 2);
    return `tpl_${channelPrefix}_${slug}_${timestamp}`;
  }

  /**
   * Interpolate variables in content
   */
  private interpolateVariables(text: string, data: Record<string, unknown>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Create default templates for a fresh installation
   */
  async createDefaultTemplates(): Promise<IAdTemplate[]> {
    const defaultTemplates = [
      {
        name: 'Welcome Banner',
        channel: 'banner' as const,
        content: {
          headline: 'Welcome to ReZ!',
          body: 'Discover amazing deals on your favorite cuisines. First order delivery fee on us!',
          cta_text: 'Order Now',
          cta_url: 'https://rez.app/order',
          image_url: 'https://cdn.rez.app/banners/welcome.jpg'
        },
        design: {
          layout: 'hero',
          colors: { primary: '#FF6B35', background: '#FFFFFF' }
        }
      },
      {
        name: 'Order Confirmation Push',
        channel: 'push' as const,
        content: {
          headline: 'Order Confirmed!',
          body: 'Your order #{{order_id}} is being prepared. Estimated delivery: {{delivery_time}}',
          cta_text: 'Track Order'
        },
        design: { layout: 'standard' }
      },
      {
        name: 'Flash Sale In-App',
        channel: 'in_app' as const,
        content: {
          headline: 'Flash Sale!',
          body: 'Get 20% off all orders placed in the next 2 hours. Use code: FLASH20',
          cta_text: 'Claim Offer',
          cta_url: 'https://rez.app/offers'
        },
        design: {
          layout: 'modal',
          colors: { primary: '#FFD700', background: '#1A1A2E' }
        }
      },
      {
        name: 'Reorder Reminder SMS',
        channel: 'sms' as const,
        content: {
          body: 'Hi {{first_name}}! Missing your favorite {{last_order_item}}? Reorder now and get free delivery with code: REORDER'
        },
        design: { layout: 'standard' }
      },
      {
        name: 'Weekly Deals Email',
        channel: 'email' as const,
        content: {
          headline: 'This Week\'s Best Deals',
          body: 'Explore handpicked deals from top-rated restaurants in your area. From {{min_price}} to {{max_price}} - there\'s something for everyone!',
          cta_text: 'Browse Deals',
          cta_url: 'https://rez.app/deals',
          image_url: 'https://cdn.rez.app/emails/weekly-deals.jpg'
        },
        design: {
          layout: 'newsletter',
          colors: { primary: '#FF6B35', background: '#F5F5F5' }
        }
      }
    ];

    const created = [];
    for (const template of defaultTemplates) {
      try {
        const createdTemplate = await this.createTemplate(template);
        created.push(createdTemplate);
      } catch (error) {
        console.error(`Failed to create template ${template.name}:`, error);
      }
    }

    return created;
  }
}

export const adTemplateService = new AdTemplateService();
export default adTemplateService;

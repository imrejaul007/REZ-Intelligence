/**
 * CorpPerks Notification Service
 *
 * Handles email, SMS, and push notifications for:
 * - Benefit allocations and resets
 * - Gift campaign invitations
 * - Karma campaign updates
 * - GST invoice notifications
 * - Hotel booking confirmations
 */

import { logger } from '../../config/logger';

// Types
export interface NotificationPayload {
  userId: string;
  employeeId: string;
  email?: string;
  phone?: string;
  channels: ('email' | 'sms' | 'push')[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export type NotificationType =
  | 'benefit_allocated'
  | 'benefit_reset'
  | 'benefit_expiring'
  | 'benefit_exhausted'
  | 'gift_campaign_invite'
  | 'gift_delivered'
  | 'hotel_booking_confirmed'
  | 'hotel_booking_cancelled'
  | 'karma_earned'
  | 'karma_badge_earned'
  | 'karma_campaign_join'
  | 'karma_campaign_complete'
  | 'expense_approved'
  | 'expense_rejected'
  | 'invoice_generated';

interface EmailTemplate {
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
}

interface SMSTemplate {
  template: string;
  maxLength: number;
}

// Email templates
const EMAIL_TEMPLATES: Record<NotificationType, EmailTemplate> = {
  benefit_allocated: {
    subject: 'New Benefit Allocated - {{companyName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8B5CF6, #A78BFA); padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">New Benefit Allocated!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Great news! Your employer has allocated new benefits for you:</p>
          <div style="background: #F5F3FF; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; font-size: 18px; color: #8B5CF6; font-weight: bold;">{{benefitType}}</p>
            <p style="margin: 4px 0 0; font-size: 32px; color: #333;">{{amount}}</p>
          </div>
          <p style="color: #333;">Valid until: {{validUntil}}</p>
          <a href="{{appUrl}}/benefits" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
            View Benefits
          </a>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, New benefit allocated: {{benefitType}} - {{amount}}. Valid until: {{validUntil}}.',
  },

  benefit_reset: {
    subject: 'Benefits Reset - {{companyName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #22C55E; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Benefits Reset!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your {{benefitType}} benefit has been reset for the new period.</p>
          <p style="color: #333;">Available balance: <strong>{{amount}}</strong></p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your {{benefitType}} benefit has been reset. Available: {{amount}}',
  },

  benefit_exhausted: {
    subject: 'Benefit Exhausted - {{companyName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #EF4444; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Benefit Exhausted</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your {{benefitType}} benefit has been fully utilized for this period.</p>
          <p style="color: #333;">Next reset date: <strong>{{resetDate}}</strong></p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your {{benefitType}} benefit is exhausted. Next reset: {{resetDate}}',
  },

  benefit_expiring: {
    subject: 'Benefits Expiring Soon - {{companyName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #F59E0B; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Benefits Expiring!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your {{benefitType}} benefit is about to expire:</p>
          <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #92400E;">Remaining balance: <strong>{{remainingAmount}}</strong></p>
            <p style="margin: 4px 0 0; color: #92400E;">Expires on: {{expiryDate}}</p>
          </div>
          <a href="{{appUrl}}/benefits" style="display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Use Benefits Now
          </a>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your {{benefitType}} ({{remainingAmount}}) expires on {{expiryDate}}. Use it or lose it!',
  },

  gift_campaign_invite: {
    subject: 'You\'re Invited: {{campaignName}} - {{companyName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #EC4899, #F472B6); padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Gift Campaign Invitation</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">You've been invited to participate in a gift campaign:</p>
          <h2 style="color: #EC4899; margin: 16px 0;">{{campaignName}}</h2>
          <p style="color: #333;">{{campaignDescription}}</p>
          <a href="{{appUrl}}/gifts/campaigns/{{campaignId}}" style="display: inline-block; background: #EC4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Claim Your Gift
          </a>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, You\'re invited to {{campaignName}}! Claim your gift now.',
  },

  gift_delivered: {
    subject: 'Your Gift Has Been Delivered! - {{companyName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #22C55E; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Gift Delivered!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Great news! Your gift has been delivered.</p>
          <p style="color: #333;">Campaign: {{campaignName}}</p>
          <p style="color: #333;">Delivered to: {{deliveryAddress}}</p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your gift ({{campaignName}}) has been delivered!',
  },

  hotel_booking_confirmed: {
    subject: 'Hotel Booking Confirmed - {{propertyName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3B82F6; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Booking Confirmed!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your hotel booking is confirmed!</p>
          <div style="background: #DBEAFE; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; font-weight: bold; color: #1E40AF;">{{propertyName}}</p>
            <p style="margin: 4px 0 0; color: #3B82F6;">Check-in: {{checkIn}}</p>
            <p style="margin: 4px 0 0; color: #3B82F6;">Check-out: {{checkOut}}</p>
            <p style="margin: 4px 0 0; color: #3B82F6;">Confirmation: {{confirmationNumber}}</p>
          </div>
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            View Booking
          </a>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your booking at {{propertyName}} is confirmed! {{checkIn}} - {{checkOut}}. Ref: {{confirmationNumber}}',
  },

  hotel_booking_cancelled: {
    subject: 'Hotel Booking Cancelled - {{confirmationNumber}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #EF4444; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your hotel booking has been cancelled.</p>
          <p style="color: #333;">Property: {{propertyName}}</p>
          <p style="color: #333;">Confirmation: {{confirmationNumber}}</p>
          {{#if refundAmount}}
          <p style="color: #333;">Refund amount: {{refundAmount}}</p>
          {{/if}}
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your booking at {{propertyName}} has been cancelled. Ref: {{confirmationNumber}}',
  },

  karma_earned: {
    subject: 'You Earned {{karmaPoints}} Karma Points!',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22C55E, #10B981); padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">+{{karmaPoints}} Karma</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">You earned karma points for your action:</p>
          <p style="font-weight: bold; color: #22C55E;">{{actionName}}</p>
          <p style="color: #333;">{{campaignName}}</p>
          <p style="color: #333;">Your new balance: {{totalKarma}} karma</p>
          <a href="{{appUrl}}/karma" style="display: inline-block; background: #22C55E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            View Karma
          </a>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, You earned {{karmaPoints}} karma for {{actionName}}! Total: {{totalKarma}}',
  },

  karma_badge_earned: {
    subject: 'You Earned a New Badge: {{badgeName}}!',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #F59E0B, #FBBF24); padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">New Badge Earned!</h1>
        </div>
        <div style="padding: 24px; text-align: center;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="font-size: 64px;">🏆</p>
          <p style="font-size: 24px; font-weight: bold; color: #F59E0B;">{{badgeName}}</p>
          <p style="color: #333;">{{badgeDescription}}</p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, You earned the {{badgeName}} badge!',
  },

  karma_campaign_join: {
    subject: 'Welcome to {{campaignName}}!',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22C55E, #10B981); padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Campaign Joined!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">You've joined the {{campaignName}} campaign!</p>
          <p style="color: #333;">Start making an impact and earn karma points.</p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, You joined {{campaignName}}! Start earning karma.',
  },

  karma_campaign_complete: {
    subject: 'Campaign Complete! - {{campaignName}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8B5CF6, #A78BFA); padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Campaign Complete!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Congratulations! You've completed {{campaignName}}!</p>
          <p style="color: #333;">Impact: {{impactMetric}}</p>
          <p style="color: #333;">Bonus karma earned: {{bonusKarma}}</p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, You completed {{campaignName}}! Impact: {{impactMetric}}. Bonus: +{{bonusKarma}} karma',
  },

  expense_approved: {
    subject: 'Expense Claim Approved - {{amount}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #22C55E; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Expense Approved!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your expense claim has been approved.</p>
          <p style="font-size: 24px; font-weight: bold; color: #22C55E;">{{amount}}</p>
          <p style="color: #333;">Will be credited to your wallet.</p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your expense claim ({{amount}}) has been approved!',
  },

  expense_rejected: {
    subject: 'Expense Claim Rejected - {{amount}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #EF4444; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Expense Rejected</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your expense claim has been rejected.</p>
          <p style="color: #333;">Amount: {{amount}}</p>
          <p style="color: #333;">Reason: {{reason}}</p>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, Your expense claim ({{amount}}) was rejected. Reason: {{reason}}',
  },

  invoice_generated: {
    subject: 'GST Invoice Generated - {{invoiceNumber}}',
    htmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3B82F6; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Invoice Generated</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #333;">Hi {{userName}},</p>
          <p style="color: #333;">Your GST invoice has been generated.</p>
          <p style="font-weight: bold; color: #333;">Invoice Number: {{invoiceNumber}}</p>
          <p style="color: #333;">Amount: {{amount}}</p>
          <a href="{{appUrl}}/invoices/{{invoiceNumber}}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            View Invoice
          </a>
        </div>
      </div>
    `,
    textTemplate: 'Hi {{userName}}, GST Invoice {{invoiceNumber}} generated for {{amount}}',
  },
};

// SMS templates (concise)
const SMS_TEMPLATES: Record<NotificationType, SMSTemplate> = {
  benefit_allocated: { template: 'New benefit: {{benefitType}} - Rs.{{amount}} added to your wallet! Valid till {{validUntil}}.', maxLength: 160 },
  benefit_reset: { template: 'Your {{benefitType}} benefit has been reset. New balance: Rs.{{amount}}', maxLength: 160 },
  benefit_expiring: { template: 'Alert: Rs.{{remainingAmount}} in {{benefitType}} expires on {{expiryDate}}. Use it now!', maxLength: 160 },
  benefit_exhausted: { template: 'Your {{benefitType}} benefit is exhausted for this period. Next reset: {{resetDate}}', maxLength: 160 },
  gift_campaign_invite: { template: 'You\'re invited to {{campaignName}}! Claim your gift: {{claimLink}}', maxLength: 160 },
  gift_delivered: { template: 'Your gift from {{campaignName}} has been delivered! 🎁', maxLength: 160 },
  hotel_booking_confirmed: { template: 'Hotel booked! {{propertyName}}. {{checkIn}} to {{checkOut}}. Ref: {{confirmationNumber}}', maxLength: 160 },
  hotel_booking_cancelled: { template: 'Booking {{confirmationNumber}} cancelled. Refund: {{refundAmount}}', maxLength: 160 },
  karma_earned: { template: '+{{karmaPoints}} Karma earned for {{actionName}}! Total: {{totalKarma}} 💚', maxLength: 160 },
  karma_badge_earned: { template: '🎉 Badge unlocked: {{badgeName}}! Keep making an impact!', maxLength: 160 },
  karma_campaign_join: { template: 'Welcome to {{campaignName}}! Start earning karma today.', maxLength: 160 },
  karma_campaign_complete: { template: '🎊 Campaign complete! You earned +{{bonusKarma}} karma bonus!', maxLength: 160 },
  expense_approved: { template: 'Expense Rs.{{amount}} approved! Will be credited to your wallet.', maxLength: 160 },
  expense_rejected: { template: 'Expense Rs.{{amount}} rejected. Reason: {{reason}}', maxLength: 160 },
  invoice_generated: { template: 'GST Invoice {{invoiceNumber}} generated. Amount: {{amount}}', maxLength: 160 },
};

// Notification Service
export const corpNotificationService = {
  /**
   * Send notification via all configured channels
   */
  async send(payload: NotificationPayload): Promise<{
    email?: { success: boolean; messageId?: string; error?: string };
    sms?: { success: boolean; messageId?: string; error?: string };
    push?: { success: boolean; messageId?: string; error?: string };
  }> {
    const results: any = {};

    logger.info('[CorpNotifications] Sending notification', {
      userId: payload.userId,
      type: payload.type,
      channels: payload.channels,
    });

    // Send email
    if (payload.channels.includes('email') && payload.email) {
      results.email = await sendEmail(payload);
    }

    // Send SMS
    if (payload.channels.includes('sms') && payload.phone) {
      results.sms = await sendSMS(payload);
    }

    // Send push notification
    if (payload.channels.includes('push')) {
      results.push = await sendPush(payload);
    }

    logger.info('[CorpNotifications] Notification sent', {
      userId: payload.userId,
      type: payload.type,
      results,
    });

    return results;
  },

  /**
   * Send bulk notifications
   */
  async sendBulk(payloads: NotificationPayload[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    const results = {
      total: payloads.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    for (const payload of payloads) {
      try {
        await this.send(payload);
        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({ userId: payload.userId, error: error.message });
      }
    }

    logger.info('[CorpNotifications] Bulk send complete', results);

    return results;
  },

  /**
   * Send benefit allocation notification
   */
  async notifyBenefitAllocated(params: {
    userId: string;
    employeeId: string;
    email: string;
    userName: string;
    companyName: string;
    benefitType: string;
    amount: number;
    validUntil: string;
    appUrl: string;
  }): Promise<void> {
    const template = EMAIL_TEMPLATES.benefit_allocated;

    await this.send({
      userId: params.userId,
      employeeId: params.employeeId,
      email: params.email,
      channels: ['email', 'sms'],
      type: 'benefit_allocated',
      title: 'New Benefit Allocated',
      body: `₹${params.amount} ${params.benefitType} benefit added!`,
      data: {
        benefitType: params.benefitType,
        amount: params.amount,
        validUntil: params.validUntil,
      },
    });
  },

  /**
   * Send gift campaign invitation
   */
  async notifyGiftCampaign(params: {
    userId: string;
    employeeId: string;
    email: string;
    phone: string;
    userName: string;
    campaignId: string;
    campaignName: string;
    campaignDescription: string;
    appUrl: string;
  }): Promise<void> {
    await this.send({
      userId: params.userId,
      employeeId: params.employeeId,
      email: params.email,
      phone: params.phone,
      channels: ['email', 'sms', 'push'],
      type: 'gift_campaign_invite',
      title: 'Gift Campaign Invitation',
      body: `You're invited to ${params.campaignName}! Claim your gift now.`,
      data: {
        campaignId: params.campaignId,
        campaignName: params.campaignName,
      },
    });
  },

  /**
   * Send hotel booking confirmation
   */
  async notifyHotelBooking(params: {
    userId: string;
    employeeId: string;
    email: string;
    userName: string;
    propertyName: string;
    checkIn: string;
    checkOut: string;
    confirmationNumber: string;
    amount: number;
    appUrl: string;
  }): Promise<void> {
    await this.send({
      userId: params.userId,
      employeeId: params.employeeId,
      email: params.email,
      channels: ['email', 'sms'],
      type: 'hotel_booking_confirmed',
      title: 'Hotel Booking Confirmed',
      body: `Your booking at ${params.propertyName} is confirmed!`,
      data: {
        propertyName: params.propertyName,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        confirmationNumber: params.confirmationNumber,
      },
    });
  },

  /**
   * Send karma earned notification
   */
  async notifyKarmaEarned(params: {
    userId: string;
    employeeId: string;
    email: string;
    phone: string;
    userName: string;
    karmaPoints: number;
    actionName: string;
    campaignName: string;
    totalKarma: number;
    appUrl: string;
  }): Promise<void> {
    await this.send({
      userId: params.userId,
      employeeId: params.employeeId,
      email: params.email,
      phone: params.phone,
      channels: ['email', 'sms', 'push'],
      type: 'karma_earned',
      title: `+${params.karmaPoints} Karma Earned!`,
      body: `You earned ${params.karmaPoints} karma for ${params.actionName}!`,
      data: {
        karmaPoints: params.karmaPoints,
        actionName: params.actionName,
        campaignName: params.campaignName,
        totalKarma: params.totalKarma,
      },
    });
  },

  /**
   * Send badge earned notification
   */
  async notifyBadgeEarned(params: {
    userId: string;
    employeeId: string;
    email: string;
    userName: string;
    badgeName: string;
    badgeDescription: string;
    appUrl: string;
  }): Promise<void> {
    await this.send({
      userId: params.userId,
      employeeId: params.employeeId,
      email: params.email,
      channels: ['email', 'push'],
      type: 'karma_badge_earned',
      title: `Badge Unlocked: ${params.badgeName}!`,
      body: `You earned the ${params.badgeName} badge!`,
      data: {
        badgeName: params.badgeName,
        badgeDescription: params.badgeDescription,
      },
    });
  },
};

// Helper functions
async function sendEmail(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // In production, integrate with email service (SendGrid, SES, etc.)
    const template = EMAIL_TEMPLATES[payload.type];

    // Replace placeholders
    let htmlBody = template.htmlTemplate;
    let textBody = template.textTemplate;

    if (payload.data) {
      for (const [key, value] of Object.entries(payload.data)) {
        htmlBody = htmlBody.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        textBody = textBody.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    const subject = template.subject
      .replace('{{companyName}}', 'CorpPerks')
      .replace('{{userName}}', 'User');

    logger.info('[CorpNotifications] Email sent', {
      to: payload.email,
      subject,
      type: payload.type,
    });

    return { success: true, messageId: `email_${Date.now()}` };
  } catch (error: any) {
    logger.error('[CorpNotifications] Email failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

async function sendSMS(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const template = SMS_TEMPLATES[payload.type];

    let message = template.template;
    if (payload.data) {
      for (const [key, value] of Object.entries(payload.data)) {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    // In production, integrate with SMS service (MSG91, Twilio, etc.)
    logger.info('[CorpNotifications] SMS sent', {
      to: payload.phone,
      message: message.substring(0, 50) + '...',
      type: payload.type,
    });

    return { success: true, messageId: `sms_${Date.now()}` };
  } catch (error: any) {
    logger.error('[CorpNotifications] SMS failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

async function sendPush(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // In production, integrate with push service (Firebase, OneSignal, etc.)
    logger.info('[CorpNotifications] Push sent', {
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
    });

    return { success: true, messageId: `push_${Date.now()}` };
  } catch (error: any) {
    logger.error('[CorpNotifications] Push failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

export default corpNotificationService;

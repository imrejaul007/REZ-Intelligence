import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from '../utils/logger';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4006';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface EmailTemplate {
  to: string;
  template: string;
  data: Record<string, any>;
}

export interface Attachment {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@rez.in';
  }

  async send(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const info = await this.transporter.sendMail({
        from: message.from || this.fromEmail,
        to: message.to,
        subject: message.subject,
        html: message.body,
        text: this.stripHtml(message.body)
      });

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: message.to,
        subject: message.subject
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error.message,
        to: message.to
      });

      // Try SendGrid as fallback
      return this.sendWithSendGrid(message);
    }
  }

  async sendTemplate(template: EmailTemplate): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const templates = emailTemplates;
    const tmpl = templates[template.template];

    if (!tmpl) {
      return { success: false, error: `Template ${template.template} not found` };
    }

    const subject = this.interpolate(tmpl.subject, template.data);
    const body = this.interpolate(tmpl.body, template.data);

    return this.send({
      to: template.to,
      subject,
      body
    });
  }

  async sendWithAttachment(message: EmailMessage & { attachments: Attachment[] }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const info = await this.transporter.sendMail({
        from: message.from || this.fromEmail,
        to: message.to,
        subject: message.subject,
        html: message.body,
        text: this.stripHtml(message.body),
        attachments: message.attachments.map(a => ({
          filename: a.filename,
          path: a.path,
          content: a.content,
          contentType: a.contentType
        }))
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.error('Failed to send email with attachment', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  private async sendWithSendGrid(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (!sendgridKey) {
      return { success: false, error: 'No fallback email service configured' };
    }

    try {
      await axios.post('https://api.sendgrid.com/v3/mail/send', {
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: this.fromEmail },
        subject: message.subject,
        content: [{ type: 'text/html', value: message.body }]
      }, {
        headers: {
          'Authorization': `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, messageId: 'sendgrid' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  private interpolate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
  }

  async sendToOrchestrator(from: string, subject: string, body: string): Promise<void> {
    try {
      await axios.post(`${ORCHESTRATOR_URL}/api/v2/message/process`, {
        channel: 'EMAIL',
        message: body,
        userId: from,
        metadata: {
          emailSubject: subject,
          timestamp: new Date().toISOString()
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_TOKEN || 'orchestrator-token'
        },
        timeout: 30000
      });
    } catch (error: any) {
      logger.error('Failed to send to orchestrator', { error: error.message });
    }
  }
}

const emailTemplates: Record<string, { subject: string; body: string }> = {
  welcome: {
    subject: 'Welcome to REZ!',
    body: '<h1>Welcome {{name}}!</h1><p>Thanks for joining REZ. Start exploring our services.</p>'
  },
  order_confirmation: {
    subject: 'Order Confirmed - {{orderId}}',
    body: '<h1>Order Confirmed!</h1><p>Your order {{orderId}} has been placed.</p><p>Total: ₹{{total}}</p>'
  },
  payment_success: {
    subject: 'Payment Successful',
    body: '<h1>Payment Received!</h1><p>Your payment of ₹{{amount}} has been received.</p>'
  },
  support_ticket: {
    subject: 'Support Ticket #{{ticketId}}',
    body: '<h1>Ticket Created</h1><p>We received your request. Our team will respond within 24 hours.</p>'
  }
};

export const emailService = new EmailService();

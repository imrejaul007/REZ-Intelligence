/**
 * EMAIL SERVICE INTEGRATION
 *
 * Supports SendGrid, AWS SES, SMTP
 */

import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

// ============================================
// CONFIG
// ============================================

interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp';
  apiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  from: {
    email: string;
    name: string;
  };
}

const config: EmailConfig = {
  provider: (process.env.EMAIL_PROVIDER as any) || 'sendgrid',
  apiKey: process.env.SENDGRID_API_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
  from: {
    email: process.env.EMAIL_FROM || 'noreply@rez.com',
    name: process.env.EMAIL_FROM_NAME || 'ReZ',
  },
};

// ============================================
// TRANSPORTER
// ============================================

let transporter: nodemailer.Transporter;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (config.provider === 'smtp' && config.smtp) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  } else {
    // Use SendGrid SMTP
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: config.apiKey,
      },
    });
  }

  return transporter;
}

// ============================================
// SEND EMAIL
// ============================================

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[];
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const t = await getTransporter();

    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    const cc = params.cc ? (Array.isArray(params.cc) ? params.cc.join(', ') : params.cc) : undefined;
    const bcc = params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc) : undefined;

    const info = await t.sendMail({
      from: `"${config.from.name}" <${config.from.email}>`,
      to,
      cc,
      bcc,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    });

    return { success: true, messageId: info.messageId };

  } catch (error: any) {
    console.error('[Email] Send error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// SENDGRID API
// ============================================

export async function sendViaSendGrid(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: config.from.email, name: config.from.name },
        subject: params.subject,
        content: [
          { type: 'text/plain', value: params.text || '' },
          { type: 'text/html', value: params.html },
        ],
      }),
    });

    return { success: response.ok };
  } catch (error) {
    return { success: false };
  }
}

// ============================================
// TEMPLATES
// ============================================

export async function sendTemplate(
  to: string,
  templateId: string,
  dynamicData: Record<string, any>
): Promise<{ success: boolean }> {
  const html = await getTemplateHtml(templateId, dynamicData);
  const subject = dynamicData.subject || 'Message from ReZ';

  return sendEmail({ to, subject, html }).then(r => ({ success: r.success }));
}

async function getTemplateHtml(templateId: string, data: Record<string, any>): Promise<string> {
  // Load template from database or file
  const templates: Record<string, string> = {
    'welcome': `
      <h1>Welcome to ReZ!</h1>
      <p>Hi ${data.name || 'there'},</p>
      <p>Thank you for joining us. Start exploring!</p>
    `,
    'offer': `
      <h1>Special Offer Just For You!</h1>
      <p>Hi ${data.name || 'there'},</p>
      <p>${data.offerText || 'Check out our latest deals!'}</p>
      <p>Use code: <strong>${data.code || 'REZOFF'}</strong></p>
    `,
    'receipt': `
      <h1>Order Confirmed!</h1>
      <p>Order #${data.orderId}</p>
      <p>Total: ₹${data.amount}</p>
      <p>Thank you for ordering with ReZ!</p>
    `,
  };

  return templates[templateId] || '<p>Hello!</p>';
}

// ============================================
// BULK EMAIL
// ============================================

export async function sendBulkEmail(
  recipients: { email: string; name?: string; data?: Record<string, any> }[],
  subject: string,
  templateId: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const html = await getTemplateHtml(templateId, { ...recipient.data, name: recipient.name });
    const result = await sendEmail({ to: recipient.email, subject, html });
    if (result.success) success++;
    else failed++;
  }

  return { success, failed };
}

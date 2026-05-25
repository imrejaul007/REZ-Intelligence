/**
 * REZ Care - Email Routes
 *
 * Handles incoming support emails:
 * - Webhook for email providers (SendGrid, SES, etc.)
 * - SMTP polling endpoint
 * - Manual email submission
 */

import express, { Request, Response } from 'express';
import { emailIntegration, EmailMessage } from '../services/emailIntegration';
import { logger } from '../utils/logger';

const router = express.Router();

// ============================================
// EMAIL WEBHOOKS
// ============================================

/**
 * SendGrid Inbound Parse Webhook
 * POST /api/email/webhook/sendgrid
 */
router.post('/webhook/sendgrid', async (req: Request, res: Response) => {
  try {
    // SendGrid sends form data
    const { from, to, subject, text, html, attachments } = req.body;

    const email: EmailMessage = {
      from: from || req.body.from,
      to: to || req.body.to,
      subject: subject || req.body.subject,
      body: text || req.body.text,
      html: html || req.body.html,
      attachments: attachments ? JSON.parse(attachments) : undefined,
      date: req.body.date || new Date().toISOString(),
      messageId: req.body.headers?.['Message-ID'] || `sg-${Date.now()}`,
      inReplyTo: req.body.headers?.['In-Reply-To'],
    };

    // Process email asynchronously
    emailIntegration.processEmailPipeline(email).catch(err => {
      logger.error('[Email] Webhook processing failed', err);
    });

    // Respond quickly to SendGrid
    res.status(200).send('OK');
  } catch (error) {
    logger.error('[Email] SendGrid webhook error', error);
    res.status(500).send('Error');
  }
});

/**
 * AWS SES Webhook
 * POST /api/email/webhook/ses
 */
router.post('/webhook/ses', async (req: Request, res: Response) => {
  try {
    const { Message } = req.body;
    if (!Message) {
      res.status(400).json({ error: 'No message' });
      return;
    }

    const sesNotification = JSON.parse(Message);

    if (sesNotification.Type === 'Notification') {
      const mail = sesNotification.Message;
      const email: EmailMessage = {
        from: mail.mail.source,
        to: mail.mail.destination.join(','),
        subject: mail.mail.commonHeaders?.subject || '',
        body: mail.content || '',
        date: mail.mail.timestamp,
        messageId: mail.mail.messageId,
        inReplyTo: mail.mail.headers?.find((h) => h.name === 'In-Reply-To')?.value,
      };

      emailIntegration.processEmailPipeline(email).catch(err => {
        logger.error('[Email] SES processing failed', err);
      });
    }

    res.status(200).json({ status: 'OK' });
  } catch (error) {
    logger.error('[Email] SES webhook error', error);
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * Mailgun Webhook
 * POST /api/email/webhook/mailgun
 */
router.post('/webhook/mailgun', async (req: Request, res: Response) => {
  try {
    const { from, subject, 'body-plain': bodyPlain, 'message-id': messageId, 'In-Reply-To': inReplyTo } = req.body;

    const email: EmailMessage = {
      from,
      to: req.body.to,
      subject,
      body: bodyPlain || '',
      date: new Date().toISOString(),
      messageId,
      inReplyTo,
    };

    emailIntegration.processEmailPipeline(email).catch(err => {
      logger.error('[Email] Mailgun processing failed', err);
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error('[Email] Mailgun webhook error', error);
    res.status(500).send('Error');
  }
});

/**
 * Postmark Inbound Webhook
 * POST /api/email/webhook/postmark
 */
router.post('/webhook/postmark', async (req: Request, res: Response) => {
  try {
    const { From, To, Subject, TextBody, HtmlBody, Attachments, MessageID, InReplyTo } = req.body;

    const email: EmailMessage = {
      from: From,
      to: Array.isArray(To) ? To.join(',') : To,
      subject: Subject,
      body: TextBody,
      html: HtmlBody,
      attachments: Attachments?.map((a) => a.Name),
      date: new Date().toISOString(),
      messageId: MessageID,
      inReplyTo: InReplyTo,
    };

    emailIntegration.processEmailPipeline(email).catch(err => {
      logger.error('[Email] Postmark processing failed', err);
    });

    res.status(200).json({ status: 'received' });
  } catch (error) {
    logger.error('[Email] Postmark webhook error', error);
    res.status(500).json({ error: 'Error' });
  }
});

// ============================================
// MANUAL EMAIL SUBMISSION
// ============================================

/**
 * Submit email manually
 * POST /api/email/submit
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const email: EmailMessage = {
      from: req.body.from,
      to: req.body.to,
      subject: req.body.subject,
      body: req.body.body,
      html: req.body.html,
      attachments: req.body.attachments,
      date: req.body.date || new Date().toISOString(),
      messageId: req.body.messageId || `manual-${Date.now()}`,
      inReplyTo: req.body.inReplyTo,
    };

    const result = await emailIntegration.processEmailPipeline(email);

    res.json({
      success: true,
      ticketId: result.ticketId,
      response: result.response,
      parsed: result.parsed,
    });
  } catch (error) {
    logger.error('[Email] Manual submission failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMAIL PREVIEW
// ============================================

/**
 * Preview parsed email (for testing)
 * POST /api/email/preview
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const email: EmailMessage = {
      from: req.body.from,
      to: req.body.to,
      subject: req.body.subject,
      body: req.body.body,
      date: new Date().toISOString(),
      messageId: `preview-${Date.now()}`,
    };

    const parsed = await emailIntegration.processEmail(email);
    const response = await emailIntegration.generateAutoResponse(parsed);

    res.json({
      success: true,
      parsed,
      suggestedResponse: response,
    });
  } catch (error) {
    logger.error('[Email] Preview failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Get email templates
 * GET /api/email/templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'greeting',
        name: 'Initial Greeting',
        subject: 'Re: {{subject}}',
        body: 'Hi {{name}},\n\nThank you for contacting ReZ Support.\n\nWe have received your message and will respond within 24 hours.\n\nTicket ID: {{ticketId}}\n\nBest regards,\nReZ Support Team',
      },
      {
        id: 'urgent',
        name: 'Urgent Response',
        subject: 'URGENT: Re: {{subject}}',
        body: 'Hi {{name}},\n\nYour message has been marked as urgent.\n\nOur team will respond within 2 hours.\n\nTicket ID: {{ticketId}}\n\nBest regards,\nReZ Support Team',
      },
      {
        id: 'resolved',
        name: 'Issue Resolved',
        subject: 'Resolved: {{subject}}',
        body: 'Hi {{name}},\n\nYour support ticket has been resolved.\n\nIf you have unknown further questions, please don\'t hesitate to reach out.\n\nTicket ID: {{ticketId}}\n\nBest regards,\nReZ Support Team',
      },
      {
        id: 'followup',
        name: 'Follow-up',
        subject: 'Re: {{subject}}',
        body: 'Hi {{name}},\n\nWe wanted to follow up on your support ticket.\n\nIs your issue resolved? Please reply if you need further assistance.\n\nTicket ID: {{ticketId}}\n\nBest regards,\nReZ Support Team',
      },
    ],
  });
});

/**
 * Generate email from template
 * POST /api/email/generate
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { templateId, variables } = req.body;

    const templates: Record<string, { subject: string; body: string }> = {
      greeting: {
        subject: 'Re: {{subject}}',
        body: 'Hi {{name}},\n\nThank you for contacting ReZ Support.\n\nWe have received your message and will respond within 24 hours.\n\nTicket ID: {{ticketId}}\n\nBest regards,\nReZ Support Team',
      },
      urgent: {
        subject: 'URGENT: Re: {{subject}}',
        body: 'Hi {{name}},\n\nYour message has been marked as urgent.\n\nOur team will respond within 2 hours.\n\nTicket ID: {{ticketId}}\n\nBest regards,\nReZ Support Team',
      },
      resolved: {
        subject: 'Resolved: {{subject}}',
        body: 'Hi {{name}},\n\nYour support ticket has been resolved.\n\nIf you have unknown further questions, please don\'t hesitate to reach out.\n\nTicket ID: {{ticketId}}\n\nBest regards,\nReZ Support Team',
      },
    };

    const template = templates[templateId];
    if (!template) {
      res.status(400).json({ error: 'Template not found' });
      return;
    }

    // Replace variables
    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(variables || {})) {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    res.json({
      success: true,
      subject,
      body,
    });
  } catch (error) {
    logger.error('[Email] Template generation failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

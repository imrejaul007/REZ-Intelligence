import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { emailService } from '../services/emailService';
import { commandParser } from '../services/commandParser';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  from: z.string().email().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string().optional(),
    contentType: z.string().optional()
  })).optional()
});

const sendTemplateSchema = z.object({
  to: z.string().email(),
  template: z.enum(['welcome', 'order_confirmation', 'payment_success', 'support_ticket']),
  data: z.record(z.unknown())
});

// POST /api/email/send - Send email
router.post('/email/send', async (req: Request, res: Response) => {
  try {
    const validation = sendEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const result = await emailService.send(validation.data);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Send email error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/email/send-template - Send templated email
router.post('/email/send-template', async (req: Request, res: Response) => {
  try {
    const validation = sendTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const result = await emailService.sendTemplate(validation.data);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Send template error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/email/send-with-attachment - Send email with attachments
router.post('/email/send-attachment', async (req: Request, res: Response) => {
  try {
    const validation = sendEmailSchema.extend({
      attachments: z.array(z.object({
        filename: z.string(),
        path: z.string().optional(),
        contentType: z.string().optional()
      }))
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed'
      });
    }

    const result = await emailService.sendWithAttachment(validation.data);

    res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    logger.error('Send attachment error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/email/inbound - Receive inbound email (webhook)
router.post('/email/inbound', async (req: Request, res: Response) => {
  try {
    const { from, subject, body, attachments } = req.body;

    if (!from || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from, subject'
      });
    }

    logger.info('Received inbound email', { from, subject });

    // Parse command from email
    const command = commandParser.parse(subject, body);

    if (command) {
      // Route to orchestrator
      logger.info('Email command detected', { command: command.command });
      await emailService.sendToOrchestrator(from, subject, body);
    }

    // Auto-reply with acknowledgment
    await emailService.send({
      to: from,
      subject: 'RE: ' + subject,
      body: `
        <h2>Thank you for your email!</h2>
        <p>We have received your message and will respond shortly.</p>
        <p>For immediate assistance, try:</p>
        <ul>
          <li>WhatsApp: Send a message</li>
          <li>REZ App: Chat with our AI</li>
        </ul>
      `
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Inbound email error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/email/templates - List available templates
router.get('/email/templates', (req: Request, res: Response) => {
  res.json({
    templates: [
      { name: 'welcome', description: 'Welcome email for new users' },
      { name: 'order_confirmation', description: 'Order confirmation email' },
      { name: 'payment_success', description: 'Payment received email' },
      { name: 'support_ticket', description: 'Support ticket acknowledgment' }
    ]
  });
});

export { router as emailRoutes };

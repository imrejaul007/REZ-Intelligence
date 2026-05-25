import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { webhookService } from '../services/webhookService';
import { smsService } from '../services/smsService';
import { internalAuth } from '../middleware/auth';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

const router = Router();

// Validation schemas
const sendSmsSchema = z.object({
  to: z.string().min(10, 'Phone number must be at least 10 characters'),
  message: z.string().min(1, 'Message cannot be empty').max(1600, 'Message exceeds 1600 character limit'),
});

const sendTemplateSchema = z.object({
  to: z.string().min(10, 'Phone number must be at least 10 characters'),
  template: z.enum(['order_confirmed', 'order_placed', 'help_response', 'status_update', 'verification']),
  data: z.record(z.unknown()),
});

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-sms-bridge',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /webhook/sms
 * Twilio webhook endpoint for incoming SMS
 */
router.post('/webhook/sms', async (req: Request, res: Response) => {
  try {
    await webhookService.handleIncomingSMS(req, res);
  } catch (error) {
    logger.error('Webhook handler error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sms/send
 * Send a plain SMS message
 * Requires internal service authentication
 */
router.post('/api/sms/send', internalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = sendSmsSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.format(),
      });
      return;
    }

    const { to, message } = validation.data;

    await smsService.send(to, message);

    logger.info('SMS sent successfully', { to, messageLength: message.length });

    res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      to,
    });
  } catch (error) {
    logger.error('Failed to send SMS', { error });
    next(error);
  }
});

/**
 * POST /api/sms/send-template
 * Send a templated SMS message
 * Requires internal service authentication
 */
router.post('/api/sms/send-template', internalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = sendTemplateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.format(),
      });
      return;
    }

    const { to, template, data } = validation.data;

    await smsService.sendTemplate(to, template, data);

    logger.info('Template SMS sent successfully', { to, template });

    res.status(200).json({
      success: true,
      message: 'Template SMS sent successfully',
      to,
      template,
    });
  } catch (error) {
    logger.error('Failed to send template SMS', { error });
    next(error);
  }
});

/**
 * POST /api/sms/send-bulk
 * Send SMS to multiple recipients
 * Requires internal service authentication
 */
router.post('/api/sms/send-bulk', internalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bulkSchema = z.object({
      recipients: z.array(
        z.object({
          to: z.string().min(10),
          message: z.string().min(1).max(1600),
        })
      ).min(1).max(100),
    });

    const validation = bulkSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.format(),
      });
      return;
    }

    const { recipients } = validation.data;
    const results: { to: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        await smsService.send(recipient.to, recipient.message);
        results.push({ to: recipient.to, success: true });
      } catch (error) {
        results.push({
          to: recipient.to,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info('Bulk SMS completed', { total: recipients.length, successCount, failureCount });

    res.status(200).json({
      success: true,
      total: recipients.length,
      successful: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    logger.error('Failed to send bulk SMS', { error });
    next(error);
  }
});

export default router;

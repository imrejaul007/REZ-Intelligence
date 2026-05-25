import { Router, Request, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { orchestratorService } from '../services/orchestratorService';

const router = Router();

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4006';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'core-brain-token-123';

// Common message schema
const messageSchema = z.object({
  message: z.string().min(1),
  userId: z.string().min(1),
  channel: z.string(),
  metadata: z.record(z.unknown()).optional()
});

// WhatsApp webhook
router.post('/whatsapp/webhook', async (req: Request, res: Response) => {
  try {
    const { entry } = req.body;

    if (!entry || !entry[0]?.changes) {
      return res.status(200).json({ status: 'ok' });
    }

    const changes = entry[0].changes;
    for (const change of changes) {
      if (change.value?.messages) {
        for (const msg of change.value.messages) {
          const phone = msg.from;
          const text = msg.text?.body || '';

          logger.info('WhatsApp message received', { phone, text });

          // Route to orchestrator
          const response = await orchestratorService.routeMessage({
            message: text,
            userId: phone,
            channel: 'WHATSAPP',
            metadata: { waId: phone }
          });

          // Queue response back to WhatsApp
          if (response) {
            await orchestratorService.queueResponse(phone, response);
          }
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('WhatsApp webhook error', { error: error.message });
    res.status(200).json({ status: 'ok' }); // Always return 200 to WhatsApp
  }
});

// Instagram webhook
router.post('/instagram/webhook', async (req: Request, res: Response) => {
  try {
    const { entry } = req.body;

    if (!entry) {
      return res.status(200).json({ status: 'ok' });
    }

    for (const e of entry) {
      if (e.messaging) {
        for (const msg of e.messaging) {
          const sender = msg.sender?.id;
          const text = msg.message?.text || '';

          logger.info('Instagram message received', { sender, text });

          const response = await orchestratorService.routeMessage({
            message: text,
            userId: sender,
            channel: 'INSTAGRAM',
            metadata: { igId: sender }
          });

          if (response) {
            await orchestratorService.queueResponse(sender, response);
          }
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Instagram webhook error', { error: error.message });
    res.status(200).json({ status: 'ok' });
  }
});

// SMS webhook (from Twilio)
router.post('/sms/webhook', async (req: Request, res: Response) => {
  try {
    const { From, Body } = req.body;

    if (!From || !Body) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    logger.info('SMS received', { from: From, body: Body });

    const response = await orchestratorService.routeMessage({
      message: Body,
      userId: From,
      channel: 'SMS',
      metadata: { phone: From }
    });

    // Send SMS response
    if (response) {
      res.json({
        body: response
      });
    } else {
      res.json({ body: 'Thank you for your message. We will respond shortly.' });
    }
  } catch (error) {
    logger.error('SMS webhook error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Email webhook
router.post('/email/inbound', async (req: Request, res: Response) => {
  try {
    const { from, subject, body } = req.body;

    logger.info('Email received', { from, subject });

    const response = await orchestratorService.routeMessage({
      message: `${subject}\n\n${body}`,
      userId: from,
      channel: 'EMAIL',
      metadata: { email: from }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Email inbound error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// RCS webhook
router.post('/rcs/webhook', async (req: Request, res: Response) => {
  try {
    const { from, content } = req.body;

    logger.info('RCS received', { from, content });

    const response = await orchestratorService.routeMessage({
      message: content,
      userId: from,
      channel: 'RCS',
      metadata: { phone: from }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('RCS webhook error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Voice webhook
router.post('/voice/webhook', async (req: Request, res: Response) => {
  try {
    const { callSid, from, transcript } = req.body;

    logger.info('Voice call received', { callSid, from });

    const response = await orchestratorService.routeMessage({
      message: transcript,
      userId: from,
      channel: 'VOICE',
      metadata: { callSid, from }
    });

    res.json({
      response: response || 'Thank you for calling REZ. An agent will respond shortly.'
    });
  } catch (error) {
    logger.error('Voice webhook error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Web widget webhook
router.post('/web/message', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, userId } = req.body;

    logger.info('Web message received', { sessionId, message });

    const response = await orchestratorService.routeMessage({
      message,
      userId: userId || sessionId,
      channel: 'WEB',
      metadata: { sessionId }
    });

    res.json({
      success: true,
      response,
      sessionId
    });
  } catch (error) {
    logger.error('Web message error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// App webhook
router.post('/app/message', async (req: Request, res: Response) => {
  try {
    const { userId, message, deviceToken } = req.body;

    logger.info('App message received', { userId, message });

    const response = await orchestratorService.routeMessage({
      message,
      userId,
      channel: 'APP',
      metadata: { deviceToken }
    });

    res.json({
      success: true,
      response
    });
  } catch (error) {
    logger.error('App message error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get queued response
router.get('/response/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const response = await orchestratorService.getResponse(userId);

    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as channelRoutes };

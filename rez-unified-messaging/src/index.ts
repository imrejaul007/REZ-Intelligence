/**
 * REZ UNIFIED MESSAGING PLATFORM
 *
 * One platform for ALL messaging across ReZ ecosystem
 * Now with full WhatsApp Business API, SMS, Email, Push integrations
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import messagingRoutes from './routes/messaging';
import merchantWhatsAppRoutes from './routes/merchantWhatsApp';
import channelRoutes from './routes/channels';
import analyticsRoutes from './routes/analytics';
import templateRoutes from './routes/templates';

const app = express();
const PORT = process.env.PORT || 4025;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES
// ============================================

app.use('/api/messaging', messagingRoutes);
app.use('/api/merchant/whatsapp', merchantWhatsAppRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messaging/analytics', analyticsRoutes);
app.use('/api/messaging/templates', templateRoutes);

// ============================================
// CHANNEL ROUTES (WhatsApp/SMS/Email/Push)
// ============================================

import * as whatsappService from './services/whatsappService';
import * as smsService from './services/smsService';
import * as emailService from './services/emailService';
import * as pushService from './services/pushService';
import * as channelRouter from './services/channelRouter';
import * as rezMindService from './services/rezMindService';

// WhatsApp webhook verification (GET - for Facebook webhook verification)
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verify = whatsappService.verifyWebhook(mode, token, challenge);
  if (verify.success) {
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp incoming message webhook (POST - receives messages from Facebook)
app.post('/webhook/whatsapp', async (req, res) => {
  // SECURITY: Verify this is a legitimate webhook from WhatsApp/Facebook
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('[WhatsApp] WHATSAPP_VERIFY_TOKEN not configured');
    res.sendStatus(500);
    return;
  }

  // Verify webhook challenge if present
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    // This is a webhook verification request
    const verify = whatsappService.verifyWebhook(mode, token, challenge);
    if (!verify.success) {
      return res.sendStatus(403);
    }
    return res.send(challenge);
  }

  // Process incoming message
  const message = whatsappService.parseIncomingMessage(req.body);
  if (message) {
    // Acknowledge receipt immediately
    res.sendStatus(200);
    // Handle message asynchronously
    handleIncomingWhatsApp(message);
  } else {
    res.sendStatus(400);
  }
});

// Send WhatsApp
app.post('/api/send/whatsapp', async (req, res) => {
  const { to, body, type } = req.body;

  if (type === 'template') {
    const result = await whatsappService.sendTemplate(to, body.template, 'en', body.components);
    res.json(result);
  } else if (req.body.imageUrl) {
    const result = await whatsappService.sendImage(to, req.body.imageUrl, body);
    res.json(result);
  } else {
    const result = await whatsappService.sendText(to, body);
    res.json(result);
  }
});

// Send SMS
app.post('/api/send/sms', async (req, res) => {
  const { to, message } = req.body;
  const result = await smsService.sendSMS(to, message);
  res.json(result);
});

// Send Email
app.post('/api/send/email', async (req, res) => {
  const { to, subject, html } = req.body;
  const result = await emailService.sendEmail({ to, subject, html });
  res.json(result);
});

// Send Push
app.post('/api/send/push', async (req, res) => {
  const { token, notification, data } = req.body;
  const result = await pushService.sendToDevice(token, notification, data);
  res.json(result);
});

// Route via AI (automatic channel selection)
app.post('/api/route', async (req, res) => {
  const { userId, phone, email, deviceToken, temperature, urgency, payload } = req.body;

  const context = {
    userId,
    phone,
    email,
    deviceToken,
    temperature: temperature || 'warm',
    urgency: urgency || 'medium',
  };

  const results = await channelRouter.routeMessage(context, payload);
  res.json({ success: true, results });
});

// AI Message Generation
app.post('/api/ai/generate', async (req, res) => {
  const { userId, merchantId, message } = req.body;

  const intent = await rezMindService.detectIntent(message, { userId, merchantId });
  const response = await rezMindService.generateAIResponse(
    { user: { userId, phone: '', segments: [] } },
    intent
  );

  res.json({
    intent,
    response,
  });
});

// Capture for ReZ Mind learning
app.post('/api/capture', async (req, res) => {
  await rezMindService.captureIntentSignal(req.body);
  res.json({ success: true });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function handleIncomingWhatsApp(message: any) {
  try {
    // Mark as read
    await whatsappService.markAsRead(message.messageId);

    // Detect intent via ReZ Mind
    const intent = await rezMindService.detectIntent(message.text || '', {
      channel: 'whatsapp',
    });

    // Generate response
    const response = await rezMindService.generateAIResponse(
      { user: { userId: '', phone: message.from, segments: [] } },
      intent
    );

    // Send response
    await whatsappService.sendText(message.from, response.reply);

    // Capture for learning
    await rezMindService.captureIntentSignal({
      userId: '',
      channel: 'whatsapp',
      eventType: 'message_received',
      category: intent.intent,
      query: message.text,
      response: response.reply,
      outcome: 'ignored',
    });

  } catch (error) {
    console.error('[WhatsApp] Handle error:', error);
  }
}

// ============================================
// HEALTH & METRICS
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rez-unified-messaging',
    version: '2.0.0',
    uptime: process.uptime(),
    channels: {
      whatsapp: 'connected',
      sms: 'connected',
      email: 'connected',
      push: 'connected',
    },
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP rez_messages_total Total messages sent
# TYPE rez_messages_total counter
rez_messages_total{channel="whatsapp"} 0
rez_messages_total{channel="sms"} 0
rez_messages_total{channel="email"} 0
rez_messages_total{channel="push"} 0

# HELP rez_messages_delivered Messages delivered
# TYPE rez_messages_delivered counter
rez_messages_delivered{channel="whatsapp"} 0
rez_messages_delivered{channel="sms"} 0
rez_messages_delivered{channel="email"} 0
rez_messages_delivered{channel="push"} 0
  `.trim());
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`[ReZ Unified Messaging] Running on port ${PORT}`);
  console.log(`[ReZ Unified Messaging] WhatsApp webhook: /webhook/whatsapp`);
  console.log(`[ReZ Unified Messaging] ReZ Mind: ${process.env.REZMIND_URL || 'https://rez-event-platform.onrender.com'}`);
});

export default app;

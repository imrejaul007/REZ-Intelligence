'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = {
  info: (msg, data) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', msg, ...data }))
};

// MongoDB Schema
const notificationSchema = new mongoose.Schema({
  notificationId: { type: String, required: true, unique: true, index: true },
  userId: String,
  type: { type: String, enum: ['reorder_nudge', 'offer', 'alert', 'reminder', 'marketing'], required: true },

  channels: [{
    channel: { type: String, enum: ['push', 'sms', 'email', 'in_app'] },
    status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed'] },
    externalId: String,
    sentAt: Date,
    deliveredAt: Date,
    error: String
  }],

  content: {
    title: String,
    body: String,
    data: mongoose.Schema.Types.Mixed
  },

  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ 'channels.channel': 1, 'channels.status': 1 });

const Notification = mongoose.model('Notification', notificationSchema);

// Express app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();
  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-router', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ error: 'Not ready' });
  }
});

// Send notification
app.post('/api/notify', async (req, res) => {
  try {
    const { userId, type, channels = ['push'], content, data } = req.body;

    const notificationId = `notif_${uuidv4()}`;
    const notification = await Notification.create({
      notificationId,
      userId,
      type,
      content,
      channels: channels.map(c => ({
        channel: c,
        status: 'queued'
      }))
    });

    // Send to each channel asynchronously
    const results = [];
    for (const channelInfo of notification.channels) {
      const result = await sendToChannel(channelInfo.channel, {
        userId,
        title: content.title,
        body: content.body,
        data
      });

      channelInfo.status = result.status;
      channelInfo.externalId = result.externalId;
      channelInfo.sentAt = new Date();
      if (result.error) channelInfo.error = result.error;

      results.push({
        channel: channelInfo.channel,
        status: result.status,
        id: result.externalId
      });
    }

    notification.channels = notification.channels.map(c => ({
      ...c.toObject(),
      sentAt: new Date()
    }));
    await notification.save();

    // Send feedback to feedback collector
    await sendFeedback('nudge_sent', notificationId, userId, type, data);

    logger.info('Notification sent', { notificationId, userId, channels: results.map(r => r.channel) });

    res.json({
      success: true,
      notificationId,
      notifications: results
    });
  } catch (err) {
    logger.error('Notify failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Get notification status
app.get('/api/notify/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findOne({ notificationId });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user notifications
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, unreadOnly } = req.query;

    const query = { userId };
    if (unreadOnly === 'true') {
      query['channels.status'] = { $ne: 'delivered' };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Track notification click
app.post('/api/notify/:notificationId/click', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findOne({ notificationId });

    if (notification) {
      // Update channel status
      for (const channel of notification.channels) {
        if (channel.status === 'sent') {
          channel.deliveredAt = new Date();
          channel.status = 'delivered';
        }
      }
      await notification.save();

      // Send feedback
      await sendFeedback('nudge_clicked', notificationId, notification.userId, notification.type, notification.content.data);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Send to channel
async function sendToChannel(channel, payload) {
  try {
    switch (channel) {
      case 'push':
        return await sendPush(payload);
      case 'sms':
        return await sendSMS(payload);
      case 'email':
        return await sendEmail(payload);
      case 'in_app':
        return { status: 'delivered', externalId: 'in_app_' + Date.now() };
      default:
        return { status: 'failed', error: 'Unknown channel' };
    }
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

// Push notification (FCM placeholder)
async function sendPush(payload) {
  const fcmUrl = process.env.FCM_URL;

  if (!fcmUrl) {
    logger.warn('FCM not configured, simulating push');
    return { status: 'sent', externalId: 'fcm_sim_' + Date.now() };
  }

  try {
    // In production, call FCM
    const response = await axios.post(fcmUrl, {
      to: payload.data?.fcmToken,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: payload.data
    });

    return { status: 'sent', externalId: response.data.success?.[0]?.message_id };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

// SMS (Twilio placeholder)
async function sendSMS(payload) {
  const twilioUrl = process.env.TWILIO_URL;

  if (!twilioUrl) {
    logger.warn('Twilio not configured, simulating SMS');
    return { status: 'sent', externalId: 'sms_sim_' + Date.now() };
  }

  try {
    // In production, call Twilio
    return { status: 'sent', externalId: 'twilio_' + Date.now() };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

// Email placeholder
async function sendEmail(payload) {
  const sendgridUrl = process.env.SENDGRID_URL;

  if (!sendgridUrl) {
    logger.warn('SendGrid not configured, simulating email');
    return { status: 'sent', externalId: 'email_sim_' + Date.now() };
  }

  try {
    return { status: 'sent', externalId: 'sendgrid_' + Date.now() };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

// Send feedback to feedback collector
async function sendFeedback(event, notificationId, userId, type, data) {
  const feedbackUrl = process.env.FEEDBACK_URL || 'http://localhost:4085';

  try {
    await axios.post(`${feedbackUrl}/api/feedback/nudge`, {
      nudgeId: notificationId,
      userId,
      appId: 'notification-router',
      event,
      metadata: { type, data }
    }, { timeout: 2000 });
  } catch (err) {
    logger.warn('Feedback send failed', { error: err.message });
  }
}

const PORT = process.env.PORT || 4093;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Notification Router running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

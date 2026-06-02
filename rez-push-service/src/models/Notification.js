const mongoose = require('mongoose');

const notificationStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  BOUNCED: 'bounced',
  UNSUBSCRIBED: 'unsubscribed',
  RATE_LIMITED: 'rate_limited',
  DEDUPLICATED: 'deduplicated',
  OPTED_OUT: 'opted_out',
};

const deliveryLogSchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'],
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(notificationStatus),
    required: true,
  },
  providerMessageId: {
    type: String,
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed,
  },
  errorCode: {
    type: String,
  },
  errorMessage: {
    type: String,
  },
  sentAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const notificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  templateId: {
    type: String,
    ref: 'Template',
    index: true,
  },
  templateVariantId: {
    type: String,
  },
  category: {
    type: String,
    enum: ['food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'],
    required: true,
    index: true,
  },
  channels: [{
    type: String,
    enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'],
  }],
  channelsAttempted: [{
    type: String,
    enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'],
  }],
  channelStatuses: {
    type: Map,
    of: {
      status: { type: String },
      attempts: { type: Number, default: 0 },
      lastAttemptAt: { type: Date },
      errorCode: { type: String },
      errorMessage: { type: String },
      providerMessageId: { type: String },
    },
    default: new Map(),
  },
  deliveryLogs: [deliveryLogSchema],
  status: {
    type: String,
    enum: Object.values(notificationStatus),
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['high', 'normal', 'low'],
    default: 'normal',
  },
  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  variables: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  content: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  scheduledFor: {
    type: Date,
    index: true,
  },
  sentAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  batchId: {
    type: String,
    index: true,
  },
  broadcastId: {
    type: String,
    index: true,
  },
  segmentId: {
    type: String,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 3,
  },
  idempotencyKey: {
    type: String,
    sparse: true,
    index: true,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  collection: 'notifications',
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ broadcastId: 1, status: 1 });
notificationSchema.index({ templateId: 1, status: 1 });
notificationSchema.index({ createdAt: -1, status: 1 });

notificationSchema.methods.setChannelStatus = function(channel, status, details = {}) {
  const channelData = this.channelStatuses.get(channel) || { attempts: 0 };
  channelData.status = status;
  channelData.lastAttemptAt = new Date();

  if (details.attempts) channelData.attempts = details.attempts;
  if (details.errorCode) channelData.errorCode = details.errorCode;
  if (details.errorMessage) channelData.errorMessage = details.errorMessage;
  if (details.providerMessageId) channelData.providerMessageId = details.providerMessageId;

  this.channelStatuses.set(channel, channelData);
};

notificationSchema.methods.markChannelSent = function(channel, providerMessageId = null) {
  this.setChannelStatus(channel, notificationStatus.SENT, { providerMessageId });
  this.deliveryLogs.push({
    channel,
    status: notificationStatus.SENT,
    providerMessageId,
    sentAt: new Date(),
  });
};

notificationSchema.methods.markChannelDelivered = function(channel, details = {}) {
  this.setChannelStatus(channel, notificationStatus.DELIVERED, details);
  this.deliveryLogs.push({
    channel,
    status: notificationStatus.DELIVERED,
    providerMessageId: details.providerMessageId,
    deliveredAt: new Date(),
  });
};

notificationSchema.methods.markChannelFailed = function(channel, errorCode, errorMessage) {
  this.setChannelStatus(channel, notificationStatus.FAILED, { errorCode, errorMessage });
  this.deliveryLogs.push({
    channel,
    status: notificationStatus.FAILED,
    errorCode,
    errorMessage,
  });
};

notificationSchema.methods.areAllChannelsComplete = function() {
  for (const channel of this.channels) {
    const status = this.channelStatuses.get(channel)?.status;
    if (!status || status === notificationStatus.PENDING ||
        status === notificationStatus.QUEUED ||
        status === notificationStatus.PROCESSING) {
      return false;
    }
  }
  return true;
};

notificationSchema.methods.isFullySuccessful = function() {
  for (const channel of this.channels) {
    const status = this.channelStatuses.get(channel)?.status;
    if (status !== notificationStatus.SENT &&
        status !== notificationStatus.DELIVERED &&
        status !== notificationStatus.READ) {
      return false;
    }
  }
  return true;
};

notificationSchema.methods.updateOverallStatus = function() {
  if (this.status === notificationStatus.FAILED) return;

  const statuses = Array.from(this.channelStatuses.values()).map(s => s.status);

  if (statuses.every(s => [notificationStatus.SENT, notificationStatus.DELIVERED,
      notificationStatus.READ].includes(s))) {
    this.status = notificationStatus.SENT;
    if (statuses.some(s => s === notificationStatus.DELIVERED)) {
      this.status = notificationStatus.DELIVERED;
    }
  } else if (statuses.some(s => s === notificationStatus.FAILED) &&
             statuses.every(s => [notificationStatus.FAILED, notificationStatus.SENT,
                 notificationStatus.DELIVERED, notificationStatus.READ].includes(s))) {
    this.status = notificationStatus.SENT;
  } else if (statuses.every(s => s === notificationStatus.FAILED)) {
    this.status = notificationStatus.FAILED;
  }
};

notificationSchema.methods.addDeliveryLog = function(log) {
  this.deliveryLogs.push({
    ...log,
    timestamp: new Date(),
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

Notification.statuses = notificationStatus;

module.exports = Notification;

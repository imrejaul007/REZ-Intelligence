const mongoose = require('mongoose');

const templateVariantSchema = new mongoose.Schema({
  variantId: {
    type: String,
    required: true,
  },
  variantName: {
    type: String,
    required: true,
  },
  weight: {
    type: Number,
    min: 0,
    max: 100,
    default: 50,
  },
  channels: {
    fcm: {
      title: { type: String },
      body: { type: String, required: true },
      image: { type: String },
      icon: { type: String },
      clickAction: { type: String },
      data: { type: Map, of: mongoose.Schema.Types.Mixed },
    },
    apns: {
      title: { type: String },
      body: { type: String, required: true },
      image: { type: String },
      sound: { type: String },
      badge: { type: Number },
      category: { type: String },
      data: { type: Map, of: mongoose.Schema.Types.Mixed },
    },
    sms: {
      body: { type: String, required: true },
      maxLength: { type: Number, default: 160 },
    },
    email: {
      subject: { type: String, required: true },
      htmlBody: { type: String },
      textBody: { type: String },
      fromName: { type: String },
    },
    whatsapp: {
      body: { type: String, required: true },
      templateName: { type: String },
      headerType: { type: String, enum: ['text', 'image', 'video', 'document', null] },
      headerContent: { type: String },
      footerText: { type: String },
      buttons: [{
        type: { type: String, enum: ['quick_reply', 'url', 'phone', null] },
        text: { type: String },
        url: { type: String },
        phone: { type: String },
      }],
    },
    inapp: {
      title: { type: String },
      body: { type: String, required: true },
      image: { type: String },
      actionUrl: { type: String },
      actionText: { type: String },
      duration: { type: Number, default: 5000 },
      position: { type: String, enum: ['top', 'bottom', 'center'], default: 'top' },
    },
  },
});

const templateSchema = new mongoose.Schema({
  templateId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    enum: ['food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'archived'],
    default: 'draft',
    index: true,
  },
  channels: [{
    type: String,
    enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'],
    required: true,
  }],
  variants: [templateVariantSchema],
  abTestEnabled: {
    type: Boolean,
    default: false,
  },
  abTestConfig: {
    controlVariant: { type: String },
    testDuration: { type: Number },
    minSampleSize: { type: Number },
    successMetric: {
      type: String,
      enum: ['open_rate', 'click_rate', 'conversion_rate', 'engagement'],
    },
  },
  defaultVariant: {
    type: String,
  },
  tags: [{
    type: String,
    index: true,
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  createdBy: {
    type: String,
  },
  scheduledFor: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
}, {
  timestamps: true,
  collection: 'notification_templates',
});

templateSchema.index({ status: 1, category: 1 });
templateSchema.index({ tags: 1 });
templateSchema.index({ createdAt: -1 });

templateSchema.methods.getVariant = function(variantId = null) {
  if (!this.abTestEnabled && this.defaultVariant) {
    return this.variants.find(v => v.variantId === this.defaultVariant);
  }
  if (variantId) {
    return this.variants.find(v => v.variantId === variantId);
  }
  if (this.variants.length === 1) {
    return this.variants[0];
  }
  return null;
};

templateSchema.methods.selectRandomVariant = function() {
  if (!this.abTestEnabled) {
    return this.getVariant(this.defaultVariant);
  }

  const totalWeight = this.variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const variant of this.variants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant;
    }
  }

  return this.variants[0];
};

templateSchema.methods.getContentForChannel = function(channel, variantId = null) {
  const variant = variantId ? this.getVariant(variantId) : this.selectRandomVariant();
  if (!variant || !variant.channels) return null;

  const channelContent = variant.channels[channel];
  if (!channelContent) return null;

  return {
    ...channelContent,
    variantId: variant.variantId,
    variantName: variant.variantName,
  };
};

templateSchema.methods.isValid = function() {
  if (!this.templateId || !this.name || !this.category) return false;
  if (this.channels.length === 0) return false;
  if (this.variants.length === 0) return false;

  for (const variant of this.variants) {
    for (const channel of this.channels) {
      const content = variant.channels?.[channel];
      if (!content) continue;

      if (channel === 'email' && !content.subject) return false;
      if (channel === 'sms' && !content.body) return false;
      if (!['sms', 'email', 'whatsapp'].includes(channel) && !content.body) return false;
    }
  }

  return true;
};

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;

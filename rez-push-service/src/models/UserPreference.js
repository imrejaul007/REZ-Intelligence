const mongoose = require('mongoose');

const frequencyCapSchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp', 'all'],
    required: true,
  },
  maxPerDay: { type: Number, default: 10 },
  maxPerWeek: { type: Number, default: 50 },
  maxPerMonth: { type: Number, default: 200 },
});

const categoryPreferenceSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'],
    required: true,
  },
  enabled: { type: Boolean, default: true },
  channels: [{
    type: String,
    enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'],
  }],
});

const channelPreferenceSchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'],
    required: true,
  },
  enabled: { type: Boolean, default: true },
});

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  channelPreferences: {
    type: Map,
    of: {
      enabled: { type: Boolean, default: true },
      tokens: mongoose.Schema.Types.Mixed,
    },
    default: new Map([
      ['fcm', { enabled: true, tokens: [] }],
      ['apns', { enabled: true, tokens: [] }],
      ['sms', { enabled: true }],
      ['email', { enabled: true }],
      ['whatsapp', { enabled: true }],
      ['inapp', { enabled: true }],
    ]),
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    startHour: { type: Number, min: 0, max: 23, default: 22 },
    startMinute: { type: Number, min: 0, max: 59, default: 0 },
    endHour: { type: Number, min: 0, max: 23, default: 8 },
    endMinute: { type: Number, min: 0, max: 59, default: 0 },
    timezone: { type: String, default: 'UTC' },
    channelOverrides: {
      type: Map,
      of: {
        enabled: { type: Boolean },
        startHour: { type: Number },
        startMinute: { type: Number },
        endHour: { type: Number },
        endMinute: { type: Number },
      },
    },
  },
  categoryPreferences: {
    type: Map,
    of: {
      enabled: { type: Boolean, default: true },
      channels: [{
        type: String,
        enum: ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'],
      }],
    },
    default: new Map([
      ['food', { enabled: true, channels: ['fcm', 'inapp'] }],
      ['offers', { enabled: true, channels: ['fcm', 'email'] }],
      ['alerts', { enabled: true, channels: ['fcm', 'sms', 'inapp'] }],
      ['orders', { enabled: true, channels: ['fcm', 'inapp'] }],
      ['promotions', { enabled: true, channels: ['email'] }],
      ['system', { enabled: true, channels: ['inapp', 'email'] }],
      ['marketing', { enabled: false, channels: [] }],
    ]),
  },
  frequencyCaps: {
    type: Map,
    of: {
      maxPerDay: { type: Number, default: 10 },
      maxPerWeek: { type: Number, default: 50 },
      maxPerMonth: { type: Number, default: 200 },
    },
    default: new Map([
      ['all', { maxPerDay: 10, maxPerWeek: 50, maxPerMonth: 200 }],
    ]),
  },
  globalOptOut: {
    type: Boolean,
    default: false,
  },
  optOutCategories: {
    type: [String],
    default: [],
  },
  optOutTemplates: {
    type: [String],
    default: [],
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  collection: 'user_preferences',
});

userPreferenceSchema.methods.isChannelEnabled = function(channel) {
  const pref = this.channelPreferences.get(channel);
  return pref ? pref.enabled : true;
};

userPreferenceSchema.methods.isCategoryEnabled = function(category, channel = null) {
  const catPref = this.categoryPreferences.get(category);
  if (!catPref || !catPref.enabled) return false;
  if (channel && catPref.channels && catPref.channels.length > 0) {
    return catPref.channels.includes(channel);
  }
  return true;
};

userPreferenceSchema.methods.isInQuietHours = function(channel = null) {
  if (!this.quietHours.enabled) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  let startHour = this.quietHours.startHour;
  let startMinute = this.quietHours.startMinute;
  let endHour = this.quietHours.endHour;
  let endMinute = this.quietHours.endMinute;

  if (channel) {
    const channelOverride = this.quietHours.channelOverrides?.get(channel);
    if (channelOverride?.enabled) {
      startHour = channelOverride.startHour ?? startHour;
      startMinute = channelOverride.startMinute ?? startMinute;
      endHour = channelOverride.endHour ?? endHour;
      endMinute = channelOverride.endMinute ?? endMinute;
    }
  }

  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    return currentTime >= startTime || currentTime <= endTime;
  }
};

userPreferenceSchema.methods.hasOptedOut = function(category = null, templateId = null) {
  if (this.globalOptOut) return true;
  if (category && this.optOutCategories.includes(category)) return true;
  if (templateId && this.optOutTemplates.includes(templateId)) return true;
  return false;
};

userPreferenceSchema.methods.canReceiveNotification = function(category, channel) {
  if (this.hasOptedOut(category)) return false;
  if (!this.isChannelEnabled(channel)) return false;
  if (!this.isCategoryEnabled(category, channel)) return false;
  if (this.isInQuietHours(channel)) return false;
  return true;
};

userPreferenceSchema.methods.getEnabledChannels = function(category = null) {
  const channels = [];
  const channelList = ['fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'];

  for (const channel of channelList) {
    if (this.canReceiveNotification(category, channel)) {
      channels.push(channel);
    }
  }

  return channels;
};

userPreferenceSchema.methods.getFrequencyCap = function(channel = 'all') {
  return this.frequencyCaps.get(channel) || this.frequencyCaps.get('all') || {
    maxPerDay: 10,
    maxPerWeek: 50,
    maxPerMonth: 200,
  };
};

userPreferenceSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.channelPreferences = Object.fromEntries(this.channelPreferences);
  obj.categoryPreferences = Object.fromEntries(this.categoryPreferences);
  obj.frequencyCaps = Object.fromEntries(this.frequencyCaps);
  return obj;
};

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = UserPreference;

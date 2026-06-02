const mongoose = require('mongoose');
const bcrypt = require('mongoose-bcrypt');

const userDeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  deviceType: {
    type: String,
    enum: ['ios', 'android', 'web', 'other'],
    required: true,
  },
  fcmToken: { type: String },
  apnsToken: { type: String },
  isActive: { type: Boolean, default: true },
  lastActiveAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    sparse: true,
    trim: true,
  },
  whatsappNumber: {
    type: String,
    sparse: true,
    trim: true,
  },
  devices: [userDeviceSchema],
  preferences: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserPreference',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  collection: 'users',
});

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'devices.fcmToken': 1 });
userSchema.index({ 'devices.apnsToken': 1 });
userSchema.index({ status: 1, createdAt: -1 });

userSchema.methods.getActiveDevices = function() {
  return this.devices.filter(d => d.isActive);
};

userSchema.methods.getPrimaryDevice = function() {
  const activeDevices = this.getActiveDevices();
  if (activeDevices.length === 0) return null;
  return activeDevices[0];
};

userSchema.methods.hasDeviceToken = function(channel) {
  switch (channel) {
    case 'fcm':
      return this.devices.some(d => d.isActive && d.fcmToken);
    case 'apns':
      return this.devices.some(d => d.isActive && d.apnsToken);
    default:
      return false;
  }
};

userSchema.methods.isReachableByChannel = function(channel) {
  switch (channel) {
    case 'fcm':
    case 'apns':
      return this.hasDeviceToken(channel);
    case 'sms':
      return !!this.phone;
    case 'email':
      return !!this.email;
    case 'whatsapp':
      return !!this.whatsappNumber;
    case 'inapp':
      return true;
    default:
      return false;
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;

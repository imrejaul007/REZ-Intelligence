import mongoose, { Schema, model, Document } from 'mongoose';
import { IAutomotiveMindSession } from '../types';
import config from '../config';

export interface AutomotiveMindSessionDocument extends Omit<IAutomotiveMindSession, '_id'>, Document {}

const messageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const contextSchema = new Schema({
  customerId: String,
  vehicleId: String,
  serviceType: String,
  intent: String,
}, { _id: false });

const sessionSchema = new Schema<AutomotiveMindSessionDocument>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    merchantId: { type: String, index: true },
    context: { type: contextSchema, default: {} },
    messages: { type: [messageSchema], default: [] },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired'],
      default: 'active',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    timestamps: true,
    indexes: [
      { keys: { userId: 1, status: 1 }, name: 'idx_user_status' },
      { keys: { expiresAt: 1 }, name: 'idx_expires', expireAfterSeconds: 0 },
    ],
  }
);

// Pre-save hook to generate sessionId and set expiration
sessionSchema.pre('save', function (next) {
  if (!this.sessionId) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.sessionId = `AMS-${timestamp}-${randomStr}`;
  }
  if (!this.expiresAt) {
    const ttl = config.session.ttlDays;
    this.expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);
  }
  next();
});

// Method to add message to session
sessionSchema.methods.addMessage = function (
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
) {
  this.messages.push({ role, content, timestamp: new Date(), metadata });
  return this.save();
};

// Method to get conversation history
sessionSchema.methods.getHistory = function (limit?: number) {
  const messages = [...this.messages];
  if (limit && limit > 0) {
    return messages.slice(-limit);
  }
  return messages;
};

// Static method to find or create session
sessionSchema.statics.findOrCreate = async function (userId: string, context?: Record<string, unknown>) {
  let session = await this.findOne({ userId, status: 'active' });

  if (!session) {
    const ttl = config.session.ttlDays;
    session = new this({
      userId,
      context: context || {},
      messages: [],
      status: 'active',
      expiresAt: new Date(Date.now() + ttl * 24 * 60 * 60 * 1000),
    });
    await session.save();
  }

  return session;
};

// Static method to cleanup expired sessions
sessionSchema.statics.cleanupExpired = async function () {
  const result = await this.updateMany(
    { status: 'active', expiresAt: { $lt: new Date() } },
    { status: 'expired' }
  );
  return result.modifiedCount;
};

// Ensure virtuals are included in JSON output
sessionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const AutomotiveMindSession = model<AutomotiveMindSessionDocument>('AutomotiveMindSession', sessionSchema);
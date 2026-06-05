import mongoose, { Schema, model, Document } from 'mongoose';
import { IFashionMindSession } from '../types';
import config from '../config';

export interface FashionMindSessionDocument extends Omit<IFashionMindSession, '_id'>, Document {}

const sessionSchema = new Schema<FashionMindSessionDocument>({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, index: true },
  context: { customerId: String, productId: String, intent: String },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'] },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active', index: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true, indexes: [{ keys: { userId: 1, status: 1 } }, { keys: { expiresAt: 1 }, expireAfterSeconds: 0 }] });

sessionSchema.pre('save', function (next) {
  if (!this.sessionId) this.sessionId = `FMS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  if (!this.expiresAt) this.expiresAt = new Date(Date.now() + config.session.ttlDays * 24 * 60 * 60 * 1000);
  next();
});

sessionSchema.methods.addMessage = function (role: 'user' | 'assistant' | 'system', content: string) {
  this.messages.push({ role, content, timestamp: new Date() });
  return this.save();
};

sessionSchema.methods.getHistory = function (limit?: number) {
  const msgs = [...this.messages];
  return limit ? msgs.slice(-limit) : msgs;
};

sessionSchema.statics.findOrCreate = async function (userId: string, context?: Record<string, unknown>) {
  let session = await this.findOne({ userId, status: 'active' });
  if (!session) {
    session = new this({ userId, context: context || {}, messages: [], status: 'active', expiresAt: new Date(Date.now() + config.session.ttlDays * 24 * 60 * 60 * 1000) });
    await session.save();
  }
  return session;
};

sessionSchema.set('toJSON', { virtuals: true, transform: (_doc, ret) => { delete ret._id; delete ret.__v; return ret; } });

export const FashionMindSession = model<FashionMindSessionDocument>('FashionMindSession', sessionSchema);
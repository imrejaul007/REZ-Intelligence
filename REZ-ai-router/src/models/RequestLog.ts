import mongoose, { Schema, Document, Model } from 'mongoose';
import { IRequestLog, RequestStatus } from '../types';

export interface RequestLogDocument extends IRequestLog, Document {
  _id: mongoose.Types.ObjectId;
}

const requestLogSchema = new Schema<RequestLogDocument>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: String, index: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    tier: { type: String, required: true },
    prompt: { type: String },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
    totalTokens: { type: Number },
    cost: { type: Number },
    latency: { type: Number },
    status: {
      type: String,
      enum: ['success', 'error', 'fallback'] as RequestStatus[],
      default: 'success',
    },
    error: { type: String },
    fallbackUsed: { type: Boolean, default: false },
    fallbackFrom: { type: String },
    fallbackTo: { type: String },
  },
  { timestamps: true }
);

// Compound indexes for analytics
requestLogSchema.index({ userId: 1, createdAt: -1 });
requestLogSchema.index({ provider: 1, createdAt: -1 });
requestLogSchema.index({ cost: 1 });
requestLogSchema.index({ createdAt: -1 });

export const RequestLog: Model<RequestLogDocument> = mongoose.model<RequestLogDocument>(
  'RequestLog',
  requestLogSchema
);

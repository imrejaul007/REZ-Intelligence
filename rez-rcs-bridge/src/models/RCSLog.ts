import mongoose, { Schema, Document } from 'mongoose';
import { RCSMessageStatus, RCSMessageType } from './RCSCard';

export interface IRCSLog extends Document {
  messageId: string;
  from: string;
  to: string;
  type: RCSMessageType;
  carrier: 'jio' | 'airtel';
  status: RCSMessageStatus;
  payload: Record<string, unknown>;
  response?: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

const RCSLogSchema = new Schema<IRCSLog>(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(RCSMessageType),
      required: true,
    },
    carrier: {
      type: String,
      enum: ['jio', 'airtel'],
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(RCSMessageStatus),
      default: RCSMessageStatus.PENDING,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    response: {
      type: Schema.Types.Mixed,
    },
    errorMessage: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
RCSLogSchema.index({ to: 1, createdAt: -1 });
RCSLogSchema.index({ status: 1, createdAt: -1 });
RCSLogSchema.index({ carrier: 1, status: 1 });

export const RCSLog = mongoose.model<IRCSLog>('RCSLog', RCSLogSchema);

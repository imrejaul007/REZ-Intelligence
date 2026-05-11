import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata: {
    source: string;
    timestamp: Date;
    correlationId?: string;
    replyTo?: string;
  };
  status: 'pending' | 'processed' | 'failed' | 'dead_letter';
  subscribers: string[];
  processedBy: string[];
  failedSubscribers: Array<{
    subscriber: string;
    error: string;
    attempts: number;
    lastAttempt: Date;
  }>;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    metadata: {
      source: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        required: true,
        default: Date.now,
      },
      correlationId: String,
      replyTo: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed', 'dead_letter'],
      default: 'pending',
      index: true,
    },
    subscribers: [{
      type: String,
      index: true,
    }],
    processedBy: [{
      type: String,
    }],
    failedSubscribers: [{
      subscriber: String,
      error: String,
      attempts: { type: Number, default: 1 },
      lastAttempt: Date,
    }],
    retryCount: {
      type: Number,
      default: 0,
    },
    processedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
EventSchema.index({ eventType: 1, status: 1 });
EventSchema.index({ 'metadata.source': 1, createdAt: -1 });
EventSchema.index({ status: 1, createdAt: -1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);

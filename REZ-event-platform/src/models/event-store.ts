import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../utils/logger';

export interface IEventStore extends Document {
  eventId: string;
  type: string;
  version: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  source: string;
  timestamp: Date;
  processed: boolean;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventStoreSchema = new Schema<IEventStore>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    correlationId: {
      type: String,
      index: true,
    },
    source: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    processedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'event_store',
  }
);

// Compound indexes for common queries
EventStoreSchema.index({ type: 1, timestamp: -1 });
EventStoreSchema.index({ processed: 1, status: 1 });
EventStoreSchema.index({ correlationId: 1, timestamp: -1 });

// TTL index for automatic cleanup (optional)
EventStoreSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 } // 30 days retention
);

export const EventStore: Model<IEventStore> = mongoose.model<IEventStore>(
  'EventStore',
  EventStoreSchema
);

// ============================================
// Dead Letter Event Schema
// ============================================
export interface IDeadLetterEvent extends Document {
  originalJobId?: string;
  event: Record<string, unknown>;
  error: string;
  failedAt: Date;
  attemptsMade: number;
  status: 'pending' | 'reviewed' | 'replayed' | 'discarded';
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeadLetterEventSchema = new Schema<IDeadLetterEvent>(
  {
    originalJobId: {
      type: String,
      index: true,
    },
    event: {
      type: Schema.Types.Mixed,
      required: true,
    },
    error: {
      type: String,
      required: true,
    },
    failedAt: {
      type: Date,
      required: true,
    },
    attemptsMade: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'replayed', 'discarded'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: String,
    },
    reviewedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'dead_letter_events',
  }
);

DeadLetterEventSchema.index({ status: 1, failedAt: -1 });
DeadLetterEventSchema.index({ createdAt: 1 });

export const DeadLetterEvent: Model<IDeadLetterEvent> = mongoose.model<IDeadLetterEvent>(
  'DeadLetterEvent',
  DeadLetterEventSchema
);

// ============================================
// Event Query Helpers
// ============================================
export async function getRecentEvents(
  limit: number = 100,
  type?: string,
  processed?: boolean
): Promise<IEventStore[]> {
  const query: Record<string, unknown> = {};

  if (type) {
    query.type = type;
  }

  if (processed !== undefined) {
    query.processed = processed;
  }

  return EventStore.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean() as unknown as IEventStore[];
}

export async function getFailedEvents(limit: number = 100): Promise<IEventStore[]> {
  return EventStore.find({
    status: 'failed',
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean() as unknown as IEventStore[];
}

export async function getDeadLetterEvents(
  limit: number = 100,
  status?: string
): Promise<IDeadLetterEvent[]> {
  const query: Record<string, unknown> = {};

  if (status) {
    query.status = status;
  }

  return DeadLetterEvent.find(query)
    .sort({ failedAt: -1 })
    .limit(limit)
    .lean() as unknown as IDeadLetterEvent[];
}

export async function retryDeadLetterEvent(eventId: string): Promise<boolean> {
  try {
    const event = await DeadLetterEvent.findById(eventId);

    if (!event) {
      logger.warn('Dead letter event not found', { eventId });
      return false;
    }

    const { publish } = await import('../events/emitter');
    const result = await publish(event.event as any);

    if (result.success) {
      event.status = 'replayed';
      event.reviewedAt = new Date();
      await event.save();
      logger.info('Dead letter event replayed', { eventId, newEventId: result.eventId });
    }

    return result.success;
  } catch (error) {
    logger.error('Failed to replay dead letter event', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

export async function discardDeadLetterEvent(
  eventId: string,
  notes: string
): Promise<boolean> {
  try {
    const event = await DeadLetterEvent.findById(eventId);

    if (!event) {
      logger.warn('Dead letter event not found', { eventId });
      return false;
    }

    event.status = 'discarded';
    event.notes = notes;
    event.reviewedAt = new Date();
    await event.save();

    logger.info('Dead letter event discarded', { eventId, notes });
    return true;
  } catch (error) {
    logger.error('Failed to discard dead letter event', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

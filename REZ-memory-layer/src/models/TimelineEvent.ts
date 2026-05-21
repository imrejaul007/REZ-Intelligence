/**
 * REZ Memory Layer - Timeline Event Model
 * MongoDB model for storing timeline events
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  TimelineEvent,
  EventMetadata,
  GeoLocation,
  EventSource,
  EventCategory
} from '../types/timeline';

export interface ITimelineEventDocument extends Omit<TimelineEvent, 'timestamp' | 'metadata'>, Document {
  timestamp: Date;
  metadata: EventMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const GeoLocationSchema = new Schema<GeoLocation>(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => v.length === 2,
        message: 'Coordinates must be [longitude, latitude]'
      }
    },
    city: String,
    country: String
  },
  { _id: false }
);

const EventMetadataSchema = new Schema<EventMetadata>(
  {
    sessionId: String,
    deviceId: String,
    ipAddress: String,
    userAgent: String,
    location: GeoLocationSchema,
    correlationId: String,
    parentEventId: String
  },
  { _id: false }
);

const TimelineEventSchema = new Schema<ITimelineEventDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: ['commerce', 'engagement', 'identity', 'loyalty', 'intelligence', 'support', 'marketing', 'notification'],
      required: true,
      index: true
    },
    source: {
      type: String,
      enum: ['whatsapp', 'support', 'order', 'payment', 'loyalty', 'campaign', 'qr', 'ai', 'push', 'auth', 'catalog', 'search', 'delivery', 'booking', 'dooh'],
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    metadata: {
      type: EventMetadataSchema,
      required: true,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'timeline_events'
  }
);

// Compound indexes for common queries
TimelineEventSchema.index({ userId: 1, timestamp: -1 });
TimelineEventSchema.index({ userId: 1, category: 1, timestamp: -1 });
TimelineEventSchema.index({ userId: 1, source: 1, timestamp: -1 });
TimelineEventSchema.index({ userId: 1, type: 1, timestamp: -1 });
TimelineEventSchema.index({ timestamp: -1 });

// TTL index to automatically remove old events (optional, configurable)
TimelineEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: undefined });

// Static methods for common queries
TimelineEventSchema.statics.findByUserId = function(
  userId: string,
  options: {
    limit?: number;
    skip?: number;
    startDate?: Date;
    endDate?: Date;
    sources?: string[];
    categories?: string[];
  } = {}
) {
  const query: Record<string, unknown> = { userId };

  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) (query.timestamp as Record<string, Date>).$gte = options.startDate;
    if (options.endDate) (query.timestamp as Record<string, Date>).$lte = options.endDate;
  }

  if (options.sources?.length) {
    query.source = { $in: options.sources };
  }

  if (options.categories?.length) {
    query.category = { $in: options.categories };
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 100);
};

TimelineEventSchema.statics.getEventCountByUserId = function(userId: string) {
  return this.countDocuments({ userId });
};

TimelineEventSchema.statics.getEventCountByCategory = function(userId: string) {
  return this.aggregate([
    { $match: { userId } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

TimelineEventSchema.statics.getEventCountBySource = function(userId: string) {
  return this.aggregate([
    { $match: { userId } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

TimelineEventSchema.statics.getRecentActivity = function(userId: string, hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.countDocuments({ userId, timestamp: { $gte: since } });
};

TimelineEventSchema.statics.getUniqueActiveDays = function(userId: string, days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { userId, timestamp: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
        }
      }
    },
    { $count: 'uniqueDays' }
  ]);
};

export const TimelineEvent = mongoose.model<ITimelineEventDocument>(
  'TimelineEvent',
  TimelineEventSchema
);

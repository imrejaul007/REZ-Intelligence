/**
 * REZ Memory Layer - Timeline Event Model
 * MongoDB model for storing timeline events
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITimelineEventDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: string;
  userId: string;
  type: string;
  category: string;
  source: string;
  timestamp: Date;
  data;
  metadata;
  createdAt: Date;
  updatedAt: Date;
}

const TimelineEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  source: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true, collection: 'timeline_events' });

export const TimelineEvent = mongoose.model<ITimelineEventDocument>('TimelineEvent', TimelineEventSchema);
export const TimelineEventModel = TimelineEvent;

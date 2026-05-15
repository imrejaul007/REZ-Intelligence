/**
 * LocationVisit Model
 * Records individual visits to locations
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { LocationVisit } from '../types/index.js';

const coordinatesSchema = new Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

export interface LocationVisitDocument extends Omit<LocationVisit, '_id'>, Document {}

const locationVisitSchema = new Schema<LocationVisitDocument>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  locationId: {
    type: String,
    required: true,
    index: true
  },
  locationName: {
    type: String,
    required: true
  },
  locationType: {
    type: String,
    required: true,
    enum: ['mall', 'restaurant', 'office', 'college', 'airport', 'gym', 'store', 'other'],
    index: true
  },
  zone: {
    type: String,
    required: true,
    index: true
  },
  coordinates: {
    type: coordinatesSchema,
    default: undefined
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  dwellTimeMinutes: {
    type: Number,
    default: undefined
  },
  source: {
    type: String,
    required: true,
    enum: ['qr_scan', 'checkin', 'delivery', 'booking'],
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: undefined
  }
}, {
  timestamps: false,
  versionKey: false
});

// Compound indexes for common queries
locationVisitSchema.index({ userId: 1, timestamp: -1 });
locationVisitSchema.index({ locationId: 1, timestamp: -1 });
locationVisitSchema.index({ zone: 1, timestamp: -1 });
locationVisitSchema.index({ userId: 1, locationType: 1 });

// TTL index to auto-delete old visits (optional - 2 years retention)
locationVisitSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

export const LocationVisitModel = mongoose.model<LocationVisitDocument>('LocationVisit', locationVisitSchema);

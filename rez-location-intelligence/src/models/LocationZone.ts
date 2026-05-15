/**
 * LocationZone Model
 * Geographic zones for geofencing and area-based analytics
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { LocationZone, ZoneType, ZoneAttributes, Coordinates, Polygon } from '../types/index.js';

const coordinatesSchema = new Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const polygonSchema = new Schema({
  type: { type: String, enum: ['Polygon'], default: 'Polygon' },
  coordinates: { type: [[[Number]]], required: true }
}, { _id: false });

const zoneAttributesSchema = new Schema({
  premium: { type: Boolean, default: false },
  categories: [{ type: String }],
  footfallTier: {
    type: String,
    enum: ['low', 'medium', 'high', 'ultra'],
    default: 'medium'
  }
}, { _id: false });

export interface LocationZoneDocument extends Omit<LocationZone, '_id'>, Document {}

const locationZoneSchema = new Schema<LocationZoneDocument>({
  zoneId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['mall', 'airport', 'college', 'office_park', 'restaurant_hub', 'residential', 'commercial', 'other'],
    index: true
  },
  polygon: polygonSchema,
  center: coordinatesSchema,
  attributes: {
    type: zoneAttributesSchema,
    default: () => ({ premium: false, categories: [] })
  },
  activeUsers: {
    type: Number,
    default: 0
  },
  dailyFootfall: {
    type: Number,
    default: 0
  },
  weeklyFootfall: {
    type: Number,
    default: 0
  },
  monthlyFootfall: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  versionKey: false
});

// Index for zone type queries
locationZoneSchema.index({ 'attributes.premium': 1 });
locationZoneSchema.index({ 'attributes.footfallTier': 1 });
locationZoneSchema.index({ type: 1, 'attributes.premium': 1 });

export const LocationZoneModel = mongoose.model<LocationZoneDocument>('LocationZone', locationZoneSchema);

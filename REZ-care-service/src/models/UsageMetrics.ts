/**
 * Usage Metrics Model for REZ Care Service
 * Tracks subscription usage for billing and limits
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IOverageMetrics {
  ticketsOverage: number;
  apiCallsOverage: number;
  storageOverage: number;
}

export interface IUsageMetrics extends Document {
  clientId: string;
  month: string; // YYYY-MM format
  ticketsUsed: number;
  agentsUsed: number;
  brandsUsed: number;
  apiCalls: number;
  storageUsed: number; // in MB
  overage: IOverageMetrics;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OverageMetricsSchema = new Schema<IOverageMetrics>({
  ticketsOverage: { type: Number, default: 0 },
  apiCallsOverage: { type: Number, default: 0 },
  storageOverage: { type: Number, default: 0 },
}, { _id: false });

const UsageMetricsSchema = new Schema<IUsageMetrics>({
  clientId: { type: String, required: true, index: true },
  month: { type: String, required: true, index: true },
  ticketsUsed: { type: Number, default: 0 },
  agentsUsed: { type: Number, default: 0 },
  brandsUsed: { type: Number, default: 0 },
  apiCalls: { type: Number, default: 0 },
  storageUsed: { type: Number, default: 0 },
  overage: { type: OverageMetricsSchema, default: () => ({
    ticketsOverage: 0,
    apiCallsOverage: 0,
    storageOverage: 0
  }) },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
UsageMetricsSchema.index({ clientId: 1, month: 1 }, { unique: true });
UsageMetricsSchema.index({ clientId: 1, createdAt: -1 });

export const UsageMetrics = mongoose.model<IUsageMetrics>('UsageMetrics', UsageMetricsSchema);

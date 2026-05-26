/**
 * Merchant Metrics Model
 * Real-time aggregated merchant analytics from MongoDB
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IMerchantMetrics extends Document {
  merchantId: string;
  totalCustomers: number;
  activeCustomers: number;
  monthlyRevenue: number;
  avgOrderValue: number;
  repeatRate: number;
  totalOrders: number;
  newCustomers: number;
  returningCustomers: number;
  churnedCustomers: number;
  atRiskCustomers: number;
  lastUpdated: Date;
  period: 'daily' | 'weekly' | 'monthly';
}

const MerchantMetricsSchema = new Schema<IMerchantMetrics>({
  merchantId: { type: String, required: true, index: true },
  totalCustomers: { type: Number, default: 0 },
  activeCustomers: { type: Number, default: 0 },
  monthlyRevenue: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  repeatRate: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  newCustomers: { type: Number, default: 0 },
  returningCustomers: { type: Number, default: 0 },
  churnedCustomers: { type: Number, default: 0 },
  atRiskCustomers: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  period: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'monthly' }
}, { timestamps: true });

MerchantMetricsSchema.index({ merchantId: 1, period: 1 });
MerchantMetricsSchema.index({ merchantId: 1, lastUpdated: -1 });

export const MerchantMetrics = mongoose.model<IMerchantMetrics>('MerchantMetrics', MerchantMetricsSchema);

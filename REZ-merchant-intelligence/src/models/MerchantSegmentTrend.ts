/**
 * Merchant Segment Trend Model
 * Historical segment data for analytics
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IMerchantSegmentTrend extends Document {
  merchantId: string;
  date: Date;
  segments: {
    champions: { count: number; revenue: number; percentage: number };
    loyalists: { count: number; revenue: number; percentage: number };
    occasional: { count: number; revenue: number; percentage: number };
    atRisk: { count: number; revenue: number; percentage: number };
    newCustomers: { count: number; revenue: number; percentage: number };
    dormant: { count: number; revenue: number; percentage: number };
  };
  totalCustomers: number;
  totalRevenue: number;
}

const MerchantSegmentTrendSchema = new Schema<IMerchantSegmentTrend>({
  merchantId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  segments: {
    champions: { count: { type: Number }, revenue: { type: Number }, percentage: { type: Number } },
    loyalists: { count: { type: Number }, revenue: { type: Number }, percentage: { type: Number } },
    occasional: { count: { type: Number }, revenue: { type: Number }, percentage: { type: Number } },
    atRisk: { count: { type: Number }, revenue: { type: Number }, percentage: { type: Number } },
    newCustomers: { count: { type: Number }, revenue: { type: Number }, percentage: { type: Number } },
    dormant: { count: { type: Number }, revenue: { type: Number }, percentage: { type: Number } }
  },
  totalCustomers: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 }
}, { timestamps: true });

MerchantSegmentTrendSchema.index({ merchantId: 1, date: -1 });

export const MerchantSegmentTrend = mongoose.model<IMerchantSegmentTrend>('MerchantSegmentTrend', MerchantSegmentTrendSchema);

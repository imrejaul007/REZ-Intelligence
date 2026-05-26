/**
 * Customer Model
 * Individual customer records for merchants
 */

import mongoose, { Schema, Document } from 'mongoose';

export type CustomerSegment = 'champions' | 'loyalists' | 'occasional' | 'at_risk' | 'new' | 'dormant';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ICustomer extends Document {
  merchantId: string;
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  segment: CustomerSegment;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  riskLevel: RiskLevel;
  ltv: number;
  tags: string[];
  notes?: string;
  preferences?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const CustomerSchema = new Schema<ICustomer>({
  merchantId: { type: String, required: true, index: true },
  customerId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  segment: {
    type: String,
    enum: ['champions', 'loyalists', 'occasional', 'at_risk', 'new', 'dormant'],
    default: 'new'
  },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  lastOrderDate: { type: Date },
  firstOrderDate: { type: Date },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  ltv: { type: Number, default: 0 },
  tags: [{ type: String }],
  notes: { type: String },
  preferences: { type: Schema.Types.Mixed },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

CustomerSchema.index({ merchantId: 1, segment: 1 });
CustomerSchema.index({ merchantId: 1, riskLevel: 1 });
CustomerSchema.index({ merchantId: 1, lastOrderDate: -1 });
CustomerSchema.index({ merchantId: 1, ltv: -1 });
CustomerSchema.index({ email: 1 }, { sparse: true });
CustomerSchema.index({ phone: 1 }, { sparse: true });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);

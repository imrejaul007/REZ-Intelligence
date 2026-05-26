/**
 * Recommendation Model
 * AI-generated recommendations for merchants
 */

import mongoose, { Schema, Document } from 'mongoose';

export type RecommendationType = 'retention' | 'upsell' | 'winback' | 'acquisition' | 'engagement';
export type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type RecommendationStatus = 'pending' | 'applied' | 'dismissed' | 'expired';

export interface IRecommendation extends Document {
  merchantId: string;
  type: RecommendationType;
  segment: string;
  action: string;
  expectedImpact: string;
  priority: RecommendationPriority;
  estimatedRevenue: number;
  status: RecommendationStatus;
  appliedAt?: Date;
  expiresAt?: Date;
  metrics?: {
    baseline: number;
    target: number;
    actual?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSchema = new Schema<IRecommendation>({
  merchantId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['retention', 'upsell', 'winback', 'acquisition', 'engagement'],
    required: true
  },
  segment: { type: String, required: true },
  action: { type: String, required: true },
  expectedImpact: { type: String },
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  estimatedRevenue: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'applied', 'dismissed', 'expired'],
    default: 'pending'
  },
  appliedAt: { type: Date },
  expiresAt: { type: Date },
  metrics: {
    baseline: { type: Number },
    target: { type: Number },
    actual: { type: Number }
  }
}, { timestamps: true });

RecommendationSchema.index({ merchantId: 1, priority: 1, status: 1 });
RecommendationSchema.index({ merchantId: 1, createdAt: -1 });

export const Recommendation = mongoose.model<IRecommendation>('Recommendation', RecommendationSchema);

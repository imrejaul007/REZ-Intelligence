/**
 * Merchant Prediction Model
 * ML predictions for merchant analytics
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IMerchantPrediction extends Document {
  merchantId: string;
  predictionType: 'churn' | 'ltv' | 'revisit' | 'conversion' | 'demand';
  predictedAt: Date;
  predictedFor: Date;
  score: number;
  confidence: number;
  factors: string[];
  recommendedActions: string[];
  metadata: Record<string, unknown>;
}

const MerchantPredictionSchema = new Schema<IMerchantPrediction>({
  merchantId: { type: String, required: true, index: true },
  predictionType: {
    type: String,
    enum: ['churn', 'ltv', 'revisit', 'conversion', 'demand'],
    required: true
  },
  predictedAt: { type: Date, default: Date.now },
  predictedFor: { type: Date, required: true },
  score: { type: Number, required: true },
  confidence: { type: Number, default: 0 },
  factors: [{ type: String }],
  recommendedActions: [{ type: String }],
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

MerchantPredictionSchema.index({ merchantId: 1, predictionType: 1, predictedAt: -1 });

export const MerchantPrediction = mongoose.model<IMerchantPrediction>('MerchantPrediction', MerchantPredictionSchema);

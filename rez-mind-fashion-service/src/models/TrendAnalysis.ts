import mongoose, { Schema, model, Document } from 'mongoose';
import { ITrendAnalysis } from '../types';

export interface TrendAnalysisDocument extends Omit<ITrendAnalysis, '_id'>, Document {}

const trendAnalysisSchema = new Schema<TrendAnalysisDocument>({
  analysisId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  trendType: { type: String, enum: ['emerging', 'stable', 'declining'], required: true },
  popularity: { type: Number, required: true, min: 0, max: 100 },
  growthRate: { type: Number, required: true },
  demographics: [{ type: String }],
  sources: [{ type: String }],
  prediction: {
    nextPeak: { type: Date, required: true },
    confidence: { type: Number, min: 0, max: 1 },
    forecast: { type: String, enum: ['growth', 'stable', 'decline'], required: true },
  },
  recommendations: [{
    action: String,
    priority: { type: String, enum: ['high', 'medium', 'low'] },
  }],
}, { timestamps: true, indexes: [{ keys: { merchantId: 1, category: 1 } }, { keys: { createdAt: -1 } }] });

trendAnalysisSchema.pre('save', function (next) {
  if (!this.analysisId) this.analysisId = `TRA-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  next();
});

trendAnalysisSchema.set('toJSON', { virtuals: true, transform: (_doc, ret) => { delete ret._id; delete ret.__v; return ret; } });

export const TrendAnalysis = model<TrendAnalysisDocument>('TrendAnalysis', trendAnalysisSchema);
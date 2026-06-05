import mongoose, { Schema, model, Document } from 'mongoose';
import { IStyleMatch } from '../types';

export interface StyleMatchDocument extends Omit<IStyleMatch, '_id'>, Document {}

const styleMatchSchema = new Schema<StyleMatchDocument>({
  matchId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true, index: true },
  styleProfile: {
    bodyType: String,
    preferredStyles: [{ type: String }],
    preferredColors: [{ type: String }],
    sizePreferences: { type: Map, of: Number },
    budgetRange: { min: Number, max: Number },
  },
  matches: [{
    productId: String,
    matchScore: Number,
    reasons: [{ type: String }],
  }],
  confidence: { type: Number, min: 0, max: 1 },
}, { timestamps: true });

styleMatchSchema.pre('save', function (next) {
  if (!this.matchId) this.matchId = `STM-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  next();
});

styleMatchSchema.set('toJSON', { virtuals: true, transform: (_doc, ret) => { delete ret._id; delete ret.__v; return ret; } });

export const StyleMatch = model<StyleMatchDocument>('StyleMatch', styleMatchSchema);
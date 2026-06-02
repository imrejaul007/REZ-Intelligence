/**
 * Score Profile Schema
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IScoreProfile extends Document {
  userId: string;
  composite: number;
  engagement: number;
  spending: number;
  karma: number;
  social: number;
  streak: number;
  crossMerchant: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'rez_elite';
  percentile?: number;
  rank?: number;
  lastUpdated: Date;
}

const ScoreProfileSchema = new Schema<IScoreProfile>({
  userId: { type: String, required: true, unique: true, index: true },
  composite: { type: Number, default: 0 },
  engagement: { type: Number, default: 0 },
  spending: { type: Number, default: 0 },
  karma: { type: Number, default: 0 },
  social: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  crossMerchant: { type: Number, default: 0 },
  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'rez_elite'],
    default: 'bronze',
  },
  percentile: Number,
  rank: Number,
  lastUpdated: { type: Date, default: Date.now },
});

ScoreProfileSchema.index({ composite: -1 });

export const ScoreProfile = mongoose.model<IScoreProfile>('ScoreProfile', ScoreProfileSchema);

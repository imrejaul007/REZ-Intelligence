import mongoose, { Schema, Document } from 'mongoose';

// Competitor Visit Schema
export const CompetitorVisitSchema = new Schema({
  competitorId: { type: String, required: true },
  competitorName: { type: String, required: true },
  category: { type: String, required: true },
  visitDate: { type: Date, required: true, default: Date.now },
  spend: { type: Number, required: true, default: 0 },
  visitType: {
    type: String,
    enum: ['delivery', 'dine_in', 'pickup'],
    required: true
  },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

// Switch Signal Schema
export const SwitchSignalSchema = new Schema({
  type: {
    type: String,
    enum: ['price_alert', 'review_drop', 'offer_expired', 'new_competitor', 'poor_experience'],
    required: true
  },
  competitorId: { type: String },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  timestamp: { type: Date, required: true, default: Date.now },
  description: { type: String }
}, { _id: false });

// Competitor Activity Schema
export const CompetitorActivitySchema = new Schema({
  visitsToCompetitors: [CompetitorVisitSchema],
  competitorSpending: { type: Number, default: 0 },
  competitorShare: { type: Number, default: 0, min: 0, max: 100 },
  preferredCompetitors: [{ type: String }],
  switchFrequency: { type: Number, default: 0 },
  lastCompetitorVisit: { type: Date }
}, { _id: false });

// Win Back Potential Schema
export const WinBackPotentialSchema = new Schema({
  score: { type: Number, required: true, min: 0, max: 100 },
  tier: { type: String, enum: ['hot', 'warm', 'cold'], required: true },
  topTrigger: { type: String, required: true },
  optimalChannel: {
    type: String,
    enum: ['sms', 'email', 'push', 'whatsapp'],
    required: true
  },
  optimalTiming: {
    type: String,
    enum: ['immediate', 'morning', 'evening', 'weekend'],
    required: true
  },
  competitorsTargeting: [{ type: String }],
  estimatedValue: { type: Number, default: 0 },
  recommendedOffer: { type: String }
}, { _id: false });

// User Competitor Profile Schema
export interface IUserCompetitorProfile extends Document {
  userId: string;
  competitorActivity: {
    visitsToCompetitors: Array<{
      competitorId: string;
      competitorName: string;
      category: string;
      visitDate: Date;
      spend: number;
      visitType: string;
      metadata?: Record<string, unknown>;
    }>;
    competitorSpending: number;
    competitorShare: number;
    preferredCompetitors: string[];
    switchFrequency: number;
    lastCompetitorVisit: Date | null;
  };
  switchSignals: Array<{
    type: string;
    competitorId?: string;
    severity: string;
    timestamp: Date;
    description?: string;
  }>;
  loyaltyScore: number;
  winBackPotential?: {
    score: number;
    tier: string;
    topTrigger: string;
    optimalChannel: string;
    optimalTiming: string;
    competitorsTargeting: string[];
    estimatedValue: number;
    recommendedOffer?: string;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
  createdAt: Date;
}

export const UserCompetitorProfileSchema = new Schema<IUserCompetitorProfile>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  competitorActivity: {
    type: CompetitorActivitySchema,
    required: true,
    default: () => ({
      visitsToCompetitors: [],
      competitorSpending: 0,
      competitorShare: 0,
      preferredCompetitors: [],
      switchFrequency: 0,
      lastCompetitorVisit: null
    })
  },
  switchSignals: {
    type: [SwitchSignalSchema],
    default: []
  },
  loyaltyScore: {
    type: Number,
    required: true,
    default: 50,
    min: 0,
    max: 100
  },
  winBackPotential: {
    type: WinBackPotentialSchema
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Create indexes
UserCompetitorProfileSchema.index({ loyaltyScore: 1 });
UserCompetitorProfileSchema.index({ 'competitorActivity.competitorShare': -1 });
UserCompetitorProfileSchema.index({ riskLevel: 1 });
UserCompetitorProfileSchema.index({ 'winBackPotential.score': -1 });

// Create model
export const UserCompetitorProfile = mongoose.model<IUserCompetitorProfile>(
  'UserCompetitorProfile',
  UserCompetitorProfileSchema
);

export default UserCompetitorProfile;

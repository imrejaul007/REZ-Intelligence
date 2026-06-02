import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// Local Type Definitions (avoid conflicts)
// ============================================

type ActionTypeEnum =
  | 'browse'
  | 'search'
  | 'view_product'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'initiate_checkout'
  | 'add_payment'
  | 'complete_purchase'
  | 'add_to_wishlist'
  | 'share'
  | 'review'
  | 'login'
  | 'logout'
  | 'signup'
  | 'view_order'
  | 'cancel_order'
  | 'refund'
  | 'subscribe'
  | 'unsubscribe'
  | 'custom';

type SessionTypeEnum = 'browse' | 'search' | 'purchase' | 'abandoned' | 'mixed';

// ============================================
// Behavior Event Model
// ============================================

export interface IBehaviorEvent extends Document {
  eventId: string;
  userId: string;
  action: ActionTypeEnum;
  timestamp: Date;
  sessionId: string;
  duration?: number;
  productId?: string;
  categoryId?: string;
  amount?: number;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const BehaviorEventSchema = new Schema<IBehaviorEvent>({
  eventId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  action: {
    type: String,
    required: true,
    enum: ['browse', 'search', 'view_product', 'add_to_cart', 'remove_from_cart',
           'view_cart', 'initiate_checkout', 'add_payment', 'complete_purchase',
           'add_to_wishlist', 'share', 'review', 'login', 'logout', 'signup',
           'view_order', 'cancel_order', 'refund', 'subscribe', 'unsubscribe', 'custom']
  },
  timestamp: { type: Date, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  duration: { type: Number },
  productId: { type: String },
  categoryId: { type: String },
  amount: { type: Number },
  deviceType: { type: String, enum: ['mobile', 'desktop', 'tablet'] },
  location: {
    city: String,
    state: String,
    country: String
  },
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true
});

// Compound indexes for common queries
BehaviorEventSchema.index({ userId: 1, timestamp: -1 });
BehaviorEventSchema.index({ userId: 1, sessionId: 1 });
BehaviorEventSchema.index({ action: 1, timestamp: -1 });

// ============================================
// User Session Model
// ============================================

export interface IUserSession extends Document {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  sessionType: SessionTypeEnum;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  isActive: boolean;
  totalDuration?: number;
  eventCount: number;
  actions: ActionTypeEnum[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema = new Schema<IUserSession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  sessionType: {
    type: String,
    required: true,
    enum: ['browse', 'search', 'purchase', 'abandoned', 'mixed']
  },
  deviceType: { type: String, enum: ['mobile', 'desktop', 'tablet'] },
  location: {
    city: String,
    state: String,
    country: String
  },
  isActive: { type: Boolean, default: false },
  totalDuration: { type: Number },
  eventCount: { type: Number, default: 0 },
  actions: [{ type: String }]
}, {
  timestamps: true
});

// Compound indexes
UserSessionSchema.index({ userId: 1, startTime: -1 });
UserSessionSchema.index({ sessionType: 1, startTime: -1 });

// ============================================
// Markov Chain Model Storage
// ============================================

export interface IMarkovChainModel extends Document {
  userId: string;
  states: ActionTypeEnum[];
  transitionMatrix: Record<string, Record<string, number>>;
  initialProbabilities: Record<string, number>;
  order: number;
  trainedAt: Date;
  eventCount: number;
  entropy: number;
  createdAt: Date;
  updatedAt: Date;
}

const MarkovChainModelSchema = new Schema<IMarkovChainModel>({
  userId: { type: String, required: true, unique: true, index: true },
  states: [{ type: String }],
  transitionMatrix: { type: Schema.Types.Mixed, required: true },
  initialProbabilities: { type: Schema.Types.Mixed, required: true },
  order: { type: Number, required: true, default: 1 },
  trainedAt: { type: Date, required: true },
  eventCount: { type: Number, required: true },
  entropy: { type: Number, required: true }
}, {
  timestamps: true
});

// TTL index to auto-expire old models (90 days)
MarkovChainModelSchema.index({ trainedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ============================================
// Sequence Pattern Model
// ============================================

export interface ISequencePattern extends Document {
  patternId: string;
  userId: string;
  sequence: ActionTypeEnum[];
  frequency: number;
  averageDuration: number;
  conversionRate: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

const SequencePatternSchema = new Schema<ISequencePattern>({
  patternId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  sequence: [{ type: String }],
  frequency: { type: Number, required: true },
  averageDuration: { type: Number, required: true },
  conversionRate: { type: Number, required: true },
  firstOccurrence: { type: Date, required: true },
  lastOccurrence: { type: Date, required: true },
  confidence: { type: Number, required: true }
}, {
  timestamps: true
});

SequencePatternSchema.index({ userId: 1, frequency: -1 });

// ============================================
// Temporal Pattern Model
// ============================================

export interface ITemporalPattern extends Document {
  patternId: string;
  userId: string;
  patternType: string;
  description: string;
  confidence: number;
  occurrences: Date[];
  frequency: string;
  peakTimes?: {
    dayOfWeek?: string[];
    hourOfDay?: number[];
  };
  value?: number;
  conversionRate?: number;
  detectedAt: Date;
  nextExpectedOccurrence?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TemporalPatternSchema = new Schema<ITemporalPattern>({
  patternId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  patternType: {
    type: String,
    required: true,
    enum: ['sequential', 'periodic', 'temporal', 'session', 'funnel', 'abandonment', 'engagement']
  },
  description: { type: String, required: true },
  confidence: { type: Number, required: true },
  occurrences: [{ type: Date }],
  frequency: { type: String, required: true },
  peakTimes: {
    dayOfWeek: [String],
    hourOfDay: [Number]
  },
  value: { type: Number },
  conversionRate: { type: Number },
  detectedAt: { type: Date, required: true },
  nextExpectedOccurrence: { type: Date }
}, {
  timestamps: true
});

TemporalPatternSchema.index({ userId: 1, patternType: 1 });
TemporalPatternSchema.index({ userId: 1, confidence: -1 });

// ============================================
// Periodic Pattern Model (Fourier Analysis)
// ============================================

export interface IPeriodicPattern extends Document {
  patternId: string;
  userId: string;
  period: number;
  strength: number;
  phase: number;
  amplitude: number;
  confidence: number;
  examples: Date[];
  createdAt: Date;
  updatedAt: Date;
}

const PeriodicPatternSchema = new Schema<IPeriodicPattern>({
  patternId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  period: { type: Number, required: true },
  strength: { type: Number, required: true },
  phase: { type: Number, required: true },
  amplitude: { type: Number, required: true },
  confidence: { type: Number, required: true },
  examples: [{ type: Date }]
}, {
  timestamps: true
});

PeriodicPatternSchema.index({ userId: 1, strength: -1 });

// ============================================
// Sequence Analysis Cache
// ============================================

export interface ISequenceAnalysisCache extends Document {
  userId: string;
  analysisType: string;
  result: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

const SequenceAnalysisCacheSchema = new Schema<ISequenceAnalysisCache>({
  userId: { type: String, required: true, index: true },
  analysisType: { type: String, required: true },
  result: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: true }
}, {
  timestamps: true
});

// TTL index
SequenceAnalysisCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============================================
// Model Exports
// ============================================

export const BehaviorEventModel = mongoose.model<IBehaviorEvent>('BehaviorEvent', BehaviorEventSchema);
export const UserSessionModel = mongoose.model<IUserSession>('UserSession', UserSessionSchema);
export const MarkovChainModelDoc = mongoose.model<IMarkovChainModel>('MarkovChainModel', MarkovChainModelSchema);
export const SequencePatternModel = mongoose.model<ISequencePattern>('SequencePattern', SequencePatternSchema);
export const TemporalPatternModel = mongoose.model<ITemporalPattern>('TemporalPattern', TemporalPatternSchema);
export const PeriodicPatternModel = mongoose.model<IPeriodicPattern>('PeriodicPattern', PeriodicPatternSchema);
export const SequenceAnalysisCacheModel = mongoose.model<ISequenceAnalysisCache>('SequenceAnalysisCache', SequenceAnalysisCacheSchema);

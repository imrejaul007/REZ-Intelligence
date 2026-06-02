import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// INTENT SIGNAL MODEL
// ============================================

export interface IIntentSignal {
  signalId: string;
  intentId: string;
  userId: string;
  appType: 'hotel_ota' | 'restaurant' | 'retail' | 'hotel_guest';
  eventType: 'search' | 'view' | 'wishlist' | 'cart_add' | 'hold' | 'checkout_start' | 'fulfilled' | 'abandoned';
  category: 'TRAVEL' | 'DINING' | 'RETAIL' | 'HOTEL_SERVICE' | 'GENERAL';
  intentKey: string;
  intentQuery?: string;
  merchantId?: string;
  metadata?: Record<string, unknown>;
  confidence: number;
  weight: number;
  recencyMultiplier: number;
  velocityBonus: number;
  status: 'ACTIVE' | 'DORMANT' | 'FULFILLED' | 'EXPIRED';
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IntentSignalSchema = new Schema<IIntentSignal & Document>({
  signalId: { type: String, required: true, unique: true, index: true },
  intentId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  appType: {
    type: String,
    enum: ['hotel_ota', 'restaurant', 'retail', 'hotel_guest'],
    index: true
  },
  eventType: {
    type: String,
    enum: ['search', 'view', 'wishlist', 'cart_add', 'hold', 'checkout_start', 'fulfilled', 'abandoned'],
    index: true
  },
  category: {
    type: String,
    enum: ['TRAVEL', 'DINING', 'RETAIL', 'HOTEL_SERVICE', 'GENERAL'],
    index: true
  },
  intentKey: { type: String, required: true },
  intentQuery: String,
  merchantId: String,
  metadata: Schema.Types.Mixed,
  confidence: { type: Number, default: 0.3 },
  weight: { type: Number, default: 1.0 },
  recencyMultiplier: { type: Number, default: 1.0 },
  velocityBonus: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['ACTIVE', 'DORMANT', 'FULFILLED', 'EXPIRED'],
    default: 'ACTIVE',
    index: true
  },
  lastSeenAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

IntentSignalSchema.index({ userId: 1, status: 1 });
IntentSignalSchema.index({ userId: 1, category: 1, status: 1 });
IntentSignalSchema.index({ lastSeenAt: 1, status: 1 });

export const IntentSignal = mongoose.model<IIntentSignal & Document>('IntentSignal', IntentSignalSchema);

// ============================================
// USER PROFILE MODEL
// ============================================

export interface IUserProfile {
  userId: string;
  appTypes: string[];
  categories: {
    category: string;
    affinityScore: number;
    lastInteraction: Date;
  }[];
  segments: string[];
  intentSignals: {
    preferences: Record<string, unknown>;
    intent_signals: Record<string, unknown>;
    behavior: Record<string, unknown>;
  };
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile & Document>({
  userId: { type: String, required: true, unique: true, index: true },
  appTypes: [String],
  categories: [{
    category: String,
    affinityScore: Number,
    lastInteraction: Date
  }],
  segments: [String],
  intentSignals: {
    preferences: Schema.Types.Mixed,
    intent_signals: Schema.Types.Mixed,
    behavior: Schema.Types.Mixed
  }
}, { timestamps: true });

export const UserProfile = mongoose.model<IUserProfile & Document>('UserProfile', UserProfileSchema);

// ============================================
// EVENT TYPES EXPORT
// ============================================

export const SIGNAL_WEIGHTS: Record<string, number> = {
  search: 0.5,
  view: 0.3,
  wishlist: 0.7,
  cart_add: 0.8,
  hold: 0.6,
  checkout_start: 0.9,
  fulfilled: 1.0,
  abandoned: 0.4
};

export const BASE_CONFIDENCE = 0.3;
export const DORMANCY_THRESHOLD_DAYS = 7;

export const APP_TYPES = ['hotel_ota', 'restaurant', 'retail', 'hotel_guest'] as const;
export const CATEGORIES = ['TRAVEL', 'DINING', 'RETAIL', 'HOTEL_SERVICE', 'GENERAL'] as const;
export const EVENT_TYPES = ['search', 'view', 'wishlist', 'cart_add', 'hold', 'checkout_start', 'fulfilled', 'abandoned'] as const;

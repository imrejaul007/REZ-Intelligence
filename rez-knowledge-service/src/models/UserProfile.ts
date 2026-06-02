// REZ Knowledge Service - Unified User Profile Model
// Single source of truth for user data across ALL apps in the ecosystem

import mongoose, { Document, Schema } from 'mongoose';
import {
  AppEcosystem,
  HotelPreferences,
  RestaurantPreferences,
  SalonPreferences,
  HealthcarePreferences,
  LifestylePreferences,
  CorporatePreferences,
  UnifiedUserPreferences,
  UserHistoryStats,
  KnowledgeSignal,
} from '../types';

// ─── Hotel Preferences Schema ────────────────────────────────────────────────────
const HotelPreferencesSchema = new Schema<HotelPreferences>(
  {
    preferredRoomTypes: { type: [String], default: [] },
    bedPreference: {
      type: String,
      enum: ['single', 'double', 'twin', 'suite', 'any'],
      default: 'any',
    },
    floorPreference: { type: String, enum: ['low', 'high', 'any'], default: 'any' },
    smokingPreference: { type: Boolean, default: false },
    requiredAmenities: { type: [String], default: [] },
    preferredBrands: { type: [String], default: [] },
    earlyCheckin: { type: Boolean, default: false },
    lateCheckout: { type: Boolean, default: false },
    paymentMethodPreference: {
      type: String,
      enum: ['prepay', 'paylater'],
      default: 'paylater',
    },
    frequentDestinations: { type: [String], default: [] },
    tripPurpose: {
      type: [String],
      enum: ['business', 'leisure', 'medical', 'wedding'],
      default: [],
    },
    preferredStarRating: { type: Number, default: 3, min: 1, max: 5 },
    budgetRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 },
    },
    avgStayDuration: { type: Number, default: 1 },
    bookingLeadTime: { type: Number, default: 7 },
  },
  { _id: false }
);

// ─── Restaurant Preferences Schema ───────────────────────────────────────────────
const RestaurantPreferencesSchema = new Schema<RestaurantPreferences>(
  {
    preferredCuisines: { type: [String], default: [] },
    dietaryRestrictions: {
      type: [String],
      enum: ['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher', 'nut-allergy'],
      default: [],
    },
    spicePreference: {
      type: String,
      enum: ['mild', 'medium', 'hot', 'very-hot'],
      default: 'medium',
    },
    preferredDiningTime: {
      start: { type: String, default: '12:00' },
      end: { type: String, default: '22:00' },
    },
    partySizePreference: { type: Number, default: 2 },
    seatingPreference: {
      type: String,
      enum: ['indoor', 'outdoor', 'private', 'any'],
      default: 'any',
    },
    deliveryVsDineIn: {
      type: String,
      enum: ['delivery', 'dine-in', 'takeaway', 'mixed'],
      default: 'mixed',
    },
    avgOrderValue: { type: Number, default: 500 },
    orderingFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'occasional'],
      default: 'occasional',
    },
    favoriteRestaurants: { type: [String], default: [] },
    favoriteDishes: {
      type: [
        {
          storeId: { type: String, required: true },
          productId: { type: String, required: true },
        },
      ],
      default: [],
    },
    tipPreference: { type: Number, default: 10, min: 0, max: 100 },
    paymentMethodPreference: { type: [String], default: [] },
  },
  { _id: false }
);

// ─── Salon Preferences Schema ───────────────────────────────────────────────────
const SalonPreferencesSchema = new Schema<SalonPreferences>(
  {
    preferredServices: { type: [String], default: [] },
    preferredGenderSalon: {
      type: String,
      enum: ['male', 'female', 'unisex'],
      default: 'unisex',
    },
    hairType: {
      type: String,
      enum: ['straight', 'wavy', 'curly', 'coily'],
      default: 'straight',
    },
    preferredStylists: { type: [String], default: [] },
    specificStylistRequired: { type: Boolean, default: false },
    preferredTimeSlots: { type: [String], default: [] },
    reminderPreference: { type: Boolean, default: true },
    bufferTime: { type: Number, default: 15 },
    avgSpendingPerVisit: { type: Number, default: 500 },
    maxDistance: { type: Number, default: 10 },
  },
  { _id: false }
);

// ─── Healthcare Preferences Schema ─────────────────────────────────────────────
const HealthcarePreferencesSchema = new Schema<HealthcarePreferences>(
  {
    bloodType: { type: String },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    medications: { type: [String], default: [] },
    preferredDoctors: { type: [String], default: [] },
    preferredClinics: { type: [String], default: [] },
    preferredHospitalNetworks: { type: [String], default: [] },
    appointmentTimePreference: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'any'],
      default: 'any',
    },
    telehealthPreference: { type: Boolean, default: false },
    preferredLanguage: { type: String, default: 'en' },
    insuranceProvider: { type: String },
    insurancePolicyNumber: { type: String },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' },
    },
  },
  { _id: false }
);

// ─── Lifestyle Preferences Schema (Rendez) ────────────────────────────────────
const LifestylePreferencesSchema = new Schema<LifestylePreferences>(
  {
    interestedIn: {
      type: [String],
      enum: ['male', 'female', 'non-binary', 'all'],
      default: ['all'],
    },
    relationshipType: {
      type: [String],
      enum: ['casual', 'relationship', 'marriage', 'friendship', 'any'],
      default: ['any'],
    },
    ageRangePreference: {
      min: { type: Number, default: 18 },
      max: { type: Number, default: 50 },
    },
    distancePreference: { type: Number, default: 25 },
    preferredDateActivities: { type: [String], default: [] },
    preferredLocations: { type: [String], default: [] },
    indoorVsOutdoor: {
      type: String,
      enum: ['indoor', 'outdoor', 'balanced'],
      default: 'balanced',
    },
    interests: { type: [String], default: [] },
    hobbies: { type: [String], default: [] },
    diet: { type: String, default: 'no-preference' },
    exerciseFrequency: {
      type: String,
      enum: ['never', 'rarely', 'weekly', 'daily'],
      default: 'weekly',
    },
    smokingPreference: {
      type: String,
      enum: ['smoker', 'non-smoker', 'occasional'],
      default: 'non-smoker',
    },
    drinkingPreference: {
      type: String,
      enum: ['never', 'occasionally', 'socially', 'regularly'],
      default: 'socially',
    },
    dateBudgetRange: {
      min: { type: Number, default: 500 },
      max: { type: Number, default: 5000 },
    },
  },
  { _id: false }
);

// ─── Corporate Preferences Schema (Corpspark) ─────────────────────────────────
const CorporatePreferencesSchema = new Schema<CorporatePreferences>(
  {
    companyId: { type: String },
    employeeId: { type: String },
    department: { type: String },
    travelClassPreference: {
      type: String,
      enum: ['economy', 'premium-economy', 'business', 'any'],
      default: 'economy',
    },
    hotelBudgetPerNight: { type: Number, default: 3000 },
    mealAllowance: { type: Number, default: 500 },
    advanceBookingRequired: { type: Boolean, default: true },
    preferredHotels: { type: [String], default: [] },
    preferredAirlines: { type: [String], default: [] },
    preferredCarServices: { type: [String], default: [] },
    autoApproveUnder: { type: Number },
    requiresReceipts: { type: Boolean, default: true },
    defaultCostCenter: { type: String },
    preferredPaymentMethod: { type: String, default: 'company-card' },
  },
  { _id: false }
);

// ─── Unified User Preferences Schema ───────────────────────────────────────────
const UnifiedUserPreferencesSchema = new Schema<UnifiedUserPreferences>(
  {
    hotel: { type: HotelPreferencesSchema, default: () => ({}) },
    restaurant: { type: RestaurantPreferencesSchema, default: () => ({}) },
    salon: { type: SalonPreferencesSchema, default: () => ({}) },
    healthcare: { type: HealthcarePreferencesSchema, default: () => ({}) },
    lifestyle: { type: LifestylePreferencesSchema, default: () => ({}) },
    corporate: { type: CorporatePreferencesSchema, default: () => ({}) },
  },
  { _id: false }
);

// ─── User History Stats Schema ───────────────────────────────────────────────────
const UserHistoryStatsSchema = new Schema<UserHistoryStats>(
  {
    hotelBookings: { type: Number, default: 0 },
    restaurantOrders: { type: Number, default: 0 },
    salonBookings: { type: Number, default: 0 },
    healthcareAppointments: { type: Number, default: 0 },
    rendezDates: { type: Number, default: 0 },
    corporateBookings: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    totalSavings: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: Date.now },
    loyaltyTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
      default: 'bronze',
    },
    loyaltyPoints: { type: Number, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    joinedDate: { type: Date, default: Date.now },
    accountAge: { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Signal Enriched Data Schema ────────────────────────────────────────────────
const SignalEnrichedDataSchema = new Schema(
  {
    intent: { type: String },
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
    urgency: { type: String, enum: ['low', 'medium', 'high'] },
    category: { type: [String] },
    tags: { type: [String] },
  },
  { _id: false }
);

// ─── Knowledge Signal Schema ───────────────────────────────────────────────────
const KnowledgeSignalSchema = new Schema<KnowledgeSignal>(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    action: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, required: true, default: Date.now },
    source: {
      type: String,
      required: true,
      enum: ['stayown', 'rez-consumer', 'rendez', 'corpspark', 'restaurant', 'salon', 'healthcare'],
    },
    enrichedData: { type: SignalEnrichedDataSchema },
    processedAt: { type: Date },
  },
  { _id: false }
);

// ─── Linked Account Schema ─────────────────────────────────────────────────────
const LinkedAccountSchema = new Schema(
  {
    appSource: {
      type: String,
      required: true,
      enum: ['stayown', 'rez-consumer', 'rendez', 'corpspark', 'restaurant', 'salon', 'healthcare'],
    },
    userId: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Personalization Schema ────────────────────────────────────────────────────
const PersonalizationSchema = new Schema(
  {
    inferredInterests: { type: [String], default: [] },
    inferredDemographics: {
      ageGroup: { type: String },
      incomeBracket: { type: String },
      familyStatus: { type: String },
      lifestyle: { type: String },
    },
    recommendationsVersion: { type: String, default: '1.0' },
    lastPersonalizedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main Unified User Profile Schema ──────────────────────────────────────────
export interface IUnifiedUserProfile extends Document {
  userId: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  preferences: UnifiedUserPreferences;
  history: UserHistoryStats;
  signals: KnowledgeSignal[];
  personalization: {
    inferredInterests: string[];
    inferredDemographics: {
      ageGroup?: string;
      incomeBracket?: string;
      familyStatus?: string;
      lifestyle?: string;
    };
    recommendationsVersion: string;
    lastPersonalizedAt: Date;
  };
  linkedAccounts: {
    appSource: AppEcosystem;
    userId: string;
    linkedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
  lastSignalAt: Date;
  version: number;
}

const UnifiedUserProfileSchema = new Schema<IUnifiedUserProfile>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    avatar: { type: String },
    dateOfBirth: { type: String },
    gender: {
      type: String,
      enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'],
    },
    preferences: {
      type: UnifiedUserPreferencesSchema as any,
      default: () => ({
        hotel: {},
        restaurant: {},
        salon: {},
        healthcare: {},
        lifestyle: {},
        corporate: {},
        stayown: {},
        'rez-consumer': {},
        rendez: {},
        corpspark: {},
      }),
    },
    history: {
      type: UserHistoryStatsSchema,
      default: () => ({
        hotelBookings: 0,
        restaurantOrders: 0,
        salonBookings: 0,
        healthcareAppointments: 0,
        rendezDates: 0,
        corporateBookings: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        totalSavings: 0,
        avgRating: 0,
        totalReviews: 0,
        lastActiveDate: new Date(),
        loyaltyTier: 'bronze',
        loyaltyPoints: 0,
        lifetimeValue: 0,
        joinedDate: new Date(),
        accountAge: 0,
      }),
    },
    signals: {
      type: [KnowledgeSignalSchema],
      default: [],
    },
    personalization: {
      type: PersonalizationSchema,
      default: () => ({
        inferredInterests: [],
        inferredDemographics: {},
        recommendationsVersion: '1.0',
        lastPersonalizedAt: new Date(),
      }),
    },
    linkedAccounts: {
      type: [LinkedAccountSchema],
      default: [],
    },
    lastSignalAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    collection: 'unified_user_profiles',
  }
);

// ─── Indexes for Performance ─────────────────────────────────────────────────────
// Query optimization indexes
UnifiedUserProfileSchema.index({ email: 1 }, { sparse: true });
UnifiedUserProfileSchema.index({ phone: 1 }, { sparse: true });
UnifiedUserProfileSchema.index({ 'history.loyaltyTier': 1 });
UnifiedUserProfileSchema.index({ 'history.lastActiveDate': -1 });
UnifiedUserProfileSchema.index({ 'history.totalSpent': -1 });
UnifiedUserProfileSchema.index({ lastSignalAt: -1 });

// Signal-specific indexes
UnifiedUserProfileSchema.index({ 'signals.type': 1, 'signals.timestamp': -1 });
UnifiedUserProfileSchema.index({ 'signals.source': 1, 'signals.timestamp': -1 });

// Linked accounts index
UnifiedUserProfileSchema.index({ 'linkedAccounts.appSource': 1 });
UnifiedUserProfileSchema.index({ 'linkedAccounts.userId': 1 });

// Personalization indexes
UnifiedUserProfileSchema.index({ 'personalization.inferredInterests': 1 });

// ─── Methods ───────────────────────────────────────────────────────────────────
// Update history stats based on signal type
UnifiedUserProfileSchema.methods.updateHistoryFromSignal = function (
  signal: KnowledgeSignal
): void {
  const now = new Date();
  this.history.lastActiveDate = now;
  this.lastSignalAt = now;

  // Update counts based on signal source
  switch (signal.source) {
    case 'stayown':
    case 'rez-consumer':
      if (signal.type.includes('hotel')) {
        this.history.hotelBookings += 1;
      }
      if (signal.type.includes('restaurant') || signal.action === 'order') {
        this.history.restaurantOrders += 1;
      }
      break;
    case 'rendez':
      if (signal.type.includes('rendez') || signal.action === 'date') {
        this.history.rendezDates += 1;
      }
      break;
    case 'corpspark':
      this.history.corporateBookings += 1;
      break;
    case 'salon':
      this.history.salonBookings += 1;
      break;
    case 'healthcare':
      this.history.healthcareAppointments += 1;
      break;
  }

  // Update financial data if amount is present
  if (signal.data && typeof signal.data === 'object' && 'amount' in signal.data) {
    const amount = Number((signal.data as { amount: number }).amount) || 0;
    this.history.totalSpent += amount;
    this.history.avgOrderValue =
      (this.history.avgOrderValue * (this.history.restaurantOrders - 1) + amount) /
      this.history.restaurantOrders;
  }

  // Calculate account age
  this.history.accountAge = Math.floor(
    (now.getTime() - this.history.joinedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Update loyalty tier based on lifetime value
  this.updateLoyaltyTier();
};

UnifiedUserProfileSchema.methods.updateLoyaltyTier = function (): void {
  const ltv = this.history.lifetimeValue;
  if (ltv >= 100000) {
    this.history.loyaltyTier = 'diamond';
  } else if (ltv >= 50000) {
    this.history.loyaltyTier = 'platinum';
  } else if (ltv >= 25000) {
    this.history.loyaltyTier = 'gold';
  } else if (ltv >= 10000) {
    this.history.loyaltyTier = 'silver';
  } else {
    this.history.loyaltyTier = 'bronze';
  }
};

// Update preferences for a specific app
UnifiedUserProfileSchema.methods.updateAppPreferences = function (
  app: AppEcosystem,
  prefs: Partial<UnifiedUserPreferences[typeof app]>
): void {
  if (app in this.preferences) {
    this.preferences[app] = { ...this.preferences[app], ...prefs } as any;
  }
};

// Link another app account
UnifiedUserProfileSchema.methods.linkAccount = function (
  appSource: AppEcosystem,
  externalUserId: string
): void {
  const existing = this.linkedAccounts.find((a) => a.appSource === appSource);
  if (!existing) {
    this.linkedAccounts.push({
      appSource,
      userId: externalUserId,
      linkedAt: new Date(),
    });
  }
};

// Get signals filtered by app
UnifiedUserProfileSchema.methods.getSignalsByApp = function (
  app: AppEcosystem,
  limit = 100
): KnowledgeSignal[] {
  return this.signals
    .filter((s) => s.source === app)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
};

// Get signals filtered by type
UnifiedUserProfileSchema.methods.getSignalsByType = function (
  type: string,
  limit = 100
): KnowledgeSignal[] {
  return this.signals
    .filter((s) => s.type.includes(type))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
};

// ─── Statics ────────────────────────────────────────────────────────────────────
// Find or create unified profile
UnifiedUserProfileSchema.statics.findOrCreate = async function (
  userId: string
): Promise<IUnifiedUserProfile> {
  let profile = await this.findOne({ userId });
  if (!profile) {
    profile = await this.create({
      userId,
      name: '',
      email: '',
      phone: '',
      preferences: {
        hotel: {},
        restaurant: {},
        salon: {},
        healthcare: {},
        lifestyle: {},
        corporate: {},
      },
      history: {
        joinedDate: new Date(),
        lastActiveDate: new Date(),
      },
      signals: [],
      personalization: {
        inferredInterests: [],
        inferredDemographics: {},
        recommendationsVersion: '1.0',
        lastPersonalizedAt: new Date(),
      },
      linkedAccounts: [],
      lastSignalAt: new Date(),
      version: 1,
    });
  }
  return profile;
};

// Find by any linked account
UnifiedUserProfileSchema.statics.findByLinkedAccount = async function (
  appSource: AppEcosystem,
  externalUserId: string
): Promise<IUnifiedUserProfile | null> {
  return this.findOne({
    linkedAccounts: {
      $elemMatch: {
        appSource,
        userId: externalUserId,
      },
    },
  });
};

// Get users by loyalty tier
UnifiedUserProfileSchema.statics.findByLoyaltyTier = async function (
  tier: string
): Promise<IUnifiedUserProfile[]> {
  return this.find({ 'history.loyaltyTier': tier });
};

// Get high-value users
UnifiedUserProfileSchema.statics.findHighValueUsers = async function (
  minLtv = 50000
): Promise<IUnifiedUserProfile[]> {
  return this.find({ 'history.lifetimeValue': { $gte: minLtv } })
    .sort({ 'history.lifetimeValue': -1 })
    .limit(100);
};

// ─── Export ─────────────────────────────────────────────────────────────────────
export const UnifiedUserProfile = mongoose.model<IUnifiedUserProfile>(
  'UnifiedUserProfile',
  UnifiedUserProfileSchema
) as typeof UnifiedUserProfile & {
  findByLinkedAccount(appSource: string, userId: string): Promise<IUnifiedUserProfile | null>;
  findOrCreate(userId: string): Promise<IUnifiedUserProfile>;
  findByLoyaltyTier(tier: string): Promise<IUnifiedUserProfile[]>;
  findHighValueUsers(minLtv?: number): Promise<IUnifiedUserProfile[]>;
} & {
  updateHistoryFromSignal(signal: KnowledgeSignal): void;
  updateLoyaltyTier(): void;
  updateAppPreferences(app: AppEcosystem, prefs: Record<string, unknown>): void;
  linkAccount(appSource: AppEcosystem, externalUserId: string): void;
  getSignalsByApp(app: AppEcosystem, limit?: number): KnowledgeSignal[];
  getSignalsByType(type: string, limit?: number): KnowledgeSignal[];
};

// Legacy export for backward compatibility
export const UserProfile = UnifiedUserProfile;
export default UnifiedUserProfile;

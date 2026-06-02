// Unified User Knowledge Types - Single Source of Truth for ALL Apps
// This file defines the canonical user profile structure used across:
// - StayOwn (Hotel)
// - REZ Consumer App (all services)
// - Rendez (Couples)
// - Corpspark (Corporate)
// - Restaurant/Salon/Healthcare apps

// ─── App Sources ─────────────────────────────────────────────────────────────────
export type AppEcosystem =
  | 'stayown'        // Hotel booking app
  | 'rez-consumer'   // Main consumer app
  | 'rendez'         // Couples dating app
  | 'corpspark'      // Corporate services app
  | 'restaurant'     // Restaurant ordering
  | 'salon'          // Salon booking
  | 'healthcare';    // Healthcare appointments

// ─── Hotel Preferences (StayOwn) ───────────────────────────────────────────────
export interface HotelPreferences {
  // Room preferences
  preferredRoomTypes: string[];
  bedPreference: 'single' | 'double' | 'twin' | 'suite' | 'any';
  floorPreference: 'low' | 'high' | 'any';
  smokingPreference: boolean;

  // Amenities
  requiredAmenities: string[];
  preferredBrands: string[];

  // Booking behavior
  earlyCheckin: boolean;
  lateCheckout: boolean;
  paymentMethodPreference: 'prepay' | 'paylater';

  // Travel patterns
  frequentDestinations: string[];
  tripPurpose: ('business' | 'leisure' | 'medical' | 'wedding')[];
  preferredStarRating: number;
  budgetRange: { min: number; max: number };

  // Stay patterns
  avgStayDuration: number;
  bookingLeadTime: number; // days in advance
}

// ─── Restaurant Preferences ────────────────────────────────────────────────────
export interface RestaurantPreferences {
  // Cuisine preferences
  preferredCuisines: string[];
  dietaryRestrictions: ('vegetarian' | 'vegan' | 'gluten-free' | 'halal' | 'kosher' | 'nut-allergy')[];
  spicePreference: 'mild' | 'medium' | 'hot' | 'very-hot';

  // Dining preferences
  preferredDiningTime: { start: string; end: string }; // HH:mm format
  partySizePreference: number;
  seatingPreference: 'indoor' | 'outdoor' | 'private' | 'any';

  // Ordering patterns
  deliveryVsDineIn: 'delivery' | 'dine-in' | 'takeaway' | 'mixed';
  avgOrderValue: number;
  orderingFrequency: 'daily' | 'weekly' | 'monthly' | 'occasional';

  // Favorite places
  favoriteRestaurants: string[];
  favoriteDishes: { storeId: string; productId: string }[];

  // Payment
  tipPreference: number; // percentage
  paymentMethodPreference: string[];
}

// ─── Salon Preferences ─────────────────────────────────────────────────────────
export interface SalonPreferences {
  // Services
  preferredServices: string[];
  preferredGenderSalon: 'male' | 'female' | 'unisex';
  hairType: 'straight' | 'wavy' | 'curly' | 'coily';

  // Stylist preferences
  preferredStylists: string[];
  specificStylistRequired: boolean;

  // Appointment preferences
  preferredTimeSlots: string[]; // HH:mm format
  reminderPreference: boolean;
  bufferTime: number; // minutes between appointments

  // Budget
  avgSpendingPerVisit: number;
  maxDistance: number; // km
}

// ─── Healthcare Preferences ────────────────────────────────────────────────────
export interface HealthcarePreferences {
  // Medical preferences
  bloodType?: string;
  allergies: string[];
  chronicConditions: string[];
  medications: string[];

  // Provider preferences
  preferredDoctors: string[];
  preferredClinics: string[];
  preferredHospitalNetworks: string[];

  // Appointment preferences
  appointmentTimePreference: 'morning' | 'afternoon' | 'evening' | 'any';
  telehealthPreference: boolean;
  preferredLanguage: string;

  // Insurance
  insuranceProvider?: string;
  insurancePolicyNumber?: string;

  // Emergency
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

// ─── Lifestyle Preferences (Rendez) ────────────────────────────────────────────
export interface LifestylePreferences {
  // Dating preferences
  interestedIn: ('male' | 'female' | 'non-binary' | 'all')[];
  relationshipType: ('casual' | 'relationship' | 'marriage' | 'friendship' | 'any')[];
  ageRangePreference: { min: number; max: number };
  distancePreference: number; // km

  // Activities
  preferredDateActivities: string[];
  preferredLocations: string[];
  indoorVsOutdoor: 'indoor' | 'outdoor' | 'balanced';

  // Interests
  interests: string[];
  hobbies: string[];

  // Lifestyle
  diet: string;
  exerciseFrequency: 'never' | 'rarely' | 'weekly' | 'daily';
  smokingPreference: 'smoker' | 'non-smoker' | 'occasional';
  drinkingPreference: 'never' | 'occasionally' | 'socially' | 'regularly';

  // Budget for dates
  dateBudgetRange: { min: number; max: number };
}

// ─── Corporate Preferences (Corpspark) ──────────────────────────────────────────
export interface CorporatePreferences {
  // Company info
  companyId?: string;
  employeeId?: string;
  department?: string;

  // Travel policy
  travelClassPreference: 'economy' | 'premium-economy' | 'business' | 'any';
  hotelBudgetPerNight: number;
  mealAllowance: number;

  // Booking preferences
  advanceBookingRequired: boolean;
  preferredHotels: string[];
  preferredAirlines: string[];
  preferredCarServices: string[];

  // Approval workflow
  autoApproveUnder?: number;
  requiresReceipts: boolean;

  // Expense reporting
  defaultCostCenter?: string;
  preferredPaymentMethod: string;
}

// ─── All Preferences Combined ──────────────────────────────────────────────────
export interface UnifiedUserPreferences {
  hotel: HotelPreferences;
  restaurant: RestaurantPreferences;
  salon: SalonPreferences;
  healthcare: HealthcarePreferences;
  lifestyle: LifestylePreferences;
  corporate: CorporatePreferences;
  // App ecosystem aliases for cross-app compatibility
  stayown: HotelPreferences;
  'rez-consumer': RestaurantPreferences;
  rendez: LifestylePreferences;
  corpspark: CorporatePreferences;
}

// ─── User History Stats ─────────────────────────────────────────────────────────
export interface UserHistoryStats {
  // Counts
  hotelBookings: number;
  restaurantOrders: number;
  salonBookings: number;
  healthcareAppointments: number;
  rendezDates: number;
  corporateBookings: number;

  // Financial
  totalSpent: number;
  avgOrderValue: number;
  totalSavings: number;

  // Engagement
  avgRating: number;
  totalReviews: number;
  lastActiveDate: Date;

  // Loyalty
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  loyaltyPoints: number;
  lifetimeValue: number;

  // Dates
  joinedDate: Date;
  accountAge: number; // days
}

// ─── Universal Signal ───────────────────────────────────────────────────────────
export interface KnowledgeSignal {
  id: string;
  userId: string;
  type: string;
  action: string;
  data: Record<string, unknown>;
  timestamp: Date;
  source: AppEcosystem;
  enrichedData?: {
    intent?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    urgency?: 'low' | 'medium' | 'high';
    category?: string[];
    tags?: string[];
  };
  processedAt?: Date;
}

// ─── API Request/Response Types ────────────────────────────────────────────────
export interface GetProfileResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface UpdatePreferencesRequest {
  app: AppEcosystem;
  preferences: Partial<UnifiedUserPreferences[AppEcosystem]>;
}

export interface UpdatePreferencesResponse {
  success: boolean;
  data?: UnifiedUserPreferences;
  error?: string;
}

export interface AddSignalRequest {
  signal: Omit<KnowledgeSignal, 'id' | 'processedAt'>;
}

export interface AddSignalResponse {
  success: boolean;
  signalId?: string;
  error?: string;
}

export interface GetPersonalizationResponse {
  success: boolean;
  data?: {
    recommendations: {
      hotels?: string[];
      restaurants?: string[];
      salonServices?: string[];
      dates?: string[];
      corporate?: string[];
    };
    insights: {
      spendingPattern?: string;
      preferredTime?: string;
      loyaltyBenefits?: string[];
      nextBestAction?: string;
    };
  };
  error?: string;
}

// ─── App-specific Data Collection ──────────────────────────────────────────────
export interface AppSignalCollector {
  appSource: AppEcosystem;
  collectSignals: (userId: string, since?: Date) => Promise<KnowledgeSignal[]>;
  getPreferences: (userId: string) => Promise<Partial<UnifiedUserPreferences>>;
  updatePreferences: (userId: string, prefs: Partial<UnifiedUserPreferences>) => Promise<void>;
}

// ─── Cross-App Aggregation Request ─────────────────────────────────────────────
export interface AggregateUserDataRequest {
  userId: string;
  apps: AppEcosystem[];
  includeSignals: boolean;
  includePreferences: boolean;
  includeHistory: boolean;
  signalTimeRange?: { start: Date; end: Date };
}

// ─── Legacy Types (Backward Compatibility) ─────────────────────────────────────
export interface Profile {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: string;
}

export interface UserHistory {
  totalBookings?: number;
  totalSpent?: number;
  avgRating?: number;
  loyaltyTier?: string;
  joinedDate?: Date;
  lastActive?: Date;
}

export interface Signal {
  type: string;
  action: string;
  data?: unknown;
  timestamp: Date;
  source: string;
}

export interface AppConfig {
  name: string;
  version: string;
  port: number;
  mongodb: {
    uri: string;
  };
  rezMind: {
    url: string;
    apiKey: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    origins: string[];
  };
}

// Request/Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateUserProfileRequest {
  userId: string;
  profile?: Profile;
}

export interface PersonalizationQuery {
  userId: string;
  apps?: string[];
  includeSignals?: boolean;
}

export interface ConnectedApp {
  id: string;
  name: string;
  lastSync: Date;
  status: 'active' | 'inactive' | 'error';
}

/**
 * Canonical Merchant and Store types for the REZ platform.
 *
 * Source of truth:
 *   rezbackend/src/models/Merchant.ts  (Merchant)
 *   rezbackend/src/models/Store.ts     (Store)
 *
 * Do NOT redefine these types in frontend apps — import from @rez/shared instead.
 */

// ── Merchant Verification Status ──────────────────────────────────────────────

/**
 * Canonical verification status.
 * Note: use 'rejected' — never 'failed'.
 */
export type MerchantVerificationStatus = 'pending' | 'verified' | 'rejected';

// ── Merchant Onboarding ───────────────────────────────────────────────────────

export type OnboardingStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface MerchantBusinessAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  // NOTE: Merchant.businessAddress.coordinates uses object format {latitude, longitude}.
  // This differs from Store.location.coordinates which uses array format [longitude, latitude].
  // Be careful to use the correct format when querying or writing geo data.
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// ── Merchant ──────────────────────────────────────────────────────────────────

export interface Merchant {
  _id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  description?: string;
  logo?: string;
  website?: string;
  businessAddress: MerchantBusinessAddress;
  verificationStatus: MerchantVerificationStatus;
  /**
   * Derived status computed from verificationStatus + isActive.
   * - verificationStatus='rejected' → 'rejected'
   * - verificationStatus='verified' + isActive=true → 'approved'
   * - verificationStatus='verified' + isActive=false → 'suspended'
   * - otherwise → 'pending'
   */
  computedStatus?: 'pending' | 'approved' | 'suspended' | 'rejected';
  isActive: boolean;
  isFeatured?: boolean;
  categories?: string[];
  tags?: string[];
  taxId?: string;
  businessLicense?: string;
  onboarding?: {
    status: OnboardingStatus;
    currentStep: number;
    completedSteps: number[];
  };
  verification?: {
    isVerified?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// ── Store Location ────────────────────────────────────────────────────────────

export interface StoreLocation {
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  coordinates?: [number, number]; // [longitude, latitude]
  deliveryRadius?: number;        // km
  landmark?: string;
}

// ── Store Ratings ─────────────────────────────────────────────────────────────

export interface StoreRatings {
  average: number;
  count: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

// ── Store Service Capabilities ─────────────────────────────────────────────────

export interface StoreServiceCapabilities {
  homeDelivery: {
    enabled: boolean;
    deliveryRadius?: number;
    minOrder?: number;
    deliveryFee?: number;
    freeDeliveryAbove?: number;
    estimatedTime?: string;
  };
  driveThru: {
    enabled: boolean;
    estimatedTime?: string;
    menuType?: 'full' | 'limited';
  };
  tableBooking: {
    enabled: boolean;
  };
  dineIn: {
    enabled: boolean;
  };
  storePickup: {
    enabled: boolean;
    estimatedTime?: string;
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export interface Store {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  image?: string;
  banner?: string[];
  category: string;            // Category ObjectId as string
  location: StoreLocation;
  ratings: StoreRatings;
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  /**
   * MongoDB ObjectId serialized as a 24-character hex string in JSON responses.
   * Always call `.populate('merchantId')` in backend queries before returning to clients.
   */
  merchantId?: string;
  /**
   * Cross-service alias for `merchantId` — used by `rez-merchant-service` when
   * writing to the shared `stores` collection. Both fields are kept in sync by
   * a pre-save hook on the backend Store model.
   */
  merchant?: string;
  serviceCapabilities?: StoreServiceCapabilities;

  // Booking type configuration
  bookingType?: 'RESTAURANT' | 'SERVICE' | 'CONSULTATION' | 'RETAIL' | 'HYBRID';

  // Cashback / reward config
  offers?: {
    cashback?: number;
    minOrderAmount?: number;
    maxCashback?: number;
    isPartner?: boolean;
    partnerLevel?: 'bronze' | 'silver' | 'gold' | 'platinum';
  };

  // Convenience flags
  hasMenu?: boolean;
  is60MinDelivery?: boolean;
  hasStorePickup?: boolean;
  priceForTwo?: number;

  createdAt: string;
  updatedAt: string;
}

// ── MerchantLoyaltyConfig ─────────────────────────────────────────────────────

/**
 * Canonical MerchantLoyaltyConfig type for the REZ platform.
 *
 * Canonical schema source: rezbackend/rez-backend-master/src/models/MerchantLoyaltyConfig.ts
 * Mirror (must stay in sync): rez-merchant-service/src/models/MerchantLoyaltyConfig.ts
 *
 * pointsPerRupee: how many points a customer earns per ₹1 spent (default 0.1 = 1 pt per ₹10)
 * expiryDays: how long points remain valid after being earned (default 365)
 * bonusCategories: service category slugs that earn 2x points
 */
export interface MerchantLoyaltyConfig {
  _id: string;
  storeId: string;        // Store ObjectId as string
  merchantId: string;     // Merchant ObjectId as string
  pointsPerRupee: number;
  expiryDays: number;
  bonusCategories: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isMerchantVerificationStatus(
  value: string,
): value is MerchantVerificationStatus {
  return ['pending', 'verified', 'rejected'].includes(value);
}

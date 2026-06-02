/**
 * Canonical Offer types for the REZ platform.
 *
 * Source of truth: rezbackend/src/models/Offer.ts
 * Do NOT redefine these types in frontend apps — import from @rez/shared instead.
 */

// ── Offer Category ────────────────────────────────────────────────────────────

export const OFFER_CATEGORIES = [
  'mega',
  'student',
  'new_arrival',
  'trending',
  'food',
  'fashion',
  'electronics',
  'general',
  'entertainment',
  'beauty',
  'wellness',
] as const;

export type OfferCategory = (typeof OFFER_CATEGORIES)[number];

// ── Offer Type ────────────────────────────────────────────────────────────────

export type OfferType =
  | 'cashback'
  | 'discount'
  | 'voucher'
  | 'combo'
  | 'special'
  | 'walk_in';

// ── Offer Store Reference ─────────────────────────────────────────────────────

export interface OfferStoreRef {
  id: string;           // Store ObjectId as string — canonical field name
  name: string;
  logo?: string;
  rating?: number;
  verified?: boolean;
}

// ── Offer Validity ────────────────────────────────────────────────────────────

export interface OfferValidity {
  startDate: string;    // ISO date string
  endDate: string;      // ISO date string
  isActive: boolean;
}

// ── Offer Restrictions ────────────────────────────────────────────────────────

export interface OfferRestrictions {
  minOrderValue?: number;
  maxDiscountAmount?: number;
  applicableOn?: string[];
  usageLimitPerUser?: number;
  usageLimit?: number;
  userTypeRestriction?: 'student' | 'new_user' | 'premium' | 'all';
  ageRestriction?: {
    minAge?: number;
    maxAge?: number;
  };
  /** Product IDs excluded from this offer — products that should NOT qualify even if other conditions are met */
  excludedProducts?: string[];
}

// ── Offer Engagement ─────────────────────────────────────────────────────────

export interface OfferEngagement {
  likesCount: number;
  sharesCount: number;
  viewsCount: number;
  isLikedByUser?: boolean;  // Computed dynamically per-user
}

// ── Offer Eligibility ─────────────────────────────────────────────────────────

export interface OfferEligibility {
  rezPlusTiers: ('free' | 'premium' | 'vip')[];
  /** @deprecated use rezPlusTiers */
  nuqtaPlusTiers?: ('free' | 'premium' | 'vip')[];
  priveTiers: ('none' | 'entry' | 'signature' | 'elite')[];
  requiredZones: string[];
  requireAll: boolean;
}

// ── Main Offer type ───────────────────────────────────────────────────────────

export interface Offer {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  category: OfferCategory;
  type: OfferType;
  /**
   * Canonical field name: cashbackPercentage (lowercase 'b').
   * Backend model and all frontends must use this spelling.
   */
  cashbackPercentage: number;
  originalPrice?: number;
  discountedPrice?: number;

  /** GeoJSON point */
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };

  /** Distance from user — calculated dynamically; not stored */
  distance?: number;

  store: OfferStoreRef;
  validity: OfferValidity;
  restrictions: OfferRestrictions;
  engagement: OfferEngagement;
  eligibility?: OfferEligibility;

  // Visibility
  visibleTo: 'all' | 'followers' | 'premium';
  isFollowerExclusive: boolean;
  exclusiveUntil?: string;

  // Delivery
  isFreeDelivery: boolean;
  deliveryFee?: number;
  deliveryTime?: string;

  // Exclusive zone
  exclusiveZone?:
    | 'corporate'
    | 'women'
    | 'birthday'
    | 'student'
    | 'senior'
    | 'defence'
    | 'healthcare'
    | 'teacher'
    | 'government'
    | 'differently-abled'
    | 'first-time';

  redemptionCount: number;

  /**
   * Virtual field — not stored in DB.
   * Computed from validity.isActive + adminApproved on the backend before serialization.
   */
  status?: 'active' | 'inactive' | 'pending_approval' | 'rejected';

  /** User ID of the admin/merchant who created this offer */
  createdBy: string;

  createdAt: string;
  updatedAt: string;
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isOfferCategory(value: string): value is OfferCategory {
  return (OFFER_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Canonical API Response Contracts
 *
 * These schemas define the canonical request/response shapes for all client-server communication.
 * All four codebases (consumer, merchant, admin, backend) must conform to these schemas.
 *
 * Generated from unified audit: Phase 3 API contract alignment (2026-04-15)
 * Bug IDs: CA-API-*, MA-API-*, AA-API-*
 */

import { z } from 'zod';

/**
 * Canonical API Response Wrapper
 * All endpoints must return responses conforming to this shape
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

// Note: ApiResponse type already exists in types/api.ts
// Schema-inferred type is intentionally not exported to avoid conflicts

/**
 * User Profile Contract
 * Used by: GET /user/auth/me, PATCH /user/auth/profile
 */
export const userProfileSchema = z.object({
  id: z.string(),
  _id: z.string().optional(), // MongoDB ObjectId — may be present on legacy responses
  phoneNumber: z.string(),
  email: z.string().email().optional(),
  profile: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    avatar: z.string().optional(),
    bio: z.string().optional(),
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    location: z.object({
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      coordinates: z.tuple([z.number(), z.number()]).optional(),
    }).optional(),
  }).optional(),
  preferences: z.object({
    language: z.string().optional(),
    currency: z.string().optional(),
    theme: z.enum(['light', 'dark']).optional(),
    notifications: z.object({
      push: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
    }).optional(),
  }).optional(),
  statedIdentity: z.string().optional(),
  featureLevel: z.number().optional(),
  segment: z.string().optional(),
  verificationSegment: z.string().optional(),
  verifications: z.record(z.unknown()).optional(),
  activeZones: z.array(z.string()).optional(),
  role: z.enum(['user', 'admin', 'merchant', 'customer', 'driver', 'support', 'manager', 'owner']),
  isVerified: z.boolean(),
  isOnboarded: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Note: UserProfile type already exists in types/user.types.ts
// Schema-inferred type is intentionally not exported to avoid conflicts

/**
 * Profile Update Request
 * Used by: PATCH /user/auth/profile
 * Method: PATCH (not PUT) — servers must use PATCH only
 */
export const profileUpdateSchema = z.object({
  profile: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    avatar: z.string().optional(),
    bio: z.string().optional(),
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    location: z.object({
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      coordinates: z.tuple([z.number(), z.number()]).optional(),
    }).optional(),
  }).optional(),
  preferences: z.object({
    language: z.string().optional(),
    currency: z.string().optional(),
    theme: z.enum(['light', 'dark']).optional(),
    notifications: z.object({
      push: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
    }).optional(),
  }).optional(),
  statedIdentity: z.string().optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

/**
 * Payment Method Type
 * Used across consumer, merchant payment endpoints
 */
export const paymentMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['upi', 'card', 'wallet', 'netbanking']),
  gateway: z.string(), // 'razorpay' | 'paypal' | 'internal'
  icon: z.string().optional(),
  isAvailable: z.boolean(),
  processingFee: z.number().optional(),
  processingTime: z.string().optional(),
  description: z.string().optional(),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Payment Request Contract
 * All payment endpoints must accept and validate this shape
 * Amount field must be validated on server (client-computed amounts are advisory)
 */
export const paymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
  paymentMethod: z.enum(['razorpay', 'paypal', 'internal', 'wallet']),
  paymentMethodType: z.enum(['card', 'upi', 'wallet', 'netbanking', 'rezcoins']),
  purpose: z.enum([
    'wallet_topup',
    'order_payment',
    'event_booking',
    'financial_service',
    'other'
  ]).optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key'),
  metadata: z.record(z.unknown()).optional(),
});

export type PaymentRequest = z.infer<typeof paymentRequestSchema>;

/**
 * Gateway Response Contract
 * Returned by payment gateways (Razorpay, PayPal, etc.)
 * Clients must not assume additional fields
 */
export const gatewayResponseSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  transactionId: z.string().optional(),
  authCode: z.string().optional(),
  rrn: z.string().optional(),
});

export type GatewayResponse = z.infer<typeof gatewayResponseSchema>;

/**
 * Payment Response Contract
 * Returned by: POST /wallet/payment, POST /order/payment, etc.
 */
export const paymentResponseSchema = z.object({
  paymentId: z.string(),
  orderId: z.string().optional(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  gateway: z.string(),
  paymentUrl: z.string().optional(),
  qrCode: z.string().optional(),
  upiId: z.string().optional(),
  expiryTime: z.string().optional(),
  transactionId: z.string().optional(),
  gatewayResponse: gatewayResponseSchema.optional(),
});

export type PaymentResponse = z.infer<typeof paymentResponseSchema>;

/**
 * Error Response Contract
 * All error responses must use this shape
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Pagination Metadata
 * Used in list responses
 */
export const paginationSchema = z.object({
  page: z.number().positive(),
  limit: z.number().positive().max(100, 'Limit must not exceed 100'),
  total: z.number().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

// Note: Pagination type already exists in types/api.ts
// Schema-inferred type is intentionally not exported to avoid conflicts

/**
 * Generic Paginated Response
 * Used for list endpoints across all services
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(schema),
    pagination: paginationSchema,
  });

/**
 * Admin Auth Response Contract
 * Returned by: POST /admin/auth/login
 */
export const adminAuthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string(),
    refreshToken: z.string().optional(),
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
      role: z.enum(['admin', 'super_admin', 'support']),
      permissions: z.array(z.string()).optional(),
    }),
  }),
});

export type AdminAuthResponse = z.infer<typeof adminAuthResponseSchema>;

/**
 * Idempotency Key Contract
 * Required on all mutating endpoints (POST, PATCH, DELETE on money/order/wallet endpoints)
 * Backend stores key for 24h minimum; returns same response on retry
 */
export const idempotencyKeyHeaderSchema = z.object({
  'Idempotency-Key': z.string().uuid('Invalid idempotency key UUID format'),
});

/**
 * Gamification Streak Contract
 * Used by: GET /gamification/streak, GET /gamification/streaks
 * Returns user's current or historical streak data for loyalty tracking
 */
export const streakSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['purchase', 'visit', 'referral', 'engagement']),
  current: z.number().nonnegative(),
  longest: z.number().nonnegative(),
  lastActivityAt: z.string().datetime(),
  nextMilestoneAt: z.string().datetime().optional(),
  rewards: z.object({
    pointsPerDay: z.number().nonnegative(),
    bonusAt: z.array(z.number()).optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Streak = z.infer<typeof streakSchema>;

/**
 * Coupon/Discount Contract
 * Used by: GET /coupons/{id}, GET /coupons, POST /coupons/apply
 * Represents available coupons and discount codes
 */
export const couponSchema = z.object({
  id: z.string(),
  code: z.string().toUpperCase(),
  type: z.enum(['percentage', 'fixed', 'bogo', 'freeshipping']),
  value: z.number().positive(),
  currency: z.string().default('INR'),
  description: z.string().optional(),
  minPurchaseAmount: z.number().nonnegative().optional(),
  maxDiscount: z.number().nonnegative().optional(),
  usageLimit: z.number().positive().optional(),
  usageCount: z.number().nonnegative(),
  userUsageLimit: z.number().positive().optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  applicableCategories: z.array(z.string()).optional(),
  excludedCategories: z.array(z.string()).optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Coupon = z.infer<typeof couponSchema>;

/**
 * Coupon Application Request
 * Used by: POST /coupons/apply
 * Applies a coupon code to a cart/order and returns discount breakdown
 */
export const couponApplySchema = z.object({
  code: z.string().toUpperCase(),
  cartTotal: z.number().positive(),
  items: z.array(z.object({
    id: z.string(),
    price: z.number().positive(),
    quantity: z.number().positive(),
    category: z.string(),
  })).optional(),
});

export type CouponApply = z.infer<typeof couponApplySchema>;

/**
 * Coupon Application Response
 * Returned by: POST /coupons/apply
 * Contains coupon validity and discount details
 */
export const couponApplicationResponseSchema = z.object({
  success: z.boolean(),
  couponId: z.string().optional(),
  code: z.string().optional(),
  isValid: z.boolean(),
  discountAmount: z.number().nonnegative(),
  discountPercentage: z.number().nonnegative().max(100).optional(),
  newTotal: z.number().nonnegative(),
  savings: z.number().nonnegative(),
  message: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export type CouponApplicationResponse = z.infer<typeof couponApplicationResponseSchema>;

/**
 * Referral Contract
 * Used by: GET /referrals/me, GET /referrals/code, POST /referrals/send
 * Tracks user's referral code, referred users, and rewards
 */
export const referralSchema = z.object({
  id: z.string(),
  userId: z.string(),
  referralCode: z.string().toUpperCase(),
  referrerName: z.string().optional(),
  totalReferred: z.number().nonnegative(),
  successfulReferrals: z.number().nonnegative(),
  pendingReferrals: z.number().nonnegative(),
  totalEarnings: z.number().nonnegative(),
  rewardsPerReferral: z.number().nonnegative(),
  referredUsers: z.array(z.object({
    userId: z.string(),
    name: z.string().optional(),
    email: z.string().email(),
    signupDate: z.string().datetime(),
    status: z.enum(['pending', 'completed', 'cancelled']),
    earnings: z.number().nonnegative(),
  })).optional(),
  shareUrl: z.string().url().optional(),
  termsAccepted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Referral = z.infer<typeof referralSchema>;

/**
 * Notification Contract
 * Used by: GET /notifications, GET /notifications/{id}, POST /notifications/mark-read
 * Represents user notifications across all channels
 */
export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum([
    'order_status',
    'payment_received',
    'promotion',
    'system_alert',
    'delivery_update',
    'referral_success',
    'gamification_milestone'
  ]),
  channel: z.enum(['push', 'email', 'sms', 'in_app']),
  title: z.string(),
  message: z.string(),
  icon: z.string().optional(),
  actionUrl: z.string().url().optional(),
  actionLabel: z.string().optional(),
  read: z.boolean(),
  archived: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  sentAt: z.string().datetime(),
  readAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof notificationSchema>;

/**
 * Campaign Contract
 * Used by: GET /campaigns, GET /campaigns/{id}, GET /campaigns/active
 * Represents marketing/promotional campaigns available to users
 */
export const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['seasonal', 'flash_sale', 'loyalty', 'referral', 'first_purchase']),
  bannerUrl: z.string().url().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean(),
  targetSegments: z.array(z.string()).optional(),
  eligibilityRules: z.object({
    minPurchaseAmount: z.number().nonnegative().optional(),
    maxDiscount: z.number().nonnegative().optional(),
    applicableCategories: z.array(z.string()).optional(),
    excludedCategories: z.array(z.string()).optional(),
    firstTimeUsersOnly: z.boolean().optional(),
  }).optional(),
  rewards: z.object({
    points: z.number().nonnegative().optional(),
    cashback: z.number().nonnegative().optional(),
    discount: z.number().nonnegative().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Campaign = z.infer<typeof campaignSchema>;

/**
 * Search Request Contract
 * Used by: GET /search, GET /search/autocomplete
 * Standardized search parameters across all services
 */
export const searchRequestSchema = z.object({
  query: z.string().min(1).max(200),
  type: z.enum(['product', 'merchant', 'category', 'all']).optional(),
  limit: z.number().positive().max(50).default(20),
  offset: z.number().nonnegative().default(0),
  filters: z.object({
    category: z.array(z.string()).optional(),
    priceRange: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).optional(),
    rating: z.number().min(0).max(5).optional(),
    inStock: z.boolean().optional(),
    sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'newest']).optional(),
  }).optional(),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

/**
 * Search Result Contract
 * Returned by: GET /search
 * Contains unified search results from all indexes
 */
export const searchResultItemSchema = z.object({
  id: z.string(),
  type: z.enum(['product', 'merchant', 'category']),
  name: z.string(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().max(100).optional(),
  inStock: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SearchResultItem = z.infer<typeof searchResultItemSchema>;

/**
 * Autocomplete Result Contract
 * Returned by: GET /search/autocomplete
 * Lightweight suggestions for search-as-you-type
 */
export const autocompleteResultSchema = z.object({
  success: z.literal(true),
  suggestions: z.array(z.object({
    text: z.string(),
    type: z.enum(['recent', 'trending', 'popular', 'category']),
    metadata: z.record(z.unknown()).optional(),
  })),
});

export type AutocompleteResult = z.infer<typeof autocompleteResultSchema>;

/**
 * Validation helper: Ensure API response conforms to contract
 */
export function validateApiResponse<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; error?: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

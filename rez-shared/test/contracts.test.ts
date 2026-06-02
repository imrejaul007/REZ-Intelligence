/**
 * API Contract Validation Test Suite
 *
 * Validates that all API endpoint schemas correctly accept canonical fixtures
 * and reject invalid payloads. This suite prevents schema-vs-code drift in CI.
 *
 * Run with: npm test
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  apiResponseSchema,
  userProfileSchema,
  profileUpdateSchema,
  paymentMethodSchema,
  paymentRequestSchema,
  paymentResponseSchema,
  errorResponseSchema,
  paginationSchema,
  paginatedResponseSchema,
  adminAuthResponseSchema,
  streakSchema,
  couponSchema,
  couponApplySchema,
  couponApplicationResponseSchema,
  referralSchema,
  notificationSchema,
  campaignSchema,
  searchRequestSchema,
  searchResultItemSchema,
  autocompleteResultSchema,
  validateApiResponse,
} from '../dist/schemas/apiContracts.js';

/**
 * Canonical fixtures for testing
 */
const fixtures = {
  // Basic API response
  apiResponse: {
    success: true,
    data: { id: '123', name: 'Test' },
    message: 'Success',
  },

  // User profile
  userProfile: {
    id: 'user-123',
    phoneNumber: '+919876543210',
    email: 'user@example.com',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      avatar: 'https://example.com/avatar.jpg',
      bio: 'Software engineer',
      dateOfBirth: '1990-01-15T00:00:00Z',
      gender: 'male',
      location: {
        address: '123 Main St',
        city: 'Bangalore',
        state: 'KA',
        pincode: '560001',
        coordinates: [13.0827, 80.2707],
      },
    },
    preferences: {
      language: 'en',
      currency: 'INR',
      theme: 'dark',
      notifications: {
        push: true,
        email: true,
        sms: false,
      },
    },
    role: 'user',
    isVerified: true,
    isOnboarded: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-04-15T12:00:00Z',
  },

  // Profile update
  profileUpdate: {
    profile: {
      firstName: 'Jane',
      lastName: 'Smith',
    },
    preferences: {
      theme: 'light',
      notifications: {
        push: false,
      },
    },
  },

  // Payment method
  paymentMethod: {
    id: 'pm-123',
    name: 'Mastercard',
    type: 'card',
    gateway: 'razorpay',
    icon: 'https://example.com/card.png',
    isAvailable: true,
    processingFee: 2.5,
    processingTime: '5-10 minutes',
    description: 'Instant card payment',
  },

  // Payment request
  paymentRequest: {
    amount: 1000,
    currency: 'INR',
    paymentMethod: 'razorpay',
    paymentMethodType: 'card',
    purpose: 'order_payment',
    idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    metadata: { orderId: 'ORD-123' },
  },

  // Payment response
  paymentResponse: {
    paymentId: 'pay-123',
    orderId: 'ord-456',
    amount: 1000,
    currency: 'INR',
    status: 'completed',
    gateway: 'razorpay',
    paymentUrl: 'https://razorpay.com/pay/123',
    transactionId: 'txn-789',
  },

  // Error response
  errorResponse: {
    success: false,
    message: 'Validation failed',
    error: 'Invalid payment amount',
    errorCode: 'INVALID_AMOUNT',
    details: { field: 'amount', reason: 'must be positive' },
  },

  // Pagination
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    hasNext: true,
    hasPrev: false,
  },

  // Admin auth response
  adminAuthResponse: {
    success: true,
    data: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      user: {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        permissions: ['read:orders', 'write:orders'],
      },
    },
  },

  // Streak
  streak: {
    id: 'streak-123',
    userId: 'user-123',
    type: 'purchase',
    current: 7,
    longest: 30,
    lastActivityAt: '2025-04-15T10:00:00Z',
    nextMilestoneAt: '2025-04-22T00:00:00Z',
    rewards: {
      pointsPerDay: 10,
      bonusAt: [7, 14, 30],
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-04-15T12:00:00Z',
  },

  // Coupon
  coupon: {
    id: 'coupon-123',
    code: 'SAVE20',
    type: 'percentage',
    value: 20,
    currency: 'INR',
    description: 'Save 20% on all orders',
    minPurchaseAmount: 500,
    maxDiscount: 500,
    usageLimit: 1000,
    usageCount: 245,
    userUsageLimit: 1,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2025-12-31T23:59:59Z',
    applicableCategories: ['groceries', 'electronics'],
    excludedCategories: ['alcohol'],
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-04-15T12:00:00Z',
  },

  // Coupon apply request
  couponApply: {
    code: 'SAVE20',
    cartTotal: 2000,
    items: [
      {
        id: 'item-1',
        price: 1000,
        quantity: 1,
        category: 'groceries',
      },
      {
        id: 'item-2',
        price: 1000,
        quantity: 1,
        category: 'electronics',
      },
    ],
  },

  // Coupon application response
  couponApplicationResponse: {
    success: true,
    couponId: 'coupon-123',
    code: 'SAVE20',
    isValid: true,
    discountAmount: 400,
    discountPercentage: 20,
    newTotal: 1600,
    savings: 400,
    message: 'Coupon applied successfully',
  },

  // Referral
  referral: {
    id: 'ref-123',
    userId: 'user-123',
    referralCode: 'REF12345',
    referrerName: 'John Doe',
    totalReferred: 5,
    successfulReferrals: 3,
    pendingReferrals: 2,
    totalEarnings: 1500,
    rewardsPerReferral: 300,
    referredUsers: [
      {
        userId: 'user-456',
        name: 'Jane Smith',
        email: 'jane@example.com',
        signupDate: '2025-04-01T00:00:00Z',
        status: 'completed',
        earnings: 300,
      },
    ],
    shareUrl: 'https://example.com/ref/REF12345',
    termsAccepted: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-04-15T12:00:00Z',
  },

  // Notification
  notification: {
    id: 'notif-123',
    userId: 'user-123',
    type: 'order_status',
    channel: 'push',
    title: 'Order Shipped',
    message: 'Your order #ORD-123 has been shipped',
    icon: 'https://example.com/shipped.png',
    actionUrl: 'https://example.com/orders/ORD-123',
    actionLabel: 'View Order',
    read: false,
    archived: false,
    metadata: { orderId: 'ORD-123', trackingId: 'TRK-789' },
    sentAt: '2025-04-15T10:00:00Z',
    readAt: '2025-04-15T10:05:00Z',
    createdAt: '2025-04-15T10:00:00Z',
  },

  // Campaign
  campaign: {
    id: 'camp-123',
    name: 'Summer Sale 2025',
    description: 'Biggest sale of the season',
    type: 'seasonal',
    bannerUrl: 'https://example.com/banner.jpg',
    startDate: '2025-06-01T00:00:00Z',
    endDate: '2025-06-30T23:59:59Z',
    isActive: true,
    targetSegments: ['new_users', 'high_spenders'],
    eligibilityRules: {
      minPurchaseAmount: 100,
      maxDiscount: 1000,
      applicableCategories: ['all'],
      firstTimeUsersOnly: false,
    },
    rewards: {
      points: 100,
      cashback: 50,
      discount: 200,
    },
    metadata: { campaign_source: 'summer_event' },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-04-15T12:00:00Z',
  },

  // Search request
  searchRequest: {
    query: 'pizza',
    type: 'product',
    limit: 20,
    offset: 0,
    filters: {
      category: ['fast_food'],
      priceRange: [100, 500],
      rating: 4,
      inStock: true,
      sortBy: 'relevance',
    },
  },

  // Search result item
  searchResultItem: {
    id: 'prod-123',
    type: 'product',
    name: 'Margherita Pizza',
    description: 'Fresh mozzarella and basil',
    image: 'https://example.com/pizza.jpg',
    rating: 4.5,
    reviewCount: 156,
    price: 299,
    discount: 10,
    inStock: true,
    metadata: { restaurant: 'Pizza Hut' },
  },

  // Autocomplete result
  autocompleteResult: {
    success: true,
    suggestions: [
      {
        text: 'pizza',
        type: 'trending',
        metadata: { count: 1000 },
      },
      {
        text: 'pizza delivery',
        type: 'popular',
        metadata: { count: 800 },
      },
      {
        text: 'Pizza Hut',
        type: 'category',
        metadata: { type: 'merchant' },
      },
    ],
  },
};

describe('API Contract Validation Tests', () => {
  describe('Core API Response Contracts', () => {
    it('validates basic API response', () => {
      const result = apiResponseSchema.safeParse(fixtures.apiResponse);
      assert.strictEqual(result.success, true);
    });

    it('rejects API response with invalid success type', () => {
      const invalid = { ...fixtures.apiResponse, success: 'true' };
      const result = apiResponseSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('validates error response', () => {
      const result = errorResponseSchema.safeParse(fixtures.errorResponse);
      assert.strictEqual(result.success, true);
    });

    it('validates pagination', () => {
      const result = paginationSchema.safeParse(fixtures.pagination);
      assert.strictEqual(result.success, true);
    });

    it('rejects pagination with negative total', () => {
      const invalid = { ...fixtures.pagination, total: -1 };
      const result = paginationSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('User Profile Contracts', () => {
    it('validates complete user profile', () => {
      const result = userProfileSchema.safeParse(fixtures.userProfile);
      assert.strictEqual(result.success, true);
    });

    it('validates minimal user profile', () => {
      const minimal = {
        id: 'user-123',
        phoneNumber: '+919876543210',
        role: 'user',
        isVerified: true,
        isOnboarded: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-04-15T12:00:00Z',
      };
      const result = userProfileSchema.safeParse(minimal);
      assert.strictEqual(result.success, true);
    });

    it('rejects profile with invalid email', () => {
      const invalid = { ...fixtures.userProfile, email: 'invalid-email' };
      const result = userProfileSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('rejects profile with invalid role', () => {
      const invalid = { ...fixtures.userProfile, role: 'superuser' };
      const result = userProfileSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('validates profile update', () => {
      const result = profileUpdateSchema.safeParse(fixtures.profileUpdate);
      assert.strictEqual(result.success, true);
    });
  });

  describe('Payment Contracts', () => {
    it('validates payment method', () => {
      const result = paymentMethodSchema.safeParse(fixtures.paymentMethod);
      assert.strictEqual(result.success, true);
    });

    it('validates payment request', () => {
      const result = paymentRequestSchema.safeParse(fixtures.paymentRequest);
      assert.strictEqual(result.success, true);
    });

    it('rejects payment request with negative amount', () => {
      const invalid = { ...fixtures.paymentRequest, amount: -100 };
      const result = paymentRequestSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('rejects payment request with invalid idempotency key', () => {
      const invalid = { ...fixtures.paymentRequest, idempotencyKey: 'not-a-uuid' };
      const result = paymentRequestSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('validates payment response', () => {
      const result = paymentResponseSchema.safeParse(fixtures.paymentResponse);
      assert.strictEqual(result.success, true);
    });

    it('rejects payment response with invalid status', () => {
      const invalid = { ...fixtures.paymentResponse, status: 'unknown' };
      const result = paymentResponseSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Admin Auth Contracts', () => {
    it('validates admin auth response', () => {
      const result = adminAuthResponseSchema.safeParse(fixtures.adminAuthResponse);
      assert.strictEqual(result.success, true);
    });

    it('rejects auth response with invalid email', () => {
      const invalid = {
        ...fixtures.adminAuthResponse,
        data: {
          ...fixtures.adminAuthResponse.data,
          user: {
            ...fixtures.adminAuthResponse.data.user,
            email: 'invalid-email',
          },
        },
      };
      const result = adminAuthResponseSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Gamification Streak Contracts', () => {
    it('validates streak with all fields', () => {
      const result = streakSchema.safeParse(fixtures.streak);
      assert.strictEqual(result.success, true);
    });

    it('validates minimal streak', () => {
      const minimal = {
        id: 'streak-123',
        userId: 'user-123',
        type: 'purchase',
        current: 0,
        longest: 5,
        lastActivityAt: '2025-04-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-04-15T12:00:00Z',
      };
      const result = streakSchema.safeParse(minimal);
      assert.strictEqual(result.success, true);
    });

    it('rejects streak with invalid type', () => {
      const invalid = { ...fixtures.streak, type: 'invalid' };
      const result = streakSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('rejects streak with negative current', () => {
      const invalid = { ...fixtures.streak, current: -1 };
      const result = streakSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Coupon Contracts', () => {
    it('validates complete coupon', () => {
      const result = couponSchema.safeParse(fixtures.coupon);
      assert.strictEqual(result.success, true);
    });

    it('rejects coupon with negative value', () => {
      const invalid = { ...fixtures.coupon, value: -20 };
      const result = couponSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('validates coupon apply request', () => {
      const result = couponApplySchema.safeParse(fixtures.couponApply);
      assert.strictEqual(result.success, true);
    });

    it('rejects coupon apply with zero cart total', () => {
      const invalid = { ...fixtures.couponApply, cartTotal: 0 };
      const result = couponApplySchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('validates coupon application response', () => {
      const result = couponApplicationResponseSchema.safeParse(fixtures.couponApplicationResponse);
      assert.strictEqual(result.success, true);
    });

    it('rejects application response with discount > 100%', () => {
      const invalid = { ...fixtures.couponApplicationResponse, discountPercentage: 150 };
      const result = couponApplicationResponseSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Referral Contracts', () => {
    it('validates complete referral', () => {
      const result = referralSchema.safeParse(fixtures.referral);
      assert.strictEqual(result.success, true);
    });

    it('validates minimal referral', () => {
      const minimal = {
        id: 'ref-123',
        userId: 'user-123',
        referralCode: 'REF12345',
        totalReferred: 0,
        successfulReferrals: 0,
        pendingReferrals: 0,
        totalEarnings: 0,
        rewardsPerReferral: 100,
        termsAccepted: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-04-15T12:00:00Z',
      };
      const result = referralSchema.safeParse(minimal);
      assert.strictEqual(result.success, true);
    });

    it('rejects referral with negative earnings', () => {
      const invalid = { ...fixtures.referral, totalEarnings: -100 };
      const result = referralSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Notification Contracts', () => {
    it('validates complete notification', () => {
      const result = notificationSchema.safeParse(fixtures.notification);
      assert.strictEqual(result.success, true);
    });

    it('validates minimal notification', () => {
      const minimal = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'system_alert',
        channel: 'in_app',
        title: 'Alert',
        message: 'Important notice',
        read: false,
        sentAt: '2025-04-15T10:00:00Z',
        createdAt: '2025-04-15T10:00:00Z',
      };
      const result = notificationSchema.safeParse(minimal);
      assert.strictEqual(result.success, true);
    });

    it('rejects notification with invalid type', () => {
      const invalid = { ...fixtures.notification, type: 'invalid_type' };
      const result = notificationSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('rejects notification with invalid channel', () => {
      const invalid = { ...fixtures.notification, channel: 'telegram' };
      const result = notificationSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Campaign Contracts', () => {
    it('validates complete campaign', () => {
      const result = campaignSchema.safeParse(fixtures.campaign);
      assert.strictEqual(result.success, true);
    });

    it('validates minimal campaign', () => {
      const minimal = {
        id: 'camp-123',
        name: 'Summer Sale',
        type: 'flash_sale',
        startDate: '2025-06-01T00:00:00Z',
        endDate: '2025-06-30T23:59:59Z',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-04-15T12:00:00Z',
      };
      const result = campaignSchema.safeParse(minimal);
      assert.strictEqual(result.success, true);
    });

    it('rejects campaign with invalid type', () => {
      const invalid = { ...fixtures.campaign, type: 'unknown' };
      const result = campaignSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Search Contracts', () => {
    it('validates search request', () => {
      const result = searchRequestSchema.safeParse(fixtures.searchRequest);
      assert.strictEqual(result.success, true);
    });

    it('validates minimal search request', () => {
      const minimal = { query: 'pizza' };
      const result = searchRequestSchema.safeParse(minimal);
      assert.strictEqual(result.success, true);
    });

    it('rejects search with empty query', () => {
      const invalid = { query: '' };
      const result = searchRequestSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('rejects search with query over 200 chars', () => {
      const invalid = { query: 'a'.repeat(201) };
      const result = searchRequestSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('rejects search with limit over 50', () => {
      const invalid = { query: 'pizza', limit: 100 };
      const result = searchRequestSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('validates search result item', () => {
      const result = searchResultItemSchema.safeParse(fixtures.searchResultItem);
      assert.strictEqual(result.success, true);
    });

    it('rejects result with rating over 5', () => {
      const invalid = { ...fixtures.searchResultItem, rating: 5.5 };
      const result = searchResultItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it('validates autocomplete result', () => {
      const result = autocompleteResultSchema.safeParse(fixtures.autocompleteResult);
      assert.strictEqual(result.success, true);
    });

    it('rejects autocomplete with invalid suggestion type', () => {
      const invalid = {
        success: true,
        suggestions: [
          { text: 'pizza', type: 'invalid_type' },
        ],
      };
      const result = autocompleteResultSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Validation Helper Function', () => {
    it('validates correct schema and returns data', () => {
      const result = validateApiResponse(userProfileSchema, fixtures.userProfile);
      assert.strictEqual(result.success, true);
      assert.ok(result.data);
    });

    it('rejects invalid schema and returns error', () => {
      const invalid = { ...fixtures.userProfile, email: 'invalid' };
      const result = validateApiResponse(userProfileSchema, invalid);
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('Paginated Response Helper', () => {
    it('validates paginated array response', () => {
      const schema = paginatedResponseSchema(userProfileSchema);
      const response = {
        success: true,
        data: [fixtures.userProfile],
        pagination: fixtures.pagination,
      };
      const result = schema.safeParse(response);
      assert.strictEqual(result.success, true);
    });

    it('rejects paginated response with invalid items', () => {
      const schema = paginatedResponseSchema(userProfileSchema);
      const response = {
        success: true,
        data: [{ id: 'user-123' }], // missing required fields
        pagination: fixtures.pagination,
      };
      const result = schema.safeParse(response);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Cross-Contract Compatibility', () => {
    it('payment request can be validated through generic helper', () => {
      const result = validateApiResponse(paymentRequestSchema, fixtures.paymentRequest);
      assert.strictEqual(result.success, true);
    });

    it('coupon apply request can be validated through generic helper', () => {
      const result = validateApiResponse(couponApplySchema, fixtures.couponApply);
      assert.strictEqual(result.success, true);
    });

    it('search request defaults work correctly', () => {
      const minimal = { query: 'pizza' };
      const result = searchRequestSchema.safeParse(minimal);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.limit, 20);
        assert.strictEqual(result.data.offset, 0);
      }
    });
  });
});

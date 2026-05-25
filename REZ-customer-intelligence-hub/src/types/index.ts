import { z } from 'zod';

// Unified Profile Types
export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export type Address = z.infer<typeof AddressSchema>;

export const UnifiedProfileSchema = z.object({
  userId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  avatar: z.string().url().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  addresses: z.array(AddressSchema).optional(),
  preferences: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UnifiedProfile = z.infer<typeof UnifiedProfileSchema>;

// Order Types
export const OrderItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  sku: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSummarySchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  totalSpend: z.number().nonnegative(),
  averageOrderValue: z.number().nonnegative(),
  lastOrderDate: z.string().datetime().optional(),
  firstOrderDate: z.string().datetime().optional(),
  recentOrders: z.array(z.object({
    orderId: z.string(),
    status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
    total: z.number().nonnegative(),
    itemCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
  })).optional(),
});

export type OrderSummary = z.infer<typeof OrderSummarySchema>;

// Payment Types
export const PaymentSummarySchema = z.object({
  totalPayments: z.number().int().nonnegative(),
  totalAmount: z.number().nonnegative(),
  successfulPayments: z.number().int().nonnegative(),
  failedPayments: z.number().int().nonnegative(),
  pendingPayments: z.number().int().nonnegative(),
  lastPaymentDate: z.string().datetime().optional(),
  preferredPaymentMethod: z.string().optional(),
  hasOutstandingBalance: z.boolean().optional(),
  creditLimit: z.number().nonnegative().optional(),
  usedCredit: z.number().nonnegative().optional(),
});

export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

// Review Types
export const ReviewSummarySchema = z.object({
  totalReviews: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5).optional(),
  ratingDistribution: z.object({
    1: z.number().int().nonnegative(),
    2: z.number().int().nonnegative(),
    3: z.number().int().nonnegative(),
    4: z.number().int().nonnegative(),
    5: z.number().int().nonnegative(),
  }).optional(),
  recentReviews: z.array(z.object({
    reviewId: z.string(),
    productId: z.string(),
    productName: z.string().optional(),
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
    createdAt: z.string().datetime(),
  })).optional(),
});

export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;

// Prediction Types
export const PredictionSummarySchema = z.object({
  churnRisk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  churnProbability: z.number().min(0).max(1).optional(),
  lifetimeValue: z.object({
    predicted: z.number().nonnegative(),
    actual: z.number().nonnegative(),
    confidence: z.number().min(0).max(1),
  }).optional(),
  nextPurchaseLikelihood: z.number().min(0).max(1).optional(),
  nextPurchaseEta: z.string().optional(),
  engagementScore: z.number().min(0).max(100).optional(),
});

export type PredictionSummary = z.infer<typeof PredictionSummarySchema>;

// Recommendation Types
export const RecommendationSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  score: z.number().min(0).max(1),
  reason: z.string(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  originalPrice: z.number().nonnegative().optional(),
  currentPrice: z.number().nonnegative().optional(),
  discount: z.number().min(0).max(100).optional(),
  inStock: z.boolean().optional(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

// Customer Overview (Main Type)
export const CustomerOverviewSchema = z.object({
  userId: z.string(),
  profile: UnifiedProfileSchema,
  orders: OrderSummarySchema,
  payments: PaymentSummarySchema,
  reviews: ReviewSummarySchema,
  segments: z.array(z.string()),
  predictions: PredictionSummarySchema,
  recommendations: z.array(RecommendationSchema),
  fetchedAt: z.string().datetime(),
});

export type CustomerOverview = z.infer<typeof CustomerOverviewSchema>;

// API Response Types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

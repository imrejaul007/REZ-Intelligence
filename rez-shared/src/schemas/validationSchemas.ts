/**
 * Shared Validation Schemas using Zod
 *
 * Centralized validation for common objects across services.
 * Usage:
 * ```typescript
 * const { success, data, error } = createOrderSchema.safeParse(req.body);
 * ```
 */

import { z } from 'zod';
import { ORDER_STATUSES } from '../orderStatuses';

/**
 * Product cashback subdocument schema (Zod)
 * Field names match the backend Product.cashback subdocument shape
 */
export const productCashbackSchema = z.object({
  percentage: z.number().min(0).max(100).optional(),
  maxAmount: z.number().min(0).optional(),
  minPurchase: z.number().min(0).optional(),
  validUntil: z.string().datetime().optional(),
  terms: z.string().optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(z.string()).optional(),
});

/**
 * Phone number validation (India)
 */
const phoneSchema = z
  .string()
  .regex(/^(\+91|91)?[6-9]\d{9}$/, 'Invalid phone number');

/**
 * Pincode validation (India)
 */
const pincodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Pincode must be 6 digits');

/**
 * Email validation
 */
const emailSchema = z
  .string()
  .email('Invalid email address')
  .optional();

/**
 * Address schema
 * Note: Backend enforces max 5 addresses per user (see address service)
 */
export const addressSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: phoneSchema,
  email: emailSchema,
  addressLine1: z.string().min(1, 'Address line 1 is required').max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(50),
  state: z.string().min(1, 'State is required').max(50),
  pincode: pincodeSchema,
  country: z.string().max(50).default('India'),
  landmark: z.string().max(100).optional(),
  addressType: z.enum(['home', 'work', 'other']).default('home'),
});

export type Address = z.infer<typeof addressSchema>;

/**
 * Order creation schema
 */
export const createOrderSchema = z.object({
  deliveryAddress: addressSchema,
  paymentMethod: z.enum(['cod', 'wallet', 'razorpay', 'upi', 'card', 'netbanking']),
  fulfillmentType: z.enum(['delivery', 'pickup', 'dine_in', 'drive_thru']).default('delivery'),
  specialInstructions: z.string().max(500).optional(),
  couponCode: z.string().max(20).optional(),
  coinsUsed: z.object({
    rezCoins: z.number().nonnegative().optional(),
    promoCoins: z.number().nonnegative().optional(),
    storePromoCoins: z.number().nonnegative().optional(),
  }).strict().refine(data => Object.values(data).some(v => typeof v === 'number' && v > 0), {
    message: 'At least one coin type must have a positive value',
  }).optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key format'),
  fulfillmentDetails: z.object({
    tableNumber: z.string().optional(),
    storeAddress: z.string().optional(),
    estimatedReadyTime: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    pickupInstructions: z.string().optional(),
  }).optional(),
});

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

/**
 * Order status update schema
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES as unknown as [string, ...string[]]),
  note: z.string().max(500).optional(),
});

export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusSchema>;

/**
 * Offer creation schema (base)
 * Field names match the rez-backend Offer model canonical shape:
 *   type, cashbackPercentage, restrictions.minOrderValue,
 *   restrictions.usageLimit, restrictions.usageLimitPerUser
 */
const createOfferSchemaBase = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['discount', 'cashback', 'voucher', 'combo', 'special', 'walk_in']), // B03 fix: was offerType
  validity: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }),
  // B05 fix: restrictions.minOrderValue (was flat minOrderAmount)
  // B06 fix: restrictions.usageLimit / restrictions.usageLimitPerUser (were flat maxRedemptions/*)
  restrictions: z.object({
    minOrderValue: z.number().nonnegative().optional(),
    usageLimit: z.number().positive().optional(),
    usageLimitPerUser: z.number().positive().optional(),
  }).optional(),
  isActive: z.boolean().default(true),
  applicableCategories: z.array(z.string().max(24)).optional(),
  applicableProducts: z.array(z.string().max(24)).optional(),
  userSegments: z.array(z.string()).optional(),
});

/**
 * Offer creation schema
 * Note: Backend validates non-overlapping offers per merchant (see merchant service)
 */
export const createOfferSchema = createOfferSchemaBase.refine((data) => data.validity.startDate < data.validity.endDate, {
  message: 'startDate must be before endDate',
  path: ['validity.endDate'],
});

export type CreateOfferRequest = z.infer<typeof createOfferSchema>;

/**
 * Discount offer schema (specific)
 */
export const createDiscountOfferSchema = createOfferSchemaBase.extend({
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive('Discount value must be positive'),
  maxDiscountAmount: z.number().nonnegative().optional(),
}).refine((data) => data.validity.startDate < data.validity.endDate, {
  message: 'startDate must be before endDate',
  path: ['validity.endDate'],
});

export type CreateDiscountOfferRequest = z.infer<typeof createDiscountOfferSchema>;

/**
 * Cashback offer schema (specific)
 */
export const createCashbackOfferSchema = createOfferSchemaBase.extend({
  cashbackType: z.enum(['coins', 'wallet']),
  cashbackPercentage: z.number().positive('Cashback percentage must be positive'), // B04 fix: was cashbackValue
}).refine((data) => data.validity.startDate < data.validity.endDate, {
  message: 'startDate must be before endDate',
  path: ['validity.endDate'],
});

export type CreateCashbackOfferRequest = z.infer<typeof createCashbackOfferSchema>;

/**
 * Update offer schema — all fields optional (Zod equivalent of updateOfferSchema)
 */
export const updateOfferSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  category: z.enum(['food','retail','travel','healthcare','entertainment','beauty','wellness','fitness','groceries','pharmacy','other']).optional(),
  cashbackPercentage: z.number().min(0).max(100).optional(),
  validity: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }).optional(),
  restrictions: z.object({
    minOrderValue: z.number().min(0).optional(),
    usageLimit: z.number().int().min(1).optional(),
    usageLimitPerUser: z.number().int().min(1).optional(),
    applicableOn: z.array(z.string()).optional(),
    excludedProducts: z.array(z.string()).optional(),
    ageRestriction: z.object({
      minAge: z.number().int().min(0).optional(),
      maxAge: z.number().int().min(0).optional(),
    }).optional(),
  }).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateOfferRequest = z.infer<typeof updateOfferSchema>;

/**
 * Create product schema (Zod equivalent of createProductSchema)
 */
export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  pricing: z.object({
    original: z.number().min(0).optional(),
    selling: z.number().min(0),
    discount: z.number().min(0).optional(),
  }),
  inventory: z.object({
    stock: z.number().int().min(0).optional(),
    inStock: z.boolean().optional(),
  }).optional(),
  category: z.string().optional(),
  images: z.array(z.string()).optional(),
  cashback: productCashbackSchema.optional(),
});

export type CreateProductRequest = z.infer<typeof createProductSchema>;

/**
 * Merchant login schema
 */
export const merchantLoginSchema = z.object({
  email: z.string().email('Invalid email').or(phoneSchema),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type MerchantLoginRequest = z.infer<typeof merchantLoginSchema>;

/**
 * Coupon code validation schema
 * Note: Case-insensitive validation is done at the backend (see coupon service)
 * Do NOT transform to uppercase to preserve original code format
 */
export const couponCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  orderAmount: z.number().positive(),
  userId: z.string().optional(),
});

export type CouponCodeRequest = z.infer<typeof couponCodeSchema>;

/**
 * Validation middleware factory
 */
export function validateRequest(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.reduce((acc: any, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      }, {});

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          statusCode: 400,
          details: errors,
        },
      });
    }

    req.validatedBody = result.data;
    next();
  };
}

/**
 * Validate URL parameters
 * Prevents injection attacks via URL parameters (e.g., /orders/:id where id is a MongoDB ObjectId)
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const errors = result.error.errors.reduce((acc: any, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      }, {});

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'URL parameter validation failed',
          statusCode: 400,
          details: errors,
        },
      });
    }

    req.validatedParams = result.data;
    next();
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const errors = result.error.errors.reduce((acc: any, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      }, {});

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          statusCode: 400,
          details: errors,
        },
      });
    }

    req.validatedQuery = result.data;
    next();
  };
}

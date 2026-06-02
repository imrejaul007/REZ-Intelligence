/**
 * Payment API validation schemas
 * WARNING: This file has been synchronized with packages/shared-types
 * All changes must be made to packages/shared-types as the canonical source
 *
 * Validates CreatePayment, PaymentResponse requests/responses
 * Includes full 11-state FSM for payment statuses
 */

import { z } from 'zod';

// Date utility - accepts both Date and ISO string
const DateOrString = z.union([z.date(), z.string()]);

// Payment status enum (11 states + FSM)
export const PAYMENT_STATUS = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired',
  'refund_initiated',
  'refund_processing',
  'refunded',
  'refund_failed',
  'partially_refunded',
]);

/**
 * Payment method enum — method types (HOW the customer pays)
 * Canonical values from packages/shared-types: includes cod, bnpl, razorpay, stripe
 */
export const PAYMENT_METHOD = z.enum([
  'upi',
  'card',
  'wallet',
  'netbanking',
  'cod',       // Cash on delivery (added to match canonical)
  'bnpl',      // Buy now pay later (added to match canonical)
  'razorpay',  // Razorpay (added to match canonical)
  'stripe',    // Stripe (added to match canonical)
]);

// Payment gateway enum — provider names (WHO processes the payment)
export const PAYMENT_GATEWAY = z.enum([
  'stripe',
  'razorpay',
  'paypal',
]);

// Payment purpose enum
export const PAYMENT_PURPOSE = z.enum([
  'wallet_topup',
  'order_payment',
  'event_booking',
  'financial_service',
  'other',
]);

// User Details schema
export const PaymentUserDetailsSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
});

// Gateway Response schema - discriminated union for type safety
export const PaymentGatewayResponseSchema = z.discriminatedUnion('gateway', [
  z.object({
    gateway: z.literal('razorpay'),
    transactionId: z.string().optional(),
    paymentUrl: z.string().url().optional(),
    razorpayPaymentId: z.string().optional(),
    razorpaySignature: z.string().optional(),
    timestamp: DateOrString,
  }).strict(),
  z.object({
    gateway: z.literal('stripe'),
    transactionId: z.string().optional(),
    paymentIntentId: z.string().optional(),
    clientSecret: z.string().optional(),
    timestamp: DateOrString,
  }).strict(),
  z.object({
    gateway: z.literal('paypal'),
    transactionId: z.string().optional(),
    paypalOrderId: z.string().optional(),
    captureId: z.string().optional(),
    timestamp: DateOrString,
  }).strict(),
  z.object({
    gateway: z.literal('upi'),
    transactionId: z.string().optional(),
    upiId: z.string().optional(),
    qrCode: z.string().optional(),
    expiryTime: DateOrString.optional(),
    timestamp: DateOrString,
  }).strict(),
  z.object({
    gateway: z.enum(['wallet', 'cod']),
    transactionId: z.string().optional(),
    timestamp: DateOrString,
  }).strict(),
]);

// Create Payment Request
export const CreatePaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  user: z.string().regex(/^[a-fA-F0-9]{24}$/, 'user must be an ObjectId'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(1, 'Currency is required').default('INR'),
  /** How the customer pays: upi, card, wallet, netbanking, cod, bnpl, razorpay, stripe */
  paymentMethod: PAYMENT_METHOD,
  /** Which gateway processes the payment: razorpay, stripe, paypal (optional) */
  gateway: PAYMENT_GATEWAY.optional(),
  purpose: PAYMENT_PURPOSE.optional().default('order_payment'),
  userDetails: PaymentUserDetailsSchema,
  metadata: z.record(z.any()).optional(),
  gatewayResponse: PaymentGatewayResponseSchema.optional(),
});

// Update Payment Status Request
export const UpdatePaymentStatusSchema = z.object({
  status: PAYMENT_STATUS,
  failureReason: z.string().optional(),
  walletCredited: z.boolean().optional(),
  refundedAmount: z.number().min(0).optional(),
  metadata: z.record(z.any()).optional(),
});

// Payment Response
export const PaymentResponseSchema = z.object({
  _id: z.string().optional(),
  paymentId: z.string(),
  orderId: z.string(),
  user: z.string(),
  amount: z.number(),
  currency: z.string(),
  /** How the customer pays: upi, card, wallet, netbanking */
  paymentMethod: PAYMENT_METHOD,
  /** Which gateway processes the payment: razorpay, stripe, paypal */
  gateway: PAYMENT_GATEWAY.optional(),
  purpose: PAYMENT_PURPOSE,
  status: PAYMENT_STATUS,
  userDetails: PaymentUserDetailsSchema,
  metadata: z.record(z.any()).optional(),
  gatewayResponse: PaymentGatewayResponseSchema.optional(),
  failureReason: z.string().optional(),
  walletCredited: z.boolean().optional(),
  walletCreditedAt: DateOrString.optional(),
  completedAt: DateOrString.optional(),
  failedAt: DateOrString.optional(),
  expiresAt: DateOrString.optional(),
  refundedAmount: z.number().min(0).optional(),
  createdAt: DateOrString,
  updatedAt: DateOrString,
});

// List Payments Response
export const PaymentListResponseSchema = z.array(PaymentResponseSchema);

// Infer TypeScript types
export type CreatePaymentRequest = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentStatusRequest = z.infer<typeof UpdatePaymentStatusSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>;
export type PaymentStatus = z.infer<typeof PAYMENT_STATUS>;
export type PaymentMethod = z.infer<typeof PAYMENT_METHOD>;
export type PaymentGateway = z.infer<typeof PAYMENT_GATEWAY>;
export type PaymentPurpose = z.infer<typeof PAYMENT_PURPOSE>;

/**
 * Subscription Model for REZ Care Service
 * Multi-tenant SaaS subscription management with Razorpay integration
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum SubscriptionTier {
  LITE = 'lite',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
}

export interface ISubscriptionLimits {
  ticketsPerMonth: number;
  agents: number;
  brands: number;
  apiCalls: number;
  storage: number; // in MB
}

export interface ISubscription extends Document {
  clientId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startedAt: Date;
  expiresAt: Date;
  trialEndsAt?: Date;
  features: string[];
  limits: ISubscriptionLimits;
  // Payment fields (Razorpay)
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
  cancelledReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionLimitsSchema = new Schema<ISubscriptionLimits>({
  ticketsPerMonth: { type: Number, required: true },
  agents: { type: Number, required: true },
  brands: { type: Number, required: true },
  apiCalls: { type: Number, required: true },
  storage: { type: Number, required: true },
}, { _id: false });

const SubscriptionSchema = new Schema<ISubscription>({
  clientId: { type: String, required: true, index: true },
  tier: {
    type: String,
    enum: Object.values(SubscriptionTier),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(SubscriptionStatus),
    default: SubscriptionStatus.TRIAL
  },
  billingCycle: {
    type: String,
    enum: Object.values(BillingCycle),
    default: BillingCycle.MONTHLY
  },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  trialEndsAt: { type: Date },
  features: [{ type: String }],
  limits: { type: SubscriptionLimitsSchema, required: true },
  razorpayCustomerId: { type: String, sparse: true },
  razorpaySubscriptionId: { type: String, sparse: true },
  razorpayPlanId: { type: String, sparse: true },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelledAt: { type: Date },
  cancelledReason: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Indexes
SubscriptionSchema.index({ clientId: 1, status: 1 });
SubscriptionSchema.index({ razorpayCustomerId: 1 }, { sparse: true });
SubscriptionSchema.index({ razorpaySubscriptionId: 1 }, { sparse: true });
SubscriptionSchema.index({ status: 1, expiresAt: 1 });
SubscriptionSchema.index({ 'metadata.merchantId': 1 }, { sparse: true });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

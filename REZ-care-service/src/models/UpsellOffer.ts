/**
 * Upsell Offer Model for REZ Care Service
 * Tracks upsell offers and conversions
 */

import mongoose, { Schema, Document } from 'mongoose';

export type UpsellOfferType = 'upsell' | 'cross_sell' | 'addon' | 'subscription' | 'premium';
export type UpsellOfferStatus = 'active' | 'paused' | 'expired';
export type UpsellConversionAction = 'shown' | 'clicked' | 'accepted' | 'rejected';

export interface IUpsellOffer extends Document {
  offerId: string;
  customerId: string;
  merchantId?: string;
  type: UpsellOfferType;
  title: string;
  description: string;
  offer: string;
  originalPrice?: number;
  discountedPrice?: number;
  discount?: number;
  productId?: string;
  serviceId?: string;
  cta: string;
  reason: string;
  relevance: number;
  platform: string;
  context: string;
  status: UpsellOfferStatus;
  conversions: {
    action: UpsellConversionAction;
    timestamp: Date;
  }[];
  revenue: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UpsellOfferSchema = new Schema<IUpsellOffer>({
  offerId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  merchantId: { type: String, sparse: true, index: true },
  type: {
    type: String,
    enum: ['upsell', 'cross_sell', 'addon', 'subscription', 'premium'],
    required: true
  },
  title: { type: String, required: true },
  description: { type: String },
  offer: { type: String, required: true },
  originalPrice: { type: Number },
  discountedPrice: { type: Number },
  discount: { type: Number },
  productId: { type: String },
  serviceId: { type: String },
  cta: { type: String, required: true },
  reason: { type: String },
  relevance: { type: Number, default: 0.5 },
  platform: { type: String, required: true },
  context: { type: String },
  status: {
    type: String,
    enum: ['active', 'paused', 'expired'],
    default: 'active'
  },
  conversions: [{
    action: {
      type: String,
      enum: ['shown', 'clicked', 'accepted', 'rejected']
    },
    timestamp: { type: Date, default: Date.now }
  }],
  revenue: { type: Number, default: 0 },
  expiresAt: { type: Date }
}, { timestamps: true });

// Indexes
UpsellOfferSchema.index({ customerId: 1, createdAt: -1 });
UpsellOfferSchema.index({ merchantId: 1, type: 1 });
UpsellOfferSchema.index({ status: 1, expiresAt: 1 });
UpsellOfferSchema.index({ 'conversions.action': 1 });

export const UpsellOffer = mongoose.model<IUpsellOffer>('UpsellOffer', UpsellOfferSchema);

import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  CustomerSegment,
  ProductCategory,
  ProductRecommendation,
  UpsellOpportunity,
  PricingSuggestion,
  InventoryAlert,
} from '../types';

export interface IRetailMindSession extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  merchantId: string;
  customerId?: string;
  customerProfile: {
    segment: CustomerSegment;
    preferences: string[];
    avgOrderValue: number;
    purchaseFrequency: string;
    loyaltyTier?: string;
    preferredCategories: ProductCategory[];
    priceSensitivity: number;
  };
  cartItems?: Array<{
    productId: string;
    productName: string;
    category: ProductCategory;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl?: string;
  }>;
  analysis: {
    recommendedProducts: ProductRecommendation[];
    upsellOpportunities: UpsellOpportunity[];
    pricingSuggestions: PricingSuggestion[];
    inventoryAlerts: InventoryAlert[];
  };
  sentimentScore?: number;
  nextBestAction?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define subdocument schemas for better type safety
const CartItemSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  category: {
    type: String,
    enum: Object.values(ProductCategory),
    required: true,
  },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  imageUrl: { type: String },
}, { _id: false });

const ProductRecommendationSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  category: {
    type: String,
    enum: Object.values(ProductCategory),
    required: true,
  },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  reason: { type: String, required: true },
  price: { type: Number },
  imageUrl: { type: String },
  relevanceScore: { type: Number, required: true, min: 0, max: 100 },
  urgency: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
  },
}, { _id: false });

const UpsellOpportunitySchema = new Schema({
  originalProduct: {
    productId: String,
    productName: String,
    category: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
  },
  upsellProduct: ProductRecommendationSchema,
  savings: { type: Number },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  reason: { type: String, required: true },
}, { _id: false });

const PricingSuggestionSchema = new Schema({
  productId: { type: String, required: true },
  currentPrice: { type: Number, required: true },
  suggestedPrice: { type: Number, required: true },
  priceChange: { type: Number, required: true },
  reason: { type: String, required: true },
  expiresAt: { type: Date },
}, { _id: false });

const InventoryAlertSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  currentStock: { type: Number, required: true },
  daysRemaining: { type: Number, required: true },
  urgency: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true,
  },
  message: { type: String, required: true },
  recommendedAction: { type: String, required: true },
}, { _id: false });

const CustomerProfileSchema = new Schema({
  segment: {
    type: String,
    enum: Object.values(CustomerSegment),
    required: true,
  },
  preferences: [{ type: String }],
  avgOrderValue: { type: Number, required: true, min: 0 },
  purchaseFrequency: { type: String, required: true },
  loyaltyTier: { type: String },
  preferredCategories: [{
    type: String,
    enum: Object.values(ProductCategory),
  }],
  priceSensitivity: { type: Number, required: true, min: 0, max: 1 },
}, { _id: false });

const SessionAnalysisSchema = new Schema({
  recommendedProducts: [ProductRecommendationSchema],
  upsellOpportunities: [UpsellOpportunitySchema],
  pricingSuggestions: [PricingSuggestionSchema],
  inventoryAlerts: [InventoryAlertSchema],
}, { _id: false });

const RetailMindSessionSchema = new Schema<IRetailMindSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    customerId: {
      type: String,
      index: true,
    },
    customerProfile: {
      type: CustomerProfileSchema,
      required: true,
    },
    cartItems: [CartItemSchema],
    analysis: {
      type: SessionAnalysisSchema,
      required: true,
    },
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1,
    },
    nextBestAction: String,
  },
  {
    timestamps: true,
  }
);

// Compound index for TTL and merchant queries
RetailMindSessionSchema.index({ merchantId: 1, createdAt: 1 });

// TTL index - sessions expire after 90 days
RetailMindSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Text index for search capabilities
RetailMindSessionSchema.index({
  'customerProfile.preferences': 'text',
  'analysis.recommendedProducts.productName': 'text',
});

export const RetailMindSession = mongoose.model<IRetailMindSession>(
  'RetailMindSession',
  RetailMindSessionSchema
);
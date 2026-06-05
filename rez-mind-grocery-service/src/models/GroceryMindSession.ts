import mongoose, { Document, Schema } from 'mongoose';
import {
  CustomerSegment,
  GroceryCategory,
  ProductRecommendation,
  ExpiryAlert,
  DemandSignal,
  SupplierScore,
  SavingsOpportunity,
} from '../types';

export interface IGroceryMindSession extends Document {
  sessionId: string;
  merchantId: string;
  customerId?: string;
  intent: string;
  context: {
    recentProducts: string[];
    avgBasketValue: number;
    preferredCategories: GroceryCategory[];
  };
  analysis: {
    recommendedProducts: ProductRecommendation[];
    expiryAlerts: ExpiryAlert[];
    demandSignals: DemandSignal[];
    supplierSuggestions: SupplierScore[];
    savingsOpportunities: SavingsOpportunity[];
  };
  sentiment?: number;
  createdAt: Date;
  updatedAt: Date;
}

const GroceryMindSessionSchema = new Schema<IGroceryMindSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
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
    intent: {
      type: String,
      required: true,
      default: 'general_consultation',
    },
    context: {
      recentProducts: {
        type: [String],
        default: [],
      },
      avgBasketValue: {
        type: Number,
        default: 0,
      },
      preferredCategories: {
        type: [String],
        enum: Object.values(GroceryCategory),
        default: [],
      },
    },
    analysis: {
      recommendedProducts: [
        {
          productId: String,
          productName: String,
          category: String,
          confidence: Number,
          reason: String,
          price: Number,
          imageUrl: String,
          relevanceScore: Number,
          urgency: String,
        },
      ],
      expiryAlerts: [
        {
          alertId: String,
          productId: String,
          productName: String,
          currentStock: Number,
          predictedExpiryDate: Date,
          daysRemaining: Number,
          urgency: String,
          message: String,
          recommendedAction: String,
          suggestedDiscount: Number,
        },
      ],
      demandSignals: [
        {
          type: String,
          value: Number,
          timestamp: Date,
          source: String,
          affectedProducts: [String],
        },
      ],
      supplierSuggestions: [
        {
          supplierId: String,
          supplierName: String,
          overallScore: Number,
          reliabilityScore: Number,
          qualityScore: Number,
          priceScore: Number,
          sustainabilityScore: Number,
          onTimeDeliveryRate: Number,
          orderAccuracy: Number,
          riskLevel: String,
          recommendation: String,
          lastEvaluated: Date,
        },
      ],
      savingsOpportunities: [
        {
          type: String,
          description: String,
          potentialSavings: Number,
          products: [String],
          confidence: Number,
        },
      ],
    },
    sentiment: {
      type: Number,
      min: -1,
      max: 1,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index - sessions expire after 60 days
GroceryMindSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

// Compound indexes for common queries
GroceryMindSessionSchema.index({ merchantId: 1, customerId: 1 });
GroceryMindSessionSchema.index({ merchantId: 1, createdAt: -1 });
GroceryMindSessionSchema.index({ 'analysis.expiryAlerts.urgency': 1 });

// Static methods
GroceryMindSessionSchema.statics.findByMerchant = function (merchantId: string, limit = 50) {
  return this.find({ merchantId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

GroceryMindSessionSchema.statics.findByCustomer = function (customerId: string, limit = 20) {
  return this.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

GroceryMindSessionSchema.statics.findByMerchantAndDateRange = function (
  merchantId: string,
  startDate: Date,
  endDate: Date
) {
  return this.find({
    merchantId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).sort({ createdAt: -1 }).exec();
};

export const GroceryMindSession = mongoose.model<IGroceryMindSession>(
  'GroceryMindSession',
  GroceryMindSessionSchema
);

export default GroceryMindSession;
import mongoose, { Document, Schema } from 'mongoose';
import { GroceryCategory, SuggestedAction, UrgencyLevel } from '../types';

export interface IExpiryPrediction extends Document {
  predictionId: string;
  merchantId: string;
  productId: string;
  productName: string;
  category: GroceryCategory;
  predictedExpiryDate: Date;
  confidence: number;
  suggestedAction: SuggestedAction;
  suggestedDiscount?: number;
  daysRemaining: number;
  batchDate?: Date;
  storageConditions?: {
    temperature: number;
    humidity: number;
    refrigerated: boolean;
  };
  actualExpiryDate?: Date;
  updatedAt: Date;
  createdAt: Date;
}

const ExpiryPredictionSchema = new Schema<IExpiryPrediction>(
  {
    predictionId: {
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
    productId: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(GroceryCategory),
      required: true,
    },
    predictedExpiryDate: {
      type: Date,
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8,
    },
    suggestedAction: {
      type: String,
      enum: Object.values(SuggestedAction),
      default: SuggestedAction.MONITOR,
    },
    suggestedDiscount: {
      type: Number,
      min: 0,
      max: 100,
    },
    daysRemaining: {
      type: Number,
      required: true,
      index: true,
    },
    batchDate: {
      type: Date,
    },
    storageConditions: {
      temperature: { type: Number },
      humidity: { type: Number },
      refrigerated: { type: Boolean, default: false },
    },
    actualExpiryDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
ExpiryPredictionSchema.index({ merchantId: 1, daysRemaining: 1 });
ExpiryPredictionSchema.index({ merchantId: 1, category: 1 });
ExpiryPredictionSchema.index({ merchantId: 1, productId: 1 });
ExpiryPredictionSchema.index({ merchantId: 1, suggestedAction: 1 });
ExpiryPredictionSchema.index({ predictedExpiryDate: 1 });

// TTL index for automatic cleanup after 90 days
ExpiryPredictionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Static methods
ExpiryPredictionSchema.statics.findByMerchant = function (merchantId: string) {
  return this.find({ merchantId })
    .sort({ daysRemaining: 1 })
    .exec();
};

ExpiryPredictionSchema.statics.findExpiringByMerchant = function (
  merchantId: string,
  daysThreshold: number = 7
) {
  return this.find({
    merchantId,
    daysRemaining: { $lte: daysThreshold },
    daysRemaining: { $gt: 0 },
  })
    .sort({ daysRemaining: 1 })
    .exec();
};

ExpiryPredictionSchema.statics.findCriticalByMerchant = function (merchantId: string) {
  return this.find({
    merchantId,
    daysRemaining: { $lte: 2 },
    suggestedAction: { $ne: SuggestedAction.REMOVE },
  })
    .sort({ daysRemaining: 1 })
    .exec();
};

ExpiryPredictionSchema.statics.findByProduct = function (merchantId: string, productId: string) {
  return this.find({ merchantId, productId })
    .sort({ createdAt: -1 })
    .exec();
};

ExpiryPredictionSchema.statics.updateActualExpiry = async function (
  predictionId: string,
  actualExpiryDate: Date
) {
  return this.findOneAndUpdate(
    { predictionId },
    { actualExpiryDate, updatedAt: new Date() },
    { new: true }
  );
};

ExpiryPredictionSchema.statics.getCategoryBreakdown = async function (merchantId: string) {
  const results = await this.aggregate([
    { $match: { merchantId } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgDaysRemaining: { $avg: '$daysRemaining' },
        products: { $addToSet: '$productId' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return results.map(r => ({
    category: r._id,
    count: r.count,
    avgDaysRemaining: Math.round(r.avgDaysRemaining * 10) / 10,
    uniqueProducts: r.products.length,
  }));
};

export const ExpiryPrediction = mongoose.model<IExpiryPrediction>(
  'ExpiryPrediction',
  ExpiryPredictionSchema
);

export default ExpiryPrediction;
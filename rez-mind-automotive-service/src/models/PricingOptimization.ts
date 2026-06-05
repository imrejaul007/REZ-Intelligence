import mongoose, { Schema, model, Document } from 'mongoose';
import { IPricingOptimization, IVehiclePricingData } from '../types';

export interface PricingOptimizationDocument extends Omit<IPricingOptimization, '_id'>, Document {}

const vehicleDataSchema = new Schema({
  make: { type: String, required: true },
  model: { type: String, required: true },
  variant: { type: String, required: true },
  year: { type: Number, required: true },
  kilometerReading: { type: Number, required: true },
  fuelType: { type: String, enum: ['petrol', 'diesel', 'electric', 'hybrid'], required: true },
  transmission: { type: String, enum: ['manual', 'auto'], required: true },
  ownership: { type: String, enum: ['1st', '2nd', '3rd'], required: true },
  condition: { type: String, enum: ['excellent', 'good', 'fair', 'poor'] },
  location: String,
  marketData: {
    similarListings: Number,
    avgPrice: Number,
    minPrice: Number,
    maxPrice: Number,
  },
}, { _id: false });

const recommendationSchema = new Schema({
  minPrice: { type: Number, required: true },
  optimalPrice: { type: Number, required: true },
  maxPrice: { type: Number, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  currency: { type: String, default: 'INR' },
}, { _id: false });

const factorSchema = new Schema({
  name: { type: String, required: true },
  impact: { type: String, enum: ['positive', 'negative', 'neutral'], required: true },
  weight: { type: Number, required: true },
  description: { type: String, required: true },
}, { _id: false });

const marketAnalysisSchema = new Schema({
  demand: { type: String, enum: ['high', 'medium', 'low'], required: true },
  competition: { type: String, enum: ['low', 'medium', 'high'], required: true },
  trend: { type: String, enum: ['appreciation', 'stable', 'depreciation'], required: true },
}, { _id: false });

const usedForPricingSchema = new Schema({
  appliedPrice: { type: Number },
  appliedAt: { type: Date },
}, { _id: false });

const pricingOptimizationSchema = new Schema<PricingOptimizationDocument>(
  {
    pricingId: { type: String, required: true, unique: true, index: true },
    merchantId: { type: String, required: true, index: true },
    vehicleData: { type: vehicleDataSchema, required: true },
    recommendation: { type: recommendationSchema, required: true },
    factors: { type: [factorSchema], default: [] },
    marketAnalysis: { type: marketAnalysisSchema, required: true },
    usedForPricing: { type: usedForPricingSchema },
  },
  { timestamps: true }
);

// Pre-save hook
pricingOptimizationSchema.pre('save', function (next) {
  if (!this.pricingId) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.pricingId = `POP-${timestamp}-${randomStr}`;
  }
  next();
});

// Static method to get latest pricing for vehicle
pricingOptimizationSchema.statics.getLatestForVehicle = function (
  merchantId: string,
  make: string,
  model: string,
  year: number
) {
  return this.findOne({ merchantId, 'vehicleData.make': make, 'vehicleData.model': model, 'vehicleData.year': year })
    .sort({ createdAt: -1 });
};

// Static method to get pricing history
pricingOptimizationSchema.statics.getHistory = function (merchantId: string, limit: number = 50) {
  return this.find({ merchantId }).sort({ createdAt: -1 }).limit(limit);
};

// Ensure virtuals are included
pricingOptimizationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const PricingOptimization = model<PricingOptimizationDocument>('PricingOptimization', pricingOptimizationSchema);
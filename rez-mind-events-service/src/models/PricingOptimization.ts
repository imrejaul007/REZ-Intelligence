import mongoose, { Document, Schema } from 'mongoose';
import { DemandLevel, EventType } from '../types';

export interface IPricingOptimization extends Document {
  optimizationId: string;
  eventId: string;
  eventName?: string;
  eventType: EventType;
  currentPrice: number;
  optimizedPrice: number;
  demandLevel: DemandLevel;
  confidence: number;
  factors: string[];
  priceRange: { min: number; max: number };
  optimizationDate: Date;
  expectedRevenue?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PricingOptimizationSchema = new Schema<IPricingOptimization>(
  {
    optimizationId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    eventName: { type: String },
    eventType: { type: String, enum: Object.values(EventType), required: true },
    currentPrice: { type: Number, required: true, min: 0 },
    optimizedPrice: { type: Number, required: true, min: 0 },
    demandLevel: { type: String, enum: Object.values(DemandLevel), default: DemandLevel.MEDIUM },
    confidence: { type: Number, min: 0, max: 1, default: 0.75 },
    factors: { type: [String], default: [] },
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 1000 },
    },
    optimizationDate: { type: Date, required: true },
    expectedRevenue: { type: Number },
  },
  { timestamps: true }
);

PricingOptimizationSchema.index({ eventId: 1, optimizationDate: -1 });
PricingOptimizationSchema.index({ eventId: 1, demandLevel: 1 });

PricingOptimizationSchema.statics.findByEvent = function (eventId: string) {
  return this.find({ eventId }).sort({ optimizationDate: -1 }).exec();
};

PricingOptimizationSchema.statics.getLatest = function (eventId: string) {
  return this.findOne({ eventId }).sort({ optimizationDate: -1 }).exec();
};

export const PricingOptimization = mongoose.model<IPricingOptimization>('PricingOptimization', PricingOptimizationSchema);
export default PricingOptimization;
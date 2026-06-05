import mongoose, { Document, Schema } from 'mongoose';
import { VendorCategory, EventType } from '../types';

export interface IVendorMatch extends Document {
  matchId: string;
  eventId: string;
  vendorId: string;
  vendorName: string;
  category: VendorCategory;
  matchScore: number;
  compatibility: string[];
  pricing: { min: number; max: number };
  performance: {
    reliability: number;
    quality: number;
    value: number;
  };
  recommendations: string[];
  eventType: EventType;
  createdAt: Date;
  updatedAt: Date;
}

const VendorMatchSchema = new Schema<IVendorMatch>(
  {
    matchId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    vendorId: { type: String, required: true },
    vendorName: { type: String, required: true },
    category: { type: String, enum: Object.values(VendorCategory), required: true },
    matchScore: { type: Number, min: 0, max: 100, required: true },
    compatibility: { type: [String], default: [] },
    pricing: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 },
    },
    performance: {
      reliability: { type: Number, min: 0, max: 100, default: 80 },
      quality: { type: Number, min: 0, max: 100, default: 80 },
      value: { type: Number, min: 0, max: 100, default: 80 },
    },
    recommendations: { type: [String], default: [] },
    eventType: { type: String, enum: Object.values(EventType), required: true },
  },
  { timestamps: true }
);

VendorMatchSchema.index({ eventId: 1, matchScore: -1 });
VendorMatchSchema.index({ eventId: 1, category: 1 });
VendorMatchSchema.index({ vendorId: 1 });

VendorMatchSchema.statics.findByEvent = function (eventId: string, limit = 20) {
  return this.find({ eventId }).sort({ matchScore: -1 }).limit(limit).exec();
};

VendorMatchSchema.statics.findByCategory = function (eventId: string, category: VendorCategory) {
  return this.find({ eventId, category }).sort({ matchScore: -1 }).exec();
};

export const VendorMatch = mongoose.model<IVendorMatch>('VendorMatch', VendorMatchSchema);
export default VendorMatch;
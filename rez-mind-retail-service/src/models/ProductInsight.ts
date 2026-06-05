import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { InsightType } from '../types';

export interface IProductInsight extends Document {
  _id: mongoose.Types.ObjectId;
  insightId: string;
  merchantId: string;
  productId: string;
  type: InsightType;
  score: number;
  confidence: number;
  description: string;
  recommendations: string[];
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductInsightSchema = new Schema<IProductInsight>(
  {
    insightId: {
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
    productId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(InsightType),
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    description: {
      type: String,
      required: true,
    },
    recommendations: [
      {
        type: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for merchant + type + active queries
ProductInsightSchema.index({ merchantId: 1, type: 1, isActive: 1 });

// Compound index for product insights
ProductInsightSchema.index({ productId: 1, isActive: 1 });

// TTL index for expiring insights
ProductInsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Text index for insight search
ProductInsightSchema.index({ description: 'text', recommendations: 'text' });

export const ProductInsight = mongoose.model<IProductInsight>(
  'ProductInsight',
  ProductInsightSchema
);
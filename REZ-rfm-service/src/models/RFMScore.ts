import mongoose, { Schema, Document, Model } from 'mongoose';
import { IRFMScore } from '../types/index.js';

export interface IRFMScoreDocument extends Omit<IRFMScore, 'metadata'>, Document {
  metadata?: {
    daysSinceLastOrder: number;
    totalOrders: number;
    totalSpent: number;
  };
}

export interface IRFMScoreModel extends Model<IRFMScoreDocument> {
  findByCustomerId(customerId: string): Promise<IRFMScoreDocument | null>;
  findBySegment(segment: string, options?: { limit?: number; skip?: number }): Promise<IRFMScoreDocument[]>;
  getSegmentDistribution(): Promise<Record<string, number>>;
}

const RFMScoreSchema = new Schema<IRFMScoreDocument>(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recency: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (v: number): boolean => Number.isInteger(v) && v >= 1 && v <= 5,
        message: 'Recency must be an integer between 1 and 5',
      },
    },
    frequency: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (v: number): boolean => Number.isInteger(v) && v >= 1 && v <= 5,
        message: 'Frequency must be an integer between 1 and 5',
      },
    },
    monetary: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (v: number): boolean => Number.isInteger(v) && v >= 1 && v <= 5,
        message: 'Monetary must be an integer between 1 and 5',
      },
    },
    rfmCode: {
      type: String,
      required: true,
      index: true,
    },
    segment: {
      type: String,
      required: true,
      index: true,
    },
    lastCalculatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    metadata: {
      daysSinceLastOrder: {
        type: Number,
        default: 0,
      },
      totalOrders: {
        type: Number,
        default: 0,
      },
      totalSpent: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        const { _id, __v, ...rest } = ret;
        return rest;
      },
    },
  }
);

// Compound indexes for efficient queries
RFMScoreSchema.index({ segment: 1, lastCalculatedAt: -1 });
RFMScoreSchema.index({ rfmCode: 1, lastCalculatedAt: -1 });

// Static method to find by customer ID
RFMScoreSchema.statics.findByCustomerId = async function (
  customerId: string
): Promise<IRFMScoreDocument | null> {
  return this.findOne({ customerId });
};

// Static method to find customers by segment
RFMScoreSchema.statics.findBySegment = async function (
  segment: string,
  options?: { limit?: number; skip?: number }
): Promise<IRFMScoreDocument[]> {
  return this.find({ segment })
    .sort({ lastCalculatedAt: -1 })
    .skip(options?.skip || 0)
    .limit(options?.limit || 100);
};

// Static method to get segment distribution
RFMScoreSchema.statics.getSegmentDistribution = async function (): Promise<Record<string, number>> {
  const results = await this.aggregate([
    {
      $group: {
        _id: '$segment',
        count: { $sum: 1 },
      },
    },
  ]);

  return results.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, {} as Record<string, number>);
};

export const RFMScore: Model<IRFMScoreDocument> = mongoose.model<IRFMScoreDocument>(
  'RFMScore',
  RFMScoreSchema
);

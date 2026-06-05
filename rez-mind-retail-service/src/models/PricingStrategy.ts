import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { StrategyType, StrategyStatus } from '../types';

export interface IPricingStrategy extends Document {
  _id: mongoose.Types.ObjectId;
  strategyId: string;
  merchantId: string;
  productId?: string;
  categoryId?: string;
  strategyType: StrategyType;
  currentPrice: number;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  triggers: Array<{
    type: 'competitor_price' | 'demand' | 'inventory' | 'seasonal' | 'time';
    condition: string;
    threshold?: number;
    action: 'increase' | 'decrease' | 'maintain';
    amount?: number;
  }>;
  status: StrategyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PricingTriggerSchema = new Schema({
  type: {
    type: String,
    enum: ['competitor_price', 'demand', 'inventory', 'seasonal', 'time'],
    required: true,
  },
  condition: {
    type: String,
    required: true,
  },
  threshold: {
    type: Number,
  },
  action: {
    type: String,
    enum: ['increase', 'decrease', 'maintain'],
    required: true,
  },
  amount: {
    type: Number,
  },
}, { _id: false });

const PricingStrategySchema = new Schema<IPricingStrategy>(
  {
    strategyId: {
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
      index: true,
    },
    categoryId: {
      type: String,
    },
    strategyType: {
      type: String,
      enum: Object.values(StrategyType),
      required: true,
    },
    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    suggestedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    minPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    maxPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    triggers: [PricingTriggerSchema],
    status: {
      type: String,
      enum: Object.values(StrategyStatus),
      default: StrategyStatus.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
PricingStrategySchema.index({ merchantId: 1, status: 1 });
PricingStrategySchema.index({ productId: 1, status: 1 });
PricingStrategySchema.index({ categoryId: 1, status: 1 });

// Index for strategy type queries
PricingStrategySchema.index({ strategyType: 1, status: 1 });

export const PricingStrategy = mongoose.model<IPricingStrategy>(
  'PricingStrategy',
  PricingStrategySchema
);
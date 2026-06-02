import mongoose, { Document, Schema } from 'mongoose';

// Enum types for recharge operations
export enum RechargeType {
  MOBILE = 'mobile',
  DTH = 'dth',
}

export enum RechargeStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum MobileOperator {
  AIRTEL = 'airtel',
  JIO = 'jio',
  VI = 'vi',
  BSNL = 'bsnl',
}

export enum DTHOperator {
  TATA_SKY = 'tata_sky',
  DISH_TV = 'dish_tv',
  AIRTEL_DIGITAL = 'airtel_digital',
  VIDEOCON = 'videocon',
}

// Interface for Recharge Document
export interface IRecharge extends Document {
  transactionId: string;
  userId?: string;
  type: RechargeType;
  operator: MobileOperator | DTHOperator;
  subscriberNumber: string;
  amount: number;
  status: RechargeStatus;
  operatorReferenceId?: string;
  planId?: string;
  operatorResponse?: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  scheduledAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Plan Document
export interface IPlan extends Document {
  planId: string;
  operator: MobileOperator | DTHOperator;
  type: RechargeType;
  name: string;
  description: string;
  amount: number;
  validityDays?: number;
  data?: string;
  talktime?: string;
  sms?: string;
  voice?: string;
  benefits: string[];
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Recharge Schema
const rechargeSchema = new Schema<IRecharge>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(RechargeType),
      required: true,
    },
    operator: {
      type: String,
      required: true,
      index: true,
    },
    subscriberNumber: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(RechargeStatus),
      default: RechargeStatus.PENDING,
      index: true,
    },
    operatorReferenceId: {
      type: String,
    },
    planId: {
      type: String,
    },
    operatorResponse: {
      type: Schema.Types.Mixed,
    },
    errorMessage: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    scheduledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
rechargeSchema.index({ type: 1, status: 1 });
rechargeSchema.index({ userId: 1, createdAt: -1 });
rechargeSchema.index({ operator: 1, subscriberNumber: 1 });

// Plan Schema
const planSchema = new Schema<IPlan>(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    operator: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(RechargeType),
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    validityDays: {
      type: Number,
    },
    data: {
      type: String,
    },
    talktime: {
      type: String,
    },
    sms: {
      type: String,
    },
    voice: {
      type: String,
    },
    benefits: [
      {
        type: String,
      },
    ],
    category: {
      type: String,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for plan queries
planSchema.index({ operator: 1, type: 1, isActive: 1 });
planSchema.index({ operator: 1, category: 1 });

// Export models
export const Recharge = mongoose.model<IRecharge>('Recharge', rechargeSchema);
export const Plan = mongoose.model<IPlan>('Plan', planSchema);

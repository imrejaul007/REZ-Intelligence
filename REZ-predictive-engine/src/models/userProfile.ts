import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProfile extends Document {
  userId: string;
  email?: string;
  phone?: string;
  firstOrderDate?: Date;
  lastOrderDate?: Date;
  totalOrders: number;
  avgOrderValue: number;
  ordersPerMonth: number;
  totalSpend: number;
  preferredCategories: string[];
  preferredPaymentMethods: string[];
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  referralSource?: string;
  tags: string[];
  engagementScore: number;
  loginFrequency: number;
  lastLoginDate?: Date;
  cartAbandonmentRate?: number;
  emailOpenRate?: number;
  pushNotificationClickRate?: number;
  loyaltyPoints?: number;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  accountAge: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      sparse: true,
      trim: true
    },
    firstOrderDate: Date,
    lastOrderDate: Date,
    totalOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    avgOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    ordersPerMonth: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSpend: {
      type: Number,
      default: 0,
      min: 0
    },
    preferredCategories: {
      type: [String],
      default: []
    },
    preferredPaymentMethods: {
      type: [String],
      default: []
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet'],
      default: 'mobile'
    },
    location: {
      city: String,
      state: String,
      country: String
    },
    referralSource: String,
    tags: {
      type: [String],
      default: [],
      index: true
    },
    engagementScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    loginFrequency: {
      type: Number,
      default: 0,
      min: 0
    },
    lastLoginDate: Date,
    cartAbandonmentRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    emailOpenRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    pushNotificationClickRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    accountAge: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    collection: 'user_profiles'
  }
);

// Compound indexes for common queries
UserProfileSchema.index({ engagementScore: -1, totalSpend: -1 });
UserProfileSchema.index({ lastOrderDate: -1 });
UserProfileSchema.index({ totalOrders: -1, avgOrderValue: -1 });
UserProfileSchema.index({ 'location.country': 1, 'location.state': 1 });
UserProfileSchema.index({ tags: 1 });

// Virtual for calculating days since last order
UserProfileSchema.virtual('daysSinceLastOrder').get(function () {
  if (!this.lastOrderDate) return null;
  const now = new Date();
  const diffTime = now.getTime() - this.lastOrderDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Ensure virtuals are included in JSON output
UserProfileSchema.set('toJSON', { virtuals: true });
UserProfileSchema.set('toObject', { virtuals: true });

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);

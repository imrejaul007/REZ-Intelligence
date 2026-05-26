import mongoose, { Schema, Model } from 'mongoose';
import {
  IGiftCard,
  IWallet,
  ITransaction,
  GiftCardMetadata,
  TransactionHistoryEntry,
  PaymentMethod,
  TransactionMetadata,
} from '../types/index.js';

// ============================================================================
// Gift Card Schema
// ============================================================================

const TransactionHistorySchema = new Schema<TransactionHistoryEntry>(
  {
    type: {
      type: String,
      enum: ['load', 'redeem', 'refund', 'expire', 'cancel'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    transactionId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { _id: false }
);

const GiftCardMetadataSchema = new Schema<GiftCardMetadata>(
  {
    occasion: { type: String },
    message: { type: String },
    design: { type: String },
  },
  { _id: false }
);

const GiftCardIssuedToSchema = new Schema(
  {
    customerId: { type: String },
    email: { type: String },
    name: { type: String },
  },
  { _id: false }
);

const giftCardSchema = new Schema<IGiftCard>(
  {
    cardId: { type: String, required: true, unique: true },
    cardNumber: { type: String, required: true, unique: true },
    pin: { type: String, required: true },
    balance: { type: Number, required: true, default: 0 },
    originalValue: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['active', 'redeemed', 'expired', 'cancelled', 'frozen'],
      default: 'active',
    },
    type: {
      type: String,
      enum: ['physical', 'digital'],
      default: 'digital',
    },
    issuedTo: GiftCardIssuedToSchema,
    purchasedBy: GiftCardIssuedToSchema,
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    redeemedAt: { type: Date },
    redemptionStore: { type: String },
    metadata: GiftCardMetadataSchema,
    transactionHistory: [TransactionHistorySchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
giftCardSchema.index({ status: 1, validUntil: 1 });
giftCardSchema.index({ 'issuedTo.customerId': 1 });
giftCardSchema.index({ 'purchasedBy.customerId': 1 });
giftCardSchema.index({ cardNumber: 1 }, { unique: true });

// Pre-save hook to check expiration
giftCardSchema.pre('save', function (next) {
  if (this.status === 'active' && this.validUntil && this.validUntil < new Date()) {
    this.status = 'expired';
  }
  next();
});

export const GiftCard: Model<IGiftCard> = mongoose.model<IGiftCard>('GiftCard', giftCardSchema);

// ============================================================================
// Wallet Schema
// ============================================================================

const walletSchema = new Schema<IWallet>(
  {
    walletId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    giftCardBalances: {
      type: Map,
      of: Number,
      default: {},
    },
    totalGiftCards: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'suspended', 'closed'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

walletSchema.index({ customerId: 1 }, { unique: true });

export const Wallet: Model<IWallet> = mongoose.model<IWallet>('Wallet', walletSchema);

// ============================================================================
// Transaction Schema
// ============================================================================

const PaymentMethodSchema = new Schema<PaymentMethod>(
  {
    type: {
      type: String,
      enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'],
    },
    transactionRef: { type: String },
  },
  { _id: false }
);

const TransactionMetadataSchema = new Schema<TransactionMetadata>(
  {
    orderId: { type: String },
    storeId: { type: String },
    storeName: { type: String },
    customerId: { type: String },
    recipientEmail: { type: String },
    message: { type: String },
  },
  { _id: false }
);

const transactionSchema = new Schema<ITransaction>(
  {
    transactionId: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['purchase', 'redeem', 'refund', 'transfer', 'load', 'expire'],
      required: true,
    },
    giftCardId: { type: String },
    walletId: { type: String },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed',
    },
    paymentMethod: PaymentMethodSchema,
    metadata: TransactionMetadataSchema,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
transactionSchema.index({ giftCardId: 1 });
transactionSchema.index({ walletId: 1 });
transactionSchema.index({ customerId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'metadata.customerId': 1 });
transactionSchema.index({ 'metadata.recipientEmail': 1 });

export const Transaction: Model<ITransaction> = mongoose.model<ITransaction>('Transaction', transactionSchema);

// ============================================================================
// Export all models
// ============================================================================

export const models = {
  GiftCard,
  Wallet,
  Transaction,
};

export default models;

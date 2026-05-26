import { Document } from 'mongoose';
import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const GiftCardStatus = z.enum(['active', 'redeemed', 'expired', 'cancelled', 'frozen']);
export type GiftCardStatus = z.infer<typeof GiftCardStatus>;

export const GiftCardType = z.enum(['physical', 'digital']);
export type GiftCardType = z.infer<typeof GiftCardType>;

export const TransactionType = z.enum(['purchase', 'redeem', 'refund', 'transfer', 'load', 'expire']);
export type TransactionType = z.infer<typeof TransactionType>;

export const TransactionStatus = z.enum(['pending', 'completed', 'failed', 'refunded']);
export type TransactionStatus = z.infer<typeof TransactionStatus>;

export const PaymentMethodType = z.enum(['card', 'upi', 'netbanking', 'wallet', 'cash']);
export type PaymentMethodType = z.infer<typeof PaymentMethodType>;

export const WalletStatus = z.enum(['active', 'suspended', 'closed']);
export type WalletStatus = z.infer<typeof WalletStatus>;

export const TransactionHistoryType = z.enum(['load', 'redeem', 'refund', 'expire', 'cancel']);
export type TransactionHistoryType = z.infer<typeof TransactionHistoryType>;

// ============================================================================
// Input Schemas (Zod)
// ============================================================================

export const IssuedToSchema = z.object({
  customerId: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

export const PurchasedBySchema = IssuedToSchema;

export const CreateGiftCardInputSchema = z.object({
  value: z.number().positive(),
  currency: z.string().default('INR'),
  type: GiftCardType.default('digital'),
  issuedTo: IssuedToSchema.optional(),
  purchasedBy: PurchasedBySchema.optional(),
  validDays: z.number().int().positive().default(365),
  metadata: z.object({
    occasion: z.string().optional(),
    message: z.string().optional(),
    design: z.string().optional(),
  }).optional(),
});

export type CreateGiftCardInput = z.infer<typeof CreateGiftCardInputSchema>;

export const CheckBalanceInputSchema = z.object({
  cardNumber: z.string().min(1),
  pin: z.string().length(4),
});

export type CheckBalanceInput = z.infer<typeof CheckBalanceInputSchema>;

export const RedeemGiftCardInputSchema = z.object({
  amount: z.number().positive(),
  pin: z.string().length(4),
  storeId: z.string().optional(),
  storeName: z.string().optional(),
  orderId: z.string().optional(),
  customerId: z.string().optional(),
});

export type RedeemGiftCardInput = z.infer<typeof RedeemGiftCardInputSchema>;

export const LoadBalanceInputSchema = z.object({
  amount: z.number().positive(),
  pin: z.string().length(4),
});

export type LoadBalanceInput = z.infer<typeof LoadBalanceInputSchema>;

export const CancelGiftCardInputSchema = z.object({
  reason: z.string().optional(),
  pin: z.string().length(4),
});

export type CancelGiftCardInput = z.infer<typeof CancelGiftCardInputSchema>;

export const CustomerQuerySchema = z.object({
  status: GiftCardStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CustomerQuery = z.infer<typeof CustomerQuerySchema>;

export const TransactionQuerySchema = z.object({
  type: TransactionType.optional(),
  giftCardId: z.string().optional(),
  walletId: z.string().optional(),
  customerId: z.string().optional(),
  status: TransactionStatus.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

export const CreateWalletInputSchema = z.object({
  customerId: z.string().min(1),
});

export type CreateWalletInput = z.infer<typeof CreateWalletInputSchema>;

export const UpdateWalletStatusInputSchema = z.object({
  status: WalletStatus,
});

export type UpdateWalletStatusInput = z.infer<typeof UpdateWalletStatusInputSchema>;

// ============================================================================
// Domain Types
// ============================================================================

export interface TransactionHistoryEntry {
  type: TransactionHistoryType;
  amount: number;
  balanceAfter: number;
  transactionId: string;
  timestamp: Date;
  notes?: string;
}

export interface Transaction {
  transactionId: string;
  giftCardId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod?: PaymentMethod;
  metadata?: TransactionMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface GiftCardMetadata {
  occasion?: string;
  message?: string;
  design?: string;
}

export interface PaymentMethod {
  type: PaymentMethodType;
  transactionRef?: string;
}

export interface TransactionMetadata {
  orderId?: string;
  storeId?: string;
  storeName?: string;
  customerId?: string;
  recipientEmail?: string;
  message?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface GiftCardResponse {
  cardId: string;
  cardNumber: string;
  balance: number;
  currency: string;
  validUntil: Date;
  message: string;
}

export interface GiftCardDetailsResponse {
  cardId: string;
  cardNumber: string;
  balance: number;
  originalValue: number;
  currency: string;
  status: GiftCardStatus;
  type: GiftCardType;
  validFrom: Date;
  validUntil: Date;
  issuedTo?: {
    customerId?: string;
    email?: string;
    name?: string;
  };
}

export interface BalanceCheckResponse {
  cardId: string;
  cardNumber: string;
  balance: number;
  currency: string;
  status: GiftCardStatus;
  validUntil: Date;
}

export interface RedemptionResponse {
  transactionId: string;
  amountRedeemed: number;
  newBalance: number;
  status: GiftCardStatus;
}

export interface LoadBalanceResponse {
  transactionId: string;
  amountLoaded: number;
  newBalance: number;
}

export interface CustomerGiftCardsResponse {
  cards: GiftCardDetailsResponse[];
  totalBalance: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CancellationResponse {
  cardId: string;
  status: 'cancelled';
  originalBalance: number;
  transactionId: string;
}

export interface TransactionHistoryResponse {
  cardId: string;
  transactionHistory: TransactionHistoryEntry[];
}

export interface WalletResponse {
  walletId: string;
  customerId: string;
  balance: number;
  currency: string;
  totalGiftCards: number;
  status: WalletStatus;
}

export interface WalletWithGiftCardsResponse {
  wallet: WalletResponse;
  giftCards: Array<{
    cardId: string;
    cardNumber: string;
    balance: number;
    originalValue: number;
    validUntil: Date;
  }>;
}

export interface WalletBalanceResponse {
  customerId: string;
  walletBalance: number;
  giftCardBalance: number;
  totalValue: number;
  activeGiftCards: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TransactionSummary {
  byType: Array<{
    _id: string;
    count: number;
    totalAmount: number;
  }>;
  byStatus: Array<{
    _id: string;
    count: number;
    totalAmount: number;
  }>;
  dailyVolume: Array<{
    _id: string;
    count: number;
    amount: number;
  }>;
}

// ============================================================================
// MongoDB Document Types
// ============================================================================

export interface IGiftCard extends Document {
  cardId: string;
  cardNumber: string;
  pin: string;
  balance: number;
  originalValue: number;
  currency: string;
  status: GiftCardStatus;
  type: GiftCardType;
  issuedTo?: {
    customerId?: string;
    email?: string;
    name?: string;
  };
  purchasedBy?: {
    customerId?: string;
    email?: string;
    name?: string;
  };
  validFrom: Date;
  validUntil?: Date;
  redeemedAt?: Date;
  redemptionStore?: string;
  metadata?: GiftCardMetadata;
  transactionHistory: TransactionHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IWallet extends Document {
  walletId: string;
  customerId: string;
  balance: number;
  currency: string;
  giftCardBalances: Map<string, number>;
  totalGiftCards: number;
  status: WalletStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction extends Document {
  transactionId: string;
  type: TransactionType;
  giftCardId?: string;
  walletId?: string;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod?: PaymentMethod;
  metadata?: TransactionMetadata;
  createdAt: Date;
}

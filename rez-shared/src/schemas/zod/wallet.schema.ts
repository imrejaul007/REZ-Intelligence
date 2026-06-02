/**
 * Wallet API validation schemas
 * WARNING: This file has been synchronized with packages/shared-types
 * All changes must be made to packages/shared-types as the canonical source
 *
 * Validates WalletDebit, WalletCredit, and CoinTransactionResponse requests/responses
 * Canonical coin priority: promo > branded > prive > cashback > referral > rez
 */

import { z } from 'zod';

// ObjectId validation regex
const ObjectIdString = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId');
const DateOrString = z.union([z.date(), z.string()]);

// Coin types enum (6 types with priority ordering)
export const COIN_TYPE = z.enum([
  'promo',
  'branded',
  'prive',
  'cashback',
  'referral',
  'rez',
]);

// Coin transaction types enum
export const COIN_TRANSACTION_TYPE = z.enum([
  'earned',
  'spent',
  'expired',
  'refunded',
  'bonus',
  'branded_award',
]);

// Transaction status enum (canonical: 3 values, no 'cancelled')
export const TRANSACTION_STATUS = z.enum(['pending', 'completed', 'failed']);

// Metadata accepts primitives only
const WalletMetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

// Wallet Balance schema
export const WalletBalanceSchema = z
  .object({
    total: z.number().min(0),
    available: z.number().min(0),
    pending: z.number().min(0),
    cashback: z.number().min(0),
  })
  .strict();

// Coin schema
export const CoinSchema = z
  .object({
    type: COIN_TYPE,
    amount: z.number().min(0),
    isActive: z.boolean(),
    earnedDate: DateOrString.optional(),
    lastUsed: DateOrString.optional(),
    lastEarned: DateOrString.optional(),
    expiryDate: DateOrString.optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be #RRGGBB').optional(),
  })
  .strict();

// Wallet Debit Request (spend coins) - idempotencyKey is REQUIRED
export const WalletDebitSchema = z
  .object({
    user: ObjectIdString,
    amount: z.number().positive('Debit amount must be positive'),
    source: z.string().min(1, 'Source is required'),
    sourceId: z.string().optional(),
    description: z.string().min(1, 'Description is required'),
    merchantId: ObjectIdString.optional(),
    metadata: WalletMetadataSchema.optional(),
    /** REQUIRED - must be unique per logical debit to prevent double-spend */
    idempotencyKey: z.string().min(8, 'idempotencyKey must be at least 8 chars'),
  })
  .strict();

// Wallet Credit Request (earn coins) - idempotencyKey is REQUIRED
export const WalletCreditSchema = z
  .object({
    user: ObjectIdString,
    coinType: COIN_TYPE,
    amount: z.number().positive('Credit amount must be positive'),
    source: z.string().min(1, 'Source is required'),
    sourceId: z.string().optional(),
    description: z.string().min(1, 'Description is required'),
    merchantId: ObjectIdString.optional(),
    expiryDate: DateOrString.optional(),
    metadata: WalletMetadataSchema.optional(),
    /** REQUIRED - must be unique per logical credit to prevent double-credit */
    idempotencyKey: z.string().min(8, 'idempotencyKey must be at least 8 chars'),
  })
  .strict();

// Coin Transaction Response
export const CoinTransactionResponseSchema = z
  .object({
    _id: z.string().optional(),
    user: z.string(),
    type: COIN_TRANSACTION_TYPE,
    coinType: COIN_TYPE,
    amount: z.number().min(0),
    balanceBefore: z.number().min(0),
    balanceAfter: z.number().min(0),
    source: z.string(),
    sourceId: z.string().optional(),
    description: z.string(),
    merchantId: z.string().optional(),
    metadata: WalletMetadataSchema.optional(),
    idempotencyKey: z.string().optional(),
    status: TRANSACTION_STATUS,
    createdAt: DateOrString,
    updatedAt: DateOrString.optional(),
  })
  .strip();

// Coin Transaction List Response
export const CoinTransactionListResponseSchema = z.array(CoinTransactionResponseSchema);

// Wallet Balance Response
export const WalletBalanceResponseSchema = z
  .object({
    user: z.string(),
    balance: WalletBalanceSchema,
    coins: z.array(CoinSchema),
    currency: z.string(),
    isFrozen: z.boolean(),
    isActive: z.boolean(),
    updatedAt: DateOrString.optional(),
  })
  .strip();

// Infer TypeScript types
export type WalletDebitRequest = z.infer<typeof WalletDebitSchema>;
export type WalletCreditRequest = z.infer<typeof WalletCreditSchema>;
export type CoinTransactionResponse = z.infer<typeof CoinTransactionResponseSchema>;
export type CoinTransactionListResponse = z.infer<typeof CoinTransactionListResponseSchema>;
export type WalletBalanceResponse = z.infer<typeof WalletBalanceResponseSchema>;
export type CoinType = z.infer<typeof COIN_TYPE>;
export type CoinTransactionType = z.infer<typeof COIN_TRANSACTION_TYPE>;
export type TransactionStatus = z.infer<typeof TRANSACTION_STATUS>;

// Canonical coin priority order for debit operations
export const COIN_PRIORITY_ORDER: Array<z.infer<typeof COIN_TYPE>> = [
  'promo',
  'branded',
  'prive',
  'cashback',
  'referral',
  'rez',
];

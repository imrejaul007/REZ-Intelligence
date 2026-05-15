import { z } from 'zod';
import { Document, Types } from 'mongoose';

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export enum ItemStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  FAILED = 'failed',
  CONFLICT = 'conflict',
}

export enum SyncSource {
  POS = 'pos',
  ADMIN = 'admin',
  API = 'api',
  IMPORT = 'import',
}

export enum SyncType {
  FULL = 'full',
  DELTA = 'delta',
  WEBHOOK = 'webhook',
}

export enum SyncLogStatus {
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPLETED_WITH_ERRORS = 'completed_with_errors',
}

export enum POSSystemType {
  CUSTOM = 'custom',
  JUICE = 'juice',
  RECONSTITUTION = 'reconstitution',
  PETPOOJA = 'petpooja',
  RATANGIRI = 'ratangiri',
}

export enum AggregatorName {
  SWIGGY = 'swiggy',
  ZOMATO = 'zomato',
  MAGICPIN = 'magicpin',
  DTC = 'dtc',
}

export enum ConflictResolution {
  POS_WINS = 'pos_wins',
  API_WINS = 'api_wins',
  MANUAL = 'manual',
}

export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
}

export enum POSConfigStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
}

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const StockSchema = z.object({
  quantity: z.number().min(0).default(0),
  reserved: z.number().min(0).default(0),
  available: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(10),
  maxStock: z.number().optional(),
});

export const SyncTrackingSchema = z.object({
  source: z.nativeEnum(SyncSource).default(SyncSource.POS),
  lastSync: z.date().optional(),
  status: z.nativeEnum(SyncStatus).default(SyncStatus.SYNCED),
  error: z.string().optional(),
  version: z.number().min(1).default(1),
});

export const DemandSignalsSchema = z.object({
  dailyAvg: z.number().min(0).default(0),
  peakDay: z.number().min(0).max(6).default(0),
  velocity: z.number().min(0).default(0),
  trend: z.nativeEnum(TrendDirection).default(TrendDirection.STABLE),
});

export const PredictionsSchema = z.object({
  stockoutDate: z.date().optional(),
  reorderDate: z.date().optional(),
  daysOfStockLeft: z.number().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const ExternalRefsSchema = z.object({
  posItemId: z.string().optional(),
  aggregatorItemId: z.string().optional(),
  menuItemId: z.string().optional(),
});

export const VariantSchema = z.object({
  variantId: z.string().optional(),
  name: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().optional(),
});

export const InventoryItemSchema = z.object({
  itemId: z.string(),
  merchantId: z.string(),
  name: z.string(),
  sku: z.string().optional(),
  category: z.string().optional(),
  variants: z.array(VariantSchema).optional(),
  stock: StockSchema,
  status: z.nativeEnum(ItemStatus).default(ItemStatus.IN_STOCK),
  sync: SyncTrackingSchema,
  demand: DemandSignalsSchema,
  predictions: PredictionsSchema,
  externalRefs: ExternalRefsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  lastUpdated: z.date().optional(),
});

export const SyncErrorSchema = z.object({
  itemId: z.string(),
  error: z.string(),
});

export const SyncLogSchema = z.object({
  syncId: z.string(),
  merchantId: z.string(),
  source: z.string().optional(),
  type: z.nativeEnum(SyncType).optional(),
  status: z.nativeEnum(SyncLogStatus),
  itemsProcessed: z.number().default(0),
  errors: z.array(SyncErrorSchema).default([]),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  duration: z.number().optional(),
});

export const POSAggregatorConfigSchema = z.object({
  name: z.nativeEnum(AggregatorName),
  enabled: z.boolean().default(false),
  apiUrl: z.string().optional(),
  apiKey: z.string().optional(),
  lastSync: z.date().optional(),
});

export const POSConfigSchema = z.object({
  merchantId: z.string(),
  pos: z.object({
    type: z.nativeEnum(POSSystemType).default(POSSystemType.CUSTOM),
    apiUrl: z.string().optional(),
    apiKey: z.string().optional(),
    pollingInterval: z.number().default(300000),
  }),
  aggregators: z.array(POSAggregatorConfigSchema).default([]),
  rules: z.object({
    autoUpdate: z.boolean().default(true),
    lowStockThreshold: z.number().default(10),
    syncOnOrder: z.boolean().default(true),
    conflictResolution: z.nativeEnum(ConflictResolution).default(ConflictResolution.POS_WINS),
  }),
  lastSync: z.date().optional(),
  status: z.nativeEnum(POSConfigStatus).default(POSConfigStatus.ACTIVE),
});

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type Stock = z.infer<typeof StockSchema>;
export type SyncTracking = z.infer<typeof SyncTrackingSchema>;
export type DemandSignals = z.infer<typeof DemandSignalsSchema>;
export type Predictions = z.infer<typeof PredictionsSchema>;
export type ExternalRefs = z.infer<typeof ExternalRefsSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type InventoryItemInput = z.infer<typeof InventoryItemSchema>;
export type SyncError = z.infer<typeof SyncErrorSchema>;
export type SyncLogInput = z.infer<typeof SyncLogSchema>;
export type POSAggregatorConfig = z.infer<typeof POSAggregatorConfigSchema>;
export type POSConfigInput = z.infer<typeof POSConfigSchema>;

// Mongoose Document types
export interface IInventoryItem extends Document {
  itemId: string;
  merchantId: string;
  name: string;
  sku?: string;
  category?: string;
  variants?: Variant[];
  stock: Stock;
  status: ItemStatus;
  sync: SyncTracking;
  demand: DemandSignals;
  predictions: Predictions;
  externalRefs?: ExternalRefs;
  metadata?: Record<string, unknown>;
  lastUpdated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISyncLog extends Document {
  syncId: string;
  merchantId: string;
  source?: string;
  type?: SyncType;
  status: SyncLogStatus;
  itemsProcessed: number;
  errors: SyncError[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPOSConfig extends Document {
  merchantId: string;
  pos: {
    type: POSSystemType;
    apiUrl?: string;
    apiKey?: string;
    pollingInterval: number;
  };
  aggregators: POSAggregatorConfig[];
  rules: {
    autoUpdate: boolean;
    lowStockThreshold: number;
    syncOnOrder: boolean;
    conflictResolution: ConflictResolution;
  };
  lastSync?: Date;
  status: POSConfigStatus;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface InventoryAlert {
  type: string;
  severity: 'warning' | 'critical';
  itemId: string;
  name: string;
  status: ItemStatus;
  available: number;
  daysOfStockLeft?: number;
  recommendedAction: string;
}

export interface InventoryAnalytics {
  totalItems: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  critical: number;
  criticalItems: Array<{
    itemId: string;
    name: string;
    daysOfStockLeft?: number;
  }>;
}

export interface StockPrediction {
  stockoutDate?: Date;
  daysOfStockLeft: number | null;
  confidence: number;
}

export interface SaleRecord {
  date: Date | string;
  quantity: number;
}

// Request/Response Types
export interface SyncItemRequest {
  merchantId: string;
  item: Partial<InventoryItemInput>;
}

export interface FullSyncRequest {
  merchantId: string;
  items: Partial<InventoryItemInput>[];
}

export interface UpdateStockRequest {
  stock?: Partial<Stock>;
  status?: ItemStatus;
  reorderPoint?: number;
}

import { z } from 'zod';

/**
 * Inventory Types for REZ Inventory Intelligence Service
 * Comprehensive type definitions for inventory management, forecasting, and optimization
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum ForecastMethod {
  SIMPLE_MOVING_AVERAGE = 'simple_moving_average',
  WEIGHTED_MOVING_AVERAGE = 'weighted_moving_average',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  LINEAR_REGRESSION = 'linear_regression',
  SEASONAL_DECOMPOSITION = 'seasonal_decomposition',
}

export enum ABCClassification {
  A = 'A', // High value, low quantity (80% of value, 20% of items)
  B = 'B', // Medium value, medium quantity
  C = 'C', // Low value, high quantity (5% of value, 50% of items)
}

export enum InventoryStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  OVERSTOCKED = 'overstocked',
  DISCONTINUED = 'discontinued',
}

export enum DemandPattern {
  CONSTANT = 'constant',
  TRENDING = 'trending',
  SEASONAL = 'seasonal',
  IRREGULAR = 'irregular',
}

// ============================================================================
// ZOD SCHEMAS (Input Validation)
// ============================================================================

export const SKUParamsSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
});

export const SupplierIdParamsSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required').max(100),
});

export const ForecastQuerySchema = z.object({
  horizon: z.coerce.number().int().min(1).max(365).default(30),
  method: z.nativeEnum(ForecastMethod).default(ForecastMethod.EXPONENTIAL_SMOOTHING),
  confidenceLevel: z.coerce.number().min(0.01).max(0.99).default(0.95),
});

export const ReorderQuerySchema = z.object({
  daysUntilStockout: z.coerce.number().int().min(1).max(90).default(14),
  considerSeasonality: z.coerce.boolean().default(true),
  serviceLevel: z.coerce.number().min(0.5).max(0.999).default(0.95),
});

export const OptimizeQuerySchema = z.object({
  targetTurnsPerYear: z.coerce.number().min(1).max(52).default(12),
  holdingCostPercent: z.coerce.number().min(0).max(100).default(25),
});

export const SyncOrdersSchema = z.object({
  orders: z.array(z.object({
    orderId: z.string(),
    sku: z.string(),
    quantity: z.number().int().positive(),
    orderDate: z.string().datetime(),
    customerId: z.string().optional(),
    storeId: z.string().optional(),
    channel: z.enum(['online', 'offline', 'wholesale']).default('online'),
  })).min(1),
  syncType: z.enum(['incremental', 'full']).default('incremental'),
});

export const ABCAnalysisQuerySchema = z.object({
  category: z.string().optional(),
  storeId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(1000),
});

// ============================================================================
// INTERFACES
// ============================================================================

export interface DemandDataPoint {
  date: Date;
  quantity: number;
  revenue?: number;
}

export interface ForecastResult {
  sku: string;
  method: ForecastMethod;
  predictions: ForecastPrediction[];
  modelMetrics: ForecastMetrics;
  seasonality?: SeasonalDecomposition;
  generatedAt: Date;
}

export interface ForecastPrediction {
  date: Date;
  predictedQuantity: number;
  lowerBound: number;
  upperBound: number;
  confidenceLevel: number;
}

export interface ForecastMetrics {
  mae: number;           // Mean Absolute Error
  mape: number;          // Mean Absolute Percentage Error
  rmse: number;          // Root Mean Square Error
  rSquared: number;      // Coefficient of Determination
  bias: number;          // Forecast Bias
  theilU: number;        // Theil's U statistic
}

export interface SeasonalDecomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonalIndices: number[]; // 7 for weekly, 12 for monthly
  period: number;
}

export interface ReorderSuggestion {
  sku: string;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;
  daysUntilStockout: number;
  suggestedOrderDate: Date;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  supplierId?: string;
  estimatedCost: number;
  metAtDate?: Date;
}

export interface SafetyStockCalculation {
  sku: string;
  safetyStock: number;
  serviceLevel: number;
  averageDemand: number;
  demandStdDev: number;
  leadTimeDays: number;
  leadTimeStdDev: number;
  zScore: number;
  formula: 'standard' | 'probability' | 'extended';
}

export interface ReorderPointCalculation {
  sku: string;
  reorderPoint: number;
  safetyStock: number;
  averageLeadTimeDemand: number;
  leadTimeDays: number;
  serviceLevel: number;
  isAboveStock: boolean;
}

export interface StockOptimization {
  sku: string;
  currentStock: number;
  optimizedStock: number;
  targetStock: number;
  minStock: number;
  maxStock: number;
  economicOrderQuantity: number;
  currentTurnsPerYear: number;
  targetTurnsPerYear: number;
  holdingCostPerUnit: number;
  orderCostPerOrder: number;
  recommendations: string[];
}

export interface ABCAnalysisResult {
  classifications: ABCClassificationItem[];
  summary: ABCSummary;
  fastMovers: ABCClassificationItem[];
  slowMovers: ABCClassificationItem[];
  generatedAt: Date;
}

export interface ABCClassificationItem {
  sku: string;
  category: string;
  annualDemand: number;
  unitCost: number;
  annualValue: number;
  cumulativeValue: number;
  cumulativePercentage: number;
  classification: ABCClassification;
  velocity: 'fast' | 'medium' | 'slow';
  suggestedReorderFrequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  turnRate: number;
}

export interface ABCSummary {
  totalSkus: number;
  totalValue: number;
  classACount: number;
  classACoverage: number;
  classAValue: number;
  classBCount: number;
  classBCoverage: number;
  classBValue: number;
  classCCount: number;
  classCCoverage: number;
  classCValue: number;
}

export interface SupplierLeadTime {
  supplierId: string;
  supplierName: string;
  sku: string;
  averageLeadTimeDays: number;
  minLeadTimeDays: number;
  maxLeadTimeDays: number;
  stdDeviation: number;
  reliabilityScore: number;
  leadTimeHistory: LeadTimeDataPoint[];
  seasonalPatterns: SeasonalLeadTime[];
  updatedAt: Date;
}

export interface LeadTimeDataPoint {
  date: Date;
  leadTimeDays: number;
  onTime: boolean;
  quantity: number;
}

export interface SeasonalLeadTime {
  month: number;
  averageLeadTimeDays: number;
  historicalVariation: number;
}

export interface InventoryTurnAnalysis {
  sku: string;
  currentTurnsPerYear: number;
  targetTurnsPerYear: number;
  averageInventory: number;
  costOfGoodsSold: number;
  daysOnHand: number;
  ageOfInventory: InventoryAgeBucket[];
  recommendations: string[];
  healthScore: number;
}

export interface InventoryAgeBucket {
  range: string;
  quantity: number;
  percentage: number;
  value: number;
}

export interface ProductMaster {
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  unitCost: number;
  unitPrice: number;
  supplierId: string;
  leadTimeDays: number;
  minimumOrderQuantity: number;
  reorderPoint: number;
  safetyStock: number;
  currentStock: number;
  reorderQuantity: number;
  status: InventoryStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderData {
  orderId: string;
  sku: string;
  quantity: number;
  orderDate: Date;
  customerId?: string;
  storeId?: string;
  channel: 'online' | 'offline' | 'wholesale';
}

export interface SyncResult {
  success: boolean;
  syncedOrders: number;
  skippedOrders: number;
  errors: SyncError[];
  lastSyncDate: Date;
}

export interface SyncError {
  orderId: string;
  error: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: Date;
  checks: {
    database: boolean;
    cache?: boolean;
  };
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface ForecastConfig {
  historyDays: number;
  seasonalityWeeks: number;
  confidenceLevel: number;
  methods: {
    default: ForecastMethod;
    fallback: ForecastMethod[];
  };
}

export interface OptimizationConfig {
  safetyStockServiceLevel: number;
  reorderPointServiceLevel: number;
  targetTurnsPerYear: number;
  holdingCostPercent: number;
  orderCostPerOrder: number;
}

export interface ServiceConfig {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  redisUrl?: string;
  internalServiceToken: string;
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  orderServiceUrl: string;
  authServiceUrl: string;
  forecast: ForecastConfig;
  optimization: OptimizationConfig;
}

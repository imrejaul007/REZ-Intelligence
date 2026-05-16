import { z } from 'zod';

// Stock Status
export const StockStatusSchema = z.enum(['IN_STOCK', 'LOW_STOCK', 'CRITICAL', 'OUT_OF_STOCK', 'OVERSTOCKED']);
export type StockStatus = z.infer<typeof StockStatusSchema>;

// Inventory Insight Types
export const InventoryInsightSchema = z.object({
  productId: z.string(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  stockLevel: z.number().int().nonnegative(),
  stockStatus: StockStatusSchema,
  velocity: z.number(), // Units sold per day
  velocityTrend: z.enum(['INCREASING', 'STABLE', 'DECREASING']).optional(),
  reorderPoint: z.number().int().nonnegative(),
  reorderQuantity: z.number().int().nonnegative().optional(),
  daysUntilStockout: z.number().optional(),
  demandForecast: z.object({
    daily: z.number(),
    weekly: z.number(),
    monthly: z.number(),
    confidence: z.number().min(0).max(1),
  }).optional(),
  supplierLeadTime: z.number().int().nonnegative().optional(),
  supplier: z.string().optional(),
  lastRestocked: z.string().datetime().optional(),
  lastUpdated: z.string().datetime(),
});

export type InventoryInsight = z.infer<typeof InventoryInsightSchema>;

// Low Stock Alert
export const LowStockAlertSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  sku: z.string().optional(),
  currentStock: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
  shortage: z.number().int(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  daysUntilStockout: z.number(),
  suggestedAction: z.string(),
  supplier: z.string().optional(),
  supplierLeadTime: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
});

export type LowStockAlert = z.infer<typeof LowStockAlertSchema>;

// Demand Forecast
export const DemandForecastSchema = z.object({
  productId: z.string(),
  productName: z.string().optional(),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  forecasts: z.array(z.object({
    date: z.string(),
    predicted: z.number(),
    lower: z.number(),
    upper: z.number(),
    confidence: z.number().min(0).max(1),
  })),
  totalPredicted: z.number(),
  averageVelocity: z.number(),
  seasonality: z.object({
    detected: z.boolean(),
    pattern: z.string().optional(),
    strength: z.number().min(0).max(1).optional(),
  }).optional(),
  factors: z.array(z.object({
    factor: z.string(),
    impact: z.number(),
    description: z.string().optional(),
  })).optional(),
  generatedAt: z.string().datetime(),
});

export type DemandForecast = z.infer<typeof DemandForecastSchema>;

// Velocity Analysis
export const VelocityAnalysisSchema = z.object({
  productId: z.string(),
  productName: z.string().optional(),
  currentVelocity: z.number(),
  averageVelocity: z.number(),
  velocityChange: z.number(), // Percentage change
  velocityTrend: z.enum(['INCREASING', 'STABLE', 'DECREASING']),
  peakHours: z.array(z.object({
    hour: z.number().int().min(0).max(23),
    sales: z.number(),
  })).optional(),
  peakDays: z.array(z.object({
    day: z.string(),
    sales: z.number(),
  })).optional(),
  topRegions: z.array(z.object({
    region: z.string(),
    sales: z.number(),
    percentage: z.number(),
  })).optional(),
  comparisonToCategory: z.object({
    percentile: z.number().min(0).max(100),
    categoryAverage: z.number(),
  }).optional(),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    days: z.number().int(),
  }),
});

export type VelocityAnalysis = z.infer<typeof VelocityAnalysisSchema>;

// Stock Movement
export const StockMovementSchema = z.object({
  productId: z.string(),
  movements: z.array(z.object({
    type: z.enum(['SALE', 'RESTOCK', 'RETURN', 'ADJUSTMENT', 'TRANSFER']),
    quantity: z.number().int(),
    previousStock: z.number().int(),
    newStock: z.number().int(),
    reason: z.string().optional(),
    timestamp: z.string().datetime(),
    reference: z.string().optional(),
  })),
  totalSales: z.number(),
  totalRestocks: z.number(),
  netChange: z.number(),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
});

export type StockMovement = z.infer<typeof StockMovementSchema>;

// API Response Types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

// Pagination
export const PaginationSchema = z.object({
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

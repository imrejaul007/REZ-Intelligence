import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  ProductMaster,
  OrderData,
  DemandDataPoint,
  InventoryStatus,
  SupplierLeadTime,
  LeadTimeDataPoint,
  SeasonalLeadTime,
  InventoryTurnAnalysis,
  InventoryAgeBucket,
} from '../types/inventory.types.js';

/**
 * Product Master Schema
 * Stores master data for all inventory products
 */
export interface IProductMaster extends Document {
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

const ProductMasterSchema = new Schema<IProductMaster>(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    subcategory: {
      type: String,
      index: true,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    supplierId: {
      type: String,
      required: true,
      index: true,
    },
    leadTimeDays: {
      type: Number,
      required: true,
      min: 0,
      default: 7,
    },
    minimumOrderQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    reorderPoint: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    safetyStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reorderQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    status: {
      type: String,
      enum: Object.values(InventoryStatus),
      default: InventoryStatus.IN_STOCK,
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

// Compound indexes for common queries
ProductMasterSchema.index({ category: 1, isActive: 1 });
ProductMasterSchema.index({ supplierId: 1, isActive: 1 });
ProductMasterSchema.index({ status: 1, currentStock: 1 });

/**
 * Order Data Schema
 * Stores historical order data for demand forecasting
 */
export interface IOrderData extends Document {
  orderId: string;
  sku: string;
  quantity: number;
  orderDate: Date;
  customerId?: string;
  storeId?: string;
  channel: 'online' | 'offline' | 'wholesale';
  revenue?: number;
  createdAt: Date;
}

const OrderDataSchema = new Schema<IOrderData>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    orderDate: {
      type: Date,
      required: true,
      index: true,
    },
    customerId: {
      type: String,
      index: true,
    },
    storeId: {
      type: String,
      index: true,
    },
    channel: {
      type: String,
      enum: ['online', 'offline', 'wholesale'],
      default: 'online',
      index: true,
    },
    revenue: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes for time-series queries
OrderDataSchema.index({ sku: 1, orderDate: -1 });
OrderDataSchema.index({ sku: 1, orderDate: 1, storeId: 1 });
OrderDataSchema.index({ orderDate: -1, sku: 1 });

/**
 * Demand Data Schema
 * Aggregated daily demand data for forecasting
 */
export interface IDemandData extends Document {
  sku: string;
  date: Date;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  uniqueCustomers: number;
  channels: {
    online: number;
    offline: number;
    wholesale: number;
  };
  stores: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const DemandDataSchema = new Schema<IDemandData>(
  {
    sku: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    totalRevenue: {
      type: Number,
      required: true,
      min: 0,
    },
    orderCount: {
      type: Number,
      required: true,
      min: 0,
    },
    uniqueCustomers: {
      type: Number,
      required: true,
      min: 0,
    },
    channels: {
      online: { type: Number, default: 0 },
      offline: { type: Number, default: 0 },
      wholesale: { type: Number, default: 0 },
    },
    stores: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

DemandDataSchema.index({ sku: 1, date: -1 });
DemandDataSchema.index({ sku: 1, date: 1 }, { unique: true });

/**
 * Forecast Cache Schema
 * Stores pre-computed forecasts for quick retrieval
 */
export interface IForecastCache extends Document {
  sku: string;
  method: string;
  horizon: number;
  predictions: Array<{
    date: Date;
    predictedQuantity: number;
    lowerBound: number;
    upperBound: number;
    confidenceLevel: number;
  }>;
  metrics: {
    mae: number;
    mape: number;
    rmse: number;
    rSquared: number;
    bias: number;
  };
  expiresAt: Date;
  createdAt: Date;
}

const ForecastCacheSchema = new Schema<IForecastCache>({
  sku: {
    type: String,
    required: true,
    index: true,
  },
  method: {
    type: String,
    required: true,
  },
  horizon: {
    type: Number,
    required: true,
  },
  predictions: [
    {
      date: Date,
      predictedQuantity: Number,
      lowerBound: Number,
      upperBound: Number,
      confidenceLevel: Number,
    },
  ],
  metrics: {
    mae: Number,
    mape: Number,
    rmse: Number,
    rSquared: Number,
    bias: Number,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ForecastCacheSchema.index({ sku: 1, method: 1, horizon: 1 }, { unique: true });
ForecastCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Supplier Lead Time Schema
 * Tracks supplier performance and lead time patterns
 */
export interface ISupplierLeadTime extends Document {
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

const LeadTimeDataPointSchema = new Schema<LeadTimeDataPoint>(
  {
    date: { type: Date, required: true },
    leadTimeDays: { type: Number, required: true, min: 0 },
    onTime: { type: Boolean, required: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SeasonalLeadTimeSchema = new Schema<SeasonalLeadTime>(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    averageLeadTimeDays: { type: Number, required: true, min: 0 },
    historicalVariation: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SupplierLeadTimeSchema = new Schema<ISupplierLeadTime>(
  {
    supplierId: {
      type: String,
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
      index: true,
    },
    averageLeadTimeDays: {
      type: Number,
      required: true,
      min: 0,
    },
    minLeadTimeDays: {
      type: Number,
      required: true,
      min: 0,
    },
    maxLeadTimeDays: {
      type: Number,
      required: true,
      min: 0,
    },
    stdDeviation: {
      type: Number,
      required: true,
      min: 0,
    },
    reliabilityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    leadTimeHistory: [LeadTimeDataPointSchema],
    seasonalPatterns: [SeasonalLeadTimeSchema],
  },
  {
    timestamps: { updatedAt: true, createdAt: false },
  }
);

SupplierLeadTimeSchema.index({ supplierId: 1, sku: 1 }, { unique: true });

/**
 * Inventory Analysis Schema
 * Stores pre-computed ABC classifications and turn rates
 */
export interface IInventoryAnalysis extends Document {
  sku: string;
  category: string;
  storeId?: string;
  annualDemand: number;
  unitCost: number;
  annualValue: number;
  cumulativeValue: number;
  cumulativePercentage: number;
  abcClassification: 'A' | 'B' | 'C';
  velocity: 'fast' | 'medium' | 'slow';
  turnRate: number;
  daysOnHand: number;
  generatedAt: Date;
  expiresAt: Date;
}

const InventoryAnalysisSchema = new Schema<IInventoryAnalysis>({
  sku: {
    type: String,
    required: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
    index: true,
  },
  storeId: {
    type: String,
    index: true,
  },
  annualDemand: {
    type: Number,
    required: true,
    min: 0,
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0,
  },
  annualValue: {
    type: Number,
    required: true,
    min: 0,
  },
  cumulativeValue: {
    type: Number,
    required: true,
    min: 0,
  },
  cumulativePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  abcClassification: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true,
  },
  velocity: {
    type: String,
    enum: ['fast', 'medium', 'slow'],
    required: true,
  },
  turnRate: {
    type: Number,
    required: true,
    min: 0,
  },
  daysOnHand: {
    type: Number,
    required: true,
    min: 0,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
});

InventoryAnalysisSchema.index({ sku: 1, category: 1, storeId: 1 }, { unique: true });
InventoryAnalysisSchema.index({ abcClassification: 1, velocity: 1 });
InventoryAnalysisSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============================================================================
// MODEL EXPORTS
// ============================================================================

export const ProductMaster = mongoose.model<IProductMaster>(
  'ProductMaster',
  ProductMasterSchema
);

export const OrderData = mongoose.model<IOrderData>('OrderData', OrderDataSchema);

export const DemandData = mongoose.model<IDemandData>('DemandData', DemandDataSchema);

export const ForecastCache = mongoose.model<IForecastCache>(
  'ForecastCache',
  ForecastCacheSchema
);

export const SupplierLeadTime = mongoose.model<ISupplierLeadTime>(
  'SupplierLeadTime',
  SupplierLeadTimeSchema
);

export const InventoryAnalysis = mongoose.model<IInventoryAnalysis>(
  'InventoryAnalysis',
  InventoryAnalysisSchema
);

// Type-safe model types
export type ProductMasterModel = Model<IProductMaster>;
export type OrderDataModel = Model<IOrderData>;
export type DemandDataModel = Model<IDemandData>;
export type ForecastCacheModel = Model<IForecastCache>;
export type SupplierLeadTimeModel = Model<ISupplierLeadTime>;
export type InventoryAnalysisModel = Model<IInventoryAnalysis>;

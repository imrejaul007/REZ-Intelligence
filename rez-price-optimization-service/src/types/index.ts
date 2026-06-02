/**
 * Dynamic Pricing Engine - Type Definitions
 * ReZ Price Optimization Service
 */

export interface BaseProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  basePrice: number;
  cost: number;
  margin: number;
}

export interface TimeContext {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hourOfDay: number; // 0-23
  isPeakHour: boolean;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  isHoliday: boolean;
  isEventDay: boolean;
}

export interface InventoryContext {
  stockLevel: number;
  maxStock: number;
  stockPercentage: number;
  daysUntilExpiry: number | null;
  expiryThresholdDays: number;
  overstockThresholdDays: number;
  reorderPoint: number;
}

export interface DemandContext {
  currentDemand: number; // 0-1 normalized
  predictedDemand: number; // 0-1 normalized
  historicalAverage: number;
  realTimeInterest: number; // 0-1 normalized
  trend: 'increasing' | 'stable' | 'decreasing';
  confidence: number; // 0-1
}

export interface CompetitionContext {
  competitorPrices: CompetitorPrice[];
  marketPosition: 'premium' | 'mid-market' | 'economy';
  averageCompetitorPrice: number;
  priceDifference: number; // percentage difference from average
}

export interface CompetitorPrice {
  competitorId: string;
  competitorName: string;
  price: number;
  lastUpdated: Date;
  distance?: number; // km away
}

export interface PriceCalculationInput {
  product: BaseProduct;
  time: TimeContext;
  inventory: InventoryContext;
  demand: DemandContext;
  competition: CompetitionContext;
}

export interface PriceFactor {
  name: string;
  category: 'time' | 'inventory' | 'demand' | 'competition';
  value: number; // percentage as decimal (e.g., 0.1 = 10%)
  weight: number;
  reason: string;
  details?: Record<string, unknown>;
}

export interface PriceBreakdown {
  basePrice: number;
  factors: PriceFactor[];
  totalAdjustment: number;
  finalPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  calculatedAt: Date;
}

export interface PriceOptimizationResult {
  productId: string;
  sku: string;
  pricing: PriceBreakdown;
  recommendations: MerchantRecommendation[];
  metadata: {
    calculationTime: number; // ms
    dataQuality: 'high' | 'medium' | 'low';
    factorsConsidered: string[];
  };
}

export interface MerchantRecommendation {
  id: string;
  type: 'discount' | 'promotion' | 'bundle' | 'restock' | 'marketing';
  title: string;
  description: string;
  potentialImpact: {
    revenueChange: number;
    marginImpact: number;
    unitsAffected: number;
  };
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  actionItems: string[];
  estimatedCompletionDays: number;
}

export interface BulkPricingRequest {
  products: PriceCalculationInput[];
  batchId: string;
}

export interface BulkPricingResponse {
  batchId: string;
  results: PriceOptimizationResult[];
  summary: {
    totalProducts: number;
    averageAdjustment: number;
    highestIncrease: number;
    highestDecrease: number;
    calculationTimeMs: number;
  };
}

export interface HistoricalPriceData {
  productId: string;
  date: Date;
  price: number;
  demand: number;
  sales: number;
  competitorAvg: number;
}

export interface PricingStrategy {
  id: string;
  name: string;
  description: string;
  rules: PricingRule[];
  isActive: boolean;
  priority: number;
  validFrom: Date;
  validTo: Date;
}

export interface PricingRule {
  condition: PricingCondition;
  action: PricingAction;
  priority: number;
}

export interface PricingCondition {
  type: 'inventory_level' | 'demand_level' | 'time_period' | 'competitor_price' | 'category';
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'between';
  value: number | number[];
  productIds?: string[];
  categories?: string[];
}

export interface PricingAction {
  type: 'adjust_price' | 'set_fixed' | 'apply_discount' | 'set_min_max';
  value: number;
  minValue?: number;
  maxValue?: number;
}

export interface PriceAlert {
  id: string;
  productId: string;
  type: 'price_spike' | 'demand_surge' | 'competitor_movement' | 'stock_critical';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: Date;
  acknowledged: boolean;
}

export interface PricingDashboardMetrics {
  totalProducts: number;
  activeOptimizations: number;
  averagePriceAdjustment: number;
  revenueImpact: number;
  marginImpact: number;
  topPerformers: ProductPerformance[];
  alerts: PriceAlert[];
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  priceChanges: number;
  revenueDelta: number;
  marginDelta: number;
  efficiency: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    pricingEngine: boolean;
    demandForecaster: boolean;
    inventoryAnalyzer: boolean;
  };
  timestamp: Date;
  uptime: number;
}

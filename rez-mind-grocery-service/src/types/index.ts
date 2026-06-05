/**
 * ReZ Mind Grocery Service - TypeScript Interfaces
 */

// ==================== Enums ====================

export enum GroceryCategory {
  PRODUCE = 'produce',
  DAIRY = 'dairy',
  BAKERY = 'bakery',
  FROZEN = 'frozen',
  BEVERAGES = 'beverages',
  SNACKS = 'snacks',
  ESSENTIALS = 'essentials',
}

export enum CustomerSegment {
  HEALTH_CONSCIOUS = 'health_conscious',
  VALUE_SEEKER = 'value_seeker',
  ORGANIC_PREFER = 'organic_prefer',
  CONVENIENCE_FOCUSED = 'convenience_focused',
  FRESHNESS_FIRST = 'freshness_first',
  BUDGET_SHOPPER = 'budget_shopper',
}

export enum SuggestedAction {
  DISCOUNT = 'discount',
  DONATE = 'donate',
  REMOVE = 'remove',
  MONITOR = 'monitor',
}

export enum UrgencyLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum TrendDirection {
  TRENDING_UP = 'trending_up',
  STABLE = 'stable',
  TRENDING_DOWN = 'trending_down',
}

// ==================== Core Types ====================

export interface GroceryBasketItem {
  productId: string;
  productName: string;
  category: GroceryCategory;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchDate?: Date;
  expiryDate?: Date;
  imageUrl?: string;
}

export interface CustomerProfile {
  segment: CustomerSegment;
  preferences: string[];
  dietaryRestrictions: string[];
  avgBasketValue: number;
  purchaseFrequency: string;
  preferredCategories: GroceryCategory[];
  priceSensitivity: number;
}

export interface ProductRecommendation {
  productId: string;
  productName: string;
  category: GroceryCategory;
  confidence: number;
  reason: string;
  price?: number;
  imageUrl?: string;
  relevanceScore: number;
  urgency?: UrgencyLevel;
}

export interface ExpiryPrediction {
  predictionId: string;
  productId: string;
  productName: string;
  predictedExpiryDate: Date;
  daysRemaining: number;
  confidence: number;
  suggestedAction: SuggestedAction;
  suggestedDiscount?: number;
  reasoning: string;
}

export interface DemandForecast {
  forecastId: string;
  productId: string;
  productName: string;
  predictedQuantity: number;
  confidence: number;
  dateRange: {
    from: Date;
    to: Date;
  };
  actualQuantity?: number;
  accuracy?: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  trend: TrendDirection;
  seasonality?: {
    factor: number;
    peakMonths: string[];
  };
}

export interface SupplierScore {
  supplierId: string;
  supplierName: string;
  overallScore: number;
  reliabilityScore: number;
  qualityScore: number;
  priceScore: number;
  sustainabilityScore: number;
  onTimeDeliveryRate: number;
  orderAccuracy: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  lastEvaluated: Date;
}

export interface BasketInsight {
  crossSellProducts: CrossSellOpportunity[];
  savingsTips: SavingsTip[];
  categoryGaps: CategoryGap[];
  totalPotentialSavings: number;
}

export interface CrossSellOpportunity {
  primaryProduct: string;
  crossSellProducts: string[];
  bundleDiscount?: number;
  confidence: number;
  reason: string;
}

export interface SavingsTip {
  type: 'bundle' | 'promotion' | 'bulk' | 'loyalty';
  description: string;
  potentialSavings: number;
  applicableProducts: string[];
}

export interface CategoryGap {
  category: GroceryCategory;
  missingProducts: string[];
  reason: string;
}

export interface ExpiryAlert {
  alertId: string;
  productId: string;
  productName: string;
  currentStock: number;
  predictedExpiryDate: Date;
  daysRemaining: number;
  urgency: UrgencyLevel;
  message: string;
  recommendedAction: SuggestedAction;
  suggestedDiscount?: number;
}

export interface DemandSignal {
  type: 'seasonal' | 'promotional' | 'weather' | 'social_trend' | 'event';
  value: number;
  timestamp: Date;
  source: string;
  affectedProducts: string[];
}

export interface SavingsOpportunity {
  type: 'bulk_discount' | 'bundle' | 'promotion' | 'loyalty' | 'waste_reduction';
  description: string;
  potentialSavings: number;
  products: string[];
  confidence: number;
}

// ==================== Session Types ====================

export interface GroceryMindSessionData {
  sessionId: string;
  merchantId: string;
  customerId?: string;
  intent: string;
  context: {
    recentProducts: string[];
    avgBasketValue: number;
    preferredCategories: GroceryCategory[];
  };
  analysis: {
    recommendedProducts: ProductRecommendation[];
    expiryAlerts: ExpiryAlert[];
    demandSignals: DemandSignal[];
    supplierSuggestions: SupplierScore[];
    savingsOpportunities: SavingsOpportunity[];
  };
  sentiment?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== API Request/Response Types ====================

export interface ConsultRequest {
  merchantId: string;
  customerId?: string;
  basketItems?: GroceryBasketItem[];
  preferences?: string[];
}

export interface ConsultResponse {
  sessionId: string;
  recommendations: ProductRecommendation[];
  expiryAlerts: ExpiryAlert[];
  demandSignals: DemandSignal[];
  supplierSuggestions: SupplierScore[];
  savingsOpportunities: SavingsOpportunity[];
  confidence: number;
}

export interface ExpiryPredictionRequest {
  merchantId: string;
  productId: string;
  batchDate?: Date;
  storageConditions?: {
    temperature: number;
    humidity: number;
    refrigerated: boolean;
  };
}

export interface ExpirySimulationRequest {
  merchantId: string;
  productId: string;
  discountPercentage: number;
  currentStock: number;
}

export interface ExpirySimulationResponse {
  currentRevenue: number;
  projectedRevenue: number;
  expectedUnitsSold: number;
  wasteReduction: number;
  netImpact: number;
}

export interface DemandForecastRequest {
  merchantId: string;
  productId?: string;
  daysAhead?: number;
  includeHistorical?: boolean;
}

export interface DemandAdjustmentRequest {
  merchantId: string;
  productId: string;
  adjustmentType: 'event' | 'promotion' | 'seasonal' | 'supply_issue';
  adjustmentValue: number;
  reason: string;
}

export interface SupplierOptimizationRequest {
  merchantId: string;
  productCategories?: GroceryCategory[];
  prioritizeCriteria?: string[];
}

// ==================== Analytics Types ====================

export interface FreshnessScore {
  productId: string;
  productName: string;
  score: number;
  confidence: number;
  factors: {
    daysUntilExpiry: number;
    storageQuality: number;
    handlingScore: number;
  };
  recommendations: string[];
}

export interface WasteAnalysis {
  totalWasteValue: number;
  wastePercentage: number;
  topWasteCategories: Array<{
    category: GroceryCategory;
    value: number;
    percentage: number;
  }>;
  wasteReductionOpportunities: string[];
  potentialSavings: number;
}

export interface InventoryHealth {
  overallHealth: string;
  healthScore: number;
  metrics: {
    expiringItems: number;
    lowStockItems: number;
    overstockItems: number;
  };
  alerts: string[];
  recommendations: string[];
}

// ==================== Health Check Types ====================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface DependencyHealth {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}
/**
 * ReZ Mind Retail Service - TypeScript Interfaces
 */

// ==================== Enums ====================

export enum CustomerSegment {
  BARGAIN_HUNTER = 'bargain_hunter',
  PREMIUM_BUYER = 'premium_buyer',
  OCCASIONAL = 'occasional',
  ROUTINE = 'routine',
  FIRST_TIMER = 'first_timer',
}

export enum ProductCategory {
  ELECTRONICS = 'electronics',
  FASHION = 'fashion',
  GROCERY = 'grocery',
  HOME = 'home',
  FURNITURE = 'furniture',
  BEAUTY = 'beauty',
  SPORTS = 'sports',
  TOYS = 'toys',
  BOOKS = 'books',
}

export enum InsightType {
  TRENDING = 'trending',
  SLOW_MOVING = 'slow_moving',
  SEASONAL = 'seasonal',
  BUNDLE = 'bundle',
  OPPORTUNITY = 'opportunity',
}

export enum StrategyType {
  COMPETITIVE = 'competitive',
  MARGIN = 'margin',
  PSYCHOLOGICAL = 'psychological',
  SEASONAL = 'seasonal',
  BUNDLE = 'bundle',
}

export enum StrategyStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum UrgencyLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum LifecycleStage {
  NEW_PRODUCT = 'new_product',
  GROWTH = 'growth',
  MATURITY = 'maturity',
  DECLINE = 'decline',
}

export enum TrendDirection {
  TRENDING_UP = 'trending_up',
  STABLE = 'stable',
  TRENDING_DOWN = 'trending_down',
}

// ==================== Core Types ====================

export interface CustomerProfile {
  segment: CustomerSegment;
  preferences: string[];
  avgOrderValue: number;
  purchaseFrequency: string;
  loyaltyTier?: string;
  preferredCategories: ProductCategory[];
  priceSensitivity: number; // 0-1 scale
}

export interface PurchaseHistory {
  customerId: string;
  orders: OrderSummary[];
  totalSpent: number;
  orderCount: number;
  avgOrderValue: number;
  lastPurchaseDate: Date;
  favoriteCategories: ProductCategory[];
}

export interface OrderSummary {
  orderId: string;
  orderDate: Date;
  totalAmount: number;
  items: CartItem[];
  status: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
}

export interface ProductRecommendation {
  productId: string;
  productName: string;
  category: ProductCategory;
  confidence: number; // 0-1
  reason: string;
  price?: number;
  imageUrl?: string;
  relevanceScore: number; // 0-100
  urgency?: UrgencyLevel;
}

export interface UpsellOpportunity {
  originalProduct: CartItem;
  upsellProduct: ProductRecommendation;
  savings?: number;
  confidence: number;
  reason: string;
}

export interface CrossSellOpportunity {
  primaryProduct: string;
  crossSellProducts: string[];
  bundleDiscount?: number;
  confidence: number;
}

export interface PricingSuggestion {
  productId: string;
  currentPrice: number;
  suggestedPrice: number;
  priceChange: number; // percentage
  reason: string;
  expiresAt?: Date;
}

export interface InventoryAlert {
  productId: string;
  productName: string;
  currentStock: number;
  daysRemaining: number;
  urgency: UrgencyLevel;
  message: string;
  recommendedAction: string;
}

export interface ProductInsight {
  insightId: string;
  merchantId: string;
  productId: string;
  type: InsightType;
  score: number; // 0-100
  confidence: number; // 0-1
  description: string;
  recommendations: string[];
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingStrategy {
  strategyId: string;
  merchantId: string;
  productId?: string;
  categoryId?: string;
  strategyType: StrategyType;
  currentPrice: number;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  triggers: PricingTrigger[];
  status: StrategyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingTrigger {
  type: 'competitor_price' | 'demand' | 'inventory' | 'seasonal' | 'time';
  condition: string;
  threshold?: number;
  action: 'increase' | 'decrease' | 'maintain';
  amount?: number;
}

export interface InventoryForecast {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  daysOfSupply: number;
  reorderPoint: number;
  recommendedOrderQuantity: number;
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

export interface DemandSignal {
  type: 'search_volume' | 'sales_velocity' | 'social_trend' | 'seasonal' | 'promotion';
  value: number;
  timestamp: Date;
  source: string;
}

export interface CompetitorPrice {
  competitorId: string;
  competitorName: string;
  price: number;
  lastUpdated: Date;
}

// ==================== Session Types ====================

export interface RetailMindSessionData {
  sessionId: string;
  merchantId: string;
  customerId?: string;
  customerProfile: CustomerProfile;
  cartItems?: CartItem[];
  analysis: SessionAnalysis;
  sentimentScore?: number;
  nextBestAction?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionAnalysis {
  recommendedProducts: ProductRecommendation[];
  upsellOpportunities: UpsellOpportunity[];
  pricingSuggestions: PricingSuggestion[];
  inventoryAlerts: InventoryAlert[];
}

export interface BrowseEvent {
  productId: string;
  productName: string;
  category: ProductCategory;
  viewedAt: Date;
  duration?: number; // seconds
  addedToCart?: boolean;
}

// ==================== API Request/Response Types ====================

export interface ConsultRequest {
  merchantId: string;
  customerId?: string;
  cartItems?: CartItem[];
  preferences?: string[];
  browseHistory?: BrowseEvent[];
}

export interface ConsultResponse {
  sessionId: string;
  recommendations: ProductRecommendation[];
  upsellOpportunities: UpsellOpportunity[];
  pricingSuggestions: PricingSuggestion[];
  inventoryAlerts: InventoryAlert[];
  customerSegment: CustomerSegment;
  nextBestAction: string;
  confidence: number;
}

export interface PricingOptimizationRequest {
  merchantId: string;
  productId: string;
  competitorPrices?: CompetitorPrice[];
  demandSignals?: DemandSignal[];
  inventoryLevel?: number;
}

export interface PricingOptimizationResponse {
  suggestedPrice: number;
  strategy: StrategyType;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  reasoning: string;
}

export interface PersonalizedRecommendationRequest {
  customerId: string;
  merchantId: string;
  limit?: number;
  includeCategories?: ProductCategory[];
  excludeProducts?: string[];
}

// ==================== Analytics Types ====================

export interface CustomerLifetimeValue {
  customerId: string;
  predictedCLV: number;
  confidence: number;
  timeHorizon: '30d' | '90d' | '1y' | '3y';
  factors: {
    avgOrderValue: number;
    purchaseFrequency: number;
    customerAge: number;
    churnProbability: number;
  };
}

export interface TrendingProduct {
  productId: string;
  productName: string;
  category: ProductCategory;
  trendScore: number; // 0-100
  velocity: number; // growth rate
  direction: TrendDirection;
  recentSales: number;
  projectedDemand: number;
  confidence: number;
}

export interface BundleRecommendation {
  bundleId: string;
  bundleName: string;
  products: CartItem[];
  originalTotal: number;
  bundlePrice: number;
  discount: number;
  confidence: number;
  reason: string;
}

// ==================== Health Check Types ====================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface DetailedHealth extends HealthStatus {
  dependencies: {
    mongodb: DependencyHealth;
  };
  memory: MemoryUsage;
  requests: RequestMetrics;
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

export interface RequestMetrics {
  total: number;
  success: number;
  errors: number;
  avgResponseTime: number;
}

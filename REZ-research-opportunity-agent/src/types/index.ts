import { z } from 'zod';

// Enums
export enum OpportunityType {
  CAMPAIGN = 'campaign',
  PRODUCT = 'product',
  SEGMENT = 'segment',
  RETENTION = 'retention',
  UPSELL = 'upsell',
  MARKET = 'market'
}

export enum OpportunityStatus {
  IDENTIFIED = 'identified',
  RECOMMENDED = 'recommended',
  APPROVED = 'approved',
  EXECUTED = 'executed',
  ARCHIVED = 'archived'
}

export enum ExpectedImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum Channel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  VOICE = 'voice',
  DOOH = 'dooh'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertType {
  ANOMALY = 'anomaly',
  TREND = 'trend',
  COMPETITOR = 'competitor',
  OPPORTUNITY = 'opportunity',
  RISK = 'risk'
}

// Zod Schemas for validation
export const RecommendationSchema = z.object({
  action: z.string().min(1),
  channel: z.nativeEnum(Channel),
  targetSegment: z.string().min(1),
  timing: z.string().min(1),
  estimatedReach: z.number().int().positive(),
  estimatedConversion: z.number().min(0).max(100)
});

export const OpportunitySchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(OpportunityType),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  expectedImpact: z.nativeEnum(ExpectedImpact),
  confidence: z.number().min(0).max(100),
  data: z.record(z.unknown()),
  recommendations: z.array(RecommendationSchema),
  createdAt: z.date(),
  status: z.nativeEnum(OpportunityStatus),
  updatedAt: z.date().optional(),
  executedAt: z.date().optional(),
  archivedAt: z.date().optional()
});

// TypeScript Interfaces
export interface Recommendation {
  action: string;
  channel: Channel;
  targetSegment: string;
  timing: string;
  estimatedReach: number;
  estimatedConversion: number;
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  expectedImpact: ExpectedImpact;
  confidence: number;
  data: Record<string, unknown>;
  recommendations: Recommendation[];
  createdAt: Date;
  status: OpportunityStatus;
  updatedAt?: Date;
  executedAt?: Date;
  archivedAt?: Date;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface InsightReport {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  summary: string;
  sections: InsightSection[];
  metrics: Record<string, number>;
  opportunities: string[]; // Opportunity IDs
  alerts: string[]; // Alert IDs
  createdAt: Date;
  periodStart: Date;
  periodEnd: Date;
  createdBy: 'system' | string;
}

export interface InsightSection {
  title: string;
  content: string;
  type: 'analysis' | 'opportunity' | 'alert' | 'metric';
  data?: Record<string, unknown>;
}

// Business Analysis Types
export interface CustomerBehavior {
  segmentId: string;
  segmentName: string;
  totalCustomers: number;
  activeCustomers: number;
  avgPurchaseFrequency: number;
  avgOrderValue: number;
  retentionRate: number;
  churnRate: number;
  topCategories: Array<{ category: string; revenue: number; percentage: number }>;
  trends: {
    growth: number;
    direction: 'up' | 'down' | 'stable';
  };
}

export interface PurchasePattern {
  period: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  repeatPurchaseRate: number;
  avgItemsPerOrder: number;
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  peakHours: Array<{ hour: number; orders: number }>;
  peakDays: Array<{ day: string; orders: number }>;
}

export interface ProductPerformance {
  productId: string;
  name: string;
  category: string;
  revenue: number;
  unitsSold: number;
  avgRating?: number;
  returnRate?: number;
  growthRate: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface ChannelEffectiveness {
  channel: Channel;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
  roi: number;
  ctr: number;
  conversionRate: number;
}

// Market Intelligence Types
export interface CompetitorData {
  competitorId: string;
  name: string;
  products: Array<{
    name: string;
    price: number;
    features: string[];
  }>;
  marketShare?: number;
  pricingStrategy: 'premium' | 'mid-market' | 'budget';
  strengths: string[];
  weaknesses: string[];
  lastUpdated: Date;
}

export interface MarketTrend {
  trendId: string;
  name: string;
  description: string;
  category: string;
  significance: 'low' | 'medium' | 'high';
  growthRate: number;
  source: string;
  detectedAt: Date;
}

export interface PricePosition {
  productId: string;
  productName: string;
  yourPrice: number;
  avgCompetitorPrice: number;
  lowestCompetitorPrice: number;
  highestCompetitorPrice: number;
  position: 'below' | 'at' | 'above' | 'significantly_above';
  priceDifference: number;
  priceDifferencePercent: number;
}

// Research Request/Response Types
export interface BusinessAnalysisRequest {
  period?: { start: Date; end: Date };
  segments?: string[];
  metrics?: string[];
}

export interface BusinessAnalysisResponse {
  customerBehavior: CustomerBehavior[];
  purchasePatterns: PurchasePattern[];
  productPerformance: ProductPerformance[];
  channelEffectiveness: ChannelEffectiveness[];
  summary: string;
  insights: string[];
  generatedAt: Date;
}

export interface CompetitorAnalysisRequest {
  competitors?: string[];
  focus?: Array<'pricing' | 'products' | 'marketing' | 'positioning'>;
}

export interface CompetitorAnalysisResponse {
  competitors: CompetitorData[];
  marketTrends: MarketTrend[];
  pricePositions: PricePosition[];
  gaps: Array<{
    type: string;
    description: string;
    opportunity: string;
    confidence: number;
  }>;
  summary: string;
  generatedAt: Date;
}

export interface SegmentAnalysisRequest {
  segmentIds?: string[];
  includeRFM?: boolean;
}

export interface SegmentAnalysisResponse {
  segments: Array<{
    id: string;
    name: string;
    size: number;
    revenue: number;
    avgOrderValue: number;
    purchaseFrequency: number;
    churnRisk: 'low' | 'medium' | 'high';
    growthPotential: 'low' | 'medium' | 'high';
    recommendedActions: string[];
  }>;
  summary: string;
  generatedAt: Date;
}

// Query Types
export interface NaturalLanguageQueryRequest {
  query: string;
  context?: Record<string, unknown>;
}

export interface NaturalLanguageQueryResponse {
  answer: string;
  confidence: number;
  sources: string[];
  relatedMetrics?: Record<string, number>;
  suggestedActions?: string[];
}

// Campaign Types
export interface CampaignFromInsightRequest {
  opportunityId: string;
  campaignName?: string;
  startDate?: Date;
  budget?: number;
}

export interface CampaignFromInsightResponse {
  campaignId: string;
  campaignName: string;
  opportunityId: string;
  status: 'draft' | 'created';
  recommendations: Recommendation[];
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// Worker Types
export interface WorkerTask {
  id: string;
  type: 'daily' | 'weekly' | 'realtime' | 'on-demand';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
}

// Cache Types
export interface CacheOptions {
  ttl: number;
  prefix: string;
}

// Config Types
export interface AppConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  mongodb: {
    uri: string;
    options: Record<string, unknown>;
  };
  redis: {
    url: string;
  };
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  workers: {
    dailySchedule: string;
    weeklySchedule: string;
    realtimeInterval: number;
  };
  logging: {
    level: string;
    format: string;
  };
}

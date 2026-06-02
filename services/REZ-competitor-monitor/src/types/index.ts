import { z } from 'zod';

export const CompetitorSchema = z.object({
  competitorId: z.string(),
  name: z.string(),
  website: z.string().url().optional(),
  category: z.string(),
  lastUpdated: z.string().optional(),
});

export type Competitor = z.infer<typeof CompetitorSchema>;

export const PriceDataSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  competitorId: z.string(),
  price: z.number().min(0),
  currency: z.string().default('USD'),
  timestamp: z.string(),
  promotion: z.object({
    type: z.enum(['percentage', 'fixed', 'bogo', 'free_shipping']).optional(),
    value: z.number().optional(),
    validUntil: z.string().optional(),
  }).optional(),
});

export type PriceData = z.infer<typeof PriceDataSchema>;

export const FeatureDataSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  competitorId: z.string(),
  features: z.array(z.object({
    name: z.string(),
    available: z.boolean(),
    since: z.string().optional(),
  })),
  timestamp: z.string(),
});

export type FeatureData = z.infer<typeof FeatureDataSchema>;

export const ReviewDataSchema = z.object({
  reviewId: z.string(),
  competitorId: z.string(),
  source: z.enum(['google', 'yelp', 'trustpilot', 'app_store', 'play_store', 'other']),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
  date: z.string(),
  helpful: z.number().optional(),
});

export type ReviewData = z.infer<typeof ReviewDataSchema>;

export interface PriceMonitoring {
  competitorId: string;
  competitorName: string;
  products: ProductPrice[];
  averagePrice: number;
  priceChanges: PriceChange[];
  promotions: ActivePromotion[];
  competitiveIndex: number;
  lastUpdated: string;
}

export interface ProductPrice {
  productId: string;
  productName: string;
  currentPrice: number;
  previousPrice: number;
  change: number;
  changePercentage: number;
}

export interface PriceChange {
  productId: string;
  timestamp: string;
  previousPrice: number;
  newPrice: number;
  changePercentage: number;
}

export interface ActivePromotion {
  productId: string;
  promotionType: string;
  value: number;
  validUntil: string;
}

export interface FeatureTracking {
  competitorId: string;
  competitorName: string;
  features: FeatureComparison[];
  featureCompleteness: number;
  newFeatures: string[];
  removedFeatures: string[];
  lastUpdated: string;
}

export interface FeatureComparison {
  featureName: string;
  ourProduct: boolean;
  competitor: boolean;
  advantage: 'us' | 'competitor' | 'equal' | 'both';
}

export interface ReviewAnalysis {
  competitorId: string;
  competitorName: string;
  overallRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  recentTrend: 'improving' | 'declining' | 'stable';
  commonPraise: string[];
  commonComplaints: string[];
  lastUpdated: string;
}

export interface ShareOfVoice {
  brand: string;
  mentions: number;
  positiveMentions: number;
  negativeMentions: number;
  neutralMentions: number;
  sentiment: number;
  sharePercentage: number;
  trend: 'growing' | 'shrinking' | 'stable';
}

export interface CompetitorOverview {
  competitors: CompetitorSummary[];
  marketShare: MarketShare;
  competitiveAdvantages: string[];
  competitiveThreats: string[];
  opportunities: string[];
  generatedAt: string;
}

export interface CompetitorSummary {
  competitorId: string;
  name: string;
  strength: 'high' | 'medium' | 'low';
  weakness: string[];
  threatLevel: 'high' | 'medium' | 'low';
  lastActivity: string;
}

export interface MarketShare {
  ourShare: number;
  competitors: Record<string, number>;
  estimated: boolean;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  monitorActive: boolean;
  uptime: number;
  version: string;
}

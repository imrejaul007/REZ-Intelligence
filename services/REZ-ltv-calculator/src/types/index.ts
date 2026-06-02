import { z } from 'zod';

export const CustomerLTVSchema = z.object({
  customerId: z.string(),
  historicalRevenue: z.number().min(0),
  averageOrderValue: z.number().min(0),
  orderFrequency: z.number().min(0),
  customerTenure: z.number().min(0),
  purchaseHistory: z.array(z.object({
    orderId: z.string(),
    amount: z.number().min(0),
    date: z.string(),
    items: z.number().int().min(1),
  })).optional(),
  segment: z.enum(['new', 'active', 'at-risk', 'churned']).optional(),
  discountRate: z.number().min(0).max(1).optional(),
});

export type CustomerLTV = z.infer<typeof CustomerLTVSchema>;

export interface LTVScore {
  customerId: string;
  historicalLTV: number;
  predictedLTV: number;
  projectedLTV12Months: number;
  projectedLTV24Months: number;
  projectedLTV36Months: number;
  segmentScore: 'platinum' | 'gold' | 'silver' | 'bronze' | 'standard';
  customerLifetimeMonths: number;
  monthlyValue: number;
  churnRisk: number;
  growthRate: number;
  confidence: number;
  modelVersion: string;
  calculatedAt: string;
}

export interface SegmentAnalysis {
  segment: 'platinum' | 'gold' | 'silver' | 'bronze' | 'standard';
  averageLTV: number;
  averageTenure: number;
  averageOrderFrequency: number;
  retentionRate: number;
  customerCount: number;
  revenueShare: number;
}

export interface RevenueForecast {
  period: string;
  projectedRevenue: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
  customerAcquisitionNeeded: number;
  churnExpected: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  modelLoaded: boolean;
  uptime: number;
  version: string;
}

import { z } from 'zod';

export const CustomerFeaturesSchema = z.object({
  customerId: z.string(),
  tenure: z.number().min(0),
  monthlyCharges: z.number().min(0),
  totalCharges: z.number().min(0),
  numSupportTickets: z.number().int().min(0),
  daysSinceLastActivity: z.number().int().min(0),
  contractType: z.enum(['month-to-month', 'one-year', 'two-year']),
  paymentMethod: z.enum(['electronic check', 'mailed check', 'bank transfer', 'credit card']),
  hasMultipleServices: z.boolean(),
  averageReviewScore: z.number().min(0).max(5).optional(),
  supportTicketResolutionTime: z.number().min(0).optional(),
  engagementScore: z.number().min(0).max(100).optional(),
});

export type CustomerFeatures = z.infer<typeof CustomerFeaturesSchema>;

export interface ChurnPrediction {
  customerId: string;
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  earlyWarningSignals: EarlyWarningSignal[];
  preventionRecommendations: PreventionRecommendation[];
  modelVersion: string;
  predictedAt: string;
}

export interface RiskFactor {
  factor: string;
  impact: number;
  description: string;
}

export interface EarlyWarningSignal {
  signal: string;
  severity: 'mild' | 'moderate' | 'severe';
  detectedAt: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface PreventionRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
  expectedImpact: string;
  channel: string;
  timeframe: string;
}

export interface BatchChurnPrediction {
  customerId: string;
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  modelLoaded: boolean;
  uptime: number;
  version: string;
}

import { z } from 'zod';

export const CustomerContextSchema = z.object({
  customerId: z.string(),
  segment: z.enum(['new', 'active', 'at-risk', 'vip', 'inactive']),
  ltv: z.number().min(0),
  churnRisk: z.number().min(0).max(1),
  recentInteractions: z.array(z.object({
    type: z.enum(['purchase', 'support', 'browse', 'email', 'sms']),
    timestamp: z.string(),
    channel: z.string().optional(),
  })).optional(),
  preferences: z.object({
    preferredChannel: z.enum(['email', 'sms', 'push', 'whatsapp', 'in-app']).optional(),
    preferredTime: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  }).optional(),
  lastPurchaseDate: z.string().optional(),
  averageOrderValue: z.number().min(0).optional(),
});

export type CustomerContext = z.infer<typeof CustomerContextSchema>;

export interface NextBestAction {
  customerId: string;
  recommendations: Recommendation[];
  optimizedChannel: string;
  optimalTiming: OptimalTiming;
  selectedOffer: SelectedOffer;
  reasoning: string;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
}

export interface Recommendation {
  actionId: string;
  action: string;
  type: 'retention' | 'upsell' | 'reengagement' | 'loyalty' | 'awareness';
  priority: number;
  expectedImpact: number;
  reason: string;
  constraints: string[];
}

export interface OptimalTiming {
  bestTime: string;
  bestDayOfWeek: number;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  confidence: number;
}

export interface SelectedOffer {
  offerId: string;
  offerType: 'discount' | 'freebie' | 'loyalty_points' | 'early_access' | 'personalized';
  value: number;
  cost: number;
  roi: number;
  eligibility: boolean;
}

export interface ChannelOptimization {
  channel: string;
  effectiveness: number;
  costPerContact: number;
  conversionRate: number;
  reach: number;
  recommended: boolean;
}

export interface TimingOptimization {
  dayOfWeek: number;
  hourOfDay: number;
  conversionRate: number;
  engagementScore: number;
  recommended: boolean;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  modelLoaded: boolean;
  uptime: number;
  version: string;
}

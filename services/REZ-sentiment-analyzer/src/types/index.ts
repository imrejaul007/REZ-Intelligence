import { z } from 'zod';

export const SocialPostSchema = z.object({
  postId: z.string(),
  content: z.string().min(1).max(5000),
  source: z.enum(['twitter', 'facebook', 'instagram', 'linkedin', 'reddit', 'reviews', 'other']),
  authorId: z.string().optional(),
  timestamp: z.string(),
  engagement: z.object({
    likes: z.number().int().min(0).optional(),
    shares: z.number().int().min(0).optional(),
    comments: z.number().int().min(0).optional(),
    views: z.number().int().min(0).optional(),
  }).optional(),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
});

export type SocialPost = z.infer<typeof SocialPostSchema>;

export interface SentimentScore {
  postId: string;
  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number;
  confidence: number;
  emotionBreakdown: EmotionBreakdown;
  keyPhrases: string[];
  topics: string[];
  modelVersion: string;
  analyzedAt: string;
}

export interface EmotionBreakdown {
  joy: number;
  anger: number;
  sadness: number;
  fear: number;
  surprise: number;
  disgust: number;
}

export interface TrendAnalysis {
  period: string;
  startDate: string;
  endDate: string;
  sentimentTrend: 'improving' | 'declining' | 'stable';
  averageSentiment: number;
  sentimentChange: number;
  volumeChange: number;
  keyTopics: TopicSentiment[];
  peakMoments: PeakMoment[];
}

export interface TopicSentiment {
  topic: string;
  sentiment: number;
  volume: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface PeakMoment {
  timestamp: string;
  event: string;
  sentiment: number;
  volume: number;
}

export interface AlertThreshold {
  metric: string;
  condition: 'above' | 'below';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export interface Alert {
  alertId: string;
  metric: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface CompetitorComparison {
  brand: string;
  averageSentiment: number;
  volume: number;
  trend: 'improving' | 'declining' | 'stable';
  shareOfVoice: number;
  comparedToOwn: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  modelLoaded: boolean;
  uptime: number;
  version: string;
}

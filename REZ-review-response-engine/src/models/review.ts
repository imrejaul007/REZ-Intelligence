import { z } from 'zod';

/**
 * Review Source Types
 */
export enum ReviewSource {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  REZ_PLATFORM = 'rez_platform',
  TRIPADVISOR = 'tripadvisor',
  YELP = 'yelp',
  CUSTOM = 'custom'
}

/**
 * Review Rating Types (1-5 stars)
 */
export enum ReviewRating {
  ONE_STAR = 1,
  TWO_STARS = 2,
  THREE_STARS = 3,
  FOUR_STARS = 4,
  FIVE_STARS = 5
}

/**
 * Sentiment Types
 */
export enum SentimentType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  MIXED = 'mixed'
}

/**
 * Review Status
 */
export enum ReviewStatus {
  NEW = 'new',
  ANALYZED = 'analyzed',
  RESPONSE_GENERATED = 'response_generated',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  POSTED = 'posted',
  ESCALATED = 'escalated',
  DISMISSED = 'dismissed'
}

/**
 * Escalation Priority
 */
export enum EscalationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Escalation Category
 */
export enum EscalationCategory {
  SERVICE_ISSUE = 'service_issue',
  SAFETY_CONCERN = 'safety_concern',
  FOOD_SAFETY = 'food_safety',
  PRICING_ISSUE = 'pricing_issue',
  DISCRIMINATION = 'discrimination',
  ILLEGAL_ACTIVITY = 'illegal_activity',
  DATA_PRIVACY = 'data_privacy',
  REFUND_REQUEST = 'refund_request',
  COMPLIMENT = 'compliment',
  MEDIA_ATTENTION = 'media_attention'
}

/**
 * Key Topics/Aspects extracted from review
 */
export interface ReviewAspect {
  name: string;
  sentiment: SentimentType;
  confidence: number;
  keywords: string[];
}

/**
 * Sentiment Analysis Result
 */
export interface SentimentAnalysis {
  overall: SentimentType;
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  aspects: ReviewAspect[];
  keyPhrases: string[];
  emotions: string[];
}

/**
 * Reviewer Information
 */
export interface ReviewerInfo {
  id: string;
  name: string;
  avatar?: string;
  reviewCount: number;
  verified: boolean;
}

/**
 * Review Media (photos/videos attached to review)
 */
export interface ReviewMedia {
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
}

/**
 * Location/Branch Information
 */
export interface BranchInfo {
  id: string;
  name: string;
  address?: string;
  city?: string;
  region?: string;
}

/**
 * Zod Schema for Review Input Validation
 */
export const ReviewInputSchema = z.object({
  source: z.nativeEnum(ReviewSource),
  sourceId: z.string().min(1, 'Source ID is required'),
  merchantId: z.string().min(1, 'Merchant ID is required'),
  branchId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  content: z.string().min(1, 'Review content is required'),
  reviewer: z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Reviewer name is required'),
    avatar: z.string().url().optional(),
    reviewCount: z.number().int().min(0).optional(),
    verified: z.boolean().optional()
  }),
  media: z.array(z.object({
    type: z.enum(['photo', 'video']),
    url: z.string().url()
  })).optional(),
  location: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional(),
  reviewDate: z.string().datetime().optional(),
  platformMetadata: z.record(z.any()).optional()
});

export type ReviewInput = z.infer<typeof ReviewInputSchema>;

/**
 * Review Entity (stored in database)
 */
export interface Review {
  id: string;
  source: ReviewSource;
  sourceId: string;
  merchantId: string;
  branchId?: string;
  rating: ReviewRating;
  title?: string;
  content: string;
  reviewer: ReviewerInfo;
  media?: ReviewMedia[];
  location?: BranchInfo;
  metadata?: Record<string, unknown>;
  reviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
  status: ReviewStatus;
  sentimentAnalysis?: SentimentAnalysis;
  responseId?: string;
  escalated: boolean;
  escalationPriority?: EscalationPriority;
  escalationCategory?: EscalationCategory;
  escalatedAt?: Date;
  escalatedTo?: string;
  platformMetadata?: Record<string, unknown>;
}

/**
 * Review Summary Statistics
 */
export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  sentimentDistribution: Record<SentimentType, number>;
  responseRate: number;
  averageResponseTime: number; // in hours
  escalationRate: number;
}

/**
 * Review Filter Options
 */
export interface ReviewFilter {
  merchantId: string;
  source?: ReviewSource[];
  rating?: ReviewRating[];
  sentiment?: SentimentType[];
  status?: ReviewStatus[];
  escalated?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'rating' | 'sentiment';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Batch Review Import Request
 */
export interface BatchReviewImport {
  reviews: ReviewInput[];
  merchantId: string;
  source: ReviewSource;
}

/**
 * Batch Import Result
 */
export interface BatchImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    index: number;
    sourceId: string;
    error: string;
  }>;
  reviews: Review[];
}

/**
 * Review Response Mapping
 */
export interface ReviewWithResponse {
  review: Review;
  response?: ReviewResponse;
}

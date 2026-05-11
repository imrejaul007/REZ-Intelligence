/**
 * TypeScript interfaces for rez-personalization-engine
 * Migration from JavaScript to TypeScript
 *
 * TODO: Replace corresponding .js files with .ts implementations
 */

import { Document, Model, Types } from 'mongoose';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type CommunicationStyle = 'formal' | 'casual' | 'friendly' | 'professional' | 'mixed';
export type PriceSensitivityTier = 'budget' | 'moderate' | 'premium' | 'luxury' | 'insensitive';
export type ProfileSource = 'explicit' | 'implicit' | 'hybrid';
export type ActivityFrequency = 'daily' | 'weekly' | 'monthly' | 'occasional';
export type ItemType = 'product' | 'content' | 'service' | 'ad';
export type InteractionType = 'view' | 'click' | 'hover' | 'add_to_cart' | 'purchase' | 'like' | 'share' | 'save' | 'review' | 'dismiss';
export type InteractionContextSource = 'homepage' | 'search' | 'recommendation' | 'category' | 'direct' | 'email' | 'notification';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type ABTestVariant = 'control' | 'variant_a' | 'variant_b' | 'variant_c';
export type ChannelType = 'push' | 'email' | 'sms' | 'in_app' | 'ad';
export type ChannelFrequency = 'realtime' | 'daily' | 'weekly' | 'monthly';

// ============================================================================
// USER DNA PROFILE INTERFACES
// ============================================================================

export interface IBehavioralPattern {
  type: string;
  frequency: number;
  lastObserved: Date;
  confidence: number; // 0-1
  metadata: Record<string, unknown>;
}

export interface IPreferenceVector {
  dimension: string;
  value: number; // -1 to 1
  updatedAt: Date;
}

export interface IContentAffinity {
  contentType: string;
  category: string;
  score: number; // 0-1
  interactionCount: number;
  lastInteraction: Date;
  positiveInteractions: number;
  negativeInteractions: number;
}

export interface IBrandPreference {
  brandId: string;
  brandName: string;
  affinity: number; // 0-1
  interactionCount: number;
}

export interface ICategoryInterest {
  categoryId: string;
  categoryName: string;
  interestScore: number; // 0-1
  clickThroughRate: number;
  conversionRate: number;
  lastViewed?: Date;
}

export interface INotificationTimingPreference {
  morningStart: number;
  morningEnd: number;
  afternoonStart: number;
  afternoonEnd: number;
  eveningStart: number;
  eveningEnd: number;
  preferredDays: number[]; // 0-6 (Sunday-Saturday)
  timezone: string;
  optimalTimes: Date[];
}

export interface IUserDNAProfile {
  userId: string;
  behavioralPatterns: IBehavioralPattern[];
  preferenceVector: IPreferenceVector[];
  contentAffinityScores: IContentAffinity[];
  communicationStyle: CommunicationStyle;
  notificationTimingPreference: INotificationTimingPreference;
  priceSensitivityTier: PriceSensitivityTier;
  averageOrderValue: number;
  brandPreferences: IBrandPreference[];
  categoryInterests: ICategoryInterest[];
  engagementScore: number; // 0-1
  activityFrequency: ActivityFrequency;
  lastActiveAt: Date;
  diversityTolerance: number; // 0-1
  noveltySeeking: number; // 0-1
  personalizationVersion: number;
  lastUpdated: Date;
  profileCompleteness: number; // 0-1
  createdAt: Date;
  source: ProfileSource;
}

export interface IUserDNAProfileDocument extends IUserDNAProfile, Document {
  updatePreference(dimension: string, value: number): this;
  updateAffinity(contentType: string, category: string, score: number, interaction?: string): this;
  addBehavioralPattern(type: string, pattern: Partial<IBehavioralPattern>): this;
  calculateCompleteness(): number;
}

export interface IUserDNAProfileModel extends Model<IUserDNAProfileDocument> {
  findOrCreate(userId: string): Promise<IUserDNAProfileDocument>;
  getSimilarUsers(userId: string, limit?: number): Promise<Array<{
    userId: string;
    similarityScore: number;
    engagementScore: number;
  }>>;
}

// ============================================================================
// CONTENT ITEM INTERFACES
// ============================================================================

export interface IItemFeatures {
  price_tier: number; // 0-4
  quality_tier: number; // 0-4
  popularity: number;
  recency: number;
  engagement_rate: number;
  conversion_rate: number;
}

export interface IContentItem {
  itemId: string;
  itemType: ItemType;
  category: string;
  subcategory?: string;
  tags: string[];
  attributes: Record<string, unknown>;
  title: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  brandId?: string;
  brandName?: string;
  rating?: number; // 0-5
  reviewCount: number;
  features: IItemFeatures;
  embedding?: number[];
  available: boolean;
  stockLevel: 'high' | 'medium' | 'low' | 'out';
  popularityScore: number;
  trendingScore: number;
  viewCount: number;
  likeCount: number;
  shareCount: number;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContentItemDocument extends IContentItem, Document {
  getFeatureVector(): IItemFeatures;
  calculateRelevanceScore(userProfile: IUserDNAProfile): number;
}

export interface IContentItemModel extends Model<IContentItemDocument> {}

// ============================================================================
// INTERACTION INTERFACES
// ============================================================================

export interface IInteractionContext {
  source: InteractionContextSource;
  position?: number;
  sessionId?: string;
  deviceType?: string;
  location?: string;
  referralCode?: string;
}

export interface IInteractionOutcome {
  type: 'none' | 'converted' | 'abandoned' | 'saved';
  value: number;
}

export interface IInteraction {
  userId: string;
  itemId: string;
  itemType: ItemType;
  type: InteractionType;
  context: IInteractionContext;
  value: number;
  duration?: number; // ms
  metadata: Record<string, unknown>;
  rating?: number; // 1-5
  feedback?: string;
  outcome: IInteractionOutcome;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInteractionDocument extends IInteraction, Document {
  implicitRating: number; // virtual
}

export interface IInteractionModel extends Model<IInteractionDocument> {
  buildUserItemMatrix(
    users: string[],
    items: string[],
    timeWindow?: number
  ): Promise<Record<string, Record<string, number>>>;
  getCoOccurrence(
    itemId: string,
    timeWindow?: number
  ): Promise<Record<string, { count: number; jaccard: number }>>;
}

// ============================================================================
// PERSONALIZATION CAMPAIGN INTERFACES
// ============================================================================

export interface ITargeting {
  userSegments: string[];
  minEngagementScore: number;
  maxEngagementScore: number;
  priceTiers: string[];
  categories: string[];
  excludeUsers: string[];
}

export interface IContentRules {
  itemTypes: string[];
  categories: string[];
  minRating?: number;
  maxPrice?: number;
  minPrice?: number;
  brands: string[];
}

export interface IPersonalizationWeights {
  collaborativeWeight: number; // 0-1
  contentBasedWeight: number; // 0-1
  popularityWeight: number; // 0-1
  diversityWeight: number; // 0-1
}

export interface IABTestMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface IABTest {
  enabled: boolean;
  testId?: string;
  variant?: ABTestVariant;
  metrics: IABTestMetrics;
}

export interface IChannelTemplate {
  subject?: string;
  body?: string;
  cta?: string;
}

export interface IChannelTiming {
  hour?: number;
  daysOfWeek?: number[];
}

export interface IChannel {
  channel: ChannelType;
  enabled: boolean;
  frequency: ChannelFrequency;
  timing?: IChannelTiming;
  template?: IChannelTemplate;
}

export interface ICampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagement: number;
}

export interface ICampaignSchedule {
  startDate?: Date;
  endDate?: Date;
  timezone: string;
}

export interface IPersonalizationCampaign {
  campaignId: string;
  name: string;
  description?: string;
  targeting: ITargeting;
  contentRules: IContentRules;
  personalization: IPersonalizationWeights;
  abTest: IABTest;
  channels: IChannel[];
  status: CampaignStatus;
  metrics: ICampaignMetrics;
  schedule: ICampaignSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPersonalizationCampaignDocument extends IPersonalizationCampaign, Document {}

export interface IPersonalizationCampaignModel extends Model<IPersonalizationCampaignDocument> {}

// ============================================================================
// ALGORITHM INTERFACES
// ============================================================================

export interface IScoreResult {
  itemId: string;
  score: number;
  breakdown?: {
    collaborative?: number;
    contentBased?: number;
    popularity?: number;
    diversity?: number;
  };
}

export interface IScoredItem extends IContentItem {
  finalScore: number;
  rank: number;
  reasons?: string[];
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface IPersonalizationOptions {
  limit?: number;
  refresh?: boolean;
  excludeCategories?: string[];
  includeCategories?: string[];
}

export interface IPersonalizedHomepageResult {
  userId: string;
  items: Array<{
    itemId: string;
    title: string;
    category: string;
    price?: number;
    imageUrl?: string;
    score: number;
    rank: number;
    reasons: string[];
  }>;
  meta: {
    totalCandidates: number;
    algorithm: string;
    weights: IPersonalizationWeights;
    personalized: boolean;
    generatedAt: string;
  };
}

export interface ISearchResult {
  itemId: string;
  title: string;
  category: string;
  price?: number;
  score: number;
  boostReason: string;
}

// ============================================================================
// REQUEST/RESPONSE DTOs
// ============================================================================

export interface IRecordInteractionRequest {
  userId: string;
  itemId: string;
  itemType: ItemType;
  type: InteractionType;
  context?: Partial<IInteractionContext>;
  value?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  rating?: number;
}

export interface IUpdateUserProfileRequest {
  communicationStyle?: CommunicationStyle;
  priceSensitivityTier?: PriceSensitivityTier;
  categoryInterests?: ICategoryInterest[];
  brandPreferences?: IBrandPreference[];
}

export interface IHealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  mongodb: 'connected' | 'disconnected';
}

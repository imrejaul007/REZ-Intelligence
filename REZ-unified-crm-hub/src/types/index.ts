/**
 * REZ Unified CRM Hub - Type Definitions
 *
 * ⚠️ INTERNAL USE ONLY - For REZ Platform Team Only ⚠️
 *
 * Comprehensive types for the unified CRM system combining data from:
 * - REZ NOW (Consumer)
 * - REZ Media (Ads/Engagement)
 * - REZ Intelligence (AI/ML)
 * - CorpPerks (Enterprise)
 * - External CRM (HubSpot, Zoho)
 *
 * IMPORTANT: This system contains sensitive internal intelligence data.
 * AI predictions, intent signals, engagement scores, and behavioral analysis
 * are INTERNAL ONLY and must NOT be exposed to merchants or customers.
 */

// ============================================
// DATA CLASSIFICATION
// ============================================
/**
 * 🔒 INTERNAL: Data types that contain sensitive intelligence.
 *    Do NOT expose to merchants or customers.
 *
 * 👁️ MERCHANT-FACING: Data types safe to show to merchants.
 */

// ============================================
// 🔒 INTERNAL-ONLY TYPES
// ============================================

/**
 * InternalCustomer - Complete customer profile with all intelligence
 * 🔒 INTERNAL: Do not expose to merchants or customers
 */
export interface InternalCustomer {
  id: string;
  userId: string;

  // Identity
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  avatar?: string;

  // 🔒 INTERNAL: Full demographics
  demographics: InternalDemographics;

  // 🔒 INTERNAL: AI-generated segments
  segments: InternalSegment[];
  smartTags: InternalSmartTag[];

  // 🔒 INTERNAL: Complete lifetime metrics
  lifetime: InternalLifetime;

  // 🔒 INTERNAL: Raw behavioral activity
  activity: InternalActivity;

  // 🔒 INTERNAL: AI engagement scoring
  engagement: InternalEngagement;

  // 🔒 INTERNAL: AI Predictions (sensitive)
  predictions: InternalPredictions;

  // 🔒 INTERNAL: Intent Signals (sensitive)
  intentSignals: IntentSignals;

  // Sources
  sources: CustomerSource[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * InternalDemographics - Full demographic data
 * 🔒 INTERNAL
 */
export interface InternalDemographics {
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  city?: string;
  state?: string;
  pincode?: string;
  language?: string;
  occupation?: string;
  incomeTier?: 'LOW' | 'MIDDLE' | 'HIGH' | 'PREMIUM';
  // 🔒 INTERNAL: Inferred attributes
  inferredInterests?: string[];
  inferredLifestyle?: string[];
  inferredIncomeLevel?: number; // Confidence score 0-1
}

/**
 * InternalLifetime - Complete lifetime metrics
 * 🔒 INTERNAL
 */
export interface InternalLifetime {
  tenureDays: number;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  // 🔒 INTERNAL: AI Predicted LTV
  predictedLTV?: number;
  ltvConfidence?: number;
  // 🔒 INTERNAL: Customer value tier (internal scoring)
  valueTier?: 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM' | 'VIP';
}

/**
 * InternalActivity - Raw behavioral activity data
 * 🔒 INTERNAL: Contains detailed patterns that should not be exposed
 */
export interface InternalActivity {
  last30Days: ActivityPeriod;
  last90Days: ActivityPeriod;
  last365Days: ActivityPeriod;
  // 🔒 INTERNAL: Detailed visit patterns
  visits: VisitPattern;
  // 🔒 INTERNAL: Device patterns
  devicePatterns?: DevicePatterns;
  // 🔒 INTERNAL: Session data
  sessionMetrics?: SessionMetrics;
}

export interface DevicePatterns {
  primaryDevice?: 'MOBILE' | 'DESKTOP' | 'TABLET';
  deviceFingerprint?: string;
  browserHistory?: string[];
  appUsageScore?: number;
}

export interface SessionMetrics {
  averageSessionDuration: number;
  pagesPerSession: number;
  bounceRate: number;
  returnVisitRate: number;
}

/**
 * InternalEngagement - AI engagement scoring
 * 🔒 INTERNAL: Contains internal scoring algorithms
 */
export interface InternalEngagement {
  score: number;         // 0-100 AI-generated score
  tier: EngagementTier;
  // 🔒 INTERNAL: Detailed engagement metrics
  emailEngagementScore?: number;
  pushEngagementScore?: number;
  smsEngagementScore?: number;
  // 🔒 INTERNAL: Channel preferences (internal scoring)
  channelScores?: Record<string, number>;
  emailOptIn: boolean;
  pushOptIn: boolean;
  smsOptIn: boolean;
  lastEngagement?: Date;
  engagementFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'RARELY';
  // 🔒 INTERNAL: Engagement trend
  engagementTrend?: 'INCREASING' | 'STABLE' | 'DECREASING';
}

export type EngagementTier = 'INACTIVE' | 'COLD' | 'WARM' | 'HOT' | 'CHAMPION';

/**
 * InternalPredictions - AI-generated predictions
 * 🔒 INTERNAL: Contains sensitive AI model outputs
 */
export interface InternalPredictions {
  // 🔒 INTERNAL: Churn prediction
  churnRisk: ChurnRisk;
  churnProbability: number;    // 0-1 probability
  churnDrivers?: string[];    // Why churn is predicted
  // 🔒 INTERNAL: Next purchase prediction
  nextPurchaseDate?: Date;
  nextPurchaseLikelihood: number;  // 0-1 probability
  // 🔒 INTERNAL: LTV prediction
  ltvPrediction: LTVPrediction;
  // 🔒 INTERNAL: Product affinity (internal ranking)
  productAffinity: ProductAffinity[];
  // 🔒 INTERNAL: Preferred channels (internal ranking)
  preferredChannels: string[];
  // 🔒 INTERNAL: Cross-sell opportunities
  crossSellOpportunities?: CrossSellOpportunity[];
  // 🔒 INTERNAL: Model confidence
  modelVersion?: string;
  predictionTimestamp?: Date;
}

export type ChurnRisk = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface LTVPrediction {
  predicted: number;
  actual: number;
  confidence: number;  // 0-1
  timeframe: '30d' | '90d' | '365d';
  modelAccuracy?: number;
}

export interface ProductAffinity {
  categoryId: string;
  categoryName: string;
  score: number;  // 0-1 internal score
  purchaseFrequency: number;
  avgSpend: number;
}

export interface CrossSellOpportunity {
  productId: string;
  productName: string;
  score: number;
  reason: string;
}

/**
 * IntentSignals - Customer intent tracking
 * 🔒 INTERNAL: Core competitive intelligence
 */
export interface IntentSignals {
  // 🔒 INTERNAL: Browsing signals
  browsingSignals?: BrowsingSignals;
  // 🔒 INTERNAL: Purchase intent
  purchaseIntent?: PurchaseIntent;
  // 🔒 INTERNAL: Brand affinity
  brandAffinity?: BrandAffinity[];
  // 🔒 INTERNAL: Life events
  lifeEvents?: LifeEvent[];
  // 🔒 INTERNAL: Competitor interest
  competitorInterest?: CompetitorInterest[];
  // 🔒 INTERNAL: Sentiment
  sentiment?: SentimentAnalysis;
  // 🔒 INTERNAL: Intent score
  intentScore?: number; // 0-100
}

export interface BrowsingSignals {
  viewedProducts: string[];
  viewedCategories: string[];
  searchQueries: string[];
  timeOnSite: number;
  pagesVisited: number;
  cartAbandonmentRate?: number;
}

export interface PurchaseIntent {
  score: number; // 0-100
  timeframe: 'IMMEDIATE' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  productsOfInterest: string[];
  priceRange?: { min: number; max: number };
}

export interface BrandAffinity {
  brandName: string;
  brandId?: string;
  affinityScore: number; // 0-1
  positiveSignals: number;
  negativeSignals: number;
}

export interface LifeEvent {
  type: 'MOVING' | 'NEW_JOB' | 'MARRIAGE' | 'BIRTHDAY' | 'ANNIVERSARY' | 'GRADUATION';
  date: Date;
  confidence: number; // 0-1
  source?: string;
}

export interface CompetitorInterest {
  competitorName: string;
  signals: string[];
  frequency: number;
  lastSeen?: Date;
}

export interface SentimentAnalysis {
  overall: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  score: number; // -1 to 1
  keywords: string[];
  lastAnalyzed?: Date;
}

// ============================================
// INTERNAL SMART TAGS (AI-Generated)
// ============================================

/**
 * InternalSmartTag - AI-generated customer tags
 * 🔒 INTERNAL: Contains internal scoring and confidence
 */
export interface InternalSmartTag {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: SmartTagCategory;
  icon?: string;
  color: string;
  customerCount: number;
  // 🔒 INTERNAL: AI confidence in tag accuracy
  confidence: number;  // 0-1
  rules?: SmartTagRule[];
  isAutoGenerated: boolean;
  createdAt: Date;
}

export type SmartTagCategory =
  | 'SPENDING'
  | 'FREQUENCY'
  | 'PREFERENCES'
  | 'TIMING'
  | 'LIFESTYLE'
  | 'LOYALTY'
  | 'INTENT'; // 🔒 INTERNAL: Intent-based tags

export interface SmartTagRule {
  type: 'order_pattern' | 'category_affinity' | 'time_pattern' | 'spend_threshold' | 'ai_inference' | 'intent_signal'; // 🔒 INTERNAL
  conditions: TagCondition[];
  logic: 'AND' | 'OR';
}

/**
 * InternalSegment - Full segment data
 * 🔒 INTERNAL
 */
export interface InternalSegment {
  id: string;
  name: string;
  type: SegmentType;
  description?: string;
  rules: SegmentRule[];
  logic: 'AND' | 'OR';
  customerCount: number;
  isActive: boolean;
  // 🔒 INTERNAL: Segment value metrics
  totalRevenue?: number;
  avgCustomerValue?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SegmentType =
  | 'RFM'
  | 'BEHAVIORAL'
  | 'DEMOGRAPHIC'
  | 'PREDICTIVE'
  | 'ENGAGEMENT'
  | 'INTENT'  // 🔒 INTERNAL
  | 'CUSTOM';

// ============================================
// 👁️ MERCHANT-FACING TYPES (Safe to show)
// ============================================

/**
 * MerchantCustomer - Safe data for merchant-facing CRM
 * 👁️ Can be shown to merchants
 */
export interface MerchantCustomer {
  id: string;
  userId: string;

  // 👁️ Identity (sanitized)
  name: string;
  phone?: string;
  avatar?: string;

  // 👁️ Basic segments (just names, no internal scoring)
  segments: string[];

  // 👁️ Basic metrics
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastVisit?: Date;
  joinedDate: Date;

  // 👁️ Optional: Reviews received
  reviewsCount?: number;
  averageRating?: number;
}

/**
 * MerchantSegment - Safe segment info for merchants
 * 👁️ Can be shown to merchants
 */
export interface MerchantSegment {
  id: string;
  name: string;
  description?: string;
  customerCount: number;
  // 👁️ Basic performance (no internal scoring)
  totalRevenue: number;
}

/**
 * MerchantCustomerDetail - Customer detail view for merchants
 * 👁️ Can be shown to merchants
 */
export interface MerchantCustomerDetail {
  id: string;
  name: string;
  phone?: string;
  email?: string;

  // 👁️ Orders
  orders: MerchantOrderSummary[];

  // 👁️ Reviews
  reviews: MerchantReview[];

  // 👁️ Basic info
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastVisit?: Date;
  joinedDate: Date;

  // 👁️ Basic segments
  segments: string[];

  // 👁️ Basic tags (useful for merchants)
  tags: MerchantTag[];
}

export interface MerchantOrderSummary {
  id: string;
  orderNumber: string;
  storeName: string;
  items: string[]; // Item names only
  total: number;
  status: string;
  createdAt: Date;
}

export interface MerchantReview {
  id: string;
  rating: number;
  comment?: string;
  storeName: string;
  createdAt: Date;
}

export interface MerchantTag {
  name: string;
  icon?: string;
  color: string;
}

// ============================================
// SHARED TYPES
// ============================================

export interface CustomerSource {
  source: 'REZ_NOW' | 'REZ_MEDIA' | 'CORPPERKS' | 'HUBSPOT' | 'ZOHO' | 'SHOPIFY' | 'WOOCOMMERCE';
  externalId: string;
  firstSeen: Date;
  lastSync?: Date;
}

export interface ActivityPeriod {
  orders: number;
  spend: number;
  visits: number;
  avgSessionDuration?: number;
}

export interface VisitPattern {
  weekday: number;      // % of visits on weekdays
  weekend: number;      // % of visits on weekends
  morning: number;       // % of visits 6AM-12PM
  afternoon: number;     // % of visits 12PM-6PM
  evening: number;      // % of visits 6PM-10PM
  night: number;        // % of visits 10PM-6AM
  favoriteTime?: string;
  favoriteDay?: string;
}

export interface SegmentRule {
  field: string;
  operator: SegmentOperator;
  value: string | number | boolean;
}

export type SegmentOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'between'
  | 'exists';

export interface TagCondition {
  field: string;
  operator: string;
  value: string | number;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardOverview {
  // Customer counts
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  returningCustomers: number;

  // 🔒 INTERNAL: Revenue metrics (internal use)
  revenue: RevenueMetrics;

  // 🔒 INTERNAL: Engagement metrics (internal use)
  engagement: EngagementMetrics;

  // Growth
  growth: GrowthMetrics;

  // Top performing
  topSegments: SegmentPerformance[];
  topProducts: ProductPerformance[];

  // Alerts (🔒 INTERNAL: AI-generated)
  alerts: DashboardAlert[];

  // Period comparison
  periodOverPeriod: PeriodComparison;
}

export interface RevenueMetrics {
  total: number;
  averageOrderValue: number;
  totalOrders: number;
  projection?: number;
}

export interface EngagementMetrics {
  averageEngagementScore: number; // 🔒 INTERNAL
  activeUsers: number;
  emailOpenRate?: number;
  pushOpenRate?: number;
  responseRate?: number;
}

export interface GrowthMetrics {
  customerGrowth: number;
  revenueGrowth: number;
  orderGrowth: number;
  retentionRate: number;
}

export interface SegmentPerformance {
  segmentId: string;
  segmentName: string;
  customerCount: number;
  revenue: number;
  avgOrderValue: number;
  growth: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
  customerCount: number;
}

export interface DashboardAlert {
  id: string;
  type: 'INFO' | 'WARNING' | 'URGENT';
  title: string;
  description: string;
  actionUrl?: string;
  actionLabel?: string;
  // 🔒 INTERNAL: AI-generated insights
  insightType?: 'CHURN' | 'UPSELL' | 'REENGAGE' | 'CAMPAIGN';
  createdAt: Date;
}

export interface PeriodComparison {
  current: {
    start: Date;
    end: Date;
    customers: number;
    revenue: number;
    orders: number;
  };
  previous: {
    customers: number;
    revenue: number;
    orders: number;
  };
  change: {
    customers: number;
    revenue: number;
    orders: number;
  };
}

// ============================================
// MERCHANT INBOX TYPES
// ============================================

export interface InboxMessage {
  id: string;
  channel: MessageChannel;
  customerId: string;
  customerName: string;
  customerPhone?: string;

  // Content
  direction: 'INBOUND' | 'OUTBOUND';
  type: MessageType;
  content: string;
  attachments?: MessageAttachment[];

  // Status
  status: MessageStatus;
  readAt?: Date;
  repliedAt?: Date;

  // Context
  orderId?: string;
  storeId?: string;
  merchantId?: string;

  // 🔒 INTERNAL: AI analysis
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  intent?: string;
  autoReplied?: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type MessageChannel =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'SMS'
  | 'APP_PUSH'
  | 'EMAIL'
  | 'SUPPORT_CHAT'
  | 'BOOKING_CHAT';

export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'AUDIO'
  | 'LOCATION'
  | 'CONTACT';

export type MessageStatus =
  | 'RECEIVED'
  | 'READ'
  | 'REPLIED'
  | 'ACTION_REQUIRED'
  | 'RESOLVED'
  | 'ARCHIVED';

export interface MessageAttachment {
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface InboxChannel {
  channel: MessageChannel;
  name: string;
  icon: string;
  unreadCount: number;
  lastMessage?: InboxMessage;
  isConnected: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Internal API Response - Contains full intelligence data
 * 🔒 INTERNAL
 */
export interface InternalApiResponse<T> extends ApiResponse<T> {
  // 🔒 INTERNAL: Additional metadata
  generatedAt?: Date;
  modelVersion?: string;
}

/**
 * Merchant API Response - Sanitized for merchant use
 * 👁️ Safe for merchants
 */
export interface MerchantApiResponse<T> extends ApiResponse<T> {
  // Only includes merchant-safe fields
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================
// EXPORT TYPES
// ============================================

export interface ExportRequest {
  type: 'CUSTOMERS' | 'SEGMENTS' | 'ORDERS' | 'ACTIVITY';
  format: 'CSV' | 'EXCEL' | 'JSON';
  filters?: {
    segmentIds?: string[];
    tagIds?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    status?: string[];
  };
  columns?: string[];
}

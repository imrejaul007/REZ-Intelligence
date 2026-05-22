/**
 * REZ Memory Layer - Timeline Types
 * Unified customer timeline type definitions
 */

// Event source types - all possible sources of events
export type EventSource =
  | 'whatsapp'
  | 'support'
  | 'order'
  | 'payment'
  | 'loyalty'
  | 'campaign'
  | 'qr'
  | 'ai'
  | 'push'
  | 'auth'
  | 'catalog'
  | 'search'
  | 'delivery'
  | 'booking'
  | 'dooh';

// Event type categories
export type EventCategory =
  | 'commerce'
  | 'engagement'
  | 'identity'
  | 'loyalty'
  | 'intelligence'
  | 'support'
  | 'marketing'
  | 'notification';

// Core event type - represents any event in the system
export interface TimelineEvent {
  id: string;
  userId: string;
  type: string;
  category: EventCategory;
  source: EventSource;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata: EventMetadata;
}

export interface EventMetadata {
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: GeoLocation;
  correlationId?: string;
  parentEventId?: string;
}

export interface GeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  city?: string;
  country?: string;
}

// Timeline entry - event with enrichments and tags
export interface TimelineEntry {
  event: TimelineEvent;
  enrichments: EventEnrichments;
  tags: string[];
  score?: number;
}

export interface EventEnrichments {
  product?: ProductEnrichment;
  merchant?: MerchantEnrichment;
  campaign?: CampaignEnrichment;
  agent?: AgentEnrichment;
  user?: UserEnrichment;
  location?: LocationEnrichment;
}

export interface ProductEnrichment {
  productId: string;
  productName: string;
  category: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
}

export interface MerchantEnrichment {
  merchantId: string;
  merchantName: string;
  merchantType: string;
  location?: string;
  rating?: number;
}

export interface CampaignEnrichment {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  channel: string;
  segment?: string;
}

export interface AgentEnrichment {
  agentId: string;
  agentName: string;
  agentType: string;
  intent?: string;
  confidence?: number;
}

export interface UserEnrichment {
  userName?: string;
  email?: string;
  phone?: string;
  tier?: string;
}

export interface LocationEnrichment {
  name: string;
  address?: string;
  city?: string;
  category?: string;
}

// User timeline - complete view of a user's activity
export interface UserTimeline {
  userId: string;
  events: TimelineEntry[];
  computedSegments: ComputedSegment[];
  computedPreferences: ComputedPreferences;
  behavioralPatterns: BehavioralPattern[];
  lastUpdated: Date;
  eventCount: number;
}

export interface ComputedSegment {
  segmentId: string;
  segmentName: string;
  confidence: number;
  lastTriggered: Date;
  triggers: string[];
}

export interface ComputedPreferences {
  categories: CategoryPreference[];
  brands: BrandPreference[];
  priceRanges: PriceRangePreference[];
  channels: ChannelPreference[];
  timePatterns: TimePattern[];
}

export interface CategoryPreference {
  category: string;
  score: number;
  eventCount: number;
  lastInteraction: Date;
}

export interface BrandPreference {
  brand: string;
  score: number;
  purchaseCount: number;
  avgOrderValue: number;
}

export interface PriceRangePreference {
  range: string;
  score: number;
  percentage: number;
}

export interface ChannelPreference {
  channel: string;
  score: number;
  interactionCount: number;
}

export interface TimePattern {
  pattern: 'morning' | 'afternoon' | 'evening' | 'night' | 'weekday' | 'weekend';
  score: number;
  peakHour?: number;
}

export interface BehavioralPattern {
  patternId: string;
  patternType: string;
  description: string;
  confidence: number;
  occurrences: number;
  lastObserved: Date;
}

// Timeline summary for quick overview
export interface TimelineSummary {
  userId: string;
  totalEvents: number;
  eventBreakdown: EventBreakdown;
  topCategories: CategoryStats[];
  topSources: SourceStats[];
  recentActivity: Date;
  activityStreak: number;
  predictedInterests: string[];
}

export interface EventBreakdown {
  byCategory: Record<EventCategory, number>;
  bySource: Record<EventSource, number>;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
}

export interface CategoryStats {
  category: EventCategory;
  count: number;
  percentage: number;
}

export interface SourceStats {
  source: EventSource;
  count: number;
  percentage: number;
}

// Activity metrics for a user
export interface ActivityMetrics {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalEvents: number;
    uniqueDays: number;
    avgEventsPerDay: number;
    peakActivityHour: number;
    mostActiveDay: string;
    categoryDistribution: Record<EventCategory, number>;
    engagementScore: number;
    purchaseFrequency: number;
    averageSessionDuration: number;
  };
}

// Event ingestion request/response
export interface EventIngestionRequest {
  userId: string;
  type: string;
  category: EventCategory;
  source: EventSource;
  data: Record<string, unknown>;
  metadata?: Partial<EventMetadata>;
  timestamp?: Date;
}

export interface EventIngestionResponse {
  success: boolean;
  eventId: string;
  message: string;
}

export interface BatchEventIngestionRequest {
  events: EventIngestionRequest[];
}

export interface BatchEventIngestionResponse {
  success: boolean;
  processed: number;
  failed: number;
  results: Array<{
    index: number;
    success: boolean;
    eventId?: string;
    error?: string;
  }>;
}

// Timeline query options
export interface TimelineQueryOptions {
  startDate?: Date;
  endDate?: Date;
  sources?: EventSource[];
  categories?: EventCategory[];
  types?: string[];
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
  includeEnrichments?: boolean;
  includeTags?: boolean;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    pagination?: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

// Event normalization result
export interface NormalizedEvent {
  userId: string;
  type: string;
  category: EventCategory;
  source: EventSource;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata: EventMetadata;
}

// Segment definitions
export interface SegmentDefinition {
  id: string;
  name: string;
  conditions: SegmentCondition[];
  priority: number;
}

export interface SegmentCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists';
  value: unknown;
}

// Health check response
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    mongodb: { status: string; latency?: number; error?: string };
    redis: { status: string; latency?: number; error?: string };
    eventBus: { status: string; subscriptions?: number; error?: string };
  };
  uptime: number;
  version: string;
}

export interface ServiceHealth {
  status: string;
  latency?: number;
  error?: string;
}

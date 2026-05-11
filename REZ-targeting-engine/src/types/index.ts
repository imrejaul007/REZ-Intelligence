// Core Types for the Targeting Engine

export interface TargetingRules {
  user_segments: string[];
  exclusions: string[];
  recency_days: number;
  min_orders: number;
  custom_conditions?: Record<string, any>;
}

export interface ContentRules {
  ad_template_id: string;
  fallback_offer: string;
  personalization_enabled?: boolean;
  dynamic_content?: boolean;
}

export interface BudgetRules {
  daily_limit: number;
  cost_per_impression: number;
  lifetime_limit?: number;
  pacing_mode?: 'even' | 'accelerated' | 'front_loaded';
}

export interface SchedulingRules {
  send_time: 'optimal' | 'morning' | 'afternoon' | 'evening' | 'night' | 'specific';
  timezone: 'user_preferred' | 'utc' | string;
  specific_time?: string;
  days_of_week?: number[];
  blacklisted_dates?: string[];
}

export interface CampaignRules {
  targeting: TargetingRules;
  content: ContentRules;
  budget: BudgetRules;
  scheduling: SchedulingRules;
}

export interface Campaign {
  campaign_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  rules: CampaignRules;
  ab_test_config?: ABTestConfig;
  created_at: Date;
  updated_at: Date;
  start_date?: Date;
  end_date?: Date;
  created_by: string;
  metadata?: Record<string, any>;
}

export interface ABTestConfig {
  enabled: boolean;
  variants: ABVariant[];
  primary_metric: 'ctr' | 'conversion' | 'engagement' | 'revenue';
  min_sample_size: number;
  test_duration_days: number;
}

export interface ABVariant {
  id: string;
  name: string;
  weight: number;
  ad_template_id: string;
  description?: string;
}

export interface UserSegment {
  segment_id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface SegmentCriteria {
  type: 'ltv' | 'recency' | 'frequency' | 'behavior' | 'demographic' | 'composite';
  conditions: SegmentCondition[];
  combinator: 'AND' | 'OR';
}

export interface SegmentCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between' | 'contains';
  value: any;
}

export interface AdTemplate {
  template_id: string;
  name: string;
  channel: 'banner' | 'push' | 'in_app' | 'sms' | 'email';
  content: TemplateContent;
  design: TemplateDesign;
  targeting?: {
    min_age?: number;
    max_age?: number;
    preferred_segments?: string[];
  };
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface TemplateContent {
  headline?: string;
  body: string;
  cta_text?: string;
  cta_url?: string;
  image_url?: string;
  deep_link?: string;
  metadata?: Record<string, any>;
}

export interface TemplateDesign {
  layout: string;
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
  font_size?: string;
  spacing?: string;
}

// Campaign Execution & Tracking

export interface CampaignTrigger {
  trigger_id: string;
  campaign_id: string;
  user_id: string;
  variant_id?: string;
  channel: 'banner' | 'push' | 'in_app' | 'sms' | 'email';
  status: 'queued' | 'sent' | 'delivered' | 'viewed' | 'clicked' | 'converted' | 'failed';
  sent_at?: Date;
  delivered_at?: Date;
  viewed_at?: Date;
  clicked_at?: Date;
  cost: number;
  error?: string;
}

export interface CampaignStats {
  campaign_id: string;
  period: {
    start: Date;
    end: Date;
  };
  impressions: number;
  deliveries: number;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  ctr: number;
  conversion_rate: number;
  cpc: number;
  cpm: number;
  roas: number;
  by_segment: Record<string, SegmentStats>;
  by_channel: Record<string, ChannelStats>;
}

export interface SegmentStats {
  audience_size: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

export interface ChannelStats {
  sent: number;
  delivered: number;
  viewed: number;
  clicked: number;
  conversion_rate: number;
}

// User Context for Targeting

export interface UserContext {
  user_id: string;
  segments: string[];
  attributes: UserAttributes;
  preferences: UserPreferences;
}

export interface UserAttributes {
  ltv: number;
  total_orders: number;
  avg_order_value: number;
  last_order_date?: Date;
  first_order_date?: Date;
  days_since_last_order: number;
  browsing_frequency: number;
  purchase_frequency: number;
  is_discount_responsive: boolean;
  preferred_categories: string[];
  device_type?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  age?: number;
  location?: string;
}

export interface UserPreferences {
  preferred_send_time?: 'morning' | 'afternoon' | 'evening' | 'night';
  timezone: string;
  notification_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
}

// API Response Types

export interface AudiencePreview {
  campaign_id: string;
  total_matching: number;
  by_segment: {
    segment_id: string;
    segment_name: string;
    count: number;
    percentage: number;
  }[];
  excluded_count: number;
  breakdown: {
    meets_recency: number;
    meets_min_orders: number;
    meets_custom_conditions: number;
  };
  sampled_users?: {
    user_id: string;
    match_reasons: string[];
  }[];
}

export interface TriggerResponse {
  trigger_id: string;
  campaign_id: string;
  status: 'queued' | 'processed';
  total_recipients: number;
  estimated_cost: number;
  estimated_delivery_time: string;
  batch_info?: {
    total_batches: number;
    current_batch: number;
    batch_size: number;
  };
}

// Frequency Capping

export interface FrequencyCap {
  user_id: string;
  campaign_id: string;
  channel: string;
  impression_count: number;
  last_impression_at: Date;
  daily_limit: number;
  weekly_limit: number;
  lifetime_limit: number;
}

// Budget Pacing

export interface BudgetPacing {
  campaign_id: string;
  daily_spent: number;
  daily_limit: number;
  lifetime_spent: number;
  lifetime_limit?: number;
  pacing_percentage: number;
  last_updated: Date;
}

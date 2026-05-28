/**
 * REZ Consumer Graph - Type Definitions
 * Core types for unified consumer identity
 */

// ============================================
// CANONICAL CONSUMER MODEL
// ============================================

export interface TasteProfile {
  flavors: Record<string, number>;
  style_preferences: string[];
  dietary_restrictions: string[];
  preferred_cuisines: string[];
  price_sensitivity: 'low' | 'medium' | 'high';
  sustainability_focus: number; // 0-1
}

export interface Consumer360 {
  // Identity
  user_id: string;
  primary_email: string;
  primary_phone: string;
  created_at: string;
  updated_at: string;

  // Devices (linked)
  devices: LinkedDevice[];

  // Apps (linked)
  apps: LinkedApp[];

  // Wallets (linked)
  wallets: LinkedWallet[];

  // Transactions
  transactions: TransactionSummary;

  // Browsing
  browsing: BrowsingSummary;

  // DOOH
  dooh: DOOHSummary;

  // Intent
  intent: IntentProfile;

  // Loyalty
  loyalty: LoyaltyProfile;

  // AI Memory
  ai_memory: AIMemoryProfile;

  // Metadata
  metadata: ConsumerMetadata;
}

export interface LinkedDevice {
  device_id: string;
  type: 'ios' | 'android' | 'web' | 'tablet' | 'kiosk';
  platform?: string;
  app_version?: string;
  linked_at: string;
  last_active: string;
  primary: boolean;
  trust_score: number; // 0-1
}

export interface LinkedApp {
  app: AppType;
  user_id_in_app: string;
  linked_at: string;
  last_sync: string;
  connected: boolean;
}

export type AppType = 'consumer' | 'do' | 'karma' | 'merchant' | 'hotel';

export interface LinkedWallet {
  type: WalletType;
  balance: number;
  linked: boolean;
  linked_at?: string;
  currency?: string;
  address?: string; // for crypto
}

export type WalletType = 'points' | 'cash' | 'crypto' | 'voucher';

export interface TransactionSummary {
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order: string;
  first_order: string;
  favorite_payment_method?: string;
  order_frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
}

export interface BrowsingSummary {
  sessions: number;
  search_queries: number;
  products_viewed: number;
  wishlists: number;
  cart_abandons: number;
  avg_session_duration: number; // seconds
  last_session: string;
}

export interface DOOHSummary {
  scanned_codes: number;
  redemptions: number;
  campaigns_viewed: number;
  engagement_score: number; // 0-1
  favorite_locations: string[];
  last_scan: string;
}

export interface IntentProfile {
  affinities: AffinityScore[];
  categories: CategoryAffinity[];
  price_range: PriceRange;
  preferred_brands: BrandAffinity[];
  seasonal_patterns: SeasonalPattern[];
  predicted_interests: string[];
  confidence_scores: Record<string, number>;
}

export interface AffinityScore {
  category: string;
  score: number; // 0-1
  trend: 'rising' | 'stable' | 'declining';
}

export interface CategoryAffinity {
  category_id: string;
  category_name: string;
  purchase_count: number;
  total_spent: number;
  last_purchase: string;
}

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
  preferred: number; // most common purchase price
}

export interface BrandAffinity {
  brand_id: string;
  brand_name: string;
  affinity_score: number; // 0-1
  purchases: number;
}

export interface SeasonalPattern {
  season: 'spring' | 'summer' | 'fall' | 'winter' | 'holiday';
  categories: string[];
  avg_spend: number;
}

export interface LoyaltyProfile {
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  tier_progress: number; // 0-100
  points_expiry_date?: string;
  referral_count: number;
  referral_code?: string;
  member_since: string;
  benefits: string[];
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';

export interface AIMemoryProfile {
  preferences: Record<string, unknown>;
  conversation_history: ConversationSummary[];
  taste_profile: TasteProfile;
  interaction_patterns: InteractionPattern[];
  feedback_history: FeedbackEntry[];
}

export interface ConversationSummary {
  conversation_id: string;
  date: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  outcome?: string;
}

export interface InteractionPattern {
  pattern_type: string;
  frequency: number;
  typical_time: string; // HH:MM
  typical_day?: string;
  channel: 'app' | 'web' | 'chat' | 'voice';
}

export interface FeedbackEntry {
  item_id: string;
  item_type: 'product' | 'service' | 'experience';
  rating: number;
  feedback?: string;
  date: string;
}

export type ConsentStatus = 'pending' | 'granted' | 'denied' | 'withdrawn';

export interface ConsentPreferences {
  marketing: boolean;
  analytics: boolean;
  personalization: boolean;
  third_party_sharing: boolean;
}

export interface ConsumerMetadata {
  data_sources: string[];
  last_aggregated: string;
  verification_status: 'verified' | 'partial' | 'unverified';
  consent_status: ConsentPreferences;
  gdpr_compliant: boolean;
  risk_score: number; // 0-1
  segment_tags: string[];
}

// ============================================
// IDENTITY RESOLUTION TYPES
// ============================================

export interface IdentitySignal {
  type: 'email' | 'phone' | 'device_id' | 'cookie' | 'ip_address' | 'fingerprint';
  value: string;
  source: string;
  confidence: number; // 0-1
  timestamp: string;
  hashed?: boolean;
}

export interface IdentityCluster {
  cluster_id: string;
  canonical_user_id: string;
  signals: IdentitySignal[];
  resolved_at: string;
  resolution_method: 'deterministic' | 'probabilistic' | 'merged';
  confidence: number;
}

export interface DeviceGraph {
  device_id: string;
  consumer_ids: string[];
  shared_ips: string[];
  shared_cookies: string[];
  behavioral_similarity: number;
  last_seen: string;
}

export interface CrossPlatformLink {
  source_app: AppType;
  target_app: AppType;
  link_type: 'explicit' | 'implicit' | 'inferred';
  confidence: number;
  created_at: string;
}

// ============================================
// GRAPH DATABASE TYPES
// ============================================

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GraphRelationship {
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
  weight?: number;
}

export interface QueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  metadata: {
    total: number;
    execution_time: number;
  };
}

// ============================================
// MODULE-SPECIFIC TYPES
// ============================================

export interface PaymentMethod {
  id?: string;
  method_id: string;
  type: 'card' | 'bank_account' | 'digital_wallet' | 'crypto';
  last_four?: string;
  bank_name?: string;
  wallet_type?: string;
  provider?: string;
  expiry_date?: string;
  is_default: boolean;
  created_at?: string;
  added_at?: string;
  last_used?: string;
  is_verified?: boolean;
  usage_count?: number;
  total_amount?: number;
}

export interface PaymentTransaction {
  id?: string;
  transaction_id: string;
  user_id: string;
  amount: number;
  currency?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method_id?: string;
  method_id: string;
  description: string;
  merchant_id?: string;
  created_at?: string;
  completed_at?: string;
  timestamp?: string;
}

export interface WalletTransaction {
  id: string;
  wallet_type: WalletType;
  amount: number;
  type: 'credit' | 'debit' | 'transfer';
  source: string;
  description: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
}

export interface BrowsingEvent {
  event_id: string;
  user_id: string;
  event_type: 'page_view' | 'search' | 'product_view' | 'add_to_cart' | 'add_to_wishlist';
  payload: {
    page_url?: string;
    product_id?: string;
    search_query?: string;
    category_id?: string;
  };
  device_id: string;
  timestamp: string;
  session_id: string;
}

export interface LoyaltyEvent {
  event_id: string;
  user_id: string;
  event_type: 'earn' | 'redeem' | 'expire' | 'tier_change' | 'referral';
  points: number;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DOOHEngagement {
  engagement_id: string;
  user_id: string;
  campaign_id: string;
  location_id: string;
  engagement_type: 'view' | 'scan' | 'interact' | 'redeem';
  timestamp: string;
  duration?: number;
  reward_earned?: number;
}

export interface IntentSignal {
  signal_id: string;
  user_id: string;
  signal_type: 'browse' | 'search' | 'purchase' | 'wishlist' | 'abandon' | 'cart';
  category: string;
  product_id?: string;
  brand_id?: string;
  price?: number;
  timestamp: string;
  weight: number;
}

// ============================================
// API TYPES
// ============================================

export interface ConsumerGraphConfig {
  neo4j: {
    uri: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  services: {
    wallet_service_url: string;
    browsing_service_url: string;
    loyalty_service_url: string;
    intent_service_url: string;
  };
  identity: {
    match_threshold: number;
    merge_window_hours: number;
    device_graph_enabled: boolean;
  };
}

export interface CreateConsumerRequest {
  email?: string;
  phone?: string;
  device_id?: string;
  source: string;
  initial_data?: Partial<Consumer360>;
}

export interface LinkAccountRequest {
  user_id: string;
  link_type: 'device' | 'app' | 'email' | 'phone';
  link_value: string;
  verify_code?: string;
}

export interface AggregatedProfileResponse {
  success: boolean;
  consumer: Consumer360;
  last_updated: string;
  sources: string[];
}

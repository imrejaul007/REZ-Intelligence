/**
 * REZ Merchant Graph - Types
 *
 * Merchant Intelligence Graph - Relationship mapping and network analysis
 */

import mongoose, { Document } from 'mongoose';

// ============================================
// MERCHANT TYPES
// ============================================

export interface Merchant {
  id: string;
  name: string;
  type: MerchantType;
  category: string;
  subcategory?: string;
  location?: MerchantLocation;
  profile?: MerchantProfile;
  relationships?: string[];
  metrics?: MerchantMetrics;
  score?: MerchantScore;
  createdAt: Date;
  updatedAt: Date;
}

export type MerchantType =
  | 'retail'
  | 'restaurant'
  | 'service'
  | 'online'
  | 'marketplace'
  | 'franchise'
  | 'chain'
  | 'independent';

export interface MerchantLocation {
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface MerchantProfile {
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
  socialMedia?: Record<string, string>;
  operatingHours?: Record<string, { open: string; close: string } | null>;
  priceLevel?: number;
  cuisines?: string[];
  specialties?: string[];
  brands?: string[];
}

export interface MerchantMetrics {
  revenue?: {
    monthly: number;
    quarterly: number;
    yearly: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  customers?: {
    total: number;
    active: number;
    new: number;
    returning: number;
  };
  transactions?: {
    total: number;
    avgOrderValue: number;
    avgOrdersPerDay: number;
  };
  ratings?: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
  performance?: {
    conversionRate: number;
    retentionRate: number;
    nps: number;
  };
}

export interface MerchantScore {
  overall: number;
  engagement: number;
  reliability: number;
  growth: number;
  risk: number;
  tier?: 'platinum' | 'gold' | 'silver' | 'bronze';
}

// ============================================
// RELATIONSHIP TYPES
// ============================================

export interface MerchantRelationship {
  id: string;
  sourceMerchantId: string;
  targetMerchantId: string;
  type: RelationshipType;
  strength: number;
  bidirectional: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type RelationshipType =
  | 'parent_subsidiary'
  | 'franchise'
  | 'supplier'
  | 'distributor'
  | 'partner'
  | 'competitor'
  | 'complementary'
  | 'affiliate'
  | 'cluster'
  | 'referral'
  | 'co_brand'
  | 'shared_location';

export interface RelationshipStrength {
  score: number;
  factors: {
    name: string;
    contribution: number;
  }[];
  lastUpdated: Date;
}

// ============================================
// NETWORK TYPES
// ============================================

export interface MerchantNetwork {
  id: string;
  name: string;
  type: NetworkType;
  members: string[];
  relationships: string[];
  centrality?: NetworkCentrality;
  clusters?: NetworkCluster[];
  createdAt: Date;
  updatedAt: Date;
}

export type NetworkType =
  | 'chain'
  | 'franchise'
  | 'cooperative'
  | 'association'
  | 'cluster'
  | 'district';

export interface NetworkCentrality {
  degree: Record<string, number>;
  betweenness: Record<string, number>;
  closeness: Record<string, number>;
  pagerank: Record<string, number>;
}

export interface NetworkCluster {
  id: string;
  name?: string;
  members: string[];
  density: number;
  avgDistance: number;
  characteristics: Record<string, unknown>;
}

// ============================================
// GRAPH QUERIES
// ============================================

export interface GraphQuery {
  startNodes: string[];
  relationshipTypes?: RelationshipType[];
  depth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
  filters?: QueryFilter[];
  limit?: number;
}

export interface QueryFilter {
  field: string;
  operator: '==' | '!=' | '>' | '<' | 'in' | 'contains';
  value: unknown;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths?: GraphPath[];
  statistics: GraphStatistics;
}

export interface GraphNode {
  id: string;
  type: 'merchant' | 'network' | 'cluster';
  label: string;
  properties: Record<string, unknown>;
  score?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  weight: number;
  properties?: Record<string, unknown>;
}

export interface GraphPath {
  nodes: string[];
  edges: string[];
  totalWeight: number;
  length: number;
}

export interface GraphStatistics {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  density: number;
  components: number;
  avgClustering: number;
}

// ============================================
// ANALYSIS TYPES
// ============================================

export interface NetworkAnalysis {
  merchantId: string;
  analysisType: AnalysisType;
  results: AnalysisResults;
  recommendations: string[];
  generatedAt: Date;
}

export type AnalysisType =
  | 'influence'
  | 'competition'
  | 'opportunity'
  | 'risk'
  | 'growth_potential'
  | 'similarity';

export interface AnalysisResults {
  score?: number;
  rank?: number;
  percentile?: number;
  factors?: {
    name: string;
    value: number;
    impact: number;
  }[];
  relatedMerchants?: {
    merchantId: string;
    similarity?: number;
    relationship?: string;
  }[];
}

export interface InfluenceAnalysis {
  merchantId: string;
  influenceScore: number;
  reach: {
    direct: number;
    indirect: number;
    total: number;
  };
  impactMetrics: {
    avgTransactionImpact: number;
    customerOverlap: number;
    referralRate: number;
  };
  topInfluencedMerchants: {
    merchantId: string;
    influenceStrength: number;
  }[];
}

export interface OpportunityAnalysis {
  merchantId: string;
  opportunities: {
    type: 'partnership' | 'expansion' | 'demographics' | 'location';
    score: number;
    description: string;
    targetMerchants?: string[];
    estimatedImpact?: number;
  }[];
  competitiveAdvantages: string[];
  marketGaps: string[];
}

// ============================================
// REFERRALS & RECOMMENDATIONS
// ============================================

export interface MerchantReferral {
  id: string;
  referringMerchantId: string;
  referredMerchantId: string;
  type: ReferralType;
  status: ReferralStatus;
  incentive?: ReferralIncentive;
  conversion?: {
    converted: boolean;
    convertedAt?: Date;
    revenue?: number;
  };
  createdAt: Date;
  expiresAt?: Date;
}

export type ReferralType =
  | 'partnership'
  | 'network_invitation'
  | 'cluster_invitation'
  | 'cross_promotion';

export type ReferralStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'converted'
  | 'expired';

export interface ReferralIncentive {
  forReferrer: {
    type: 'cash' | 'credits' | 'discount';
    value: number;
  };
  forReferred: {
    type: 'cash' | 'credits' | 'discount';
    value: number;
  };
}

export interface MerchantRecommendation {
  id: string;
  targetMerchantId: string;
  type: RecommendationType;
  score: number;
  reason: string;
  benefits: string[];
  estimatedImpact?: {
    revenue?: number;
    customers?: number;
    engagement?: number;
  };
  createdAt: Date;
}

export type RecommendationType =
  | 'partnership'
  | 'cluster'
  | 'network'
  | 'location'
  | 'service_improvement';

// ============================================
// REQUEST/RESPONSE
// ============================================

export interface SearchMerchantsRequest {
  query?: string;
  filters?: {
    type?: MerchantType[];
    category?: string[];
    city?: string[];
    minScore?: number;
    hasRelationship?: boolean;
    relationshipType?: RelationshipType;
  };
  sortBy?: 'name' | 'score' | 'revenue' | 'distance';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchMerchantsResponse {
  success: boolean;
  merchants?: Merchant[];
  total?: number;
  error?: string;
}

export interface GetNetworkRequest {
  merchantId: string;
  depth?: number;
  includeRelationships?: boolean;
  includeMetrics?: boolean;
}

export interface GetNetworkResponse {
  success: boolean;
  merchant?: Merchant;
  network?: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  error?: string;
}

export interface AnalyzeMerchantRequest {
  merchantId: string;
  analysisType: AnalysisType;
  options?: {
    compareWith?: string[];
    timeRange?: { start: Date; end: Date };
  };
}

export interface AnalyzeMerchantResponse {
  success: boolean;
  analysis?: NetworkAnalysis;
  error?: string;
}

export interface CreateRelationshipRequest {
  sourceMerchantId: string;
  targetMerchantId: string;
  type: RelationshipType;
  bidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateRelationshipResponse {
  success: boolean;
  relationship?: MerchantRelationship;
  error?: string;
}

// ============================================
// MONGODB SCHEMAS
// ============================================

export interface IMerchant extends Document {
  name: String;
  type: String;
  category: String;
  subcategory: String;
  location: mongoose.Schema.Types.Mixed;
  profile: mongoose.Schema.Types.Mixed;
  relationships: [String];
  metrics: mongoose.Schema.Types.Mixed;
  score: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMerchantRelationship extends Document {
  sourceMerchantId: String;
  targetMerchantId: String;
  type: String;
  strength: Number;
  bidirectional: Boolean;
  metadata: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMerchantNetwork extends Document {
  name: String;
  type: String;
  members: [String];
  relationships: [String];
  centrality: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SERVICE TYPES
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  merchants: number;
  relationships: number;
  networks: number;
  lastProcessed: Date;
}

export interface ServiceStats {
  totalMerchants: number;
  totalRelationships: number;
  totalNetworks: number;
  avgRelationshipsPerMerchant: number;
  byType: Record<MerchantType, number>;
  byCategory: Record<string, number>;
}

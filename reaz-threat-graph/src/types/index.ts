/**
 * REZ Intelligence Threat Graph Types
 *
 * Federated threat intelligence across the entire REZ ecosystem.
 * Combines data from:
 * - CorpID (Identity)
 * - Wasil (Commerce)
 * - RidZa (Finance)
 * - REZ Ride (Mobility)
 * - Airzy (Travel)
 * - RisaCare (Healthcare)
 * - REZ Merchant (Merchant)
 * - BuzzLocal (Social)
 * - MyTalent (Workforce)
 */

// ============================================
// ENTITY TYPES
// ============================================

export type EntityType =
  | 'person'
  | 'merchant'
  | 'device'
  | 'company'
  | 'location'
  | 'account'
  | 'transaction'
  | 'document';

export type ServiceType =
  | 'corpid'
  | 'wasil'
  | 'ridza'
  | 'rez-ride'
  | 'airzy'
  | 'risacare'
  | 'rez-merchant'
  | 'buzzlocal'
  | 'mytalent'
  | 'corp-os';

// ============================================
// SCORE TYPES
// ============================================

export interface UniversalScores {
  trustScore: number;      // 0-1000 (higher = more trusted)
  fraudScore: number;      // 0-100 (lower = safer)
  reputationScore: number; // 0-1000
  riskScore: number;       // 0-100 (lower = safer)
}

export interface ScoreBreakdown {
  factor: string;
  contribution: number;
  details?: string;
}

// ============================================
// ENTITY GRAPH TYPES
// ============================================

export interface EntityIdentity {
  service: ServiceType;
  identifier: string;
  verified: boolean;
  verifiedAt?: Date;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface EntityConnection {
  targetEntityId: string;
  relationship: ConnectionType;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  weight?: number;
}

export type ConnectionType =
  | 'same_device'
  | 'same_person'
  | 'same_location'
  | 'same_account'
  | 'frequent_merchant'
  | 'frequent_customer'
  | 'related_company'
  | 'family_member'
  | 'colleague'
  | 'shared_ip'
  | 'transaction_partner'
  | 'reported_by'
  | 'blocked_by';

export interface ThreatGraphEntity {
  entityId: string;
  entityType: EntityType;
  primaryService: ServiceType;
  services: ServiceType[];
  identities: EntityIdentity[];
  connections: EntityConnection[];
  scores: UniversalScores;
  fraudIndicators: FraudIndicator[];
  badges: string[];
  tags: string[];
  firstSeen: Date;
  lastUpdated: Date;
  status: 'active' | 'suspended' | 'blocked' | 'investigating';
}

export interface FraudIndicator {
  indicator: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: ServiceType;
  detectedAt: Date;
  details?: string;
  confirmed: boolean;
}

// ============================================
// FRAUD NETWORK TYPES
// ============================================

export type FraudRingType =
  | 'fraud_ring'
  | 'mule_network'
  | 'synthetic_identity'
  | 'merchant_scam'
  | 'account_takeover_ring'
  | 'coordinated_abuse';

export interface FraudRingMember {
  entityId: string;
  role: 'master' | 'mule' | 'facilitator' | 'victim' | 'unknown';
  fraudScore: number;
  connections: number;
  services: ServiceType[];
}

export interface FraudPattern {
  pattern: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  occurrences: number;
}

export interface FinancialImpact {
  totalFraudAmount: number;
  affectedTransactions: number;
  affectedMerchants: number;
  affectedUsers: number;
  currency: string;
}

export interface FraudNetwork {
  ringId: string;
  ringType: FraudRingType;
  members: FraudRingMember[];
  patterns: FraudPattern[];
  financialImpact: FinancialImpact;
  connectedRings?: string[];
  status: 'active' | 'blocked' | 'investigating' | 'resolved';
  detectedAt: Date;
  updatedAt: Date;
}

// ============================================
// TRUST SCORE TYPES
// ============================================

export interface TrustScoreRequest {
  entityId: string;
  service?: ServiceType;
  includeBreakdown?: boolean;
}

export interface TrustScoreResponse {
  entityId: string;
  entityType: EntityType;
  scores: UniversalScores;
  breakdown?: {
    trustScore: ScoreBreakdown[];
    fraudScore: ScoreBreakdown[];
    reputationScore: ScoreBreakdown[];
    riskScore: ScoreBreakdown[];
  };
  badges: string[];
  crossServiceSummary: {
    service: ServiceType;
    trustScore: number;
    transactions: number;
  }[];
  lastUpdated: string;
}

export interface TrustBadge {
  badge: string;
  description: string;
  awardedAt: Date;
  expiresAt?: Date;
}

// ============================================
// GRAPH QUERY TYPES
// ============================================

export interface GraphQueryRequest {
  entityId: string;
  depth?: number;
  includeConnections?: boolean;
  includeScores?: boolean;
  includeFraudIndicators?: boolean;
}

export interface GraphQueryResponse {
  entity: ThreatGraphEntity;
  connectedEntities?: ThreatGraphEntity[];
  fraudNetworks?: FraudNetwork[];
  recommendations?: string[];
}

export interface EntitySearchRequest {
  query: string;
  type?: EntityType;
  service?: ServiceType;
  limit?: number;
}

export interface EntitySearchResponse {
  results: {
    entityId: string;
    entityType: EntityType;
    primaryService: ServiceType;
    scores: UniversalScores;
    matchScore: number;
  }[];
  total: number;
}

// ============================================
// DETECTION TYPES
// ============================================

export interface FraudRingDetectionRequest {
  service: ServiceType;
  timeWindow: string; // e.g., "30d"
  minConnections: number;
}

export interface FraudRingDetectionResponse {
  ringId: string;
  detectedAt: string;
  members: FraudRingMember[];
  patterns: FraudPattern[];
  financialImpact: FinancialImpact;
  recommendation: 'monitor' | 'review' | 'block_and_investigate';
}

export interface SyntheticIdentityDetectionRequest {
  entityId: string;
  service: ServiceType;
}

export interface SyntheticIdentityDetectionResponse {
  entityId: string;
  isSynthetic: boolean;
  confidence: number;
  indicators: {
    indicator: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }[];
  recommendation: 'approve' | 'review' | 'reject';
}

export interface MuleAccountDetectionRequest {
  accountId: string;
  service: ServiceType;
  recentTransactions: {
    amount: number;
    direction: 'incoming' | 'outgoing';
    timestamp: Date;
    counterparty: string;
  }[];
}

export interface MuleAccountDetectionResponse {
  accountId: string;
  isMule: boolean;
  confidence: number;
  indicators: {
    indicator: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }[];
  recommendation: 'allow' | 'review' | 'block';
}

// ============================================
// INTELLIGENCE TYPES
// ============================================

export interface ThreatActor {
  actorId: string;
  name: string;
  type: 'fraud_ring' | 'scammer' | 'bot' | 'suspicious_merchant' | 'bad_actor';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  services: ServiceType[];
  knownAliases: string[];
  associatedEntities: string[];
  lastActivity: Date;
  totalImpact?: FinancialImpact;
}

export interface ThreatCampaign {
  campaignId: string;
  name: string;
  description: string;
  status: 'active' | 'mitigated' | 'investigating';
  affectedServices: ServiceType[];
  affectedEntities: number;
  financialImpact: FinancialImpact;
  startDate: Date;
  endDate?: Date;
  iocs: string[]; // Indicators of Compromise
}

export interface ThreatIntelligence {
  threats: ThreatActor[];
  campaigns: ThreatCampaign[];
  lastUpdated: Date;
}

// ============================================
// REPORT TYPES
// ============================================

export interface FraudReportRequest {
  reporterId: string;
  reporterService: ServiceType;
  reportedEntityId: string;
  reportedService: ServiceType;
  reportType: 'fraud' | 'scam' | 'suspicious' | 'fake_identity' | 'fake_merchant';
  description: string;
  evidence?: {
    type: 'screenshot' | 'transaction' | 'message' | 'other';
    data: string;
  }[];
}

export interface FraudReportResponse {
  reportId: string;
  status: 'submitted' | 'investigating' | 'confirmed' | 'dismissed';
  createdAt: string;
  impactOnScores: {
    entityId: string;
    scoreChange: Partial<UniversalScores>;
  }[];
}

// ============================================
// SERVICE INTEGRATION TYPES
// ============================================

export interface ServiceIntegration {
  service: ServiceType;
  enabled: boolean;
  lastSync?: Date;
  entitiesCount: number;
  connectionsCount: number;
}

export interface SyncStatus {
  service: ServiceType;
  status: 'syncing' | 'synced' | 'error' | 'pending';
  lastSync?: Date;
  entitiesSynced: number;
  errors?: string[];
}

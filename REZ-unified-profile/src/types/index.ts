// Unified Profile Types - Single Source of Truth for User Data

export interface LinkedAccount {
  provider: string;
  externalId: string;
  linkedAt: Date;
}

export interface IdentityData {
  primaryId: string;
  emails: string[];
  phones: string[];
  devices: string[];
  linkedAccounts: LinkedAccount[];
  trustScore: number;
}

export interface Demographics {
  name?: string;
  age?: number;
  gender?: string;
  city?: string;
  pincode?: string;
  language?: string;
  occupation?: string;
  incomeTier?: string;
}

export interface LocationSignals {
  segments: string[];
  patterns: string[];
  favoriteZones: string[];
  confidence: number;
}

export interface BehavioralSignals {
  buyerType: string;
  cashbackSensitivity: number;
  luxuryAffinity: number;
  impulseScore: number;
  confidence: number;
}

export interface SocialSignals {
  influenceTier: string;
  referralCount: number;
  sharingRate: number;
  confidence: number;
}

export interface CompetitorSignals {
  loyaltyScore: number;
  switchRisk: string;
  winBackPotential: number;
  confidence: number;
}

export interface SignalScores {
  location: LocationSignals;
  behavioral: BehavioralSignals;
  social: SocialSignals;
  competitor: CompetitorSignals;
  overall: number;
}

export interface LifetimeMetrics {
  tenureDays: number;
  totalOrders: number;
  totalSpend: number;
  avgOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  predictedLTV: number;
}

export interface ActivityPeriod {
  orders: number;
  spend: number;
  visits: number;
  sessions?: number;
}

export interface EngagementMetrics {
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  engagementIndex: number;
}

export interface ActivitySummary {
  last30Days: ActivityPeriod;
  last90Days: ActivityPeriod;
  engagement: EngagementMetrics;
}

export interface UserPreferences {
  categories: string[];
  brands: string[];
  priceRange: {
    min: number;
    max: number;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  communicationFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
  timezone?: string;
}

export interface UnifiedProfile {
  userId: string;
  identity: IdentityData;
  demographics: Demographics;
  signals: SignalScores;
  segments: string[];
  lifetime: LifetimeMetrics;
  activity: ActivitySummary;
  preferences: UserPreferences;
  lastUpdated: Date;
  createdAt: Date;
}

export interface EnrichmentPayload {
  source: 'identity' | 'cdp' | 'orders' | 'signals' | 'manual';
  data: Record<string, unknown>;
  timestamp?: Date;
}

export interface ProfileMergeRequest {
  primaryUserId: string;
  secondaryUserIds: string[];
  strategy?: 'primary-wins' | 'latest-wins' | 'merge-all';
}

export interface ProfileSearchQuery {
  email?: string;
  phone?: string;
  segment?: string;
  city?: string;
  minLifetimeValue?: number;
  maxLifetimeValue?: number;
  limit?: number;
  offset?: number;
}

export interface ServiceSignalResponse {
  success: boolean;
  data?;
  error?: string;
}

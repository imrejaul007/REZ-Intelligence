// Competitor Types for REZ Competitor Detection Service

export type VisitType = 'delivery' | 'dine_in' | 'pickup';
export type SignalType = 'price_alert' | 'review_drop' | 'offer_expired' | 'new_competitor' | 'poor_experience';
export type Severity = 'low' | 'medium' | 'high';
export type Channel = 'sms' | 'email' | 'push' | 'whatsapp';
export type Timing = 'immediate' | 'morning' | 'evening' | 'weekend';

export interface CompetitorVisit {
  competitorId: string;
  competitorName: string;
  category: string;
  visitDate: Date;
  spend: number;
  visitType: VisitType;
  metadata?: Record<string, unknown>;
}

export interface CompetitorActivity {
  visitsToCompetitors: CompetitorVisit[];
  competitorSpending: number;
  competitorShare: number;      // % of category spend at competitors
  preferredCompetitors: string[];
  switchFrequency: number;
  lastCompetitorVisit: Date | null;
}

export interface SwitchSignal {
  type: SignalType;
  competitorId?: string;
  severity: Severity;
  timestamp: Date;
  description?: string;
}

export interface WinBackPotential {
  score: number;              // 0-100
  tier: 'hot' | 'warm' | 'cold';
  topTrigger: string;         // Best offer to win back
  optimalChannel: Channel;
  optimalTiming: Timing;
  competitorsTargeting: string[];
  estimatedValue: number;     // Potential revenue
  recommendedOffer: string;
}

export interface UserCompetitorProfile {
  userId: string;
  competitorActivity: CompetitorActivity;
  switchSignals: SwitchSignal[];
  loyaltyScore: number;       // 0-100, higher = more loyal
  winBackPotential?: WinBackPotential;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
  createdAt: Date;
}

export interface DetectionInput {
  userId: string;
  viewedCompetitorPrices: number;
  ratingTrend: number;
  visitsToNewCompetitor: number;
  totalSpending: number;
  competitorSpending: number;
  lastOrderDate: Date;
  averageOrderValue: number;
  orderFrequency: number;
  competitorVisits: CompetitorVisit[];
}

export interface CompetitorInfo {
  id: string;
  name: string;
  category: string;
  averageSpend: number;
  marketShare: number;
  threatLevel: 'low' | 'medium' | 'high';
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface CompetitorProfileResponse extends ApiResponse<UserCompetitorProfile> {}

export interface SignalsResponse extends ApiResponse<SwitchSignal[]> {}

export interface WinBackResponse extends ApiResponse<WinBackPotential> {}

export interface SwitcherListItem {
  userId: string;
  loyaltyScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  competitorShare: number;
  switchSignals: SwitchSignal[];
  topCompetitor: string;
  lastUpdated: Date;
}

export interface WinBackListItem {
  userId: string;
  winBackScore: number;
  tier: 'hot' | 'warm' | 'cold';
  topTrigger: string;
  optimalChannel: Channel;
  estimatedValue: number;
  competitorsTargeting: string[];
}

// Known Competitors Database
export const KNOWN_COMPETITORS: Record<string, CompetitorInfo> = {
  'swiggy': {
    id: 'swiggy',
    name: 'Swiggy',
    category: 'food_delivery',
    averageSpend: 450,
    marketShare: 0.35,
    threatLevel: 'high'
  },
  'zomato': {
    id: 'zomato',
    name: 'Zomato',
    category: 'food_delivery',
    averageSpend: 400,
    marketShare: 0.30,
    threatLevel: 'high'
  },
  'dominos': {
    id: 'dominos',
    name: "Domino's Pizza",
    category: 'quick_service',
    averageSpend: 600,
    marketShare: 0.15,
    threatLevel: 'medium'
  },
  'mcdonalds': {
    id: 'mcdonalds',
    name: "McDonald's",
    category: 'quick_service',
    averageSpend: 350,
    marketShare: 0.12,
    threatLevel: 'medium'
  }
};

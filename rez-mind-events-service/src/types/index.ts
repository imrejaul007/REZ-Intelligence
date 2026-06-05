/**
 * ReZ Mind Events Service - TypeScript Interfaces
 */

export enum EventType {
  CORPORATE = 'corporate',
  SOCIAL = 'social',
  ENTERTAINMENT = 'entertainment',
  SPORTS = 'sports',
  EDUCATIONAL = 'educational',
  CHARITY = 'charity',
  WEDDING = 'wedding',
  CONFERENCE = 'conference',
}

export enum VendorCategory {
  CATERING = 'catering',
  VENUE = 'venue',
  DECORATION = 'decoration',
  AUDIO_VISUAL = 'audio_visual',
  PHOTOGRAPHY = 'photography',
  ENTERTAINMENT = 'entertainment',
  TRANSPORTATION = 'transportation',
  SECURITY = 'security',
  MARKETING = 'marketing',
}

export enum DemandLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum EventStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface EventDetails {
  type: EventType;
  name: string;
  date: Date;
  venue: string;
  capacity: number;
  targetAudience?: string[];
  budget?: number;
}

export interface AttendancePrediction {
  predictionId: string;
  eventId: string;
  predictedAttendance: number;
  confidence: number;
  confidenceInterval: { lower: number; upper: number };
  demandLevel: DemandLevel;
  factors: string[];
  predictionDate: Date;
  actualAttendance?: number;
  accuracy?: number;
}

export interface PricingOptimization {
  optimizationId: string;
  eventId: string;
  currentPrice: number;
  optimizedPrice: number;
  demandLevel: DemandLevel;
  confidence: number;
  factors: string[];
  priceRange: { min: number; max: number };
  optimizationDate: Date;
  expectedRevenue?: number;
}

export interface VendorMatch {
  matchId: string;
  eventId: string;
  vendorId: string;
  vendorName: string;
  category: VendorCategory;
  matchScore: number;
  compatibility: string[];
  pricing: { min: number; max: number };
  performance: {
    reliability: number;
    quality: number;
    value: number;
  };
  recommendations: string[];
}

export interface MarketingCampaign {
  campaignId: string;
  eventId: string;
  channels: string[];
  budgetAllocation: Record<string, number>;
  expectedReach: number;
  timeline: { start: Date; end: Date };
  recommendations: string[];
  estimatedROI: number;
}

export interface GuestSatisfactionPrediction {
  predictionId: string;
  eventId: string;
  predictedSatisfaction: number;
  confidence: number;
  factors: { name: string; impact: number }[];
  recommendations: string[];
}

export interface BudgetOptimization {
  eventId: string;
  totalBudget: number;
  allocation: { category: string; amount: number; percentage: number }[];
  recommendations: string[];
  expectedEfficiency: number;
}

// Session Types
export interface EventsMindSessionData {
  sessionId: string;
  eventId: string;
  organizerId?: string;
  intent: string;
  context: {
    eventType?: EventType;
    eventDate?: Date;
    venue?: string;
    capacity?: number;
  };
  analysis: {
    attendancePrediction?: AttendancePrediction;
    pricingOptimization?: PricingOptimization;
    vendorMatches?: VendorMatch[];
    marketingCampaign?: MarketingCampaign;
    guestSatisfaction?: GuestSatisfactionPrediction;
  };
  sentiment?: number;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types
export interface ConsultRequest {
  eventId: string;
  organizerId?: string;
  eventDetails?: EventDetails;
}

export interface ConsultResponse {
  sessionId: string;
  attendancePrediction?: AttendancePrediction;
  pricingOptimization?: PricingOptimization;
  vendorMatches?: VendorMatch[];
  marketingCampaign?: MarketingCampaign;
  guestSatisfaction?: GuestSatisfactionPrediction;
  confidence: number;
}

export interface PricingRequest {
  eventId: string;
  currentPrice?: number;
  targetAttendance?: number;
  competitorsPrices?: number[];
}

export interface VendorRecommendationRequest {
  eventId: string;
  eventType?: EventType;
  requirements?: string[];
  budget?: number;
}

export interface CampaignRequest {
  eventId: string;
  budget?: number;
  targetReach?: number;
  timeline?: { start: Date; end: Date };
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface DependencyHealth {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}
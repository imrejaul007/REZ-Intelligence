import mongoose, { Document, Schema } from 'mongoose';

// Session types
export type SessionStatus = 'active' | 'completed' | 'expired';

export interface IAutomotiveMindSession extends Document {
  sessionId: string;
  userId: string;
  merchantId?: string;
  context: {
    customerId?: string;
    vehicleId?: string;
    serviceType?: string;
    intent?: string;
  };
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>;
  status: SessionStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Pricing optimization types
export interface IVehiclePricingData {
  make: string;
  model: string;
  variant: string;
  year: number;
  kilometerReading: number;
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid';
  transmission: 'manual' | 'auto';
  ownership: '1st' | '2nd' | '3rd';
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  location?: string;
  marketData?: {
    similarListings: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  };
}

export interface IPricingRecommendation {
  sessionId: string;
  vehicleData: IVehiclePricingData;
  recommendation: {
    minPrice: number;
    optimalPrice: number;
    maxPrice: number;
    confidence: number;
    currency: string;
  };
  factors: Array<{
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    description: string;
  }>;
  marketAnalysis: {
    demand: 'high' | 'medium' | 'low';
    competition: 'low' | 'medium' | 'high';
    trend: 'appreciation' | 'stable' | 'depreciation';
  };
  suggestedPricing: Array<{
    strategy: string;
    price: number;
    expectedDaysToSell: string;
    confidence: number;
  }>;
  timestamp: Date;
}

export interface IPricingOptimization extends Document {
  pricingId: string;
  merchantId: string;
  vehicleData: IVehiclePricingData;
  recommendation: IPricingRecommendation['recommendation'];
  factors: IPricingRecommendation['factors'];
  marketAnalysis: IPricingRecommendation['marketAnalysis'];
  usedForPricing?: {
    appliedPrice: number;
    appliedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Service prediction types
export interface IServiceHistory {
  serviceDate: Date;
  serviceType: 'regular' | 'repair' | 'inspection';
  kilometersAtService: number;
  items: Array<{ name: string; cost: number }>;
  totalCost: number;
}

export interface IServicePrediction {
  sessionId: string;
  vehicleId: string;
  customerId?: string;
  prediction: {
    nextServiceDue: Date;
    nextServiceKm: number;
    serviceType: 'regular' | 'repair' | 'inspection';
    estimatedCost: {
      min: number;
      max: number;
      avg: number;
    };
    confidence: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  factors: Array<{
    type: 'usage_pattern' | 'part_wear' | 'time_based' | 'km_based';
    description: string;
    impact: 'positive' | 'negative';
    weight: number;
  }>;
  recommendations: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
  }>;
  alternativePredictions: Array<{
    scenario: string;
    nextServiceDue: Date;
    nextServiceKm: number;
    confidence: number;
  }>;
  timestamp: Date;
}

export interface IServicePredictionRecord extends Document {
  predictionId: string;
  vehicleId: string;
  customerId?: string;
  merchantId: string;
  serviceHistory: IServiceHistory[];
  prediction: IServicePrediction['prediction'];
  factors: IServicePrediction['factors'];
  recommendations: IServicePrediction['recommendations'];
  actualServiceDate?: Date;
  accuracy?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Lead scoring types
export interface ILeadData {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  source: 'web' | 'mobile' | 'phone' | 'walk-in' | 'referral' | 'other';
  interest: {
    vehicleId?: string;
    vehicleInterest?: string;
    serviceInterest?: string;
    budget?: { min: number; max: number };
    timeline?: 'immediate' | '1_month' | '3_months' | '6_months' | 'exploring';
  };
  engagement: {
    pagesViewed?: number;
    inquiriesMade?: number;
    appointmentsBooked?: number;
    testDrivesTaken?: number;
    lastActivity?: Date;
  };
  demographic?: {
    age?: number;
    occupation?: string;
    location?: string;
  };
}

export interface ILeadScore {
  sessionId: string;
  leadData: ILeadData;
  score: {
    total: number;
    max: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    percentile: number;
  };
  breakdown: Array<{
    category: 'intent' | 'engagement' | 'demographic' | 'behavioral';
    score: number;
    maxScore: number;
    factors: Array<{
      name: string;
      value: number;
      maxValue: number;
      weight: number;
    }>;
  }>;
  insights: Array<{
    type: 'strength' | 'concern' | 'opportunity';
    description: string;
  }>;
  recommendedActions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  nextBestAction: string;
  conversionProbability: number;
  timestamp: Date;
}

export interface ILeadScoreRecord extends Document {
  scoreId: string;
  leadData: ILeadData;
  merchantId: string;
  score: ILeadScore['score'];
  breakdown: ILeadScore['breakdown'];
  insights: ILeadScore['insights'];
  recommendedActions: ILeadScore['recommendedActions'];
  contacted: boolean;
  converted: boolean;
  conversionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response types
export interface IConsultRequest {
  message: string;
  context?: {
    customerId?: string;
    vehicleId?: string;
    merchantId?: string;
    sessionId?: string;
  };
}

export interface IConsultResponse {
  sessionId: string;
  message: string;
  suggestions?: string[];
  actions?: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  timestamp: Date;
}

export interface IPricingRequest {
  vehicleData: IVehiclePricingData;
  strategy?: 'quick_sale' | 'max_value' | 'balanced';
}

export interface IServicePredictionRequest {
  vehicleId: string;
  currentKilometerReading?: number;
  serviceHistory?: IServiceHistory[];
}

export interface ILeadScoreRequest {
  leadData: ILeadData;
  merchantId: string;
}

// Pagination
export interface IPaginationOptions {
  page?: number;
  limit?: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

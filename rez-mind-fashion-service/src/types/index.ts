import mongoose, { Document } from 'mongoose';

// Session
export type SessionStatus = 'active' | 'completed' | 'expired';

export interface IFashionMindSession extends Document {
  sessionId: string;
  userId: string;
  merchantId?: string;
  context: { customerId?: string; productId?: string; intent?: string };
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }>;
  status: SessionStatus;
  expiresAt: Date;
}

// Trend Analysis
export interface ITrendData {
  category: string;
  subcategory?: string;
  style?: string;
  color?: string;
  pattern?: string;
  fabric?: string;
  occasion?: string;
}

export interface ITrendAnalysis extends Document {
  analysisId: string;
  merchantId: string;
  category: string;
  trendType: 'emerging' | 'stable' | 'declining';
  popularity: number;
  growthRate: number;
  demographics: string[];
  sources: string[];
  prediction: {
    nextPeak: Date;
    confidence: number;
    forecast: 'growth' | 'stable' | 'decline';
  };
  recommendations: Array<{ action: string; priority: 'high' | 'medium' | 'low' }>;
  createdAt: Date;
}

// Style Match
export interface IStyleMatch extends Document {
  matchId: string;
  customerId: string;
  merchantId: string;
  styleProfile: {
    bodyType?: string;
    preferredStyles: string[];
    preferredColors: string[];
    sizePreferences: Record<string, number>;
    budgetRange?: { min: number; max: number };
  };
  matches: Array<{
    productId: string;
    matchScore: number;
    reasons: string[];
  }>;
  confidence: number;
  createdAt: Date;
}

// Inventory Optimization
export interface IInventoryOptimization extends Document {
  optimizationId: string;
  merchantId: string;
  productId?: string;
  category: string;
  currentStock: number;
  recommendation: {
    type: 'reorder' | 'discount' | 'maintain' | 'discontinue';
    quantity?: number;
    suggestedPrice?: number;
    urgency: 'low' | 'medium' | 'high';
    reason: string;
  };
  forecast: {
    demand: number;
    daysUntilStockout: number;
    confidence: number;
  };
  alternatives: Array<{ productId: string; name: string; score: number }>;
  createdAt: Date;
}

// API Request/Response types
export interface IConsultRequest {
  message: string;
  context?: { customerId?: string; productId?: string; merchantId?: string; sessionId?: string };
}

export interface IConsultResponse {
  sessionId: string;
  message: string;
  suggestions?: string[];
  timestamp: Date;
}

export interface ITrendRequest {
  category?: string;
  season?: string;
  region?: string;
  demographics?: string[];
}

export interface IStyleMatchRequest {
  customerId: string;
  merchantId: string;
  styleProfile?: {
    bodyType?: string;
    stylePreferences?: string[];
    colorPreferences?: string[];
    budgetRange?: { min: number; max: number };
  };
  limit?: number;
}

export interface IInventoryOptimizationRequest {
  merchantId: string;
  category?: string;
  forecastPeriod?: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
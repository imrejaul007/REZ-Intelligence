/**
 * Type definitions for Real Estate Expert
 */

export interface Property {
  id: string;
  title: string;
  type: 'apartment' | 'house' | 'villa' | 'plot' | 'commercial' | 'industrial';
  status: 'sale' | 'rent' | 'pg';
  price: number;
  pricePerSqft?: number;
  location: {
    city: string;
    locality: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  specs: {
    bedrooms?: number;
    bathrooms?: number;
    area: number;
    areaUnit: 'sqft' | 'sqm' | 'bigha' | 'acre';
    furnished?: 'furnished' | 'semi-furnished' | 'unfurnished';
    floor?: number;
    totalFloors?: number;
    parking?: number;
  };
  amenities: string[];
  images: string[];
  owner: {
    name: string;
    phone: string;
    verified: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PropertySearchParams {
  query?: string;
  type?: Property['type'];
  status?: Property['status'];
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  locality?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minArea?: number;
  maxArea?: number;
  furnished?: Property['specs']['furnished'];
  amenities?: string[];
  page?: number;
  limit?: number;
}

export interface InvestmentAnalysis {
  propertyId: string;
  property: Property;
  purchasePrice: number;
  rentalYield: number;
  capitalAppreciation: number;
  totalInvestment: number;
  monthlyRental: number;
  annualReturn: number;
  breakEvenYears: number;
  riskScore: 'low' | 'medium' | 'high';
  recommendation: 'buy' | 'hold' | 'avoid';
  comparableRentals: Property[];
  marketTrend: 'rising' | 'stable' | 'falling';
}

export interface MarketTrend {
  city: string;
  locality: string;
  avgPricePerSqft: number;
  priceChange: number;
  avgRentalYield: number;
  totalListings: number;
  trend: 'rising' | 'stable' | 'falling';
  lastUpdated: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  preferences: Partial<PropertySearchParams>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

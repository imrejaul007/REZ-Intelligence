/**
 * REZ ETA Prediction - Types
 */

export interface ETAPrediction {
  orderId: string;
  estimatedDeliveryTime: Date;
  estimatedMinutes: number;
  confidence: number; // 0-1
  factors: ETAFactor[];
  modelVersion: string;
  predictedAt: Date;
}

export interface ETAFactor {
  name: string;
  impact: number; // positive = adds time, negative = reduces time
  value: number;
}

export interface ETAPredictRequest {
  orderId: string;
  pickup: GeoLocation;
  dropoff: GeoLocation;
  riderLocation?: GeoLocation;
  orderTime: Date;
  merchantId: string;
  items: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
}

// Training Data
export interface DeliveryDataPoint {
  pickup: GeoLocation;
  dropoff: GeoLocation;
  actualTime: number; // minutes
  distance: number; // km
  timeOfDay: number; // hour (0-23)
  dayOfWeek: number; // 0-6
  weather: WeatherCondition;
  traffic: TrafficLevel;
  riderId: string;
  merchantId: string;
}

export type WeatherCondition = 'clear' | 'rain' | 'heavy_rain' | 'fog' | 'hot';
export type TrafficLevel = 'low' | 'medium' | 'high' | 'jam';

// Model
export interface ETAModel {
  id: string;
  version: string;
  coefficients: number[];
  intercept: number;
  accuracy: number; // MAPE
  trainedAt: Date;
  features: string[];
}

export interface ETAAccuracy {
  date: Date;
  totalPredictions: number;
  avgError: number; // minutes
  mape: number; // Mean Absolute Percentage Error
  within15min: number; // % predictions within 15 min of actual
  within30min: number; // % predictions within 30 min of actual
}

// Traffic
export interface TrafficData {
  location: GeoLocation;
  level: TrafficLevel;
  speed: number; // km/h
  congestion: number; // 0-1
  updatedAt: Date;
}

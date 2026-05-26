/**
 * TypeScript type definitions for REZ Demand Forecast
 */

import mongoose, { Types } from 'mongoose';

/**
 * Forecast features
 */
export interface ForecastFeatures {
  historicalAvg: number;
  dayOfWeekFactor: number;
  timeFactor: number;
  weatherFactor: number;
  eventFactor: number;
  trendFactor: number;
}

/**
 * Alert severity
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert type
 */
export type AlertType = 'demand_spike' | 'demand_drop' | 'inventory_low' | 'staffing';

/**
 * Demand alert
 */
export interface DemandAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  recommendedAction?: string;
  createdAt: Date;
  acknowledged: boolean;
}

/**
 * Weekly forecast entry
 */
export interface WeeklyForecastEntry {
  date: Date;
  predictedOrders: number;
  predictedRevenue: number;
  confidence: number;
}

/**
 * Today forecast summary
 */
export interface TodayForecast {
  totalOrders?: number;
  peakHour?: number;
  estimatedRevenue?: number;
  confidence?: number;
}

/**
 * Demand forecast record document
 */
export interface IDemandForecast {
  _id: Types.ObjectId;
  merchantId: string;
  itemId?: string;
  date: Date;
  hour?: number;
  dayOfWeek?: number;
  predictedDemand: number;
  actualDemand: number;
  accuracy?: number;
  features: ForecastFeatures;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Merchant demand document
 */
export interface IMerchantDemand {
  _id: Types.ObjectId;
  merchantId: string;
  name?: string;
  peakHours: number[];
  busyDays: number[];
  avgDailyOrders: number;
  avgOrderValue: number;
  avgPrepTime: number;
  forecastAccuracy: number;
  todayForecast?: TodayForecast;
  weeklyForecast: WeeklyForecastEntry[];
  alerts: DemandAlert[];
  lastUpdated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Forecast result
 */
export interface ForecastResult {
  predictedDemand: number;
  confidence: number;
  features: {
    historicalAvg: number;
    dayOfWeekFactor: number;
    timeFactor: number;
    trendFactor: number;
    dayOfWeek: number;
    hour: number;
  };
}

/**
 * Day forecast result
 */
export interface DayForecastResult {
  date: Date;
  totalDemand: number;
  peakHour: number;
  peakDemand: number;
  hourlyBreakdown: Array<{
    hour: number;
    predictedDemand: number;
    confidence: number;
    features: ForecastResult['features'];
  }>;
  confidence: number;
}

/**
 * Staffing recommendation
 */
export interface StaffingRecommendation {
  hour: number;
  predictedOrders: number;
  recommendedStaff: number;
  status: 'busy' | 'normal' | 'quiet';
}

/**
 * Inventory recommendation
 */
export interface InventoryRecommendation {
  merchantId: string;
  date: string;
  estimatedOrders: number;
  estimatedItems: number;
  bufferStock: number;
  alerts: DemandAlert[];
}

/**
 * Demand insights
 */
export interface DemandInsights {
  merchantId: string;
  summary: {
    avgDailyOrders: number;
    avgOrderValue: number;
    forecastAccuracy: string;
  };
  patterns: {
    peakHours: number[];
    busyDays: number[];
  };
  alerts: DemandAlert[];
}

/**
 * Express request extension
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

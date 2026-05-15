/**
 * REZ Fleet Management - Types
 */

// Rider Types
export interface Rider {
  id: string;
  name: string;
  phone: string;
  status: 'available' | 'busy' | 'offline';
  location: GeoLocation;
  vehicleType: 'bike' | 'scooter' | 'car';
  capacity: number; // Max orders per trip
  rating: number;
  totalDeliveries: number;
  earnings: number;
  createdAt: Date;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
}

// Order Types
export interface DeliveryOrder {
  id: string;
  pickup: GeoLocation;
  dropoff: GeoLocation;
  items: number;
  weight: number;
  priority: 'normal' | 'urgent';
  estimatedTime: number; // minutes
  customerId: string;
  merchantId: string;
}

// Route Types
export interface Route {
  id: string;
  riderId: string;
  orders: RouteOrder[];
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  totalDistance: number; // km
  totalTime: number; // minutes
  createdAt: Date;
}

export interface RouteOrder {
  orderId: string;
  type: 'pickup' | 'dropoff';
  location: GeoLocation;
  sequence: number;
  estimatedArrival?: Date;
  actualArrival?: Date;
}

// Surge Pricing
export interface SurgeZone {
  id: string;
  location: GeoLocation;
  radius: number; // km
  multiplier: number;
  activeRiders: number;
  pendingOrders: number;
  startedAt: Date;
  endsAt?: Date;
}

// Incentive Types
export interface RiderIncentive {
  id: string;
  riderId: string;
  type: 'peak_bonus' | 'distance_bonus' | 'order_bonus' | 'streak_bonus';
  amount: number;
  conditions: IncentiveCondition[];
  earnedAt: Date;
  status: 'pending' | 'earned' | 'paid';
}

export interface IncentiveCondition {
  metric: 'orders' | 'distance' | 'hours' | 'rating';
  operator: 'gte' | 'lte' | 'eq';
  value: number;
}

// Capacity Planning
export interface CapacityPrediction {
  zoneId: string;
  hour: number;
  predictedOrders: number;
  predictedRiders: number;
  confidence: number;
  updatedAt: Date;
}

// Fleet Stats
export interface FleetStats {
  totalRiders: number;
  availableRiders: number;
  busyRiders: number;
  offlineRiders: number;
  activeOrders: number;
  avgDeliveryTime: number;
  avgRating: number;
  utilizationRate: number;
}

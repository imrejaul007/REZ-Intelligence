/**
 * Type definitions for Logistics Expert
 */

export interface Location {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface RouteStop {
  id: string;
  location: Location;
  arrivalTime?: string;
  departureTime?: string;
  status: 'pending' | 'in_transit' | 'arrived' | 'completed' | 'failed';
  notes?: string;
}

export interface Route {
  id: string;
  stops: RouteStop[];
  totalDistance: number;
  estimatedDuration: number;
  fuelCost: number;
  waypoints: { lat: number; lng: number }[];
  optimized: boolean;
}

export interface Vehicle {
  id: string;
  type: 'bike' | 'car' | 'van' | 'truck' | 'lorry';
  capacity: { weight: number; volume: number };
  currentLocation: Location;
  status: 'available' | 'in_use' | 'maintenance' | 'offline';
  driver?: { name: string; phone: string };
  fuelLevel: number;
  mileage: number;
}

export interface Shipment {
  id: string;
  trackingId: string;
  origin: Location;
  destination: Location;
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled';
  weight: number;
  dimensions?: { length: number; width: number; height: number };
  priority: 'standard' | 'express' | 'overnight';
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: ShipmentEvent[];
  assignedVehicle?: string;
}

export interface ShipmentEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

export interface FleetAnalytics {
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  maintenanceVehicles: number;
  averageUtilization: number;
  totalDistanceCovered: number;
  fuelEfficiency: number;
  onTimeDeliveryRate: number;
  activeShipments: number;
  completedToday: number;
}

export interface OptimizationResult {
  routeId: string;
  originalDistance: number;
  optimizedDistance: number;
  savingsPercent: number;
  originalDuration: number;
  optimizedDuration: number;
  timeSavedMinutes: number;
  fuelSavings: number;
  stops: RouteStop[];
}

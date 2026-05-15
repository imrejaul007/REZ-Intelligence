/**
 * REZ Fleet Management - Routing Service
 * Optimal route calculation for delivery riders
 */

import { Rider, DeliveryOrder, Route, RouteOrder, GeoLocation } from '../types';

interface RouteResult {
  route: Route;
  totalDistance: number;
  totalTime: number;
}

export class RoutingService {
  /**
   * Calculate optimal route for a rider with multiple orders
   */
  async calculateOptimalRoute(
    rider: Rider,
    orders: DeliveryOrder[]
  ): Promise<RouteResult> {
    // Separate pickups and dropoffs
    const pickups: RouteOrder[] = orders.map((o) => ({
      orderId: o.id,
      type: 'pickup' as const,
      location: o.pickup,
      sequence: 0,
    }));

    const dropoffs: RouteOrder[] = orders.map((o) => ({
      orderId: o.id,
      type: 'dropoff' as const,
      location: o.dropoff,
      sequence: 0,
    }));

    // Sort pickups by distance from rider
    const sortedPickups = this.sortByDistance(rider.location, pickups);

    // Assign sequences
    const sequencedOrders: RouteOrder[] = [];
    sortedPickups.forEach((p, i) => {
      sequencedOrders.push({
        orderId: p.orderId,
        type: p.type,
        location: p.location,
        sequence: i * 2 + 1,
      });
    });

    // Add dropoffs after pickups
    sortedPickups.forEach((p, i) => {
      const dropoff = dropoffs.find((d) => d.orderId === p.orderId)!;
      sequencedOrders.push({
        orderId: dropoff.orderId,
        type: dropoff.type,
        location: dropoff.location,
        sequence: i * 2 + 2,
      });
    });

    // Calculate ETA for each stop
    let currentTime = new Date();
    let currentLocation = rider.location;

    const ordersWithETA = sequencedOrders.map((order) => {
      const distance = this.calculateDistance(currentLocation, order.location);
      const travelTime = distance / 30 * 60; // 30 km/h average
      const serviceTime = order.type === 'pickup' ? 5 : 2; // 5 min pickup, 2 min dropoff

      currentTime = new Date(currentTime.getTime() + (travelTime + serviceTime) * 60000);
      currentLocation = order.location;

      return {
        ...order,
        estimatedArrival: new Date(currentTime),
      };
    });

    const totalDistance = ordersWithETA.reduce((sum, order, i) => {
      if (i === 0) {
        return this.calculateDistance(rider.location, order.location);
      }
      return sum + this.calculateDistance(ordersWithETA[i - 1].location, order.location);
    }, 0);

    const totalTime = (currentTime.getTime() - Date.now()) / 60000;

    const route: Route = {
      id: `route-${Date.now()}`,
      riderId: rider.id,
      orders: ordersWithETA,
      status: 'pending',
      totalDistance,
      totalTime,
      createdAt: new Date(),
    };

    return { route, totalDistance, totalTime };
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(point1: GeoLocation, point2: GeoLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.lat)) *
        Math.cos(this.toRad(point2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Sort locations by distance from origin
   */
  private sortByDistance(
    origin: GeoLocation,
    locations: RouteOrder[]
  ): RouteOrder[] {
    return [...locations].sort((a, b) => {
      const distA = this.calculateDistance(origin, a.location);
      const distB = this.calculateDistance(origin, b.location);
      return distA - distB;
    });
  }

  /**
   * Find nearest available rider for an order
   */
  async findNearestRider(
    order: DeliveryOrder,
    riders: Rider[]
  ): Promise<Rider | null> {
    const available = riders.filter((r) => r.status === 'available');

    if (available.length === 0) return null;

    // Sort by distance to pickup
    available.sort((a, b) => {
      const distA = this.calculateDistance(a.location, order.pickup);
      const distB = this.calculateDistance(b.location, order.pickup);
      return distA - distB;
    });

    return available[0];
  }

  /**
   * Batch orders for efficient delivery
   */
  async batchOrders(
    orders: DeliveryOrder[],
    maxBatchSize: number = 5
  ): Promise<DeliveryOrder[][]> {
    const batches: DeliveryOrder[][] = [];
    const remaining = [...orders];

    while (remaining.length > 0) {
      const batch = remaining.splice(0, maxBatchSize);
      batches.push(batch);
    }

    return batches;
  }
}

export const routingService = new RoutingService();

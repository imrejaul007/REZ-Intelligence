/**
 * REZ Fleet Management - Surge Pricing Service
 */

import crypto from 'crypto';
import { SurgeZone, GeoLocation } from '../types';

export class SurgePricingService {
  private baseMultiplier = 1.0;
  private maxMultiplier = 2.5;

  /**
   * Calculate surge multiplier for a zone
   */
  calculateSurge(
    activeRiders: number,
    pendingOrders: number
  ): number {
    if (activeRiders === 0) return this.maxMultiplier;

    const ratio = pendingOrders / activeRiders;

    // Surge zones
    if (ratio >= 3) return 2.0 + crypto.randomInt(50) / 100;
    if (ratio >= 2) return 1.5 + crypto.randomInt(50) / 100;
    if (ratio >= 1.5) return 1.2 + crypto.randomInt(30) / 100;
    if (ratio >= 1) return 1.1;

    return this.baseMultiplier;
  }

  /**
   * Get active surge zones
   */
  async getActiveSurgeZones(): Promise<SurgeZone[]> {
    // In production: query from database
    return [];
  }

  /**
   * Create surge zone
   */
  async createSurgeZone(
    location: GeoLocation,
    radius: number
  ): Promise<SurgeZone> {
    const zone: SurgeZone = {
      id: `surge-${Date.now()}`,
      location,
      radius,
      multiplier: 1.0,
      activeRiders: 0,
      pendingOrders: 0,
      startedAt: new Date(),
    };

    return zone;
  }
}

export const surgePricingService = new SurgePricingService();

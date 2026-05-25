/**
 * REZ Context Engine - Traffic Service
 * Provides traffic-based multipliers for delivery and ride timing
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TRAFFIC_API_KEY = process.env.TRAFFIC_API_KEY || '';
const TRAFFIC_API_URL = process.env.TRAFFIC_API_URL || '';

export interface TrafficData {
  city: string;
  area: string;
  level: TrafficLevel;
  congestion: number; // 0-1 (0 = free flow, 1 = gridlock)
  avgSpeed: number; // km/h
  incidents: TrafficIncident[];
  timestamp: Date;
}

export type TrafficLevel = 'free' | 'light' | 'moderate' | 'heavy' | 'severe';

export interface TrafficIncident {
  type: 'accident' | 'construction' | 'event' | 'weather' | 'roadwork';
  severity: 'low' | 'medium' | 'high';
  location: string;
  description: string;
}

export interface TrafficMultiplier {
  level: TrafficLevel;
  deliveryMultiplier: number;
  rideMultiplier: number;
  diningMultiplier: number;
  reason: string;
}

const TRAFFIC_MULTIPLIERS: Record<TrafficLevel, Omit<TrafficMultiplier, 'level'>> = {
  free: {
    deliveryMultiplier: 1.0,
    rideMultiplier: 1.0,
    diningMultiplier: 1.0,
    reason: 'Free-flowing traffic - normal delivery times'
  },
  light: {
    deliveryMultiplier: 1.0,
    rideMultiplier: 1.0,
    diningMultiplier: 1.1,
    reason: 'Light traffic - slightly faster deliveries'
  },
  moderate: {
    deliveryMultiplier: 1.15,
    rideMultiplier: 1.2,
    diningMultiplier: 1.2,
    reason: 'Moderate congestion - expect delays'
  },
  heavy: {
    deliveryMultiplier: 1.4,
    rideMultiplier: 1.5,
    diningMultiplier: 1.4,
    reason: 'Heavy traffic - significant delays expected'
  },
  severe: {
    deliveryMultiplier: 1.8,
    rideMultiplier: 2.0,
    diningMultiplier: 1.6,
    reason: 'Gridlock conditions - extreme delays'
  }
};

export interface TimeSlotMultiplier {
  slot: 'breakfast' | 'lunch' | 'evening' | 'dinner' | 'late_night' | 'normal';
  hourStart: number;
  hourEnd: number;
  deliveryMultiplier: number;
  rideMultiplier: number;
  diningMultiplier: number;
  description: string;
}

const TIME_SLOT_MULTIPLIERS: TimeSlotMultiplier[] = [
  {
    slot: 'breakfast',
    hourStart: 7,
    hourEnd: 10,
    deliveryMultiplier: 1.3,
    rideMultiplier: 1.1,
    diningMultiplier: 1.4,
    description: 'Morning rush - breakfast orders peak'
  },
  {
    slot: 'lunch',
    hourStart: 12,
    hourEnd: 14,
    deliveryMultiplier: 1.5,
    rideMultiplier: 1.3,
    diningMultiplier: 1.6,
    description: 'Lunch rush - peak order period'
  },
  {
    slot: 'evening',
    hourStart: 17,
    hourEnd: 19,
    deliveryMultiplier: 1.4,
    rideMultiplier: 1.6,
    diningMultiplier: 1.3,
    description: 'Evening commute - mixed demand'
  },
  {
    slot: 'dinner',
    hourStart: 19,
    hourEnd: 22,
    deliveryMultiplier: 1.6,
    rideMultiplier: 1.4,
    diningMultiplier: 1.8,
    description: 'Dinner rush - highest demand period'
  },
  {
    slot: 'late_night',
    hourStart: 22,
    hourEnd: 5,
    deliveryMultiplier: 1.2,
    rideMultiplier: 1.1,
    diningMultiplier: 1.0,
    description: 'Late night - reduced supply'
  },
  {
    slot: 'normal',
    hourStart: 10,
    hourEnd: 12,
    deliveryMultiplier: 1.0,
    rideMultiplier: 1.0,
    diningMultiplier: 1.0,
    description: 'Mid-morning lull'
  }
];

export class TrafficService {
  private redis: Redis;
  private cacheTTL = 300; // 5 minutes for traffic data

  constructor() {
    this.redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
    logger.info('Traffic service connected to Redis');
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Get current traffic data for a city/area
   */
  async getTraffic(city: string, area?: string): Promise<TrafficData> {
    const cacheKey = `traffic:${city.toLowerCase()}:${area?.toLowerCase() || 'default'}`;

    try {
      // Check cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as TrafficData;
      }

      // Fetch from API if configured
      if (TRAFFIC_API_KEY && TRAFFIC_API_URL) {
        const traffic = await this.fetchFromAPI(city, area);
        if (traffic) {
          await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(traffic));
          return traffic;
        }
      }

      // Return simulated data for development
      return this.getSimulatedTraffic(city, area);
    } catch (error) {
      logger.error('Traffic fetch error', { city, area, error });
      return this.getSimulatedTraffic(city, area);
    }
  }

  /**
   * Fetch traffic from external API
   */
  private async fetchFromAPI(city: string, area?: string): Promise<TrafficData | null> {
    try {
      const response = await fetch(
        `${TRAFFIC_API_URL}?city=${city}&area=${area || ''}`,
        {
          headers: {
            'Authorization': `Bearer ${TRAFFIC_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Traffic API error: ${response.status}`);
      }

      return await response.json() as TrafficData;
    } catch (error) {
      logger.error('Traffic API fetch failed', { error });
      return null;
    }
  }

  /**
   * Generate simulated traffic data
   */
  private getSimulatedTraffic(city: string, area?: string): TrafficData {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Determine traffic level based on time
    let level: TrafficLevel;
    let congestion: number;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend
      if (hour >= 10 && hour <= 14) {
        level = 'moderate';
        congestion = 0.5;
      } else if (hour >= 17 && hour <= 20) {
        level = 'light';
        congestion = 0.3;
      } else {
        level = 'free';
        congestion = 0.1;
      }
    } else {
      // Weekday
      if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
        level = 'heavy';
        congestion = 0.8;
      } else if (hour >= 12 && hour <= 14) {
        level = 'moderate';
        congestion = 0.5;
      } else if (hour >= 22 || hour <= 6) {
        level = 'free';
        congestion = 0.1;
      } else {
        level = 'light';
        congestion = 0.3;
      }
    }

    const avgSpeed = level === 'free' ? 40 : level === 'light' ? 30 : level === 'moderate' ? 20 : level === 'heavy' ? 12 : 5;

    return {
      city,
      area: area || 'General',
      level,
      congestion,
      avgSpeed,
      incidents: level === 'severe' || level === 'heavy' ? [
        {
          type: 'accident',
          severity: level === 'severe' ? 'high' : 'medium',
          location: 'Near main junction',
          description: 'Vehicle breakdown causing delays'
        }
      ] : [],
      timestamp: new Date()
    };
  }

  /**
   * Get multipliers based on traffic level
   */
  getMultipliers(traffic: TrafficData): TrafficMultiplier {
    return {
      level: traffic.level,
      ...TRAFFIC_MULTIPLIERS[traffic.level]
    };
  }

  /**
   * Get current time slot multiplier
   */
  getTimeSlotMultiplier(date?: Date): TimeSlotMultiplier {
    const d = date || new Date();
    const hour = d.getHours();

    for (const slot of TIME_SLOT_MULTIPLIERS) {
      if (slot.slot === 'normal') continue;
      if (hour >= slot.hourStart || hour < slot.hourEnd) {
        // Handle late night (spans midnight)
        if (slot.slot === 'late_night') {
          if (hour >= 22 || hour < 5) return slot;
        } else if (hour >= slot.hourStart && hour < slot.hourEnd) {
          return slot;
        }
      }
    }

    return TIME_SLOT_MULTIPLIERS.find((s) => s.slot === 'normal')!;
  }

  /**
   * Get combined multiplier for delivery/ride estimation
   */
  async getCombinedMultiplier(
    city: string,
    category: 'delivery' | 'ride' | 'dining',
    area?: string
  ): Promise<{
    multiplier: number;
    reason: string;
    traffic: TrafficData;
    timeSlot: TimeSlotMultiplier;
    baseMultiplier: number;
    timeMultiplier: number;
  }> {
    const traffic = await this.getTraffic(city, area);
    const timeSlot = this.getTimeSlotMultiplier();

    const trafficMultiplier = this.getMultipliers(traffic);
    const categoryKey = `${category}Multiplier` as keyof Omit<TrafficMultiplier, 'level' | 'reason'>;
    const baseMultiplier = trafficMultiplier[categoryKey] as number;
    const timeMultiplier = timeSlot[categoryKey] as number;

    const combined = baseMultiplier * timeMultiplier;

    const reasons: string[] = [];
    if (baseMultiplier > 1) reasons.push(trafficMultiplier.reason);
    if (timeMultiplier > 1) reasons.push(timeSlot.description);
    if (reasons.length === 0) reasons.push('Normal conditions');

    return {
      multiplier: Math.round(combined * 100) / 100,
      reason: reasons.join('. '),
      traffic,
      timeSlot,
      baseMultiplier,
      timeMultiplier
    };
  }

  /**
   * Estimate delivery time based on traffic
   */
  async estimateDeliveryTime(
    city: string,
    baseTimeMinutes: number,
    area?: string
  ): Promise<{
    estimatedMinutes: number;
    baseMinutes: number;
    trafficAdjustment: number;
    timeSlotAdjustment: number;
    traffic: TrafficData;
  }> {
    const combined = await this.getCombinedMultiplier(city, 'delivery', area);

    const trafficAdjustment = Math.round(baseTimeMinutes * (combined.baseMultiplier - 1));
    const timeSlotAdjustment = Math.round(baseTimeMinutes * (combined.timeMultiplier - 1));

    return {
      estimatedMinutes: Math.round(baseTimeMinutes * combined.multiplier),
      baseMinutes: baseTimeMinutes,
      trafficAdjustment,
      timeSlotAdjustment,
      traffic: combined.traffic
    };
  }

  /**
   * Get peak hours for a city
   */
  getPeakHours(): { breakfast: number[]; lunch: number[]; dinner: number[]; evening: number[] } {
    return {
      breakfast: [7, 8, 9, 10],
      lunch: [12, 13, 14],
      dinner: [19, 20, 21, 22],
      evening: [17, 18, 19]
    };
  }

  /**
   * Check if current time is peak hours
   */
  isPeakHour(): boolean {
    const slot = this.getTimeSlotMultiplier();
    return slot.slot !== 'normal' && slot.slot !== 'late_night';
  }
}

export const trafficService = new TrafficService();

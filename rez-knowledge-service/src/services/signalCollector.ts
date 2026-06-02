// REZ Knowledge Service - Signal Collection Service
// Collects signals from ALL apps in the ecosystem:
// - StayOwn (Hotel)
// - REZ Consumer App (all services)
// - Rendez (Couples)
// - Corpspark (Corporate)
// - Restaurant/Salon/Healthcare apps

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { profileService } from './profileService';
import {
  AppEcosystem,
  KnowledgeSignal,
  UnifiedUserPreferences,
} from '../types';

// ─── App Configuration ─────────────────────────────────────────────────────────
interface AppConfig {
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
}

const APP_CONFIGS: Record<AppEcosystem, AppConfig> = {
  stayown: {
    baseUrl: process.env.STAYOWN_SERVICE_URL || 'http://localhost:4001',
    apiKey: process.env.STAYOWN_API_KEY,
    enabled: true,
  },
  'rez-consumer': {
    baseUrl: process.env.REZ_CONSUMER_SERVICE_URL || 'http://localhost:4002',
    apiKey: process.env.REZ_CONSUMER_API_KEY,
    enabled: true,
  },
  rendez: {
    baseUrl: process.env.RENDEZ_SERVICE_URL || 'http://localhost:4003',
    apiKey: process.env.RENDEZ_API_KEY,
    enabled: true,
  },
  corpspark: {
    baseUrl: process.env.CORPSPARK_SERVICE_URL || 'http://localhost:4004',
    apiKey: process.env.CORPSPARK_API_KEY,
    enabled: true,
  },
  restaurant: {
    baseUrl: process.env.RESTAURANT_SERVICE_URL || 'http://localhost:4005',
    apiKey: process.env.RESTAURANT_API_KEY,
    enabled: true,
  },
  salon: {
    baseUrl: process.env.SALON_SERVICE_URL || 'http://localhost:4006',
    apiKey: process.env.SALON_API_KEY,
    enabled: true,
  },
  healthcare: {
    baseUrl: process.env.HEALTHCARE_SERVICE_URL || 'http://localhost:4007',
    apiKey: process.env.HEALTHCARE_API_KEY,
    enabled: true,
  },
};

// ─── Signal Transformers ────────────────────────────────────────────────────────
// Transform signals from each app into the unified format

interface RawSignal {
  id?: string;
  userId?: string;
  type: string;
  action: string;
  data?: Record<string, unknown>;
  timestamp?: string | Date;
  source?: string;
  metadata?: Record<string, unknown>;
}

// Transform StayOwn (Hotel) signals
function transformHotelSignal(raw: RawSignal): Omit<KnowledgeSignal, 'id'> {
  return {
    userId: raw.userId || '',
    type: raw.type || 'hotel.unknown',
    action: raw.action || 'unknown',
    data: {
      ...raw.data,
      _originalSource: 'stayown',
      _originalId: raw.id,
    },
    timestamp: new Date(raw.timestamp || Date.now()),
    source: 'stayown',
    enrichedData: {
      category: ['hotel', 'travel', 'accommodation'],
      tags: extractTags(raw.data),
    },
  };
}

// Transform REZ Consumer App signals
function transformConsumerSignal(raw: RawSignal): Omit<KnowledgeSignal, 'id'> {
  return {
    userId: raw.userId || '',
    type: raw.type || 'consumer.unknown',
    action: raw.action || 'unknown',
    data: {
      ...raw.data,
      _originalSource: 'rez-consumer',
      _originalId: raw.id,
    },
    timestamp: new Date(raw.timestamp || Date.now()),
    source: 'rez-consumer',
    enrichedData: {
      category: extractCategories(raw.data),
      tags: extractTags(raw.data),
    },
  };
}

// Transform Rendez (Couples) signals
function transformRendezSignal(raw: RawSignal): Omit<KnowledgeSignal, 'id'> {
  return {
    userId: raw.userId || '',
    type: raw.type || 'rendez.unknown',
    action: raw.action || 'unknown',
    data: {
      ...raw.data,
      _originalSource: 'rendez',
      _originalId: raw.id,
    },
    timestamp: new Date(raw.timestamp || Date.now()),
    source: 'rendez',
    enrichedData: {
      category: ['dating', 'couples', 'lifestyle', 'entertainment'],
      tags: extractTags(raw.data),
    },
  };
}

// Transform Corpspark (Corporate) signals
function transformCorporateSignal(raw: RawSignal): Omit<KnowledgeSignal, 'id'> {
  return {
    userId: raw.userId || '',
    type: raw.type || 'corporate.unknown',
    action: raw.action || 'unknown',
    data: {
      ...raw.data,
      _originalSource: 'corpspark',
      _originalId: raw.id,
    },
    timestamp: new Date(raw.timestamp || Date.now()),
    source: 'corpspark',
    enrichedData: {
      category: ['corporate', 'business', 'travel', 'expenses'],
      tags: extractTags(raw.data),
    },
  };
}

// Transform Restaurant signals
function transformRestaurantSignal(raw: RawSignal): Omit<KnowledgeSignal, 'id'> {
  return {
    userId: raw.userId || '',
    type: raw.type || 'restaurant.unknown',
    action: raw.action || 'unknown',
    data: {
      ...raw.data,
      _originalSource: 'restaurant',
      _originalId: raw.id,
    },
    timestamp: new Date(raw.timestamp || Date.now()),
    source: 'restaurant',
    enrichedData: {
      category: ['food', 'dining', 'restaurant', 'delivery'],
      tags: extractTags(raw.data),
    },
  };
}

// Transform Salon signals
function transformSalonSignal(raw: RawSignal): Omit<KnowledgeSignal, 'id'> {
  return {
    userId: raw.userId || '',
    type: raw.type || 'salon.unknown',
    action: raw.action || 'unknown',
    data: {
      ...raw.data,
      _originalSource: 'salon',
      _originalId: raw.id,
    },
    timestamp: new Date(raw.timestamp || Date.now()),
    source: 'salon',
    enrichedData: {
      category: ['beauty', 'salon', 'personal-care', 'wellness'],
      tags: extractTags(raw.data),
    },
  };
}

// Transform Healthcare signals
function transformHealthcareSignal(raw: RawSignal): Omit<KnowledgeSignal, 'id'> {
  return {
    userId: raw.userId || '',
    type: raw.type || 'healthcare.unknown',
    action: raw.action || 'unknown',
    data: {
      ...raw.data,
      _originalSource: 'healthcare',
      _originalId: raw.id,
    },
    timestamp: new Date(raw.timestamp || Date.now()),
    source: 'healthcare',
    enrichedData: {
      category: ['healthcare', 'medical', 'wellness', 'appointments'],
      tags: extractTags(raw.data),
    },
  };
}

// Helper to extract tags from data
function extractTags(data?: Record<string, unknown>): string[] {
  if (!data) return [];
  const tags: string[] = [];
  if (data.cuisine) tags.push(String(data.cuisine));
  if (data.category) tags.push(String(data.category));
  if (data.type) tags.push(String(data.type));
  if (data.service) tags.push(String(data.service));
  return [...new Set(tags)];
}

// Helper to extract categories from data
function extractCategories(data?: Record<string, unknown>): string[] {
  if (!data) return [];
  const categories: string[] = [];
  if (data.category) categories.push(String(data.category));
  if (data.type) categories.push(String(data.type));
  if (data.service) categories.push(String(data.service));
  return [...new Set(categories)];
}

// Signal transformer map
const SIGNAL_TRANSFORMERS: Record<AppEcosystem, (raw: RawSignal) => Omit<KnowledgeSignal, 'id'>> = {
  stayown: transformHotelSignal,
  'rez-consumer': transformConsumerSignal,
  rendez: transformRendezSignal,
  corpspark: transformCorporateSignal,
  restaurant: transformRestaurantSignal,
  salon: transformSalonSignal,
  healthcare: transformHealthcareSignal,
};

// ─── Signal Collector Class ──────────────────────────────────────────────────────
export class SignalCollector {
  /**
   * Collect signals from a specific app
   */
  async collectFromApp(
    app: AppEcosystem,
    userId: string,
    since?: Date
  ): Promise<KnowledgeSignal[]> {
    const config = APP_CONFIGS[app];
    if (!config || !config.enabled) {
      console.log(`App ${app} is disabled or not configured`);
      return [];
    }

    try {
      const params: Record<string, string> = { userId };
      if (since) {
        params.since = since.toISOString();
      }

      const response = await axios.get(`${config.baseUrl}/signals`, {
        params,
        headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
        timeout: 10000,
      });

      const rawSignals: RawSignal[] = response.data.data || response.data.signals || [];
      const transformer = SIGNAL_TRANSFORMERS[app];

      const signals: KnowledgeSignal[] = rawSignals.map((raw) => {
        const transformed = transformer({ ...raw, userId });
        return {
          ...transformed,
          id: raw.id || uuidv4(),
        };
      });

      console.log(`Collected ${signals.length} signals from ${app} for user ${userId}`);
      return signals;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Failed to collect signals from ${app}:`, error.message);
      } else {
        console.error(`Failed to collect signals from ${app}:`, error);
      }
      return [];
    }
  }

  /**
   * Collect signals from ALL apps for a user
   */
  async collectFromAllApps(
    userId: string,
    since?: Date
  ): Promise<Map<AppEcosystem, KnowledgeSignal[]>> {
    const results = new Map<AppEcosystem, KnowledgeSignal[]>();
    const apps = Object.keys(APP_CONFIGS) as AppEcosystem[];

    // Collect from all apps in parallel
    const promises = apps.map(async (app) => {
      const signals = await this.collectFromApp(app, userId, since);
      return { app, signals };
    });

    const settled = await Promise.allSettled(promises);

    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.set(result.value.app, result.value.signals);
      }
    });

    return results;
  }

  /**
   * Sync signals from all apps to unified profile
   */
  async syncSignalsToProfile(userId: string, since?: Date): Promise<{
    totalCollected: number;
    totalStored: number;
    byApp: Record<string, number>;
  }> {
    const collected = await this.collectFromAllApps(userId, since);
    const byApp: Record<string, number> = {};
    let totalStored = 0;

    for (const [app, signals] of collected.entries()) {
      byApp[app] = 0;
      for (const signal of signals) {
        try {
          await profileService.addSignal(userId, signal);
          byApp[app]++;
          totalStored++;
        } catch (error) {
          console.error(`Failed to store signal:`, error);
        }
      }
    }

    const totalCollected = Array.from(collected.values()).reduce(
      (sum, signals) => sum + signals.length,
      0
    );

    return { totalCollected, totalStored, byApp };
  }

  /**
   * Receive and store a signal from an app (webhook endpoint)
   */
  async receiveSignal(
    app: AppEcosystem,
    signal: RawSignal
  ): Promise<KnowledgeSignal | null> {
    try {
      const transformer = SIGNAL_TRANSFORMERS[app];
      const transformed = transformer(signal);

      const fullSignal: KnowledgeSignal = {
        ...transformed,
        id: signal.id || uuidv4(),
        processedAt: new Date(),
      };

      // Store the signal
      if (transformed.userId) {
        await profileService.addSignal(transformed.userId, fullSignal);
      }

      return fullSignal;
    } catch (error) {
      console.error(`Failed to receive signal from ${app}:`, error);
      return null;
    }
  }

  /**
   * Get app status
   */
  async getAppStatus(): Promise<
    Record<
      AppEcosystem,
      {
        enabled: boolean;
        configured: boolean;
        baseUrl: string;
        status: 'healthy' | 'unhealthy' | 'disabled';
      }
    >
  > {
    const status: Record<
      AppEcosystem,
      {
        enabled: boolean;
        configured: boolean;
        baseUrl: string;
        status: 'healthy' | 'unhealthy' | 'disabled';
      }
    > = {} as any;

    for (const [app, config] of Object.entries(APP_CONFIGS)) {
      let appStatus: 'healthy' | 'unhealthy' | 'disabled' = 'disabled';

      if (config.enabled) {
        try {
          await axios.get(`${config.baseUrl}/health`, { timeout: 5000 });
          appStatus = 'healthy';
        } catch {
          appStatus = 'unhealthy';
        }
      }

      status[app as AppEcosystem] = {
        enabled: config.enabled,
        configured: !!config.baseUrl,
        baseUrl: config.baseUrl,
        status: appStatus,
      };
    }

    return status;
  }

  /**
   * Collect preferences from an app
   */
  async collectPreferencesFromApp(
    app: AppEcosystem,
    userId: string
  ): Promise<Partial<UnifiedUserPreferences>> {
    const config = APP_CONFIGS[app];
    if (!config || !config.enabled) {
      return {};
    }

    try {
      const response = await axios.get(`${config.baseUrl}/preferences`, {
        params: { userId },
        headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
        timeout: 10000,
      });

      const prefs = response.data.data || response.data.preferences || {};

      // Map to unified format
      return this.mapPreferencesToUnified(app, prefs);
    } catch (error) {
      console.error(`Failed to collect preferences from ${app}:`, error);
      return {};
    }
  }

  /**
   * Map app-specific preferences to unified format
   */
  private mapPreferencesToUnified(
    app: AppEcosystem,
    prefs: Record<string, unknown>
  ): Partial<UnifiedUserPreferences> {
    switch (app) {
      case 'stayown':
        return {
          hotel: {
            preferredRoomTypes: (prefs.roomTypes as string[]) || [],
            bedPreference: (prefs.bedType as any) || 'any',
            smokingPreference: Boolean(prefs.smoking),
            earlyCheckin: Boolean(prefs.earlyCheckin),
            lateCheckout: Boolean(prefs.lateCheckout),
            frequentDestinations: (prefs.destinations as string[]) || [],
            preferredStarRating: Number(prefs.starRating) || 3,
            budgetRange: {
              min: Number(prefs.budgetMin) || 0,
              max: Number(prefs.budgetMax) || 10000,
            },
            // Default values for required fields
            floorPreference: 'any',
            requiredAmenities: [],
            preferredBrands: [],
            paymentMethodPreference: 'paylater',
            tripPurpose: [],
            avgStayDuration: 1,
            bookingLeadTime: 7,
          },
        };

      case 'restaurant':
        return {
          restaurant: {
            preferredCuisines: (prefs.cuisines as string[]) || [],
            dietaryRestrictions: ((prefs.dietary as string[]) || []).map(d => d as 'vegetarian' | 'vegan' | 'gluten-free' | 'halal' | 'kosher' | 'nut-allergy'),
            spicePreference: (prefs.spiceLevel as any) || 'medium',
            preferredDiningTime: {
              start: String(prefs.diningStart || '12:00'),
              end: String(prefs.diningEnd || '22:00'),
            },
            deliveryVsDineIn: (prefs.diningMode as any) || 'mixed',
            avgOrderValue: Number(prefs.avgOrderValue) || 500,
            // Default values
            partySizePreference: 2,
            seatingPreference: 'any',
            orderingFrequency: 'occasional',
            favoriteRestaurants: [],
            favoriteDishes: [],
            tipPreference: 10,
            paymentMethodPreference: [],
          },
        };

      case 'salon':
        return {
          salon: {
            preferredServices: (prefs.services as string[]) || [],
            hairType: (prefs.hairType as any) || 'straight',
            preferredGenderSalon: (prefs.genderSalon as any) || 'unisex',
            avgSpendingPerVisit: Number(prefs.avgSpending) || 500,
            maxDistance: Number(prefs.maxDistance) || 10,
            // Default values
            preferredStylists: [],
            specificStylistRequired: false,
            preferredTimeSlots: [],
            reminderPreference: true,
            bufferTime: 15,
          },
        };

      case 'healthcare':
        return {
          healthcare: {
            allergies: (prefs.allergies as string[]) || [],
            chronicConditions: (prefs.chronicConditions as string[]) || [],
            medications: (prefs.medications as string[]) || [],
            bloodType: String(prefs.bloodType) || undefined,
            appointmentTimePreference: (prefs.appointmentTime as any) || 'any',
            telehealthPreference: Boolean(prefs.telehealth),
            preferredLanguage: String(prefs.language || 'en'),
            insuranceProvider: String(prefs.insuranceProvider) || undefined,
            // Default values
            preferredDoctors: [],
            preferredClinics: [],
            preferredHospitalNetworks: [],
            emergencyContact: { name: '', phone: '', relationship: '' },
          },
        };

      case 'rendez':
        return {
          lifestyle: {
            interests: (prefs.interests as string[]) || [],
            hobbies: (prefs.hobbies as string[]) || [],
            diet: String(prefs.diet || 'no-preference'),
            exerciseFrequency: (prefs.exercise as any) || 'weekly',
            // Default values
            interestedIn: ['all'],
            relationshipType: ['any'],
            ageRangePreference: { min: 18, max: 50 },
            distancePreference: 25,
            preferredDateActivities: [],
            preferredLocations: [],
            indoorVsOutdoor: 'balanced',
            smokingPreference: 'non-smoker',
            drinkingPreference: 'socially',
            dateBudgetRange: { min: 500, max: 5000 },
          },
        };

      case 'corpspark':
        return {
          corporate: {
            companyId: String(prefs.companyId) || undefined,
            employeeId: String(prefs.employeeId) || undefined,
            department: String(prefs.department) || undefined,
            travelClassPreference: (prefs.travelClass as any) || 'economy',
            hotelBudgetPerNight: Number(prefs.hotelBudget) || 3000,
            mealAllowance: Number(prefs.mealAllowance) || 500,
            advanceBookingRequired: Boolean(prefs.advanceBooking),
            requiresReceipts: Boolean(prefs.requiresReceipts ?? true),
            // Default values
            preferredHotels: [],
            preferredAirlines: [],
            preferredCarServices: [],
            preferredPaymentMethod: 'company-card',
          },
        };

      default:
        return {};
    }
  }

  /**
   * Sync preferences from all apps to unified profile
   */
  async syncPreferencesToProfile(userId: string): Promise<void> {
    const apps = Object.keys(APP_CONFIGS) as AppEcosystem[];

    for (const app of apps) {
      try {
        const prefs = await this.collectPreferencesFromApp(app, userId);
        if (Object.keys(prefs).length > 0) {
          await profileService.updatePreferences(userId, app, prefs[app] as any);
          console.log(`Synced preferences from ${app} for user ${userId}`);
        }
      } catch (error) {
        console.error(`Failed to sync preferences from ${app}:`, error);
      }
    }
  }
}

export const signalCollector = new SignalCollector();
export default signalCollector;

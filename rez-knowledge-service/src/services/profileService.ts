// REZ Knowledge Service - Unified Profile Service
// Handles user profile operations across ALL apps

import { UnifiedUserProfile, IUnifiedUserProfile } from '../models';
import { v4 as uuidv4 } from 'uuid';
import {
  AppEcosystem,
  UnifiedUserPreferences,
  KnowledgeSignal,
  HotelPreferences,
  RestaurantPreferences,
  SalonPreferences,
  HealthcarePreferences,
  LifestylePreferences,
  CorporatePreferences,
} from '../types';

// Default preferences factory
const createDefaultPreferences = (): UnifiedUserPreferences => {
  const hotelPrefs: HotelPreferences = {
    preferredRoomTypes: [],
    bedPreference: 'any',
    floorPreference: 'any',
    smokingPreference: false,
    requiredAmenities: [],
    preferredBrands: [],
    earlyCheckin: false,
    lateCheckout: false,
    paymentMethodPreference: 'paylater',
    frequentDestinations: [],
    tripPurpose: [],
    preferredStarRating: 3,
    budgetRange: { min: 0, max: 10000 },
    avgStayDuration: 1,
    bookingLeadTime: 7,
  };
  const restaurantPrefs: RestaurantPreferences = {
    preferredCuisines: [],
    dietaryRestrictions: [],
    spicePreference: 'medium',
    preferredDiningTime: { start: '12:00', end: '22:00' },
    partySizePreference: 2,
    seatingPreference: 'any',
    deliveryVsDineIn: 'mixed',
    avgOrderValue: 500,
    orderingFrequency: 'occasional',
    favoriteRestaurants: [],
    favoriteDishes: [],
    tipPreference: 10,
    paymentMethodPreference: [],
  };
  const salonPrefs: SalonPreferences = {
    preferredServices: [],
    preferredGenderSalon: 'unisex',
    hairType: 'straight',
    preferredStylists: [],
    specificStylistRequired: false,
    preferredTimeSlots: [],
    reminderPreference: true,
    bufferTime: 15,
    avgSpendingPerVisit: 500,
    maxDistance: 10,
  };
  const healthcarePrefs: HealthcarePreferences = {
    bloodType: undefined,
    allergies: [],
    chronicConditions: [],
    medications: [],
    preferredDoctors: [],
    preferredClinics: [],
    preferredHospitalNetworks: [],
    appointmentTimePreference: 'any',
    telehealthPreference: false,
    preferredLanguage: 'en',
    insuranceProvider: undefined,
    insurancePolicyNumber: undefined,
    emergencyContact: { name: '', phone: '', relationship: '' },
  };
  const lifestylePrefs: LifestylePreferences = {
    interestedIn: ['all'],
    relationshipType: ['any'],
    ageRangePreference: { min: 18, max: 50 },
    distancePreference: 25,
    preferredDateActivities: [],
    preferredLocations: [],
    indoorVsOutdoor: 'balanced',
    interests: [],
    hobbies: [],
    diet: 'no-preference',
    exerciseFrequency: 'weekly',
    smokingPreference: 'non-smoker',
    drinkingPreference: 'socially',
    dateBudgetRange: { min: 500, max: 5000 },
  };
  const corporatePrefs: CorporatePreferences = {
    companyId: undefined,
    employeeId: undefined,
    department: undefined,
    travelClassPreference: 'economy',
    hotelBudgetPerNight: 3000,
    mealAllowance: 500,
    advanceBookingRequired: true,
    preferredHotels: [],
    preferredAirlines: [],
    preferredCarServices: [],
    autoApproveUnder: undefined,
    requiresReceipts: true,
    defaultCostCenter: undefined,
    preferredPaymentMethod: 'company-card',
  };
  return {
    hotel: hotelPrefs,
    restaurant: restaurantPrefs,
    salon: salonPrefs,
    healthcare: healthcarePrefs,
    lifestyle: lifestylePrefs,
    corporate: corporatePrefs,
    // App ecosystem aliases
    stayown: hotelPrefs,
    'rez-consumer': restaurantPrefs,
    rendez: lifestylePrefs,
    corpspark: corporatePrefs,
  };
};

export class ProfileService {
  /**
   * Get unified profile by user ID
   */
  async getByUserId(userId: string): Promise<IUnifiedUserProfile | null> {
    try {
      return await UnifiedUserProfile.findOne({ userId });
    } catch (error) {
      console.error('Error fetching profile:', { userId, error });
      throw error;
    }
  }

  /**
   * Get unified profile by any linked account
   */
  async getByLinkedAccount(
    appSource: AppEcosystem,
    externalUserId: string
  ): Promise<IUnifiedUserProfile | null> {
    try {
      return await UnifiedUserProfile.findByLinkedAccount(appSource, externalUserId);
    } catch (error) {
      console.error('Error fetching profile by linked account:', { appSource, externalUserId, error });
      throw error;
    }
  }

  /**
   * Create a new unified profile
   */
  async create(data: {
    userId: string;
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    dateOfBirth?: string;
    gender?: string;
  }): Promise<IUnifiedUserProfile> {
    try {
      const profile = await UnifiedUserProfile.create({
        userId: data.userId,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        avatar: data.avatar,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender as 'male' | 'female' | 'non-binary' | 'prefer-not-to-say',
        preferences: createDefaultPreferences(),
        history: {
          hotelBookings: 0,
          restaurantOrders: 0,
          salonBookings: 0,
          healthcareAppointments: 0,
          rendezDates: 0,
          corporateBookings: 0,
          totalSpent: 0,
          avgOrderValue: 0,
          totalSavings: 0,
          avgRating: 0,
          totalReviews: 0,
          lastActiveDate: new Date(),
          loyaltyTier: 'bronze',
          loyaltyPoints: 0,
          lifetimeValue: 0,
          joinedDate: new Date(),
          accountAge: 0,
        },
        signals: [],
        personalization: {
          inferredInterests: [],
          inferredDemographics: {},
          recommendationsVersion: '1.0',
          lastPersonalizedAt: new Date(),
        },
        linkedAccounts: [],
        lastSignalAt: new Date(),
        version: 1,
      });

      console.log('Unified profile created', { userId: data.userId });
      return profile;
    } catch (error) {
      console.error('Error creating profile:', { userId: data.userId, error });
      throw error;
    }
  }

  /**
   * Find or create unified profile
   */
  async findOrCreate(userId: string): Promise<IUnifiedUserProfile> {
    try {
      return await UnifiedUserProfile.findOrCreate(userId);
    } catch (error) {
      console.error('Error in findOrCreate:', { userId, error });
      throw error;
    }
  }

  /**
   * Update basic profile info
   */
  async updateProfile(
    userId: string,
    profileData: {
      name?: string;
      email?: string;
      phone?: string;
      avatar?: string;
      dateOfBirth?: string;
      gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
    }
  ): Promise<IUnifiedUserProfile | null> {
    try {
      const profile = await UnifiedUserProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            ...profileData,
            'history.lastActiveDate': new Date(),
          },
        },
        { new: true }
      );

      if (profile) {
        console.log('Profile updated', { userId });
      }

      return profile;
    } catch (error) {
      console.error('Error updating profile:', { userId, error });
      throw error;
    }
  }

  /**
   * Update preferences for a specific app
   */
  async updatePreferences(
    userId: string,
    app: string,
    preferences: Record<string, unknown>
  ): Promise<IUnifiedUserProfile | null> {
    try {
      const profile = await UnifiedUserProfile.findOne({ userId });
      if (!profile) {
        // Create profile if it doesn't exist
        const newProfile = await this.create({ userId });
        (newProfile as any).updateAppPreferences(app, preferences);
        await newProfile.save();
        return newProfile;
      }

      (profile as any).updateAppPreferences(app, preferences);
      profile.history.lastActiveDate = new Date();
      await profile.save();

      console.log('Preferences updated', { userId, app });
      return profile;
    } catch (error) {
      console.error('Error updating preferences:', { userId, app, error });
      throw error;
    }
  }

  /**
   * Add a signal from any app
   */
  async addSignal(
    userId: string,
    signal: Omit<KnowledgeSignal, 'id' | 'processedAt'>
  ): Promise<{ profile: IUnifiedUserProfile | null; signalId: string }> {
    try {
      let profile = await UnifiedUserProfile.findOne({ userId });

      if (!profile) {
        profile = await this.create({ userId });
      }

      const signalId = uuidv4();
      const fullSignal: KnowledgeSignal = {
        ...signal,
        id: signalId,
        timestamp: signal.timestamp || new Date(),
        processedAt: new Date(),
      };

      // Update history from signal
      profile.updateHistoryFromSignal(fullSignal);

      // Add signal to profile
      profile.signals.push(fullSignal);
      profile.version += 1;

      await profile.save();

      console.log('Signal added', {
        userId,
        signalId,
        type: signal.type,
        source: signal.source,
      });

      return { profile, signalId };
    } catch (error) {
      console.error('Error adding signal:', { userId, error });
      throw error;
    }
  }

  /**
   * Get signals filtered by criteria
   */
  async getSignals(
    userId: string,
    options?: {
      app?: AppEcosystem;
      type?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<KnowledgeSignal[]> {
    try {
      const profile = await UnifiedUserProfile.findOne({ userId });
      if (!profile) return [];

      let signals = [...profile.signals];

      if (options?.app) {
        signals = signals.filter((s) => s.source === options.app);
      }

      if (options?.type) {
        signals = signals.filter((s) => s.type.includes(options.type!));
      }

      if (options?.startDate) {
        signals = signals.filter((s) => s.timestamp >= options.startDate!);
      }

      if (options?.endDate) {
        signals = signals.filter((s) => s.timestamp <= options.endDate!);
      }

      // Sort by timestamp descending
      signals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (options?.limit) {
        signals = signals.slice(0, options.limit);
      }

      return signals;
    } catch (error) {
      console.error('Error getting signals:', { userId, error });
      throw error;
    }
  }

  /**
   * Link another app's account to this unified profile
   */
  async linkAccount(
    userId: string,
    appSource: AppEcosystem,
    externalUserId: string
  ): Promise<IUnifiedUserProfile | null> {
    try {
      // Check if this external user already has a profile
      const existingProfile = await UnifiedUserProfile.findByLinkedAccount(
        appSource,
        externalUserId
      );

      if (existingProfile && existingProfile.userId !== userId) {
        // Merge profiles - move signals and preferences to current profile
        const currentProfile = await UnifiedUserProfile.findOne({ userId });
        if (currentProfile) {
          // Move signals from existing to current
          currentProfile.signals.push(...existingProfile.signals);
          // Move linked accounts
          currentProfile.linkedAccounts.push(
            ...existingProfile.linkedAccounts.filter(
              (a) => a.appSource !== appSource
            )
          );
          // Update history
          currentProfile.history.totalSpent += existingProfile.history.totalSpent;
          currentProfile.history.hotelBookings += existingProfile.history.hotelBookings;
          currentProfile.history.restaurantOrders += existingProfile.history.restaurantOrders;
          currentProfile.history.salonBookings += existingProfile.history.salonBookings;
          currentProfile.history.healthcareAppointments += existingProfile.history.healthcareAppointments;
          currentProfile.history.rendezDates += existingProfile.history.rendezDates;
          currentProfile.history.corporateBookings += existingProfile.history.corporateBookings;
          // Merge preferences (current takes precedence)
          // Delete old profile
          await existingProfile.deleteOne();
          // Link account
          currentProfile.linkAccount(appSource, externalUserId);
          await currentProfile.save();
          return currentProfile;
        }
      }

      const profile = await UnifiedUserProfile.findOne({ userId });
      if (profile) {
        profile.linkAccount(appSource, externalUserId);
        await profile.save();
        console.log('Account linked', { userId, appSource, externalUserId });
        return profile;
      }

      return null;
    } catch (error) {
      console.error('Error linking account:', { userId, appSource, externalUserId, error });
      throw error;
    }
  }

  /**
   * Get personalization data for user
   */
  async getPersonalization(
    userId: string
  ): Promise<{
    recommendations: {
      hotels?: string[];
      restaurants?: string[];
      salonServices?: string[];
      dates?: string[];
      corporate?: string[];
    };
    insights: {
      spendingPattern?: string;
      preferredTime?: string;
      loyaltyBenefits?: string[];
      nextBestAction?: string;
    };
  } | null> {
    try {
      const profile = await UnifiedUserProfile.findOne({ userId });
      if (!profile) return null;

      // Generate recommendations based on preferences and history
      const recommendations: {
        hotels?: string[];
        restaurants?: string[];
        salonServices?: string[];
        dates?: string[];
        corporate?: string[];
      } = {};

      // Hotel recommendations based on frequent destinations
      if (profile.preferences.hotel.frequentDestinations.length > 0) {
        recommendations.hotels = profile.preferences.hotel.frequentDestinations.slice(0, 5);
      }

      // Restaurant recommendations based on preferred cuisines
      if (profile.preferences.restaurant.preferredCuisines.length > 0) {
        recommendations.restaurants = profile.preferences.restaurant.preferredCuisines.slice(0, 5);
      }

      // Salon recommendations based on preferred services
      if (profile.preferences.salon.preferredServices.length > 0) {
        recommendations.salonServices = profile.preferences.salon.preferredServices.slice(0, 5);
      }

      // Date recommendations based on interests
      if (profile.preferences.lifestyle.interests.length > 0) {
        recommendations.dates = profile.preferences.lifestyle.interests.slice(0, 5);
      }

      // Generate insights
      const insights: {
        spendingPattern?: string;
        preferredTime?: string;
        loyaltyBenefits?: string[];
        nextBestAction?: string;
      } = {};

      // Spending pattern
      if (profile.history.avgOrderValue > 2000) {
        insights.spendingPattern = 'high-spender';
      } else if (profile.history.avgOrderValue > 1000) {
        insights.spendingPattern = 'moderate-spender';
      } else {
        insights.spendingPattern = 'budget-conscious';
      }

      // Preferred time based on restaurant preferences
      insights.preferredTime = `${profile.preferences.restaurant.preferredDiningTime.start}-${profile.preferences.restaurant.preferredDiningTime.end}`;

      // Loyalty benefits based on tier
      const tierBenefits: Record<string, string[]> = {
        bronze: ['5% off on all orders', 'Free delivery on orders above 500'],
        silver: ['10% off on all orders', 'Free delivery', 'Priority support'],
        gold: ['15% off on all orders', 'Free delivery', 'Priority support', 'Early access to sales'],
        platinum: ['20% off on all orders', 'Free delivery', 'Priority support', 'Early access to sales', 'Exclusive events'],
        diamond: ['25% off on all orders', 'Free delivery', 'Priority support', 'Early access to sales', 'Exclusive events', 'Personal concierge'],
      };
      insights.loyaltyBenefits = tierBenefits[profile.history.loyaltyTier] || tierBenefits.bronze;

      // Next best action based on signals
      const lastSignal = profile.signals[profile.signals.length - 1];
      if (lastSignal) {
        if (lastSignal.type.includes('hotel')) {
          insights.nextBestAction = 'Book a hotel room';
        } else if (lastSignal.type.includes('restaurant')) {
          insights.nextBestAction = 'Order food from your favorite restaurant';
        } else if (lastSignal.type.includes('rendez')) {
          insights.nextBestAction = 'Plan a date with your partner';
        } else {
          insights.nextBestAction = 'Explore new experiences';
        }
      }

      return { recommendations, insights };
    } catch (error) {
      console.error('Error getting personalization:', { userId, error });
      throw error;
    }
  }

  /**
   * Search profiles
   */
  async searchProfiles(query: {
    email?: string;
    phone?: string;
    name?: string;
    loyaltyTier?: string;
  }): Promise<IUnifiedUserProfile[]> {
    try {
      const filter: Record<string, unknown> = {};

      if (query.email) {
        filter.email = { $regex: query.email, $options: 'i' };
      }
      if (query.phone) {
        filter.phone = query.phone;
      }
      if (query.name) {
        filter.name = { $regex: query.name, $options: 'i' };
      }
      if (query.loyaltyTier) {
        filter['history.loyaltyTier'] = query.loyaltyTier;
      }

      return await UnifiedUserProfile.find(filter).limit(50);
    } catch (error) {
      console.error('Error searching profiles:', { query, error });
      throw error;
    }
  }

  /**
   * Get high-value users
   */
  async getHighValueUsers(minLtv = 50000): Promise<IUnifiedUserProfile[]> {
    try {
      return await UnifiedUserProfile.findHighValueUsers(minLtv);
    } catch (error) {
      console.error('Error getting high-value users:', { error });
      throw error;
    }
  }

  /**
   * Delete profile (soft delete)
   */
  async deleteProfile(userId: string): Promise<boolean> {
    try {
      const result = await UnifiedUserProfile.deleteOne({ userId });
      console.log('Profile deleted', { userId, deleted: result.deletedCount > 0 });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting profile:', { userId, error });
      throw error;
    }
  }
}

export const profileService = new ProfileService();
export default profileService;

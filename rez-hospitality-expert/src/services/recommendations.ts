/**
 * Recommendations Service
 * Personalized recommendations for rooms, amenities, dining, and local attractions
 */

import {
  RoomType,
  RoomRecommendation,
  AmenityInfo,
  LocalRecommendation,
  AmenityCategory,
  ConversationContext,
  Guest,
  Reservation,
} from '../types/index.js';
import {
  ROOM_TYPES,
  AMENITIES,
  getRoomTypeInfo,
  getAmenitiesByCategory,
} from '../config/knowledge.js';

// ============================================
// GUEST PREFERENCES
// ============================================

export interface GuestPreferences {
  dietaryRestrictions?: string[];
  favoriteAmenities?: string[];
  preferredRoomFeatures?: string[];
  preferredView?: 'ocean' | 'city' | 'garden' | 'pool';
  travelPurpose?: 'business' | 'leisure' | 'romance' | 'family';
  budget?: 'standard' | 'moderate' | 'luxury';
  interests?: string[];
}

export interface RecommendationContext {
  guest?: Guest;
  reservation?: Reservation;
  preferences?: GuestPreferences;
  stayDuration?: number;
  specialOccasion?: string;
  season?: string;
  weather?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  currentIntent?: string;
}

// ============================================
// RECOMMENDATIONS SERVICE
// ============================================

export class RecommendationsService {
  /**
   * Generate room upgrade recommendations
   */
  generateRoomRecommendations(context: RecommendationContext): RoomRecommendation[] {
    const recommendations: RoomRecommendation[] = [];
    const currentRoom = context.reservation?.roomType || RoomType.STANDARD;
    const currentInfo = getRoomTypeInfo(currentRoom);

    // Room hierarchy for upgrades
    const roomHierarchy: RoomType[] = [
      RoomType.STANDARD,
      RoomType.POOL_VIEW,
      RoomType.OCEAN_VIEW,
      RoomType.EXECUTIVE,
      RoomType.ACCESSIBLE,
      RoomType.DELUXE,
      RoomType.FAMILY,
      RoomType.JUNIOR_SUITE,
      RoomType.SUITE,
      RoomType.PRESIDENTIAL_SUITE,
    ];

    const currentIndex = roomHierarchy.indexOf(currentRoom);
    const stayDuration = context.stayDuration || 1;

    // Generate next 2-3 tier upgrades
    const upgradeCount = context.preferences?.budget === 'luxury' ? 3 : 2;

    for (let i = currentIndex + 1; i < Math.min(currentIndex + upgradeCount + 1, roomHierarchy.length); i++) {
      const targetRoom = roomHierarchy[i];
      const targetInfo = getRoomTypeInfo(targetRoom);

      if (!targetInfo) continue;

      // Calculate upgrade cost
      const priceDiff = targetInfo.priceRange.low - (currentInfo?.priceRange.low || 0);
      const totalCost = priceDiff * stayDuration;

      // Calculate benefits compared to current room
      const newBenefits = targetInfo.features.filter(
        feature => !currentInfo?.features.some(currentFeature =>
          currentFeature.includes(feature.split(' ')[0]) || feature.includes(currentFeature.split(' ')[0])
        )
      ).slice(0, 5);

      // Add contextual benefits based on guest profile
      const contextualBenefits = this.getContextualBenefits(targetRoom, context);

      recommendations.push({
        roomType: targetRoom,
        description: targetInfo.description,
        priceDifference: priceDiff,
        benefits: [...newBenefits, ...contextualBenefits],
        images: [], // Would include room images in production
      });
    }

    return recommendations;
  }

  /**
   * Get contextual benefits based on guest profile
   */
  private getContextualBenefits(roomType: RoomType, context: RecommendationContext): string[] {
    const benefits: string[] = [];

    if (context.travelPurpose === 'romance' || context.specialOccasion) {
      if (roomType === RoomType.SUITE || roomType === RoomType.PRESIDENTIAL_SUITE) {
        benefits.push('Romantic setup with rose petals and champagne');
        benefits.push('Private balcony with stunning views');
      }
    }

    if (context.travelPurpose === 'business') {
      if (roomType === RoomType.EXECUTIVE || roomType === RoomType.SUITE) {
        benefits.push('Dedicated workspace with ergonomic setup');
        benefits.push('Executive lounge access with meeting facilities');
      }
    }

    if (context.travelPurpose === 'family') {
      if (roomType === RoomType.FAMILY || roomType === RoomType.SUITE) {
        benefits.push('Kids stay free program');
        benefits.push('Family-oriented amenities and entertainment');
      }
    }

    if (context.preferences?.preferredView === 'ocean') {
      if (roomType === RoomType.OCEAN_VIEW || roomType === RoomType.PRESIDENTIAL_SUITE) {
        benefits.push('Breathtaking oceanfront views');
      }
    }

    return benefits;
  }

  /**
   * Generate amenity recommendations
   */
  generateAmenityRecommendations(context: RecommendationContext): AmenityInfo[] {
    const recommendations: AmenityInfo[] = [];
    const timeOfDay = context.timeOfDay || 'afternoon';
    const season = context.season || 'summer';

    // Time-based recommendations
    if (timeOfDay === 'morning') {
      const morningAmenities = AMENITIES.filter(a =>
        a.name.includes('Fitness') ||
        a.name.includes('Breakfast') ||
        a.name.includes('Spa')
      );
      recommendations.push(...morningAmenities.slice(0, 3));
    } else if (timeOfDay === 'afternoon') {
      const afternoonAmenities = AMENITIES.filter(a =>
        a.name.includes('Pool') ||
        a.name.includes('Beach') ||
        a.name.includes('Spa')
      );
      recommendations.push(...afternoonAmenities.slice(0, 3));
    } else if (timeOfDay === 'evening') {
      const eveningAmenities = AMENITIES.filter(a =>
        a.name.includes('Restaurant') ||
        a.name.includes('Lounge') ||
        a.name.includes('Dining')
      );
      recommendations.push(...eveningAmenities.slice(0, 3));
    } else if (timeOfDay === 'night') {
      const nightAmenities = AMENITIES.filter(a =>
        a.name.includes('Room Service') ||
        a.name.includes('Lounge')
      );
      recommendations.push(...nightAmenities.slice(0, 2));
    }

    // Interest-based recommendations
    if (context.preferences?.interests) {
      const interestAmenities = AMENITIES.filter(a =>
        context.preferences?.interests?.some(interest =>
          a.name.toLowerCase().includes(interest.toLowerCase()) ||
          a.description.toLowerCase().includes(interest.toLowerCase())
        )
      );
      recommendations.push(...interestAmenities.slice(0, 2));
    }

    // Occasion-based recommendations
    if (context.specialOccasion) {
      const occasionAmenities = AMENITIES.filter(a =>
        a.name.includes('Spa') ||
        a.name.includes('Restaurant') ||
        a.name.includes('Concierge')
      );
      recommendations.push(...occasionAmenities.slice(0, 2));
    }

    // Remove duplicates
    const unique = recommendations.filter((item, index, self) =>
      index === self.findIndex(t => t.name === item.name)
    );

    return unique.slice(0, 5);
  }

  /**
   * Generate dining recommendations
   */
  generateDiningRecommendations(context: RecommendationContext): LocalRecommendation[] {
    const recommendations: LocalRecommendation[] = [];
    const timeOfDay = context.timeOfDay || 'evening';
    const weather = context.weather || 'clear';

    // Time-of-day appropriate dining
    if (timeOfDay === 'morning') {
      recommendations.push({
        name: 'Sunrise Café',
        type: 'restaurant',
        distance: 'On-property',
        description: 'Start your day with our renowned breakfast buffet featuring local and international cuisine',
        rating: 4.7,
        priceRange: '$$',
        hours: '6:30 AM - 11:00 AM',
      });
    } else if (timeOfDay === 'afternoon') {
      recommendations.push({
        name: 'Oceanview Terrace',
        type: 'restaurant',
        distance: 'On-property',
        description: 'Light lunch with stunning ocean views, perfect for a midday break',
        rating: 4.5,
        priceRange: '$$$',
        hours: '11:30 AM - 3:00 PM',
      });
    } else if (timeOfDay === 'evening') {
      recommendations.push({
        name: 'La Mer Restaurant',
        type: 'restaurant',
        distance: 'On-property',
        description: 'Fine dining experience with fresh seafood and award-winning wine list',
        rating: 4.8,
        priceRange: '$$$$',
        hours: '6:00 PM - 10:30 PM',
        contact: 'Dial 1 for reservations',
      });

      recommendations.push({
        name: 'The Steakhouse',
        type: 'restaurant',
        distance: '0.2 miles',
        description: 'Premium cuts and classic American fare in an elegant setting',
        rating: 4.6,
        priceRange: '$$$',
        hours: '5:00 PM - 11:00 PM',
      });
    }

    // Dietary restrictions
    if (context.preferences?.dietaryRestrictions?.length) {
      recommendations.push({
        name: 'Garden Kitchen',
        type: 'restaurant',
        distance: 'On-property',
        description: `Plant-based and allergy-friendly options available. Accommodates: ${context.preferences.dietaryRestrictions.join(', ')}`,
        rating: 4.4,
        priceRange: '$$',
        hours: '7:00 AM - 10:00 PM',
      });
    }

    // Romantic occasion
    if (context.specialOccasion === 'honeymoon' || context.specialOccasion === 'anniversary') {
      recommendations.unshift({
        name: 'Private Beach Dinner',
        type: 'restaurant',
        distance: 'Beach',
        description: 'Intimate candlelit dinner on the beach with personal chef service',
        rating: 4.9,
        priceRange: '$$$$',
        hours: 'By reservation only',
        contact: 'Concierge required',
      });
    }

    return recommendations.slice(0, 4);
  }

  /**
   * Generate local recommendations
   */
  generateLocalRecommendations(context: RecommendationContext): LocalRecommendation[] {
    const recommendations: LocalRecommendation[] = [];
    const weather = context.weather || 'clear';

    // Weather-appropriate recommendations
    if (weather === 'sunny' || weather === 'clear') {
      recommendations.push({
        name: 'Crystal Bay Beach',
        type: 'attraction',
        distance: '0.5 miles',
        description: 'Pristine white sand beach with crystal-clear waters, perfect for swimming and snorkeling',
        rating: 4.8,
        priceRange: 'Free',
        hours: 'Sunrise to Sunset',
      });

      recommendations.push({
        name: 'Sunset帆船巡航',
        type: 'attraction',
        distance: 'Harbor - 2 miles',
        description: 'Evening sailing cruise with complimentary champagne and appetizers',
        rating: 4.9,
        priceRange: '$$',
        hours: '4:00 PM - 7:00 PM',
      });
    } else {
      recommendations.push({
        name: 'Artisan Village',
        type: 'attraction',
        distance: '3 miles',
        description: 'Indoor artisan market with local crafts, galleries, and cafes',
        rating: 4.5,
        priceRange: 'Free entry',
        hours: '10:00 AM - 6:00 PM',
      });

      recommendations.push({
        name: 'Historical Museum',
        type: 'attraction',
        distance: '2.5 miles',
        description: 'Explore local history and culture in air-conditioned comfort',
        rating: 4.6,
        priceRange: '$',
        hours: '9:00 AM - 5:00 PM',
      });
    }

    // Add varied local experiences
    recommendations.push({
      name: 'Old Town Market',
      type: 'shopping',
      distance: '1.5 miles',
      description: 'Traditional market with local produce, crafts, and street food',
      rating: 4.4,
      priceRange: '$',
      hours: '7:00 AM - 2:00 PM',
    });

    recommendations.push({
      name: 'Lagoon Kayaking',
      type: 'entertainment',
      distance: '4 miles',
        description: 'Guided kayak tour through scenic mangroves and hidden lagoons',
      rating: 4.7,
      priceRange: '$$',
      hours: '8:00 AM, 10:00 AM, 2:00 PM',
    });

    // Family-friendly options
    if (context.travelPurpose === 'family') {
      recommendations.push({
        name: 'Aquarium & Marine Center',
        type: 'attraction',
        distance: '5 miles',
        description: 'Interactive marine life exhibits and feeding shows perfect for children',
        rating: 4.6,
        priceRange: '$$',
        hours: '9:00 AM - 5:00 PM',
      });
    }

    // Business traveler
    if (context.travelPurpose === 'business') {
      recommendations.push({
        name: 'Business District',
        type: 'attraction',
        distance: '3 miles',
        description: 'Modern shopping and dining complex with co-working spaces',
        rating: 4.3,
        priceRange: '$$',
        hours: '10:00 AM - 9:00 PM',
      });
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Generate activity recommendations based on context
   */
  generateActivityRecommendations(context: RecommendationContext): string[] {
    const activities: string[] = [];
    const timeOfDay = context.timeOfDay || 'afternoon';
    const weather = context.weather || 'clear';

    // Morning activities
    if (timeOfDay === 'morning') {
      activities.push('Join our sunrise yoga session on the beach (7:00 AM)');
      activities.push('Start with a leisurely swim in our oceanfront pool');
      activities.push('Enjoy a guided jog along the scenic coastal trail');
    }

    // Afternoon activities
    if (timeOfDay === 'afternoon') {
      if (weather === 'sunny') {
        activities.push('Cool off with water sports at Crystal Bay Beach');
        activities.push('Relax in a private pool cabana with refreshments');
      } else {
        activities.push('Explore our spa\'s signature afternoon treatments');
        activities.push('Take a cooking class with our executive chef');
      }
      activities.push('Visit the artisan village for unique souvenirs');
    }

    // Evening activities
    if (timeOfDay === 'evening') {
      activities.push('Watch the sunset from our rooftop lounge');
      activities.push('Experience live jazz at the Lobby Lounge');
      activities.push('Book a romantic dinner at La Mer Restaurant');
    }

    // Night activities
    if (timeOfDay === 'night') {
      activities.push('Stargazing tour with our resident astronomer');
      activities.push('Night market exploration in Old Town');
      activities.push('Late-night room service with our chef\'s special menu');
    }

    // Purpose-based activities
    if (context.travelPurpose === 'romance') {
      activities.push('Couples spa journey at our wellness center');
      activities.push('Private beach bonfire with s\'mores and champagne');
    }

    if (context.travelPurpose === 'family') {
      activities.push('Kids club activities and treasure hunt (9 AM - 12 PM)');
      activities.push('Family pool time with floaties and games');
    }

    if (context.travelPurpose === 'business') {
      activities.push('Executive fitness session at our business gym');
      activities.push('Networking event at the Executive Lounge (5 PM)');
    }

    return activities.slice(0, 3);
  }

  /**
   * Generate personalized welcome message
   */
  generateWelcomeMessage(context: RecommendationContext): string {
    const guestName = context.guest?.name || 'Valued Guest';
    const roomType = context.reservation?.roomType || RoomType.STANDARD;
    const roomInfo = getRoomTypeInfo(roomType);

    let message = `Welcome, ${guestName}! `;

    if (context.specialOccasion) {
      const occasionMessages: Record<string, string> = {
        honeymoon: 'Congratulations on your honeymoon! We\'ve prepared something special for you.',
        anniversary: 'Happy Anniversary! Let us help you celebrate this special occasion.',
        birthday: 'Happy Birthday! We want to make your day truly memorable.',
        business: 'Welcome! We look forward to supporting your business objectives.',
        family: 'Welcome to our family-friendly resort! There\'s so much for everyone to enjoy.',
      };
      message += occasionMessages[context.specialOccasion] || '';
    } else {
      message += `We're delighted to have you staying with us in our ${roomInfo?.name || 'accommodation'}.`;
    }

    // Add contextual offer
    if (context.timeOfDay === 'morning') {
      message += ' Would you like to start your day with breakfast at our oceanfront café?';
    } else if (context.timeOfDay === 'afternoon') {
      message += ' The pool is perfectly warm, and our spa has availability this afternoon.';
    } else if (context.timeOfDay === 'evening') {
      message += ' Tonight\'s sunset is expected to be spectacular - I recommend our rooftop bar.';
    }

    return message;
  }

  /**
   * Get quick suggestions based on current context
   */
  getQuickSuggestions(context: RecommendationContext): string[] {
    const suggestions: string[] = [];

    // Always available
    suggestions.push('Room service menu');
    suggestions.push('WiFi password');

    // Time-based
    if (context.timeOfDay === 'morning') {
      suggestions.push('Book breakfast');
      suggestions.push('Gym access');
    } else if (context.timeOfDay === 'afternoon') {
      suggestions.push('Pool access');
      suggestions.push('Spa booking');
    } else if (context.timeOfDay === 'evening') {
      suggestions.push('Restaurant reservation');
      suggestions.push('Concierge recommendations');
    }

    // Purpose-based
    if (context.travelPurpose === 'business') {
      suggestions.push('Business center');
      suggestions.push('Meeting room');
    }

    return suggestions.slice(0, 4);
  }
}

// Export singleton
export const recommendationsService = new RecommendationsService();

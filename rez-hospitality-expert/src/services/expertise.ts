/**
 * Hospitality Expertise Service
 * Core capabilities and knowledge base for the hospitality expert agent
 */

import {
  HospitalityIntent,
  RoomType,
  AmenityInfo,
  RoomRecommendation,
  LocalRecommendation,
  ConversationContext,
  ChatResponse,
  SuggestedAction,
  AmenityCategory,
} from '../types/index';
import {
  ROOM_TYPES,
  AMENITIES,
  HOTEL_TERMINOLOGY,
  SPECIAL_OCCASIONS,
  getRoomTypeInfo,
  getAmenitiesByCategory,
  getPolicy,
  getTermDefinition,
  getSpecialOccasion,
  calculateUpgradePrice,
} from '../config/knowledge';
import { selectTone, ToneType } from '../config/tone';
import { generateResponse } from '../responses/templates';

// ============================================
// EXPERTISE AREAS
// ============================================

export interface ExpertiseArea {
  name: string;
  intents: HospitalityIntent[];
  capabilities: string[];
  keywords: string[];
}

export const EXPERTISE_AREAS: ExpertiseArea[] = [
  {
    name: 'Check-In & Check-Out',
    intents: [HospitalityIntent.CHECK_IN, HospitalityIntent.CHECK_OUT],
    capabilities: [
      'Streamlined check-in process',
      'Express checkout',
      'Late/early checkout arrangements',
      'Baggage storage',
      'Flight reconfirmation',
      'Transportation booking',
    ],
    keywords: ['check in', 'check out', 'checkout', 'early arrival', 'late departure', 'bags', 'luggage'],
  },
  {
    name: 'Room Service & Dining',
    intents: [HospitalityIntent.ROOM_SERVICE, HospitalityIntent.DINING],
    capabilities: [
      '24-hour room service',
      'Restaurant recommendations',
      'Dietary accommodations',
      'Special occasion dining',
      'Private dining arrangements',
      'Menu inquiries',
    ],
    keywords: ['room service', 'food', 'dining', 'restaurant', 'breakfast', 'lunch', 'dinner', 'menu', 'order'],
  },
  {
    name: 'Housekeeping & Maintenance',
    intents: [HospitalityIntent.HOUSEKEEPING],
    capabilities: [
      'Room cleaning requests',
      'Extra amenities',
      'Maintenance issues',
      'Laundry and dry cleaning',
      'Turndown preferences',
      'Special setups (romantic, business)',
    ],
    keywords: ['clean', 'housekeeping', 'towels', 'pillows', 'extra', 'maintenance', 'broken', 'laundry'],
  },
  {
    name: 'Concierge Services',
    intents: [HospitalityIntent.CONCIERGE, HospitalityIntent.LOCAL_RECOMMENDATIONS],
    capabilities: [
      'Local restaurant recommendations',
      'Tour and excursion bookings',
      'Event tickets',
      'Transportation arrangements',
      'Shopping recommendations',
      'Special event planning',
    ],
    keywords: ['recommend', 'suggestion', 'local', 'tour', 'attraction', 'show', 'tickets', 'sightseeing'],
  },
  {
    name: 'Spa & Wellness',
    intents: [HospitalityIntent.SPA_WELLNESS],
    capabilities: [
      'Spa treatment bookings',
      'Fitness center information',
      'Pool and beach access',
      'Wellness programs',
      'Yoga and meditation sessions',
      'Salon services',
    ],
    keywords: ['spa', 'massage', 'treatment', 'fitness', 'gym', 'pool', 'beach', 'wellness', 'yoga'],
  },
  {
    name: 'Transportation',
    intents: [HospitalityIntent.TRANSPORTATION],
    capabilities: [
      'Airport transfers',
      'Car rentals',
      'Taxi and rideshare arrangements',
      'Valet parking',
      'Directions and navigation',
      'Public transit information',
    ],
    keywords: ['airport', 'transfer', 'car', 'taxi', 'uber', 'lyft', 'parking', 'drive', 'direction'],
  },
  {
    name: 'Room & Amenities',
    intents: [HospitalityIntent.AMENITIES, HospitalityIntent.ROOM_UPGRADE],
    capabilities: [
      'Room type information',
      'Upgrade options',
      'Amenity details',
      'Accessibility accommodations',
      'Pet policies',
      'Technology support',
    ],
    keywords: ['upgrade', 'room type', 'suite', 'view', 'amenity', 'wifi', 'internet', 'accessible'],
  },
  {
    name: 'Guest Relations',
    intents: [HospitalityIntent.COMPLAINT, HospitalityIntent.BILLING],
    capabilities: [
      'Complaint resolution',
      'Billing inquiries',
      'Dispute resolution',
      'Guest feedback',
      'VIP services',
      'Guest recognition',
    ],
    keywords: ['complaint', 'problem', 'issue', 'bill', 'charge', 'payment', 'refund', 'manager'],
  },
];

// ============================================
// EXPERTISE SERVICE
// ============================================

export class HospitalityExpertiseService {
  /**
   * Detect the primary intent from user message
   */
  detectIntent(message: string): { intent: HospitalityIntent; confidence: number; context: string[] } {
    const lowerMessage = message.toLowerCase();

    // Intent detection rules
    const intentPatterns: Record<HospitalityIntent, RegExp[]> = {
      [HospitalityIntent.CHECK_IN]: [
        /check\s*in/i,
        /arriving/i,
        /arrival/i,
        /want\s+to\s+(come\s+)?in/i,
        /ready\s+(for\s+)?check\s*in/i,
      ],
      [HospitalityIntent.CHECK_OUT]: [
        /check\s*out/i,
        /checking\s*out/i,
        /leaving/i,
        /departure/i,
        /need\s+to\s+(go|leave)/i,
        /finish/i,
      ],
      [HospitalityIntent.ROOM_SERVICE]: [
        /room\s*service/i,
        /order\s+(food|drink)/i,
        /deliver/i,
        /bring\s+(me\s+)?(food|coffee|breakfast)/i,
        /have\s+something\s+(to\s+)?eat/i,
      ],
      [HospitalityIntent.HOUSEKEEPING]: [
        /housekeeping/i,
        /clean\s+(my\s+)?room/i,
        /towels?/i,
        /pillows?/i,
        /extra\s+(bedding|blanket)/i,
        /turndown/i,
      ],
      [HospitalityIntent.CONCIERGE]: [
        /concierge/i,
        /need\s+(to\s+)?know/i,
        /can\s+you\s+(help|tell|get|arrange)/i,
        /information/i,
        /question/i,
      ],
      [HospitalityIntent.AMENITIES]: [
        /amenities/i,
        /facilities/i,
        /pool/i,
        /gym/i,
        /spa/i,
        /fitness/i,
      ],
      [HospitalityIntent.DINING]: [
        /restaurant/i,
        /dining/i,
        /breakfast/i,
        /lunch/i,
        /dinner/i,
        /food/i,
        /eat/i,
      ],
      [HospitalityIntent.SPA_WELLNESS]: [
        /spa/i,
        /massage/i,
        /treatment/i,
        /wellness/i,
        /relax/i,
        /salon/i,
      ],
      [HospitalityIntent.TRANSPORTATION]: [
        /airport/i,
        /transfer/i,
        /taxi/i,
        /car\s*(rental|service)?/i,
        /uber|lyft/i,
        /parking/i,
        /direction/i,
      ],
      [HospitalityIntent.LOCAL_RECOMMENDATIONS]: [
        /recommend/i,
        /suggest/i,
        /what\s+(to\s+)?do/i,
        /local/i,
        /nearby/i,
        /attraction/i,
        /sightseeing/i,
      ],
      [HospitalityIntent.ROOM_UPGRADE]: [
        /upgrade/i,
        /better\s+room/i,
        /larger\s+room/i,
        /ocean\s*view/i,
        /suite/i,
      ],
      [HospitalityIntent.COMPLAINT]: [
        /complaint/i,
        /problem/i,
        /issue/i,
        /frustrated/i,
        /unhappy/i,
        /not\s+(happy|satisfied)/i,
        /wrong/i,
      ],
      [HospitalityIntent.GENERAL_INQUIRY]: [
        /what\s+(is|are)/i,
        /how\s+(do|does|can)/i,
        /where\s+(is|are)/i,
        /when\s+(is|are|do|does)/i,
      ],
      [HospitalityIntent.EMERGENCY]: [
        /emergency/i,
        /help\s*(me)?/i,
        /police/i,
        /ambulance/i,
        /fire/i,
        /medical/i,
        /urgent/i,
      ],
      [HospitalityIntent.BILLING]: [
        /bill/i,
        /charge/i,
        /payment/i,
        /invoice/i,
        /cost/i,
        /price/i,
        /fee/i,
      ],
      [HospitalityIntent.WiFi_TECHNICAL]: [
        /wifi/i,
        /internet/i,
        /connection/i,
        /connect/i,
        /password/i,
        /login/i,
      ],
    };

    let bestIntent: HospitalityIntent = HospitalityIntent.GENERAL_INQUIRY;
    let highestConfidence = 0;
    const contextKeywords: string[] = [];

    // Check each intent pattern
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          const confidence = patterns.indexOf(pattern) === 0 ? 0.9 : 0.7;
          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            bestIntent = intent as HospitalityIntent;
          }
          contextKeywords.push(pattern.source);
        }
      }
    }

    return {
      intent: bestIntent,
      confidence: highestConfidence,
      context: contextKeywords,
    };
  }

  /**
   * Get room information
   */
  getRoomInformation(roomType?: RoomType): RoomRecommendation[] {
    if (roomType) {
      const info = getRoomTypeInfo(roomType);
      if (!info) return [];

      return [{
        roomType,
        description: info.description,
        priceDifference: 0,
        benefits: info.features,
      }];
    }

    // Return all room types
    return Object.values(ROOM_TYPES).map(info => ({
      roomType: info.type,
      description: info.description,
      priceDifference: info.priceRange.low,
      benefits: info.features.slice(0, 5),
    }));
  }

  /**
   * Get upgrade recommendations
   */
  getUpgradeRecommendations(currentRoom: RoomType, context?: ConversationContext): RoomRecommendation[] {
    const currentInfo = getRoomTypeInfo(currentRoom);
    if (!currentInfo) return [];

    const upgrades: RoomRecommendation[] = [];
    const roomHierarchy: RoomType[] = [
      RoomType.STANDARD,
      RoomType.OCEAN_VIEW,
      RoomType.POOL_VIEW,
      RoomType.EXECUTIVE,
      RoomType.ACCESSIBLE,
      RoomType.FAMILY,
      RoomType.DELUXE,
      RoomType.JUNIOR_SUITE,
      RoomType.SUITE,
      RoomType.PRESIDENTIAL_SUITE,
    ];

    const currentIndex = roomHierarchy.indexOf(currentRoom);

    // Get next 2 tier upgrades
    for (let i = currentIndex + 1; i < Math.min(currentIndex + 3, roomHierarchy.length); i++) {
      const targetRoom = roomHierarchy[i];
      const targetInfo = getRoomTypeInfo(targetRoom);
      if (!targetInfo) continue;

      const priceDiff = calculateUpgradePrice(currentRoom, targetRoom, 1);

      upgrades.push({
        roomType: targetRoom,
        description: targetInfo.description,
        priceDifference: priceDiff?.perNight || 0,
        benefits: targetInfo.features.filter(f => !currentInfo.features.some(cf => f.includes(cf))).slice(0, 5),
      });
    }

    return upgrades;
  }

  /**
   * Get amenity information
   */
  getAmenityInfo(category?: AmenityCategory): AmenityInfo[] {
    if (category) {
      return getAmenitiesByCategory(category);
    }
    return AMENITIES;
  }

  /**
   * Get local recommendations
   */
  getLocalRecommendations(type?: string, preferences?: Record<string, unknown>): LocalRecommendation[] {
    // This would typically fetch from a database or external API
    // For now, return placeholder data
    const recommendations: LocalRecommendation[] = [
      {
        name: 'Sunset Beach',
        type: 'attraction',
        distance: '0.5 miles',
        description: 'Beautiful white sand beach with stunning sunset views',
        rating: 4.8,
        priceRange: 'Free',
        hours: 'Open 24 hours',
      },
      {
        name: 'Ocean Bistro',
        type: 'restaurant',
        distance: '0.3 miles',
        description: 'Fresh seafood with oceanfront dining',
        rating: 4.6,
        priceRange: '$$$',
        hours: '11:00 AM - 10:00 PM',
      },
      {
        name: 'Old Town Market',
        type: 'shopping',
        distance: '1.2 miles',
        description: 'Local crafts, souvenirs, and street food',
        rating: 4.4,
        priceRange: '$',
        hours: '9:00 AM - 6:00 PM',
      },
      {
        name: 'Reef Diving Center',
        type: 'entertainment',
        distance: '2 miles',
        description: 'Guided snorkeling and diving tours',
        rating: 4.9,
        priceRange: '$$',
        hours: '8:00 AM - 5:00 PM',
      },
      {
        name: 'Airport Shuttle',
        type: 'transport',
        distance: '15 miles',
        description: 'Express shuttle service to international airport',
        rating: undefined,
        priceRange: '$',
        hours: '24/7',
      },
    ];

    if (type) {
      return recommendations.filter(r => r.type === type);
    }

    return recommendations;
  }

  /**
   * Get terminology definition
   */
  getTermDefinition(term: string): string | undefined {
    return getTermDefinition(term);
  }

  /**
   * Get policy information
   */
  getPolicy(policyName: string): { name: string; description: string; details: string[] } | undefined {
    const policy = getPolicy(policyName);
    if (!policy) return undefined;

    return {
      name: policy.name,
      description: policy.description,
      details: policy.details,
    };
  }

  /**
   * Get special occasion information
   */
  getSpecialOccasionInfo(occasion: string): { name: string; amenities: string[]; recommendations: string[] } | undefined {
    const info = getSpecialOccasion(occasion);
    if (!info) return undefined;

    return {
      name: info.name,
      amenities: info.amenities,
      recommendations: info.recommendations,
    };
  }

  /**
   * Generate suggested actions based on intent
   */
  getSuggestedActions(intent: HospitalityIntent, context?: ConversationContext): SuggestedAction[] {
    const actionMap: Record<HospitalityIntent, SuggestedAction[]> = {
      [HospitalityIntent.CHECK_IN]: [
        { label: 'Start Check-In', action: 'START_CHECK_IN' },
        { label: 'Early Check-In', action: 'REQUEST_EARLY_CHECKIN' },
        { label: 'Airport Transfer', action: 'BOOK_TRANSFER' },
      ],
      [HospitalityIntent.CHECK_OUT]: [
        { label: 'Express Checkout', action: 'START_EXPRESS_CHECKOUT' },
        { label: 'Late Checkout', action: 'REQUEST_LATE_CHECKOUT' },
        { label: 'Store Luggage', action: 'BAG_STORAGE' },
      ],
      [HospitalityIntent.ROOM_SERVICE]: [
        { label: 'Order Breakfast', action: 'ORDER_BREAKFAST' },
        { label: 'Order Lunch', action: 'ORDER_LUNCH' },
        { label: 'Order Dinner', action: 'ORDER_DINNER' },
        { label: 'Late Night Menu', action: 'ORDER_LATE_NIGHT' },
      ],
      [HospitalityIntent.HOUSEKEEPING]: [
        { label: 'Extra Towels', action: 'EXTRA_TOWELS' },
        { label: 'Extra Pillows', action: 'EXTRA_PILLOWS' },
        { label: 'Room Cleaning', action: 'REQUEST_CLEANING' },
        { label: 'Laundry Service', action: 'LAUNDRY_SERVICE' },
      ],
      [HospitalityIntent.CONCIERGE]: [
        { label: 'Restaurant Booking', action: 'BOOK_RESTAURANT' },
        { label: 'Tour Booking', action: 'BOOK_TOUR' },
        { label: 'Event Tickets', action: 'GET_TICKETS' },
        { label: 'Transportation', action: 'ARRANGE_TRANSPORT' },
      ],
      [HospitalityIntent.AMENITIES]: [
        { label: 'Pool Access', action: 'POOL_INFO' },
        { label: 'Gym Hours', action: 'GYM_INFO' },
        { label: 'Spa Booking', action: 'SPA_BOOKING' },
      ],
      [HospitalityIntent.DINING]: [
        { label: 'Reserve Table', action: 'RESERVE_TABLE' },
        { label: 'Room Service', action: 'ROOM_SERVICE' },
        { label: 'Special Diet', action: 'SPECIAL_DIET' },
      ],
      [HospitalityIntent.SPA_WELLNESS]: [
        { label: 'Book Treatment', action: 'BOOK_TREATMENT' },
        { label: 'View Menu', action: 'VIEW_SPA_MENU' },
        { label: 'Fitness Classes', action: 'FITNESS_CLASSES' },
      ],
      [HospitalityIntent.TRANSPORTATION]: [
        { label: 'Airport Transfer', action: 'AIRPORT_TRANSFER' },
        { label: 'Car Rental', action: 'CAR_RENTAL' },
        { label: 'Local Directions', action: 'GET_DIRECTIONS' },
      ],
      [HospitalityIntent.LOCAL_RECOMMENDATIONS]: [
        { label: 'Restaurants', action: 'RECOMMEND_RESTAURANT' },
        { label: 'Attractions', action: 'RECOMMEND_ATTRACTION' },
        { label: 'Shopping', action: 'RECOMMEND_SHOPPING' },
      ],
      [HospitalityIntent.ROOM_UPGRADE]: [
        { label: 'View Suites', action: 'VIEW_SUITES' },
        { label: 'Compare Rooms', action: 'COMPARE_ROOMS' },
        { label: 'Upgrade Now', action: 'UPGRADE_NOW' },
      ],
      [HospitalityIntent.COMPLAINT]: [
        { label: 'Speak to Manager', action: 'ESCALATE_MANAGER' },
        { label: 'File Complaint', action: 'FILE_COMPLAINT' },
        { label: 'Request Refund', action: 'REQUEST_REFUND' },
      ],
      [HospitalityIntent.GENERAL_INQUIRY]: [
        { label: 'Hotel Services', action: 'HOTEL_SERVICES' },
        { label: 'WiFi Info', action: 'WIFI_INFO' },
        { label: 'Contact Info', action: 'CONTACT_INFO' },
      ],
      [HospitalityIntent.EMERGENCY]: [
        { label: 'Call Security', action: 'CALL_SECURITY' },
        { label: 'Medical Assistance', action: 'MEDICAL_ASSISTANCE' },
        { label: 'Contact Emergency', action: 'CONTACT_EMERGENCY' },
      ],
      [HospitalityIntent.BILLING]: [
        { label: 'View Bill', action: 'VIEW_BILL' },
        { label: 'Dispute Charge', action: 'DISPUTE_CHARGE' },
        { label: 'Payment Methods', action: 'PAYMENT_INFO' },
      ],
      [HospitalityIntent.WiFi_TECHNICAL]: [
        { label: 'Get WiFi Password', action: 'GET_WIFI_PASSWORD' },
        { label: 'Tech Support', action: 'TECH_SUPPORT' },
        { label: 'Restart Router', action: 'RESTART_ROUTER' },
      ],
    };

    return actionMap[intent] || [];
  }

  /**
   * Get quick replies based on context
   */
  getQuickReplies(intent: HospitalityIntent): string[] {
    const quickReplyMap: Record<HospitalityIntent, string[]> = {
      [HospitalityIntent.CHECK_IN]: [
        'I need to check in',
        'What time is check-in?',
        'Can I check in early?',
      ],
      [HospitalityIntent.CHECK_OUT]: [
        'I need to check out',
        'What time is checkout?',
        'Can I get a late checkout?',
      ],
      [HospitalityIntent.ROOM_SERVICE]: [
        'Order breakfast to my room',
        'Room service menu',
        'Late night snacks',
      ],
      [HospitalityIntent.HOUSEKEEPING]: [
        'I need extra towels',
        'Please clean my room',
        'Extra pillows please',
      ],
      [HospitalityIntent.CONCIERGE]: [
        'Restaurant recommendations?',
        'Book a tour',
        'What can I do nearby?',
      ],
      [HospitalityIntent.AMENITIES]: [
        'When does the pool open?',
        'Gym information',
        'Spa hours',
      ],
      [HospitalityIntent.DINING]: [
        'Reserve a table',
        'Best restaurant?',
        'Room service',
      ],
      [HospitalityIntent.SPA_WELLNESS]: [
        'Book a massage',
        'Spa packages',
        'Fitness center',
      ],
      [HospitalityIntent.TRANSPORTATION]: [
        'Airport transfer',
        'Need a taxi',
        'Car rental',
      ],
      [HospitalityIntent.LOCAL_RECOMMENDATIONS]: [
        'What should I visit?',
        'Local restaurants',
        'Tourist attractions',
      ],
      [HospitalityIntent.ROOM_UPGRADE]: [
        'Upgrade my room',
        'Available suites?',
        'Ocean view options',
      ],
      [HospitalityIntent.COMPLAINT]: [
        'I have a complaint',
        'Speak to manager',
        'Issue with room',
      ],
      [HospitalityIntent.GENERAL_INQUIRY]: [
        'Hotel information',
        'WiFi password',
        'Contact front desk',
      ],
      [HospitalityIntent.EMERGENCY]: [
        'I need help',
        'Call security',
        'Medical emergency',
      ],
      [HospitalityIntent.BILLING]: [
        'View my bill',
        'Payment options',
        'Dispute a charge',
      ],
      [HospitalityIntent.WiFi_TECHNICAL]: [
        'WiFi not working',
        'Password help',
        'Connection issues',
      ],
    };

    return quickReplyMap[intent] || [];
  }
}

// Export singleton instance
export const expertiseService = new HospitalityExpertiseService();

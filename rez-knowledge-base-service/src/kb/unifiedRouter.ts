/**
 * Unified Knowledge Base Router
 * Routes queries to the correct knowledge base based on QR context
 */

import { hotelRoomKB, HotelRoomKB } from './hotel-room';
import { restaurantMenuKB, RestaurantMenuKB } from './restaurant-menu';
import { storeMerchantKB, StoreMerchantKB } from './store-merchant';
import { campaignAdsKB, CampaignAdsKB } from './campaign-ads';

// ====== QR CONTEXT TYPES ======

export enum QRContextSource {
  ROOM_QR = 'room_qr',
  MENU_QR = 'menu_qr',
  STORE_QR = 'store_qr',
  ADS_QR = 'ads_qr',
  REZ_NOW = 'rez_now',
  UNKNOWN = 'unknown',
}

export interface QRContext {
  source: QRContextSource;
  merchantId?: string;
  userId?: string;
  locationId?: string;
  campaignId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface KnowledgeBaseInfo {
  name: string;
  description: string;
  source: QRContextSource;
}

// ====== KNOWLEDGE BASE REGISTRY ======

interface KnowledgeBaseRegistry {
  [key: string]: {
    info: KnowledgeBaseInfo;
    instance: any;
  };
}

const knowledgeBaseRegistry: KnowledgeBaseRegistry = {
  [QRContextSource.ROOM_QR]: {
    info: {
      name: 'Hotel Room Service',
      description: 'Handles hotel room service, housekeeping, spa, concierge, and maintenance requests',
      source: QRContextSource.ROOM_QR
    },
    instance: hotelRoomKB
  },
  [QRContextSource.MENU_QR]: {
    info: {
      name: 'Restaurant Menu',
      description: 'Handles restaurant menus, dietary requirements, allergens, and food pairings',
      source: QRContextSource.MENU_QR
    },
    instance: restaurantMenuKB
  },
  [QRContextSource.STORE_QR]: {
    info: {
      name: 'Store/Merchant',
      description: 'Handles store information, products, services, and business operations',
      source: QRContextSource.STORE_QR
    },
    instance: storeMerchantKB
  },
  [QRContextSource.ADS_QR]: {
    info: {
      name: 'Campaign/Ads',
      description: 'Handles campaigns, rewards, promotions, and advertising offers',
      source: QRContextSource.ADS_QR
    },
    instance: campaignAdsKB
  },
  [QRContextSource.REZ_NOW]: {
    info: {
      name: 'REZ Now',
      description: 'Quick access knowledge base combining all merchant and campaign information',
      source: QRContextSource.REZ_NOW
    },
    instance: {
      ...storeMerchantKB,
      ...campaignAdsKB
    }
  }
};

// ====== UNIFIED ROUTER CLASS ======

export class UnifiedKnowledgeRouter {
  private static instance: UnifiedKnowledgeRouter;

  private constructor() {}

  static getInstance(): UnifiedKnowledgeRouter {
    if (!UnifiedKnowledgeRouter.instance) {
      UnifiedKnowledgeRouter.instance = new UnifiedKnowledgeRouter();
    }
    return UnifiedKnowledgeRouter.instance;
  }

  /**
   * Get the appropriate knowledge base based on QR context
   */
  getKnowledgeBase(context: QRContext): any {
    const { source } = context;

    if (source === QRContextSource.UNKNOWN) {
      // Fallback to combined knowledge base for unknown contexts
      return this.getCombinedKnowledgeBase();
    }

    const kbEntry = knowledgeBaseRegistry[source];
    if (kbEntry) {
      return kbEntry.instance;
    }

    // Default fallback
    return this.getCombinedKnowledgeBase();
  }

  /**
   * Get combined knowledge base for unknown contexts
   */
  private getCombinedKnowledgeBase(): any {
    return {
      hotelRoom: hotelRoomKB,
      restaurantMenu: restaurantMenuKB,
      storeMerchant: storeMerchantKB,
      campaignAds: campaignAdsKB
    };
  }

  /**
   * Get knowledge base info
   */
  getKnowledgeBaseInfo(source: QRContextSource): KnowledgeBaseInfo | null {
    const entry = knowledgeBaseRegistry[source];
    return entry ? entry.info : null;
  }

  /**
   * Get all available knowledge bases
   */
  getAllKnowledgeBases(): KnowledgeBaseInfo[] {
    return Object.values(knowledgeBaseRegistry).map(entry => entry.info);
  }

  /**
   * Detect context from query keywords
   */
  detectContextFromQuery(query: string): QRContextSource {
    const lowerQuery = query.toLowerCase();

    // Hotel room service keywords
    const roomKeywords = [
      'room', 'housekeeping', 'towel', 'pillow', 'blanket', 'clean', 'maid',
      'checkout', 'checkin', 'check-in', 'check-out', 'spa', 'massage',
      'concierge', 'front desk', 'minibar', 'ac', 'wifi', 'hotel'
    ];

    // Restaurant menu keywords
    const menuKeywords = [
      'menu', 'food', 'order', 'dish', 'appetizer', 'main course', 'dessert',
      'drink', 'beverage', 'vegetarian', 'vegan', 'gluten free', 'allergy',
      'spicy', 'recommend', 'chef special', 'table', 'reservation'
    ];

    // Store/merchant keywords
    const storeKeywords = [
      'store', 'shop', 'product', 'price', 'buy', 'return', 'warranty',
      'location', 'hours', 'contact', 'service', 'installation', 'delivery',
      'pickup', 'payment', 'loyalty', 'card', 'gift'
    ];

    // Campaign/ads keywords
    const campaignKeywords = [
      'reward', 'earn', 'redeem', 'points', 'coins', 'discount', 'offer',
      'promotion', 'campaign', 'deal', 'prize', 'winner', 'contest',
      'scan', 'referral', 'invite', 'bonus', 'cashback', 'free'
    ];

    // Score each context
    let roomScore = 0;
    let menuScore = 0;
    let storeScore = 0;
    let campaignScore = 0;

    roomKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) roomScore++;
    });

    menuKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) menuScore++;
    });

    storeKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) storeScore++;
    });

    campaignKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) campaignScore++;
    });

    // Find highest score
    const scores = [
      { source: QRContextSource.ROOM_QR, score: roomScore },
      { source: QRContextSource.MENU_QR, score: menuScore },
      { source: QRContextSource.STORE_QR, score: storeScore },
      { source: QRContextSource.ADS_QR, score: campaignScore }
    ];

    const highest = scores.reduce((max, current) =>
      current.score > max.score ? current : max
    );

    // If no clear winner, return unknown
    if (highest.score === 0) {
      return QRContextSource.UNKNOWN;
    }

    return highest.source as QRContextSource;
  }

  /**
   * Create context from QR data
   */
  createContext(qrData: any): QRContext {
    return {
      source: this.detectQRSource(qrData.type || qrData.source || 'unknown'),
      merchantId: qrData.merchantId || qrData.merchant_id,
      userId: qrData.userId || qrData.user_id,
      locationId: qrData.locationId || qrData.location_id,
      campaignId: qrData.campaignId || qrData.campaign_id,
      timestamp: new Date(),
      metadata: qrData.metadata || qrData.extra || {}
    };
  }

  /**
   * Detect QR source from type string
   */
  private detectQRSource(type: string): QRContextSource {
    const normalizedType = type.toLowerCase().replace(/[_\s-]/g, '');

    if (normalizedType.includes('room') || normalizedType.includes('hotel')) {
      return QRContextSource.ROOM_QR;
    }
    if (normalizedType.includes('menu') || normalizedType.includes('restaurant')) {
      return QRContextSource.MENU_QR;
    }
    if (normalizedType.includes('store') || normalizedType.includes('merchant')) {
      return QRContextSource.STORE_QR;
    }
    if (normalizedType.includes('ads') || normalizedType.includes('campaign') || normalizedType.includes('promo')) {
      return QRContextSource.ADS_QR;
    }
    if (normalizedType.includes('reznow') || normalizedType.includes('rez_now')) {
      return QRContextSource.REZ_NOW;
    }

    return QRContextSource.UNKNOWN;
  }

  /**
   * Match intent across all knowledge bases
   */
  matchIntent(query: string, context: QRContext): string | null {
    const kb = this.getKnowledgeBase(context);
    const lowerQuery = query.toLowerCase();

    if (!kb || !kb.intents) {
      return null;
    }

    // Check each intent category
    for (const [category, phrases] of Object.entries(kb.intents)) {
      if (Array.isArray(phrases)) {
        for (const phrase of phrases) {
          if (lowerQuery.includes(phrase.toLowerCase())) {
            return category;
          }
        }
      }
    }

    return null;
  }

  /**
   * Search for items matching query within knowledge base
   */
  searchItems(query: string, context: QRContext): any[] {
    const kb = this.getKnowledgeBase(context);
    const results: any[] = [];
    const lowerQuery = query.toLowerCase();

    if (!kb || !kb.categories) {
      return results;
    }

    // Search through all categories
    for (const [categoryName, categoryData] of Object.entries(kb.categories)) {
      if (typeof categoryData === 'object' && categoryData !== null && 'items' in categoryData) {
        for (const item of (categoryData as { items: any[] }).items) {
          // Check if query matches item keywords, name, or description
          const itemKeywords = item.keywords || [];
          const matchesName = item.name?.toLowerCase().includes(lowerQuery);
          const matchesKeywords = itemKeywords.some((kw: string) =>
            kw.toLowerCase().includes(lowerQuery)
          );
          const matchesDescription = item.description?.toLowerCase().includes(lowerQuery);

          if (matchesName || matchesKeywords || matchesDescription) {
            results.push({
              ...item,
              category: categoryName,
              matchType: matchesName ? 'name' : matchesKeywords ? 'keyword' : 'description'
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get response for common question
   */
  getCommonQuestionResponse(query: string, context: QRContext): string | null {
    const kb = this.getKnowledgeBase(context);
    const lowerQuery = query.toLowerCase();

    if (!kb) {
      return null;
    }

    // Check commonQuestions if available
    if (kb.commonQuestions) {
      for (const cq of kb.commonQuestions) {
        const matches = cq.keywords.some((kw: string) =>
          lowerQuery.includes(kw.toLowerCase())
        );
        if (matches) {
          return cq.response;
        }
      }
    }

    // Check categories responses
    if (kb.categories) {
      for (const [categoryName, categoryData] of Object.entries(kb.categories)) {
        if (typeof categoryData === 'object' && categoryData !== null && 'responses' in categoryData) {
          const responses = (categoryData as { responses: Record<string, string> }).responses;
          for (const [key, response] of Object.entries(responses)) {
            if (lowerQuery.includes(key.toLowerCase())) {
              return response;
            }
          }
        }
      }
    }

    // Check main responses
    if (kb.responses) {
      for (const [key, response] of Object.entries(kb.responses)) {
        if (lowerQuery.includes(key.toLowerCase())) {
          return response as string;
        }
      }
    }

    return null;
  }
}

// ====== HELPER FUNCTIONS ======

/**
 * Convenience function to route query to correct knowledge base
 */
export function routeToKnowledgeBase(query: string, context: QRContext): any {
  const router = UnifiedKnowledgeRouter.getInstance();
  return router.getKnowledgeBase(context);
}

/**
 * Convenience function to detect context from query
 */
export function detectQueryContext(query: string): QRContextSource {
  const router = UnifiedKnowledgeRouter.getInstance();
  return router.detectContextFromQuery(query);
}

/**
 * Convenience function to create context from QR data
 */
export function createContextFromQR(qrData: any): QRContext {
  const router = UnifiedKnowledgeRouter.getInstance();
  return router.createContext(qrData);
}

/**
 * Match intent in query
 */
export function matchQueryIntent(query: string, context: QRContext): string | null {
  const router = UnifiedKnowledgeRouter.getInstance();
  return router.matchIntent(query, context);
}

/**
 * Search items in knowledge base
 */
export function searchKBItems(query: string, context: QRContext): any[] {
  const router = UnifiedKnowledgeRouter.getInstance();
  return router.searchItems(query, context);
}

/**
 * Get common question response
 */
export function getQuestionResponse(query: string, context: QRContext): string | null {
  const router = UnifiedKnowledgeRouter.getInstance();
  return router.getCommonQuestionResponse(query, context);
}

// ====== TYPE EXPORTS ======

export type {
  HotelRoomKB,
  RestaurantMenuKB,
  StoreMerchantKB,
  CampaignAdsKB
};

// ====== UTILITY FUNCTIONS ======

export function getAllKnowledgeBases(): KnowledgeBaseInfo[] {
  return [
    { name: 'Hotel Room Service', description: 'Hotel room service knowledge base', source: QRContextSource.ROOM_QR },
    { name: 'Restaurant Menu', description: 'Restaurant menu knowledge base', source: QRContextSource.MENU_QR },
    { name: 'Store Merchant', description: 'Store merchant knowledge base', source: QRContextSource.STORE_QR },
    { name: 'Campaign Ads', description: 'Campaign ads knowledge base', source: QRContextSource.ADS_QR },
  ];
}

// ====== DEFAULT EXPORT ======

export default UnifiedKnowledgeRouter;

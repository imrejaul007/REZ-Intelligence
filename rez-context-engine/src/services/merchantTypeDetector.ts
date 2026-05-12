import { MerchantCategory, EntryContext, QRCodeType, ReZPlatform } from '../models/EntryContext';
import { logger } from '../utils/logger';

/**
 * Merchant category detection rules
 */
interface MerchantCategoryRule {
  category: MerchantCategory;
  keywords: string[];
  confidence: number;
}

/**
 * Merchant category detection rules by keyword matching
 */
const MERCHANT_CATEGORY_RULES: MerchantCategoryRule[] = [
  {
    category: MerchantCategory.HOSPITALITY,
    keywords: [
      'hotel', 'resort', 'inn', 'motel', 'hostel', 'lodge', 'homestay', 'bnb',
      'guesthouse', 'suites', 'accommodation', 'booking', 'stay', 'lodging',
      'airbnb', 'vacation rental', 'residence', 'aparthotel', 'hostel',
    ],
    confidence: 0.9,
  },
  {
    category: MerchantCategory.CULINARY,
    keywords: [
      'restaurant', 'cafe', 'coffee', 'bistro', 'bar', 'pub', 'eatery', 'diner',
      'grill', 'pizza', 'sushi', 'chinese', 'indian', 'thai', 'mexican', 'italian',
      'food', 'kitchen', 'bakery', 'deli', 'ice cream', 'dessert', 'menu',
      'dining', 'takeout', 'delivery', 'fast food', 'bistro', 'steakhouse',
    ],
    confidence: 0.9,
  },
  {
    category: MerchantCategory.FITNESS,
    keywords: [
      'gym', 'fitness', 'workout', 'exercise', 'training', 'gymnasium', 'health club',
      'crossfit', 'yoga', 'pilates', 'spinning', 'aerobics', 'cardio', 'weights',
      'personal trainer', 'studio', 'boxing', 'martial arts', 'sports', 'stadium',
    ],
    confidence: 0.9,
  },
  {
    category: MerchantCategory.HEALTH,
    keywords: [
      'clinic', 'hospital', 'medical', 'health', 'doctor', 'pharmacy', 'dental',
      'optical', 'therapy', 'physiotherapy', 'rehab', 'wellness', 'skin care',
      'dermatology', 'pediatric', 'cardiology', 'orthopedic', 'psychiatric',
      'veterinary', 'pet care', 'diagnostic', 'lab', 'imaging',
    ],
    confidence: 0.9,
  },
  {
    category: MerchantCategory.RETAIL,
    keywords: [
      'shop', 'store', 'market', 'mall', 'boutique', 'outlet', 'supermarket',
      'grocery', 'electronics', 'clothing', 'fashion', 'shoes', 'accessories',
      'furniture', 'home', 'decor', 'beauty', 'cosmetics', 'jewelry', 'books',
      'toys', 'sports equipment', 'automotive', 'hardware', 'garden',
    ],
    confidence: 0.85,
  },
  {
    category: MerchantCategory.SALON,
    keywords: [
      'salon', 'spa', 'beauty', 'hair', 'nails', 'makeup', 'skincare', 'waxing',
      'massage', 'esthetics', 'barber', 'grooming', 'tanning', 'body treatments',
      'wellness center', 'medi-spa', 'hair salon', 'nail salon', 'beauty parlor',
    ],
    confidence: 0.9,
  },
  {
    category: MerchantCategory.ENTERTAINMENT,
    keywords: [
      'cinema', 'movie', 'theater', 'theatre', 'concert', 'festival', 'event',
      'museum', 'gallery', 'zoo', 'amusement', 'park', 'arcade', 'bowling',
      'karaoke', 'nightclub', 'lounge', 'gaming', 'esports', 'betting',
    ],
    confidence: 0.85,
  },
  {
    category: MerchantCategory.TRAVEL,
    keywords: [
      'airline', 'airport', 'flight', 'train', 'bus', 'taxi', 'rideshare', 'car rental',
      'travel agency', 'tour', 'cruise', 'vacation', 'holiday', 'booking', 'ticketing',
    ],
    confidence: 0.85,
  },
];

/**
 * Mapping from QR code types to merchant categories
 */
const QR_TYPE_TO_CATEGORY: Record<QRCodeType, MerchantCategory> = {
  [QRCodeType.HOTEL]: MerchantCategory.HOSPITALITY,
  [QRCodeType.RESTAURANT]: MerchantCategory.CULINARY,
  [QRCodeType.GYM]: MerchantCategory.FITNESS,
  [QRCodeType.CLINIC]: MerchantCategory.HEALTH,
  [QRCodeType.RETAIL]: MerchantCategory.RETAIL,
  [QRCodeType.SALON]: MerchantCategory.SALON,
  [QRCodeType.GENERAL]: MerchantCategory.UNKNOWN,
};

/**
 * Mapping from ReZ platforms to merchant categories
 */
const REZ_PLATFORM_TO_CATEGORY: Record<ReZPlatform, MerchantCategory> = {
  [ReZPlatform.WEB_MENU]: MerchantCategory.CULINARY,
  [ReZPlatform.STAY]: MerchantCategory.HOSPITALITY,
  [ReZPlatform.FIT]: MerchantCategory.FITNESS,
  [ReZPlatform.HEALTH]: MerchantCategory.HEALTH,
  [ReZPlatform.GENERAL]: MerchantCategory.UNKNOWN,
};

export interface MerchantDetectionResult {
  category: MerchantCategory;
  confidence: number;
  matchedKeywords: string[];
  source: 'qr_code' | 'platform' | 'name' | 'explicit' | 'default';
}

/**
 * Service for detecting merchant category from various sources
 */
export class MerchantTypeDetector {
  /**
   * Detect merchant category from entry context
   */
  async detect(context: EntryContext): Promise<MerchantDetectionResult> {
    const startTime = Date.now();

    try {
      // Priority 1: Direct from QR code type
      if (context.qrCodeType && context.qrCodeType !== QRCodeType.GENERAL) {
        const category = QR_TYPE_TO_CATEGORY[context.qrCodeType];
        return {
          category,
          confidence: 0.95,
          matchedKeywords: [context.qrCodeType],
          source: 'qr_code',
        };
      }

      // Priority 2: Direct from ReZ platform
      if (context.rePlatform && context.rePlatform !== ReZPlatform.GENERAL) {
        const category = REZ_PLATFORM_TO_CATEGORY[context.rePlatform];
        return {
          category,
          confidence: 0.9,
          matchedKeywords: [context.rePlatform],
          source: 'platform',
        };
      }

      // Priority 3: Detect from merchant name
      if (context.merchantName) {
        const nameResult = this.detectFromMerchantName(context.merchantName);
        if (nameResult.confidence > 0.6) {
          return nameResult;
        }
      }

      // Priority 4: Explicit merchant category from input
      if (context.merchantCategory !== MerchantCategory.UNKNOWN) {
        return {
          category: context.merchantCategory,
          confidence: 1.0,
          matchedKeywords: [],
          source: 'explicit',
        };
      }

      // Default to unknown
      return {
        category: MerchantCategory.UNKNOWN,
        confidence: 0.3,
        matchedKeywords: [],
        source: 'default',
      };
    } finally {
      const processingTime = Date.now() - startTime;
      logger.debug('Merchant type detection completed', {
        sessionId: context.sessionId,
        processingTimeMs: processingTime,
      });
    }
  }

  /**
   * Detect merchant category from merchant name using keyword matching
   */
  private detectFromMerchantName(merchantName: string): MerchantDetectionResult {
    const nameLower = merchantName.toLowerCase();
    const words = nameLower.split(/\s+/);

    let bestMatch: MerchantCategoryRule | null = null;
    let matchedKeywords: string[] = [];

    for (const rule of MERCHANT_CATEGORY_RULES) {
      const matched = rule.keywords.filter((keyword) =>
        nameLower.includes(keyword)
      );

      if (matched.length > matchedKeywords.length) {
        matchedKeywords = matched;
        bestMatch = rule;
      }

      // Also check individual words
      for (const word of words) {
        if (rule.keywords.some((k) => k.includes(word) || word.includes(k))) {
          matchedKeywords.push(word);
        }
      }
    }

    if (bestMatch) {
      // Adjust confidence based on number of matches
      const matchRatio = matchedKeywords.length / bestMatch.keywords.length;
      const confidence = Math.min(bestMatch.confidence * (0.7 + matchRatio * 0.3), 1.0);

      return {
        category: bestMatch.category,
        confidence,
        matchedKeywords: [...new Set(matchedKeywords)],
        source: 'name',
      };
    }

    return {
      category: MerchantCategory.UNKNOWN,
      confidence: 0.2,
      matchedKeywords: [],
      source: 'name',
    };
  }

  /**
   * Detect merchant category from text input (for dynamic detection)
   */
  detectFromText(text: string): MerchantDetectionResult {
    return this.detectFromMerchantName(text);
  }

  /**
   * Get all possible categories for a merchant name (for ambiguity detection)
   */
  getPossibleCategories(merchantName: string): MerchantDetectionResult[] {
    const nameLower = merchantName.toLowerCase();
    const results: MerchantDetectionResult[] = [];

    for (const rule of MERCHANT_CATEGORY_RULES) {
      const matched = rule.keywords.filter((keyword) =>
        nameLower.includes(keyword)
      );

      if (matched.length > 0) {
        results.push({
          category: rule.category,
          confidence: rule.confidence * Math.min(matched.length / 3, 1),
          matchedKeywords: matched,
          source: 'name',
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}

// Export singleton instance
export const merchantTypeDetector = new MerchantTypeDetector();

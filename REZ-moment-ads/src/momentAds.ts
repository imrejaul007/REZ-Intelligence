/**
 * REZ Moment-Based Ad Engine
 *
 * Targets users based on REAL-TIME context:
 * - time
 * - mood
 * - location
 * - activity
 * - urgency
 * - social signals
 *
 * This is what makes REZ different from static ad targeting.
 */

import axios from 'axios';

// ============================================================================
// Configuration
// ============================================================================

const INTENT_SERVICE_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4018';
const GRAPH_SERVICE_URL = process.env.GRAPH_SERVICE_URL || 'http://localhost:4129';
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';

// ============================================================================
// Types
// ============================================================================

export interface MomentContext {
  userId: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  time: {
    hour: number;
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday?: boolean;
    season?: 'spring' | 'summer' | 'monsoon' | 'winter';
  };
  device?: {
    isMobile: boolean;
    appOpen: boolean;
  };
  wallet?: {
    coinBalance: number;
    expiringCoins?: number;
    expiringDate?: string;
  };
  recentSignals?: {
    searches: string[];
    merchantsVisited: string[];
    categories: string[];
  };
}

export interface MomentAd {
  adId: string;
  campaignId: string;
  merchantId: string;
  content: {
    title: string;
    description: string;
    imageUrl?: string;
    cta: string;
  };
  targeting: {
    reason: string;
    confidence: number;
    trigger: MomentTrigger;
  };
  offer?: {
    type: 'discount' | 'cashback' | 'combo' | 'free_delivery';
    value: number;
  };
  displayDuration: number;
  priority: number;
}

export type MomentTrigger =
  | 'time_based'
  | 'location_based'
  | 'intent_based'
  | 'wallet_based'
  | 'social_based'
  | 'urgency_based'
  | 'cross_sell'
  | 'retention';

// ============================================================================
// Moment Rules Engine Types
// ============================================================================

interface MomentRule {
  id: string;
  trigger: MomentTrigger;
  condition: (ctx: MomentContext) => boolean;
  priority: number;
  generate: (ctx: MomentContext) => {
    title: string;
    description: string;
    cta: string;
    targeting: {
      trigger: MomentTrigger;
      reason: string;
      confidence: number;
    };
  };
}

interface UserProfile {
  wallet?: {
    coinBalance: number;
    expiringCoins?: number;
    expiringDate?: string;
  };
}

interface UserSignals {
  searches: string[];
  merchantsVisited: string[];
  categories: string[];
}

interface GeneratedAdContent {
  title: string;
  description: string;
  cta: string;
  targeting: {
    trigger: MomentTrigger;
    reason: string;
    confidence: number;
    priority?: number;
  };
}

// ============================================================================
// Moment Rules Engine
// ============================================================================

class MomentRulesEngine {
  private rules: MomentRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // TIME-BASED RULES
    this.rules.push({
      id: 'breakfast_time',
      trigger: 'time_based',
      condition: (ctx: MomentContext) => ctx.time.hour >= 6 && ctx.time.hour <= 10,
      priority: 80,
      generate: (ctx: MomentContext) => ({
        title: 'Good Morning! ☀️',
        description: 'Start your day with a healthy breakfast nearby',
        cta: 'View Options',
        targeting: { trigger: 'time_based', reason: 'Breakfast time', confidence: 0.9 }
      })
    });

    this.rules.push({
      id: 'lunch_time',
      trigger: 'time_based',
      condition: (ctx: MomentContext) => ctx.time.hour >= 12 && ctx.time.hour <= 14,
      priority: 85,
      generate: (ctx: MomentContext) => ({
        title: 'Lunch Break? 🍽️',
        description: 'Quick lunch options near you',
        cta: 'Order Now',
        targeting: { trigger: 'time_based', reason: 'Lunch time', confidence: 0.95 }
      })
    });

    this.rules.push({
      id: 'evening_snack',
      trigger: 'time_based',
      condition: (ctx: MomentContext) => ctx.time.hour >= 15 && ctx.time.hour <= 17,
      priority: 70,
      generate: (ctx: MomentContext) => ({
        title: 'Snack Time? 🍿',
        description: 'Evening cravings? We have you covered',
        cta: 'Browse Snacks',
        targeting: { trigger: 'time_based', reason: 'Snack time', confidence: 0.85 }
      })
    });

    this.rules.push({
      id: 'dinner_time',
      trigger: 'time_based',
      condition: (ctx: MomentContext) => ctx.time.hour >= 19 && ctx.time.hour <= 21,
      priority: 90,
      generate: (ctx: MomentContext) => ({
        title: 'Dinner Time! 🍕',
        description: 'What are you craving tonight?',
        cta: 'Explore',
        targeting: { trigger: 'time_based', reason: 'Dinner time', confidence: 0.98 }
      })
    });

    // WALLET-BASED RULES
    this.rules.push({
      id: 'expiring_coins',
      trigger: 'wallet_based',
      condition: (ctx: MomentContext) =>
        ctx.wallet?.expiringCoins && ctx.wallet.expiringCoins > 50,
      priority: 95,
      generate: (ctx: MomentContext) => ({
        title: 'Coins Expiring Soon! 💰',
        description: `Use your ${ctx.wallet?.expiringCoins} REZ coins before they expire`,
        cta: 'Redeem Now',
        targeting: {
          trigger: 'wallet_based',
          reason: `${ctx.wallet?.expiringCoins} coins expiring`,
          confidence: 0.95
        }
      })
    });

    this.rules.push({
      id: 'low_balance',
      trigger: 'wallet_based',
      condition: (ctx: MomentContext) =>
        ctx.wallet?.coinBalance && ctx.wallet.coinBalance < 20,
      priority: 60,
      generate: (ctx: MomentContext) => ({
        title: 'Time to Top Up! 💎',
        description: 'Add more REZ coins and earn extra cashback',
        cta: 'Top Up',
        targeting: {
          trigger: 'wallet_based',
          reason: 'Low coin balance',
          confidence: 0.8
        }
      })
    });

    // LOCATION-BASED RULES
    this.rules.push({
      id: 'near_mall',
      trigger: 'location_based',
      condition: (ctx: MomentContext) => this.isNearMall(ctx.location),
      priority: 75,
      generate: (ctx: MomentContext) => ({
        title: 'You\'re at the Mall! 🛍️',
        description: 'Check out these exclusive in-store offers',
        cta: 'View Offers',
        targeting: {
          trigger: 'location_based',
          reason: 'Near mall',
          confidence: 0.85
        }
      })
    });

    // URGENCY RULES
    this.rules.push({
      id: 'leaving_area',
      trigger: 'urgency_based',
      condition: (ctx: MomentContext) =>
        ctx.recentSignals?.merchantsVisited.length === 0,
      priority: 50,
      generate: (ctx: MomentContext) => ({
        title: 'Wait! Special Offer Nearby! ⏰',
        description: 'Don\'t miss out on these deals',
        cta: 'Grab Offer',
        targeting: {
          trigger: 'urgency_based',
          reason: 'Leaving without ordering',
          confidence: 0.7
        }
      })
    });
  }

  evaluate(context: MomentContext): { rule: MomentRule; ad: GeneratedAdContent } | null {
    const matchingRules = this.rules
      .filter(rule => rule.condition(context))
      .sort((a, b) => b.priority - a.priority);

    if (matchingRules.length === 0) return null;

    const bestRule = matchingRules[0];
    const adContent = bestRule.generate(context);

    return {
      rule: bestRule,
      ad: {
        ...adContent,
        targeting: {
          ...adContent.targeting,
          trigger: bestRule.trigger,
          priority: bestRule.priority
        }
      }
    };
  }

  private isNearMall(location: { lat: number; lng: number }): boolean {
    // In production, check against known mall locations
    return false;
  }
}

// ============================================================================
// Moment-Based Ad Engine
// ============================================================================

class MomentAdEngine {
  private rulesEngine: MomentRulesEngine;

  constructor() {
    this.rulesEngine = new MomentRulesEngine();
  }

  /**
   * Get moment-based ad for user
   */
  async getMomentAd(context: MomentContext): Promise<MomentAd | null> {
    // 1. Get user profile for enrichment
    const userProfile = await this.getUserProfile(context.userId) as UserProfile | null;

    // 2. Get behavioral signals
    const signals = (await this.getUserSignals(context.userId)) as UserSignals;

    // 3. Enrich context
    const enrichedContext: MomentContext = {
      ...context,
      wallet: userProfile?.wallet,
      recentSignals: signals ?? { searches: [], merchantsVisited: [], categories: [] }
    };

    // 4. Evaluate moment rules
    const momentResult = this.rulesEngine.evaluate(enrichedContext);

    if (!momentResult) return null;

    // 5. Get relevant ad based on moment
    const momentAd = momentResult.ad;
    const ad = await this.selectAd({
      title: momentAd.title,
      description: momentAd.description,
      cta: momentAd.cta,
      targeting: momentAd.targeting,
      context: enrichedContext
    });

    if (!ad) return null;

    return {
      ...ad,
      targeting: {
        ...ad.targeting,
        confidence: momentAd.targeting.confidence
      }
    };
  }

  /**
   * Get multiple moment ads (for feed)
   */
  async getMomentAds(context: MomentContext, limit = 5): Promise<MomentAd[]> {
    const ads: MomentAd[] = [];

    // Get primary moment ad
    const primaryAd = await this.getMomentAd(context);
    if (primaryAd) ads.push(primaryAd);

    // Get contextual ads
    const contextualAds = await this.getContextualAds(context, limit - ads.length);
    ads.push(...contextualAds);

    // Sort by priority
    return ads.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Trigger ad based on specific moment
   */
  async triggerMoment(
    userId: string,
    momentType: MomentTrigger,
    metadata?: Record<string, unknown>
  ): Promise<MomentAd | null> {
    const location = metadata?.location as { lat: number; lng: number; address?: string } | undefined;
    const context: MomentContext = {
      userId,
      location: location ?? { lat: 0, lng: 0 },
      time: {
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        isWeekend: [0, 6].includes(new Date().getDay())
      }
    };

    return this.getMomentAd(context);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getUserProfile(userId: string): Promise<unknown> {
    try {
      const response = await axios.get(
        `${PROFILE_SERVICE_URL}/api/profiles/${userId}`,
        { timeout: 2000 }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  private async getUserSignals(userId: string): Promise<unknown> {
    try {
      const response = await axios.get(
        `${INTENT_SERVICE_URL}/api/signals/${userId}`,
        { timeout: 2000 }
      );
      return response.data;
    } catch (error) {
      return {
        searches: [],
        merchantsVisited: [],
        categories: []
      };
    }
  }

  private async selectAd(options: {
    title: string;
    description: string;
    cta: string;
    targeting;
    context: MomentContext;
  }): Promise<MomentAd | null> {
    // Get relevant campaign based on targeting
    try {
      const response = await axios.post(
        `${GRAPH_SERVICE_URL}/api/ads/select`,
        {
          context: options.context,
          targeting: options.targeting
        },
        { timeout: 5000 }
      );

      return {
        adId: `ad_${Date.now()}`,
        campaignId: response.data?.campaignId || 'default',
        merchantId: response.data?.merchantId || 'system',
        content: {
          title: options.title,
          description: options.description,
          cta: options.cta
        },
        targeting: options.targeting,
        priority: options.targeting.priority || 50,
        displayDuration: 10
      };
    } catch (error) {
      // Fallback to system ad
      return {
        adId: `ad_${Date.now()}`,
        campaignId: 'system_moment',
        merchantId: 'system',
        content: {
          title: options.title,
          description: options.description,
          cta: options.cta
        },
        targeting: options.targeting,
        priority: options.targeting.priority || 50,
        displayDuration: 10
      };
    }
  }

  private async getContextualAds(
    context: MomentContext,
    limit: number
  ): Promise<MomentAd[]> {
    // Return contextual ads based on time/location
    const ads: MomentAd[] = [];

    // Time-based contextual
    if (context.time.hour >= 19 && context.time.hour <= 22) {
      ads.push({
        adId: `ctx_${Date.now()}_1`,
        campaignId: 'evening_deals',
        merchantId: 'system',
        content: {
          title: 'Late Night Deals 🌙',
          description: 'Extended hours, special pricing',
          cta: 'Browse'
        },
        targeting: {
          trigger: 'time_based',
          reason: 'Late evening',
          confidence: 0.7
        },
        priority: 40,
        displayDuration: 8
      });
    }

    return ads.slice(0, limit);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const momentAdEngine = new MomentAdEngine();
export default momentAdEngine;

/**
 * Moment Trigger Integration
 *
 * Connects all existing services to create moment-based targeting:
 * - Location triggers (from buzzlocal-merchant-offer-service)
 * - Lifecycle triggers (from REZ-birthday-rewards, REZ-anniversary-rewards)
 * - Loyalty triggers (from REZ-gamification-service)
 * - Behavioral triggers (from REZ-signal-aggregator)
 * - Predictive triggers (from REZ-predictive-engine)
 *
 * This creates the "moment engine" described in the strategy.
 */

import { logger } from '../config/logger';

// Service URLs
const DECISION_SERVICE_URL = process.env.DECISION_SERVICE_URL || 'http://localhost:4007';
const PREDICTIVE_SERVICE_URL = process.env.PREDICTIVE_SERVICE_URL || 'http://localhost:4141';
const SIGNAL_AGGREGATOR_URL = process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4142';
const LOYALTY_SERVICE_URL = process.env.LOYALTY_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

export interface UserContext {
  userId: string;
  location?: { lat: number; lng: number };
  time: Date;
  device?: string;
}

export interface MomentTrigger {
  id: string;
  type: MomentType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  data: Record<string, unknown>;
  offers: MomentOffer[];
  ads: MomentAd[];
  notification?: MomentNotification;
  expiresAt: Date;
}

export type MomentType =
  | 'coin_expiry'
  | 'streak_risk'
  | 'birthday'
  | 'anniversary'
  | 'churn_risk'
  | 'nearby_merchant'
  | 'category_intent'
  | 'cross_sell_opportunity'
  | 'high_spender_nearby'
  | 'weather_trigger'
  | 'payday_trigger'
  | 'inactivity';

export interface MomentOffer {
  merchantId: string;
  merchantName: string;
  offerType: string;
  cashback: number;
  coins: number;
  discount: number;
  reason: string;
}

export interface MomentAd {
  campaignId: string;
  merchantId: string;
  targetingReason: string;
  bidAmount: number;
  adContent: {
    headline: string;
    image: string;
    cta: string;
  };
}

export interface MomentNotification {
  channel: 'push' | 'sms' | 'whatsapp' | 'email';
  title: string;
  message: string;
  data: Record<string, unknown>;
}

// ============================================
// MOMENT ENGINE
// ============================================

export class MomentEngine {
  /**
   * Get all moment triggers for a user
   */
  async getMomentsForUser(userId: string, location?: { lat: number; lng: number }): Promise<MomentTrigger[]> {
    const moments: MomentTrigger[] = [];
    const now = new Date();

    // 1. Get loyalty triggers (coins, streak)
    const loyaltyTriggers = await this.getLoyaltyTriggers(userId);
    moments.push(...loyaltyTriggers);

    // 2. Get lifecycle triggers (birthday, anniversary)
    const lifecycleTriggers = await this.getLifecycleTriggers(userId);
    moments.push(...lifecycleTriggers);

    // 3. Get predictive triggers (churn, spend)
    const predictiveTriggers = await this.getPredictiveTriggers(userId);
    moments.push(...predictiveTriggers);

    // 4. Get location triggers (nearby merchants)
    if (location) {
      const locationTriggers = await this.getLocationTriggers(userId, location);
      moments.push(...locationTriggers);
    }

    // 5. Get behavioral triggers (intent signals)
    const behavioralTriggers = await this.getBehavioralTriggers(userId);
    moments.push(...behavioralTriggers);

    // Sort by priority
    moments.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    logger.info(`Found ${moments.length} moments for user ${userId}`);

    return moments;
  }

  /**
   * Get loyalty-based triggers
   */
  private async getLoyaltyTriggers(userId: string): Promise<MomentTrigger[]> {
    const triggers: MomentTrigger[] = [];

    try {
      // Get wallet balance and expiring coins
      const walletResponse = await fetch(`${LOYALTY_SERVICE_URL}/api/wallet/${userId}/balance`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN }
      });

      if (walletResponse.ok) {
        const wallet = await walletResponse.json();

        // Coin expiry trigger
        if (wallet.expiringCoins > 0) {
          const daysUntilExpiry = wallet.coinExpiryDate
            ? Math.ceil((new Date(wallet.coinExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : 7;

          triggers.push({
            id: `coin_expiry_${userId}_${Date.now()}`,
            type: 'coin_expiry',
            priority: daysUntilExpiry <= 3 ? 'critical' : daysUntilExpiry <= 7 ? 'high' : 'medium',
            userId,
            data: {
              expiringCoins: wallet.expiringCoins,
              totalCoins: wallet.balance,
              daysUntilExpiry
            },
            offers: [{
              merchantId: 'unknown',
              merchantName: 'Any Merchant',
              offerType: 'coin_multiplier',
              cashback: 0,
              coins: Math.floor(wallet.expiringCoins * 0.5),
              discount: 0,
              reason: `Use your ${wallet.expiringCoins} expiring coins within ${daysUntilExpiry} days!`
            }],
            ads: [],
            notification: {
              channel: 'push',
              title: 'Coins Expiring Soon!',
              message: `You have ${wallet.expiringCoins} coins expiring in ${daysUntilExpiry} days. Use them now!`,
              data: { expiringCoins: wallet.expiringCoins, daysUntilExpiry }
            },
            expiresAt: new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000)
          });
        }

        // Streak risk trigger
        if (wallet.streak >= 5 && wallet.streakRisk) {
          triggers.push({
            id: `streak_risk_${userId}_${Date.now()}`,
            type: 'streak_risk',
            priority: 'high',
            userId,
            data: {
              streak: wallet.streak,
              riskLevel: wallet.streakRisk
            },
            offers: [{
              merchantId: 'unknown',
              merchantName: 'Favorite Merchant',
              offerType: 'streak_booster',
              cashback: 10,
              coins: 20,
              discount: 0,
              reason: `Don't lose your ${wallet.streak}-day streak!`
            }],
            ads: [],
            notification: {
              channel: 'push',
              title: 'Streak at Risk!',
              message: `Your ${wallet.streak}-day streak is about to break. Visit a merchant today to keep it!`,
              data: { streak: wallet.streak }
            },
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to get loyalty triggers', { error, userId });
    }

    return triggers;
  }

  /**
   * Get lifecycle-based triggers
   */
  private async getLifecycleTriggers(userId: string): Promise<MomentTrigger[]> {
    const triggers: MomentTrigger[] = [];

    try {
      // Get birthday info
      const birthdayResponse = await fetch(`${LOYALTY_SERVICE_URL}/api/lifecycle/${userId}/birthday`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN }
      });

      if (birthdayResponse.ok) {
        const birthday = await birthdayResponse.json();

        if (birthday.daysUntilBirthday !== undefined && birthday.daysUntilBirthday <= 7) {
          triggers.push({
            id: `birthday_${userId}_${Date.now()}`,
            type: 'birthday',
            priority: birthday.daysUntilBirthday <= 1 ? 'critical' : 'high',
            userId,
            data: {
              daysUntil: birthday.daysUntilBirthday,
              tier: birthday.tier
            },
            offers: [{
              merchantId: 'unknown',
              merchantName: 'Birthday Partner',
              offerType: 'birthday_bonus',
              cashback: birthday.tier === 'platinum' ? 25 : birthday.tier === 'gold' ? 20 : 15,
              coins: birthday.tier === 'platinum' ? 100 : 50,
              discount: birthday.tier === 'platinum' ? 10 : 0,
              reason: `Happy Birthday! Enjoy ${birthday.tier === 'platinum' ? '10% off + 25% cashback' : 'special birthday rewards'}!`
            }],
            ads: [],
            notification: {
              channel: birthday.daysUntilBirthday <= 1 ? 'push' : 'email',
              title: 'Happy Birthday! 🎂',
              message: birthday.daysUntilBirthday === 0
                ? 'Happy Birthday! Claim your special birthday rewards today!'
                : `Your birthday is in ${birthday.daysUntilBirthday} days! Prepare to celebrate with special rewards.`,
              data: { daysUntil: birthday.daysUntilBirthday }
            },
            expiresAt: new Date(Date.now() + (birthday.daysUntilBirthday + 1) * 24 * 60 * 60 * 1000)
          });
        }
      }

      // Get anniversary info
      const anniversaryResponse = await fetch(`${LOYALTY_SERVICE_URL}/api/lifecycle/${userId}/anniversary`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN }
      });

      if (anniversaryResponse.ok) {
        const anniversary = await anniversaryResponse.json();

        if (anniversary.daysUntilAnniversary !== undefined && anniversary.daysUntilAnniversary <= 7) {
          triggers.push({
            id: `anniversary_${userId}_${Date.now()}`,
            type: 'anniversary',
            priority: anniversary.daysUntilAnniversary <= 1 ? 'high' : 'medium',
            userId,
            data: {
              daysUntil: anniversary.daysUntilAnniversary,
              years: anniversary.years
            },
            offers: [{
              merchantId: 'unknown',
              merchantName: 'Loyalty Partner',
              offerType: 'anniversary_bonus',
              cashback: Math.min(10 + anniversary.years * 2, 25),
              coins: anniversary.years * 25,
              discount: anniversary.years >= 3 ? 5 : 0,
              reason: `Celebrating ${anniversary.years} years with us!`
            }],
            ads: [],
            notification: {
              channel: anniversary.daysUntilAnniversary <= 1 ? 'push' : 'email',
              title: '🎉 Anniversary Coming Up!',
              message: `Your ${anniversary.years}-year anniversary is in ${anniversary.daysUntilAnniversary} days!`,
              data: { years: anniversary.years }
            },
            expiresAt: new Date(Date.now() + (anniversary.daysUntilAnniversary + 1) * 24 * 60 * 60 * 1000)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to get lifecycle triggers', { error, userId });
    }

    return triggers;
  }

  /**
   * Get predictive triggers (churn, spend probability)
   */
  private async getPredictiveTriggers(userId: string): Promise<MomentTrigger[]> {
    const triggers: MomentTrigger[] = [];

    try {
      // Get predictions
      const predResponse = await fetch(`${PREDICTIVE_SERVICE_URL}/api/predict/${userId}`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN }
      });

      if (predResponse.ok) {
        const predictions = await predResponse.json();

        // Churn risk trigger
        if (predictions.churnRisk > 0.6) {
          triggers.push({
            id: `churn_risk_${userId}_${Date.now()}`,
            type: 'churn_risk',
            priority: predictions.churnRisk > 0.8 ? 'critical' : 'high',
            userId,
            data: {
              risk: predictions.churnRisk,
              reason: predictions.churnReason
            },
            offers: [{
              merchantId: 'unknown',
              merchantName: 'Come Back Special',
              offerType: 'retention_offer',
              cashback: Math.round(predictions.churnRisk * 15),
              coins: 100,
              discount: 5,
              reason: 'We miss you! Here\'s a special offer to welcome you back.'
            }],
            ads: [],
            notification: {
              channel: 'push',
              title: 'We Miss You!',
              message: `It's been a while since your last visit. Here\'s a special offer just for you!`,
              data: { churnRisk: predictions.churnRisk }
            },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          });
        }

        // High spend opportunity
        if (predictions.spendProbability > 0.8 && predictions.avgBill > 500) {
          triggers.push({
            id: `high_spender_${userId}_${Date.now()}`,
            type: 'high_spender_nearby',
            priority: 'medium',
            userId,
            data: {
              avgBill: predictions.avgBill,
              tier: predictions.tier
            },
            offers: [{
              merchantId: 'unknown',
              merchantName: 'Premium Partner',
              offerType: 'premium_exclusive',
              cashback: 15,
              coins: 50,
              discount: 10,
              reason: 'As a premium customer, enjoy exclusive offers!'
            }],
            ads: [{
              campaignId: `premium_${userId}`,
              merchantId: 'premium_partners',
              targetingReason: 'High-value customer with high spend probability',
              bidAmount: predictions.avgBill * 0.1,
              adContent: {
                headline: 'Exclusive Offer for You!',
                image: '/images/premium-offer.jpg',
                cta: 'Claim Now'
              }
            }],
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to get predictive triggers', { error, userId });
    }

    return triggers;
  }

  /**
   * Get location-based triggers
   */
  private async getLocationTriggers(
    userId: string,
    location: { lat: number; lng: number }
  ): Promise<MomentTrigger[]> {
    const triggers: MomentTrigger[] = [];

    try {
      // Get nearby merchants with offers
      const nearbyResponse = await fetch(
        `${DECISION_SERVICE_URL}/api/merchants/nearby?lat=${location.lat}&lng=${location.lng}&radius=5`,
        {
          headers: { 'X-Internal-Token': INTERNAL_TOKEN }
        }
      );

      if (nearbyResponse.ok) {
        const nearby = await nearbyResponse.json();

        for (const merchant of nearby.merchants?.slice(0, 3) || []) {
          if (merchant.activeOffers > 0) {
            triggers.push({
              id: `nearby_${merchant.merchantId}_${userId}_${Date.now()}`,
              type: 'nearby_merchant',
              priority: 'low',
              userId,
              data: {
                merchantId: merchant.merchantId,
                merchantName: merchant.name,
                distance: merchant.distance,
                category: merchant.category
              },
              offers: [{
                merchantId: merchant.merchantId,
                merchantName: merchant.name,
                offerType: 'location_trigger',
                cashback: merchant.avgCashback || 10,
                coins: merchant.avgCoins || 10,
                discount: merchant.avgDiscount || 0,
                reason: `${merchant.name} is ${Math.round(merchant.distance * 1000)}m away with active offers!`
              }],
              ads: [{
                campaignId: `nearby_${merchant.merchantId}`,
                merchantId: merchant.merchantId,
                targetingReason: `User is ${Math.round(merchant.distance * 1000)}m from merchant`,
                bidAmount: 0.5,
                adContent: {
                  headline: `${merchant.name} - ${merchant.avgCashback || 10}% Cashback!`,
                  image: merchant.bannerImage,
                  cta: 'Get Offer'
                }
              }],
              expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to get location triggers', { error, userId });
    }

    return triggers;
  }

  /**
   * Get behavioral triggers (intent signals)
   */
  private async getBehavioralTriggers(userId: string): Promise<MomentTrigger[]> {
    const triggers: MomentTrigger[] = [];

    try {
      // Get user signals
      const signalsResponse = await fetch(`${SIGNAL_AGGREGATOR_URL}/api/signals/${userId}/recent`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN }
      });

      if (signalsResponse.ok) {
        const signals = await signalsResponse.json();

        // Category intent trigger
        if (signals.categoryIntents?.length > 0) {
          const topIntent = signals.categoryIntents[0];

          triggers.push({
            id: `category_intent_${userId}_${Date.now()}`,
            type: 'category_intent',
            priority: topIntent.confidence > 0.8 ? 'high' : 'medium',
            userId,
            data: {
              category: topIntent.category,
              confidence: topIntent.confidence,
              signals: topIntent.signals
            },
            offers: [{
              merchantId: 'unknown',
              merchantName: `${topIntent.category} Partners`,
              offerType: 'intent_match',
              cashback: 10,
              coins: 15,
              discount: 5,
              reason: `We noticed you're interested in ${topIntent.category}. Here\'s a special offer!`
            }],
            ads: [],
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          });
        }

        // Cross-sell opportunity
        if (signals.crossSellOpportunities?.length > 0) {
          for (const opp of signals.crossSellOpportunities.slice(0, 2)) {
            triggers.push({
              id: `cross_sell_${opp.toCategory}_${userId}_${Date.now()}`,
              type: 'cross_sell_opportunity',
              priority: opp.confidence > 0.7 ? 'medium' : 'low',
              userId,
              data: {
                fromCategory: opp.fromCategory,
                toCategory: opp.toCategory,
                reason: opp.reason
              },
              offers: [{
                merchantId: 'unknown',
                merchantName: `${opp.toCategory} Merchants`,
                offerType: 'cross_sell',
                cashback: 15,
                coins: 20,
                discount: opp.toCategory === opp.fromCategory ? 0 : 5,
                reason: opp.reason
              }],
              ads: [{
                campaignId: `cross_sell_${opp.toCategory}`,
                merchantId: 'cross_sell_partners',
                targetingReason: opp.reason,
                bidAmount: 0.75,
                adContent: {
                  headline: `Try ${opp.toCategory} - Customers love it!`,
                  image: '/images/cross-sell.jpg',
                  cta: 'Explore'
                }
              }],
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to get behavioral triggers', { error, userId });
    }

    return triggers;
  }
}

// ============================================
// EXPORTS
// ============================================

export const momentEngine = new MomentEngine();

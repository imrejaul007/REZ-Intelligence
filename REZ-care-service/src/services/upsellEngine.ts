/**
 * REZ Care Service - Upsell & Cross-Sell Engine (MongoDB Version)
 *
 * Offers relevant products/services during support interactions:
 * - Context-aware recommendations
 * - Problem → Solution → Upsell
 * - Subscription upgrades
 * - Premium support options
 * - Complementary products
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { serviceConnector } from './serviceConnector';
import { UpsellOffer as UpsellOfferModel, IUpsellOffer } from '../models/UpsellOffer';

export interface UpsellOffer {
  id: string;
  type: 'upsell' | 'cross_sell' | 'addon' | 'subscription' | 'premium';
  title: string;
  description: string;
  offer: string;
  originalPrice?: number;
  discountedPrice?: number;
  discount?: number;
  productId?: string;
  serviceId?: string;
  cta: string;
  reason: string;
  relevance: number;
}

export interface UpsellContext {
  customerId: string;
  category: string;
  orderId?: string;
  productId?: string;
  merchantId?: string;
  platform: string;
  conversationHistory?: string[];
}

interface TrackedOffer {
  id: string;
  customerId: string;
  type: string;
  platform: string;
  context: string;
  relevance: number;
}

/**
 * Upsell Engine with MongoDB persistence
 */
class UpsellEngine {
  private recentlyShown: Map<string, { offers: string[]; timestamp: number }> = new Map();
  private readonly SHOWN_COOLDOWN = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate upsell offers based on context
   */
  async getOffers(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    // 1. CATEGORY-BASED OFFERS
    const categoryOffers = this.getCategoryOffers(context);
    offers.push(...categoryOffers);

    // 2. CONTEXT-BASED OFFERS (from ML services)
    const contextOffers = await this.getContextOffers(context);
    offers.push(...contextOffers);

    // 3. LOYALTY-BASED OFFERS
    const loyaltyOffers = await this.getLoyaltyOffers(context);
    offers.push(...loyaltyOffers);

    // Sort by relevance and return top 3
    const topOffers = offers
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);

    // Track shown offers in MongoDB
    await this.trackOffersInDB(topOffers, context);

    return topOffers;
  }

  /**
   * Track offers in MongoDB for analytics
   */
  private async trackOffersInDB(offers: UpsellOffer[], context: UpsellContext): Promise<void> {
    try {
      const offerIds = offers.map(o => o.id);

      for (const offer of offers) {
        const trackedOffer = new UpsellOfferModel({
          offerId: offer.id,
          customerId: context.customerId,
          merchantId: context.merchantId,
          type: offer.type,
          title: offer.title,
          description: offer.description,
          offer: offer.offer,
          originalPrice: offer.originalPrice,
          discountedPrice: offer.discountedPrice,
          discount: offer.discount,
          productId: context.productId,
          serviceId: offer.serviceId,
          cta: offer.cta,
          reason: offer.reason,
          relevance: offer.relevance,
          platform: context.platform,
          context: context.category,
          status: 'active',
          conversions: [{
            action: 'shown',
            timestamp: new Date()
          }],
          revenue: 0,
        });

        await trackedOffer.save().catch(() => {
          // MongoDB not available, skip persistence
        });
      }

      // Track in memory for cooldown
      this.recentlyShown.set(context.customerId, {
        offers: offerIds,
        timestamp: Date.now()
      });
    } catch {
      // MongoDB not available, continue without persistence
    }
  }

  /**
   * Category-based offers (rule-based, always available)
   */
  private getCategoryOffers(context: UpsellContext): UpsellOffer[] {
    const offers: UpsellOffer[] = [];
    const lowerCategory = context.category.toLowerCase();

    // PAYMENT issues → Premium payment protection
    if (lowerCategory.includes('payment') || lowerCategory.includes('refund')) {
      offers.push({
        id: 'upsell_payment_protect',
        type: 'addon',
        title: 'Payment Protection Plan',
        description: 'Never worry about failed payments again',
        offer: '₹99/month - Unlimited retries, auto-retry on failure',
        discountedPrice: 99,
        cta: 'Add Protection',
        reason: 'Customer had payment issues - offer security',
        relevance: 0.9,
      });
    }

    // DELIVERY issues → Premium delivery
    if (lowerCategory.includes('delivery') || lowerCategory.includes('shipping')) {
      offers.push({
        id: 'upsell_priority_delivery',
        type: 'upsell',
        title: 'Priority Delivery',
        description: 'Get your orders 2x faster',
        offer: '₹199/month - Priority processing + free expedited shipping',
        discountedPrice: 199,
        cta: 'Upgrade to Priority',
        reason: 'Customer complained about delivery - offer faster option',
        relevance: 0.85,
      });
    }

    // ORDER issues → Order protection
    if (lowerCategory.includes('order') || lowerCategory.includes('missing')) {
      offers.push({
        id: 'upsell_order_protect',
        type: 'addon',
        title: 'Order Guarantee',
        description: 'Instant resolution for missing/wrong items',
        offer: '₹49/month - Auto-refund if wrong/missing',
        discountedPrice: 49,
        cta: 'Add Guarantee',
        reason: 'Order issue - offer protection plan',
        relevance: 0.8,
      });
    }

    // TECHNICAL issues → Premium support
    if (lowerCategory.includes('technical') || lowerCategory.includes('bug') || lowerCategory.includes('error')) {
      offers.push({
        id: 'upsell_premium_support',
        type: 'subscription',
        title: 'Premium Support',
        description: '24/7 dedicated support with faster response',
        offer: '₹299/month - Priority queue, dedicated agent, phone support',
        discountedPrice: 299,
        cta: 'Get Premium Support',
        reason: 'Technical issues - offer premium support',
        relevance: 0.75,
      });
    }

    // GENERAL → Loyalty upgrade (always shown)
    offers.push({
      id: 'upsell_prime',
      type: 'subscription',
      title: 'REZ Prime Membership',
      description: 'Free delivery, exclusive deals, priority support',
      offer: '₹499/year - Save ₹2000+ annually',
      originalPrice: 699,
      discountedPrice: 499,
      discount: 29,
      cta: 'Become a Member',
      reason: 'Engaged customer - offer loyalty benefits',
      relevance: 0.5,
    });

    return offers;
  }

  /**
   * Context-based offers using ML
   */
  private async getContextOffers(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    try {
      // Get LTV to personalize offers
      const ltvData = await serviceConnector.getLTV(context.customerId);
      const ltv = ltvData?.ltv || 0;

      // High-value customer → Premium offerings
      if (ltv > 50000) {
        offers.push({
          id: 'upsell_concierge',
          type: 'subscription',
          title: 'Personal Concierge',
          description: 'Dedicated relationship manager for VIP customers',
          offer: '₹1999/month - Personal shopping assistant, exclusive access',
          discountedPrice: 1999,
          cta: 'Get Concierge Service',
          reason: `VIP customer (LTV: ₹${ltv}) - offer premium service`,
          relevance: 0.7,
        });
      }

      // Check churn risk
      const churnData = await serviceConnector.getChurnRisk(context.customerId);
      const churnRisk = churnData?.risk || 0;

      // High churn risk → Retention offers
      if (churnRisk > 0.6) {
        offers.push({
          id: 'upsell_loyalty',
          type: 'subscription',
          title: 'Loyalty Rewards+',
          description: 'Double points, birthday bonuses, exclusive access',
          offer: 'FREE upgrade - Stay with us and earn more',
          cta: 'Join Loyalty+',
          reason: `High churn risk (${Math.round(churnRisk * 100)}%) - retention offer`,
          relevance: 0.9,
        });
      }
    } catch {
      // ML services unavailable, continue with basic offers
    }

    // PRODUCT-BASED cross-sells
    if (context.productId) {
      const productOffers = this.getProductCrossSells(context);
      offers.push(...productOffers);
    }

    return offers;
  }

  /**
   * Product cross-sells
   */
  private getProductCrossSells(context: UpsellContext): UpsellOffer[] {
    const offers: UpsellOffer[] = [];
    const lowerCategory = context.category.toLowerCase();

    const addonMap: Record<string, UpsellOffer> = {
      electronics: {
        id: 'cross_sell_warranty',
        type: 'addon',
        title: 'Extended Warranty',
        description: '2-year extended protection plan',
        offer: '₹299 - Cover accidental damage, defects',
        discountedPrice: 299,
        cta: 'Add Warranty',
        reason: 'Electronics purchase - offer protection',
        relevance: 0.7,
      },
      clothing: {
        id: 'cross_sell_styling',
        type: 'addon',
        title: 'Personal Styling',
        description: 'Free personal stylist consultation',
        offer: '₹0 with this order - Get style advice',
        discountedPrice: 0,
        cta: 'Get Styling Help',
        reason: 'Clothing purchase - offer styling',
        relevance: 0.6,
      },
      food: {
        id: 'cross_sell_subscription',
        type: 'subscription',
        title: 'Food Subscription',
        description: 'Weekly meal plans delivered',
        offer: '₹999/week - Save 20% on every order',
        discountedPrice: 999,
        discount: 20,
        cta: 'Start Subscription',
        reason: 'Food order - offer subscription',
        relevance: 0.65,
      },
    };

    for (const [category, offer] of Object.entries(addonMap)) {
      if (lowerCategory.includes(category)) {
        offers.push(offer);
      }
    }

    return offers;
  }

  /**
   * Loyalty-based offers
   */
  private async getLoyaltyOffers(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    // First-time customer → Welcome offer
    offers.push({
      id: 'upsell_first_month',
      type: 'subscription',
      title: 'First Month Premium FREE',
      description: 'Try all premium features free for 30 days',
      offer: 'FREE - No credit card required',
      cta: 'Start Free Trial',
      reason: 'New engagement opportunity',
      relevance: 0.4,
    });

    return offers;
  }

  /**
   * Generate upsell message
   */
  generateUpsellMessage(offers: UpsellOffer[]): string {
    if (offers.length === 0) return '';

    const topOffer = offers[0];

    let message = '\n\n━━━━━ SPECIAL OFFER ━━━━━\n';
    message += `${topOffer.title}\n`;
    message += `${topOffer.description}\n`;
    message += `${topOffer.offer}\n`;
    message += `${topOffer.cta}\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━━';

    return message;
  }

  /**
   * Track conversion (click, accept, reject)
   */
  async trackConversion(
    event: 'clicked' | 'accepted' | 'rejected',
    customerId: string,
    offerId: string
  ): Promise<void> {
    try {
      // Update in MongoDB
      const updateAction = event === 'clicked' ? 'clicked'
        : event === 'accepted' ? 'accepted'
        : 'rejected';

      await UpsellOfferModel.updateOne(
        { customerId, 'conversions.action': 'shown' },
        {
          $push: {
            conversions: { action: updateAction, timestamp: new Date() }
          },
          $inc: {
            revenue: event === 'accepted' ? 1 : 0
          }
        }
      ).catch(() => {
        // MongoDB not available
      });
    } catch {
      // Error tracking conversion
    }
  }

  /**
   * Get offer analytics
   */
  async getOfferAnalytics(offerId?: string): Promise<{
    totalShown: number;
    totalClicked: number;
    totalAccepted: number;
    conversionRate: number;
    revenue: number;
  }> {
    try {
      const query = offerId ? { offerId } : {};

      const offers = await UpsellOfferModel.find(query);
      let totalShown = 0;
      let totalClicked = 0;
      let totalAccepted = 0;
      let revenue = 0;

      for (const offer of offers) {
        for (const conv of offer.conversions) {
          if (conv.action === 'shown') totalShown++;
          else if (conv.action === 'clicked') totalClicked++;
          else if (conv.action === 'accepted') {
            totalAccepted++;
            revenue += offer.discountedPrice || 0;
          }
        }
      }

      return {
        totalShown,
        totalClicked,
        totalAccepted,
        conversionRate: totalShown > 0 ? (totalAccepted / totalShown) * 100 : 0,
        revenue
      };
    } catch {
      return {
        totalShown: 0,
        totalClicked: 0,
        totalAccepted: 0,
        conversionRate: 0,
        revenue: 0
      };
    }
  }

  /**
   * Get top performing offers
   */
  async getTopOffers(limit: number = 10): Promise<Array<{
    offerId: string;
    title: string;
    conversions: number;
    revenue: number;
  }>> {
    try {
      const offers = await UpsellOfferModel.aggregate([
        { $unwind: '$conversions' },
        { $match: { 'conversions.action': 'accepted' } },
        {
          $group: {
            _id: '$offerId',
            title: { $first: '$title' },
            conversions: { $sum: 1 },
            revenue: { $sum: '$discountedPrice' }
          }
        },
        { $sort: { conversions: -1 } },
        { $limit: limit }
      ]);

      return offers.map(o => ({
        offerId: o._id,
        title: o.title,
        conversions: o.conversions,
        revenue: o.revenue
      }));
    } catch {
      return [];
    }
  }
}

// Export singleton
export const upsellEngine = new UpsellEngine();

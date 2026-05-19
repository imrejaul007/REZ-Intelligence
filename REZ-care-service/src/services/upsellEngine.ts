/**
 * REZ Care Service - Upsell & Cross-Sell Engine
 *
 * Offers relevant products/services during support interactions:
 * - Context-aware recommendations
 * - Problem → Solution → Upsell
 * - Subscription upgrades
 * - Premium support options
 * - Complementary products
 */

import { logger } from '../utils/logger';
import { serviceConnector } from './serviceConnector';

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
  relevance: number; // 0-1
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

/**
 * Upsell Engine
 */
class UpsellEngine {
  /**
   * Generate upsell offers based on context
   */
  async getOffers(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    // 1. CATEGORY-BASED OFFERS
    const categoryOffers = this.getCategoryOffers(context);
    offers.push(...categoryOffers);

    // 2. CONTEXT-BASED OFFERS
    const contextOffers = await this.getContextOffers(context);
    offers.push(...contextOffers);

    // 3. LOYALTY-BASED OFFERS
    const loyaltyOffers = await this.getLoyaltyOffers(context);
    offers.push(...loyaltyOffers);

    // Sort by relevance and return top 3
    return offers
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);
  }

  /**
   * Category-based offers
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

    // GENERAL → Loyalty upgrade
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
          reason: 'VIP customer (LTV: ₹' + ltv + ') - offer premium service',
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
          reason: 'High churn risk (' + Math.round(churnRisk * 100) + '%) - retention offer',
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

    // Add-ons based on category
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

    // Match category to offer
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
    message += `🎁 ${topOffer.title}\n`;
    message += `${topOffer.description}\n`;
    message += `➡️ ${topOffer.offer}\n`;
    message += `📞 ${topOffer.cta}\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━━';

    if (offers.length > 1) {
      message += '\n\nOr choose:';
      offers.slice(1).forEach((offer, i) => {
        message += `\n${i + 2}. ${offer.title} - ${offer.cta}`;
      });
    }

    return message;
  }

  /**
   * Track upsell conversion
   */
  async trackConversion(offerId: string, customerId: string, action: 'shown' | 'clicked' | 'accepted' | 'declined'): Promise<void> {
    logger.info('[Upsell] Conversion tracked', { offerId, customerId, action });

    try {
      await serviceConnector.trackAttribution(customerId, `upsell_${action}`, offerId === 'accepted' ? 1 : 0);
    } catch {
      // Attribution tracking failed silently
    }
  }
}

export const upsellEngine = new UpsellEngine();

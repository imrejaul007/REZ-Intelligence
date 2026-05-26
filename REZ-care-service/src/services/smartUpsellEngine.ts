/**
 * REZ Care Service - Smart Upsell Engine
 *
 * Provides intelligent upsell/cross-sell during support:
 * - Product upgrades
 * - Complementary products
 * - Accessories
 * - Premium alternatives
 * - New arrivals
 * - Related products
 */

import { logger } from '../utils/logger.js';
import { serviceConnector } from './serviceConnector';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image?: string;
  description?: string;
  rating?: number;
  reviews?: number;
}

export interface UpsellOffer {
  id: string;
  type: 'upgrade' | 'accessory' | 'complementary' | 'premium' | 'new' | 'subscription';
  title: string;
  description: string;
  product: Product;
  savings?: number;
  reason: string;
  confidence: number; // 0-1
}

export interface UpsellContext {
  customerId: string;
  orderId?: string;
  productId?: string;
  category?: string;
  merchantId?: string;
  conversation?: string[];
  issueCategory?: string;
}

/**
 * Smart Upsell Engine
 */
class SmartUpsellEngine {
  /**
   * Mock catalog for demo (when RABTUL Catalog unavailable)
   */
  private mockCatalog: Record<string, Product[]> = {
    phone: [
      { id: 'phone_pro', name: 'iPhone 15 Pro', category: 'phone', price: 99999, description: 'Latest flagship', rating: 4.8 },
      { id: 'phone_plus', name: 'Samsung S24 Ultra', category: 'phone', price: 89999, description: 'Android flagship', rating: 4.7 },
    ],
    laptop: [
      { id: 'laptop_pro', name: 'MacBook Pro 16"', category: 'laptop', price: 249999, description: 'Professional laptop', rating: 4.9 },
      { id: 'laptop_ultrabook', name: 'Dell XPS 15', category: 'laptop', price: 149999, description: 'Premium ultrabook', rating: 4.6 },
    ],
    headphones: [
      { id: 'hd_premium', name: 'Sony WH-1000XM5', category: 'headphones', price: 29999, description: 'Best noise canceling', rating: 4.8 },
    ],
    shoes: [
      { id: 'shoe_premium', name: 'Nike Air Max', category: 'shoes', price: 8999, description: 'Premium sneakers', rating: 4.6 },
    ],
  };

  private mockAccessories: Record<string, Product[]> = {
    phone: [
      { id: 'acc_case', name: 'Premium Phone Case', category: 'accessory', price: 999, description: 'Protective + stylish' },
      { id: 'acc_charger', name: 'Fast Charger', category: 'accessory', price: 799, description: 'Quick charge' },
      { id: 'acc_bank', name: 'Power Bank 20000mAh', category: 'accessory', price: 1499, description: 'Extra power' },
    ],
    laptop: [
      { id: 'acc_bag', name: 'Laptop Backpack', category: 'accessory', price: 1999, description: 'Waterproof + padded' },
      { id: 'acc_mouse', name: 'Wireless Mouse', category: 'accessory', price: 999, description: 'Ergonomic design' },
    ],
  };
  /**
   * Get all upsell opportunities for a context
   */
  async getUpsells(context: UpsellContext): Promise<{
    upgrades: UpsellOffer[];
    accessories: UpsellOffer[];
    complementary: UpsellOffer[];
    premium: UpsellOffer[];
    newArrivals: UpsellOffer[];
  }> {
    const [upgrades, accessories, complementary, premium, newArrivals] = await Promise.all([
      this.getUpgrades(context),
      this.getAccessories(context),
      this.getComplementary(context),
      this.getPremium(context),
      this.getNewArrivals(context),
    ]);

    return { upgrades, accessories, complementary, premium, newArrivals };
  }

  /**
   * Get product upgrades
   */
  private async getUpgrades(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    try {
      // Get current product
      let currentProduct: Product | null = null;
      if (context.productId) {
        const result = await serviceConnector.getProduct(context.productId) as { product?: unknown; error?: string };
        currentProduct = result?.product as Product | undefined || null;
      } else if (context.orderId) {
        const order = await serviceConnector.getOrder(context.orderId) as { items?: Product[] } | null;
        if (order?.items?.[0]) {
          currentProduct = order.items[0];
        }
      }

      if (!currentProduct) return offers;

      // Get catalog for upgrades (premium version of same product)
      const catalogProducts = await this.searchCatalog(currentProduct.category, currentProduct.name);

      // Filter for upgrades (higher price, same category)
      const upgrades = catalogProducts
        .filter(p => p.price > currentProduct!.price)
        .sort((a, b) => a.price - b.price)
        .slice(0, 3);

      upgrades.forEach(product => {
        offers.push({
          id: `upgrade_${product.id}`,
          type: 'upgrade',
          title: `Upgrade to ${product.name}`,
          description: product.description || `Premium version of your current product`,
          product,
          savings: product.originalPrice ? product.originalPrice - product.price : undefined,
          reason: `Upgrade from your current ${currentProduct?.name || 'product'}`,
          confidence: 0.85,
        });
      });
    } catch (error) {
      logger.warn('[Upsell] Failed to get upgrades', error);
    }

    return offers;
  }

  /**
   * Get accessories for current product
   */
  private async getAccessories(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    try {
      let currentProduct: Product | null = null;
      if (context.productId) {
        const result = await serviceConnector.getProduct(context.productId) as { product?: unknown; error?: string };
        currentProduct = result?.product as Product | undefined || null;
      } else if (context.orderId) {
        const order = await serviceConnector.getOrder(context.orderId) as { items?: Product[] } | null;
        if (order?.items?.[0]) {
          currentProduct = order.items[0];
        }
      }

      if (!currentProduct) return offers;

      // Common accessory mappings
      const accessoryMap: Record<string, string[]> = {
        'phone': ['case', 'charger', 'screen protector', 'earphones', 'power bank'],
        'laptop': ['laptop bag', 'mouse', 'charger', 'stand', 'keyboard'],
        'camera': ['tripod', 'memory card', 'bag', 'lens', 'flash'],
        'headphones': ['case', 'cable', 'cushions', 'stand'],
        'watch': ['strap', 'charger', 'case', 'screen protector'],
        'shoes': ['socks', 'insoles', 'shoe cleaner', 'bag'],
        'bag': ['wallet', 'organizer', 'lock', 'strap'],
        'furniture': ['cushion', 'cover', 'lamp', 'rug'],
        'kitchen': ['utensils', 'container', 'cleaner', 'stand'],
      };

      // Find accessories
      const category = currentProduct.category?.toLowerCase() || '';
      const keywords = accessoryMap[category] || [`${category} accessories`, 'complement'];

      for (const keyword of keywords.slice(0, 2)) {
        const accessories = await this.searchCatalog(keyword, currentProduct.name);
        accessories.slice(0, 2).forEach(product => {
          offers.push({
            id: `accessory_${product.id}`,
            type: 'accessory',
            title: `Essential: ${product.name}`,
            description: product.description || `Perfect companion for your ${currentProduct?.name}`,
            product,
            reason: `Complements your ${currentProduct?.name}`,
            confidence: 0.75,
          });
        });
      }
    } catch (error) {
      logger.warn('[Upsell] Failed to get accessories', error);
    }

    return offers;
  }

  /**
   * Get complementary products
   */
  private async getComplementary(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    try {
      // Complementary product pairs
      const complementaryPairs: Record<string, string[]> = {
        'phone': ['wireless charger', 'bluetooth speaker', 'smart watch', 'fitness band'],
        'laptop': ['monitor', 'printer', 'webcam', 'desk'],
        'camera': ['tripod', 'lighting', 'backdrop', 'props'],
        'headphones': ['music subscription', 'podcast app', 'audio cable'],
        'gaming': ['controller', 'headset', 'gaming chair', 'desk'],
        'sports': ['water bottle', 'towel', 'gym bag', 'supplements'],
        'kitchen': ['recipe book', 'spice set', 'cookware', 'appliances'],
        'beauty': ['skincare', 'makeup', 'haircare', 'perfume'],
        'clothing': ['belt', 'watch', 'jewelry', 'scarf'],
        'shoes': ['belt', 'socks', 'care kit'],
      };

      let category = context.category || '';
      const keywords = complementaryPairs[category.toLowerCase()] || ['trending', 'popular', 'bestseller'];

      for (const keyword of keywords.slice(0, 2)) {
        const products = await this.searchCatalog(keyword, category);
        products.slice(0, 2).forEach(product => {
          offers.push({
            id: `complement_${product.id}`,
            type: 'complementary',
            title: `Pairs great with: ${product.name}`,
            description: product.description || '',
            product,
            reason: `Frequently bought with ${context.category || 'similar products'}`,
            confidence: 0.7,
          });
        });
      }
    } catch (error) {
      logger.warn('[Upsell] Failed to get complementary', error);
    }

    return offers;
  }

  /**
   * Get premium alternatives
   */
  private async getPremium(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    try {
      const category = context.category || 'premium';
      const products = await this.searchCatalog('premium', category);

      // Take premium branded or higher-priced items
      const premiumProducts = products
        .filter(p => p.price > 1000) // Threshold for premium
        .sort((a, b) => b.price - a.price)
        .slice(0, 3);

      premiumProducts.forEach(product => {
        offers.push({
          id: `premium_${product.id}`,
          type: 'premium',
          title: `Premium Choice: ${product.name}`,
          description: product.description || 'Top-rated premium option',
          product,
          reason: 'Premium version for enhanced experience',
          confidence: 0.65,
        });
      });
    } catch (error) {
      logger.warn('[Upsell] Failed to get premium', error);
    }

    return offers;
  }

  /**
   * Get new arrivals
   */
  private async getNewArrivals(context: UpsellContext): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    try {
      const category = context.category || '';
      const products = await this.searchCatalog('new', category);

      products.slice(0, 3).forEach(product => {
        offers.push({
          id: `new_${product.id}`,
          type: 'new',
          title: `New Arrival: ${product.name}`,
          description: product.description || 'Just launched!',
          product,
          reason: 'Latest product in this category',
          confidence: 0.6,
        });
      });
    } catch (error) {
      logger.warn('[Upsell] Failed to get new arrivals', error);
    }

    return offers;
  }

  /**
   * Search catalog for products
   */
  private async searchCatalog(query: string, category?: string): Promise<Product[]> {
    // Try RABTUL Catalog first
    try {
      const catalogUrl = process.env.RABTUL_CATALOG_URL || 'http://localhost:4007';
      const res = await fetch(`${catalogUrl}/api/products/search?q=${encodeURIComponent(query)}`, {
        headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token' },
      });
      if (res.ok) {
        const data = await res.json() as { products?: Product[] };
        return data.products || [];
      }
    } catch {
      // Use mock data
    }

    // Fallback to mock data
    const lowerQuery = query.toLowerCase();
    const allMock = [...Object.values(this.mockCatalog).flat(), ...Object.values(this.mockAccessories).flat()];
    const results = allMock.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery) ||
      (category && p.category.toLowerCase() === category.toLowerCase())
    );
    return results.length > 0 ? results.slice(0, 5) : allMock.slice(0, 3);
  }

  /**
   * Get personalized recommendations based on customer history
   */
  async getPersonalizedOffers(customerId: string): Promise<UpsellOffer[]> {
    const offers: UpsellOffer[] = [];

    try {
      // Get customer profile for preferences
      const profile = await serviceConnector.getCustomerProfile(customerId) as { preferences?: Record<string, unknown> } | null;
      const preferences = profile?.preferences || {};

      // Get customer LTV for pricing tier
      const ltvData = await serviceConnector.getLTV(customerId) as { ltv?: number } | null;
      const isVIP = (ltvData?.ltv || 0) > 50000;

      // If VIP, add premium recommendations
      if (isVIP) {
        const premiumProducts = await this.searchCatalog('premium', String(preferences.category || ''));
        premiumProducts.slice(0, 2).forEach(product => {
          offers.push({
            id: `vip_${product.id}`,
            type: 'premium',
            title: `Exclusive for VIP: ${product.name}`,
            description: product.description || '',
            product,
            reason: 'Premium products for valued customers',
            confidence: 0.9,
          });
        });
      }

      // Add subscription offers based on purchase history
      if (preferences.hasSubscriptions === false) {
        offers.push({
          id: 'subscription_recommendation',
          type: 'subscription',
          title: 'Start a Subscription',
          description: 'Save up to 30% with recurring orders',
          product: {
            id: 'subscription',
            name: 'Subscription Box',
            category: 'subscription',
            price: 999,
          },
          reason: 'Customers like you save with subscriptions',
          confidence: 0.75,
        });
      }
    } catch (error) {
      logger.warn('[Upsell] Failed to get personalized', error);
    }

    return offers;
  }

  /**
   * Generate agent suggestions for conversation
   */
  generateAgentSuggestions(offers: {
    upgrades: UpsellOffer[];
    accessories: UpsellOffer[];
    complementary: UpsellOffer[];
    premium: UpsellOffer[];
    newArrivals: UpsellOffer[];
  }): string {
    let message = '\n\n📦 **UPSELL SUGGESTIONS FOR THIS CUSTOMER:**\n\n';

    const allOffers = [
      ...(offers.upgrades || []).map((o) => ({ ...o, priority: 1 })),
      ...(offers.accessories || []).map((o) => ({ ...o, priority: 2 })),
      ...(offers.complementary || []).map((o) => ({ ...o, priority: 3 })),
    ].sort((a, b) => b.confidence - a.confidence).slice(0, 3);

    if (allOffers.length === 0) {
      return '';
    }

    allOffers.forEach((offer, i) => {
      const emoji = offer.type === 'upgrade' ? '⬆️' : offer.type === 'accessory' ? '🎁' : '🔥';
      message += `${emoji} **${i + 1}. ${offer.title}**\n`;
      message += `   💰 Price: ₹${offer.product.price}`;
      if (offer.savings) {
        message += ` (Save ₹${offer.savings})`;
      }
      message += '\n';
      message += `   💡 "${offer.reason}"\n\n`;
    });

    message += '---\n';
    message += '_Suggest these naturally in conversation_\n';

    return message;
  }

  /**
   * Track upsell performance
   */
  async trackOffer(
    customerId: string,
    offer: UpsellOffer,
    action: 'shown' | 'suggested' | 'accepted' | 'declined'
  ): Promise<void> {
    logger.info('[Upsell] Offer tracked', {
      customerId,
      offerId: offer.id,
      offerType: offer.type,
      product: offer.product.name,
      action,
    });

    // Track in attribution
    await serviceConnector.trackAttribution(
      customerId,
      `upsell_${action}`,
      action === 'accepted' ? offer.product.price : 0
    );
  }
}

export const smartUpsellEngine = new SmartUpsellEngine();

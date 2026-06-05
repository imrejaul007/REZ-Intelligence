import {
  GroceryBasketItem,
  BasketInsight,
  CrossSellOpportunity,
  SavingsTip,
  CategoryGap,
  GroceryCategory,
} from '../types';
import { CROSS_SELL_MAPPINGS, UPSELL_MAPPINGS, PRODUCT_CATEGORIES } from '../config/knowledge';
import { logger } from '../utils/logger';

interface BundleSuggestion {
  bundleId: string;
  bundleName: string;
  products: string[];
  originalTotal: number;
  bundlePrice: number;
  discount: number;
  confidence: number;
  reason: string;
}

export class BasketAnalyzer {
  /**
   * Analyze basket items and generate insights
   */
  analyzeBasket(items: GroceryBasketItem[]): BasketInsight {
    logger.debug('Analyzing basket', { itemCount: items.length });

    const totalCartValue = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const cartProductIds = new Set(items.map(item => item.productId));
    const cartCategories = new Set(items.map(item => item.category));

    // Identify cross-sell opportunities
    const crossSellProducts = this.identifyCrossSellOpportunities(items);

    // Generate savings tips
    const savingsTips = this.generateSavingsTips(items, totalCartValue);

    // Identify category gaps
    const categoryGaps = this.identifyCategoryGaps(items, cartCategories);

    // Calculate total potential savings
    const totalPotentialSavings = savingsTips.reduce((sum, tip) => sum + tip.potentialSavings, 0);

    return {
      crossSellProducts,
      savingsTips,
      categoryGaps,
      totalPotentialSavings,
    };
  }

  /**
   * Identify cross-sell opportunities
   */
  private identifyCrossSellOpportunities(items: GroceryBasketItem[]): CrossSellOpportunity[] {
    const opportunities: CrossSellOpportunity[] = [];
    const seenPairs = new Set<string>();

    items.forEach(item => {
      // Normalize product name for lookup
      const normalizedName = item.productName.toLowerCase().replace(/\s+/g, '_');
      const mappings = CROSS_SELL_MAPPINGS[normalizedName];

      if (mappings) {
        mappings.products.forEach(crossProduct => {
          const pairKey = `${item.productId}-${crossProduct}`;
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            opportunities.push({
              primaryProduct: item.productId,
              crossSellProducts: [crossProduct],
              bundleDiscount: 10,
              confidence: mappings.minConfidence,
              reason: `Customers often buy ${this.formatProductName(crossProduct)} with ${item.productName}`,
            });
          }
        });
      }
    });

    return opportunities.slice(0, 10);
  }

  /**
   * Generate savings tips based on basket contents
   */
  private generateSavingsTips(items: GroceryBasketItem[], totalCartValue: number): SavingsTip[] {
    const tips: SavingsTip[] = [];
    const itemNames = items.map(i => i.productName.toLowerCase());

    // Bulk discount opportunity
    if (totalCartValue > 50 && totalCartValue < 100) {
      tips.push({
        type: 'bulk',
        description: `Add $${(100 - totalCartValue).toFixed(2)} more to qualify for free shipping`,
        potentialSavings: 6.99,
        applicableProducts: items.map(i => i.productId),
      });
    }

    // Bundle opportunity
    const hasBread = itemNames.some(n => n.includes('bread') || n.includes('bun'));
    const hasDairy = itemNames.some(n => n.includes('butter') || n.includes('cheese'));
    if (hasBread && hasDairy) {
      tips.push({
        type: 'bundle',
        description: `Buy bread and dairy together - save 10% on both`,
        potentialSavings: totalCartValue * 0.05,
        applicableProducts: items.filter(i =>
          i.productName.includes('bread') || i.productName.includes('butter') || i.productName.includes('cheese')
        ).map(i => i.productId),
      });
    }

    // Loyalty benefit (simulated)
    if (totalAltValue(items) > 30) {
      tips.push({
        type: 'loyalty',
        description: 'You could earn double loyalty points on this purchase',
        potentialSavings: totalCartValue * 0.02,
        applicableProducts: items.map(i => i.productId),
      });
    }

    // Promotion opportunity
    const hasSnacks = items.some(i => i.category === GroceryCategory.SNACKS);
    if (hasSnacks) {
      tips.push({
        type: 'promotion',
        description: 'Buy 2 bags of chips, get 1 free - valid today',
        potentialSavings: 4.99,
        applicableProducts: items.filter(i => i.category === GroceryCategory.SNACKS).map(i => i.productId),
      });
    }

    return tips;
  }

  /**
   * Identify missing categories in basket
   */
  private identifyCategoryGaps(items: GroceryBasketItem[], cartCategories: Set<GroceryCategory>): CategoryGap[] {
    const gaps: CategoryGap[] = [];
    const allCategories = Object.keys(GroceryCategory) as GroceryCategory[];

    const essentialsGaps: string[] = [];
    const dairyGaps: string[] = [];

    // Check for missing essentials
    const essentialsItems = ['rice', 'pasta', 'oil', 'sauce'];
    essentialsItems.forEach(essential => {
      if (!items.some(i => i.productName.toLowerCase().includes(essential))) {
        essentialsGaps.push(essential);
      }
    });

    if (essentialsGaps.length >= 2) {
      gaps.push({
        category: GroceryCategory.ESSENTIALS,
        missingProducts: essentialsGaps.slice(0, 3),
        reason: 'Common kitchen staples that complement your selections',
      });
    }

    // Check for missing dairy when buying bread
    if (cartCategories.has(GroceryCategory.BAKERY) && !cartCategories.has(GroceryCategory.DAIRY)) {
      dairyGaps.push('butter', 'cream cheese');
      gaps.push({
        category: GroceryCategory.DAIRY,
        missingProducts: dairyGaps,
        reason: 'Complete your bakery items with dairy complements',
      });
    }

    // Check for missing beverages with snacks
    if (cartCategories.has(GroceryCategory.SNACKS) && !cartCategories.has(GroceryCategory.BEVERAGES)) {
      gaps.push({
        category: GroceryCategory.BEVERAGES,
        missingProducts: ['soft drinks', 'juice'],
        reason: 'Don\'t forget to quench your thirst with snacks',
      });
    }

    return gaps;
  }

  /**
   * Suggest product bundles
   */
  suggestBundles(products: GroceryBasketItem[]): BundleSuggestion[] {
    logger.debug('Suggesting bundles', { productCount: products.length });

    const bundles: BundleSuggestion[] = [];
    const cartCategories = new Set(products.map(p => p.category));

    // Breakfast bundle if has bakery/dairy
    if (cartCategories.has(GroceryCategory.BAKERY) && cartCategories.has(GroceryCategory.DAIRY)) {
      const bakeryItems = products.filter(p => p.category === GroceryCategory.BAKERY);
      const dairyItems = products.filter(p => p.category === GroceryCategory.DAIRY);
      const bundleItems = [...bakeryItems.slice(0, 1), ...dairyItems.slice(0, 1)];
      const originalTotal = bundleItems.reduce((sum, p) => sum + p.totalPrice, 0);

      if (bundleItems.length >= 2) {
        bundles.push({
          bundleId: 'breakfast-bundle',
          bundleName: 'Perfect Breakfast Bundle',
          products: bundleItems.map(p => p.productId),
          originalTotal,
          bundlePrice: originalTotal * 0.9,
          discount: 10,
          confidence: 0.85,
          reason: 'Complete your breakfast with this convenient bundle',
        });
      }
    }

    // BBQ bundle in summer
    const currentMonth = new Date().getMonth();
    const isSummer = currentMonth >= 5 && currentMonth <= 8;
    if (isSummer) {
      const freshItems = products.filter(p => p.category === GroceryCategory.PRODUCE);
      if (freshItems.length > 0) {
        bundles.push({
          bundleId: 'summer-bundle',
          bundleName: 'Summer Grilling Bundle',
          products: freshItems.slice(0, 3).map(p => p.productId),
          originalTotal: freshItems.slice(0, 3).reduce((sum, p) => sum + p.totalPrice, 0),
          bundlePrice: freshItems.slice(0, 3).reduce((sum, p) => sum + p.totalPrice, 0) * 0.85,
          discount: 15,
          confidence: 0.8,
          reason: 'Perfect for your summer BBQ - save 15%',
        });
      }
    }

    return bundles;
  }

  /**
   * Format product name for display
   */
  private formatProductName(input: string): string {
    return input
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export default BasketAnalyzer;

/**
 * Calculate alternative value (for upsell opportunities)
 */
function totalAltValue(items: GroceryBasketItem[]): number {
  return items.reduce((sum, item) => sum + item.totalPrice, 0) * 0.8;
}
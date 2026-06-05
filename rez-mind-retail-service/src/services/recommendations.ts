import {
  ProductRecommendation,
  ProductCategory,
  BundleRecommendation,
  UpsellOpportunity,
  CartItem,
} from '../types';
import {
  PRODUCT_CATEGORIES,
  UPSELL_MAPPINGS,
  CROSS_SELL_MAPPINGS,
  BUNDLE_OPPORTUNITIES,
} from '../config/knowledge';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class RecommendationsService {
  /**
   * Get personalized recommendations for a customer
   */
  async personalizedRecommendations(
    customerId: string,
    merchantId: string,
    limit: number = 10,
    includeCategories?: ProductCategory[],
    excludeProducts?: string[]
  ): Promise<ProductRecommendation[]> {
    logger.debug('Generating personalized recommendations', { customerId, merchantId, limit });

    const recommendations: ProductRecommendation[] = [];
    const excludeSet = new Set(excludeProducts || []);

    // Determine which categories to include
    const categories = includeCategories || Object.keys(PRODUCT_CATEGORIES) as ProductCategory[];

    // Generate recommendations for each category
    for (const category of categories) {
      if (recommendations.length >= limit) break;

      const categoryData = PRODUCT_CATEGORIES[category];
      if (!categoryData) continue;

      // Add top products from each subcategory
      categoryData.subcategories.slice(0, 2).forEach((subcategory, index) => {
        if (recommendations.length >= limit) return;

        const productId = `pers-${customerId}-${category}-${index}`;

        if (excludeSet.has(productId)) return;

        // Calculate confidence based on category and position
        const baseConfidence = categoryData.avgMargin > 0.4 ? 0.75 : 0.7;
        const positionBonus = index === 0 ? 0.05 : 0;

        recommendations.push({
          productId,
          productName: this.formatProductName(subcategory),
          category,
          confidence: Math.min(0.95, baseConfidence + positionBonus - (index * 0.02)),
          reason: `Popular in ${categoryData.name} - frequently purchased together`,
          relevanceScore: 100 - (recommendations.length * 5),
          urgency: this.getUrgencyForCategory(category, index),
        });
      });
    }

    return recommendations.slice(0, limit);
  }

  /**
   * Get bundle recommendations for a merchant
   */
  async bundleRecommendations(merchantId: string): Promise<BundleRecommendation[]> {
    logger.debug('Generating bundle recommendations', { merchantId });

    const bundles: BundleRecommendation[] = [];

    // Generate bundles from knowledge base
    Object.entries(BUNDLE_OPPORTUNITIES).forEach(([category, categoryBundles]) => {
      categoryBundles.forEach((bundle, index) => {
        const bundleId = `bundle-${merchantId}-${category}-${index}`;

        // Create mock products for the bundle
        const bundleProducts: CartItem[] = bundle.products.map((productName, pIndex) => ({
          productId: `${bundleId}-${pIndex}`,
          productName: this.formatProductName(productName),
          category: category as ProductCategory,
          quantity: 1,
          unitPrice: 25 + Math.random() * 100,
          totalPrice: 0,
        }));

        // Calculate totals
        const originalTotal = bundleProducts.reduce((sum, p) => {
          p.totalPrice = p.unitPrice;
          return sum + p.unitPrice;
        }, 0);

        const discountedTotal = originalTotal * (1 - bundle.discount / 100);

        bundles.push({
          bundleId,
          bundleName: bundle.name,
          products: bundleProducts,
          originalTotal: Math.round(originalTotal * 100) / 100,
          bundlePrice: Math.round(discountedTotal * 100) / 100,
          discount: bundle.discount,
          confidence: 0.75 + (Math.random() * 0.2),
          reason: `${bundle.name} offers ${bundle.discount}% savings on complementary products`,
        });
      });
    });

    // Sort by confidence and discount
    return bundles
      .sort((a, b) => (b.confidence * b.discount) - (a.confidence * a.discount))
      .slice(0, 20);
  }

  /**
   * Get upsell recommendations based on current cart or category
   */
  async upsellRecommendations(
    merchantId: string,
    category?: ProductCategory
  ): Promise<UpsellOpportunity[]> {
    logger.debug('Generating upsell recommendations', { merchantId, category });

    const upsells: UpsellOpportunity[] = [];

    // Determine categories to analyze
    const categories = category
      ? [category]
      : Object.keys(UPSELL_MAPPINGS) as ProductCategory[];

    // Generate upsell opportunities for each category
    categories.forEach(cat => {
      const mapping = UPSELL_MAPPINGS[cat] || UPSELL_MAPPINGS[category as string];

      if (mapping) {
        mapping.upsellProducts.forEach((productName, index) => {
          if (index >= 5) return; // Limit to 5 upsells per category

          upsells.push({
            originalProduct: {
              productId: `base-${cat}-${index}`,
              productName: `${this.formatProductName(cat)} Base Product`,
              category: cat as ProductCategory,
              quantity: 1,
              unitPrice: 50 + Math.random() * 100,
              totalPrice: 0,
            },
            upsellProduct: {
              productId: `upsell-${merchantId}-${cat}-${index}`,
              productName: this.formatProductName(productName),
              category: mapping.category as ProductCategory,
              confidence: mapping.minConfidence - (index * 0.05),
              reason: `Complementary to ${this.formatProductName(cat)}`,
              price: 15 + Math.random() * 50,
              relevanceScore: 90 - (index * 10),
            },
            savings: index === 0 ? 5 : undefined,
            confidence: mapping.minConfidence - (index * 0.05),
            reason: `Customers frequently add ${productName} to their ${cat} purchases`,
          });
        });
      }
    });

    // Sort by confidence
    return upsells.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  }

  /**
   * Find similar products based on product ID
   */
  async similarProducts(productId: string, limit: number = 5): Promise<ProductRecommendation[]> {
    logger.debug('Finding similar products', { productId });

    const recommendations: ProductRecommendation[] = [];

    // Parse product ID to extract category information
    const categoryMatch = productId.match(/-(electronics|fashion|grocery|home|furniture|beauty|sports|toys|books)-/i);
    let targetCategory: ProductCategory = ProductCategory.ELECTRONICS;

    if (categoryMatch) {
      targetCategory = categoryMatch[1].toLowerCase() as ProductCategory;
    }

    const categoryData = PRODUCT_CATEGORIES[targetCategory];
    if (!categoryData) {
      return recommendations;
    }

    // Generate similar products from same category
    categoryData.subcategories.slice(0, limit).forEach((subcategory, index) => {
      recommendations.push({
        productId: `similar-${productId}-${index}`,
        productName: this.formatProductName(subcategory),
        category: targetCategory,
        confidence: 0.8 - (index * 0.05),
        reason: `Similar to products in ${categoryData.name}`,
        relevanceScore: 100 - (index * 10),
      });
    });

    return recommendations;
  }

  /**
   * Get category-based recommendations
   */
  async getCategoryRecommendations(
    merchantId: string,
    category?: ProductCategory
  ): Promise<ProductRecommendation[]> {
    logger.debug('Generating category recommendations', { merchantId, category });

    const recommendations: ProductRecommendation[] = [];
    const categories = category
      ? [category]
      : Object.keys(PRODUCT_CATEGORIES) as ProductCategory[];

    categories.forEach(cat => {
      const categoryData = PRODUCT_CATEGORIES[cat];
      if (!categoryData) return;

      // Add popular products from category
      categoryData.subcategories.slice(0, 3).forEach((subcategory, index) => {
        if (recommendations.length >= 30) return;

        recommendations.push({
          productId: `cat-rec-${merchantId}-${cat}-${index}`,
          productName: this.formatProductName(subcategory),
          category: cat,
          confidence: 0.7 + Math.random() * 0.2,
          reason: `Top seller in ${categoryData.name}`,
          relevanceScore: 95 - (recommendations.length * 2),
        });
      });
    });

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 30);
  }

  /**
   * Get trending products across all categories
   */
  async getTrendingProducts(
    merchantId: string,
    limit: number = 10
  ): Promise<ProductRecommendation[]> {
    logger.debug('Fetching trending products', { merchantId, limit });

    const recommendations: ProductRecommendation[] = [];
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();

    // Get trending categories based on seasonal patterns
    Object.entries(PRODUCT_CATEGORIES).forEach(([category, data]) => {
      if (recommendations.length >= limit) return;

      const isTrending = data.seasonalityPeak.includes(currentMonth);

      if (isTrending) {
        data.subcategories.slice(0, 2).forEach((subcategory, index) => {
          if (recommendations.length >= limit) return;

          recommendations.push({
            productId: `trending-${merchantId}-${category}-${index}`,
            productName: this.formatProductName(subcategory),
            category: category as ProductCategory,
            confidence: 0.85 + Math.random() * 0.1,
            reason: `Trending this ${currentMonth} in ${data.name}`,
            relevanceScore: 100 - (recommendations.length * 3),
            urgency: index === 0 ? 'high' : 'medium',
          });
        });
      }
    });

    return recommendations;
  }

  /**
   * Get frequently bought together products
   */
  async getFrequentlyBoughtTogether(
    productId: string,
    limit: number = 5
  ): Promise<ProductRecommendation[]> {
    logger.debug('Finding frequently bought together', { productId });

    const recommendations: ProductRecommendation[] = [];

    // Parse category from product ID
    const categoryMatch = productId.match(/-(electronics|fashion|grocery|home|furniture|beauty|sports|toys|books)-/i);
    let category: ProductCategory = ProductCategory.ELECTRONICS;

    if (categoryMatch) {
      category = categoryMatch[1].toLowerCase() as ProductCategory;
    }

    // Look up cross-sell mappings
    const relatedProducts = CROSS_SELL_MAPPINGS[productId] ||
      CROSS_SELL_MAPPINGS[category] ||
      [];

    relatedProducts.slice(0, limit).forEach((productName, index) => {
      recommendations.push({
        productId: `fbt-${productId}-${index}`,
        productName: this.formatProductName(productName),
        category,
        confidence: 0.75 - (index * 0.05),
        reason: 'Frequently purchased together',
        relevanceScore: 90 - (index * 10),
      });
    });

    return recommendations;
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

  /**
   * Get urgency level based on category and position
   */
  private getUrgencyForCategory(category: ProductCategory, index: number): 'critical' | 'high' | 'medium' | 'low' {
    const urgentCategories: ProductCategory[] = [
      ProductCategory.GROCERY,
      ProductCategory.BEAUTY,
    ];

    if (urgentCategories.includes(category) && index === 0) {
      return 'high';
    }

    if (index === 0) {
      return 'medium';
    }

    return 'low';
  }
}
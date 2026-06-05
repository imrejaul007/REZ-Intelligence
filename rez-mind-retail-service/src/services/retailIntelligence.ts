import { v4 as uuidv4 } from 'uuid';
import {
  CustomerSegment,
  ProductCategory,
  ProductRecommendation,
  CartItem,
  PurchaseHistory,
  UpsellOpportunity,
  InventoryAlert,
  InventoryForecast,
  TrendingProduct,
  TrendDirection,
  UrgencyLevel,
  LifecycleStage,
  BrowseEvent,
} from '../types';
import {
  PRODUCT_CATEGORIES,
  CUSTOMER_SEGMENTS,
  UPSELL_MAPPINGS,
  CROSS_SELL_MAPPINGS,
  SEASONAL_PATTERNS,
  DEMAND_SIGNALS,
  TREND_INDICATORS,
  REORDER_THRESHOLDS,
} from '../config/knowledge';
import { logger } from '../utils/logger';

interface CartAnalysis {
  bundleOpportunities: Array<{
    products: CartItem[];
    discount: number;
    reason: string;
  }>;
  crossSellProducts: UpsellOpportunity[];
  totalCartValue: number;
  categoryBreakdown: Record<string, number>;
}

interface NextBestActionContext {
  customerSegment: CustomerSegment;
  cartAnalysis: CartAnalysis | null;
  hasBrowseHistory: boolean;
}

interface ConfidenceContext {
  hasCart: boolean;
  hasHistory: boolean;
  segmentConfidence: number;
}

export class RetailIntelligence {
  /**
   * Analyze cart items and identify opportunities
   */
  async analyzeCart(cartItems: CartItem[]): Promise<CartAnalysis> {
    logger.debug('Analyzing cart', { itemCount: cartItems.length });

    const totalCartValue = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const categoryBreakdown: Record<string, number> = {};

    // Calculate category breakdown
    cartItems.forEach(item => {
      categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + item.totalPrice;
    });

    // Identify bundle opportunities
    const bundleOpportunities = this.identifyBundleOpportunities(cartItems);

    // Identify cross-sell products
    const crossSellProducts = this.identifyCrossSellOpportunities(cartItems);

    return {
      bundleOpportunities,
      crossSellProducts,
      totalCartValue,
      categoryBreakdown,
    };
  }

  /**
   * Identify bundle opportunities within the cart
   */
  private identifyBundleOpportunities(cartItems: CartItem[]): Array<{ products: CartItem[]; discount: number; reason: string }> {
    const bundles: Array<{ products: CartItem[]; discount: number; reason: string }> = [];
    const cartProductIds = new Set(cartItems.map(item => item.productId));
    const cartCategories = new Set(cartItems.map(item => item.category));

    // Check for matching bundles from knowledge base
    Object.entries(CROSS_SELL_MAPPINGS).forEach(([productId, relatedProducts]) => {
      if (cartProductIds.has(productId)) {
        // This is a matching product - suggest bundle with related items
        relatedProducts.forEach(relatedProduct => {
          const matchingBundle = this.findMatchingBundle(relatedProduct, cartItems);
          if (matchingBundle) {
            bundles.push(matchingBundle);
          }
        });
      }
    });

    // Check for same-category bundles
    cartCategories.forEach(category => {
      const categoryItems = cartItems.filter(item => item.category === category);
      if (categoryItems.length >= 2) {
        bundles.push({
          products: categoryItems,
          discount: 10, // 10% bundle discount
          reason: `Buy multiple ${category} items together and save 10%`,
        });
      }
    });

    return bundles.slice(0, 5); // Limit to top 5 bundles
  }

  /**
   * Find matching bundle for a product
   */
  private findMatchingBundle(productName: string, cartItems: CartItem[]): { products: CartItem[]; discount: number; reason: string } | null {
    const matchingItems = cartItems.filter(item =>
      item.productName.toLowerCase().includes(productName.toLowerCase()) ||
      productName.toLowerCase().includes(item.productName.toLowerCase())
    );

    if (matchingItems.length > 0) {
      return {
        products: matchingItems,
        discount: 15,
        reason: `Complete your purchase with complementary ${productName} items`,
      };
    }

    return null;
  }

  /**
   * Identify cross-sell opportunities
   */
  private identifyCrossSellOpportunities(cartItems: CartItem[]): UpsellOpportunity[] {
    const opportunities: UpsellOpportunity[] = [];

    cartItems.forEach(cartItem => {
      const upsellMappings = UPSELL_MAPPINGS[cartItem.category] || UPSELL_MAPPINGS[cartItem.productName];

      if (upsellMappings) {
        upsellMappings.upsellProducts.forEach((upsellProduct, index) => {
          if (index < 3) { // Limit to top 3 upsells per item
            opportunities.push({
              originalProduct: cartItem,
              upsellProduct: {
                productId: `upsell-${cartItem.productId}-${index}`,
                productName: this.formatProductName(upsellProduct),
                category: upsellMappings.category as ProductCategory,
                confidence: upsellMappings.minConfidence - (index * 0.05),
                reason: `Frequently bought with ${cartItem.productName}`,
                relevanceScore: 80 - (index * 10),
              },
              confidence: upsellMappings.minConfidence - (index * 0.05),
              reason: `Customers who bought ${cartItem.productName} often add ${upsellProduct}`,
            });
          }
        });
      }
    });

    return opportunities.slice(0, 10); // Limit to top 10
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
   * Segment customer based on purchase history
   */
  async segmentCustomer(purchaseHistory: PurchaseHistory): Promise<CustomerSegment> {
    logger.debug('Segmenting customer', { customerId: purchaseHistory.customerId });

    const { orderCount, avgOrderValue, totalSpent } = purchaseHistory;

    // Calculate segment indicators
    const avgOrderValueMultiplier = avgOrderValue > 0 ? totalSpent / (orderCount * avgOrderValue) : 1;
    const hasHighFrequency = orderCount > 5;
    const hasHighValue = avgOrderValue > 100;

    // Classification logic
    if (orderCount === 0) {
      return CustomerSegment.FIRST_TIMER;
    }

    if (avgOrderValueMultiplier > 1.5 && hasHighValue) {
      return CustomerSegment.PREMIUM_BUYER;
    }

    if (avgOrderValueMultiplier < 0.7) {
      return CustomerSegment.BARGAIN_HUNTER;
    }

    if (hasHighFrequency && avgOrderValueMultiplier >= 0.7 && avgOrderValueMultiplier <= 1.3) {
      return CustomerSegment.ROUTINE;
    }

    return CustomerSegment.OCCASIONAL;
  }

  /**
   * Predict customer lifetime value
   */
  async predictLifetimeValue(customerHistory: PurchaseHistory): Promise<{
    predictedCLV: number;
    confidence: number;
    timeHorizon: string;
    factors: Record<string, number>;
  }> {
    logger.debug('Predicting CLV', { customerId: customerHistory.customerId });

    const { avgOrderValue, orderCount, lastPurchaseDate } = customerHistory;

    // Calculate customer age in days
    const customerAgeDays = Math.max(1, Math.floor(
      (Date.now() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
    ));

    // Calculate monthly purchase rate
    const monthlyRate = orderCount / Math.max(1, customerAgeDays / 30);

    // Predict future value (simplified model)
    const baseCLV = avgOrderValue * monthlyRate * 12; // 12-month projection
    const predictedCLV = Math.round(baseCLV * 100) / 100;

    // Calculate confidence based on data quality
    const dataQualityScore = Math.min(1, orderCount / 10) * 0.6 +
      Math.min(1, customerAgeDays / 90) * 0.4;
    const confidence = Math.round(dataQualityScore * 100) / 100;

    return {
      predictedCLV,
      confidence,
      timeHorizon: '12m',
      factors: {
        avgOrderValue,
        monthlyPurchaseRate: Math.round(monthlyRate * 100) / 100,
        customerAgeDays,
        orderCount,
      },
    };
  }

  /**
   * Recommend products based on category and preferences
   */
  async recommendProducts(
    category: ProductCategory,
    preferences: string[],
    limit: number = 10
  ): Promise<ProductRecommendation[]> {
    logger.debug('Generating product recommendations', { category, preferences });

    const recommendations: ProductRecommendation[] = [];
    const categoryData = PRODUCT_CATEGORIES[category];

    // Generate recommendations based on category
    if (categoryData) {
      categoryData.subcategories.forEach((subcategory, index) => {
        if (index >= limit) return;

        recommendations.push({
          productId: `rec-${category}-${index}`,
          productName: this.formatProductName(subcategory),
          category,
          confidence: 0.75 - (index * 0.02),
          reason: `Popular in ${categoryData.name} - ${subcategory}`,
          relevanceScore: 100 - (index * 5),
        });
      });
    }

    // Filter by preferences if provided
    let filteredRecommendations = recommendations;
    if (preferences.length > 0) {
      filteredRecommendations = recommendations.filter(rec =>
        preferences.some(pref =>
          rec.productName.toLowerCase().includes(pref.toLowerCase()) ||
          rec.reason.toLowerCase().includes(pref.toLowerCase())
        )
      );
    }

    return filteredRecommendations.slice(0, limit);
  }

  /**
   * Detect trends for a merchant
   */
  async detectTrends(
    merchantId: string,
    category?: ProductCategory,
    limit: number = 20
  ): Promise<TrendingProduct[]> {
    logger.debug('Detecting trends', { merchantId, category });

    const trends: TrendingProduct[] = [];

    // Generate mock trend data based on seasonal patterns
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const seasonalCategories = SEASONAL_PATTERNS.month[currentMonth as keyof typeof SEASONAL_PATTERNS.month]?.categories || [];

    // Generate trending products
    const categories = category ? [category] : Object.keys(PRODUCT_CATEGORIES);
    categories.forEach((cat, catIndex) => {
      const catData = PRODUCT_CATEGORIES[cat as ProductCategory];
      if (!catData) return;

      const isSeasonal = seasonalCategories.includes(cat);

      catData.subcategories.slice(0, 3).forEach((subcategory, index) => {
        if (trends.length >= limit) return;

        const trendScore = isSeasonal ? 85 + Math.random() * 15 : 50 + Math.random() * 30;
        const velocity = trendScore > 80 ? 0.3 + Math.random() * 0.2 : 0.1 + Math.random() * 0.2;

        trends.push({
          productId: `trend-${merchantId}-${catIndex}-${index}`,
          productName: this.formatProductName(subcategory),
          category: cat as ProductCategory,
          trendScore: Math.round(trendScore),
          velocity: Math.round(velocity * 100) / 100,
          direction: trendScore > 70 ? TrendDirection.TRENDING_UP :
            trendScore < 40 ? TrendDirection.TRENDING_DOWN : TrendDirection.STABLE,
          recentSales: Math.floor(Math.random() * 500) + 100,
          projectedDemand: Math.floor(Math.random() * 1000) + 200,
          confidence: 0.7 + Math.random() * 0.25,
        });
      });
    });

    // Sort by trend score
    return trends.sort((a, b) => b.trendScore - a.trendScore).slice(0, limit);
  }

  /**
   * Generate next best action based on context
   */
  generateNextBestAction(context: NextBestActionContext): string {
    const { customerSegment, cartAnalysis, hasBrowseHistory } = context;

    const segmentConfig = CUSTOMER_SEGMENTS[customerSegment];

    // Cart-based actions
    if (cartAnalysis) {
      if (cartAnalysis.totalCartValue < 50) {
        return 'Offer free shipping threshold - encourage customers to add more items';
      }

      if (cartAnalysis.bundleOpportunities.length > 0) {
        return `Suggest ${cartAnalysis.bundleOpportunities.length} bundle deals to increase AOV`;
      }
    }

    // Browse history based actions
    if (hasBrowseHistory) {
      return 'Send abandoned cart email with personalized recommendations';
    }

    // Segment-specific actions
    switch (customerSegment) {
      case CustomerSegment.FIRST_TIMER:
        return 'Offer first-purchase discount to encourage conversion';
      case CustomerSegment.BARGAIN_HUNTER:
        return 'Highlight ongoing promotions and clearance items';
      case CustomerSegment.PREMIUM_BUYER:
        return 'Showcase premium products and exclusive offerings';
      case CustomerSegment.ROUTINE:
        return 'Promote subscription options for regular purchases';
      case CustomerSegment.OCCASIONAL:
        return 'Send re-engagement campaign with personalized recommendations';
      default:
        return 'Continue engaging with personalized content';
    }
  }

  /**
   * Calculate confidence score for consultation
   */
  calculateConfidence(context: ConfidenceContext): number {
    const { hasCart, hasHistory, segmentConfidence } = context;

    let confidence = segmentConfidence;

    if (hasCart) confidence += 0.1;
    if (hasHistory) confidence += 0.1;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Generate demand forecast for products
   */
  async generateDemandForecast(
    merchantId: string,
    category?: ProductCategory,
    limit: number = 20
  ): Promise<InventoryForecast[]> {
    logger.debug('Generating demand forecast', { merchantId, category });

    const forecasts: InventoryForecast[] = [];

    // Get trending products to base forecasts on
    const trending = await this.detectTrends(merchantId, category, limit);

    trending.forEach(product => {
      const currentStock = Math.floor(Math.random() * 100) + 20;
      const predictedDemand = product.projectedDemand;
      const daysOfSupply = Math.floor(currentStock / (predictedDemand / 30));

      forecasts.push({
        productId: product.productId,
        productName: product.productName,
        currentStock,
        predictedDemand,
        daysOfSupply: Math.max(1, daysOfSupply),
        reorderPoint: Math.floor(predictedDemand / 30 * 7), // 7 days of supply
        recommendedOrderQuantity: Math.max(0, predictedDemand - currentStock),
        confidenceInterval: {
          lower: Math.floor(predictedDemand * 0.8),
          upper: Math.floor(predictedDemand * 1.2),
        },
        trend: product.direction,
        seasonality: {
          factor: product.trendScore / 100,
          peakMonths: ['november', 'december'],
        },
      });
    });

    return forecasts;
  }

  /**
   * Get reorder recommendations
   */
  async getReorderRecommendations(
    merchantId: string,
    urgency?: string,
    limit: number = 20
  ): Promise<InventoryAlert[]> {
    logger.debug('Generating reorder recommendations', { merchantId, urgency });

    const forecasts = await this.generateDemandForecast(merchantId, undefined, limit);
    const alerts: InventoryAlert[] = [];

    forecasts.forEach(forecast => {
      let urgencyLevel: UrgencyLevel;
      let message: string;

      if (forecast.daysOfSupply <= REORDER_THRESHOLDS.critical.days_remaining) {
        urgencyLevel = UrgencyLevel.CRITICAL;
        message = `Critical: Only ${forecast.daysOfSupply} days of supply remaining`;
      } else if (forecast.daysOfSupply <= REORDER_THRESHOLDS.high.days_remaining) {
        urgencyLevel = UrgencyLevel.HIGH;
        message = `High priority: ${forecast.daysOfSupply} days of supply remaining`;
      } else if (forecast.daysOfSupply <= REORDER_THRESHOLDS.medium.days_remaining) {
        urgencyLevel = UrgencyLevel.MEDIUM;
        message = `Reorder soon: ${forecast.daysOfSupply} days of supply remaining`;
      } else {
        urgencyLevel = UrgencyLevel.LOW;
        message = `${forecast.daysOfSupply} days of supply remaining`;
      }

      if (!urgency || urgency === 'all' || urgencyLevel === urgency) {
        alerts.push({
          productId: forecast.productId,
          productName: forecast.productName,
          currentStock: forecast.currentStock,
          daysRemaining: forecast.daysOfSupply,
          urgency: urgencyLevel,
          message,
          recommendedAction: forecast.recommendedOrderQuantity > 0
            ? `Order ${forecast.recommendedOrderQuantity} units`
            : 'Monitor stock levels',
        });
      }
    });

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return alerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]).slice(0, limit);
  }

  /**
   * Analyze slow-moving products
   */
  async analyzeSlowMovingProducts(merchantId: string, limit: number = 20): Promise<Array<{
    productId: string;
    productName: string;
    category: ProductCategory;
    daysInStock: number;
    salesVelocity: number;
    recommendation: string;
  }>> {
    logger.debug('Analyzing slow-moving products', { merchantId });

    const products: Array<{
      productId: string;
      productName: string;
      category: ProductCategory;
      daysInStock: number;
      salesVelocity: number;
      recommendation: string;
    }> = [];

    Object.keys(PRODUCT_CATEGORIES).slice(0, 5).forEach((cat, catIndex) => {
      PRODUCT_CATEGORIES[cat as ProductCategory].subcategories.slice(0, 3).forEach((subcategory, index) => {
        if (products.length >= limit) return;

        const daysInStock = Math.floor(Math.random() * 90) + 30;
        const salesVelocity = Math.random() * 2; // units per week

        if (salesVelocity < 1) {
          let recommendation: string;
          if (daysInStock > 60) {
            recommendation = 'Consider clearance pricing or bundle with popular items';
          } else if (salesVelocity < 0.5) {
            recommendation = 'Evaluate product-market fit, consider promotion';
          } else {
            recommendation = 'Monitor closely, optimize product visibility';
          }

          products.push({
            productId: `slow-${merchantId}-${catIndex}-${index}`,
            productName: this.formatProductName(subcategory),
            category: cat as ProductCategory,
            daysInStock,
            salesVelocity: Math.round(salesVelocity * 100) / 100,
            recommendation,
          });
        }
      });
    });

    return products.sort((a, b) => a.salesVelocity - b.salesVelocity);
  }

  /**
   * Generate seasonal inventory plan
   */
  async generateSeasonalPlan(merchantId: string, months: number = 3): Promise<Array<{
    month: string;
    categories: string[];
    demandFactor: number;
    recommendations: string[];
  }>> {
    logger.debug('Generating seasonal plan', { merchantId, months });

    const plan: Array<{
      month: string;
      categories: string[];
      demandFactor: number;
      recommendations: string[];
    }> = [];

    const currentMonth = new Date().getMonth();

    for (let i = 0; i < months; i++) {
      const monthIndex = (currentMonth + i) % 12;
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
      const monthName = monthNames[monthIndex];

      const seasonalData = SEASONAL_PATTERNS.month[monthName as keyof typeof SEASONAL_PATTERNS.month];

      if (seasonalData) {
        const demandFactor = seasonalData.categories.length > 2 ? 1.3 : 1.1;

        plan.push({
          month: monthName,
          categories: seasonalData.categories,
          demandFactor,
          recommendations: [
            `Prepare inventory for ${seasonalData.events.join(' and ')}`,
            `Focus on ${seasonalData.categories.slice(0, 3).join(', ')} categories`,
            demandFactor > 1.2 ? 'Increase stock levels by 20-30%' : 'Maintain current inventory levels',
          ],
        });
      } else {
        plan.push({
          month: monthName,
          categories: [],
          demandFactor: 1.0,
          recommendations: ['Standard inventory levels'],
        });
      }
    }

    return plan;
  }

  /**
   * Get inventory health report
   */
  async getInventoryHealth(merchantId: string): Promise<{
    overallHealth: string;
    healthScore: number;
    metrics: Record<string, number>;
    alerts: string[];
    recommendations: string[];
  }> {
    logger.debug('Checking inventory health', { merchantId });

    const reorderAlerts = await this.getReorderRecommendations(merchantId, 'critical', 10);

    const criticalCount = reorderAlerts.filter(a => a.urgency === UrgencyLevel.CRITICAL).length;
    const highCount = reorderAlerts.filter(a => a.urgency === UrgencyLevel.HIGH).length;

    let healthScore = 100;
    healthScore -= criticalCount * 15;
    healthScore -= highCount * 5;
    healthScore = Math.max(0, healthScore);

    let overallHealth = 'Healthy';
    if (healthScore < 50) {
      overallHealth = 'Critical';
    } else if (healthScore < 70) {
      overallHealth = 'At Risk';
    } else if (healthScore < 90) {
      overallHealth = 'Needs Attention';
    }

    return {
      overallHealth,
      healthScore,
      metrics: {
        criticalItems: criticalCount,
        highPriorityItems: highCount,
        totalAlerts: reorderAlerts.length,
      },
      alerts: reorderAlerts.slice(0, 5).map(a => a.message),
      recommendations: [
        criticalCount > 0 ? 'URGENT: Address critical inventory levels immediately' : 'Inventory levels are healthy',
        highCount > 0 ? 'Review high-priority reorder recommendations' : 'Continue monitoring current levels',
        'Update forecasts based on seasonal patterns',
      ],
    };
  }
}
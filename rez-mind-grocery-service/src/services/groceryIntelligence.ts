import { v4 as uuidv4 } from 'uuid';
import {
  GroceryCategory,
  ProductRecommendation,
  ExpiryAlert,
  DemandSignal,
  SupplierScore,
  DemandForecast,
  TrendDirection,
  UrgencyLevel,
  SuggestedAction,
} from '../types';
import {
  PRODUCT_CATEGORIES,
  SEASONAL_PATTERNS,
  EXPIRY_PATTERNS,
  CROSS_SELL_MAPPINGS,
  DEMAND_SIGNALS,
  REORDER_THRESHOLDS,
} from '../config/knowledge';
import { logger } from '../utils/logger';

interface RecommendationContext {
  hasBasket: boolean;
  hasHistory: boolean;
  preferencesCount: number;
}

export class GroceryIntelligence {
  /**
   * Predict expiry for a product
   */
  async predictExpiry(
    productId: string,
    batchDate: Date,
    storageConditions?: {
      temperature: number;
      humidity: number;
      refrigerated: boolean;
    }
  ): Promise<{
    predictionId: string;
    productId: string;
    predictedExpiryDate: Date;
    daysRemaining: number;
    confidence: number;
    suggestedAction: SuggestedAction;
    suggestedDiscount?: number;
    reasoning: string;
  }> {
    logger.debug('Predicting expiry', { productId, batchDate });

    const category = GroceryCategory.PRODUCE; // Default, would be determined from product data
    const pattern = EXPIRY_PATTERNS[category];

    // Calculate base shelf life
    let baseShelfLife = pattern.baseShelfLife;
    if (storageConditions?.refrigerated) {
      baseShelfLife = pattern.refrigeratedDays;
    }

    // Adjust for temperature conditions
    if (storageConditions?.temperature) {
      const optimalTemp = storageConditions.refrigerated ? 4 : 20;
      const tempDiff = Math.abs(storageConditions.temperature - optimalTemp);
      if (tempDiff > 10) {
        baseShelfLife *= 0.7; // Reduce shelf life if temperature is suboptimal
      } else if (tempDiff < 5) {
        baseShelfLife *= 1.1; // Slight improvement for optimal conditions
      }
    }

    // Calculate predicted expiry date
    const predictedExpiryDate = new Date(batchDate);
    predictedExpiryDate.setDate(predictedExpiryDate.getDate() + Math.floor(baseShelfLife));

    // Calculate days remaining
    const now = new Date();
    const daysRemaining = Math.max(0, Math.floor(
      (predictedExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));

    // Determine confidence based on data quality
    let confidence = 0.75;
    if (storageConditions) confidence += 0.1;
    if (storageConditions?.humidity) confidence += 0.05;

    // Determine suggested action
    let suggestedAction: SuggestedAction = SuggestedAction.MONITOR;
    let suggestedDiscount: number | undefined;

    if (daysRemaining <= pattern.criticalThreshold) {
      suggestedAction = SuggestedAction.REMOVE;
    } else if (daysRemaining <= pattern.donationThreshold) {
      suggestedAction = SuggestedAction.DONATE;
    } else if (daysRemaining <= pattern.suggestedDiscountStart) {
      suggestedAction = SuggestedAction.DISCOUNT;
      suggestedDiscount = Math.min(75, Math.max(25, (pattern.suggestedDiscountStart - daysRemaining + 1) * 25));
    }

    return {
      predictionId: uuidv4(),
      productId,
      predictedExpiryDate,
      daysRemaining,
      confidence: Math.min(0.95, confidence),
      suggestedAction,
      suggestedDiscount,
      reasoning: this.generateExpiryReasoning(category, daysRemaining, pattern),
    };
  }

  /**
   * Recommend products based on customer history and preferences
   */
  async recommendProducts(
    customerId: string | undefined,
    preferences: string[],
    limit: number = 10
  ): Promise<ProductRecommendation[]> {
    logger.debug('Generating product recommendations', { customerId, preferences });

    const recommendations: ProductRecommendation[] = [];
    const categories = Object.keys(GrocERY_CATEGORIES) as GroceryCategory[];

    // Get current month for seasonal patterns
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const seasonalPattern = SEASONAL_PATTERNS[currentMonth];

    // Filter categories based on preferences
    const preferredCategories = categories.filter(cat => {
      if (preferences.length === 0) return true;
      return preferences.some(pref =>
        PRODUCT_CATEGORIES[cat].name.toLowerCase().includes(pref.toLowerCase()) ||
        PRODUCT_CATEGORIES[cat].subcategories.some(sub =>
          sub.toLowerCase().includes(pref.toLowerCase())
        )
      );
    });

    // Generate recommendations
    preferredCategories.forEach((category, catIndex) => {
      const categoryData = PRODUCT_CATEGORIES[category];
      const isSeasonal = seasonalPattern?.categories.includes(category);

      categoryData.subcategories.slice(0, 3).forEach((subcategory, index) => {
        if (recommendations.length >= limit) return;

        // Check if it's a seasonal high-demand product
        const isHighDemand = seasonalPattern?.highDemandProducts.some(
          item => subcategory.toLowerCase().includes(item.toLowerCase())
        );

        const relevanceScore = isSeasonal && isHighDemand ? 90 + Math.random() * 10 : 50 + Math.random() * 40;
        const confidence = isSeasonal && isHighDemand ? 0.85 + Math.random() * 0.1 : 0.7 + Math.random() * 0.15;
        const urgency = isHighDemand ? UrgencyLevel.HIGH : UrgencyLevel.LOW;

        recommendations.push({
          productId: `rec-${category}-${index}`,
          productName: subcategory,
          category,
          confidence: Math.min(0.95, confidence),
          reason: isHighDemand
            ? `High demand seasonal item - popular this ${currentMonth}`
            : `Popular in ${categoryData.name}`,
          relevanceScore: Math.round(relevanceScore),
          urgency: index < 2 ? urgency : UrgencyLevel.LOW,
        });
      });
    });

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  }

  /**
   * Forecast demand for a product
   */
  async forecastDemand(
    merchantId: string,
    productId: string,
    daysAhead: number = 7
  ): Promise<DemandForecast> {
    logger.debug('Generating demand forecast', { merchantId, productId, daysAhead });

    const fromDate = new Date();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + daysAhead);

    // Get seasonal patterns
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const seasonalPattern = SEASONAL_PATTERNS[currentMonth];

    // Base demand with some randomness
    const baseDemand = Math.floor(Math.random() * 200) + 50;
    const seasonalFactor = seasonalPattern?.priceFluctuation
      ? 1 + seasonalPattern.priceFluctuation / 100
      : 1;

    const predictedQuantity = Math.floor(baseDemand * seasonalFactor);
    const lowerBound = Math.floor(predictedQuantity * 0.8);
    const upperBound = Math.floor(predictedQuantity * 1.2);

    // Determine trend
    let trend: TrendDirection = TrendDirection.STABLE;
    if (seasonalFactor > 1.15) trend = TrendDirection.TRENDING_UP;
    else if (seasonalFactor < 0.9) trend = TrendDirection.TRENDING_DOWN;

    return {
      forecastId: uuidv4(),
      productId,
      productName: `Product ${productId}`,
      predictedQuantity,
      confidence: 0.75 + Math.random() * 0.15,
      dateRange: { from: fromDate, to: toDate },
      confidenceInterval: { lower: lowerBound, upper: upperBound },
      trend,
      seasonality: {
        factor: seasonalFactor,
        peakMonths: seasonalPattern?.categories || [],
      },
      influencingFactors: this.getInfluencingFactors(seasonalPattern),
    };
  }

  /**
   * Score suppliers based on performance metrics
   */
  async scoreSuppliers(merchantId: string): Promise<SupplierScore[]> {
    logger.debug('Scoring suppliers', { merchantId });

    const suppliers: SupplierScore[] = [];
    const supplierNames = [
      'Fresh Farms Produce',
      'Valley Dairy Co',
      'Artisan Bakery Supply',
      'Mountain Frozen Foods',
      'Blue Sky Beverages',
      'Green Valley Essentials',
    ];

    supplierNames.forEach((name, index) => {
      const reliabilityScore = 65 + Math.random() * 30;
      const qualityScore = 70 + Math.random() * 25;
      const priceScore = 60 + Math.random() * 35;
      const sustainabilityScore = 50 + Math.random() * 40;
      const onTimeDeliveryRate = reliabilityScore;
      const orderAccuracy = qualityScore;

      const overallScore = Math.round(
        reliabilityScore * 0.3 +
        qualityScore * 0.25 +
        priceScore * 0.2 +
        sustainabilityScore * 0.15 +
        orderAccuracy * 0.1
      );

      let riskLevel: 'low' | 'medium' | 'high' = 'medium';
      if (reliabilityScore >= 90 && orderAccuracy >= 95) riskLevel = 'low';
      else if (reliabilityScore < 75 || orderAccuracy < 85) riskLevel = 'high';

      suppliers.push({
        supplierId: `sup-${merchantId}-${index}`,
        supplierName: name,
        overallScore,
        reliabilityScore: Math.round(reliabilityScore),
        qualityScore: Math.round(qualityScore),
        priceScore: Math.round(priceScore),
        sustainabilityScore: Math.round(sustainabilityScore),
        onTimeDeliveryRate: Math.round(onTimeDeliveryRate),
        orderAccuracy: Math.round(orderAccuracy),
        riskLevel,
        recommendation: overallScore >= 80
          ? 'Highly recommended'
          : overallScore >= 65
          ? 'Good value'
          : 'Consider alternatives',
        lastEvaluated: new Date(),
      });
    });

    return suppliers.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Generate expiry alerts for a merchant
   */
  async generateExpiryAlerts(merchantId: string): Promise<ExpiryAlert[]> {
    logger.debug('Generating expiry alerts', { merchantId });

    const alerts: ExpiryAlert[] = [];
    const categories = Object.keys(PRODUCT_CATEGORIES) as GroceryCategory[];

    categories.slice(0, 5).forEach((category, catIndex) => {
      const categoryData = PRODUCT_CATEGORIES[category];
      const pattern = EXPIRY_PATTERNS[category];

      categoryData.subcategories.slice(0, 3).forEach((subcategory, index) => {
        if (alerts.length >= 20) return;

        // Simulate varying days remaining
        const daysRemaining = Math.floor(Math.random() * 10) + 1;

        let urgency: UrgencyLevel;
        let recommendedAction: SuggestedAction;

        if (daysRemaining <= pattern.criticalThreshold) {
          urgency = UrgencyLevel.CRITICAL;
          recommendedAction = SuggestedAction.REMOVE;
        } else if (daysRemaining <= REORDER_THRESHOLDS.high.days_remaining) {
          urgency = UrgencyLevel.HIGH;
          recommendedAction = SuggestedAction.DISCOUNT;
        } else if (daysRemaining <= REORDER_THRESHOLDS.medium.days_remaining) {
          urgency = UrgencyLevel.MEDIUM;
          recommendedAction = SuggestedAction.DISCOUNT;
        } else {
          urgency = UrgencyLevel.LOW;
          recommendedAction = SuggestedAction.MONITOR;
        }

        alerts.push({
          alertId: `alert-${catIndex}-${index}`,
          productId: `prod-${category}-${index}`,
          productName: subcategory,
          currentStock: Math.floor(Math.random() * 50) + 10,
          predictedExpiryDate: new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000),
          daysRemaining,
          urgency,
          message: `${subcategory} will expire in ${daysRemaining} days`,
          recommendedAction,
          suggestedDiscount: recommendedAction === SuggestedAction.DISCOUNT
            ? Math.min(50, daysRemaining * 10)
            : undefined,
        });
      });
    });

    return alerts.sort((a, b) => a.urgency.localeCompare(b.urgency) || a.daysRemaining - b.daysRemaining);
  }

  /**
   * Get demand signals for a merchant
   */
  async getDemandSignals(merchantId: string): Promise<DemandSignal[]> {
    logger.debug('Getting demand signals', { merchantId });

    const signals: DemandSignal[] = [];
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const seasonalPattern = SEASONAL_PATTERNS[currentMonth];

    // Seasonal signal
    if (seasonalPattern) {
      signals.push({
        type: 'seasonal',
        value: seasonalPattern.priceFluctuation,
        timestamp: new Date(),
        source: 'SEASONAL_PATTERNS',
        affectedProducts: seasonalPattern.highDemandProducts,
      });
    }

    // Event signal (simulated)
    signals.push({
      type: 'event',
      value: 25,
      timestamp: new Date(),
      source: 'LOCAL_EVENTS',
      affectedProducts: ['snacks', 'beverages'],
    });

    // Weather signal (simulated)
    signals.push({
      type: 'weather',
      value: 15,
      timestamp: new Date(),
      source: 'WEATHER_API',
      affectedProducts: ['frozen', 'beverages'],
    });

    return signals;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(context: RecommendationContext): number {
    const { hasBasket, hasHistory, preferencesCount } = context;

    let confidence = 0.6;

    if (hasBasket) confidence += 0.15;
    if (hasHistory) confidence += 0.15;
    if (preferencesCount > 5) confidence += 0.1;

    return Math.min(0.95, Math.max(0.5, confidence));
  }

  /**
   * Generate expiry reasoning
   */
  private generateExpiryReasoning(category: GroceryCategory, daysRemaining: number, pattern: { baseShelfLife: number; category: GroceryCategory }): string {
    if (daysRemaining <= 1) {
      return `Critical: ${PRODUCT_CATEGORIES[category].name} typically lasts ${pattern.baseShelfLife} days - immediate action required`;
    } else if (daysRemaining <= 3) {
      return `High priority: ${PRODUCT_CATEGORIES[category].name} approaching expiry - consider discount or donation`;
    } else if (daysRemaining <= 7) {
      return `${PRODUCT_CATEGORIES[category].name} has ${daysRemaining} days remaining - monitor closely`;
    }
    return `${PRODUCT_CATEGORIES[category].name} in acceptable condition - ${daysRemaining} days to expiry`;
  }

  /**
   * Get influencing factors for forecast
   */
  private getInfluencingFactors(seasonalPattern: { categories: GroceryCategory[]; priceFluctuation: number } | undefined): string[] {
    const factors: string[] = ['historical_sales_data'];

    if (seasonalPattern) {
      factors.push(`seasonal_demand_${seasonalPattern.priceFluctuation}%`);
    }

    factors.push('weather_conditions', 'promotional_activities');

    return factors;
  }
}

export default GroceryIntelligence;
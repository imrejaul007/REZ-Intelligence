import { v4 as uuidv4 } from 'uuid';
import {
  GroceryCategory,
  ExpiryAlert,
  SuggestedAction,
  UrgencyLevel,
} from '../types';
import { EXPIRY_PATTERNS, REORDER_THRESHOLDS, WASTE_REDUCTION_STRATEGIES } from '../config/knowledge';
import { logger } from '../utils/logger';

interface ExpiryPredictionInput {
  productId: string;
  productName: string;
  category: GroceryCategory;
  batchDate: Date;
  storageConditions?: {
    temperature: number;
    humidity: number;
    refrigerated: boolean;
  };
}

interface DiscountSimulation {
  currentRevenue: number;
  projectedRevenue: number;
  expectedUnitsSold: number;
  wasteReduction: number;
  netImpact: number;
}

interface DiscountScenario {
  discountPercentage: number;
  newPrice: number;
  expectedSellThrough: number;
  expectedSold: number;
  projectedRevenue: number;
  projectedWasteUnits: number;
  projectedWasteValue: number;
}

export class ExpiryOptimizer {
  /**
   * Predict expiry date for a product
   */
  async predictExpiry(input: ExpiryPredictionInput): Promise<{
    predictionId: string;
    productId: string;
    predictedExpiryDate: Date;
    daysRemaining: number;
    confidence: number;
    suggestedAction: SuggestedAction;
    suggestedDiscount?: number;
    reasoning: string;
  }> {
    logger.debug('Predicting expiry', { productId: input.productId });

    const pattern = EXPIRY_PATTERNS[input.category];

    // Calculate base shelf life
    let baseShelfLife = pattern.baseShelfLife;
    if (input.storageConditions?.refrigerated) {
      baseShelfLife = pattern.refrigeratedDays;
    }

    // Adjust for temperature conditions
    if (input.storageConditions?.temperature) {
      const optimalTemp = input.storageConditions.refrigerated ? 4 : 20;
      const tempDiff = Math.abs(input.storageConditions.temperature - optimalTemp);
      if (tempDiff > 10) {
        baseShelfLife *= 0.7;
      } else if (tempDiff < 5) {
        baseShelfLife *= 1.1;
      }
    }

    // Calculate predicted expiry date
    const predictedExpiryDate = new Date(input.batchDate);
    predictedExpiryDate.setDate(predictedExpiryDate.getDate() + Math.floor(baseShelfLife));

    // Calculate days remaining
    const now = new Date();
    const daysRemaining = Math.max(0, Math.floor(
      (predictedExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));

    // Calculate confidence
    let confidence = 0.75;
    if (input.storageConditions) confidence += 0.1;
    if (input.storageConditions?.humidity) confidence += 0.05;

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
      productId: input.productId,
      predictedExpiryDate,
      daysRemaining,
      confidence: Math.min(0.95, confidence),
      suggestedAction,
      suggestedDiscount,
      reasoning: this.generateReasoning(input.category, daysRemaining, pattern.baseShelfLife),
    };
  }

  /**
   * Optimize pricing based on days to expiry
   */
  optimizePricing(productId: string, daysToExpiry: number): {
    suggestedDiscount: number;
    donationThreshold: number;
    reasoning: string;
  } {
    logger.debug('Optimizing pricing', { productId, daysToExpiry });

    let suggestedDiscount = 0;
    const discountSchedule = WASTE_REDUCTION_STRATEGIES.discount_schedule;

    for (const schedule of discountSchedule) {
      if (schedule.daysRemaining !== undefined && daysToExpiry <= schedule.daysRemaining) {
        suggestedDiscount = schedule.discountPercentage;
        break;
      }
      if (schedule.hoursRemaining !== undefined && daysToExpiry * 24 <= schedule.hoursRemaining) {
        suggestedDiscount = schedule.discountPercentage;
        break;
      }
    }

    // Calculate donation threshold
    const donationThreshold = daysToExpiry <= 2 ? 50 : daysToExpiry <= 3 ? 75 : 100;

    return {
      suggestedDiscount,
      donationThreshold,
      reasoning: suggestedDiscount > 0
        ? `Apply ${suggestedDiscount}% discount to maximize recovery before expiry`
        : `Product has ${daysToExpiry} days remaining - monitor for now`,
    };
  }

  /**
   * Generate expiry alerts for a product
   */
  generateExpiryAlert(productId: string, productName: string, daysRemaining: number, currentStock: number): ExpiryAlert {
    let urgency: UrgencyLevel;
    let recommendedAction: SuggestedAction;
    let suggestedDiscount: number | undefined;

    if (daysRemaining <= REORDER_THRESHOLDS.critical.days_remaining) {
      urgency = UrgencyLevel.CRITICAL;
      recommendedAction = SuggestedAction.REMOVE;
    } else if (daysRemaining <= REORDER_THRESHOLDS.high.days_remaining) {
      urgency = UrgencyLevel.HIGH;
      recommendedAction = SuggestedAction.DISCOUNT;
      suggestedDiscount = 50;
    } else if (daysRemaining <= REORDER_THRESHOLDS.medium.days_remaining) {
      urgency = UrgencyLevel.MEDIUM;
      recommendedAction = SuggestedAction.DISCOUNT;
      suggestedDiscount = 25;
    } else {
      urgency = UrgencyLevel.LOW;
      recommendedAction = SuggestedAction.MONITOR;
    }

    return {
      alertId: uuidv4(),
      productId,
      productName,
      currentStock,
      predictedExpiryDate: new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000),
      daysRemaining,
      urgency,
      message: `${productName} will expire in ${daysRemaining} days - ${currentStock} units in stock`,
      recommendedAction,
      suggestedDiscount,
    };
  }

  /**
   * Generate multiple expiry alerts for a merchant
   */
  async generateExpiryAlerts(merchantId: string): Promise<ExpiryAlert[]> {
    logger.debug('Generating expiry alerts', { merchantId });

    const alerts: ExpiryAlert[] = [];
    const categories = Object.keys(EXPIRY_PATTERNS) as GroceryCategory[];

    categories.forEach((category, catIndex) => {
      const pattern = EXPIRY_PATTERNS[category];
      const baseName = category.charAt(0).toUpperCase() + category.slice(1);

      // Generate alerts for items approaching expiry
      for (let i = 0; i < 3 && alerts.length < 20; i++) {
        const daysRemaining = Math.floor(Math.random() * 7) + 1;
        alerts.push(
          this.generateExpiryAlert(
            `prod-${category}-${i}`,
            `${baseName} Item ${i + 1}`,
            daysRemaining,
            Math.floor(Math.random() * 30) + 5
          )
        );
      }
    });

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /**
   * Simulate discount impact on revenue and waste
   */
  simulateDiscountImpact(params: {
    productId: string;
    currentStock: number;
    currentPrice: number;
    discountPercentage: number;
  }): DiscountSimulation {
    const { currentStock, currentPrice, discountPercentage } = params;

    const newPrice = currentPrice * (1 - discountPercentage / 100);
    const currentRevenue = currentStock * currentPrice;

    // Calculate expected sell-through based on discount
    // Higher discounts = higher sell-through
    const baseSellThrough = 30;
    const discountEffect = Math.min(70, discountPercentage * 1.2);
    const expectedSellThrough = Math.min(100, baseSellThrough + discountEffect);
    const expectedUnitsSold = Math.floor(currentStock * (expectedSellThrough / 100));
    const wasteUnits = currentStock - expectedUnitsSold;

    const projectedRevenue = expectedUnitsSold * newPrice;
    const wasteValue = wasteUnits * currentPrice;
    const wasteReduction = ((currentStock - wasteUnits) / currentStock) * 100;
    const netImpact = projectedRevenue - currentRevenue;

    return {
      currentRevenue,
      projectedRevenue,
      expectedUnitsSold,
      wasteReduction: Math.round(wasteReduction * 10) / 10,
      netImpact: Math.round(netImpact * 100) / 100,
    };
  }

  /**
   * Generate discount recommendation based on scenarios
   */
  generateDiscountRecommendation(currentStock: number, scenarios: DiscountScenario[]): {
    recommendedDiscount: number;
    reasoning: string;
    expectedOutcome: string;
  } {
    // Find scenario with best net revenue
    const bestScenario = scenarios.reduce((best, current) => {
      const bestNet = best.projectedRevenue - best.projectedWasteValue;
      const currentNet = current.projectedRevenue - current.projectedWasteValue;
      return currentNet > bestNet ? current : best;
    });

    // Calculate total value (revenue - waste cost)
    const totalValue = scenarios.map(s => ({
      ...s,
      totalValue: s.projectedRevenue - s.projectedWasteValue,
    }));

    const bestValue = totalValue.reduce((best, current) =>
      current.totalValue > best.totalValue ? current : best
    );

    return {
      recommendedDiscount: bestValue.discountPercentage,
      reasoning: `A ${bestValue.discountPercentage}% discount maximizes total value at $${bestValue.totalValue.toFixed(2)} while reducing waste to ${bestValue.projectedWasteUnits} units`,
      expectedOutcome: `Expected to sell ${bestValue.expectedSold} units (${bestValue.expectedSellThrough}% sell-through) with $${bestValue.projectedRevenue.toFixed(2)} in revenue`,
    };
  }

  /**
   * Generate reasoning for expiry prediction
   */
  private generateReasoning(category: GroceryCategory, daysRemaining: number, baseShelfLife: number): string {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

    if (daysRemaining <= 1) {
      return `Critical: ${categoryName} items typically last ${baseShelfLife} days - immediate action required`;
    } else if (daysRemaining <= 3) {
      return `High priority: ${categoryName} approaching expiry - consider discount or donation`;
    } else if (daysRemaining <= 7) {
      return `${categoryName} has ${daysRemaining} days remaining - monitor closely for changes`;
    }
    return `${categoryName} in acceptable condition - ${daysRemaining} days to expiry`;
  }

  /**
   * Calculate donation eligibility
   */
  isEligibleForDonation(daysRemaining: number, pattern: { donationThreshold: number }): boolean {
    return daysRemaining <= pattern.donationThreshold && daysRemaining > 0;
  }

  /**
   * Get waste reduction statistics
   */
  getWasteReductionStats(alerts: ExpiryAlert[]): {
    totalUnitsAtRisk: number;
    potentialWaste: number;
    recoverableUnits: number;
    estimatedSavings: number;
  } {
    const critical = alerts.filter(a => a.urgency === UrgencyLevel.CRITICAL);
    const high = alerts.filter(a => a.urgency === UrgencyLevel.HIGH);

    const totalUnitsAtRisk = alerts.reduce((sum, a) => sum + a.currentStock, 0);
    const potentialWaste = (critical.length + high.length) * 0.3; // Estimated 30% waste
    const recoverableUnits = Math.floor(totalUnitsAtRisk * 0.5); // 50% can be recovered
    const estimatedSavings = recoverableUnits * 2.5; // Estimated $2.50 per unit

    return {
      totalUnitsAtRisk,
      potentialWaste: Math.round(potentialWaste),
      recoverableUnits,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
    };
  }
}

export default ExpiryOptimizer;
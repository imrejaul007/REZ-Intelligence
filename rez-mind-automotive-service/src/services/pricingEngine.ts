import { PricingOptimization } from '../models';
import { getPricingFactors } from '../config/knowledge';
import { IVehiclePricingData } from '../types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface PricingAnalysisResult {
  pricingId: string;
  vehicleData: IVehiclePricingData;
  recommendation: {
    minPrice: number;
    optimalPrice: number;
    maxPrice: number;
    confidence: number;
    currency: string;
  };
  factors: Array<{
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    description: string;
  }>;
  marketAnalysis: {
    demand: 'high' | 'medium' | 'low';
    competition: 'low' | 'medium' | 'high';
    trend: 'appreciation' | 'stable' | 'depreciation';
  };
  suggestedPricing: Array<{
    strategy: string;
    price: number;
    expectedDaysToSell: string;
    confidence: number;
  }>;
  timestamp: Date;
}

class PricingEngineService {
  /**
   * Generate pricing recommendation
   */
  async recommendPricing(
    vehicleData: IVehiclePricingData,
    merchantId: string,
    strategy: 'quick_sale' | 'max_value' | 'balanced' = 'balanced'
  ): Promise<PricingAnalysisResult> {
    logger.info('Generating pricing recommendation', { merchantId, strategy });

    // Calculate factors
    const { factors, basePrice } = getPricingFactors(vehicleData, vehicleData.marketData);

    // Calculate price range based on factors
    const currentYear = new Date().getFullYear();
    const age = currentYear - vehicleData.year;
    const expectedDepreciation = Math.pow(0.85, Math.min(age, 15));

    // Base price calculation (using market avg if available)
    let calculatedBase = vehicleData.marketData?.avgPrice || basePrice;

    // Adjust for condition
    const conditionMultipliers: Record<string, number> = {
      excellent: 1.15,
      good: 1.0,
      fair: 0.85,
      poor: 0.7,
    };
    const conditionMultiplier = conditionMultipliers[vehicleData.condition || 'good'];
    calculatedBase *= conditionMultiplier;

    // Calculate price range
    const minPrice = Math.round(calculatedBase * 0.85);
    const optimalPrice = Math.round(calculatedBase);
    const maxPrice = Math.round(calculatedBase * 1.15);

    // Confidence based on data completeness
    let confidence = 0.6;
    if (vehicleData.marketData?.avgPrice) confidence += 0.15;
    if (vehicleData.marketData?.similarListings && vehicleData.marketData.similarListings > 5) confidence += 0.1;
    if (vehicleData.condition) confidence += 0.1;
    if (vehicleData.location) confidence += 0.05;

    // Generate suggested pricing for different strategies
    const suggestedPricing = this.getStrategyPricing(optimalPrice, minPrice, maxPrice, strategy);

    // Market analysis based on vehicle characteristics
    const marketAnalysis = this.analyzeMarket(vehicleData);

    // Save to database
    const pricingRecord = new PricingOptimization({
      pricingId: `POP-${Date.now().toString(36)}-${uuidv4().substring(0, 6).toUpperCase()}`,
      merchantId,
      vehicleData,
      recommendation: {
        minPrice,
        optimalPrice,
        maxPrice,
        confidence,
        currency: 'INR',
      },
      factors,
      marketAnalysis,
    });
    await pricingRecord.save();

    const result: PricingAnalysisResult = {
      pricingId: pricingRecord.pricingId,
      vehicleData,
      recommendation: {
        minPrice,
        optimalPrice,
        maxPrice,
        confidence,
        currency: 'INR',
      },
      factors,
      marketAnalysis,
      suggestedPricing,
      timestamp: new Date(),
    };

    logger.info('Pricing recommendation generated', { pricingId: pricingRecord.pricingId, optimalPrice });

    return result;
  }

  /**
   * Get pricing for different strategies
   */
  private getStrategyPricing(
    optimalPrice: number,
    minPrice: number,
    maxPrice: number,
    selectedStrategy: 'quick_sale' | 'max_value' | 'balanced'
  ): PricingAnalysisResult['suggestedPricing'] {
    const strategies: PricingAnalysisResult['suggestedPricing'] = [];

    // Quick sale strategy
    strategies.push({
      strategy: 'Quick Sale',
      price: Math.round(minPrice * 1.05),
      expectedDaysToSell: '7-14 days',
      confidence: 0.85,
    });

    // Balanced strategy
    strategies.push({
      strategy: 'Balanced',
      price: Math.round(optimalPrice * 0.98),
      expectedDaysToSell: '30-45 days',
      confidence: 0.7,
    });

    // Max value strategy
    strategies.push({
      strategy: 'Maximum Value',
      price: Math.round(maxPrice * 0.95),
      expectedDaysToSell: '60-90 days',
      confidence: 0.5,
    });

    // Return all strategies or just the selected one
    if (selectedStrategy !== 'balanced') {
      return strategies;
    }

    return strategies;
  }

  /**
   * Analyze market conditions
   */
  private analyzeMarket(vehicleData: IVehiclePricingData): PricingAnalysisResult['marketAnalysis'] {
    const { fuelType, year, transmission } = vehicleData;
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;

    // Determine demand
    let demand: 'high' | 'medium' | 'low' = 'medium';
    if (fuelType === 'electric' || fuelType === 'hybrid') demand = 'high';
    else if (fuelType === 'diesel' && age > 5) demand = 'low';
    else if (age <= 3 && transmission === 'auto') demand = 'high';

    // Determine competition
    let competition: 'low' | 'medium' | 'high' = 'medium';
    if (vehicleData.marketData) {
      if (vehicleData.marketData.similarListings < 5) competition = 'low';
      else if (vehicleData.marketData.similarListings > 20) competition = 'high';
    }

    // Determine trend
    let trend: 'appreciation' | 'stable' | 'depreciation' = 'stable';
    if (fuelType === 'electric') trend = 'appreciation';
    else if (age > 10) trend = 'depreciation';
    else if (fuelType === 'diesel') trend = 'depreciation';

    return { demand, competition, trend };
  }

  /**
   * Analyze market positioning
   */
  async analyzeMarketPositioning(merchantId: string, vehicleData: IVehiclePricingData) {
    // Find recent pricing for similar vehicles
    const similarPricings = await PricingOptimization.find({
      merchantId,
      'vehicleData.make': vehicleData.make,
      'vehicleData.model': vehicleData.model,
    }).sort({ createdAt: -1 }).limit(10);

    const marketStats = {
      yourAvgPrice: 0,
      yourMinPrice: 0,
      yourMaxPrice: 0,
      marketAvgPrice: vehicleData.marketData?.avgPrice || 0,
      priceDifference: 0,
      percentageDiff: 0,
    };

    if (similarPricings.length > 0) {
      const prices = similarPricings.map(p => p.recommendation.optimalPrice);
      marketStats.yourAvgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      marketStats.yourMinPrice = Math.min(...prices);
      marketStats.yourMaxPrice = Math.max(...prices);
      marketStats.priceDifference = marketStats.yourAvgPrice - marketStats.marketAvgPrice;
      marketStats.percentageDiff = marketStats.marketAvgPrice
        ? (marketStats.priceDifference / marketStats.marketAvgPrice) * 100
        : 0;
    }

    return marketStats;
  }

  /**
   * Get pricing history for merchant
   */
  async getPricingHistory(merchantId: string, limit: number = 50) {
    return PricingOptimization.getHistory(merchantId, limit);
  }
}

export const pricingEngineService = new PricingEngineService();
export default pricingEngineService;
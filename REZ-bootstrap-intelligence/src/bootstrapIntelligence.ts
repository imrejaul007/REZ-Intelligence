/**
 * REZ Bootstrap Intelligence Service
 *
 * Cold start solutions for new merchants, users, and markets
 *
 * Problem Solved:
 * - New merchants have no historical data
 * - New users have no behavioral signals
 * - New markets have no local patterns
 * - AI models need data to work
 *
 * Solution:
 * - City-level priors
 * - Category baselines
 * - Synthetic recommendations
 * - Collaborative bootstrapping
 * - External data enrichment
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface CityPrior {
  city: string;
  tier: 'tier1' | 'tier2' | 'tier3';

  // Order patterns
  avgOrderValue: number;
  avgOrdersPerUser: number;
  peakHours: number[];
  popularCategories: string[];

  // Demographics
  medianIncome: number;
  workingPopulationRatio: number;
  avgAge: number;

  // Time patterns
  weekendMultiplier: number;
  eveningMultiplier: number;

  // Category distribution
  categoryDistribution: Record<string, number>;

  // Seasonal patterns
  monsoonImpact: number;
  festivalSpikes: { name: string; month: number; multiplier: number }[];
}

export interface CategoryBaseline {
  category: string;

  // Price distribution
  avgPrice: number;
  priceRange: { min: number; max: number };

  // Order patterns
  avgOrderFrequency: number;        // Per week
  avgItemsPerOrder: number;
  repeatRate: number;

  // Timing
  avgDeliveryTime: number;          // Minutes
  peakHours: number[];

  // Quality
  avgRating: number;
  avgReviewLength: number;

  // Success metrics
  conversionRate: number;          // Views to orders
  cancellationRate: number;
  refundRate: number;
}

export interface MerchantBootstrap {
  merchantId: string;
  category: string;
  city: string;

  // Recommended starting values
  startingCashback: number;         // Percentage
  recommendedPricing: { min: number; max: number; optimal: number };
  expectedOrderVolume: number;       // Per day
  peakHours: number[];

  // Launch strategy
  launchOffers: {
    type: 'discount' | 'free_delivery' | 'cashback' | 'combo';
    value: number;
    duration: number;              // Days
    description: string;
  }[];

  // Category insights
  categoryInsights: {
    avgRating: number;
    avgPrice: number;
    topCompetitors: number;
    marketGap: string;
  };
}

export interface UserBootstrap {
  userId: string;
  city: string;
  source: 'organic' | 'referral' | 'campaign' | 'qr';

  // Starting segments
  assignedSegments: string[];

  // Initial recommendations
  startingRecommendations: {
    type: 'category' | 'merchant' | 'product';
    id: string;
    score: number;
    reason: string;
  }[];

  // Onboarding offers
  welcomeOffers: {
    type: string;
    value: number;
    expiresIn: number;            // Days
  }[];

  // Expected behavior predictions
  predictedMetrics: {
    firstOrderProbability: number;
    expectedOrderValue: number;
    expectedRetention: number;     // 30-day
  };
}

export interface MarketBootstrap {
  marketId: string;
  city: string;
  category?: string;

  // Market readiness
  readinessScore: number;          // 0-100

  // Growth indicators
  indicators: {
    merchantDemand: number;
    consumerDemand: number;
    competitionLevel: number;
    seasonalityFactor: number;
  };

  // Launch recommendations
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: number;
  }[];

  // Success benchmarks
  benchmarks: {
    targetOrders: number;
    targetMerchants: number;
    targetUsers: number;
    timeline: string;
  };
}

// ============================================================================
// City Priors Database
// ============================================================================

class CityPriorsDatabase {
  private cities: Map<string, CityPrior> = new Map();

  constructor() {
    this.seedCityPriors();
  }

  private seedCityPriors(): void {
    const cityData: CityPrior[] = [
      {
        city: 'mumbai',
        tier: 'tier1',
        avgOrderValue: 450,
        avgOrdersPerUser: 4,
        peakHours: [12, 13, 19, 20, 21],
        popularCategories: ['pizza', 'biryani', 'chinese', 'mumbai_street'],
        medianIncome: 800000,
        workingPopulationRatio: 0.65,
        avgAge: 32,
        weekendMultiplier: 1.3,
        eveningMultiplier: 1.8,
        categoryDistribution: {
          'pizza': 0.25,
          'biryani': 0.20,
          'chinese': 0.15,
          'mumbai_street': 0.12,
          'desserts': 0.08,
          'other': 0.20
        },
        monsoonImpact: 1.4,
        festivalSpikes: [
          { name: 'Ganesh Chaturthi', month: 9, multiplier: 1.5 },
          { name: 'Diwali', month: 11, multiplier: 1.8 }
        ]
      },
      {
        city: 'delhi',
        tier: 'tier1',
        avgOrderValue: 380,
        avgOrdersPerUser: 3.5,
        peakHours: [12, 13, 19, 20, 21, 22],
        popularCategories: ['biryani', 'mughlai', 'north_indian', 'chinese', 'pizza'],
        medianIncome: 750000,
        workingPopulationRatio: 0.60,
        avgAge: 30,
        weekendMultiplier: 1.2,
        eveningMultiplier: 1.6,
        categoryDistribution: {
          'biryani': 0.30,
          'mughlai': 0.20,
          'north_indian': 0.18,
          'chinese': 0.12,
          'pizza': 0.08,
          'other': 0.12
        },
        monsoonImpact: 1.2,
        festivalSpikes: [
          { name: 'Diwali', month: 11, multiplier: 2.0 },
          { name: 'Holi', month: 3, multiplier: 1.4 }
        ]
      },
      {
        city: 'bangalore',
        tier: 'tier1',
        avgOrderValue: 520,
        avgOrdersPerUser: 5,
        peakHours: [12, 13, 18, 19, 20, 21],
        popularCategories: ['south_indian', 'biryani', 'cafe', 'pizza', 'healthy'],
        medianIncome: 950000,
        workingPopulationRatio: 0.70,
        avgAge: 28,
        weekendMultiplier: 1.4,
        eveningMultiplier: 1.5,
        categoryDistribution: {
          'south_indian': 0.22,
          'biryani': 0.18,
          'cafe': 0.15,
          'pizza': 0.15,
          'healthy': 0.12,
          'other': 0.18
        },
        monsoonImpact: 1.3,
        festivalSpikes: [
          { name: 'Diwali', month: 11, multiplier: 1.6 }
        ]
      },
      {
        city: 'hyderabad',
        tier: 'tier1',
        avgOrderValue: 350,
        avgOrdersPerUser: 4.5,
        peakHours: [12, 13, 19, 20, 21],
        popularCategories: ['biryani', 'chinese', 'south_indian', 'burger', 'pizza'],
        medianIncome: 700000,
        workingPopulationRatio: 0.58,
        avgAge: 29,
        weekendMultiplier: 1.5,
        eveningMultiplier: 1.7,
        categoryDistribution: {
          'biryani': 0.35,
          'chinese': 0.18,
          'south_indian': 0.15,
          'burger': 0.10,
          'pizza': 0.08,
          'other': 0.14
        },
        monsoonImpact: 1.1,
        festivalSpikes: [
          { name: 'Bonalu', month: 8, multiplier: 1.4 }
        ]
      },
      {
        city: 'pune',
        tier: 'tier2',
        avgOrderValue: 400,
        avgOrdersPerUser: 3.8,
        peakHours: [12, 13, 19, 20, 21],
        popularCategories: ['pizza', 'biryani', 'north_indian', 'chinese'],
        medianIncome: 650000,
        workingPopulationRatio: 0.62,
        avgAge: 28,
        weekendMultiplier: 1.25,
        eveningMultiplier: 1.55,
        categoryDistribution: {
          'pizza': 0.25,
          'biryani': 0.22,
          'north_indian': 0.18,
          'chinese': 0.15,
          'other': 0.20
        },
        monsoonImpact: 1.15,
        festivalSpikes: []
      },
      {
        city: 'chennai',
        tier: 'tier2',
        avgOrderValue: 380,
        avgOrdersPerUser: 3.2,
        peakHours: [12, 13, 19, 20],
        popularCategories: ['south_indian', 'biryani', 'chinese', 'desserts'],
        medianIncome: 600000,
        workingPopulationRatio: 0.55,
        avgAge: 31,
        weekendMultiplier: 1.15,
        eveningMultiplier: 1.4,
        categoryDistribution: {
          'south_indian': 0.40,
          'biryani': 0.20,
          'chinese': 0.15,
          'desserts': 0.10,
          'other': 0.15
        },
        monsoonImpact: 1.2,
        festivalSpikes: [
          { name: 'Pongal', month: 1, multiplier: 1.5 }
        ]
      }
    ];

    cityData.forEach(city => this.cities.set(city.city, city));
  }

  getCity(city: string): CityPrior | null {
    return this.cities.get(city.toLowerCase()) || this.cities.get('mumbai')!;
  }

  getAllCities(): CityPrior[] {
    return Array.from(this.cities.values());
  }
}

// ============================================================================
// Category Baselines Database
// ============================================================================

class CategoryBaselinesDatabase {
  private baselines: Map<string, CategoryBaseline> = new Map();

  constructor() {
    this.seedBaselines();
  }

  private seedBaselines(): void {
    const baselineData: CategoryBaseline[] = [
      {
        category: 'pizza',
        avgPrice: 450,
        priceRange: { min: 199, max: 999 },
        avgOrderFrequency: 2.5,
        avgItemsPerOrder: 1.8,
        repeatRate: 0.45,
        avgDeliveryTime: 35,
        peakHours: [18, 19, 20, 21],
        avgRating: 4.1,
        avgReviewLength: 85,
        conversionRate: 0.12,
        cancellationRate: 0.03,
        refundRate: 0.02
      },
      {
        category: 'biryani',
        avgPrice: 280,
        priceRange: { min: 150, max: 500 },
        avgOrderFrequency: 3.2,
        avgItemsPerOrder: 1.2,
        repeatRate: 0.55,
        avgDeliveryTime: 30,
        peakHours: [12, 13, 19, 20, 21],
        avgRating: 4.3,
        avgReviewLength: 65,
        conversionRate: 0.18,
        cancellationRate: 0.02,
        refundRate: 0.01
      },
      {
        category: 'cafe',
        avgPrice: 350,
        priceRange: { min: 150, max: 700 },
        avgOrderFrequency: 1.8,
        avgItemsPerOrder: 2.5,
        repeatRate: 0.35,
        avgDeliveryTime: 40,
        peakHours: [11, 12, 14, 15, 18],
        avgRating: 4.2,
        avgReviewLength: 120,
        conversionRate: 0.08,
        cancellationRate: 0.05,
        refundRate: 0.03
      },
      {
        category: 'north_indian',
        avgPrice: 320,
        priceRange: { min: 180, max: 600 },
        avgOrderFrequency: 2.8,
        avgItemsPerOrder: 1.5,
        repeatRate: 0.50,
        avgDeliveryTime: 35,
        peakHours: [12, 13, 19, 20, 21],
        avgRating: 4.0,
        avgReviewLength: 75,
        conversionRate: 0.14,
        cancellationRate: 0.03,
        refundRate: 0.02
      },
      {
        category: 'healthy',
        avgPrice: 420,
        priceRange: { min: 250, max: 800 },
        avgOrderFrequency: 1.5,
        avgItemsPerOrder: 1.3,
        repeatRate: 0.30,
        avgDeliveryTime: 30,
        peakHours: [12, 13, 18, 19],
        avgRating: 4.4,
        avgReviewLength: 95,
        conversionRate: 0.06,
        cancellationRate: 0.02,
        refundRate: 0.01
      },
      {
        category: 'south_indian',
        avgPrice: 220,
        priceRange: { min: 120, max: 400 },
        avgOrderFrequency: 3.5,
        avgItemsPerOrder: 1.8,
        repeatRate: 0.60,
        avgDeliveryTime: 28,
        peakHours: [7, 8, 12, 13, 19, 20],
        avgRating: 4.2,
        avgReviewLength: 55,
        conversionRate: 0.20,
        cancellationRate: 0.02,
        refundRate: 0.01
      }
    ];

    baselineData.forEach(b => this.baselines.set(b.category, b));
  }

  getCategory(category: string): CategoryBaseline | null {
    return this.baselines.get(category.toLowerCase()) || null;
  }

  getAllCategories(): CategoryBaseline[] {
    return Array.from(this.baselines.values());
  }
}

// ============================================================================
// Bootstrap Intelligence Service
// ============================================================================

export class BootstrapIntelligenceService {
  private cityPriors: CityPriorsDatabase;
  private categoryBaselines: CategoryBaselinesDatabase;

  constructor() {
    this.cityPriors = new CityPriorsDatabase();
    this.categoryBaselines = new CategoryBaselinesDatabase();
  }

  // ============================================
  // Merchant Bootstrap
  // ============================================

  /**
   * Get merchant bootstrap data for launch
   */
  getMerchantBootstrap(merchantId: string, category: string, city: string): MerchantBootstrap {
    const cityPrior = this.cityPriors.getCity(city);
    const categoryBaseline = this.categoryBaselines.getCategory(category);

    // Calculate starting cashback based on competition
    const startingCashback = this.calculateStartingCashback(categoryBaseline, cityPrior);

    // Calculate recommended pricing
    const recommendedPricing = this.calculateRecommendedPricing(categoryBaseline, cityPrior);

    // Calculate expected order volume
    const expectedOrderVolume = this.calculateExpectedOrders(categoryBaseline, cityPrior);

    // Generate launch offers
    const launchOffers = this.generateLaunchOffers(categoryBaseline, cityPrior);

    // Generate category insights
    const categoryInsights = this.generateCategoryInsights(categoryBaseline, category);

    return {
      merchantId,
      category,
      city,
      startingCashback,
      recommendedPricing,
      expectedOrderVolume,
      peakHours: categoryBaseline?.peakHours || [12, 13, 19, 20, 21],
      launchOffers,
      categoryInsights
    };
  }

  private calculateStartingCashback(category?: CategoryBaseline | null, city?: CityPrior | null): number {
    let base = 5; // Base 5% cashback

    // Category adjustments
    if (category) {
      if (category.conversionRate > 0.15) base -= 1; // High competition
      if (category.repeatRate > 0.5) base += 1; // High loyalty category
    }

    // City adjustments
    if (city) {
      if (city.tier === 'tier1') base += 1;
      if (city.tier === 'tier3') base += 2; // Incentivize
    }

    return Math.min(base, 12); // Cap at 12%
  }

  private calculateRecommendedPricing(category?: CategoryBaseline | null, city?: CityPrior | null): { min: number; max: number; optimal: number } {
    if (category) {
      const min = category.priceRange.min;
      const max = category.priceRange.max;
      const optimal = category.avgPrice;
      return { min, max, optimal };
    }

    return { min: 150, max: 500, optimal: 300 };
  }

  private calculateExpectedOrders(category?: CategoryBaseline | null, city?: CityPrior | null): number {
    let base = 20; // Base 20 orders/day

    if (category) {
      base *= category.avgOrderFrequency / 3;
    }

    if (city) {
      base *= city.avgOrdersPerUser / 4;
      if (city.tier === 'tier1') base *= 1.5;
      if (city.tier === 'tier2') base *= 1.0;
      if (city.tier === 'tier3') base *= 0.7;
    }

    return Math.round(base);
  }

  private generateLaunchOffers(category?: CategoryBaseline | null, city?: CityPrior | null): MerchantBootstrap['launchOffers'] {
    const offers: MerchantBootstrap['launchOffers'] = [];

    // Welcome discount
    offers.push({
      type: 'discount',
      value: 15,
      duration: 14,
      description: '15% off for first 2 weeks to attract initial customers'
    });

    // Free delivery
    offers.push({
      type: 'free_delivery',
      value: 0,
      duration: 30,
      description: 'Free delivery for first month to reduce friction'
    });

    // Cashback boost
    offers.push({
      type: 'cashback',
      value: 5,
      duration: 60,
      description: '5% extra cashback to encourage repeat orders'
    });

    // Combo offer
    offers.push({
      type: 'combo',
      value: 20,
      duration: 7,
      description: 'Launch combo at 20% discount for viral potential'
    });

    return offers;
  }

  private generateCategoryInsights(category?: CategoryBaseline | null, categoryName: string): MerchantBootstrap['categoryInsights'] {
    return {
      avgRating: category?.avgRating || 4.0,
      avgPrice: category?.avgPrice || 300,
      topCompetitors: 10, // Placeholder
      marketGap: category ? `Focus on quality and repeat customers` : `Differentiate with unique offerings`
    };
  }

  // ============================================
  // User Bootstrap
  // ============================================

  /**
   * Get user bootstrap data for personalization
   */
  getUserBootstrap(userId: string, city: string, source: UserBootstrap['source']): UserBootstrap {
    const cityPrior = this.cityPriors.getCity(city);

    // Assign initial segments
    const segments = this.assignInitialSegments(cityPrior, source);

    // Generate starting recommendations
    const recommendations = this.generateInitialRecommendations(cityPrior, segments);

    // Generate welcome offers
    const offers = this.generateWelcomeOffers(source);

    // Predict expected behavior
    const predictions = this.predictInitialBehavior(cityPrior, source);

    return {
      userId,
      city,
      source,
      assignedSegments: segments,
      startingRecommendations: recommendations,
      welcomeOffers: offers,
      predictedMetrics: predictions
    };
  }

  private assignInitialSegments(city?: CityPrior | null, source?: UserBootstrap['source']): string[] {
    const segments = ['new_user'];

    if (source === 'referral') segments.push('referred_user');
    if (source === 'qr') segments.push('qr_user');
    if (source === 'campaign') segments.push('campaign_acquired');

    // City-based segments
    if (city) {
      segments.push(`${city.tier}_city`);
      if (city.popularCategories.length > 0) {
        segments.push(`${city.popularCategories[0]}_lover`);
      }
    }

    return segments;
  }

  private generateInitialRecommendations(city?: CityPrior | null, segments?: string[]): UserBootstrap['startingRecommendations'] {
    const recommendations: UserBootstrap['startingRecommendations'] = [];

    // Category recommendations based on city
    if (city) {
      city.popularCategories.slice(0, 3).forEach((cat, i) => {
        recommendations.push({
          type: 'category',
          id: cat,
          score: 0.9 - (i * 0.1),
          reason: `Popular in ${city.city}`
        });
      });
    }

    // Default categories
    if (recommendations.length < 3) {
      recommendations.push({
        type: 'category',
        id: 'pizza',
        score: 0.7,
        reason: 'Popular choice'
      });
      recommendations.push({
        type: 'category',
        id: 'biryani',
        score: 0.75,
        reason: 'Most ordered category'
      });
    }

    return recommendations;
  }

  private generateWelcomeOffers(source?: UserBootstrap['source']): UserBootstrap['welcomeOffers'] {
    const offers: UserBootstrap['welcomeOffers'] = [];

    // New user discount
    offers.push({
      type: 'first_order_discount',
      value: 100,
      expiresIn: 7
    });

    // Cashback bonus
    offers.push({
      type: 'welcome_cashback',
      value: 50,
      expiresIn: 30
    });

    // Referral bonus
    offers.push({
      type: 'referral_bonus',
      value: 100,
      expiresIn: 60
    });

    // Source-specific offers
    if (source === 'campaign') {
      offers.push({
        type: 'campaign_cashback',
        value: 25,
        expiresIn: 14
      });
    }

    return offers;
  }

  private predictInitialBehavior(city?: CityPrior | null, source?: UserBootstrap['source']): UserBootstrap['predictedMetrics'] {
    // Default predictions
    let firstOrderProbability = 0.6;
    let expectedOrderValue = city?.avgOrderValue || 350;
    let expectedRetention = 0.4;

    // Source adjustments
    if (source === 'referral') {
      firstOrderProbability = 0.75;
      expectedRetention = 0.55;
    }
    if (source === 'qr') {
      firstOrderProbability = 0.8;
      expectedOrderValue *= 0.8; // QR users tend to spend less initially
    }
    if (source === 'campaign') {
      firstOrderProbability = 0.5;
      expectedRetention = 0.3; // Campaign users may churn faster
    }

    return {
      firstOrderProbability,
      expectedOrderValue,
      expectedRetention
    };
  }

  // ============================================
  // Market Bootstrap
  // ============================================

  /**
   * Get market bootstrap data for expansion
   */
  getMarketBootstrap(marketId: string, city: string, category?: string): MarketBootstrap {
    const cityPrior = this.cityPriors.getCity(city);
    const categoryBaseline = category ? this.categoryBaselines.getCategory(category) : null;

    // Calculate readiness score
    const readinessScore = this.calculateMarketReadiness(cityPrior, categoryBaseline);

    // Generate growth indicators
    const indicators = this.generateMarketIndicators(cityPrior, categoryBaseline);

    // Generate recommendations
    const recommendations = this.generateMarketRecommendations(indicators, cityPrior, categoryBaseline);

    // Set benchmarks
    const benchmarks = this.generateBenchmarks(indicators, cityPrior, category);

    return {
      marketId,
      city,
      category,
      readinessScore,
      indicators,
      recommendations,
      benchmarks
    };
  }

  private calculateMarketReadiness(city?: CityPrior | null, category?: CategoryBaseline | null): number {
    let score = 50; // Base score

    if (city) {
      if (city.tier === 'tier1') score += 30;
      if (city.tier === 'tier2') score += 15;

      score += city.avgOrdersPerUser * 5;
    }

    if (category) {
      score += category.conversionRate * 50;
      score += category.repeatRate * 30;
    }

    return Math.min(score, 100);
  }

  private generateMarketIndicators(city?: CityPrior | null, category?: CategoryBaseline | null): MarketBootstrap['indicators'] {
    return {
      merchantDemand: city ? Math.round(city.avgOrdersPerUser * 20) : 50,
      consumerDemand: city ? Math.round(city.avgOrdersPerUser * 30) : 60,
      competitionLevel: category ? Math.round(category.conversionRate * 100) : 40,
      seasonalityFactor: city?.monsoonImpact || 1.0
    };
  }

  private generateMarketRecommendations(indicators?: MarketBootstrap['indicators'], city?: CityPrior | null, category?: CategoryBaseline | null): MarketBootstrap['recommendations'] {
    const recommendations: MarketBootstrap['recommendations'] = [];

    if (indicators) {
      if (indicators.merchantDemand > 50) {
        recommendations.push({
          priority: 'high',
          action: 'Launch merchant acquisition campaign',
          expectedImpact: 0.3
        });
      }

      if (indicators.consumerDemand > 50) {
        recommendations.push({
          priority: 'high',
          action: 'Launch consumer acquisition campaign',
          expectedImpact: 0.25
        });
      }

      if (indicators.seasonalityFactor > 1.2) {
        recommendations.push({
          priority: 'medium',
          action: 'Prepare for seasonal spike',
          expectedImpact: 0.2
        });
      }

      if (recommendations.length === 0) {
        recommendations.push({
          priority: 'medium',
          action: 'Monitor market for 30 days before heavy investment',
          expectedImpact: 0.1
        });
      }
    }

    return recommendations;
  }

  private generateBenchmarks(indicators?: MarketBootstrap['indicators'], city?: CityPrior | null, category?: string): MarketBootstrap['benchmarks'] {
    const baseOrders = city?.avgOrdersPerUser ? city.avgOrdersPerUser * 100 : 100;

    return {
      targetOrders: Math.round(baseOrders * 30), // Monthly target
      targetMerchants: 50,
      targetUsers: Math.round(baseOrders * 10),
      timeline: '3 months'
    };
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get current time adjustment factors
   */
  getTimeAdjustmentFactors(city: string, date: Date = new Date()): {
    hourMultiplier: number;
    dayMultiplier: number;
    seasonalMultiplier: number;
  } {
    const cityPrior = this.cityPriors.getCity(city);
    const hour = date.getHours();
    const day = date.getDay();
    const month = date.getMonth() + 1;

    // Hour multiplier
    let hourMultiplier = 0.5;
    if (cityPrior?.peakHours.includes(hour)) {
      hourMultiplier = 1.5;
    } else if (hour >= 11 && hour <= 22) {
      hourMultiplier = 1.0;
    }

    // Day multiplier
    let dayMultiplier = 1.0;
    if (day === 0 || day === 6) { // Weekend
      dayMultiplier = cityPrior?.weekendMultiplier || 1.2;
    }

    // Seasonal multiplier
    let seasonalMultiplier = 1.0;
    if (cityPrior?.monsoonImpact && (month >= 6 && month <= 9)) {
      seasonalMultiplier = cityPrior.monsoonImpact;
    }
    if (cityPrior?.festivalSpikes) {
      for (const festival of cityPrior.festivalSpikes) {
        if (festival.month === month) {
          seasonalMultiplier = Math.max(seasonalMultiplier, festival.multiplier);
        }
      }
    }

    return { hourMultiplier, dayMultiplier, seasonalMultiplier };
  }

  /**
   * Get all city priors
   */
  getAllCityPriors(): CityPrior[] {
    return this.cityPriors.getAllCities();
  }

  /**
   * Get all category baselines
   */
  getAllCategoryBaselines(): CategoryBaseline[] {
    return this.categoryBaselines.getAllCategories();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const bootstrapIntelligence = new BootstrapIntelligenceService();
export default bootstrapIntelligence;

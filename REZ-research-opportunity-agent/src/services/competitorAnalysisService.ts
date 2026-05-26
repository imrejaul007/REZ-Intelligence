import {
  CompetitorData,
  MarketTrend,
  PricePosition,
  CompetitorAnalysisRequest,
  CompetitorAnalysisResponse,
  InsightSection,
} from '../types/index.js';
import { cacheGet, cacheSet } from '../utils/redis.js';
import { CACHE_TTL } from '../constants/thresholds.js';
import logger from './utils/logger.js';

const log = logger.child({ context: 'CompetitorAnalysisService' });

class CompetitorAnalysisService {
  // Mock competitor data - In production, this would fetch from COMPETITOR_MONITOR service
  private competitorData: CompetitorData[] = [
    {
      competitorId: 'comp-1',
      name: 'Competitor A',
      products: [
        {
          name: 'Basic Plan',
          price: 299,
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
        },
        {
          name: 'Pro Plan',
          price: 599,
          features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
        },
        {
          name: 'Enterprise Plan',
          price: 1499,
          features: ['All Features', 'Priority Support', 'Custom Integration'],
        },
      ],
      marketShare: 0.25,
      pricingStrategy: 'mid-market',
      strengths: ['Strong brand recognition', 'Wide product range', 'Excellent customer service'],
      weaknesses: ['Higher prices', 'Complex onboarding'],
      lastUpdated: new Date(),
    },
    {
      competitorId: 'comp-2',
      name: 'Competitor B',
      products: [
        {
          name: 'Starter',
          price: 199,
          features: ['Feature 1', 'Feature 2'],
        },
        {
          name: 'Growth',
          price: 499,
          features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'],
        },
        {
          name: 'Scale',
          price: 999,
          features: ['All Features', 'Dedicated Account Manager'],
        },
      ],
      marketShare: 0.15,
      pricingStrategy: 'budget',
      strengths: ['Aggressive pricing', 'Fast deployment', 'User-friendly interface'],
      weaknesses: ['Limited features', 'Less reliable'],
      lastUpdated: new Date(),
    },
    {
      competitorId: 'comp-3',
      name: 'Competitor C',
      products: [
        {
          name: 'Individual',
          price: 399,
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
        },
        {
          name: 'Team',
          price: 799,
          features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
        },
        {
          name: 'Business',
          price: 1799,
          features: ['All Features', 'Custom Solutions', 'API Access'],
        },
      ],
      marketShare: 0.12,
      pricingStrategy: 'premium',
      strengths: ['Premium features', 'Enterprise-grade security', 'Strong integrations'],
      weaknesses: ['Expensive for small businesses', 'Steeper learning curve'],
      lastUpdated: new Date(),
    },
  ];

  // Mock market trends - In production, this would fetch from TREND_DETECTOR service
  private marketTrends: MarketTrend[] = [
    {
      trendId: 'trend-1',
      name: 'AI-Powered Personalization',
      description: 'Increasing demand for AI-driven personalized experiences in products and marketing',
      category: 'Technology',
      significance: 'high',
      growthRate: 0.35,
      source: 'Industry Report 2024',
      detectedAt: new Date(),
    },
    {
      trendId: 'trend-2',
      name: 'Subscription Model Growth',
      description: 'Shift from one-time purchases to recurring subscription models',
      category: 'Business Model',
      significance: 'high',
      growthRate: 0.25,
      source: 'Market Analysis',
      detectedAt: new Date(),
    },
    {
      trendId: 'trend-3',
      name: 'Mobile-First Experience',
      description: 'Consumer preference for mobile-first product experiences',
      category: 'UX/UI',
      significance: 'medium',
      growthRate: 0.20,
      source: 'User Research',
      detectedAt: new Date(),
    },
    {
      trendId: 'trend-4',
      name: 'Sustainability Focus',
      description: 'Growing consumer preference for eco-friendly and sustainable products',
      category: 'Values',
      significance: 'medium',
      growthRate: 0.15,
      source: 'Consumer Survey',
      detectedAt: new Date(),
    },
    {
      trendId: 'trend-5',
      name: 'Omnichannel Integration',
      description: 'Expectation for seamless experience across all channels',
      category: 'Operations',
      significance: 'high',
      growthRate: 0.30,
      source: 'Industry Analysis',
      detectedAt: new Date(),
    },
  ];

  async analyze(request: CompetitorAnalysisRequest): Promise<CompetitorAnalysisResponse> {
    log.info('Starting competitor analysis', { request });

    const cacheKey = `competitor_analysis:${JSON.stringify(request)}`;
    const cached = await cacheGet<CompetitorAnalysisResponse>(cacheKey);
    if (cached) {
      log.info('Returning cached analysis');
      return cached;
    }

    // Filter competitors based on request
    let competitors = this.competitorData;
    if (request.competitors && request.competitors.length > 0) {
      competitors = this.competitorData.filter((c) =>
        request.competitors!.includes(c.competitorId)
      );
    }

    // Generate price positions
    const pricePositions = this.generatePricePositions();

    // Identify market gaps
    const gaps = this.identifyMarketGaps(competitors);

    // Generate summary
    const summary = this.generateSummary(competitors, gaps);

    const response: CompetitorAnalysisResponse = {
      competitors,
      marketTrends: this.marketTrends,
      pricePositions,
      gaps,
      summary,
      generatedAt: new Date(),
    };

    await cacheSet(cacheKey, response, CACHE_TTL.COMPETITOR_DATA);

    log.info('Competitor analysis completed');
    return response;
  }

  private generatePricePositions(): PricePosition[] {
    const ourProducts = [
      { id: 'our-prod-1', name: 'Basic Plan', price: 349 },
      { id: 'our-prod-2', name: 'Pro Plan', price: 699 },
      { id: 'our-prod-3', name: 'Enterprise Plan', price: 1599 },
    ];

    return ourProducts.map((product) => {
      const competitorPrices = this.competitorData.flatMap((c) =>
        c.products
          .filter((p) => p.name.toLowerCase().includes(product.name.toLowerCase().split(' ')[0]))
          .map((p) => p.price)
      );

      const avgPrice = competitorPrices.length > 0
        ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
        : product.price;

      const minPrice = competitorPrices.length > 0 ? Math.min(...competitorPrices) : product.price;
      const maxPrice = competitorPrices.length > 0 ? Math.max(...competitorPrices) : product.price;

      const priceDiff = product.price - avgPrice;
      const priceDifferencePercent = avgPrice > 0 ? (priceDiff / avgPrice) * 100 : 0;

      let position: 'below' | 'at' | 'above' | 'significantly_above' = 'at';
      if (priceDifferencePercent < -5) position = 'below';
      else if (priceDifferencePercent > 15) position = 'significantly_above';
      else if (priceDifferencePercent > 5) position = 'above';

      return {
        productId: product.id,
        productName: product.name,
        yourPrice: product.price,
        avgCompetitorPrice: avgPrice,
        lowestCompetitorPrice: minPrice,
        highestCompetitorPrice: maxPrice,
        position,
        priceDifference: priceDiff,
        priceDifferencePercent,
      };
    });
  }

  private identifyMarketGaps(competitors: CompetitorData[]): Array<{
    type: string;
    description: string;
    opportunity: string;
    confidence: number;
  }> {
    const gaps: Array<{
      type: string;
      description: string;
      opportunity: string;
      confidence: number;
    }> = [];

    // Check for pricing gaps
    const avgPrices = competitors.map((c) =>
      c.products.reduce((sum, p) => sum + p.price, 0) / c.products.length
    );
    const marketAvgPrice = avgPrices.reduce((a, b) => a + b, 0) / avgPrices.length;

    // Identify opportunity in mid-market segment
    const hasMidMarketGap = competitors.every(
      (c) => c.pricingStrategy !== 'mid-market' || c.marketShare! < 0.30
    );
    if (hasMidMarketGap) {
      gaps.push({
        type: 'pricing',
        description: 'Mid-market pricing segment is underserved',
        opportunity: 'Position competitively in the mid-market price range (₹400-700) with enhanced features',
        confidence: 75,
      });
    }

    // Check for feature gaps
    const allFeatures = competitors.flatMap((c) =>
      c.products.flatMap((p) => p.features)
    );
    const featureCounts = allFeatures.reduce((acc, f) => {
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const underservedFeatures = Object.entries(featureCounts)
      .filter(([, count]) => count <= 1)
      .map(([feature]) => feature);

    if (underservedFeatures.length > 0) {
      gaps.push({
        type: 'features',
        description: `${underservedFeatures.length} features are underserved in the market`,
        opportunity: `Develop differentiation through: ${underservedFeatures.slice(0, 3).join(', ')}`,
        confidence: 70,
      });
    }

    // Check for segment gaps
    const segments = competitors.map((c) => c.pricingStrategy);
    if (!segments.includes('budget')) {
      gaps.push({
        type: 'segment',
        description: 'Budget segment appears underserved',
        opportunity: 'Launch a competitive budget-friendly option to capture price-sensitive customers',
        confidence: 65,
      });
    }

    // AI/automation gap
    gaps.push({
      type: 'technology',
      description: 'AI-powered features are emerging as a differentiator',
      opportunity: 'Invest in AI-driven personalization and automation to differentiate from competitors',
      confidence: 80,
    });

    return gaps;
  }

  private generateSummary(
    competitors: CompetitorData[],
    gaps: Array<{ type: string; description: string; opportunity: string; confidence: number }>
  ): string {
    const avgMarketShare = competitors.reduce((sum, c) => sum + (c.marketShare || 0), 0);
    const topCompetitor = competitors.sort((a, b) => (b.marketShare || 0) - (a.marketShare || 0))[0];

    return `Competitor Analysis Summary:

Market Overview: Analyzed ${competitors.length} competitors representing ${(avgMarketShare * 100).toFixed(0)}% of the market. ${topCompetitor.name} leads with ${((topCompetitor.marketShare || 0) * 100).toFixed(0)}% market share.

Competitive Landscape: The market shows a mix of pricing strategies from budget (₹199-499) to premium (₹1499+). Key differentiators include feature depth, customer service, and integration capabilities.

Market Trends: ${this.marketTrends.length} significant trends identified, with AI-powered personalization and omnichannel integration showing the highest growth rates.

Identified Gaps: ${gaps.length} market gaps identified, including pricing positioning, feature differentiation, and technology investments.

Key Insights:
- ${topCompetitor.strengths[0]} is their primary strength
- ${competitors[0].weaknesses[0]} presents an opportunity for differentiation
- Consider focusing on ${gaps[0]?.opportunity.split('.')[0] || 'market gaps identified'}`;
  }

  getCompetitorData(): CompetitorData[] {
    return this.competitorData;
  }

  getMarketTrends(): MarketTrend[] {
    return this.marketTrends;
  }
}

export const competitorAnalysisService = new CompetitorAnalysisService();
export default competitorAnalysisService;

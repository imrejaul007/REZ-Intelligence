import {
  Competitor,
  PriceData,
  FeatureData,
  ReviewData,
  PriceMonitoring,
  FeatureTracking,
  ReviewAnalysis,
  ShareOfVoice,
  CompetitorOverview,
  CompetitorSummary,
  ProductPrice,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class CompetitorMonitorService {
  private modelVersion = '1.0.0';
  private competitors: Map<string, Competitor> = new Map();
  private priceHistory: Map<string, PriceData[]> = new Map();
  private reviewHistory: Map<string, ReviewData[]> = new Map();
  private featureHistory: Map<string, FeatureData[]> = new Map();

  addCompetitor(competitor: Competitor): void {
    this.competitors.set(competitor.competitorId, competitor);
    logger.info(`Competitor added: ${competitor.name}`);
  }

  removeCompetitor(competitorId: string): boolean {
    const result = this.competitors.delete(competitorId);
    if (result) {
      logger.info(`Competitor removed: ${competitorId}`);
    }
    return result;
  }

  getCompetitor(competitorId: string): Competitor | undefined {
    return this.competitors.get(competitorId);
  }

  getAllCompetitors(): Competitor[] {
    return Array.from(this.competitors.values());
  }

  recordPriceData(priceData: PriceData): void {
    const existing = this.priceHistory.get(priceData.competitorId) || [];
    existing.push(priceData);
    this.priceHistory.set(priceData.competitorId, existing);
    logger.info(`Price data recorded for competitor: ${priceData.competitorId}`);
  }

  recordBatchPriceData(prices: PriceData[]): void {
    prices.forEach(price => this.recordPriceData(price));
  }

  recordFeatureData(featureData: FeatureData): void {
    const existing = this.featureHistory.get(featureData.competitorId) || [];
    existing.push(featureData);
    this.featureHistory.set(featureData.competitorId, existing);
    logger.info(`Feature data recorded for competitor: ${featureData.competitorId}`);
  }

  recordReviewData(review: ReviewData): void {
    const existing = this.reviewHistory.get(review.competitorId) || [];
    existing.push(review);
    this.reviewHistory.set(review.competitorId, existing);
    logger.info(`Review data recorded for competitor: ${review.competitorId}`);
  }

  recordBatchReviews(reviews: ReviewData[]): void {
    reviews.forEach(review => this.recordReviewData(review));
  }

  monitorPrices(competitorId: string): PriceMonitoring | null {
    const competitor = this.competitors.get(competitorId);
    if (!competitor) return null;

    const priceHistory = this.priceHistory.get(competitorId) || [];
    const latestPrices = new Map<string, PriceData>();
    const previousPrices = new Map<string, PriceData>();

    priceHistory.forEach(price => {
      const existing = latestPrices.get(price.productId);
      if (!existing || new Date(price.timestamp) > new Date(existing.timestamp)) {
        previousPrices.set(price.productId, existing);
        latestPrices.set(price.productId, price);
      }
    });

    const products: ProductPrice[] = [];
    const promotions: { productId: string; promotionType: string; value: number; validUntil: string }[] = [];

    latestPrices.forEach((price, productId) => {
      const prev = previousPrices.get(productId);
      const prevPrice = prev?.price || price.price;
      const change = price.price - prevPrice;
      const changePercentage = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

      products.push({
        productId,
        productName: price.productName,
        currentPrice: price.price,
        previousPrice: prevPrice,
        change: Math.round(change * 100) / 100,
        changePercentage: Math.round(changePercentage * 10) / 10,
      });

      if (price.promotion) {
        promotions.push({
          productId,
          promotionType: price.promotion.type || 'unknown',
          value: price.promotion.value || 0,
          validUntil: price.promotion.validUntil || '',
        });
      }
    });

    const averagePrice = products.length > 0
      ? products.reduce((sum, p) => sum + p.currentPrice, 0) / products.length
      : 0;

    const priceChanges = products
      .filter(p => p.change !== 0)
      .map(p => ({
        productId: p.productId,
        timestamp: new Date().toISOString(),
        previousPrice: p.previousPrice,
        newPrice: p.currentPrice,
        changePercentage: p.changePercentage,
      }));

    const competitiveIndex = this.calculateCompetitiveIndex(products);

    return {
      competitorId,
      competitorName: competitor.name,
      products,
      averagePrice: Math.round(averagePrice * 100) / 100,
      priceChanges,
      promotions,
      competitiveIndex: Math.round(competitiveIndex * 100) / 100,
      lastUpdated: new Date().toISOString(),
    };
  }

  trackFeatures(competitorId: string): FeatureTracking | null {
    const competitor = this.competitors.get(competitorId);
    if (!competitor) return null;

    const featureHistory = this.featureHistory.get(competitorId) || [];
    if (featureHistory.length === 0) {
      return {
        competitorId,
        competitorName: competitor.name,
        features: [],
        featureCompleteness: 0,
        newFeatures: [],
        removedFeatures: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const latest = featureHistory[featureHistory.length - 1];
    const previous = featureHistory.length > 1 ? featureHistory[featureHistory.length - 2] : null;

    const featureNames = new Set<string>();
    latest.features.forEach(f => featureNames.add(f.name));
    if (previous) {
      previous.features.forEach(f => featureNames.add(f.name));
    }

    const features: { name: string; ourProduct: boolean; competitor: boolean; advantage: 'us' | 'competitor' | 'equal' | 'both' }[] = [];
    const newFeatures: string[] = [];
    const removedFeatures: string[] = [];

    featureNames.forEach(name => {
      const latestFeature = latest.features.find(f => f.name === name);
      const prevFeature = previous?.features.find(f => f.name === name);

      if (latestFeature?.available && !prevFeature?.available) {
        newFeatures.push(name);
      }
      if (!latestFeature?.available && prevFeature?.available) {
        removedFeatures.push(name);
      }

      features.push({
        name,
        ourProduct: false,
        competitor: latestFeature?.available || false,
        advantage: latestFeature?.available ? 'competitor' : 'both',
      });
    });

    const availableFeatures = features.filter(f => f.competitor).length;
    const featureCompleteness = features.length > 0 ? (availableFeatures / features.length) * 100 : 0;

    return {
      competitorId,
      competitorName: competitor.name,
      features,
      featureCompleteness: Math.round(featureCompleteness * 10) / 10,
      newFeatures,
      removedFeatures,
      lastUpdated: new Date().toISOString(),
    };
  }

  analyzeReviews(competitorId: string): ReviewAnalysis | null {
    const competitor = this.competitors.get(competitorId);
    if (!competitor) return null;

    const reviews = this.reviewHistory.get(competitorId) || [];
    if (reviews.length === 0) {
      return {
        competitorId,
        competitorName: competitor.name,
        overallRating: 0,
        totalReviews: 0,
        ratingDistribution: {},
        recentTrend: 'stable',
        commonPraise: [],
        commonComplaints: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const overallRating = totalRating / reviews.length;

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    });

    const recentReviews = reviews
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, Math.min(10, reviews.length));
    const olderReviews = reviews
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(Math.min(10, reviews.length));

    const recentAvg = recentReviews.length > 0
      ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
      : 0;
    const olderAvg = olderReviews.length > 0
      ? olderReviews.reduce((sum, r) => sum + r.rating, 0) / olderReviews.length
      : recentAvg;

    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentAvg > olderAvg + 0.2) recentTrend = 'improving';
    else if (recentAvg < olderAvg - 0.2) recentTrend = 'declining';

    const positiveReviews = reviews.filter(r => r.rating >= 4);
    const negativeReviews = reviews.filter(r => r.rating <= 2);

    const commonPraise = this.extractCommonThemes(positiveReviews.map(r => r.content || ''));
    const commonComplaints = this.extractCommonThemes(negativeReviews.map(r => r.content || ''));

    return {
      competitorId,
      competitorName: competitor.name,
      overallRating: Math.round(overallRating * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution,
      recentTrend,
      commonPraise,
      commonComplaints,
      lastUpdated: new Date().toISOString(),
    };
  }

  calculateShareOfVoice(competitorIds: string[]): ShareOfVoice[] {
    const totalMentions = competitorIds.reduce((sum, id) => {
      const reviews = this.reviewHistory.get(id) || [];
      return sum + reviews.length;
    }, 0);

    const ourBrand = 'Our Brand';
    const ourMentions = Math.round(totalMentions * 0.35);
    const totalWithOurs = totalMentions + ourMentions;

    const results: ShareOfVoice[] = [];

    results.push({
      brand: ourBrand,
      mentions: ourMentions,
      positiveMentions: Math.round(ourMentions * 0.7),
      negativeMentions: Math.round(ourMentions * 0.1),
      neutralMentions: Math.round(ourMentions * 0.2),
      sentiment: 0.65,
      sharePercentage: Math.round((ourMentions / totalWithOurs) * 100),
      trend: 'stable',
    });

    competitorIds.forEach(id => {
      const competitor = this.competitors.get(id);
      const reviews = this.reviewHistory.get(id) || [];
      const positive = reviews.filter(r => r.rating >= 4).length;
      const negative = reviews.filter(r => r.rating <= 2).length;
      const avgSentiment = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating - 1) / 4, 0) / reviews.length
        : 0.5;

      results.push({
        brand: competitor?.name || id,
        mentions: reviews.length,
        positiveMentions: positive,
        negativeMentions: negative,
        neutralMentions: reviews.length - positive - negative,
        sentiment: Math.round(avgSentiment * 100) / 100,
        sharePercentage: Math.round((reviews.length / totalWithOurs) * 100),
        trend: 'stable',
      });
    });

    return results.sort((a, b) => b.sharePercentage - a.sharePercentage);
  }

  getCompetitorOverview(): CompetitorOverview {
    const competitors = this.getAllCompetitors();

    const summaries: CompetitorSummary[] = competitors.map(comp => {
      const reviews = this.reviewHistory.get(comp.competitorId) || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 3;

      const threatLevel: 'high' | 'medium' | 'low' =
        avgRating >= 4 ? 'high' : avgRating >= 3 ? 'medium' : 'low';

      const strength: 'high' | 'medium' | 'low' =
        reviews.length > 50 ? 'high' : reviews.length > 10 ? 'medium' : 'low';

      return {
        competitorId: comp.competitorId,
        name: comp.name,
        strength,
        weakness: avgRating < 4 ? ['Below average ratings', 'Limited review volume'] : ['Strong market presence'],
        threatLevel,
        lastActivity: new Date().toISOString(),
      };
    });

    const ourShare = 35;
    const competitorsShare: Record<string, number> = {};
    let remainingShare = 100 - ourShare;
    competitors.forEach((comp, index) => {
      const share = index === competitors.length - 1
        ? remainingShare
        : Math.round(remainingShare / (competitors.length - index) * (0.5 + Math.random()));
      competitorsShare[comp.name] = share;
      remainingShare -= share;
    });

    const competitiveAdvantages = [
      'Better customer service ratings',
      'More comprehensive feature set',
      'Faster delivery times',
    ];

    const competitiveThreats = summaries
      .filter(s => s.threatLevel === 'high')
      .map(s => `Strong competitor: ${s.name}`);

    const opportunities = [
      'Capture market share from low-rated competitors',
      'Expand into underserved segments',
      'Leverage sentiment analysis for targeted campaigns',
    ];

    return {
      competitors: summaries,
      marketShare: {
        ourShare,
        competitors: competitorsShare,
        estimated: true,
      },
      competitiveAdvantages,
      competitiveThreats,
      opportunities,
      generatedAt: new Date().toISOString(),
    };
  }

  private calculateCompetitiveIndex(products: ProductPrice[]): number {
    if (products.length === 0) return 1;

    const priceChanges = products.map(p => Math.abs(p.changePercentage));
    const avgChange = priceChanges.reduce((sum, c) => sum + c, 0) / priceChanges.length;

    if (avgChange > 10) return 0.6;
    if (avgChange > 5) return 0.75;
    if (avgChange > 2) return 0.85;
    return 1;
  }

  private extractCommonThemes(contents: string[]): string[] {
    const themes: Record<string, number> = {};

    const commonThemes = [
      'customer service', 'quality', 'price', 'delivery', 'selection',
      'website', 'app', 'support', 'returns', 'shipping'
    ];

    commonThemes.forEach(theme => {
      contents.forEach(content => {
        if (content.toLowerCase().includes(theme)) {
          themes[theme] = (themes[theme] || 0) + 1;
        }
      });
    });

    return Object.entries(themes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);
  }

  getModelVersion(): string {
    return this.modelVersion;
  }
}

export const competitorMonitorService = new CompetitorMonitorService();

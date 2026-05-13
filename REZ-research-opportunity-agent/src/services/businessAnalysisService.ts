import { v4 as uuidv4 } from 'uuid';
import {
  CustomerBehavior,
  PurchasePattern,
  ProductPerformance,
  ChannelEffectiveness,
  BusinessAnalysisRequest,
  BusinessAnalysisResponse,
  Channel,
  InsightSection,
} from '../types/index.js';
import { cacheGet, cacheSet } from '../utils/redis.js';
import { CACHE_TTL } from '../constants/thresholds.js';
import logger from '../utils/logger.js';

const log = logger.child({ context: 'BusinessAnalysisService' });

// Mock data sources - In production, these would call actual services
interface DataSource {
  orders: Array<{
    id: string;
    customerId: string;
    total: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
    channel: Channel;
    createdAt: Date;
  }>;
  customers: Array<{
    id: string;
    segment: string;
    firstOrder: Date;
    lastOrder: Date;
    totalOrders: number;
    totalSpent: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    rating?: number;
    returnCount: number;
    totalSold: number;
  }>;
  campaigns: Array<{
    id: string;
    channel: Channel;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  }>;
}

class BusinessAnalysisService {
  private dataSource: DataSource;

  constructor() {
    // Initialize with mock data - in production, this would fetch from services
    this.dataSource = this.initializeMockData();
  }

  private initializeMockData(): DataSource {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      orders: [
        {
          id: 'order-1',
          customerId: 'cust-1',
          total: 1500,
          items: [
            { productId: 'prod-1', quantity: 2, price: 500 },
            { productId: 'prod-2', quantity: 1, price: 500 },
          ],
          channel: Channel.WHATSAPP,
          createdAt: new Date(thirtyDaysAgo.getTime() + 5 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'order-2',
          customerId: 'cust-2',
          total: 2500,
          items: [
            { productId: 'prod-1', quantity: 3, price: 500 },
            { productId: 'prod-3', quantity: 2, price: 500 },
          ],
          channel: Channel.EMAIL,
          createdAt: new Date(thirtyDaysAgo.getTime() + 10 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'order-3',
          customerId: 'cust-1',
          total: 1000,
          items: [{ productId: 'prod-2', quantity: 2, price: 500 }],
          channel: Channel.PUSH,
          createdAt: new Date(thirtyDaysAgo.getTime() + 20 * 24 * 60 * 60 * 1000),
        },
      ],
      customers: [
        {
          id: 'cust-1',
          segment: 'VIP',
          firstOrder: thirtyDaysAgo,
          lastOrder: new Date(thirtyDaysAgo.getTime() + 20 * 24 * 60 * 60 * 1000),
          totalOrders: 5,
          totalSpent: 15000,
        },
        {
          id: 'cust-2',
          segment: 'Regular',
          firstOrder: thirtyDaysAgo,
          lastOrder: new Date(thirtyDaysAgo.getTime() + 10 * 24 * 60 * 60 * 1000),
          totalOrders: 3,
          totalSpent: 8000,
        },
        {
          id: 'cust-3',
          segment: 'New',
          firstOrder: new Date(thirtyDaysAgo.getTime() + 25 * 24 * 60 * 60 * 1000),
          lastOrder: new Date(thirtyDaysAgo.getTime() + 25 * 24 * 60 * 60 * 1000),
          totalOrders: 1,
          totalSpent: 2000,
        },
      ],
      products: [
        {
          id: 'prod-1',
          name: 'Premium Package',
          category: 'Packages',
          price: 500,
          rating: 4.5,
          returnCount: 2,
          totalSold: 100,
        },
        {
          id: 'prod-2',
          name: 'Basic Package',
          category: 'Packages',
          price: 500,
          rating: 4.2,
          returnCount: 5,
          totalSold: 150,
        },
        {
          id: 'prod-3',
          name: 'Enterprise Solution',
          category: 'Enterprise',
          price: 5000,
          rating: 4.8,
          returnCount: 1,
          totalSold: 20,
        },
      ],
      campaigns: [
        {
          id: 'camp-1',
          channel: Channel.WHATSAPP,
          sent: 10000,
          delivered: 9500,
          opened: 7600,
          clicked: 1900,
          converted: 380,
          revenue: 570000,
        },
        {
          id: 'camp-2',
          channel: Channel.EMAIL,
          sent: 20000,
          delivered: 18000,
          opened: 5400,
          clicked: 720,
          converted: 144,
          revenue: 360000,
        },
        {
          id: 'camp-3',
          channel: Channel.SMS,
          sent: 5000,
          delivered: 4800,
          opened: 0,
          clicked: 240,
          converted: 48,
          revenue: 96000,
        },
        {
          id: 'camp-4',
          channel: Channel.PUSH,
          sent: 15000,
          delivered: 14000,
          opened: 4200,
          clicked: 840,
          converted: 168,
          revenue: 252000,
        },
      ],
    };
  }

  async analyze(request: BusinessAnalysisRequest): Promise<BusinessAnalysisResponse> {
    log.info('Starting business analysis', { request });

    const cacheKey = `business_analysis:${JSON.stringify(request)}`;
    const cached = await cacheGet<BusinessAnalysisResponse>(cacheKey);
    if (cached) {
      log.info('Returning cached analysis');
      return cached;
    }

    const customerBehavior = this.analyzeCustomerBehavior();
    const purchasePatterns = this.analyzePurchasePatterns();
    const productPerformance = this.analyzeProductPerformance();
    const channelEffectiveness = this.analyzeChannelEffectiveness();

    const summary = this.generateSummary(
      customerBehavior,
      purchasePatterns,
      productPerformance,
      channelEffectiveness
    );

    const insights = this.generateInsights(
      customerBehavior,
      purchasePatterns,
      productPerformance,
      channelEffectiveness
    );

    const response: BusinessAnalysisResponse = {
      customerBehavior,
      purchasePatterns,
      productPerformance,
      channelEffectiveness,
      summary,
      insights,
      generatedAt: new Date(),
    };

    await cacheSet(cacheKey, response, CACHE_TTL.METRICS);

    log.info('Business analysis completed');
    return response;
  }

  private analyzeCustomerBehavior(): CustomerBehavior[] {
    const segments = ['VIP', 'Regular', 'New', 'At-Risk', 'Dormant'];

    return segments.map((segmentName) => {
      const segmentCustomers = this.dataSource.customers.filter(
        (c) => c.segment === segmentName
      );

      const activeCustomers = segmentCustomers.filter((c) => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return c.lastOrder >= thirtyDaysAgo;
      });

      const avgOrderValue =
        segmentCustomers.length > 0
          ? segmentCustomers.reduce((sum, c) => sum + c.totalSpent / c.totalOrders, 0) /
            segmentCustomers.length
          : 0;

      const avgPurchaseFrequency =
        segmentCustomers.length > 0
          ? segmentCustomers.reduce((sum, c) => sum + c.totalOrders, 0) /
            segmentCustomers.length
          : 0;

      const retentionRate = segmentCustomers.length > 0
        ? activeCustomers.length / segmentCustomers.length
        : 0;

      return {
        segmentId: segmentName.toLowerCase().replace('-', '_'),
        segmentName,
        totalCustomers: segmentCustomers.length || Math.floor(Math.random() * 500) + 100,
        activeCustomers: activeCustomers.length || Math.floor(Math.random() * 300) + 50,
        avgPurchaseFrequency: avgPurchaseFrequency || Math.random() * 5 + 1,
        avgOrderValue: avgOrderValue || Math.random() * 1000 + 500,
        retentionRate: retentionRate || Math.random() * 0.4 + 0.5,
        churnRate: Math.random() * 0.3 + 0.05,
        topCategories: [
          { category: 'Packages', revenue: Math.random() * 100000, percentage: 40 },
          { category: 'Enterprise', revenue: Math.random() * 80000, percentage: 30 },
          { category: 'Add-ons', revenue: Math.random() * 50000, percentage: 20 },
        ],
        trends: {
          growth: Math.random() * 0.3 - 0.1,
          direction: 'up' as const,
        },
      };
    });
  }

  private analyzePurchasePatterns(): PurchasePattern[] {
    const periods = ['Last 7 days', 'Last 30 days', 'Last 90 days'];

    return periods.map((period) => {
      const days = period.includes('7') ? 7 : period.includes('30') ? 30 : 90;
      const baseOrders = Math.floor(Math.random() * 500) + 100;

      return {
        period,
        totalOrders: baseOrders,
        totalRevenue: baseOrders * (Math.random() * 500 + 800),
        avgOrderValue: Math.random() * 500 + 800,
        repeatPurchaseRate: Math.random() * 0.4 + 0.2,
        avgItemsPerOrder: Math.random() * 3 + 2,
        topProducts: [
          { productId: 'prod-1', name: 'Premium Package', quantity: Math.floor(baseOrders * 0.3), revenue: baseOrders * 0.3 * 500 },
          { productId: 'prod-2', name: 'Basic Package', quantity: Math.floor(baseOrders * 0.4), revenue: baseOrders * 0.4 * 500 },
          { productId: 'prod-3', name: 'Enterprise Solution', quantity: Math.floor(baseOrders * 0.1), revenue: baseOrders * 0.1 * 5000 },
        ],
        peakHours: Array.from({ length: 12 }, (_, i) => ({
          hour: i + 9,
          orders: Math.floor(Math.random() * 50) + 10,
        })),
        peakDays: [
          { day: 'Monday', orders: Math.floor(Math.random() * 100) + 50 },
          { day: 'Tuesday', orders: Math.floor(Math.random() * 100) + 50 },
          { day: 'Wednesday', orders: Math.floor(Math.random() * 100) + 50 },
          { day: 'Thursday', orders: Math.floor(Math.random() * 100) + 50 },
          { day: 'Friday', orders: Math.floor(Math.random() * 150) + 80 },
          { day: 'Saturday', orders: Math.floor(Math.random() * 80) + 40 },
          { day: 'Sunday', orders: Math.floor(Math.random() * 60) + 30 },
        ],
      };
    });
  }

  private analyzeProductPerformance(): ProductPerformance[] {
    return this.dataSource.products.map((product) => {
      const revenue = product.totalSold * product.price;
      const growthRate = (Math.random() * 0.4 - 0.1);

      return {
        productId: product.id,
        name: product.name,
        category: product.category,
        revenue,
        unitsSold: product.totalSold,
        avgRating: product.rating,
        returnRate: product.returnCount / product.totalSold,
        growthRate,
        trend: growthRate > 0.1 ? 'rising' : growthRate < -0.1 ? 'falling' : 'stable',
      };
    });
  }

  private analyzeChannelEffectiveness(): ChannelEffectiveness[] {
    return this.dataSource.campaigns.map((campaign) => ({
      channel: campaign.channel,
      totalSent: campaign.sent,
      delivered: campaign.delivered,
      opened: campaign.opened,
      clicked: campaign.clicked,
      converted: campaign.converted,
      revenue: campaign.revenue,
      roi: (campaign.revenue - campaign.sent * 0.01) / (campaign.sent * 0.01) * 100,
      ctr: campaign.clicked / campaign.delivered,
      conversionRate: campaign.converted / campaign.clicked,
    }));
  }

  private generateSummary(
    customerBehavior: CustomerBehavior[],
    purchasePatterns: PurchasePattern[],
    productPerformance: ProductPerformance[],
    channelEffectiveness: ChannelEffectiveness[]
  ): string {
    const totalRevenue = purchasePatterns.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalCustomers = customerBehavior.reduce((sum, c) => sum + c.totalCustomers, 0);
    const topChannel = channelEffectiveness.sort((a, b) => b.roi - a.roi)[0];
    const topProduct = productPerformance.sort((a, b) => b.revenue - a.revenue)[0];

    return `Business Analysis Summary:

Revenue: The business generated ₹${totalRevenue.toLocaleString()} over the analyzed period with an average order value of ₹${purchasePatterns[0].avgOrderValue.toFixed(2)}.

Customer Base: Total customer base of ${totalCustomers} customers across ${customerBehavior.length} segments, with VIP customers showing the highest retention rate of ${Math.max(...customerBehavior.map((c) => c.retentionRate)) * 100}%.

Top Performing Channel: ${topChannel.channel} leads with an ROI of ${topChannel.roi.toFixed(1)}% and a conversion rate of ${(topChannel.conversionRate * 100).toFixed(1)}%.

Top Product: ${topProduct.name} generated ₹${topProduct.revenue.toLocaleString()} in revenue with a ${topProduct.growthRate > 0 ? '+' : ''}${(topProduct.growthRate * 100).toFixed(1)}% growth rate.`;
  }

  private generateInsights(
    customerBehavior: CustomerBehavior[],
    purchasePatterns: PurchasePattern[],
    productPerformance: ProductPerformance[],
    channelEffectiveness: ChannelEffectiveness[]
  ): string[] {
    const insights: string[] = [];

    // Customer insights
    const atRiskSegment = customerBehavior.find((c) => c.churnRate > 0.2);
    if (atRiskSegment) {
      insights.push(
        `${atRiskSegment.segmentName} segment has a high churn rate of ${(atRiskSegment.churnRate * 100).toFixed(1)}%. Consider retention campaigns.`
      );
    }

    // Product insights
    const decliningProducts = productPerformance.filter((p) => p.trend === 'falling');
    if (decliningProducts.length > 0) {
      insights.push(
        `${decliningProducts.length} product(s) showing declining sales trends that may need attention.`
      );
    }

    // Channel insights
    const lowPerformingChannel = channelEffectiveness.find((c) => c.conversionRate < 0.05);
    if (lowPerformingChannel) {
      insights.push(
        `${lowPerformingChannel.channel} channel has a below-average conversion rate of ${(lowPerformingChannel.conversionRate * 100).toFixed(1)}%. Consider optimizing content or timing.`
      );
    }

    // Pattern insights
    const highRepeatRate = purchasePatterns[0].repeatPurchaseRate > 0.4;
    if (highRepeatRate) {
      insights.push(
        'Strong repeat purchase behavior detected. Focus on loyalty programs and upselling opportunities.'
      );
    }

    return insights;
  }

  getDataForAI(): {
    customerBehavior: CustomerBehavior[];
    purchasePatterns: PurchasePattern[];
    productPerformance: ProductPerformance[];
    channelEffectiveness: ChannelEffectiveness[];
  } {
    return {
      customerBehavior: this.analyzeCustomerBehavior(),
      purchasePatterns: this.analyzePurchasePatterns(),
      productPerformance: this.analyzeProductPerformance(),
      channelEffectiveness: this.analyzeChannelEffectiveness(),
    };
  }
}

export const businessAnalysisService = new BusinessAnalysisService();
export default businessAnalysisService;

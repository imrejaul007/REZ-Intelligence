import express, { Request, Response, NextFunction } import logger from './utils/logger';
import from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface MerchantDashboard {
  merchantId: string;
  overview: MerchantOverview;
  customers: CustomerInsights;
  predictions: PredictionSummary;
  recommendations: Recommendation[];
  lastUpdated: Date;
}

interface MerchantOverview {
  totalCustomers: number;
  activeCustomers: number;
  monthlyRevenue: number;
  avgOrderValue: number;
  repeatRate: number;
  topSegments: SegmentStat[];
}

interface SegmentStat {
  name: string;
  count: number;
  percentage: number;
  revenue: number;
}

interface CustomerInsights {
  segments: CustomerSegment[];
  highValue: number;
  atRisk: number;
  dormant: number;
  new: number;
  returning: number;
}

interface CustomerSegment {
  name: string;
  count: number;
  revenue: number;
  avgOrderValue: number;
  topTraits: string[];
}

interface PredictionSummary {
  likelyToChurn: number;
  likelyToRepeat: number;
  highLTV: number;
  discountSensitive: number;
}

interface Recommendation {
  id: string;
  type: 'retention' | 'upsell' | 'winback' | 'acquisition';
  segment: string;
  action: string;
  expectedImpact: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedRevenue: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  segment: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: Date;
  riskLevel: 'low' | 'medium' | 'high';
  ltv: number;
}

interface MerchantComparison {
  merchantId: string;
  industry: string;
  metrics: {
    metric: string;
    yourValue: number;
    avgValue: number;
    percentile: number;
  }[];
  insights: string[];
}

// =============================================================================
// MOCK DATA GENERATOR (Replace with actual data sources)
// =============================================================================

function generateMockMerchantData(merchantId: string): MerchantDashboard {
  const baseMetrics = {
    multiplier: 1 + (parseInt(merchantId.slice(-1), 16) % 10) / 10
  };

  const totalCustomers = Math.floor(500 + Math.random() * 2000 * baseMetrics.multiplier);
  const activeCustomers = Math.floor(totalCustomers * (0.3 + Math.random() * 0.4));
  const monthlyRevenue = Math.floor(50000 + Math.random() * 500000 * baseMetrics.multiplier);
  const avgOrderValue = Math.floor(monthlyRevenue / (totalCustomers * 0.3));
  const repeatRate = 20 + Math.random() * 40;

  const segments: CustomerSegment[] = [
    {
      name: 'Champions',
      count: Math.floor(totalCustomers * 0.08),
      revenue: Math.floor(monthlyRevenue * 0.35),
      avgOrderValue: avgOrderValue * 2.5,
      topTraits: ['High spenders', 'Frequent buyers', 'Brand loyalists']
    },
    {
      name: 'Loyalists',
      count: Math.floor(totalCustomers * 0.15),
      revenue: Math.floor(monthlyRevenue * 0.28),
      avgOrderValue: avgOrderValue * 1.5,
      topTraits: ['Repeat customers', 'Positive reviews', 'Referral potential']
    },
    {
      name: 'Occasional Shoppers',
      count: Math.floor(totalCustomers * 0.35),
      revenue: Math.floor(monthlyRevenue * 0.22),
      avgOrderValue: avgOrderValue * 0.8,
      topTraits: ['Seasonal buyers', 'Promo-sensitive', 'Browse often']
    },
    {
      name: 'At-Risk',
      count: Math.floor(totalCustomers * 0.18),
      revenue: Math.floor(monthlyRevenue * 0.1),
      avgOrderValue: avgOrderValue * 0.6,
      topTraits: ['Declining activity', 'Price-sensitive', 'Competitor interest']
    },
    {
      name: 'New Customers',
      count: Math.floor(totalCustomers * 0.15),
      revenue: Math.floor(monthlyRevenue * 0.05),
      avgOrderValue: avgOrderValue * 0.5,
      topTraits: ['Recent acquisition', 'First-time buyers', 'Engagement potential']
    },
    {
      name: 'Dormant',
      count: Math.floor(totalCustomers * 0.09),
      revenue: 0,
      avgOrderValue: 0,
      topTraits: ['Inactive 90+ days', 'Re-engagement needed', 'Low priority']
    }
  ];

  const topSegments: SegmentStat[] = segments
    .filter(s => s.count > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .map(s => ({
      name: s.name,
      count: s.count,
      percentage: Math.round((s.count / totalCustomers) * 100),
      revenue: s.revenue
    }));

  const customers: CustomerInsights = {
    segments,
    highValue: Math.floor(totalCustomers * 0.12),
    atRisk: Math.floor(totalCustomers * 0.18),
    dormant: Math.floor(totalCustomers * 0.09),
    new: Math.floor(totalCustomers * 0.15),
    returning: Math.floor(totalCustomers * 0.35)
  };

  const predictions: PredictionSummary = {
    likelyToChurn: Math.floor(totalCustomers * 0.15 + Math.random() * 100),
    likelyToRepeat: Math.floor(customers.returning * 0.6),
    highLTV: Math.floor(totalCustomers * 0.08 + Math.random() * 50),
    discountSensitive: Math.floor(totalCustomers * 0.22 + Math.random() * 80)
  };

  const recommendations: Recommendation[] = [
    {
      id: uuidv4(),
      type: 'retention',
      segment: 'Champions',
      action: 'Launch VIP loyalty program with exclusive benefits and early access',
      expectedImpact: 'Increase repeat purchase frequency by 25%',
      priority: 'HIGH',
      estimatedRevenue: Math.floor(monthlyRevenue * 0.15)
    },
    {
      id: uuidv4(),
      type: 'retention',
      segment: 'At-Risk',
      action: 'Send personalized win-back offers with 20% discount',
      expectedImpact: 'Recover 30% of at-risk customers',
      priority: 'HIGH',
      estimatedRevenue: Math.floor(monthlyRevenue * 0.08)
    },
    {
      id: uuidv4(),
      type: 'upsell',
      segment: 'Loyalists',
      action: 'Cross-sell premium products based on purchase history',
      expectedImpact: 'Increase AOV by 18%',
      priority: 'MEDIUM',
      estimatedRevenue: Math.floor(monthlyRevenue * 0.12)
    },
    {
      id: uuidv4(),
      type: 'winback',
      segment: 'Dormant',
      action: 'Re-engagement email sequence with special comeback offer',
      expectedImpact: 'Reactivate 15% of dormant customers',
      priority: 'MEDIUM',
      estimatedRevenue: Math.floor(monthlyRevenue * 0.03)
    },
    {
      id: uuidv4(),
      type: 'acquisition',
      segment: 'New Customers',
      action: 'Referral program with incentives for sharing with friends',
      expectedImpact: 'Acquire 2x new customers through referrals',
      priority: 'LOW',
      estimatedRevenue: Math.floor(monthlyRevenue * 0.05)
    },
    {
      id: uuidv4(),
      type: 'upsell',
      segment: 'Occasional Shoppers',
      action: 'Bundle deals and subscription options for frequent purchases',
      expectedImpact: 'Convert 20% to regular buyers',
      priority: 'MEDIUM',
      estimatedRevenue: Math.floor(monthlyRevenue * 0.10)
    }
  ];

  return {
    merchantId,
    overview: {
      totalCustomers,
      activeCustomers,
      monthlyRevenue,
      avgOrderValue,
      repeatRate: Math.round(repeatRate * 10) / 10,
      topSegments
    },
    customers,
    predictions,
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    lastUpdated: new Date()
  };
}

function generateMockCustomers(merchantId: string, limit: number = 50): Customer[] {
  const customers: Customer[] = [];
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Amanda'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];
  const segments = ['Champions', 'Loyalists', 'Occasional Shoppers', 'At-Risk', 'New Customers', 'Dormant'];
  const riskLevels: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];

  for (let i = 0; i < limit; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const segment = segments[Math.floor(Math.random() * segments.length)];
    const totalOrders = Math.floor(Math.random() * 50) + 1;
    const avgOrder = 50 + Math.random() * 500;
    const totalSpent = totalOrders * avgOrder;

    customers.push({
      id: uuidv4(),
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`,
      segment,
      totalOrders,
      totalSpent: Math.floor(totalSpent),
      lastOrderDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      riskLevel: riskLevels[Math.floor(Math.random() * riskLevels.length)],
      ltv: Math.floor(totalSpent * (1 + Math.random() * 2))
    });
  }

  return customers.sort((a, b) => b.totalSpent - a.totalSpent);
}

function generateMerchantComparison(merchantId: string): MerchantComparison {
  const yourRevenue = 50000 + Math.random() * 200000;
  const yourCustomers = 500 + Math.floor(Math.random() * 2000);
  const yourAOV = 100 + Math.random() * 200;
  const yourRepeatRate = 30 + Math.random() * 40;

  return {
    merchantId,
    industry: 'Retail',
    metrics: [
      {
        metric: 'Monthly Revenue',
        yourValue: Math.floor(yourRevenue),
        avgValue: Math.floor(yourRevenue * (0.8 + Math.random() * 0.4)),
        percentile: 50 + Math.floor(Math.random() * 45)
      },
      {
        metric: 'Total Customers',
        yourValue: yourCustomers,
        avgValue: yourCustomers * (0.7 + Math.random() * 0.6),
        percentile: 45 + Math.floor(Math.random() * 50)
      },
      {
        metric: 'Average Order Value',
        yourValue: Math.round(yourAOV * 100) / 100,
        avgValue: yourAOV * (0.85 + Math.random() * 0.3),
        percentile: 40 + Math.floor(Math.random() * 55)
      },
      {
        metric: 'Repeat Purchase Rate',
        yourValue: Math.round(yourRepeatRate * 10) / 10,
        avgValue: yourRepeatRate * (0.9 + Math.random() * 0.2),
        percentile: 35 + Math.floor(Math.random() * 60)
      },
      {
        metric: 'Customer Retention',
        yourValue: 60 + Math.random() * 30,
        avgValue: 65 + Math.random() * 20,
        percentile: 50 + Math.floor(Math.random() * 40)
      }
    ],
    insights: [
      yourRepeatRate > 35
        ? 'Your repeat purchase rate is above industry average. Focus on maintaining customer loyalty.'
        : 'Your repeat purchase rate is below average. Consider implementing loyalty programs.',
      yourAOV > 200
        ? 'Your average order value is strong. Customers are responding well to premium offerings.'
        : 'Room to increase average order value through bundling and upselling strategies.',
      yourCustomers > 1500
        ? 'You have a strong customer base. Focus on maximizing customer lifetime value.'
        : 'Opportunity to grow your customer base through targeted acquisition campaigns.'
    ]
  };
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const merchantIdSchema = {
  merchantId: {
    in: ['params'],
    isString: true,
    notEmpty: true,
    errorMessage: 'Valid merchantId is required'
  }
};

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

const app = express();
const PORT = process.env.PORT || 4014;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-merchant-intelligence',
    timestamp: new Date().toISOString()
  });
});

// GET /merchant/:merchantId/dashboard - Full dashboard
app.get('/merchant/:merchantId/dashboard', (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId || merchantId.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchantId is required'
      });
    }

    const dashboard = generateMockMerchantData(merchantId);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error generating dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate dashboard data'
    });
  }
});

// GET /merchant/:merchantId/customers - Customer list
app.get('/merchant/:merchantId/customers', (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const segment = req.query.segment as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'totalSpent';
    const order = (req.query.order as string) || 'desc';

    if (!merchantId || merchantId.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchantId is required'
      });
    }

    let customers = generateMockCustomers(merchantId, 200);

    // Filter by segment if provided
    if (segment) {
      customers = customers.filter(c => c.segment.toLowerCase() === segment.toLowerCase());
    }

    // Sort customers
    customers.sort((a, b) => {
      const aVal = a[sortBy as keyof Customer];
      const bVal = b[sortBy as keyof Customer];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (aVal instanceof Date && bVal instanceof Date) {
        return order === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }
      return 0;
    });

    // Apply limit
    customers = customers.slice(0, limit);

    res.json({
      success: true,
      data: {
        customers,
        total: customers.length,
        filters: { segment, sortBy, order, limit }
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch customer data'
    });
  }
});

// GET /merchant/:merchantId/segments - Segment breakdown
app.get('/merchant/:merchantId/segments', (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId || merchantId.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchantId is required'
      });
    }

    const dashboard = generateMockMerchantData(merchantId);

    // Generate segment trends (mock historical data)
    const segmentTrends = dashboard.customers.segments.map(segment => ({
      ...segment,
      trends: {
        monthOverMonth: {
          countChange: Math.floor(Math.random() * 100) - 30,
          revenueChange: Math.floor(Math.random() * 30) - 10
        },
        growth: {
          weekly: Math.round((Math.random() * 20 - 5) * 10) / 10,
          monthly: Math.round((Math.random() * 40 - 10) * 10) / 10
        }
      }
    }));

    res.json({
      success: true,
      data: {
        segments: segmentTrends,
        summary: {
          totalSegments: dashboard.customers.segments.length,
          mostValuableSegment: dashboard.overview.topSegments[0]?.name || 'N/A',
          fastestGrowing: segmentTrends.sort((a, b) =>
            b.trends.growth.monthly - a.trends.growth.monthly
          )[0]?.name || 'N/A'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch segment data'
    });
  }
});

// GET /merchant/:merchantId/predictions - Predictions
app.get('/merchant/:merchantId/predictions', (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId || merchantId.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchantId is required'
      });
    }

    const dashboard = generateMockMerchantData(merchantId);

    // Generate detailed predictions with customer IDs
    const churnedCustomers = generateMockCustomers(merchantId, dashboard.predictions.likelyToChurn)
      .map(c => ({ ...c, churnProbability: 0.7 + Math.random() * 0.3 }))
      .slice(0, 20);

    const repeatCustomers = generateMockCustomers(merchantId, dashboard.predictions.likelyToRepeat)
      .map(c => ({ ...c, repeatProbability: 0.6 + Math.random() * 0.4 }))
      .slice(0, 20);

    const highLTVCustomers = generateMockCustomers(merchantId, dashboard.predictions.highLTV)
      .map(c => ({ ...c, predictedLTV: c.ltv * (1.5 + Math.random()) }))
      .slice(0, 15);

    res.json({
      success: true,
      data: {
        summary: dashboard.predictions,
        details: {
          churnRisk: {
            count: dashboard.predictions.likelyToChurn,
            customers: churnedCustomers,
            avgRiskScore: 72 + Math.random() * 20,
            recommendedActions: [
              'Send personalized re-engagement campaigns',
              'Offer exclusive loyalty rewards',
              'Request feedback to identify issues'
            ]
          },
          repeatPurchase: {
            count: dashboard.predictions.likelyToRepeat,
            customers: repeatCustomers,
            avgProbability: 68 + Math.random() * 20,
            recommendedActions: [
              'Implement subscription model',
              'Create bundle offers',
              'Launch referral program'
            ]
          },
          highLTV: {
            count: dashboard.predictions.highLTV,
            customers: highLTVCustomers,
            totalPotentialValue: highLTVCustomers.reduce((sum, c) => sum + c.predictedLTV, 0),
            recommendedActions: [
              'Create VIP treatment program',
              'Offer premium product access',
              'Personalize communications'
            ]
          },
          discountSensitive: {
            count: dashboard.predictions.discountSensitive,
            avgSensitivity: 65 + Math.random() * 20,
            recommendedActions: [
              'Time promotions strategically',
              'Create loyalty-tier discounts',
              'Bundle with perceived value'
            ]
          }
        },
        modelInfo: {
          lastTrained: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          accuracy: 0.85 + Math.random() * 0.1,
          features: ['purchase_frequency', 'avg_order_value', 'recency', 'product_categories', 'engagement_score']
        }
      }
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch prediction data'
    });
  }
});

// GET /merchant/:merchantId/recommendations - Actionable recommendations
app.get('/merchant/:merchantId/recommendations', (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const type = req.query.type as Recommendation['type'] | undefined;
    const priority = req.query.priority as Recommendation['priority'] | undefined;

    if (!merchantId || merchantId.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchantId is required'
      });
    }

    const dashboard = generateMockMerchantData(merchantId);
    let recommendations = [...dashboard.recommendations];

    // Filter by type
    if (type) {
      recommendations = recommendations.filter(r => r.type === type);
    }

    // Filter by priority
    if (priority) {
      recommendations = recommendations.filter(r => r.priority === priority);
    }

    // Group by type
    const groupedByType = recommendations.reduce((acc, rec) => {
      if (!acc[rec.type]) {
        acc[rec.type] = [];
      }
      acc[rec.type].push(rec);
      return acc;
    }, {} as Record<string, Recommendation[]>);

    // Calculate potential impact
    const totalPotentialRevenue = recommendations.reduce((sum, rec) => sum + rec.estimatedRevenue, 0);
    const highPriorityCount = recommendations.filter(r => r.priority === 'HIGH').length;

    res.json({
      success: true,
      data: {
        recommendations,
        groupedByType,
        summary: {
          totalRecommendations: recommendations.length,
          totalPotentialRevenue,
          highPriorityCount,
          avgExpectedImpact: recommendations.length > 0
            ? Math.round(totalPotentialRevenue / recommendations.length)
            : 0
        },
        filters: { type, priority }
      }
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch recommendations'
    });
  }
});

// GET /merchant/:merchantId/compare - Compare with similar merchants
app.get('/merchant/:merchantId/compare', (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId || merchantId.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchantId is required'
      });
    }

    const comparison = generateMerchantComparison(merchantId);
    const dashboard = generateMockMerchantData(merchantId);

    // Generate benchmark data
    const benchmarks = [
      { category: 'Revenue Growth', yourValue: 15 + Math.random() * 30, industryAvg: 10 + Math.random() * 15 },
      { category: 'Customer Acquisition Cost', yourValue: 20 + Math.random() * 40, industryAvg: 25 + Math.random() * 30 },
      { category: 'Lifetime Value', yourValue: 500 + Math.random() * 1000, industryAvg: 400 + Math.random() * 800 },
      { category: 'Churn Rate', yourValue: 5 + Math.random() * 10, industryAvg: 8 + Math.random() * 12 },
      { category: 'Net Promoter Score', yourValue: 40 + Math.random() * 30, industryAvg: 35 + Math.random() * 25 }
    ];

    res.json({
      success: true,
      data: {
        comparison,
        benchmarks,
        yourOverview: dashboard.overview,
        recommendations: comparison.insights
      }
    });
  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch comparison data'
    });
  }
});

// GET /merchant/:merchantId/metrics - Performance metrics over time
app.get('/merchant/:merchantId/metrics', (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const period = (req.query.period as string) || '30d';

    if (!merchantId || merchantId.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchantId is required'
      });
    }

    // Generate time-series metrics
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const metrics: Record<string, { date: string; value: number }[]> = {
      revenue: [],
      customers: [],
      orders: [],
      aov: []
    };

    let baseRevenue = 50000;
    let baseCustomers = 500;
    let baseOrders = 1000;

    for (let i = days; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      const dayVariance = 0.8 + Math.random() * 0.4;
      baseRevenue *= 1.002;
      baseCustomers = Math.floor(baseCustomers * (1 + (Math.random() - 0.3) * 0.01));
      baseOrders = Math.floor(baseOrders * (1 + (Math.random() - 0.3) * 0.005));

      metrics.revenue.push({ date: dateStr, value: Math.floor(baseRevenue * dayVariance) });
      metrics.customers.push({ date: dateStr, value: baseCustomers });
      metrics.orders.push({ date: dateStr, value: baseOrders });
      metrics.aov.push({ date: dateStr, value: Math.round((baseRevenue / baseOrders) * 100) / 100 });
    }

    // Calculate summary stats
    const revenueValues = metrics.revenue.map(m => m.value);
    const summary = {
      totalRevenue: revenueValues.reduce((a, b) => a + b, 0),
      avgDailyRevenue: Math.round(revenueValues.reduce((a, b) => a + b, 0) / revenueValues.length),
      revenueGrowth: ((revenueValues[revenueValues.length - 1] - revenueValues[0]) / revenueValues[0] * 100).toFixed(1),
      peakDay: metrics.revenue.reduce((a, b) => b.value > a.value ? b : a).date,
      totalOrders: metrics.orders.reduce((a, b) => a + b.value, 0),
      newCustomers: Math.floor(baseCustomers * 0.15)
    };

    res.json({
      success: true,
      data: {
        metrics,
        summary,
        period,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch metrics data'
    });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

app.listen(PORT, () => {
  logger.info(`
╔═══════════════════════════════════════════════════════════╗
║     REZ Merchant Intelligence Service                       ║
║     ─────────────────────────────────────────────────────   ║
║     Status:    RUNNING                                     ║
║     Port:      ${PORT}                                       ║
║     Health:    http://localhost:${PORT}/health               ║
║     ─────────────────────────────────────────────────────   ║
║     Endpoints:                                            ║
║     • GET /merchant/:id/dashboard    - Full dashboard     ║
║     • GET /merchant/:id/customers    - Customer list       ║
║     • GET /merchant/:id/segments     - Segment breakdown  ║
║     • GET /merchant/:id/predictions  - ML predictions      ║
║     • GET /merchant/:id/recommendations - Actions          ║
║     • GET /merchant/:id/compare      - Industry compare   ║
║     • GET /merchant/:id/metrics      - Time-series data   ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export { app, MerchantDashboard, MerchantOverview, CustomerInsights, PredictionSummary, Recommendation };

import { logger } from './utils/logger.js';
import crypto from 'crypto';
import 'dotenv/config';

// Crypto-based random number generator for secure randomness
function secureRandom(): number {
  return parseInt(crypto.randomBytes(4).toString('hex'), 16) / 0xFFFFFFFF;
}
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Environment configuration
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'https://rez-analytics-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const USE_REAL_API = process.env.USE_REAL_ANALYTICS === 'true';

// Real API helper
async function fetchFromAnalytics<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (!USE_REAL_API) return null;

  try {
    const response = await fetch(`${ANALYTICS_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
        ...options?.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as T;
  } catch (error) {
    console.error(`Analytics API error (${endpoint}):`, error);
    return null;
  }
}

// Mock data generators
const generateTimeSeriesData = (days: number, baseValue: number, variance: number) => {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const value = baseValue + (secureRandom() - 0.5) * variance;
    data.push({
      date: date.toISOString().split("T")[0],
      value: Math.round(value * 100) / 100,
    });
  }
  return data;
};

const generateFunnelData = () => [
  { stage: "Visitors", count: 125000, conversion: 100 },
  { stage: "Product Views", count: 87500, conversion: 70 },
  { stage: "Add to Cart", count: 43750, conversion: 50 },
  { stage: "Checkout Started", count: 21875, conversion: 25 },
  { stage: "Payment Completed", count: 13125, conversion: 60 },
];

const generateRevenueByCategory = () => [
  { category: "Food & Beverages", revenue: 458200, percentage: 35.2, growth: 12.5 },
  { category: "Electronics", revenue: 312800, percentage: 24.1, growth: 8.3 },
  { category: "Fashion & Apparel", revenue: 245600, percentage: 18.9, growth: 15.2 },
  { category: "Home & Living", revenue: 156400, percentage: 12.0, growth: -2.1 },
  { category: "Health & Beauty", revenue: 128900, percentage: 9.8, growth: 22.7 },
];

const generateRevenueByChannel = () => [
  { channel: "Mobile App", revenue: 678500, percentage: 52.2, orders: 45234 },
  { channel: "Website", revenue: 345200, percentage: 26.5, orders: 23012 },
  { channel: "WhatsApp", revenue: 156300, percentage: 12.0, orders: 10420 },
  { channel: "POS", revenue: 119000, percentage: 9.1, orders: 7933 },
  { channel: "Social Commerce", revenue: 12000, percentage: 0.9, orders: 801 },
];

// Tool handlers
const tools = [
  {
    name: "get_dashboard_metrics",
    description: "Get key dashboard metrics including revenue, orders, and user statistics",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "week", "month", "quarter", "year"],
          description: "Time period for metrics",
        },
      },
    },
    handler: async (params?: { period?: string }) => {
      const period = params?.period || "month";
      const multiplier = period === "today" ? 0.033 : period === "week" ? 0.25 : period === "quarter" ? 3 : period === "year" ? 12 : 1;

      // Try real API first if enabled
      if (USE_REAL_API) {
        const result = await fetchFromAnalytics<unknown>(`/api/metrics/dashboard?period=${period}`);
        if (result) {
          return {
            content: [{ type: "text", text: JSON.stringify({ ...result, source: 'remote' }, null, 2) }],
          };
        }
      }

      // Fall back to mock data
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                period,
                source: 'mock',
                metrics: {
                  revenue: {
                    total: Math.round(1301000 * multiplier),
                    change: 12.5 + secureRandom() * 5,
                    timeSeries: generateTimeSeriesData(period === "today" ? 24 : 30, 43000 * multiplier / 30, 5000),
                  },
                  orders: {
                    total: Math.round(87400 * multiplier),
                    change: 8.2 + secureRandom() * 4,
                    averageOrderValue: 148.9 + secureRandom() * 10,
                    timeSeries: generateTimeSeriesData(30, 2900 * multiplier / 30, 400),
                  },
                  users: {
                    active: Math.round(245000 * multiplier),
                    new: Math.round(12500 * multiplier),
                    returning: 78.4 + secureRandom() * 5,
                    timeSeries: generateTimeSeriesData(30, 8100 * multiplier / 30, 1200),
                  },
                  performance: {
                    conversionRate: 4.8 + secureRandom() * 1.5,
                    cartAbandonmentRate: 32.5 + secureRandom() * 5,
                    customerSatisfaction: 4.2 + secureRandom() * 0.5,
                  },
                },
                lastUpdated: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    name: "get_funnel",
    description: "Get funnel analytics showing conversion rates through the purchase funnel",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "week", "month", "quarter"],
          description: "Time period for funnel data",
        },
        source: {
          type: "string",
          enum: ["all", "organic", "paid", "referral", "social"],
          description: "Traffic source filter",
        },
      },
    },
    handler: async (params?: { period?: string; source?: string }) => {
      // Try real API first if enabled
      if (USE_REAL_API) {
        const result = await fetchFromAnalytics<unknown>(
          `/api/analytics/funnel?period=${params?.period || 'month'}&source=${params?.source || 'all'}`
        );
        if (result) {
          return {
            content: [{ type: "text", text: JSON.stringify({ ...result, source: 'remote' }, null, 2) }],
          };
        }
      }

      const funnelData = generateFunnelData();
      const sourceMultiplier =
        params?.source === "organic"
          ? 0.4
          : params?.source === "paid"
          ? 0.25
          : params?.source === "referral"
          ? 0.15
          : params?.source === "social"
          ? 0.1
          : 1;

      const scaledFunnel = funnelData.map((stage) => ({
        ...stage,
        count: Math.round(stage.count * sourceMultiplier * (params?.period === "today" ? 0.033 : params?.period === "week" ? 0.25 : params?.period === "quarter" ? 3 : 1)),
      }));

      const dropoffs = scaledFunnel.slice(1).map((stage, i) => ({
        from: scaledFunnel[i].stage,
        to: stage.stage,
        dropoffRate: Math.round((1 - stage.count / scaledFunnel[i].count) * 100 * 10) / 10,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                period: params?.period || "month",
                filter: params?.source || "all",
                source: 'mock',
                funnel: scaledFunnel,
                dropoffs,
                insights: {
                  biggestDropoff: dropoffs.reduce((max, d) => (d.dropoffRate > max.rate ? { stage: d.from, rate: d.dropoffRate } : max), { stage: "N/A", rate: 0 }),
                  overallConversion: Math.round((scaledFunnel[scaledFunnel.length - 1].count / scaledFunnel[0].count) * 10000) / 100,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    name: "get_revenue_breakdown",
    description: "Get revenue breakdown by category and channel",
    inputSchema: {
      type: "object",
      properties: {
        breakdown: {
          type: "string",
          enum: ["category", "channel", "both"],
          description: "Type of breakdown",
        },
        period: {
          type: "string",
          enum: ["month", "quarter", "year"],
          description: "Time period",
        },
      },
    },
    handler: async (params?: { breakdown?: string; period?: string }) => {
      // Try real API first if enabled
      if (USE_REAL_API) {
        const result = await fetchFromAnalytics<unknown>(
          `/api/analytics/revenue?breakdown=${params?.breakdown || 'both'}&period=${params?.period || 'month'}`
        );
        if (result) {
          return {
            content: [{ type: "text", text: JSON.stringify({ ...result, source: 'remote' }, null, 2) }],
          };
        }
      }

      const breakdown = params?.breakdown || "both";
      const period = params?.period || "month";
      const multiplier = period === "quarter" ? 3 : period === "year" ? 12 : 1;

      const result: Record<string, unknown> = {
        period,
        source: 'mock',
        totalRevenue: Math.round(1301000 * multiplier),
      };

      if (breakdown === "category" || breakdown === "both") {
        result.byCategory = generateRevenueByCategory().map((cat) => ({
          ...cat,
          revenue: Math.round(cat.revenue * multiplier),
        }));
      }

      if (breakdown === "channel" || breakdown === "both") {
        result.byChannel = generateRevenueByChannel().map((ch) => ({
          ...ch,
          revenue: Math.round(ch.revenue * multiplier),
          orders: Math.round(ch.orders * multiplier),
        }));
      }

      if (breakdown === "both") {
        const byCategory = result.byCategory as Array<{ category: string; growth: number; revenue: number }> | undefined;
        const byChannel = result.byChannel as Array<{ channel: string; revenue: number }> | undefined;
        result.topPerformers = {
          category: byCategory?.[0],
          channel: byChannel?.[0],
        };
        result.insights = {
          fastestGrowingCategory: byCategory?.reduce((max, cat) => (cat.growth > max.growth ? cat : max)),
          highestVolumeChannel: byChannel?.reduce((max, ch) => (ch.revenue > max.revenue ? ch : max)),
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: "get_user_metrics",
    description: "Get user metrics including DAU, MAU, retention, and engagement",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["week", "month", "quarter"],
          description: "Time period for metrics",
        },
        groupBy: {
          type: "string",
          enum: ["day", "week", "month"],
          description: "Grouping interval for time series",
        },
      },
    },
    handler: async (params?: { period?: string; groupBy?: string }) => {
      // Try real API first if enabled
      if (USE_REAL_API) {
        const result = await fetchFromAnalytics<unknown>(`/api/analytics/users?period=${params?.period || 'month'}`);
        if (result) {
          return {
            content: [{ type: "text", text: JSON.stringify({ ...result, source: 'remote' }, null, 2) }],
          };
        }
      }

      const period = params?.period || "month";
      const multiplier = period === "week" ? 0.25 : period === "quarter" ? 3 : 1;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                period,
                source: 'mock',
                metrics: {
                  dau: {
                    value: Math.round(48500 * multiplier),
                    change: 5.2 + secureRandom() * 3,
                    timeSeries: generateTimeSeriesData(30, 1616 * multiplier, 300),
                  },
                  mau: {
                    value: Math.round(245000 * multiplier),
                    change: 8.7 + secureRandom() * 4,
                    timeSeries: generateTimeSeriesData(12, 20416 * multiplier, 2500),
                  },
                  stickiness: {
                    ratio: Math.round((48500 / 245000) * 100 * 100) / 100,
                    benchmark: 20,
                  },
                  retention: {
                    d1: 62.5 + secureRandom() * 5,
                    d7: 38.2 + secureRandom() * 5,
                    d30: 24.8 + secureRandom() * 3,
                    timeSeries: generateTimeSeriesData(12, 41.8, 8),
                  },
                  engagement: {
                    avgSessionDuration: 285 + secureRandom() * 60,
                    sessionsPerUser: 3.2 + secureRandom() * 1,
                    pagesPerSession: 8.5 + secureRandom() * 3,
                  },
                  userSegments: [
                    { segment: "Power Users", count: 24500, percentage: 10, avgOrders: 12.5 },
                    { segment: "Regular Users", count: 98000, percentage: 40, avgOrders: 4.2 },
                    { segment: "Occasional Users", count: 73500, percentage: 30, avgOrders: 1.8 },
                    { segment: "Churned Users", count: 49000, percentage: 20, avgOrders: 0 },
                  ],
                },
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    name: "get_merchant_metrics",
    description: "Get merchant performance metrics including GMV, fulfillment, and ratings",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["week", "month", "quarter"],
          description: "Time period for metrics",
        },
        sortBy: {
          type: "string",
          enum: ["gmv", "orders", "rating", "growth"],
          description: "Sort merchants by metric",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of top merchants to return",
        },
      },
    },
    handler: async (params?: { period?: string; sortBy?: string; limit?: number }) => {
      // Try real API first if enabled
      if (USE_REAL_API) {
        const result = await fetchFromAnalytics<unknown>(
          `/api/analytics/merchants?period=${params?.period || 'month'}&sortBy=${params?.sortBy || 'gmv'}&limit=${params?.limit || 10}`
        );
        if (result) {
          return {
            content: [{ type: "text", text: JSON.stringify({ ...result, source: 'remote' }, null, 2) }],
          };
        }
      }

      const period = params?.period || "month";
      const multiplier = period === "week" ? 0.25 : period === "quarter" ? 3 : 1;
      const limit = params?.limit || 10;

      const merchants = [
        { id: "M001", name: "Pizza Palace", category: "Food", gmv: 125000, orders: 2340, rating: 4.8, fulfillment: 98.5, growth: 15.2 },
        { id: "M002", name: "TechZone Store", category: "Electronics", gmv: 98000, orders: 890, rating: 4.6, fulfillment: 96.2, growth: 8.7 },
        { id: "M003", name: "Style Hub", category: "Fashion", gmv: 78000, orders: 1560, rating: 4.7, fulfillment: 97.8, growth: 22.4 },
        { id: "M004", name: "Fresh Mart", category: "Groceries", gmv: 67000, orders: 3450, rating: 4.5, fulfillment: 99.1, growth: 12.8 },
        { id: "M005", name: "Home Essentials", category: "Home", gmv: 54000, orders: 980, rating: 4.4, fulfillment: 95.5, growth: -2.3 },
        { id: "M006", name: "Beauty Box", category: "Beauty", gmv: 42000, orders: 1680, rating: 4.9, fulfillment: 98.9, growth: 35.6 },
        { id: "M007", name: "Quick Bites", category: "Food", gmv: 38000, orders: 2890, rating: 4.3, fulfillment: 94.2, growth: 5.1 },
        { id: "M008", name: "Gadget World", category: "Electronics", gmv: 35000, orders: 420, rating: 4.2, fulfillment: 93.8, growth: -8.5 },
        { id: "M009", name: "Trendy Threads", category: "Fashion", gmv: 28000, orders: 720, rating: 4.5, fulfillment: 96.5, growth: 18.9 },
        { id: "M010", name: "Wellness Center", category: "Health", gmv: 22000, orders: 560, rating: 4.7, fulfillment: 97.2, growth: 28.4 },
      ];

      const sortBy = params?.sortBy || "gmv";
      const sortKey = sortBy as "gmv" | "orders" | "rating" | "growth";
      const sortedMerchants = [...merchants]
        .sort((a, b) => b[sortKey] - a[sortKey])
        .slice(0, limit)
        .map((m) => ({
          ...m,
          gmv: Math.round(m.gmv * multiplier),
          orders: Math.round(m.orders * multiplier),
        }));

      const avgRating = merchants.reduce((sum, m) => sum + m.rating, 0) / merchants.length;
      const avgFulfillment = merchants.reduce((sum, m) => sum + m.fulfillment, 0) / merchants.length;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                period,
                source: 'mock',
                topMerchants: sortedMerchants,
                summary: {
                  totalMerchants: 1247,
                  activeMerchants: 1089,
                  avgRating: Math.round(avgRating * 100) / 100,
                  avgFulfillmentRate: Math.round(avgFulfillment * 100) / 100,
                  totalGMV: Math.round(merchants.reduce((sum, m) => sum + m.gmv, 0) * multiplier),
                  totalOrders: Math.round(merchants.reduce((sum, m) => sum + m.orders, 0) * multiplier),
                },
                insights: {
                  fastestGrowing: merchants.reduce((max, m) => (m.growth > max.growth ? m : max)),
                  bestRated: merchants.reduce((max, m) => (m.rating > max.rating ? m : max)),
                  highestFulfillment: merchants.reduce((max, m) => (m.fulfillment > max.fulfillment ? m : max)),
                },
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: "rez-analytics",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Error: Unknown tool ${request.params.name}` }],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(request.params.arguments as Record<string, unknown> | undefined);
    return result;
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  logger.error("REZ Analytics MCP Server running on stdio");
  logger.error(`Analytics Service URL: ${ANALYTICS_SERVICE_URL}`);
  logger.error(`Real API: ${USE_REAL_API ? 'ENABLED' : 'DISABLED (set USE_REAL_ANALYTICS=true to enable)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);

import {
  Widget,
  WidgetType,
  SubscriptionPlan,
  Metric,
  MetricsGrowth,
  ChartDataPoint,
} from '../types.js';
import { randomInt } from 'crypto';

export class MerchantOSEngine {
  // Generate default dashboard based on subscription
  generateDefaultDashboard(plan: SubscriptionPlan = SubscriptionPlan.FREE): Widget[] {
    const widgets: Widget[] = [
      {
        id: 'metric_orders',
        type: WidgetType.METRIC,
        title: 'Orders Today',
        config: { metric: 'orders', format: 'number' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        size: 'small',
      },
      {
        id: 'metric_revenue',
        type: WidgetType.METRIC,
        title: 'Revenue',
        config: { metric: 'revenue', format: 'currency' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        size: 'small',
      },
      {
        id: 'metric_customers',
        type: WidgetType.METRIC,
        title: 'New Customers',
        config: { metric: 'new_customers', format: 'number' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        size: 'small',
      },
      {
        id: 'chart_orders',
        type: WidgetType.CHART,
        title: 'Orders Trend',
        config: { chartType: 'line', metric: 'orders', groupBy: 'day' },
        position: { x: 0, y: 2, w: 6, h: 4 },
        size: 'medium',
      },
      {
        id: 'alerts_recent',
        type: WidgetType.ALERT,
        title: 'Recent Alerts',
        config: { limit: 5, types: ['inventory', 'order'] },
        position: { x: 6, y: 2, w: 6, h: 4 },
        size: 'medium',
      },
    ];

    // Add more widgets for higher plans
    if (plan === SubscriptionPlan.PRO || plan === SubscriptionPlan.ENTERPRISE) {
      widgets.push({
        id: 'insight_top_items',
        type: WidgetType.INSIGHT,
        title: 'Top Performing Items',
        config: { metric: 'top_items', limit: 5 },
        position: { x: 0, y: 6, w: 4, h: 3 },
        size: 'small',
      });
      widgets.push({
        id: 'action_reorder',
        type: WidgetType.ACTION,
        title: 'Reorder Suggestions',
        config: { basedOn: 'low_stock' },
        position: { x: 4, y: 6, w: 4, h: 3 },
        size: 'small',
      });
    }

    return widgets;
  }

  // Generate alerts based on data
  async generateAlerts(merchantId: string): Promise<unknown[]> {
    const alerts: unknown[] = [];
    // This would integrate with other services
    return alerts;
  }

  // Get dashboard metrics
  async getMetrics(merchantId: string, dateRange: string = '7d'): Promise<{
    current: Metric;
    previous: { orders: number; revenue: number };
    growth: MetricsGrowth;
    period: string;
  }> {
    // Calculate date range
    const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;

    // Mock metrics - in production, these would come from other services
    // Using crypto.randomInt for secure mock data generation
    const metrics: Metric = {
      orders: randomInt(100, 600),
      revenue: randomInt(10000, 110000),
      customers: randomInt(10, 60),
      avgOrderValue: randomInt(150, 650),
      newCustomers: randomInt(5, 25),
      returningCustomers: randomInt(10, 40),
      completionRate: randomInt(80, 100),
      avgDeliveryTime: randomInt(25, 45),
    };

    // Calculate growth
    const previousPeriod = {
      orders: Math.floor(metrics.orders * (0.9 + randomInt(0, 20) / 100)),
      revenue: Math.floor(metrics.revenue * (0.9 + randomInt(0, 20) / 100)),
    };

    return {
      current: metrics,
      previous: previousPeriod,
      growth: {
        orders: ((metrics.orders - previousPeriod.orders) / previousPeriod.orders * 100).toFixed(1),
        revenue: ((metrics.revenue - previousPeriod.revenue) / previousPeriod.revenue * 100).toFixed(1),
      },
      period: dateRange,
    };
  }

  // Get chart data
  async getChartData(
    merchantId: string,
    metric: string,
    groupBy: string = 'day',
    days: number = 7
  ): Promise<{ metric: string; groupBy: string; data: ChartDataPoint[] }> {
    const data: ChartDataPoint[] = [];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      data.push({
        date: date.toISOString().split('T')[0],
        value: randomInt(20, 120),
      });
    }

    return { metric, groupBy, data };
  }
}

export const engine = new MerchantOSEngine();

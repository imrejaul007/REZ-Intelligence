/**
 * Live Activity Store
 * In-memory store for real-time activities (use Redis in production)
 */

import { randomInt } from 'crypto';

interface Activity {
  id: string;
  type: 'order' | 'purchase' | 'review' | 'checkin' | 'deal' | 'signup';
  city: string;
  count: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface TrendingItem {
  id: string;
  name: string;
  category: string;
  orderCount: number;
  trend: 'up' | 'down' | 'stable';
  price: number;
  cashback: number;
  city?: string;
  lastUpdated: string;
}

interface MerchantLiveData {
  id: string;
  name: string;
  occupancy: number;
  waitTime: number;
  peopleBuyingNow: number;
  trendingItems: string[];
  flashDeal?: {
    discount: number;
    endsAt: string;
  };
  lastUpdated: string;
}

interface GetActivitiesOptions {
  city?: string;
  type?: string;
  limit?: number;
  since?: string;
}

interface GetTrendingOptions {
  city?: string;
  category?: string;
  limit?: number;
}

export class LiveActivityStore {
  private activities: Map<string, Activity> = new Map();
  private trendingItems: Map<string, TrendingItem> = new Map();
  private merchantData: Map<string, MerchantLiveData> = new Map();
  private activityOrder: string[] = [];

  constructor() {
    // Initialize with sample trending items
    this.initializeTrendingItems();
    this.initializeMerchantData();
  }

  private initializeTrendingItems() {
    const items: TrendingItem[] = [
      { id: '1', name: 'Nike Air Max 270', category: 'Footwear', orderCount: 156, trend: 'up', price: 4999, cashback: 15, lastUpdated: new Date().toISOString() },
      { id: '2', name: 'iPhone 15 Case', category: 'Accessories', orderCount: 234, trend: 'up', price: 299, cashback: 10, lastUpdated: new Date().toISOString() },
      { id: '3', name: 'Whey Protein 2kg', category: 'Health', orderCount: 89, trend: 'stable', price: 1299, cashback: 20, lastUpdated: new Date().toISOString() },
      { id: '4', name: 'Coffee Beans 500g', category: 'Food', orderCount: 67, trend: 'down', price: 499, cashback: 12, lastUpdated: new Date().toISOString() },
      { id: '5', name: 'Yoga Mat Premium', category: 'Fitness', orderCount: 123, trend: 'up', price: 799, cashback: 18, lastUpdated: new Date().toISOString() },
      { id: '6', name: 'Samsung Earbuds', category: 'Electronics', orderCount: 198, trend: 'up', price: 2499, cashback: 12, lastUpdated: new Date().toISOString() },
      { id: '7', name: 'Running Shoes', category: 'Footwear', orderCount: 145, trend: 'up', price: 2999, cashback: 14, lastUpdated: new Date().toISOString() },
      { id: '8', name: 'Organic Face Cream', category: 'Beauty', orderCount: 78, trend: 'stable', price: 599, cashback: 15, lastUpdated: new Date().toISOString() },
      { id: '9', name: 'LED Desk Lamp', category: 'Home', orderCount: 56, trend: 'up', price: 899, cashback: 10, lastUpdated: new Date().toISOString() },
      { id: '10', name: 'Protein Bar Pack', category: 'Health', orderCount: 201, trend: 'up', price: 399, cashback: 22, lastUpdated: new Date().toISOString() },
    ];

    items.forEach(item => this.trendingItems.set(item.id, item));
  }

  private initializeMerchantData() {
    const merchants: MerchantLiveData[] = [
      {
        id: 'm1',
        name: 'Spice Garden Restaurant',
        occupancy: 45,
        waitTime: 15,
        peopleBuyingNow: 8,
        trendingItems: ['Butter Chicken', 'Biryani', 'Naan'],
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'm2',
        name: 'Style Hub Fashion',
        occupancy: 62,
        waitTime: 0,
        peopleBuyingNow: 12,
        trendingItems: ['Kurtas', 'Sarees', 'Men\'s Shirts'],
        flashDeal: { discount: 25, endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'm3',
        name: 'FitLife Gym & Supplements',
        occupancy: 30,
        waitTime: 0,
        peopleBuyingNow: 5,
        trendingItems: ['Protein Powder', 'Pre-workout', 'BCAA'],
        lastUpdated: new Date().toISOString(),
      },
    ];

    merchants.forEach(merchant => this.merchantData.set(merchant.id, merchant));
  }

  addActivity(activity: Activity): Activity {
    this.activities.set(activity.id, activity);
    this.activityOrder.push(activity.id);

    // Keep only last 1000 activities
    if (this.activityOrder.length > 1000) {
      const oldId = this.activityOrder.shift();
      if (oldId) {
        this.activities.delete(oldId);
      }
    }

    // Update trending items based on activity
    if (activity.type === 'purchase' || activity.type === 'order') {
      this.updateTrendingFromActivity(activity);
    }

    return activity;
  }

  private updateTrendingFromActivity(activity: Activity) {
    // Randomly increase/decrease trending items
    this.trendingItems.forEach((item, id) => {
      const change = randomInt(-3, 8);
      item.orderCount = Math.max(1, item.orderCount + change);
      item.trend = change > 3 ? 'up' : change < -3 ? 'down' : 'stable';
      item.lastUpdated = new Date().toISOString();
    });
  }

  getActivities(options: GetActivitiesOptions = {}): Activity[] {
    let activities = Array.from(this.activities.values());

    if (options.city) {
      activities = activities.filter(a => a.city.toLowerCase() === options.city!.toLowerCase());
    }

    if (options.type) {
      activities = activities.filter(a => a.type === options.type);
    }

    if (options.since) {
      const since = new Date(options.since).getTime();
      activities = activities.filter(a => new Date(a.timestamp).getTime() >= since);
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, options.limit || 50);
  }

  getTrendingItems(options: GetTrendingOptions = {}): TrendingItem[] {
    let items = Array.from(this.trendingItems.values());

    if (options.city) {
      items = items.filter(item => !item.city || item.city.toLowerCase() === options.city!.toLowerCase());
    }

    if (options.category) {
      items = items.filter(item => item.category.toLowerCase() === options.category!.toLowerCase());
    }

    // Sort by order count descending
    items.sort((a, b) => b.orderCount - a.orderCount);

    return items.slice(0, options.limit || 20);
  }

  updateTrendingScores() {
    this.trendingItems.forEach(item => {
      const change = randomInt(-5, 16);
      item.orderCount = Math.max(1, item.orderCount + change);
      item.trend = change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
      item.lastUpdated = new Date().toISOString();
    });
  }

  getMerchantLiveData(merchantId: string): MerchantLiveData | null {
    const merchant = this.merchantData.get(merchantId);

    if (merchant) {
      // Simulate real-time updates
      merchant.occupancy = Math.min(100, Math.max(0, merchant.occupancy + randomInt(-5, 6)));
      merchant.peopleBuyingNow = Math.max(0, merchant.peopleBuyingNow + randomInt(-2, 4));
      merchant.lastUpdated = new Date().toISOString();

      // Update flash deal countdown
      if (merchant.flashDeal) {
        const endsAt = new Date(merchant.flashDeal.endsAt).getTime();
        if (endsAt < Date.now()) {
          merchant.flashDeal = undefined;
        }
      }
    }

    return merchant || null;
  }

  updateMerchantData(merchantId: string, data: Partial<MerchantLiveData>) {
    const existing = this.merchantData.get(merchantId);
    if (existing) {
      Object.assign(existing, data, { lastUpdated: new Date().toISOString() });
      return existing;
    }
    return null;
  }

  getAllMerchantIds(): string[] {
    return Array.from(this.merchantData.keys());
  }

  // Stats
  getStats() {
    const totalActivities = this.activities.size;
    const recentActivities = this.getActivities({ limit: 100 });

    const byCity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    recentActivities.forEach(a => {
      byCity[a.city] = (byCity[a.city] || 0) + a.count;
      byType[a.type] = (byType[a.type] || 0) + a.count;
    });

    return {
      totalActivities,
      recentCount: recentActivities.length,
      byCity,
      byType,
    };
  }
}

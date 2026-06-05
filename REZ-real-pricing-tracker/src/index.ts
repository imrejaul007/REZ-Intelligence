/**
 * REZ Real-Time Pricing Tracker
 * Track competitor prices in real-time with alerts and insights
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cron from 'node-cron';

// ============== SCHEMAS ==============

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  category: String,
  basePrice: Number,
  competitors: [{
    competitorId: String,
    competitorName: String,
    lastKnownPrice: Number,
    lastUpdated: Date
  }]
});

const priceSnapshotSchema = new mongoose.Schema({
  snapshotId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  competitorId: { type: String, required: true, index: true },
  competitorName: String,
  source: { type: String, enum: ['zomato', 'swiggy', 'google', 'website', 'manual'], required: true },
  sourceUrl: String,
  items: [{
    name: String,
    price: Number,
    originalPrice: Number,
    discount: Number,
    available: Boolean,
    currency: { type: String, default: 'INR' }
  }],
  scrapedAt: { type: Date, default: Date.now }
});

const priceAlertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true },
  merchantId: { type: String, required: true, index: true },
  competitorId: String,
  competitorName: String,
  type: { type: String, enum: ['price_drop', 'price_increase', 'new_item', 'item_removed', 'discount'], required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  title: String,
  message: String,
  item: {
    name: String,
    oldPrice: Number,
    newPrice: Number,
    change: Number,
    changePercent: Number
  },
  action: String,
  status: { type: String, enum: ['new', 'viewed', 'actioned', 'dismissed'], default: 'new' },
  createdAt: { type: Date, default: Date.now }
});

const competitorSchema = new mongoose.Schema({
  competitorId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['direct', 'indirect'], default: 'direct' },
  sources: [{
    type: { type: String, enum: ['zomato', 'swiggy', 'google', 'website', 'instagram', 'manual'] },
    url: String,
    lastScraped: Date,
    status: { type: String, enum: ['active', 'failed', 'disabled'], default: 'active' }
  }],
  scrapeSchedule: { type: String, default: '0 */6 * * *' }, // Every 6 hours
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Models
const Product = mongoose.model('Product', productSchema);
const PriceSnapshot = mongoose.model('PriceSnapshot', priceSnapshotSchema);
const PriceAlert = mongoose.model('PriceAlert', priceAlertSchema);
const Competitor = mongoose.model('Competitor', competitorSchema);

// ============== SERVICE ==============

class RealPricingTrackerService {
  private app: express.Application;
  private uuuid = () => Math.random().toString(36).substr(2, 9);

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', service: 'real-pricing-tracker' });
    });

    // ========== COMPETITORS ==========

    // Add competitor
    this.app.post('/api/competitors', async (req: Request, res: Response) => {
      try {
        const { merchantId, name, type, sources } = req.body;
        const competitor = new Competitor({
          competitorId: `comp_${this.uuuid()}`,
          merchantId,
          name,
          type,
          sources
        });
        await competitor.save();
        res.json(competitor);
      } catch (error) {
        res.status(500).json({ error: 'Failed to add competitor' });
      }
    });

    // Get competitors
    this.app.get('/api/competitors/:merchantId', async (req: Request, res: Response) => {
      try {
        const competitors = await Competitor.find({
          merchantId: req.params.merchantId,
          isActive: true
        }).lean();
        res.json(competitors);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch competitors' });
      }
    });

    // ========== SCRAPING ==========

    // Trigger scrape
    this.app.post('/api/scrape/:competitorId', async (req: Request, res: Response) => {
      try {
        const competitor = await Competitor.findOne({ competitorId: req.params.competitorId });
        if (!competitor) {
          return res.status(404).json({ error: 'Competitor not found' });
        }

        // In production, this would call actual scrapers
        const mockItems = this.generateMockPriceData(competitor.name);

        const snapshot = new PriceSnapshot({
          snapshotId: `snap_${this.uuuid()}`,
          merchantId: competitor.merchantId,
          competitorId: competitor.competitorId,
          competitorName: competitor.name,
          source: 'manual',
          items: mockItems
        });
        await snapshot.save();

        // Check for price changes
        await this.checkPriceChanges(competitor, snapshot);

        res.json({ snapshot, competitor });
      } catch (error) {
        res.status(500).json({ error: 'Failed to scrape competitor' });
      }
    });

    // Batch scrape all competitors
    this.app.post('/api/scrape/batch/:merchantId', async (req: Request, res: Response) => {
      try {
        const competitors = await Competitor.find({
          merchantId: req.params.merchantId,
          isActive: true
        });

        const results = [];
        for (const comp of competitors) {
          const mockItems = this.generateMockPriceData(comp.name);
          const snapshot = new PriceSnapshot({
            snapshotId: `snap_${this.uuuid()}`,
            merchantId: comp.merchantId,
            competitorId: comp.competitorId,
            competitorName: comp.name,
            source: 'batch',
            items: mockItems
          });
          await snapshot.save();
          await this.checkPriceChanges(comp, snapshot);
          results.push(snapshot);
        }

        res.json({ scraped: results.length, snapshots: results });
      } catch (error) {
        res.status(500).json({ error: 'Failed to batch scrape' });
      }
    });

    // ========== PRICE HISTORY ==========

    // Get price history for competitor
    this.app.get('/api/prices/:competitorId/history', async (req: Request, res: Response) => {
      try {
        const { days, item } = req.query;
        const startDate = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000);

        const query: any = {
          competitorId: req.params.competitorId,
          scrapedAt: { $gte: startDate }
        };

        const snapshots = await PriceSnapshot.find(query)
          .sort({ scrapedAt: -1 })
          .lean();

        res.json(snapshots);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch price history' });
      }
    });

    // Get price comparison
    this.app.get('/api/prices/compare/:merchantId', async (req: Request, res: Response) => {
      try {
        const competitors = await Competitor.find({ merchantId: req.params.merchantId });
        const latestSnapshots = [];

        for (const comp of competitors) {
          const latest = await PriceSnapshot.findOne({ competitorId: comp.competitorId })
            .sort({ scrapedAt: -1 });
          if (latest) {
            latestSnapshots.push(latest);
          }
        }

        // Aggregate by item
        const itemPrices = new Map<string, any>();
        for (const snap of latestSnapshots) {
          for (const item of snap.items) {
            const existing = itemPrices.get(item.name) || { name: item.name, prices: [] };
            existing.prices.push({
              competitor: snap.competitorName,
              price: item.price,
              originalPrice: item.originalPrice,
              discount: item.discount
            });
            itemPrices.set(item.name, existing);
          }
        }

        res.json(Array.from(itemPrices.values()));
      } catch (error) {
        res.status(500).json({ error: 'Failed to compare prices' });
      }
    });

    // ========== ALERTS ==========

    // Get alerts
    this.app.get('/api/alerts/:merchantId', async (req: Request, res: Response) => {
      try {
        const { status, type, days } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (status) query.status = status;
        if (type) query.type = type;
        if (days) {
          const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
          query.createdAt = { $gte: startDate };
        }

        const alerts = await PriceAlert.find(query)
          .sort({ createdAt: -1 })
          .lean();

        res.json(alerts);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
      }
    });

    // Get alert counts
    this.app.get('/api/alerts/:merchantId/counts', async (req: Request, res: Response) => {
      try {
        const counts = await PriceAlert.aggregate([
          { $match: { merchantId: req.params.merchantId, status: 'new' } },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 }
            }
          }
        ]);

        const result = {
          total: counts.reduce((sum, c) => sum + c.count, 0),
          byType: Object.fromEntries(counts.map(c => [c._id, c.count]))
        };

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get counts' });
      }
    });

    // Update alert status
    this.app.patch('/api/alerts/:alertId', async (req: Request, res: Response) => {
      try {
        const alert = await PriceAlert.findOneAndUpdate(
          { alertId: req.params.alertId },
          req.body,
          { new: true }
        );
        res.json(alert);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update alert' });
      }
    });

    // Dismiss alert
    this.app.post('/api/alerts/:alertId/dismiss', async (req: Request, res: Response) => {
      try {
        const alert = await PriceAlert.findOneAndUpdate(
          { alertId: req.params.alertId },
          { status: 'dismissed' },
          { new: true }
        );
        res.json(alert);
      } catch (error) {
        res.status(500).json({ error: 'Failed to dismiss alert' });
      }
    });

    // ========== ANALYTICS ==========

    // Get pricing insights
    this.app.get('/api/insights/:merchantId', async (req: Request, res: Response) => {
      try {
        const { days } = req.query;
        const startDate = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000);

        const competitors = await Competitor.find({ merchantId: req.params.merchantId });
        const competitorIds = competitors.map(c => c.competitorId);

        // Get price drops
        const priceDrops = await PriceAlert.countDocuments({
          merchantId: req.params.merchantId,
          type: 'price_drop',
          createdAt: { $gte: startDate }
        });

        // Get total snapshots
        const totalScrapes = await PriceSnapshot.countDocuments({
          competitorId: { $in: competitorIds },
          scrapedAt: { $gte: startDate }
        });

        // Get competitors with most price changes
        const mostActive = await PriceAlert.aggregate([
          { $match: { merchantId: req.params.merchantId, createdAt: { $gte: startDate } } },
          { $group: { _id: '$competitorName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ]);

        res.json({
          period: `${days || 30} days`,
          priceDrops,
          totalScrapes,
          competitorsTracked: competitors.length,
          mostActiveCompetitors: mostActive
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get insights' });
      }
    });
  }

  private generateMockPriceData(competitorName: string) {
    const baseItems = [
      { name: 'Butter Chicken', minPrice: 250, maxPrice: 450 },
      { name: 'Biryani', minPrice: 200, maxPrice: 350 },
      { name: 'Naan', minPrice: 40, maxPrice: 80 },
      { name: 'Dal Makhani', minPrice: 180, maxPrice: 280 },
      { name: 'Paneer Dishes', minPrice: 220, maxPrice: 380 }
    ];

    return baseItems.map(item => {
      const price = Math.floor(Math.random() * (item.maxPrice - item.minPrice) + item.minPrice);
      const hasDiscount = Math.random() > 0.7;
      const originalPrice = hasDiscount ? Math.floor(price * 1.2) : price;
      const discount = hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0;

      return {
        name: item.name,
        price,
        originalPrice,
        discount,
        available: Math.random() > 0.1
      };
    });
  }

  private async checkPriceChanges(competitor: any, newSnapshot: any) {
    const previousSnapshot = await PriceSnapshot.findOne({
      competitorId: competitor.competitorId,
      snapshotId: { $ne: newSnapshot.snapshotId }
    }).sort({ scrapedAt: -1 });

    if (!previousSnapshot) return;

    for (const newItem of newSnapshot.items) {
      const prevItem = previousSnapshot.items.find((p: any) => p.name === newItem.name);

      if (prevItem && newItem.price !== prevItem.price) {
        const change = newItem.price - prevItem.price;
        const changePercent = (change / prevItem.price) * 100;

        let alertType = 'price_change';
        let severity = 'medium';

        if (change < 0) {
          alertType = 'price_drop';
          if (changePercent <= -20) severity = 'critical';
          else if (changePercent <= -10) severity = 'high';
        } else {
          alertType = 'price_increase';
        }

        const alert = new PriceAlert({
          alertId: `alert_${this.uuuid()}`,
          merchantId: competitor.merchantId,
          competitorId: competitor.competitorId,
          competitorName: competitor.name,
          type: alertType,
          severity,
          title: `${newItem.name} price ${change < 0 ? 'dropped' : 'increased'}`,
          message: `${competitor.name} ${change < 0 ? 'dropped' : 'increased'} ${newItem.name} price from ₹${prevItem.price} to ₹${newItem.price}`,
          item: {
            name: newItem.name,
            oldPrice: prevItem.price,
            newPrice: newItem.price,
            change,
            changePercent
          },
          action: change < 0 ? 'Consider matching or highlighting your value proposition' : 'No immediate action needed'
        });

        await alert.save();
      }
    }
  }

  async start(port: number = 4212): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_pricing_tracker'
      );
      console.log('[RealPricingTracker] Connected to MongoDB');

      // Schedule periodic scraping
      cron.schedule('0 */6 * * *', async () => {
        console.log('[RealPricingTracker] Running scheduled scrape');
        // Would trigger scraping for all active competitors
      });

      this.app.listen(port, () => {
        console.log(`[RealPricingTracker] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[RealPricingTracker] Failed to start:', error);
      throw error;
    }
  }
}

const service = new RealPricingTrackerService();
service.start(4212);

export default service;

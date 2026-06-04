/**
 * REZ Competitor Alerts Service
 * Real-time competitor monitoring - pricing, campaigns, and market intelligence
 *
 * Features:
 * - Price monitoring
 * - Campaign tracking
 * - Alert generation
 * - Counter-strategy recommendations
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cron from 'node-cron';

// ============== SCHEMAS ==============

// Competitor
const competitorSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['direct', 'indirect'], default: 'direct' },
  location: {
    address: String,
    coordinates: { type: [Number], index: '2dsphere' }
  },
  sources: [{
    type: { type: String, enum: ['google', 'zomato', 'swiggy', 'instagram', 'website', 'manual'] },
    url: String,
    lastScraped: Date
  }],
  status: { type: String, enum: ['active', 'paused', 'removed'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

// Price Tracking
const priceSnapshotSchema = new mongoose.Schema({
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor', index: true },
  merchantId: { type: String, index: true },
  items: [{
    name: String,
    price: Number,
    originalPrice: Number,
    discount: Number, // percentage
    currency: { type: String, default: 'INR' }
  }],
  timestamp: { type: Date, default: Date.now }
});

// Campaign Tracking
const campaignTrackingSchema = new mongoose.Schema({
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor' },
  merchantId: { type: String, index: true },
  platform: { type: String, enum: ['instagram', 'facebook', 'google', 'zomato', 'swiggy'] },
  type: { type: String, enum: ['discount', 'offer', 'cashback', 'combo', 'loyalty'] },
  title: String,
  description: String,
  discount: Number,
  startDate: Date,
  endDate: Date,
  detectedAt: { type: Date, default: Date.now },
  source: String,
  engagement: {
    likes: Number,
    comments: Number,
    shares: Number
  }
});

// Alert
const alertSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor' },
  type: {
    type: String,
    enum: ['price_drop', 'new_offer', 'campaign', 'review_drop', 'rating_change', 'new_location'],
    required: true
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  title: String,
  message: String,
  data: mongoose.Schema.Types.Mixed,
  recommendation: String,
  status: { type: String, enum: ['new', 'viewed', 'actioned', 'dismissed'], default: 'new' },
  createdAt: { type: Date, default: Date.now }
});

// Review Tracking
const reviewSnapshotSchema = new mongoose.Schema({
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor' },
  merchantId: { type: String, index: true },
  platform: String,
  rating: Number,
  reviewCount: Number,
  recentReviews: [{
    rating: Number,
    text: String,
    date: Date,
    sentiment: String
  }],
  timestamp: { type: Date, default: Date.now }
});

// Models
const Competitor = mongoose.model('Competitor', competitorSchema);
const PriceSnapshot = mongoose.model('PriceSnapshot', priceSnapshotSchema);
const CampaignTracking = mongoose.model('CampaignTracking', campaignTrackingSchema);
const Alert = mongoose.model('Alert', alertSchema);
const ReviewSnapshot = mongoose.model('ReviewSnapshot', reviewSnapshotSchema);

// ============== SERVICE ==============

class CompetitorAlertsService {
  private app: express.Application;

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
      res.json({ status: 'healthy', service: 'competitor-alerts' });
    });

    // ========== COMPETITORS ==========

    // Add competitor
    this.app.post('/api/competitors', async (req: Request, res: Response) => {
      try {
        const competitor = new Competitor(req.body);
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
          status: 'active'
        }).lean();
        res.json(competitors);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch competitors' });
      }
    });

    // Update competitor
    this.app.patch('/api/competitors/:id', async (req: Request, res: Response) => {
      try {
        const competitor = await Competitor.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );
        res.json(competitor);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update competitor' });
      }
    });

    // ========== PRICE TRACKING ==========

    // Record price snapshot
    this.app.post('/api/prices', async (req: Request, res: Response) => {
      try {
        const snapshot = new PriceSnapshot(req.body);
        await snapshot.save();

        // Check for significant changes
        await this.checkPriceChanges(snapshot);

        res.json(snapshot);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record prices' });
      }
    });

    // Get price history
    this.app.get('/api/prices/:competitorId/history', async (req: Request, res: Response) => {
      try {
        const { days } = req.query;
        const startDate = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000);

        const history = await PriceSnapshot.find({
          competitorId: req.params.competitorId,
          timestamp: { $gte: startDate }
        }).sort({ timestamp: 1 }).lean();

        res.json(history);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch price history' });
      }
    });

    // ========== CAMPAIGN TRACKING ==========

    // Record competitor campaign
    this.app.post('/api/campaigns', async (req: Request, res: Response) => {
      try {
        const campaign = new CampaignTracking(req.body);
        await campaign.save();

        // Generate alert
        await this.generateCampaignAlert(campaign);

        res.json(campaign);
      } catch (error) {
        res.status(500).json({ error: 'Failed to track campaign' });
      }
    });

    // Get competitor campaigns
    this.app.get('/api/campaigns/:merchantId', async (req: Request, res: Response) => {
      try {
        const { competitorId, platform, days } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (competitorId) query.competitorId = competitorId;
        if (platform) query.platform = platform;
        if (days) {
          const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
          query.detectedAt = { $gte: startDate };
        }

        const campaigns = await CampaignTracking.find(query).sort({ detectedAt: -1 }).lean();
        res.json(campaigns);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
      }
    });

    // ========== ALERTS ==========

    // Get alerts
    this.app.get('/api/alerts/:merchantId', async (req: Request, res: Response) => {
      try {
        const { status, severity, type, limit } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (status) query.status = status;
        if (severity) query.severity = severity;
        if (type) query.type = type;

        const alerts = await Alert.find(query)
          .sort({ createdAt: -1 })
          .limit(Number(limit) || 50)
          .lean();

        res.json(alerts);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
      }
    });

    // Get unread alert count
    this.app.get('/api/alerts/:merchantId/count', async (req: Request, res: Response) => {
      try {
        const count = await Alert.countDocuments({
          merchantId: req.params.merchantId,
          status: 'new'
        });
        res.json({ count });
      } catch (error) {
        res.status(500).json({ error: 'Failed to count alerts' });
      }
    });

    // Update alert status
    this.app.patch('/api/alerts/:id', async (req: Request, res: Response) => {
      try {
        const alert = await Alert.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );
        res.json(alert);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update alert' });
      }
    });

    // Dismiss alert
    this.app.post('/api/alerts/:id/dismiss', async (req: Request, res: Response) => {
      try {
        const alert = await Alert.findByIdAndUpdate(
          req.params.id,
          { status: 'dismissed' },
          { new: true }
        );
        res.json(alert);
      } catch (error) {
        res.status(500).json({ error: 'Failed to dismiss alert' });
      }
    });

    // ========== REVIEW TRACKING ==========

    // Record review snapshot
    this.app.post('/api/reviews', async (req: Request, res: Response) => {
      try {
        const snapshot = new ReviewSnapshot(req.body);
        await snapshot.save();

        // Check for rating changes
        await this.checkRatingChanges(snapshot);

        res.json(snapshot);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record reviews' });
      }
    });

    // Get review history
    this.app.get('/api/reviews/:competitorId/history', async (req: Request, res: Response) => {
      try {
        const { days } = req.query;
        const startDate = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000);

        const history = await ReviewSnapshot.find({
          competitorId: req.params.competitorId,
          timestamp: { $gte: startDate }
        }).sort({ timestamp: 1 }).lean();

        res.json(history);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch review history' });
      }
    });

    // ========== MANUAL SCRAPE ==========

    // Trigger manual scrape
    this.app.post('/api/scrape/:competitorId', async (req: Request, res: Response) => {
      try {
        const competitor = await Competitor.findById(req.params.competitorId);

        if (!competitor) {
          return res.status(404).json({ error: 'Competitor not found' });
        }

        // Simulate scrape (in production, this would call actual scrapers)
        const mockPrices = [
          { name: 'Popular Item 1', price: Math.floor(Math.random() * 500) + 200 },
          { name: 'Popular Item 2', price: Math.floor(Math.random() * 400) + 150 },
          { name: 'Combo Meal', price: Math.floor(Math.random() * 600) + 300 }
        ];

        const snapshot = new PriceSnapshot({
          competitorId: competitor._id,
          merchantId: competitor.merchantId,
          items: mockPrices
        });
        await snapshot.save();

        // Update last scraped
        competitor.sources = competitor.sources.map(s => ({
          ...s.toObject(),
          lastScraped: new Date()
        }));
        await competitor.save();

        res.json({ snapshot, competitor });
      } catch (error) {
        res.status(500).json({ error: 'Failed to scrape competitor' });
      }
    });

    // ========== INSIGHTS ==========

    // Get competitive insights
    this.app.get('/api/insights/:merchantId', async (req: Request, res: Response) => {
      try {
        const { days } = req.query;
        const startDate = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000);

        const competitors = await Competitor.find({
          merchantId: req.params.merchantId,
          status: 'active'
        }).lean();

        const competitorIds = competitors.map(c => c._id);

        // Aggregate data
        const priceCount = await PriceSnapshot.countDocuments({
          competitorId: { $in: competitorIds },
          timestamp: { $gte: startDate }
        });

        const campaignCount = await CampaignTracking.countDocuments({
          competitorId: { $in: competitorIds },
          detectedAt: { $gte: startDate }
        });

        const alertCount = await Alert.countDocuments({
          merchantId: req.params.merchantId,
          createdAt: { $gte: startDate }
        });

        const criticalAlerts = await Alert.countDocuments({
          merchantId: req.params.merchantId,
          severity: 'critical',
          createdAt: { $gte: startDate }
        });

        res.json({
          competitorCount: competitors.length,
          priceSnapshots: priceCount,
          campaignsTracked: campaignCount,
          alertsGenerated: alertCount,
          criticalAlerts,
          period: `${days || 30} days`
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate insights' });
      }
    });
  }

  /**
   * Check for significant price changes
   */
  private async checkPriceChanges(snapshot: any): Promise<void> {
    // Get previous snapshot
    const previous = await PriceSnapshot.findOne({
      competitorId: snapshot.competitorId,
      _id: { $ne: snapshot._id }
    }).sort({ timestamp: -1 });

    if (!previous) return;

    // Check for price drops
    for (const item of snapshot.items) {
      const prevItem = previous.items.find((p: any) => p.name === item.name);

      if (prevItem && item.price < prevItem.price) {
        const dropPercent = ((prevItem.price - item.price) / prevItem.price) * 100;

        if (dropPercent >= 10) {
          const competitor = await Competitor.findById(snapshot.competitorId);

          const alert = new Alert({
            merchantId: snapshot.merchantId,
            competitorId: snapshot.competitorId,
            type: 'price_drop',
            severity: dropPercent >= 25 ? 'high' : 'medium',
            title: `Price Drop: ${item.name}`,
            message: `${competitor?.name || 'Competitor'} dropped ${item.name} price by ${dropPercent.toFixed(0)}%`,
            data: { item: item.name, oldPrice: prevItem.price, newPrice: item.price, dropPercent },
            recommendation: this.getPriceCounterStrategy(dropPercent)
          });

          await alert.save();
        }
      }
    }
  }

  /**
   * Check for rating changes
   */
  private async checkRatingChanges(snapshot: any): Promise<void> {
    const previous = await ReviewSnapshot.findOne({
      competitorId: snapshot.competitorId,
      _id: { $ne: snapshot._id }
    }).sort({ timestamp: -1 });

    if (!previous) return;

    const ratingChange = snapshot.rating - previous.rating;

    if (Math.abs(ratingChange) >= 0.3) {
      const competitor = await Competitor.findById(snapshot.competitorId);

      const alert = new Alert({
        merchantId: snapshot.merchantId,
        competitorId: snapshot.competitorId,
        type: ratingChange < 0 ? 'review_drop' : 'rating_change',
        severity: Math.abs(ratingChange) >= 0.5 ? 'high' : 'medium',
        title: ratingChange < 0 ? 'Rating Dropped' : 'Rating Improved',
        message: `${competitor?.name || 'Competitor'} rating ${ratingChange > 0 ? 'improved' : 'dropped'} by ${Math.abs(ratingChange).toFixed(1)} stars`,
        data: { oldRating: previous.rating, newRating: snapshot.rating, change: ratingChange },
        recommendation: ratingChange < 0
          ? 'Monitor closely. Focus on improving customer experience and addressing complaints.'
          : 'Analyze what\'s working for them. Consider adopting similar practices.'
      });

      await alert.save();
    }
  }

  /**
   * Generate alert for competitor campaign
   */
  private async generateCampaignAlert(campaign: any): Promise<void> {
    const competitor = await Competitor.findById(campaign.competitorId);

    let severity = 'medium';
    let recommendation = 'Monitor performance. No immediate action needed.';

    if (campaign.discount >= 30) {
      severity = 'critical';
      recommendation = 'Aggressive discount detected. Consider matching or offering better value through loyalty cashback.';
    } else if (campaign.discount >= 20) {
      severity = 'high';
      recommendation = 'Significant offer detected. Launch a targeted retention campaign for your loyal customers.';
    }

    const alert = new Alert({
      merchantId: campaign.merchantId,
      competitorId: campaign.competitorId,
      type: 'campaign',
      severity,
      title: `${competitor?.name || 'Competitor'} launched ${campaign.type} campaign`,
      message: `${campaign.title || campaign.description || 'New campaign'} - Up to ${campaign.discount}% off`,
      data: { platform: campaign.platform, type: campaign.type, discount: campaign.discount },
      recommendation
    });

    await alert.save();
  }

  /**
   * Get counter-strategy based on price drop
   */
  private getPriceCounterStrategy(dropPercent: number): string {
    if (dropPercent >= 30) {
      return 'Aggressive price drop detected. Consider: 1) Matching with loyalty bonus, 2) Emphasizing quality and service, 3) Running targeted win-back campaigns.';
    } else if (dropPercent >= 20) {
      return 'Significant drop. Options: 1) Offer value bundles instead of price match, 2) Launch loyalty cashback to differentiate, 3) Highlight unique selling points.';
    } else {
      return 'Minor price adjustment. Consider reviewing your pricing strategy and ensuring perceived value is communicated clearly.';
    }
  }

  async start(port: number = 4295): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_competitor_alerts'
      );
      console.log('[CompetitorAlerts] Connected to MongoDB');

      // Schedule periodic checks (every 6 hours)
      cron.schedule('0 */6 * * *', async () => {
        console.log('[CompetitorAlerts] Running scheduled competitor check');
        // In production, this would trigger scrapers
      });

      this.app.listen(port, () => {
        console.log(`[CompetitorAlerts] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[CompetitorAlerts] Failed to start:', error);
      throw error;
    }
  }
}

// Start service
const service = new CompetitorAlertsService();
service.start(4295);

export default service;

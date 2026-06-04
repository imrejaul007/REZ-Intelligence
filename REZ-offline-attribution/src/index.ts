/**
 * REZ Offline Attribution Service
 * Track offline conversions - walk-ins, phone calls, in-store visits
 *
 * Features:
 * - Track offline touchpoints
 * - Connect to digital campaigns
 * - Multi-touch attribution
 * - Call tracking
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// ============== SCHEMAS ==============

// Offline Touchpoint
const touchpointSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  customerId: String,
  type: {
    type: String,
    enum: ['walk_in', 'phone_call', 'inquiry', 'visit', 'dine_in', 'browse'],
    required: true
  },
  channel: {
    type: String,
    enum: ['qr_scan', 'flyer', 'poster', 'signage', 'referral', 'organic', 'direct', 'unknown'],
    default: 'unknown'
  },
  source: String, // Specific source (e.g., campaign ID, QR code ID)
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] // [lng, lat]
  },
  timestamp: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed
});

// Offline Conversion
const conversionSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  customerId: String,

  // Conversion details
  type: {
    type: String,
    enum: ['purchase', 'signup', 'booking', 'enquiry', 'membership'],
    required: true
  },
  revenue: Number,
  orderId: String,

  // Attribution
  attributedTouchpoints: [{
    touchpointId: mongoose.Schema.Types.ObjectId,
    type: String,
    channel: String,
    timestamp: Date,
    weight: Number // Attribution weight
  }],

  // Attribution model
  attributionModel: {
    type: String,
    enum: ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based', 'data_driven'],
    default: 'data_driven'
  },

  // Source tracking
  utmSource: String,
  utmMedium: String,
  utmCampaign: String,
  gclid: String,
  fbclid: String,

  timestamp: { type: Date, default: Date.now }
});

// Attribution Window
const attributionWindowSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  lookbackWindow: { type: Number, default: 30 }, // days
  impressionWindow: { type: Number, default: 7 }, // days
  clickWindow: { type: Number, default: 14 }, // days
  viewWindow: { type: Number, default: 1 }, // days
  defaultModel: {
    type: String,
    enum: ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'],
    default: 'position_based'
  }
});

// Attribution Report
const reportSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  reportType: {
    type: String,
    enum: ['channel', 'campaign', 'touchpoint', 'customer', 'time_period'],
    required: true
  },
  period: {
    start: Date,
    end: Date
  },
  data: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

// Models
const Touchpoint = mongoose.model('Touchpoint', touchpointSchema);
const Conversion = mongoose.model('Conversion', conversionSchema);
const AttributionWindow = mongoose.model('AttributionWindow', attributionWindowSchema);
const Report = mongoose.model('Report', reportSchema);

// ============== SERVICE ==============

class OfflineAttributionService {
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
      res.json({ status: 'healthy', service: 'offline-attribution' });
    });

    // ========== TOUCHPOINTS ==========

    // Record offline touchpoint
    this.app.post('/api/touchpoints', async (req: Request, res: Response) => {
      try {
        const touchpoint = new Touchpoint(req.body);
        await touchpoint.save();
        res.json(touchpoint);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record touchpoint' });
      }
    });

    // Record QR scan as touchpoint
    this.app.post('/api/touchpoints/qr', async (req: Request, res: Response) => {
      try {
        const { merchantId, customerId, qrCodeId, location } = req.body;

        const touchpoint = new Touchpoint({
          merchantId,
          customerId,
          type: 'walk_in',
          channel: 'qr_scan',
          source: qrCodeId,
          location,
          timestamp: new Date()
        });

        await touchpoint.save();
        res.json(touchpoint);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record QR touchpoint' });
      }
    });

    // Record phone call
    this.app.post('/api/touchpoints/call', async (req: Request, res: Response) => {
      try {
        const { merchantId, customerId, phoneNumber, callDuration, callRecording } = req.body;

        const touchpoint = new Touchpoint({
          merchantId,
          customerId,
          type: 'phone_call',
          channel: 'direct',
          metadata: { phoneNumber, callDuration, callRecording }
        });

        await touchpoint.save();
        res.json(touchpoint);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record call' });
      }
    });

    // Record in-store visit
    this.app.post('/api/touchpoints/visit', async (req: Request, res: Response) => {
      try {
        const { merchantId, customerId, checkInTime } = req.body;

        const touchpoint = new Touchpoint({
          merchantId,
          customerId,
          type: 'dine_in',
          channel: 'direct',
          metadata: { checkInTime }
        });

        await touchpoint.save();
        res.json(touchpoint);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record visit' });
      }
    });

    // Get touchpoints
    this.app.get('/api/touchpoints/:merchantId', async (req: Request, res: Response) => {
      try {
        const { startDate, endDate, channel, type } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = new Date(startDate as string);
          if (endDate) query.timestamp.$lte = new Date(endDate as string);
        }
        if (channel) query.channel = channel;
        if (type) query.type = type;

        const touchpoints = await Touchpoint.find(query).sort({ timestamp: -1 }).lean();
        res.json(touchpoints);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch touchpoints' });
      }
    });

    // ========== CONVERSIONS ==========

    // Record offline conversion
    this.app.post('/api/conversions', async (req: Request, res: Response) => {
      try {
        const { merchantId, customerId, type, revenue, attributionData } = req.body;

        // Find attributed touchpoints
        const touchpoints = await this.findAttributedTouchpoints(
          merchantId,
          customerId,
          attributionData
        );

        // Calculate attribution weights
        const attributedTouchpoints = this.calculateAttribution(touchpoints, attributionData?.model || 'position_based');

        const conversion = new Conversion({
          merchantId,
          customerId,
          type,
          revenue,
          attributedTouchpoints,
          attributionModel: attributionData?.model || 'position_based',
          utmSource: attributionData?.utmSource,
          utmMedium: attributionData?.utmMedium,
          utmCampaign: attributionData?.utmCampaign
        });

        await conversion.save();
        res.json(conversion);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record conversion' });
      }
    });

    // Get conversions
    this.app.get('/api/conversions/:merchantId', async (req: Request, res: Response) => {
      try {
        const { startDate, endDate } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = new Date(startDate as string);
          if (endDate) query.timestamp.$lte = new Date(endDate as string);
        }

        const conversions = await Conversion.find(query).sort({ timestamp: -1 }).lean();
        res.json(conversions);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversions' });
      }
    });

    // ========== ATTRIBUTION ==========

    // Get attribution report
    this.app.get('/api/reports/:merchantId/channel', async (req: Request, res: Response) => {
      try {
        const { startDate, endDate } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = new Date(startDate as string);
          if (endDate) query.timestamp.$lte = new Date(endDate as string);
        }

        const conversions = await Conversion.find(query).lean();

        // Aggregate by channel
        const channelData = new Map<string, {
          conversions: number;
          revenue: number;
          attributedValue: number;
        }>();

        for (const conv of conversions) {
          for (const attr of conv.attributedTouchpoints || []) {
            const channel = attr.channel || 'unknown';
            const existing = channelData.get(channel) || { conversions: 0, revenue: 0, attributedValue: 0 };

            existing.conversions += 1;
            existing.revenue += conv.revenue || 0;
            existing.attributedValue += (conv.revenue || 0) * (attr.weight || 1);

            channelData.set(channel, existing);
          }
        }

        const report = Array.from(channelData.entries()).map(([channel, data]) => ({
          channel,
          conversions: data.conversions,
          revenue: data.revenue,
          attributedRevenue: data.attributedValue,
          avgOrderValue: data.conversions > 0 ? data.attributedValue / data.conversions : 0
        }));

        res.json(report);
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate report' });
      }
    });

    // Get customer journey
    this.app.get('/api/journey/:merchantId/:customerId', async (req: Request, res: Response) => {
      try {
        const { startDate, endDate } = req.query;
        const query: any = {
          merchantId: req.params.merchantId,
          customerId: req.params.customerId
        };

        if (startDate || endDate) {
          const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          const end = endDate ? new Date(endDate as string) : new Date();
          query.timestamp = { $gte: start, $lte: end };
        }

        const touchpoints = await Touchpoint.find(query).sort({ timestamp: 1 }).lean();
        const conversions = await Conversion.find(query).sort({ timestamp: 1 }).lean();

        res.json({
          customerId: req.params.customerId,
          journey: [...touchpoints, ...conversions].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ),
          summary: {
            totalTouchpoints: touchpoints.length,
            totalConversions: conversions.length,
            totalRevenue: conversions.reduce((sum, c) => sum + (c.revenue || 0), 0)
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch journey' });
      }
    });

    // ========== CONFIGURATION ==========

    // Set attribution window
    this.app.post('/api/config/attribution', async (req: Request, res: Response) => {
      try {
        const config = await AttributionWindow.findOneAndUpdate(
          { merchantId: req.body.merchantId },
          req.body,
          { upsert: true, new: true }
        );
        res.json(config);
      } catch (error) {
        res.status(500).json({ error: 'Failed to set attribution config' });
      }
    });

    // Get attribution window
    this.app.get('/api/config/attribution/:merchantId', async (req: Request, res: Response) => {
      try {
        const config = await AttributionWindow.findOne({ merchantId: req.params.merchantId });
        res.json(config || {
          merchantId: req.params.merchantId,
          lookbackWindow: 30,
          impressionWindow: 7,
          clickWindow: 14,
          viewWindow: 1,
          defaultModel: 'position_based'
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch attribution config' });
      }
    });
  }

  /**
   * Find touchpoints to attribute to a conversion
   */
  private async findAttributedTouchpoints(
    merchantId: string,
    customerId: string,
    attributionData?: any
  ): Promise<any[]> {
    const lookbackDays = attributionData?.lookbackWindow || 30;
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const touchpoints = await Touchpoint.find({
      merchantId,
      customerId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 }).lean();

    return touchpoints;
  }

  /**
   * Calculate attribution weights based on model
   */
  private calculateAttribution(
    touchpoints: any[],
    model: string
  ): Array<{ touchpointId: any; type: string; channel: string; timestamp: Date; weight: number }> {
    if (touchpoints.length === 0) return [];

    const attributed = touchpoints.map(t => ({
      touchpointId: t._id,
      type: t.type,
      channel: t.channel,
      timestamp: t.timestamp,
      weight: 0
    }));

    switch (model) {
      case 'first_touch':
        attributed[0].weight = 1;
        break;

      case 'last_touch':
        attributed[attributed.length - 1].weight = 1;
        break;

      case 'linear':
        const linearWeight = 1 / attributed.length;
        attributed.forEach(a => a.weight = linearWeight);
        break;

      case 'time_decay':
        const now = Date.now();
        const totalDecay = attributed.reduce((sum, a, i) => {
          const decay = Math.pow(0.5, attributed.length - i - 1);
          return sum + decay;
        }, 0);
        attributed.forEach((a, i) => {
          const decay = Math.pow(0.5, attributed.length - i - 1);
          a.weight = decay / totalDecay;
        });
        break;

      case 'position_based':
        // First and last get 40% each, middle gets 20% distributed
        if (attributed.length === 1) {
          attributed[0].weight = 1;
        } else if (attributed.length === 2) {
          attributed[0].weight = 0.5;
          attributed[1].weight = 0.5;
        } else {
          attributed[0].weight = 0.4;
          attributed[attributed.length - 1].weight = 0.4;
          const middleWeight = 0.2 / (attributed.length - 2);
          for (let i = 1; i < attributed.length - 1; i++) {
            attributed[i].weight = middleWeight;
          }
        }
        break;

      default:
        // Data-driven would use ML model - default to position based
        const d = 1 / attributed.length;
        attributed.forEach(a => a.weight = d);
    }

    return attributed;
  }

  async start(port: number = 4294): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_offline_attribution'
      );
      console.log('[OfflineAttribution] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[OfflineAttribution] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[OfflineAttribution] Failed to start:', error);
      throw error;
    }
  }
}

// Start service
const service = new OfflineAttributionService();
service.start(4294);

export default service;

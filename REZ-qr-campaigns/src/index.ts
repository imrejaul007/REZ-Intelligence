import express, { Express, Request, Response } from 'express';
import { logger } from './utils/logger.js';
import mongoose, { Schema, Document } from 'mongoose';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const app: Express = express();
app.use(express.json());

// ============================================
// Types
// ============================================

type CampaignType = 'discount' | 'loyalty' | 'discovery' | 'feedback';
type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
type OfferType = 'percentage' | 'fixed' | 'free_item';

interface Offer {
  type: OfferType;
  value: number;
  minOrder?: number;
  expiresAt?: Date;
}

interface TargetingRules {
  locations?: string[];
  segments?: string[];
  newUsersOnly?: boolean;
}

interface CampaignStats {
  scans: number;
  redemptions: number;
  conversionRate: number;
  revenue: number;
  repeatRate: number;
}

interface QRCampaign extends Document {
  campaignId: string;
  name: string;
  merchantId: string;
  type: CampaignType;
  status: CampaignStatus;
  qrCode: string;
  offer: Offer;
  targeting: TargetingRules;
  stats: CampaignStats;
  createdAt: Date;
  updatedAt: Date;
}

interface ScanEvent extends Document {
  scanId: string;
  campaignId: string;
  userId?: string;
  deviceId?: string;
  location?: string;
  timestamp: Date;
}

interface RedemptionEvent extends Document {
  redemptionId: string;
  campaignId: string;
  userId: string;
  orderId?: string;
  discount: number;
  timestamp: Date;
}

// ============================================
// MongoDB Models
// ============================================

const campaignSchema = new Schema<QRCampaign>({
  campaignId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  merchantId: { type: String, required: true, index: true },
  type: { type: String, enum: ['discount', 'loyalty', 'discovery', 'feedback'] },
  status: { type: String, enum: ['draft', 'active', 'paused', 'completed'], default: 'draft' },
  qrCode: { type: String },
  offer: {
    type: { type: String, enum: ['percentage', 'fixed', 'free_item'] },
    value: Number,
    minOrder: Number,
    expiresAt: Date
  },
  targeting: {
    locations: [String],
    segments: [String],
    newUsersOnly: Boolean
  },
  stats: {
    scans: { type: Number, default: 0 },
    redemptions: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    repeatRate: { type: Number, default: 0 }
  }
}, { timestamps: true });

const scanSchema = new Schema<ScanEvent>({
  scanId: { type: String, unique: true },
  campaignId: { type: String, required: true, index: true },
  userId: String,
  deviceId: String,
  location: String,
  timestamp: { type: Date, default: Date.now }
});

const redemptionSchema = new Schema<RedemptionEvent>({
  redemptionId: { type: String, unique: true },
  campaignId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  orderId: String,
  discount: Number,
  timestamp: { type: Date, default: Date.now }
});

const Campaign = mongoose.model<QRCampaign>('QRCampaign', campaignSchema);
const ScanEventModel = mongoose.model<ScanEvent>('ScanEvent', scanSchema);
const RedemptionEventModel = mongoose.model<RedemptionEvent>('redemptionSchema', redemptionSchema);

// ============================================
// Validation Schemas
// ============================================

const createCampaignSchema = z.object({
  name: z.string().min(1),
  merchantId: z.string().min(1),
  type: z.enum(['discount', 'loyalty', 'discovery', 'feedback']),
  offer: z.object({
    type: z.enum(['percentage', 'fixed', 'free_item']),
    value: z.number().positive(),
    minOrder: z.number().optional(),
    expiresAt: z.string().datetime().optional()
  }),
  targeting: z.object({
    locations: z.array(z.string()).optional(),
    segments: z.array(z.string()).optional(),
    newUsersOnly: z.boolean().optional()
  }).optional()
});

const trackScanSchema = z.object({
  campaignId: z.string(),
  userId: z.string().optional(),
  deviceId: z.string().optional(),
  location: z.string().optional()
});

const trackRedemptionSchema = z.object({
  campaignId: z.string(),
  userId: z.string(),
  orderId: z.string().optional(),
  discount: z.number()
});

// ============================================
// API Routes
// ============================================

// Create campaign
app.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const validated = createCampaignSchema.parse(req.body);

    const campaignId = `qrc_${uuidv4().slice(0, 12)}`;
    const baseUrl = process.env.BASE_URL || 'https://rezapp.com';
    const qrUrl = `${baseUrl}/offer/${campaignId}`;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(qrUrl, { width: 300 });

    const campaign = new Campaign({
      campaignId,
      ...validated,
      qrCode,
      status: 'draft'
    });

    await campaign.save();

    res.status(201).json({ success: true, campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign
app.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({ campaignId: req.params.id });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update campaign
app.put('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { campaignId: req.params.id },
      req.body,
      { new: true }
    );
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete campaign
app.delete('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const result = await Campaign.deleteOne({ campaignId: req.params.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Activate campaign
app.post('/campaigns/:id/activate', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { campaignId: req.params.id, status: { $ne: 'active' } },
      { status: 'active' },
      { new: true }
    );
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found or already active' });
      return;
    }
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign stats
app.get('/campaigns/:id/stats', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({ campaignId: req.params.id });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Get recent scans
    const recentScans = await ScanEventModel.countDocuments({
      campaignId: req.params.id,
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    // Get recent redemptions
    const recentRedemptions = await RedemptionEventModel.countDocuments({
      campaignId: req.params.id,
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    // Calculate conversion rate
    const conversionRate = campaign.stats.scans > 0
      ? (campaign.stats.redemptions / campaign.stats.scans) * 100
      : 0;

    res.json({
      success: true,
      stats: {
        ...campaign.stats,
        conversionRate: Math.round(conversionRate * 100) / 100,
        recentScans,
        recentRedemptions
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attribution report
app.get('/campaigns/:id/attribution', async (req: Request, res: Response) => {
  try {
    const scans = await ScanEventModel.find({ campaignId: req.params.id })
      .sort({ timestamp: -1 })
      .limit(100);

    const redemptions = await RedemptionEventModel.find({ campaignId: req.params.id })
      .sort({ timestamp: -1 })
      .limit(100);

    // Calculate attribution
    const attributedRevenue = redemptions.reduce((sum, r) => sum + (r.discount || 0), 0);
    const scanToRedeemRate = scans.length > 0 ? redemptions.length / scans.length : 0;

    res.json({
      success: true,
      attribution: {
        totalScans: scans.length,
        totalRedemptions: redemptions.length,
        scanToRedeemRate: Math.round(scanToRedeemRate * 100 * 100) / 100,
        attributedRevenue,
        avgOrderValue: attributedRevenue / Math.max(redemptions.length, 1)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track QR scan
app.post('/scan', async (req: Request, res: Response) => {
  try {
    const validated = trackScanSchema.parse(req.body);

    const scanId = `scan_${uuidv4().slice(0, 12)}`;

    const scan = new ScanEventModel({
      scanId,
      ...validated,
      timestamp: new Date()
    });

    await scan.save();

    // Update campaign stats
    await Campaign.updateOne(
      { campaignId: validated.campaignId },
      { $inc: { 'stats.scans': 1 } }
    );

    res.status(201).json({ success: true, scanId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track redemption
app.post('/redeem', async (req: Request, res: Response) => {
  try {
    const validated = trackRedemptionSchema.parse(req.body);

    const redemptionId = `red_${uuidv4().slice(0, 12)}`;

    const redemption = new RedemptionEventModel({
      redemptionId,
      ...validated,
      timestamp: new Date()
    });

    await redemption.save();

    // Update campaign stats
    const campaign = await Campaign.findOneAndUpdate(
      { campaignId: validated.campaignId },
      {
        $inc: {
          'stats.redemptions': 1,
          'stats.revenue': validated.discount
        }
      },
      { new: true }
    );

    // Calculate new conversion rate
    if (campaign) {
      const conversionRate = campaign.stats.scans > 0
        ? (campaign.stats.redemptions / campaign.stats.scans) * 100
        : 0;
      campaign.stats.conversionRate = conversionRate;
      await campaign.save();
    }

    res.status(201).json({ success: true, redemptionId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List merchant campaigns
app.get('/merchant/:merchantId/campaigns', async (req: Request, res: Response) => {
  try {
    const campaigns = await Campaign.find({ merchantId: req.params.merchantId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, count: campaigns.length, campaigns });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'rez-qr-campaigns' });
});

// ============================================
// Startup
// ============================================

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  logger.info('Connected to MongoDB');

  const port = parseInt(process.env.PORT || '4130', 10);
  app.listen(port, () => {
    logger.info(`QR Campaigns Service listening on port ${port}`);
  });
}

start().catch(console.error);

export { app };

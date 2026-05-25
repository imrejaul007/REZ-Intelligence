import express, { Express, Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// ============================================
// Types
// ============================================

type Channel = 'ad' | 'offer' | 'qr' | 'notification' | 'location' | 'organic' | 'referral' | 'search';
type ConversionType = 'order' | 'booking' | 'signup' | 'engagement';

interface Touchpoint {
  channel: Channel;
  source: string;
  campaign?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  weight: number;
}

interface AttributionResult {
  primaryChannel: string;
  primarySource: string;
  contribution: Record<string, number>;
  lastTouch: string;
  firstTouch: string;
  linear: Record<string, number>;
  timeDecay: Record<string, number>;
  positionBased: Record<string, number>;
  conversionValue?: number;
}

interface AttributionEvent extends Document {
  eventId: string;
  userId: string;
  sessionId: string;
  touchpoints: Touchpoint[];
  timestamp: Date;
}

interface Conversion extends Document {
  conversionId: string;
  userId: string;
  type: ConversionType;
  value: number;
  touchpoints: Touchpoint[];
  attribution: AttributionResult;
  timestamp: Date;
}

interface CampaignAttribution extends Document {
  campaignId: string;
  channel: Channel;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  attributionValue: number;
  roi: number;
}

// ============================================
// Schemas
// ============================================

const touchpointSchema = new Schema<Touchpoint>({
  channel: String,
  source: String,
  campaign: String,
  timestamp: Date,
  metadata: Schema.Types.Mixed,
  weight: Number,
}, { _id: false });

const attributionEventSchema = new Schema<AttributionEvent>({
  eventId: { type: String, unique: true },
  userId: String,
  sessionId: String,
  touchpoints: [touchpointSchema],
  timestamp: Date,
});

const conversionSchema = new Schema<Conversion>({
  conversionId: { type: String, unique: true },
  userId: String,
  type: String,
  value: Number,
  touchpoints: [touchpointSchema],
  attribution: {
    primaryChannel: String,
    primarySource: String,
    contribution: Schema.Types.Mixed,
    lastTouch: String,
    firstTouch: String,
    linear: Schema.Types.Mixed,
    timeDecay: Schema.Types.Mixed,
    positionBased: Schema.Types.Mixed,
    conversionValue: Number,
  },
  timestamp: Date,
});

const campaignAttributionSchema = new Schema<CampaignAttribution>({
  campaignId: String,
  channel: String,
  impressions: Number,
  clicks: Number,
  conversions: Number,
  revenue: Number,
  attributionValue: Number,
  roi: Number,
});

const AttributionEventModel = mongoose.model<AttributionEvent>('AttributionEvent', attributionEventSchema);
const ConversionModel = mongoose.model<Conversion>('Conversion', conversionSchema);
const CampaignAttributionModel = mongoose.model<CampaignAttribution>('CampaignAttribution', campaignAttributionSchema);

// ============================================
// Attribution Algorithms
// ============================================

function linearAttribution(touchpoints: Touchpoint[]): Record<string, number> {
  const weights: Record<string, number> = {};
  if (touchpoints.length === 0) return weights;

  touchpoints.forEach(tp => {
    weights[tp.channel] = (weights[tp.channel] || 0) + (1 / touchpoints.length);
  });
  return weights;
}

function timeDecayAttribution(touchpoints: Touchpoint[], halfLifeDays = 7): Record<string, number> {
  const weights: Record<string, number> = {};
  if (touchpoints.length === 0) return weights;

  const conversionTime = Date.now();
  let totalWeight = 0;

  touchpoints.forEach(tp => {
    const daysDiff = (conversionTime - new Date(tp.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const weight = Math.pow(0.5, daysDiff / halfLifeDays);
    weights[tp.channel] = (weights[tp.channel] || 0) + weight;
    totalWeight += weight;
  });

  Object.keys(weights).forEach(ch => weights[ch] /= totalWeight);
  return weights;
}

function positionBasedAttribution(touchpoints: Touchpoint[]): Record<string, number> {
  const weights: Record<string, number> = {};
  if (touchpoints.length === 0) return weights;

  const n = touchpoints.length;

  touchpoints.forEach((tp, i) => {
    let weight: number;
    if (i === 0) weight = 0.4;
    else if (i === n - 1) weight = 0.4;
    else weight = 0.2 / Math.max(n - 2, 1);

    weights[tp.channel] = (weights[tp.channel] || 0) + weight;
  });
  return weights;
}

function calculateAttribution(touchpoints: Touchpoint[], conversionValue?: number): AttributionResult {
  const linear = linearAttribution(touchpoints);
  const timeDecay = timeDecayAttribution(touchpoints);
  const positionBased = positionBasedAttribution(touchpoints);

  // Find primary channel (highest linear weight)
  const sorted = Object.entries(linear).sort((a, b) => b[1] - a[1]);
  const primaryChannel = sorted[0]?.[0] || 'organic';

  // Find sources by channel
  const channelSources: Record<string, string[]> = {};
  touchpoints.forEach(tp => {
    if (!channelSources[tp.channel]) channelSources[tp.channel] = [];
    channelSources[tp.channel].push(tp.source);
  });

  return {
    primaryChannel,
    primarySource: channelSources[primaryChannel]?.[0] || 'unknown',
    contribution: linear,
    lastTouch: touchpoints[touchpoints.length - 1]?.channel || 'organic',
    firstTouch: touchpoints[0]?.channel || 'organic',
    linear,
    timeDecay,
    positionBased,
    conversionValue,
  };
}

// ============================================
// Express App
// ============================================

const app: Express = express();
app.use(express.json());

// Track touchpoint
app.post('/api/attribution/track', async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, channel, source, campaign, metadata } = req.body;

    const event = new AttributionEventModel({
      eventId: `tp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      sessionId,
      touchpoints: [{
        channel,
        source,
        campaign,
        timestamp: new Date(),
        metadata: metadata || {},
        weight: 1,
      }],
      timestamp: new Date(),
    });

    await event.save();

    res.json({ success: true, eventId: event.eventId });
  } catch (error) {
    logger.error('Error tracking touchpoint', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track conversion
app.post('/api/attribution/convert', async (req: Request, res: Response) => {
  try {
    const { userId, type, value, sessionId } = req.body;

    // Get all touchpoints for this session
    const events = await AttributionEventModel.find({ userId, sessionId });
    const allTouchpoints: Touchpoint[] = events.flatMap(e => e.touchpoints);

    // Calculate attribution
    const attribution = calculateAttribution(allTouchpoints, value);

    const conversion = new ConversionModel({
      conversionId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      value: value || 0,
      touchpoints: allTouchpoints,
      attribution,
      timestamp: new Date(),
    });

    await conversion.save();

    // Update campaign attributions
    for (const [channel, contribution] of Object.entries(attribution.linear)) {
      await CampaignAttributionModel.updateOne(
        { campaignId: channel },
        {
          $inc: { conversions: 1, revenue: (value || 0) * contribution },
        },
        { upsert: true }
      );
    }

    res.json({ success: true, conversionId: conversion.conversionId, attribution });
  } catch (error) {
    logger.error('Error tracking conversion', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user attribution
app.get('/api/attribution/:userId', async (req: Request, res: Response) => {
  try {
    const conversions = await ConversionModel.find({ userId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(50);

    const touchpoints = await AttributionEventModel.find({ userId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({ success: true, conversions, touchpoints });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign attribution
app.get('/api/attribution/campaign/:campaignId', async (req: Request, res: Response) => {
  try {
    const campaigns = await CampaignAttributionModel.find({ campaignId: req.params.campaignId });

    const conversions = await ConversionModel.find({
      'touchpoints.source': req.params.campaignId,
    });

    const totalRevenue = conversions.reduce((sum, c) => sum + c.value, 0);

    res.json({
      success: true,
      campaign: campaigns[0] || { campaignId: req.params.campaignId },
      conversions: conversions.length,
      revenue: totalRevenue,
      roi: campaigns[0]?.attributionValue
        ? (totalRevenue - campaigns[0].attributionValue) / campaigns[0].attributionValue * 100
        : 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get channel performance
app.get('/api/attribution/channel/:channel', async (req: Request, res: Response) => {
  try {
    const campaigns = await CampaignAttributionModel.find({ channel: req.params.channel });

    const stats = campaigns.reduce((acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      conversions: acc.conversions + c.conversions,
      revenue: acc.revenue + c.revenue,
    }), { impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

    res.json({
      success: true,
      channel: req.params.channel,
      stats,
      ctr: stats.clicks / Math.max(stats.impressions, 1) * 100,
      convRate: stats.conversions / Math.max(stats.clicks, 1) * 100,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ROI by channel
app.get('/api/attribution/roi', async (req: Request, res: Response) => {
  try {
    const channels: Channel[] = ['ad', 'offer', 'qr', 'notification', 'location', 'referral', 'search'];
    const roiData: Record<string, unknown> = {};

    for (const channel of channels) {
      const campaigns = await CampaignAttributionModel.find({ channel });
      const conversions = await ConversionModel.find({ 'touchpoints.channel': channel });

      const spend = campaigns.reduce((sum, c) => sum + c.attributionValue, 0);
      const revenue = conversions.reduce((sum, c) => sum + c.value, 0);

      roiData[channel] = {
        spend,
        revenue,
        roi: spend > 0 ? ((revenue - spend) / spend * 100).toFixed(2) : 0,
        conversions: conversions.length,
      };
    }

    res.json({ success: true, roi: roiData });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'rez-crosschannel-attribution' });
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

  const port = parseInt(process.env.PORT || '4115', 10);
  app.listen(port, () => {
    logger.info(`Cross-channel Attribution Service listening on port ${port}`);
  });
}

start().catch(console.error);

export { app };

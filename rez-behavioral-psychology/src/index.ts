import express, { Express, Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// ============================================
// Types
// ============================================

interface PsychologyScores {
  cashbackSensitivity: number;      // 0-100
  conveniencePreference: number;       // 0-100
  luxuryAffinity: number;             // 0-100
  urgencyResponsiveness: number;      // 0-100
  priceSensitivity: number;           // 0-100
  qualityOverPrice: number;           // 0-100
  brandLoyalty: number;              // 0-100
  dealSeeking: number;              // 0-100
  impulseScore: number;              // 0-100
}

interface TendencyProfile {
  plannerOrImpulse: 'PLANNER' | 'IMPULSE' | 'BALANCED';
  spontaneousOrDeliberate: 'SPONTANEOUS' | 'DELIBERATE' | 'MIXED';
  priceOrQuality: 'PRICE_FIRST' | 'QUALITY_FIRST' | 'BALANCED';
  loyalOrExplorer: 'LOYAL' | 'EXPLORER' | 'VARIABLE';
}

interface BuyingStyle {
  primary: 'SAVER' | 'CONVENIENCE' | 'LUXURY' | 'BALANCED';
  secondary?: 'SAVER' | 'CONVENIENCE' | 'LUXURY';
  triggers: string[];
  bestChannels: ('whatsapp' | 'sms' | 'push' | 'email')[];
  optimalTiming: string;
}

interface UserPsychology extends Document {
  userId: string;
  scores: PsychologyScores;
  tendencies: TendencyProfile;
  buyingStyle: BuyingStyle;
  eventHistory: Array<{ eventType: string; score: number; timestamp: Date }>;
  lastUpdated: Date;
}

// ============================================
// Validation Schemas
// ============================================

const UpdatePsychologySchema = z.object({
  cashbackSensitivity: z.number().min(0).max(100).optional(),
  conveniencePreference: z.number().min(0).max(100).optional(),
  luxuryAffinity: z.number().min(0).max(100).optional(),
  urgencyResponsiveness: z.number().min(0).max(100).optional(),
  priceSensitivity: z.number().min(0).max(100).optional(),
  qualityOverPrice: z.number().min(0).max(100).optional(),
  brandLoyalty: z.number().min(0).max(100).optional(),
  dealSeeking: z.number().min(0).max(100).optional(),
  impulseScore: z.number().min(0).max(100).optional(),
});

const EventSchema = z.object({
  eventType: z.enum([
    'cashback_redeemed', 'discount_used', 'premium_purchased',
    'urgent_offer_clicked', 'price_compared', 'late_night_order',
    'impulse_buy', 'loyalty_redeemed', 'convenience_chosen'
  ]),
  amount: z.number().optional(),
  timestamp: z.string().datetime().optional(),
});

// ============================================
// MongoDB Models
// ============================================

const psychologySchema = new Schema<UserPsychology>({
  userId: { type: String, required: true, unique: true },
  scores: {
    cashbackSensitivity: { type: Number, default: 50 },
    conveniencePreference: { type: Number, default: 50 },
    luxuryAffinity: { type: Number, default: 50 },
    urgencyResponsiveness: { type: Number, default: 50 },
    priceSensitivity: { type: Number, default: 50 },
    qualityOverPrice: { type: Number, default: 50 },
    brandLoyalty: { type: Number, default: 50 },
    dealSeeking: { type: Number, default: 50 },
    impulseScore: { type: Number, default: 50 },
  },
  tendencies: {
    plannerOrImpulse: { type: String, enum: ['PLANNER', 'IMPULSE', 'BALANCED'], default: 'BALANCED' },
    spontaneousOrDeliberate: { type: String, enum: ['SPONTANEOUS', 'DELIBERATE', 'MIXED'], default: 'MIXED' },
    priceOrQuality: { type: String, enum: ['PRICE_FIRST', 'QUALITY_FIRST', 'BALANCED'], default: 'BALANCED' },
    loyalOrExplorer: { type: String, enum: ['LOYAL', 'EXPLORER', 'VARIABLE'], default: 'VARIABLE' },
  },
  buyingStyle: {
    primary: { type: String, enum: ['SAVER', 'CONVENIENCE', 'LUXURY', 'BALANCED'], default: 'BALANCED' },
    secondary: { type: String, enum: ['SAVER', 'CONVENIENCE', 'LUXURY'] },
    triggers: [String],
    bestChannels: [String],
    optimalTiming: String,
  },
  eventHistory: [{
    eventType: String,
    score: Number,
    timestamp: Date,
  }],
  lastUpdated: { type: Date, default: Date.now },
});

const UserPsychologyModel = mongoose.model<UserPsychology>('UserPsychology', psychologySchema);

// ============================================
// Scoring Algorithms
// ============================================

function calculateCashbackSensitivity(events: unknown[]): number {
  const cashbackEvents = events.filter(e => e.eventType.includes('cashback'));
  const discountEvents = events.filter(e => e.eventType.includes('discount'));

  const cashbackRate = cashbackEvents.length / Math.max(events.length, 1);
  const avgCashbackAmount = cashbackEvents.reduce((sum, e) => sum + (e.amount || 0), 0) / Math.max(cashbackEvents.length, 1);

  return Math.min(100, Math.round(
    (cashbackRate * 60) + (avgCashbackAmount > 50 ? 20 : 10) + (discountEvents.length * 5)
  ));
}

function calculateConveniencePreference(events: unknown[]): number {
  const convenienceEvents = events.filter(e => e.eventType.includes('convenience'));
  const fastDeliveryEvents = events.filter(e => e.eventType.includes('fast'));

  const rate = convenienceEvents.length / Math.max(events.length, 1);
  return Math.min(100, Math.round(rate * 80 + fastDeliveryEvents.length * 10));
}

function calculateLuxuryAffinity(events: unknown[]): number {
  const premiumEvents = events.filter(e => e.eventType.includes('premium'));
  const highValueEvents = events.filter(e => (e.amount || 0) > 500);

  const rate = premiumEvents.length / Math.max(events.length, 1);
  return Math.min(100, Math.round(
    (rate * 50) + (highValueEvents.length * 15) + 20
  ));
}

function calculateImpulseScore(events: unknown[]): number {
  const lateNightEvents = events.filter(e => {
    const hour = new Date(e.timestamp).getHours();
    return hour >= 21 || hour <= 5;
  });

  const impulseEvents = events.filter(e => e.eventType.includes('impulse'));
  const noDiscountEvents = events.filter(e => !e.eventType.includes('discount'));

  const impulseRate = impulseEvents.length / Math.max(events.length, 1);
  const lateNightRate = lateNightEvents.length / Math.max(events.length, 1);
  const fullPriceRate = noDiscountEvents.length / Math.max(events.length, 1);

  return Math.min(100, Math.round(
    (impulseRate * 40) + (lateNightRate * 30) + (fullPriceRate * 30)
  ));
}

function determineTendencies(scores: PsychologyScores): TendencyProfile {
  return {
    plannerOrImpulse: scores.impulseScore > 60 ? 'IMPULSE' : scores.impulseScore < 40 ? 'PLANNER' : 'BALANCED',
    spontaneousOrDeliberate: scores.impulseScore > 60 ? 'SPONTANEOUS' : 'DELIBERATE',
    priceOrQuality: scores.qualityOverPrice > 60 ? 'QUALITY_FIRST' : scores.priceSensitivity > 60 ? 'PRICE_FIRST' : 'BALANCED',
    loyalOrExplorer: scores.brandLoyalty > 60 ? 'LOYAL' : 'EXPLORER',
  };
}

function determineBuyingStyle(scores: PsychologyScores): BuyingStyle {
  const triggers: string[] = [];

  if (scores.cashbackSensitivity > 60) triggers.push('cashback_20');
  if (scores.dealSeeking > 60) triggers.push('flash_sale');
  if (scores.luxuryAffinity > 60) triggers.push('premium_brands');
  if (scores.urgencyResponsiveness > 60) triggers.push('limited_offer');

  const channels: ('whatsapp' | 'sms' | 'push' | 'email')[] = ['whatsapp'];
  if (scores.urgencyResponsiveness > 50) channels.push('push');
  if (scores.luxuryAffinity > 50) channels.push('email');

  let primary: BuyingStyle['primary'] = 'BALANCED';
  if (scores.dealSeeking > 70) primary = 'SAVER';
  else if (scores.conveniencePreference > 70) primary = 'CONVENIENCE';
  else if (scores.luxuryAffinity > 70) primary = 'LUXURY';

  return {
    primary,
    triggers,
    bestChannels: channels,
    optimalTiming: scores.impulseScore > 60 ? 'evening' : 'morning',
  };
}

// ============================================
// Express App
// ============================================

const app: Express = express();
app.use(express.json());

// Get user psychology profile
app.get('/api/psychology/:userId', async (req: Request, res: Response) => {
  try {
    const profile = await UserPsychologyModel.findOne({ userId: req.params.userId });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ success: true, profile });
  } catch (error) {
    logger.error('Error fetching psychology profile', { error, userId: req.params.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get psychology scores
app.get('/api/psychology/:userId/scores', async (req: Request, res: Response) => {
  try {
    const profile = await UserPsychologyModel.findOne({ userId: req.params.userId });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ success: true, scores: profile.scores });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get buying style
app.get('/api/psychology/:userId/style', async (req: Request, res: Response) => {
  try {
    const profile = await UserPsychologyModel.findOne({ userId: req.params.userId });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ success: true, style: profile.buyingStyle, tendencies: profile.tendencies });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get effective triggers
app.get('/api/psychology/:userId/triggers', async (req: Request, res: Response) => {
  try {
    const profile = await UserPsychologyModel.findOne({ userId: req.params.userId });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ success: true, triggers: profile.buyingStyle.triggers });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update psychology scores
app.post('/api/psychology/update', async (req: Request, res: Response) => {
  try {
    const validated = UpdatePsychologySchema.parse(req.body);
    const { userId } = req.body;

    let profile = await UserPsychologyModel.findOne({ userId });

    if (profile) {
      Object.assign(profile.scores, validated);
      profile.tendencies = determineTendencies(profile.scores);
      profile.buyingStyle = determineBuyingStyle(profile.scores);
      profile.lastUpdated = new Date();
      await profile.save();
    } else {
      const defaultScores: PsychologyScores = {
        cashbackSensitivity: 50,
        conveniencePreference: 50,
        luxuryAffinity: 50,
        urgencyResponsiveness: 50,
        priceSensitivity: 50,
        qualityOverPrice: 50,
        brandLoyalty: 50,
        dealSeeking: 50,
        impulseScore: 50,
        ...validated,
      };

      profile = new UserPsychologyModel({
        userId,
        scores: defaultScores,
        tendencies: determineTendencies(defaultScores),
        buyingStyle: determineBuyingStyle(defaultScores),
        eventHistory: [],
      });
      await profile.save();
    }

    res.json({ success: true, profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error('Error updating psychology', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record behavioral event
app.post('/api/psychology/event', async (req: Request, res: Response) => {
  try {
    const validated = EventSchema.parse(req.body);
    const { userId, eventType, amount } = req.body;

    let profile = await UserPsychologyModel.findOne({ userId });

    if (!profile) {
      profile = new UserPsychologyModel({
        userId,
        scores: {
          cashbackSensitivity: 50,
          conveniencePreference: 50,
          luxuryAffinity: 50,
          urgencyResponsiveness: 50,
          priceSensitivity: 50,
          qualityOverPrice: 50,
          brandLoyalty: 50,
          dealSeeking: 50,
          impulseScore: 50,
        },
        tendencies: {
          plannerOrImpulse: 'BALANCED',
          spontaneousOrDeliberate: 'MIXED',
          priceOrQuality: 'BALANCED',
          loyalOrExplorer: 'VARIABLE',
        },
        buyingStyle: {
          primary: 'BALANCED',
          triggers: [],
          bestChannels: ['whatsapp'],
          optimalTiming: 'morning',
        },
        eventHistory: [],
      });
    }

    // Add event to history
    profile.eventHistory.push({
      eventType,
      score: 1,
      timestamp: new Date(),
    });

    // Keep only last 100 events
    if (profile.eventHistory.length > 100) {
      profile.eventHistory = profile.eventHistory.slice(-100);
    }

    // Recalculate scores
    profile.scores.cashbackSensitivity = calculateCashbackSensitivity(profile.eventHistory);
    profile.scores.conveniencePreference = calculateConveniencePreference(profile.eventHistory);
    profile.scores.luxuryAffinity = calculateLuxuryAffinity(profile.eventHistory);
    profile.scores.impulseScore = calculateImpulseScore(profile.eventHistory);

    // Update tendencies and style
    profile.tendencies = determineTendencies(profile.scores);
    profile.buyingStyle = determineBuyingStyle(profile.scores);
    profile.lastUpdated = new Date();

    await profile.save();

    res.json({ success: true, scores: profile.scores, style: profile.buyingStyle });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error('Error recording event', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users by buying style
app.get('/api/psychology/segments/:style', async (req: Request, res: Response) => {
  try {
    const profiles = await UserPsychologyModel.find({
      'buyingStyle.primary': req.params.style.toUpperCase()
    }).select('userId scores tendencies buyingStyle').limit(100);

    res.json({ success: true, count: profiles.length, profiles });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'rez-behavioral-psychology' });
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

  const port = parseInt(process.env.PORT || '4110', 10);
  app.listen(port, () => {
    logger.info(`Behavioral Psychology Service listening on port ${port}`);
  });
}

start().catch(console.error);

export { app, UserPsychologyModel };

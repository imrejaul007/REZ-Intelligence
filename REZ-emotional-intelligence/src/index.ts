/**
 * REZ Emotional Intelligence - Main Server
 *
 * Mood tracking, sentiment analysis, wellness scoring, and cosmic interpretation
 * Port: 4160
 */

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger.js';
import {
  MoodEntryModel,
  WellnessModel,
  EmotionalSignalModel,
  analyzeSentiment,
  calculateMoodScore,
  detectMoodFromSignals,
  calculateWellnessScore,
  calculateMoodTrend,
  generateCosmicInterpretation,
  analyzeMoodPatterns,
  getEmotionalContext,
} from './services/emotionalService.js';
import type {
  MoodState,
  EmotionType,
  EmotionalSignals,
  CosmicMoodOutput,
  MoodEntry,
} from './types/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4160', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_emotional';

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { query: req.query });
  next();
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const moodCheckInSchema = z.object({
  userId: z.string().min(1),
  mood: z.enum([
    'very_positive', 'positive', 'neutral', 'negative', 'very_negative',
    'anxious', 'calm', 'energetic', 'tired', 'stressed', 'peaceful'
  ]),
  intensity: z.number().min(0).max(100).optional(),
  energy: z.number().min(0).max(100).optional(),
  primaryEmotion: z.string().optional(),
  secondaryEmotions: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),
  notes: z.string().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    place: z.string().optional(),
  }).optional(),
  context: z.object({
    activity: z.string().optional(),
    weather: z.string().optional(),
    social: z.boolean().optional(),
    timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  }).optional(),
});

const sentimentSchema = z.object({
  text: z.string().min(1),
  userId: z.string().optional(),
  source: z.enum(['chat', 'review', 'social', 'journal']).optional(),
});

const signalsUpdateSchema = z.object({
  userId: z.string().min(1),
  signals: z.object({
    messageTone: z.enum(['positive', 'negative', 'neutral']).optional(),
    responseTime: z.enum(['quick', 'normal', 'slow']).optional(),
    emojiUsage: z.number().min(0).max(100).optional(),
    capsUsage: z.number().min(0).max(100).optional(),
    typoRate: z.number().min(0).max(100).optional(),
    engagementLevel: z.number().min(0).max(100).optional(),
    socialActivity: z.number().min(0).max(100).optional(),
    purchaseBehavior: z.enum(['positive', 'negative', 'neutral']).optional(),
    browsingPattern: z.enum(['exploring', 'focused', 'aimless']).optional(),
  }),
});

const contextRequestSchema = z.object({
  userId: z.string().min(1),
  includeCosmic: z.boolean().optional(),
});

// ============================================
// HEALTH ENDPOINTS
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-emotional-intelligence',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: mongoStatus === 'connected' ? 'ready' : 'not_ready',
    mongodb: mongoStatus,
  });
});

// ============================================
// SERVICE INFO
// ============================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Emotional Intelligence',
    version: '1.0.0',
    port: PORT,
    description: 'Mood tracking, sentiment analysis, wellness scoring for Human Context Graph',
    endpoints: {
      mood: {
        'POST /api/mood/checkin': 'Record mood check-in',
        'GET /api/mood/:userId/current': 'Get current mood',
        'GET /api/mood/:userId/history': 'Get mood history',
        'GET /api/mood/:userId/patterns': 'Get mood patterns',
        'GET /api/mood/:userId/trend': 'Get mood trends',
      },
      sentiment: {
        'POST /api/sentiment/analyze': 'Analyze text sentiment',
        'GET /api/sentiment/:userId/aggregate': 'Get aggregated sentiment',
      },
      wellness: {
        'GET /api/wellness/:userId': 'Get wellness score',
        'POST /api/wellness/:userId/assess': 'Self-assess wellness',
        'PUT /api/wellness/:userId': 'Update wellness dimensions',
      },
      signals: {
        'POST /api/signals/update': 'Update emotional signals',
        'GET /api/signals/:userId': 'Get current signals',
      },
      context: {
        'POST /api/context': 'Get full emotional context',
        'POST /api/context/cosmic': 'Get cosmic interpretation',
      },
    },
  });
});

// ============================================
// MOOD ENDPOINTS
// ============================================

app.post('/api/mood/checkin', async (req: Request, res: Response) => {
  try {
    const validated = moodCheckInSchema.parse(req.body);
    const now = new Date();

    const moodEntry = new MoodEntryModel({
      userId: validated.userId,
      timestamp: now,
      mood: validated.mood,
      primaryEmotion: validated.primaryEmotion || validated.mood,
      secondaryEmotions: validated.secondaryEmotions || [],
      intensity: validated.intensity || 50,
      energy: validated.energy || 50,
      arousal: validated.energy ? Math.min(100, validated.energy + 10) : 50,
      triggers: validated.triggers || [],
      notes: validated.notes,
      location: validated.location,
      context: validated.context,
    });

    await moodEntry.save();

    // Get trend
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const last7d = await MoodEntryModel.find({
      userId: validated.userId,
      timestamp: { $gte: sevenDaysAgo },
    });

    const last14d = await MoodEntryModel.find({
      userId: validated.userId,
      timestamp: { $gte: fourteenDaysAgo },
    });

    const recentEntries = last7d;
    const recentIds = new Set(last7d.map((e: unknown) => String((e as { _id: { toString: () => string } })._id.toString())));
    const olderEntries = last14d.filter((e: unknown) => !recentIds.has(String((e as { _id: { toString: () => string } })._id.toString())));
    const trend = calculateMoodTrend(recentEntries, olderEntries);

    // Get wellness score
    const latestSignals = await EmotionalSignalModel.findOne({ userId: validated.userId });
    const wellnessScore = calculateWellnessScore(last7d, latestSignals?.signals || {
      messageTone: 'neutral',
      responseTime: 'normal',
      emojiUsage: 50,
      capsUsage: 10,
      typoRate: 10,
      engagementLevel: 50,
      socialActivity: 50,
      purchaseBehavior: 'neutral',
      browsingPattern: 'exploring',
      activeTimeOfDay: 'afternoon',
      peakHours: [],
      sleepQuality: 70,
      contentTypes: [],
      sentimentTrend: 'neutral',
    });

    // Generate cosmic interpretation
    const cosmic = generateCosmicInterpretation(validated.mood, validated.energy || 50, trend);

    res.status(201).json({
      success: true,
      moodEntry,
      trend,
      wellnessScore,
      cosmicInterpretation: cosmic,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Mood check-in error', { error });
    res.status(500).json({ error: 'Failed to record mood check-in' });
  }
});

app.get('/api/mood/:userId/current', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const latest = await MoodEntryModel.findOne({ userId })
      .sort({ timestamp: -1 });

    if (!latest) {
      res.status(404).json({ error: 'No mood data found' });
      return;
    }

    res.json({
      success: true,
      mood: latest,
      timeSince: Date.now() - latest.timestamp.getTime(),
    });
  } catch (error) {
    logger.error('Get current mood error', { error });
    res.status(500).json({ error: 'Failed to get current mood' });
  }
});

app.get('/api/mood/:userId/history', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '7', limit = '50' } = req.query;

    const daysNum = parseInt(days as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const history = await MoodEntryModel.find({
      userId,
      timestamp: { $gte: startDate },
    })
      .sort({ timestamp: -1 })
      .limit(limitNum);

    res.json({
      success: true,
      count: history.length,
      entries: history,
    });
  } catch (error) {
    logger.error('Get mood history error', { error });
    res.status(500).json({ error: 'Failed to get mood history' });
  }
});

app.get('/api/mood/:userId/patterns', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '30' } = req.query;

    const daysNum = parseInt(days as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const entries = await MoodEntryModel.find({
      userId,
      timestamp: { $gte: startDate },
    }).sort({ timestamp: 1 });

    const patterns = analyzeMoodPatterns(entries);

    res.json({
      success: true,
      patterns,
      entriesAnalyzed: entries.length,
    });
  } catch (error) {
    logger.error('Get mood patterns error', { error });
    res.status(500).json({ error: 'Failed to analyze mood patterns' });
  }
});

app.get('/api/mood/:userId/trend', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const last7d = await MoodEntryModel.find({
      userId,
      timestamp: { $gte: sevenDaysAgo },
    });

    const last14d = await MoodEntryModel.find({
      userId,
      timestamp: { $gte: fourteenDaysAgo },
    });

    const trend = calculateMoodTrend(last7d, last14d);

    res.json({
      success: true,
      trend,
      dataPoints: {
        last7d: last7d.length,
        last14d: last14d.length,
      },
    });
  } catch (error) {
    logger.error('Get mood trend error', { error });
    res.status(500).json({ error: 'Failed to get mood trend' });
  }
});

// ============================================
// SENTIMENT ENDPOINTS
// ============================================

app.post('/api/sentiment/analyze', async (req: Request, res: Response) => {
  try {
    const validated = sentimentSchema.parse(req.body);

    const analysis = analyzeSentiment(validated.text);

    // Store sentiment if userId provided
    if (validated.userId) {
      const signals = await EmotionalSignalModel.findOne({ userId: validated.userId });
      if (signals) {
        signals.signals.sentimentTrend = analysis.polarity;
        await signals.save();
      }
    }

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Sentiment analysis error', { error });
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

app.get('/api/sentiment/:userId/aggregate', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '7' } = req.query;

    const daysNum = parseInt(days as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const signals = await EmotionalSignalModel.find({
      userId,
      timestamp: { $gte: startDate },
    }).sort({ timestamp: -1 });

    // Aggregate sentiment
    const sentiments = signals.map((s: { signals: { sentimentTrend: string } }) => s.signals.sentimentTrend);
    const positive = sentiments.filter((s: string) => s === 'positive').length;
    const negative = sentiments.filter((s: string) => s === 'negative').length;
    const neutral = sentiments.filter((s: string) => s === 'neutral').length;

    const dominant = positive >= negative && positive >= neutral
      ? 'positive'
      : negative >= positive && negative >= neutral
        ? 'negative'
        : 'neutral';

    res.json({
      success: true,
      aggregate: {
        dominant,
        positiveRatio: positive / Math.max(sentiments.length, 1),
        negativeRatio: negative / Math.max(sentiments.length, 1),
        neutralRatio: neutral / Math.max(sentiments.length, 1),
        dataPoints: sentiments.length,
      },
    });
  } catch (error) {
    logger.error('Aggregate sentiment error', { error });
    res.status(500).json({ error: 'Failed to aggregate sentiment' });
  }
});

// ============================================
// WELLNESS ENDPOINTS
// ============================================

app.get('/api/wellness/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    let wellness = await WellnessModel.findOne({ userId });

    if (!wellness) {
      // Create default wellness
      wellness = new WellnessModel({
        userId,
        scores: {
          overall: 70,
          mental: 70,
          emotional: 70,
          social: 70,
          purpose: 70,
          growth: 70,
        },
        dimensions: {
          stress: 50,
          resilience: 50,
          mindfulness: 50,
          gratitude: 50,
          socialConnection: 50,
          lifeSatisfaction: 50,
        },
      });
      await wellness.save();
    }

    // Get recent mood data
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMoods = await MoodEntryModel.find({
      userId,
      timestamp: { $gte: sevenDaysAgo },
    });

    // Update based on recent moods
    if (recentMoods.length > 0) {
      const avgEnergy = recentMoods.reduce((sum: number, m: { energy?: number }) => sum + (m.energy || 50), 0) / recentMoods.length;
      wellness.scores.emotional = Math.round(avgEnergy);
      wellness.scores.overall = Math.round(
        (wellness.scores.mental + wellness.scores.emotional + wellness.scores.social) / 3
      );
      await wellness.save();
    }

    res.json({
      success: true,
      wellness,
    });
  } catch (error) {
    logger.error('Get wellness error', { error });
    res.status(500).json({ error: 'Failed to get wellness score' });
  }
});

app.post('/api/wellness/:userId/assess', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { dimensions } = req.body;

    let wellness = await WellnessModel.findOne({ userId });

    if (!wellness) {
      wellness = new WellnessModel({ userId });
    }

    // Update dimensions if provided
    if (dimensions) {
      Object.assign(wellness.dimensions, dimensions);

      // Recalculate scores
      wellness.scores.mental = Math.round(
        (wellness.dimensions.resilience + (100 - wellness.dimensions.stress)) / 2
      );
      wellness.scores.emotional = Math.round(
        (wellness.dimensions.mindfulness + wellness.dimensions.gratitude) / 2
      );
      wellness.scores.social = Math.round(wellness.dimensions.socialConnection);
      wellness.scores.purpose = Math.round(
        (wellness.dimensions.lifeSatisfaction + wellness.dimensions.gratitude) / 2
      );
      wellness.scores.growth = Math.round(
        (wellness.dimensions.resilience + wellness.dimensions.lifeSatisfaction) / 2
      );
      wellness.scores.overall = Math.round(
        Object.values(wellness.scores).reduce((a: number, b: number) => a + b, 0) / 5
      );
    }

    wellness.lastUpdated = new Date();
    await wellness.save();

    res.json({
      success: true,
      wellness,
    });
  } catch (error) {
    logger.error('Wellness assessment error', { error });
    res.status(500).json({ error: 'Failed to assess wellness' });
  }
});

app.put('/api/wellness/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { scores, dimensions, riskFactors, protectiveFactors } = req.body;

    const wellness = await WellnessModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(scores && { scores }),
          ...(dimensions && { dimensions }),
          ...(riskFactors && { riskFactors }),
          ...(protectiveFactors && { protectiveFactors }),
          lastUpdated: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      wellness,
    });
  } catch (error) {
    logger.error('Update wellness error', { error });
    res.status(500).json({ error: 'Failed to update wellness' });
  }
});

// ============================================
// SIGNALS ENDPOINTS
// ============================================

app.post('/api/signals/update', async (req: Request, res: Response) => {
  try {
    const validated = signalsUpdateSchema.parse(req.body);

    const signals = await EmotionalSignalModel.findOneAndUpdate(
      { userId: validated.userId },
      {
        $set: {
          userId: validated.userId,
          timestamp: new Date(),
          signals: validated.signals,
        },
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      signals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Update signals error', { error });
    res.status(500).json({ error: 'Failed to update signals' });
  }
});

app.get('/api/signals/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const signals = await EmotionalSignalModel.findOne({ userId })
      .sort({ timestamp: -1 });

    if (!signals) {
      res.status(404).json({ error: 'No signals found' });
      return;
    }

    res.json({
      success: true,
      signals,
    });
  } catch (error) {
    logger.error('Get signals error', { error });
    res.status(500).json({ error: 'Failed to get signals' });
  }
});

// ============================================
// CONTEXT ENDPOINTS
// ============================================

app.post('/api/context', async (req: Request, res: Response) => {
  try {
    const validated = contextRequestSchema.parse(req.body);

    const { context, cosmicOutput } = await getEmotionalContext(
      validated.userId,
      validated.includeCosmic
    );

    res.json({
      success: true,
      context,
      ...(cosmicOutput && { cosmicOutput }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Get context error', { error });
    res.status(500).json({ error: 'Failed to get emotional context' });
  }
});

app.post('/api/context/cosmic', async (req: Request, res: Response) => {
  try {
    const { userId, mood, energy } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    const { context } = await getEmotionalContext(userId, true);

    // Generate fresh cosmic interpretation
    const cosmic = generateCosmicInterpretation(
      mood || context.currentMood,
      energy || context.currentEnergy,
      context.moodTrend
    );

    res.json({
      success: true,
      cosmicOutput: cosmic,
      context,
    });
  } catch (error) {
    logger.error('Cosmic interpretation error', { error });
    res.status(500).json({ error: 'Failed to generate cosmic interpretation' });
  }
});

// ============================================
// STATISTICS ENDPOINT
// ============================================

app.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const moodCount = await MoodEntryModel.countDocuments();
    const wellnessCount = await WellnessModel.countDocuments();
    const signalsCount = await EmotionalSignalModel.countDocuments();

    res.json({
      success: true,
      stats: {
        moodEntries: moodCount,
        wellnessRecords: wellnessCount,
        signalRecords: signalsCount,
      },
    });
  } catch (error) {
    logger.error('Stats error', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// STARTUP
// ============================================

async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    app.listen(PORT, () => {
      logger.info(`REZ Emotional Intelligence started on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`API: http://localhost:${PORT}/`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  await mongoose.disconnect();
  process.exit(0);
});

start();

export { app };

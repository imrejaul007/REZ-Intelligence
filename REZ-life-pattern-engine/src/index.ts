/**
 * REZ Life Pattern Engine - Main Server
 *
 * Daily/weekly/seasonal patterns, routine detection, life events
 * Port: 4161
 */

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger.js';
import type { RoutinePattern } from './types/index.js';
import {
  RoutineModel,
  LifeEventModel,
  ActivityModel,
  RoutineDocument,
  detectRoutines,
  analyzeTimePattern,
  analyzeLifestyleProfile,
  analyzeConsumptionPattern,
  analyzeRhythms,
  detectLifeStage,
  predictNext24hRoutines,
  detectLifeEvents,
  generateLifePatternContext,
} from './services/lifePatternService.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4161', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_life_pattern';

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const activitySchema = z.object({
  userId: z.string().min(1),
  activity: z.string().min(1),
  timestamp: z.string().datetime().or(z.number()).transform(v => new Date(v)),
  duration: z.number().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    name: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const routineDetectionSchema = z.object({
  userId: z.string().min(1),
  events: z.array(z.object({
    type: z.string().optional(),
    activity: z.string().optional(),
    timestamp: z.string().datetime().or(z.number()).transform(v => new Date(v)),
    duration: z.number().optional(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
      name: z.string().optional(),
    }).optional(),
    properties: z.record(z.unknown()).optional(),
  })).min(5),
  options: z.object({
    minFrequency: z.number().optional(),
    minConfidence: z.number().optional(),
  }).optional(),
});

const lifeEventDetectionSchema = z.object({
  userId: z.string().min(1),
  signals: z.array(z.object({
    type: z.string(),
    value: z.unknown(),
    timestamp: z.string().datetime().or(z.number()).transform(v => new Date(v)),
    source: z.string(),
  })).min(3),
});

const contextRequestSchema = z.object({
  userId: z.string().min(1),
  includePredictions: z.boolean().optional(),
});

// ============================================
// HEALTH ENDPOINTS
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-life-pattern-engine',
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
    service: 'REZ Life Pattern Engine',
    version: '1.0.0',
    port: PORT,
    description: 'Daily/weekly/seasonal patterns, routine detection, life events',
    endpoints: {
      activity: {
        'POST /api/activity': 'Record activity',
        'GET /api/activity/:userId': 'Get user activities',
      },
      routines: {
        'POST /api/routines/detect': 'Detect routines from events',
        'GET /api/routines/:userId': 'Get user routines',
        'DELETE /api/routines/:userId/:routineId': 'Delete routine',
      },
      patterns: {
        'POST /api/patterns/time': 'Analyze time patterns',
        'POST /api/patterns/lifestyle': 'Analyze lifestyle profile',
        'POST /api/patterns/rhythms': 'Analyze life rhythms',
      },
      lifeEvents: {
        'POST /api/life-events/detect': 'Detect life events',
        'GET /api/life-events/:userId': 'Get user life events',
        'POST /api/life-events/:userId': 'Record life event',
      },
      context: {
        'POST /api/context': 'Get full life pattern context',
        'GET /api/predictions/:userId/24h': 'Get 24h predictions',
      },
    },
  });
});

// ============================================
// ACTIVITY ENDPOINTS
// ============================================

app.post('/api/activity', async (req: Request, res: Response) => {
  try {
    const validated = activitySchema.parse(req.body);

    const activity = new ActivityModel({
      userId: validated.userId,
      activity: validated.activity,
      timestamp: validated.timestamp,
      duration: validated.duration,
      location: validated.location,
      metadata: validated.metadata,
    });

    await activity.save();

    res.status(201).json({
      success: true,
      activity,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Record activity error', { error });
    res.status(500).json({ error: 'Failed to record activity' });
  }
});

app.post('/api/activities/batch', async (req: Request, res: Response) => {
  try {
    const { userId, activities } = req.body;

    if (!userId || !Array.isArray(activities)) {
      res.status(400).json({ error: 'userId and activities array required' });
      return;
    }

    const docs = activities.map((a: any) => ({
      userId,
      activity: a.activity || a.type,
      timestamp: new Date(a.timestamp),
      duration: a.duration,
      location: a.location,
      metadata: a.metadata || a.properties,
    }));

    await ActivityModel.insertMany(docs);

    res.status(201).json({
      success: true,
      count: docs.length,
    });
  } catch (error) {
    logger.error('Batch activities error', { error });
    res.status(500).json({ error: 'Failed to record activities' });
  }
});

app.get('/api/activity/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '30', limit = '100', type } = req.query;

    const daysNum = parseInt(days as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const query: any = {
      userId,
      timestamp: { $gte: startDate },
    };

    if (type) {
      query.activity = type;
    }

    const activities = await ActivityModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limitNum);

    res.json({
      success: true,
      count: activities.length,
      activities,
    });
  } catch (error) {
    logger.error('Get activities error', { error });
    res.status(500).json({ error: 'Failed to get activities' });
  }
});

// ============================================
// ROUTINE ENDPOINTS
// ============================================

app.post('/api/routines/detect', async (req: Request, res: Response) => {
  try {
    const validated = routineDetectionSchema.parse(req.body);

    const routines = await detectRoutines(validated.userId, validated.events);

    // Save new routines
    if (routines.length > 0) {
      const docs = routines.map(r => new RoutineModel(r));
      await RoutineModel.insertMany(docs);
    }

    res.json({
      success: true,
      routines,
      count: routines.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Detect routines error', { error });
    res.status(500).json({ error: 'Failed to detect routines' });
  }
});

app.get('/api/routines/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;

    const query: any = { userId };
    if (category) {
      query.category = category;
    }

    const routines = await RoutineModel.find(query)
      .sort({ lastActive: -1 });

    res.json({
      success: true,
      routines,
      count: routines.length,
    });
  } catch (error) {
    logger.error('Get routines error', { error });
    res.status(500).json({ error: 'Failed to get routines' });
  }
});

app.get('/api/routines/:userId/variations', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const routines = await RoutineModel.find({ userId });

    const weekdayRoutine = routines.filter((r: RoutineDocument) =>
      r.pattern.daysOfWeek.filter((d: string) => !['saturday', 'sunday'].includes(d)).length > 3
    );
    const weekendRoutine = routines.filter((r: RoutineDocument) =>
      r.pattern.daysOfWeek.some((d: string) => ['saturday', 'sunday'].includes(d))
    );

    res.json({
      success: true,
      variations: {
        weekdayRoutine,
        weekendRoutine,
        holidayRoutine: null,
        travelRoutine: [],
      },
    });
  } catch (error) {
    logger.error('Get routine variations error', { error });
    res.status(500).json({ error: 'Failed to get routine variations' });
  }
});

app.delete('/api/routines/:userId/:routineId', async (req: Request, res: Response) => {
  try {
    const { userId, routineId } = req.params;

    await RoutineModel.deleteOne({ _id: routineId, userId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete routine error', { error });
    res.status(500).json({ error: 'Failed to delete routine' });
  }
});

// ============================================
// PATTERN ENDPOINTS
// ============================================

app.post('/api/patterns/time', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      res.status(400).json({ error: 'Events array required' });
      return;
    }

    const timePattern = analyzeTimePattern(events);

    res.json({
      success: true,
      timePattern,
    });
  } catch (error) {
    logger.error('Analyze time pattern error', { error });
    res.status(500).json({ error: 'Failed to analyze time pattern' });
  }
});

app.post('/api/patterns/lifestyle', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      res.status(400).json({ error: 'Events array required' });
      return;
    }

    const lifestyle = analyzeLifestyleProfile(events);

    res.json({
      success: true,
      lifestyle,
    });
  } catch (error) {
    logger.error('Analyze lifestyle error', { error });
    res.status(500).json({ error: 'Failed to analyze lifestyle' });
  }
});

app.post('/api/patterns/rhythms', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      res.status(400).json({ error: 'Events array required' });
      return;
    }

    const rhythms = analyzeRhythms(events);

    res.json({
      success: true,
      rhythms,
    });
  } catch (error) {
    logger.error('Analyze rhythms error', { error });
    res.status(500).json({ error: 'Failed to analyze rhythms' });
  }
});

app.get('/api/life-stage/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '90' } = req.query;

    const daysNum = parseInt(days as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const events = await ActivityModel.find({
      userId,
      timestamp: { $gte: startDate },
    });

    const lifeStage = detectLifeStage(events);

    res.json({
      success: true,
      lifeStage,
    });
  } catch (error) {
    logger.error('Detect life stage error', { error });
    res.status(500).json({ error: 'Failed to detect life stage' });
  }
});

// ============================================
// LIFE EVENT ENDPOINTS
// ============================================

app.post('/api/life-events/detect', async (req: Request, res: Response) => {
  try {
    const validated = lifeEventDetectionSchema.parse(req.body);

    const detected = detectLifeEvents(validated.signals);

    // Save detected events
    if (detected.length > 0) {
      const docs = detected.map(e => new LifeEventModel({
        userId: validated.userId,
        ...e,
        createdAt: new Date(),
      }));
      await LifeEventModel.insertMany(docs);
    }

    res.json({
      success: true,
      detected,
      count: detected.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Detect life events error', { error });
    res.status(500).json({ error: 'Failed to detect life events' });
  }
});

app.get('/api/life-events/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '90', status } = req.query;

    const daysNum = parseInt(days as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const query: any = {
      userId,
      startDate: { $gte: startDate },
    };

    if (status) {
      query.status = status;
    }

    const events = await LifeEventModel.find(query)
      .sort({ startDate: -1 });

    res.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    logger.error('Get life events error', { error });
    res.status(500).json({ error: 'Failed to get life events' });
  }
});

app.post('/api/life-events/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type, title, description, startDate, endDate, impact } = req.body;

    const event = new LifeEventModel({
      userId,
      type,
      title,
      description,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      impact: impact || { emotional: 50, financial: 0, social: 30, routine: 40 },
      detectedFrom: ['user_reported'],
      confidence: 1.0,
      status: 'confirmed',
    });

    await event.save();

    res.status(201).json({
      success: true,
      event,
    });
  } catch (error) {
    logger.error('Record life event error', { error });
    res.status(500).json({ error: 'Failed to record life event' });
  }
});

// ============================================
// CONTEXT ENDPOINTS
// ============================================

app.post('/api/context', async (req: Request, res: Response) => {
  try {
    const validated = contextRequestSchema.parse(req.body);

    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const events = await ActivityModel.find({
      userId: validated.userId,
      timestamp: { $gte: startDate },
    }).limit(500);

    const context = await generateLifePatternContext(
      validated.userId,
      events,
      validated.includePredictions
    );

    res.json({
      success: true,
      context,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Get life pattern context error', { error });
    res.status(500).json({ error: 'Failed to get life pattern context' });
  }
});

app.get('/api/predictions/:userId/24h', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get routines and recent activities
    const routines = await RoutineModel.find({ userId }).limit(20);
    const activities = await ActivityModel.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100);

    const timePattern = analyzeTimePattern(activities);
    const predictions = predictNext24hRoutines(userId, timePattern, routines as unknown as RoutinePattern[]);

    res.json({
      success: true,
      predictions,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Get 24h predictions error', { error });
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// ============================================
// STATISTICS ENDPOINT
// ============================================

app.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const routineCount = await RoutineModel.countDocuments();
    const eventCount = await LifeEventModel.countDocuments();
    const activityCount = await ActivityModel.countDocuments();

    res.json({
      success: true,
      stats: {
        routines: routineCount,
        lifeEvents: eventCount,
        activities: activityCount,
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
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    app.listen(PORT, () => {
      logger.info(`REZ Life Pattern Engine started on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`API: http://localhost:${PORT}/`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

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

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { SequenceAnalyzer } from '../services/sequenceAnalyzer.js';
import { TemporalPredictor } from '../services/temporalPredictor.js';
import { PatternDetector } from '../services/patternDetector.js';
import { SessionIntelligence } from '../services/sessionIntelligence.js';
import type {
  BehaviorEvent,
  SequencePattern,
  TemporalPattern,
  MarkovChainModel,
  PatternType,
  UserSession as UserSessionType,
  ActionType
} from '../types/index.js';
import logger from '../utils/logger.js';
import {
  BehaviorEventModel,
  UserSessionModel,
  MarkovChainModelDoc,
  SequencePatternModel,
  TemporalPatternModel
} from '../models/sequenceModel.js';

// Simple sanitize function to prevent NoSQL injection
function sanitizeInput(input: unknown): string {
  if (typeof input === 'string') {
    // Remove $ and . characters that MongoDB operators use
    return input.replace(/[\$\.]/g, '_');
  }
  return String(input);
}

const router = Router();

// Initialize services
const sequenceAnalyzer = new SequenceAnalyzer();
const temporalPredictor = new TemporalPredictor();
const patternDetector = new PatternDetector();
const sessionIntelligence = new SessionIntelligence();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const sequenceAnalysisSchema = z.object({
  userId: z.string().min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sessionIds: z.array(z.string()).optional(),
  includeMarkovModel: z.boolean().optional().default(true),
  minEvents: z.number().min(5).max(1000).optional().default(10)
});

const patternDetectionSchema = z.object({
  userId: z.string().min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  patternTypes: z.array(z.enum([
    'sequential', 'periodic', 'temporal', 'session', 'funnel', 'abandonment', 'engagement'
  ])).optional(),
  minOccurrences: z.number().min(2).optional().default(3)
});

const recurringPatternsSchema = z.object({
  userId: z.string().min(1),
  patternType: z.enum([
    'sequential', 'periodic', 'temporal', 'session', 'funnel', 'abandonment', 'engagement'
  ]).optional(),
  limit: z.number().min(1).max(100).optional().default(20)
});

// ============================================
// SEQUENCE ANALYSIS
// ============================================

/**
 * POST /api/sequence/analyze
 * Analyze user behavior sequences
 */
router.post('/api/sequence/analyze', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = (req as unknown as Record<string, unknown>).requestId as string;

  // Validate input
  const validation = sequenceAnalysisSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const { userId, startDate, endDate, sessionIds, includeMarkovModel, minEvents } = validation.data;

  // Sanitize inputs
  const sanitizedUserId = sanitizeInput(userId);

  // Build query
  const query: Record<string, unknown> = { userId: sanitizedUserId };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) (query.timestamp as Record<string, unknown>).$gte = new Date(startDate);
    if (endDate) (query.timestamp as Record<string, unknown>).$lte = new Date(endDate);
  }
  
  if (sessionIds && sessionIds.length > 0) {
    query.sessionId = { $in: sessionIds.map(s => sanitizeInput(s)) };
  }

  // Fetch events from MongoDB
  const events = await BehaviorEventModel.find(query)
    .sort({ timestamp: -1 })
    .limit(10000)
    .lean();

  if (events.length < minEvents) {
    throw new ValidationError(
      `Insufficient events for analysis. Need at least ${minEvents}, found ${events.length}`,
      { eventCount: events.length, required: minEvents }
    );
  }

  // Convert to BehaviorEvent type
  const behaviorEvents: BehaviorEvent[] = events.map(e => ({
    eventId: e.eventId,
    userId: e.userId,
    action: e.action as BehaviorEvent['action'],
    timestamp: e.timestamp,
    sessionId: e.sessionId,
    metadata: e.metadata as Record<string, unknown> | undefined,
    duration: e.duration,
    productId: e.productId,
    categoryId: e.categoryId,
    amount: e.amount,
    deviceType: e.deviceType as 'mobile' | 'desktop' | 'tablet' | undefined,
    location: e.location
  }));

  // Perform analysis
  const result = sequenceAnalyzer.analyzeSequence(
    sanitizedUserId,
    behaviorEvents,
    { includeMarkovModel, minEvents }
  );

  // Cache result if Markov model was generated
  if (result.markovModel) {
    await MarkovChainModelDoc.findOneAndUpdate(
      { userId: sanitizedUserId },
      {
        userId: sanitizedUserId,
        states: result.markovModel.states,
        transitionMatrix: result.markovModel.transitionMatrix as unknown as Record<string, Record<string, number>>,
        initialProbabilities: result.markovModel.initialProbabilities as unknown as Record<string, number>,
        order: result.markovModel.order,
        trainedAt: result.markovModel.trainedAt,
        eventCount: result.markovModel.eventCount,
        entropy: result.markovModel.entropy
      },
      { upsert: true, new: true }
    );
  }

  // Store patterns
  if (result.patterns.length > 0) {
    const patternDocs = result.patterns.map(p => ({
      patternId: p.patternId,
      userId: sanitizedUserId,
      sequence: p.sequence,
      frequency: p.frequency,
      averageDuration: p.averageDuration,
      conversionRate: p.conversionRate,
      firstOccurrence: p.firstOccurrence,
      lastOccurrence: p.lastOccurrence,
      confidence: p.confidence
    }));

    await SequencePatternModel.deleteMany({ userId: sanitizedUserId });
    await SequencePatternModel.insertMany(patternDocs);
  }

  logger.info('Sequence analysis completed', {
    userId: sanitizedUserId,
    eventCount: events.length,
    patternsFound: result.patterns.length,
    durationMs: Date.now() - startTime,
    requestId
  });

  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    requestId,
    processingTimeMs: Date.now() - startTime
  });
}));

/**
 * POST /api/sequence/events
 * Record behavior events
 */
router.post('/api/sequence/events', asyncHandler(async (req: Request, res: Response) => {
  const eventsSchema = z.object({
    events: z.array(z.object({
      eventId: z.string().optional(),
      userId: z.string().min(1),
      action: z.string().min(1),
      timestamp: z.string().datetime(),
      sessionId: z.string().min(1),
      duration: z.number().optional(),
      productId: z.string().optional(),
      categoryId: z.string().optional(),
      amount: z.number().optional(),
      deviceType: z.enum(['mobile', 'desktop', 'tablet']).optional(),
      metadata: z.record(z.unknown()).optional()
    })).min(1)
  });

  const validation = eventsSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const { events } = validation.data;

  // Add eventIds if not provided
  const eventsWithIds = events.map(e => ({
    ...e,
    eventId: e.eventId || uuidv4(),
    timestamp: new Date(e.timestamp)
  }));

  // Insert events
  await BehaviorEventModel.insertMany(eventsWithIds);

  res.status(201).json({
    success: true,
    data: {
      recorded: eventsWithIds.length,
      eventIds: eventsWithIds.map(e => e.eventId)
    },
    timestamp: new Date().toISOString(),
    requestId: (req as unknown as Record<string, unknown>).requestId
  });
}));

// ============================================
// PATTERN DETECTION
// ============================================

/**
 * POST /api/pattern/detect
 * Detect patterns in user behavior
 */
router.post('/api/pattern/detect', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = (req as unknown as Record<string, unknown>).requestId as string;

  const validation = patternDetectionSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const { userId, startDate, endDate, patternTypes, minOccurrences } = validation.data;
  const sanitizedUserId = sanitizeInput(userId);

  // Build query
  const query: Record<string, unknown> = { userId: sanitizedUserId };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) (query.timestamp as Record<string, unknown>).$gte = new Date(startDate);
    if (endDate) (query.timestamp as Record<string, unknown>).$lte = new Date(endDate);
  }

  // Fetch events
  const events = await BehaviorEventModel.find(query)
    .sort({ timestamp: -1 })
    .limit(10000)
    .lean();

  if (events.length < minOccurrences * 2) {
    throw new ValidationError(
      `Insufficient events for pattern detection. Need at least ${minOccurrences * 2}, found ${events.length}`,
      { eventCount: events.length, required: minOccurrences * 2 }
    );
  }

  // Convert to BehaviorEvent type
  const behaviorEvents: BehaviorEvent[] = events.map(e => ({
    eventId: e.eventId,
    userId: e.userId,
    action: e.action as BehaviorEvent['action'],
    timestamp: e.timestamp,
    sessionId: e.sessionId,
    metadata: e.metadata as Record<string, unknown> | undefined,
    duration: e.duration,
    productId: e.productId,
    categoryId: e.categoryId,
    amount: e.amount,
    deviceType: e.deviceType as 'mobile' | 'desktop' | 'tablet' | undefined,
    location: e.location
  }));

  // Detect patterns
  const result = patternDetector.detectPatterns(
    sanitizedUserId,
    behaviorEvents,
    { patternTypes, minOccurrences }
  );

  // Store patterns
  if (result.patterns.length > 0) {
    const patternDocs = result.patterns.map(p => ({
      patternId: p.patternId,
      userId: sanitizedUserId,
      patternType: p.patternType,
      description: p.description,
      confidence: p.confidence,
      occurrences: p.occurrences,
      frequency: p.frequency,
      peakTimes: p.peakTimes,
      value: p.value,
      conversionRate: p.conversionRate,
      detectedAt: p.detectedAt,
      nextExpectedOccurrence: p.nextExpectedOccurrence
    }));

    await TemporalPatternModel.deleteMany({ userId: sanitizedUserId });
    await TemporalPatternModel.insertMany(patternDocs);
  }

  logger.info('Pattern detection completed', {
    userId: sanitizedUserId,
    patternsFound: result.patterns.length,
    periodicPatterns: result.periodicPatterns.length,
    durationMs: Date.now() - startTime,
    requestId
  });

  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    requestId,
    processingTimeMs: Date.now() - startTime
  });
}));

/**
 * GET /api/pattern/recurring/:userId
 * Get recurring patterns for a user
 */
router.get('/api/pattern/recurring/:userId', asyncHandler(async (req: Request, res: Response) => {
  const requestId = (req as unknown as Record<string, unknown>).requestId as string;
  const userId = sanitizeInput(req.params.userId);

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const validation = recurringPatternsSchema.parse({
    userId,
    patternType: req.query.patternType as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
  });

  // Build query
  const query: Record<string, unknown> = { userId };
  
  if (validation.patternType) {
    query.patternType = validation.patternType;
  }

  // Fetch patterns
  const patterns = await TemporalPatternModel.find(query)
    .sort({ confidence: -1, frequency: -1 })
    .limit(validation.limit)
    .lean();

  // Transform to TemporalPattern type
  const result: TemporalPattern[] = patterns.map(p => ({
    patternId: p.patternId,
    userId: p.userId,
    patternType: p.patternType as PatternType,
    description: p.description,
    confidence: p.confidence,
    occurrences: p.occurrences,
    frequency: p.frequency as 'hourly' | 'daily' | 'weekly' | 'monthly',
    peakTimes: p.peakTimes ? {
      dayOfWeek: p.peakTimes.dayOfWeek as TemporalPattern['peakTimes'] extends { dayOfWeek?: infer D } ? D : never,
      hourOfDay: p.peakTimes.hourOfDay
    } : undefined,
    value: p.value,
    conversionRate: p.conversionRate,
    detectedAt: p.detectedAt,
    nextExpectedOccurrence: p.nextExpectedOccurrence
  }));

  res.json({
    success: true,
    data: {
      userId,
      patterns: result,
      count: result.length
    },
    timestamp: new Date().toISOString(),
    requestId
  });
}));

// ============================================
// NEXT ACTION PREDICTION
// ============================================

/**
 * GET /api/predict/next-action/:userId
 * Predict next action for a user
 */
router.get('/api/predict/next-action/:userId', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = (req as unknown as Record<string, unknown>).requestId as string;
  const userId = sanitizeInput(req.params.userId);

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const sessionId = req.query.sessionId as string | undefined;
  const limit = parseInt(req.query.limit as string, 10) || 1000;

  // Build query
  const query: Record<string, unknown> = { userId };
  if (sessionId) {
    query.sessionId = sanitizeInput(sessionId);
  }

  // Fetch events
  const events = await BehaviorEventModel.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  if (events.length < 5) {
    throw new ValidationError(
      `Insufficient events for prediction. Need at least 5, found ${events.length}`,
      { eventCount: events.length, required: 5 }
    );
  }

  // Convert to BehaviorEvent type
  const behaviorEvents: BehaviorEvent[] = events.map(e => ({
    eventId: e.eventId,
    userId: e.userId,
    action: e.action as BehaviorEvent['action'],
    timestamp: e.timestamp,
    sessionId: e.sessionId,
    metadata: e.metadata as Record<string, unknown> | undefined,
    duration: e.duration,
    productId: e.productId,
    categoryId: e.categoryId,
    amount: e.amount,
    deviceType: e.deviceType as 'mobile' | 'desktop' | 'tablet' | undefined,
    location: e.location
  }));

  // Try to get cached Markov model
  let markovModel: MarkovChainModel | undefined;
  const cachedModel = await MarkovChainModelDoc.findOne({ userId }).lean();
  
  if (cachedModel) {
    markovModel = {
      userId: cachedModel.userId,
      states: cachedModel.states as BehaviorEvent['action'][],
      transitionMatrix: cachedModel.transitionMatrix as unknown as Record<BehaviorEvent['action'], Record<BehaviorEvent['action'], number>>,
      initialProbabilities: cachedModel.initialProbabilities as unknown as Record<BehaviorEvent['action'], number>,
      order: cachedModel.order,
      trainedAt: cachedModel.trainedAt,
      eventCount: cachedModel.eventCount,
      entropy: cachedModel.entropy
    };
  }

  // Predict next action
  const result = temporalPredictor.predictNextAction(userId, behaviorEvents, markovModel);

  logger.info('Next action prediction completed', {
    userId,
    predictedAction: result.predictions[0]?.action,
    confidence: result.predictions[0]?.confidence,
    durationMs: Date.now() - startTime,
    requestId
  });

  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    requestId,
    processingTimeMs: Date.now() - startTime
  });
}));

/**
 * GET /api/predict/session/:userId
 * Predict next session details
 */
router.get('/api/predict/session/:userId', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = (req as unknown as Record<string, unknown>).requestId as string;
  const userId = sanitizeInput(req.params.userId);

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Fetch events
  const events = await BehaviorEventModel.find({ userId })
    .sort({ timestamp: -1 })
    .limit(5000)
    .lean();

  if (events.length < 10) {
    throw new ValidationError(
      `Insufficient events for session prediction. Need at least 10, found ${events.length}`,
      { eventCount: events.length, required: 10 }
    );
  }

  // Convert to BehaviorEvent type
  const behaviorEvents: BehaviorEvent[] = events.map(e => ({
    eventId: e.eventId,
    userId: e.userId,
    action: e.action as BehaviorEvent['action'],
    timestamp: e.timestamp,
    sessionId: e.sessionId,
    metadata: e.metadata as Record<string, unknown> | undefined,
    duration: e.duration,
    productId: e.productId,
    categoryId: e.categoryId,
    amount: e.amount,
    deviceType: e.deviceType as 'mobile' | 'desktop' | 'tablet' | undefined,
    location: e.location
  }));

  // Predict session
  const result = temporalPredictor.predictSession(userId, behaviorEvents);

  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    requestId,
    processingTimeMs: Date.now() - startTime
  });
}));

// ============================================
// SESSION INTELLIGENCE
// ============================================

/**
 * GET /api/session/intelligence/:userId
 * Get session intelligence for a user
 */
router.get('/api/session/intelligence/:userId', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = (req as unknown as Record<string, unknown>).requestId as string;
  const userId = sanitizeInput(req.params.userId);

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Fetch events
  const events = await BehaviorEventModel.find({ userId })
    .sort({ timestamp: -1 })
    .limit(10000)
    .lean();

  if (events.length < 5) {
    throw new ValidationError(
      `Insufficient events for session analysis. Need at least 5, found ${events.length}`,
      { eventCount: events.length, required: 5 }
    );
  }

  // Convert to BehaviorEvent type
  const behaviorEvents: BehaviorEvent[] = events.map(e => ({
    eventId: e.eventId,
    userId: e.userId,
    action: e.action as BehaviorEvent['action'],
    timestamp: e.timestamp,
    sessionId: e.sessionId,
    metadata: e.metadata as Record<string, unknown> | undefined,
    duration: e.duration,
    productId: e.productId,
    categoryId: e.categoryId,
    amount: e.amount,
    deviceType: e.deviceType as 'mobile' | 'desktop' | 'tablet' | undefined,
    location: e.location
  }));

  // Analyze session intelligence
  const result = sessionIntelligence.analyzeSessionIntelligence(userId, behaviorEvents);

  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    requestId,
    processingTimeMs: Date.now() - startTime
  });
}));

/**
 * GET /api/session/compare/:userId
 * Compare current session with historical data
 */
router.get('/api/session/compare/:userId', asyncHandler(async (req: Request, res: Response) => {
  const requestId = (req as unknown as Record<string, unknown>).requestId as string;
  const userId = sanitizeInput(req.params.userId);
  const sessionId = req.query.sessionId as string;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!sessionId) {
    throw new ValidationError('Session ID is required for comparison');
  }

  // Fetch current session
  const currentSession = await UserSessionModel.findOne({
    userId,
    sessionId: sanitizeInput(sessionId)
  }).lean();

  if (!currentSession) {
    throw new NotFoundError(`Session ${sessionId} not found`);
  }

  // Fetch historical sessions
  const historicalSessions = await UserSessionModel.find({
    userId,
    sessionId: { $ne: sanitizeInput(sessionId) }
  })
    .sort({ startTime: -1 })
    .limit(100)
    .lean();

  // Build UserSession objects
  const current = {
    sessionId: currentSession.sessionId,
    userId: currentSession.userId,
    startTime: currentSession.startTime,
    endTime: currentSession.endTime,
    sessionType: currentSession.sessionType as 'browse' | 'search' | 'purchase' | 'abandoned' | 'mixed',
    deviceType: currentSession.deviceType as 'mobile' | 'desktop' | 'tablet' | undefined,
    location: currentSession.location,
    isActive: currentSession.isActive,
    totalDuration: currentSession.totalDuration,
    eventCount: currentSession.eventCount,
    actions: currentSession.actions as BehaviorEvent['action'][]
  };

  const history = historicalSessions.map(s => ({
    sessionId: s.sessionId,
    userId: s.userId,
    startTime: s.startTime,
    endTime: s.endTime,
    sessionType: s.sessionType as 'browse' | 'search' | 'purchase' | 'abandoned' | 'mixed',
    deviceType: s.deviceType as 'mobile' | 'desktop' | 'tablet' | undefined,
    location: s.location,
    isActive: s.isActive,
    totalDuration: s.totalDuration,
    eventCount: s.eventCount,
    actions: s.actions as BehaviorEvent['action'][]
  }));

  // Compare
  const result = sessionIntelligence.compareSession(userId, current, history);

  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    requestId
  });
}));

// ============================================
// STATISTICS
// ============================================

/**
 * GET /api/stats
 * Get service statistics
 */
router.get('/api/stats', asyncHandler(async (_req: Request, res: Response) => {
  // Get counts
  const [eventCount, sessionCount, patternCount, markovCount] = await Promise.all([
    BehaviorEventModel.countDocuments(),
    UserSessionModel.countDocuments(),
    SequencePatternModel.countDocuments(),
    MarkovChainModelDoc.countDocuments()
  ]);

  res.json({
    success: true,
    data: {
      totalEvents: eventCount,
      totalSessions: sessionCount,
      totalPatterns: patternCount,
      totalMarkovModels: markovCount,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    },
    timestamp: new Date().toISOString()
  });
}));

export default router;

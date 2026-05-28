/**
 * Cosmic OS - Main Server
 *
 * AI-Powered Human Life Intelligence OS
 * Spiritual abstraction, AI Council, cosmic context
 * Built ON RABTUL Platform
 * Port: 4163
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger.js';
import {
  interpretMoodToCosmicState,
  generateCouncilResponse,
  generateDailyReading,
  generateCosmicContext,
  getDomainGuidance,
  processMoodCheckIn,
} from './services/cosmicService.js';
import {
  // RABTUL Auth
  verifyUser,
  sendOTP,
  verifyOTP,
  // RABTUL Profile
  getUserProfile,
  updateUserProfile,
  // RABTUL Wallet
  getWalletBalance,
  addWellnessCoins,
  awardWellnessReward,
  WELLNESS_REWARDS,
  // RABTUL Notifications
  sendDailyCosmicReading,
  sendWellnessReminder,
  // RABTUL Gamification
  recordWellnessCheckin,
  getWellnessStreak,
  // RABTUL Prive
  checkPriveEligibility,
  recordEngagementSignal,
  getCosmicUserContext,
} from './integrations/rabtulPlatform.js';
import { COSMIC_AGENTS } from './types/index.js';
import type { AgentType, LifeDomain } from './types/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4163', 10);

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
// AUTH MIDDLEWARE
// ============================================

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }

  const user = await verifyUser(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  (req as Request & { user: { id: string } }).user = { id: user.id };
  next();
};

// ============================================
// VALIDATION SCHEMAS
// ============================================

const moodCheckInSchema = z.object({
  userId: z.string().min(1),
  mood: z.enum(['radiant', 'bright', 'balanced', 'clouded', 'stormy', 'peaceful', 'restless', 'tired']),
  energy: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
  gratitude: z.string().optional(),
  intent: z.string().optional(),
});

const cosmicInputSchema = z.object({
  userId: z.string().min(1),
  mood: z.string().optional(),
  energy: z.number().min(0).max(100).optional(),
  stress: z.number().min(0).max(100).optional(),
  wellness: z.number().min(0).max(100).optional(),
  careerStage: z.string().optional(),
  financialStress: z.number().min(0).max(100).optional(),
  socialEnergy: z.number().min(0).max(100).optional(),
  date: z.string().datetime().optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
});

const councilSchema = z.object({
  userId: z.string().min(1),
  question: z.string().optional(),
  context: cosmicInputSchema.optional(),
  agents: z.array(z.enum(['mystic', 'healer', 'strategist', 'oracle', 'connector', 'wealth_guide', 'explorer'])).optional(),
});

const domainGuidanceSchema = z.object({
  userId: z.string().min(1),
  domain: z.enum(['career', 'health', 'relationships', 'finances', 'growth', 'creativity', 'family', 'social', 'spiritual', 'adventure']),
  mood: z.string().optional(),
  energy: z.number().optional(),
});

// ============================================
// HEALTH ENDPOINTS
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Cosmic OS',
    version: '1.0.0',
    tagline: 'AI-Powered Human Life Intelligence OS',
    builtOn: 'RABTUL Platform',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// SERVICE INFO
// ============================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'Cosmic OS',
    tagline: 'AI-Powered Human Life Intelligence OS',
    version: '1.0.0',
    port: PORT,
    builtOn: 'RABTUL Platform',
    description: 'Spiritual abstraction, AI Council of Agents, cosmic guidance',
    rABTULIntegration: {
      auth: 'RABTUL Auth Service',
      profile: 'RABTUL Profile Service',
      wallet: 'RABTUL Wallet Service',
      notifications: 'RABTUL Notifications Service',
      gamification: 'RABTUL Gamification Service',
      prive: 'RABTUL Prive (Premium Loyalty)',
    },
    agents: COSMIC_AGENTS.map(a => ({
      type: a.type,
      name: a.name,
      persona: a.persona,
      voice: a.voice,
    })),
    endpoints: {
      auth: {
        'POST /api/auth/send-otp': 'Send OTP for authentication',
        'POST /api/auth/verify-otp': 'Verify OTP and get token',
        'GET /api/auth/verify': 'Verify token',
      },
      cosmic: {
        'GET /api/cosmic/:userId': 'Get full cosmic context',
        'POST /api/cosmic/context': 'Get cosmic context from input',
        'POST /api/cosmic/council': 'Consult the AI Council',
        'GET /api/cosmic/daily/:userId': 'Get daily cosmic reading',
      },
      mood: {
        'POST /api/mood/checkin': 'Record mood check-in + earn coins',
        'GET /api/mood/:userId/history': 'Get mood history',
      },
      guidance: {
        'POST /api/guidance/:domain': 'Get domain-specific guidance',
        'GET /api/guidance/:userId/:domain': 'Get guidance for user',
      },
      agents: {
        'GET /api/agents': 'List all AI Council agents',
        'GET /api/agents/:type': 'Get specific agent info',
        'POST /api/agents/:type/consult': 'Consult specific agent',
      },
      user: {
        'GET /api/user/:userId': 'Get user context (RABTUL)',
        'GET /api/user/:userId/streak': 'Get wellness streak (RABTUL)',
        'GET /api/user/:userId/wallet': 'Get wallet balance (RABTUL)',
      },
    },
  });
});

// ============================================
// AUTH ENDPOINTS (RABTUL)
// ============================================

app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ error: 'Phone number required' });
      return;
    }

    const success = await sendOTP(phone);

    res.json({
      success,
      message: success ? 'OTP sent successfully' : 'Failed to send OTP',
    });
  } catch (error) {
    logger.error('Send OTP error', { error });
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      res.status(400).json({ error: 'Phone and OTP required' });
      return;
    }

    const result = await verifyOTP(phone, otp);

    if (result.token) {
      res.json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } else {
      res.status(401).json({ error: 'Invalid OTP' });
    }
  } catch (error) {
    logger.error('Verify OTP error', { error });
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

app.get('/api/auth/verify', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }

  const user = await verifyUser(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  res.json({ success: true, user });
});

// ============================================
// COSMIC CONTEXT ENDPOINTS
// ============================================

app.get('/api/cosmic/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { includeCouncil = 'true' } = req.query;

    // Get user context from RABTUL
    const userContext = await getCosmicUserContext(userId);

    const context = await generateCosmicContext(userId);

    res.json({
      success: true,
      cosmic: context.cosmicState,
      council: includeCouncil === 'true' ? context.council : undefined,
      dailyReading: context.dailyReading,
      suggestedActions: context.suggestedActions,
      avoidedActions: context.avoidedActions,
      // RABTUL enriched data
      user: {
        name: userContext?.profile?.name,
        streak: userContext?.streak,
        priveTier: userContext?.prive?.tier,
      },
    });
  } catch (error) {
    logger.error('Get cosmic context error', { error });
    res.status(500).json({ error: 'Failed to get cosmic context' });
  }
});

app.post('/api/cosmic/context', async (req: Request, res: Response) => {
  try {
    const validated = cosmicInputSchema.parse(req.body);

    const cosmicState = interpretMoodToCosmicState(
      validated.mood || 'neutral',
      validated.energy || 50
    );

    const council = generateCouncilResponse(cosmicState, validated);
    const dailyReading = generateDailyReading(cosmicState, validated.userId);

    const suggestedActions: string[] = [];
    if (cosmicState.energyLevel === 'high') {
      suggestedActions.push('Channel this energy into meaningful action');
      suggestedActions.push('Start that project you\'ve been contemplating');
    } else if (cosmicState.energyLevel === 'low') {
      suggestedActions.push('Prioritize rest and restoration');
      suggestedActions.push('Choose gentle activities over ambitious pursuits');
    } else {
      suggestedActions.push('Maintain your current balance');
      suggestedActions.push('Build steadily on existing efforts');
    }

    res.json({
      success: true,
      cosmic: cosmicState,
      council,
      dailyReading,
      suggestedActions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error('Cosmic context error', { error });
    res.status(500).json({ error: 'Failed to generate cosmic context' });
  }
});

app.post('/api/cosmic/council', async (req: Request, res: Response) => {
  try {
    const validated = councilSchema.parse(req.body);

    const cosmicState = interpretMoodToCosmicState(
      validated.context?.mood || 'neutral',
      validated.context?.energy || 50
    );

    const activeAgents = validated.agents || ['mystic', 'healer', 'strategist', 'oracle'];
    const council = generateCouncilResponse(cosmicState, validated.context || {}, activeAgents);

    // Record engagement signal to Prive
    if (validated.userId) {
      await recordEngagementSignal(validated.userId, {
        type: 'cosmic_council_consultation',
        value: 1,
        source: 'cosmic_os',
      });
    }

    res.json({
      success: true,
      council,
      cosmicState,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error('Council consultation error', { error });
    res.status(500).json({ error: 'Failed to consult council' });
  }
});

app.get('/api/cosmic/daily/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { mood, energy } = req.query;

    let cosmicState;
    if (mood && energy) {
      cosmicState = interpretMoodToCosmicState(
        mood as string,
        parseInt(energy as string, 10)
      );
    } else {
      const context = await generateCosmicContext(userId);
      cosmicState = context.cosmicState;
    }

    const dailyReading = generateDailyReading(cosmicState, userId);

    // Send daily reading notification via RABTUL
    await sendDailyCosmicReading(userId, {
      theme: dailyReading.primaryTheme,
      affirmation: dailyReading.affirmation,
      cosmicState: cosmicState.energyLevel,
    });

    res.json({
      success: true,
      dailyReading,
    });
  } catch (error) {
    logger.error('Daily reading error', { error });
    res.status(500).json({ error: 'Failed to get daily reading' });
  }
});

// ============================================
// MOOD CHECK-IN ENDPOINTS (RABTUL INTEGRATED)
// ============================================

app.post('/api/mood/checkin', async (req: Request, res: Response) => {
  try {
    const validated = moodCheckInSchema.parse(req.body);

    // Clamp energy to valid range
    const clampedEnergy = Math.min(5, Math.max(1, validated.energy || 3)) as 1 | 2 | 3 | 4 | 5;

    // Process cosmic interpretation
    const response = processMoodCheckIn({
      userId: validated.userId,
      mood: validated.mood,
      energy: clampedEnergy,
      note: validated.note,
      gratitude: validated.gratitude,
      intent: validated.intent,
    });

    // Record wellness check-in via RABTUL Gamification
    const streakResult = await recordWellnessCheckin(validated.userId, validated.mood);

    // Award coins via RABTUL Wallet
    const coinsEarned = WELLNESS_REWARDS.moodCheckin;
    let coinBonus = 0;

    if (streakResult.streak && streakResult.streak.streakDays > 1) {
      // Bonus for streak
      coinBonus = Math.min(streakResult.streak.streakDays, 10) * 2;
    }

    await addWellnessCoins(
      validated.userId,
      coinsEarned + coinBonus,
      `Mood check-in: ${validated.mood} + streak bonus`
    );

    // Record engagement to Prive
    await recordEngagementSignal(validated.userId, {
      type: 'wellness_checkin',
      value: coinsEarned + coinBonus,
      source: 'cosmic_os',
    });

    // Send wellness reminder via RABTUL Notifications
    if (validated.gratitude) {
      await sendWellnessReminder(
        validated.userId,
        `Gratitude recorded: "${validated.gratitude}". ${response.affirmation}`
      );
    }

    res.status(201).json({
      success: true,
      ...response,
      rewards: {
        coinsEarned: coinsEarned + coinBonus,
        streakDays: streakResult.streak?.streakDays || 1,
        longestStreak: streakResult.streak?.longestStreak || 1,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error('Mood check-in error', { error });
    res.status(500).json({ error: 'Failed to process mood check-in' });
  }
});

app.get('/api/mood/:userId/history', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Would connect to stored mood history
    // For now, return streak from RABTUL
    const streak = await getWellnessStreak(userId);

    res.json({
      success: true,
      streak,
      message: 'Mood history storage coming soon',
    });
  } catch (error) {
    logger.error('Mood history error', { error });
    res.status(500).json({ error: 'Failed to get mood history' });
  }
});

// ============================================
// DOMAIN GUIDANCE ENDPOINTS
// ============================================

app.post('/api/guidance/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const validated = domainGuidanceSchema.parse({
      ...req.body,
      domain,
    });

    const cosmicState = interpretMoodToCosmicState(
      validated.mood || 'neutral',
      validated.energy || 50
    );

    const guidance = getDomainGuidance(
      validated.domain as LifeDomain,
      cosmicState,
      { userId: validated.userId }
    );

    // Record engagement
    await recordEngagementSignal(validated.userId, {
      type: 'domain_guidance_request',
      value: 1,
      source: `cosmic_os_${domain}`,
    });

    res.json({
      success: true,
      guidance,
      cosmicState,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error('Domain guidance error', { error });
    res.status(500).json({ error: 'Failed to get domain guidance' });
  }
});

app.get('/api/guidance/:userId/:domain', async (req: Request, res: Response) => {
  try {
    const { userId, domain } = req.params;

    const context = await generateCosmicContext(userId);

    const guidance = getDomainGuidance(
      domain as LifeDomain,
      context.cosmicState,
      { userId }
    );

    res.json({
      success: true,
      guidance,
      cosmicState: context.cosmicState,
    });
  } catch (error) {
    logger.error('Domain guidance error', { error });
    res.status(500).json({ error: 'Failed to get domain guidance' });
  }
});

// ============================================
// AGENT ENDPOINTS
// ============================================

app.get('/api/agents', (_req: Request, res: Response) => {
  res.json({
    success: true,
    agents: COSMIC_AGENTS.map(a => ({
      type: a.type,
      name: a.name,
      persona: a.persona,
      specialty: a.specialty,
      voice: a.voice,
    })),
  });
});

app.get('/api/agents/:type', (req: Request, res: Response) => {
  const { type } = req.params;
  const agent = COSMIC_AGENTS.find(a => a.type === type);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json({
    success: true,
    agent,
  });
});

app.post('/api/agents/:type/consult', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { userId, context } = req.body;

    const agent = COSMIC_AGENTS.find(a => a.type === type);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const cosmicState = interpretMoodToCosmicState(
      context?.mood || 'neutral',
      context?.energy || 50
    );

    const insight = generateCouncilResponse(
      cosmicState,
      context || {},
      [type as AgentType]
    );

    // Record engagement
    if (userId) {
      await recordEngagementSignal(userId, {
        type: `agent_consultation_${type}`,
        value: 1,
        source: 'cosmic_os',
      });
    }

    res.json({
      success: true,
      agent: {
        type: agent.type,
        name: agent.name,
        persona: agent.persona,
      },
      insight: insight.insights[0],
      cosmicState,
    });
  } catch (error) {
    logger.error('Agent consultation error', { error });
    res.status(500).json({ error: 'Failed to consult agent' });
  }
});

// ============================================
// USER ENDPOINTS (RABTUL)
// ============================================

app.get('/api/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userContext = await getCosmicUserContext(userId);

    if (!userContext) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      user: {
        id: userContext.user.id,
        name: userContext.profile?.name,
        email: userContext.profile?.email,
        avatar: userContext.profile?.avatar,
      },
      wallet: userContext.wallet,
      prive: userContext.prive,
      streak: userContext.streak,
    });
  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({ error: 'Failed to get user' });
  }
});

app.get('/api/user/:userId/streak', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const streak = await getWellnessStreak(userId);

    res.json({
      success: true,
      streak,
    });
  } catch (error) {
    logger.error('Get streak error', { error });
    res.status(500).json({ error: 'Failed to get streak' });
  }
});

app.get('/api/user/:userId/wallet', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const wallet = await getWalletBalance(userId);

    res.json({
      success: true,
      wallet,
    });
  } catch (error) {
    logger.error('Get wallet error', { error });
    res.status(500).json({ error: 'Failed to get wallet' });
  }
});

// ============================================
// REWARDS ENDPOINTS (RABTUL)
// ============================================

app.post('/api/rewards/mindfulness', async (req: Request, res: Response) => {
  try {
    const { userId, duration } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    const coins = duration >= 10 ? WELLNESS_REWARDS.mindfulnessSession : Math.floor(WELLNESS_REWARDS.mindfulnessSession / 2);

    await addWellnessCoins(userId, coins, `Mindfulness session: ${duration} minutes`);

    await recordEngagementSignal(userId, {
      type: 'mindfulness_session',
      value: coins,
      source: 'cosmic_os',
    });

    res.json({
      success: true,
      coinsEarned: coins,
    });
  } catch (error) {
    logger.error('Mindfulness reward error', { error });
    res.status(500).json({ error: 'Failed to record mindfulness reward' });
  }
});

app.post('/api/rewards/journal', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    await addWellnessCoins(userId, WELLNESS_REWARDS.journalEntry, 'Journal entry');

    await recordEngagementSignal(userId, {
      type: 'journal_entry',
      value: WELLNESS_REWARDS.journalEntry,
      source: 'cosmic_os',
    });

    res.json({
      success: true,
      coinsEarned: WELLNESS_REWARDS.journalEntry,
    });
  } catch (error) {
    logger.error('Journal reward error', { error });
    res.status(500).json({ error: 'Failed to record journal reward' });
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

app.listen(PORT, () => {
  logger.info(`Cosmic OS started on port ${PORT}`);
  logger.info(`Health: http://localhost:${PORT}/health`);
  logger.info(`API: http://localhost:${PORT}/`);
  logger.info('AI Council Agents:', COSMIC_AGENTS.map(a => a.name).join(', '));
  logger.info('Built ON: RABTUL Platform Services');
});

export { app };

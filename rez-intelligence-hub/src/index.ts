/**
 * REZ Intelligence Hub - With Voice AI
 * Unified user/merchant profiles + Voice AI + Autonomous Agents
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import financeRoutes from './routes/financeRoutes';
import userRoutes from './routes/userRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import {
  validateRequest,
  CreateUserProfileSchema,
  UpdateUserProfileSchema,
  CreateUserEventSchema,
  CreateMerchantProfileSchema,
  PaginationQuerySchema,
  z
} from './schemas';

// Voice AI imports
import voiceRoutes from './voice/webhooks/twilioWebhook';
import { orchestrator } from './voice/agents/swarmOrchestrator';
import sttService from './voice/services/stt';
import ttsService from './voice/services/tts';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4020;

// SECURITY FIX: MongoDB URI from environment variable
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('FATAL: MONGODB_URI environment variable is required');
  process.exit(1);
}

// User Profile Schema (derived signals, not raw logs)
// PERFORMANCE FIX: Added indexes for common query patterns
const UserProfile = mongoose.model('UserProfile', new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  derived_signals: {
    preferences: {
      cuisines: [{ type: String, index: true }],
      price_range: String,
      time_pattern: String,
      dietary: [String],
    },
    intent_signals: {
      current_intent: { type: String, index: true },
      intent_confidence: Number,
      purchase_probability: Number,
    },
    behavior: {
      frequency: String,
      avg_order_value: Number,
      engagement_level: String,
    },
  },
  segments: [{ type: String, index: true }],
  updatedAt: { type: Date, default: Date.now, index: true },
}, { collection: 'user_profiles', timestamps: true }));

// PERFORMANCE FIX: Add compound indexes for analytics queries
UserProfile.schema.index({ segments: 1, 'derived_signals.behavior.engagement_level': 1 });
UserProfile.schema.index({ 'derived_signals.intent_signals.current_intent': 1, 'derived_signals.intent_signals.intent_confidence': -1 });

// Merchant Profile
// PERFORMANCE FIX: Added indexes for common query patterns
const MerchantProfile = mongoose.model('MerchantProfile', new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  derived_signals: {
    demand_pattern: { type: String, index: true },
    customer_type: [{ type: String, index: true }],
    pricing_behavior: String,
  },
  segments: [{ type: String, index: true }],
  updatedAt: { type: Date, default: Date.now, index: true },
}, { collection: 'merchant_profiles', timestamps: true }));

// PERFORMANCE FIX: Add compound indexes
MerchantProfile.schema.index({ segments: 1, 'derived_signals.demand_pattern': 1 });

// SECURITY FIX: Health check without auth
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'intelligence-hub', timestamp: new Date().toISOString() });
});

// SECURITY FIX: Add authentication middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const publicPaths = ['/health', '/webhook/voice'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const internalToken = req.headers['x-internal-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!expectedToken) {
    console.error('INTELLIGENCE_001: INTERNAL_SERVICE_TOKEN not configured');
    return res.status(503).json({ error: 'Service not configured' });
  }

  if (internalToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});

// Rate limiting
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

app.get('/health', (req: Request, res: Response) => res.json({ status: 'healthy' });

// Validation schemas for params
const userIdParams = z.object({
  userId: z.string().min(1),
});

const userProfileQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

app.post('/profile/user',
  validateRequest({ body: CreateUserEventSchema }),
  async (req: Request, res: Response) => {
    const { userId, event_type, event_data } = req.body;
    // Derive signals from event
    let profile = await UserProfile.findOne({ userId });
    if (!profile) profile = new UserProfile({ userId, derived_signals: {} });

    // Update derived signals based on event type
    if (event_type === 'order_completed') {
      profile.derived_signals.behavior.avg_order_value = event_data.total || profile.derived_signals.behavior.avg_order_value || 0;
      profile.segments = profile.segments || [];
    }

    profile.updatedAt = new Date();
    await profile.save();
    res.json({ profile });
  }
);

app.get('/profile/user/:userId',
  validateRequest({ params: userIdParams }),
  async (req: Request, res: Response) => {
    const profile = await UserProfile.findOne({ userId: req.params.userId });
    if (!profile) return res.status(404).json({ error: 'not_found' });
    res.json({ profile });
  }
);

// PERFORMANCE FIX: Add paginated profiles list endpoint
app.get('/profiles',
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
      const offset = (page - 1) * limit;

      const [profiles, total] = await Promise.all([
        UserProfile.find({})
          .sort({ updatedAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
        UserProfile.countDocuments({}),
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        data: profiles,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch profiles' });
    }
  }
);

// Finance Intelligence routes
app.use('/api', financeRoutes);

// User Intelligence routes (from Intent Graph)
app.use('/api/intelligence', userRoutes);

// Dashboard routes for monitoring
app.use('/api/dashboard', dashboardRoutes);

// Voice AI routes
app.use('/webhook/voice', voiceRoutes);

// Voice processing endpoint
app.post('/api/voice/process', async (req: Request, res: Response) => {
  try {
    const { audio, text, context } = req.body;
    let transcript = text;

    // If audio provided, transcribe first
    if (audio && !text) {
      const sttResult = await sttService.transcribe(audio);
      transcript = sttResult.text;
    }

    // Route through AI
    const result = await orchestrator.route(
      { text: transcript, confidence: req.body.confidence },
      context || {}
    );

    // Generate audio response if requested
    if (req.headers.accept?.includes('audio')) {
      const audioResponse = await ttsService.synthesize(result.message || "I've processed your request.");
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename="response.mp3"'
      });
      res.send(audioResponse.audio);
    } else {
      res.json(result);
    }
  } catch (error: any) {
    console.error('[Voice] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Text-to-voice endpoint
app.post('/api/voice/text', async (req: Request, res: Response) => {
  try {
    const { text, context, audio = false } = req.body;

    const result = await orchestrator.route(
      { text },
      context || {}
    );

    if (audio) {
      const audioResponse = await ttsService.synthesize(result.message);
      res.json({
        ...result,
        audio: audioResponse.audio.toString('base64')
      });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    console.error('[Voice] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Agent status endpoint
app.get('/api/agents/status', (req: Request, res: Response) => {
  const status = orchestrator.getStatus ? orchestrator.getStatus() : { status: 'ready' };
  res.json({
    orchestrator: 'ready',
    agents: {
      order: 'ready',
      booking: 'ready',
      support: 'ready',
      nlu: 'ready'
    },
    ...status
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-intelligence-hub',
    version: '2.0.0',
    port: PORT,
    voice: 'enabled',
    timestamp: new Date().toISOString(),
    features: [
      'user_profiles',
      'finance_intelligence',
      'user_intelligence',
      'intent_graph_integration',
      'voice_ai',
      'autonomous_agents'
    ],
  });
});

// Voice health endpoint
app.get('/health/voice', (req: Request, res: Response) => {
  res.json({
    service: 'Voice AI',
    version: '1.0.0',
    status: 'ready',
    capabilities: ['speech-to-text', 'text-to-speech', 'autonomous-agents'],
    agents: ['order', 'booking', 'support', 'nlu']
  });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`Intelligence Hub running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`User routes: http://localhost:${PORT}/api/intelligence`);
  });
}).catch((err) => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

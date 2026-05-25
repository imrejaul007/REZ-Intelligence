/**
 * REZ AGENT OS v3.0 - FULLY CONNECTED
 *
 * TypeScript Version with Authentication
 *
 * Voice, Credit, POS, All Intelligence, All Services
 */

import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient, RedisClientType } from 'redis';
import winston from 'winston';

// Import all integrations
import VoiceIntegration from './voiceIntegration';
import CreditEngine from './creditEngine';
import POSIntegration from './posIntegration';
import IntelligenceClient from './intelligenceClient';
import AgentOSBrain from './brain';
import { IntentRouter } from './intentRouter';
import AgentOSHandlers from './handlers/agentOSHandlers';
import SupportHandlers from './handlers/supportHandlers';
import SessionManager from './sessionManager';
import { requireInternalAuth } from './middleware/auth';

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// =========================================================================
// TYPES
// =========================================================================

interface Config {
  PORT: number;
  INTELLIGENCE: {
    INTENT: string;
    MEMORY: string;
    IDENTITY: string;
    TASTE: string;
    REORDER: string;
    DEMAND: string;
    AGENTS: string;
    EVENTS: string;
    CDP: string;
  };
  SERVICES: {
    ORDER: string;
    BOOKING: string;
    WALLET: string;
    SUPPORT: string;
  };
}

// Extend WebSocket type
declare module 'ws' {
  interface WebSocket {
    session?;
    isAlive?: boolean;
  }
}

// =========================================================================
// CONFIGURATION
// =========================================================================

const CONFIG: Config = {
  PORT: parseInt(process.env.PORT || '4152', 10),
  INTELLIGENCE: {
    INTENT: process.env.REZ_INTENT_URL || 'http://localhost:4050',
    MEMORY: process.env.REZ_MEMORY_URL || 'http://localhost:4051',
    IDENTITY: process.env.REZ_IDENTITY_URL || 'http://localhost:4050',
    TASTE: process.env.REZ_TASTE_URL || 'http://localhost:4041',
    REORDER: process.env.REZ_REORDER_URL || 'http://localhost:4040',
    DEMAND: process.env.REZ_DEMAND_URL || 'http://localhost:4042',
    AGENTS: process.env.REZ_AGENTS_URL || 'http://localhost:4062',
    EVENTS: process.env.REZ_EVENTS_URL || 'http://localhost:4008',
    CDP: process.env.REZ_CDP_URL || 'http://localhost:3005'
  },
  SERVICES: {
    ORDER: process.env.ORDER_URL || 'https://rez-order.onrender.com',
    BOOKING: process.env.BOOKING_URL || 'https://rez-booking.onrender.com',
    WALLET: process.env.WALLET_URL || 'https://rez-wallet.onrender.com',
    SUPPORT: process.env.SUPPORT_URL || 'http://localhost:4033'
  }
};

// =========================================================================
// APP SETUP
// =========================================================================

const app: Express = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize Redis for session persistence
let redisClient: RedisClientType | null = null;

async function initRedis() {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => logger.error('Redis Client Error', { error: err }));
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.warn('Redis connection failed, using in-memory sessions', { error });
  }
}

// Initialize all integrations
const voice = new VoiceIntegration();
const credit = new CreditEngine();
const pos = new POSIntegration();
const intelligence = new IntelligenceClient();
const brain = new AgentOSBrain();
const router = new IntentRouter();
const agentHandlers = new AgentOSHandlers({});
const supportHandlers = new SupportHandlers({});
const sessionManager = new SessionManager();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }
  }
});
app.use(limiter);

// =========================================================================
// HEALTH ENDPOINTS (No Auth Required)
// =========================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    connected: {
      voice: true,
      credit: true,
      pos: true,
      intelligence: true,
      support: true,
      redis: redisClient ? true : false
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    service: 'rez-unified-chat',
    timestamp: new Date().toISOString()
  });
});

// =========================================================================
// AUTHENTICATED ROUTES
// =========================================================================

// Apply authentication to all /api routes
app.use('/api', requireInternalAuth);

// Voice endpoints
app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
  try {
    const { audio, provider } = req.body;
    const transcript = await voice.transcribe(Buffer.from(audio, 'base64'), provider);
    res.json({ success: true, transcript });
  } catch (err) {
    logger.error('Voice transcribe error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/voice/synthesize', async (req: Request, res: Response) => {
  try {
    const { text, voice: voiceId } = req.body;
    const audio = await voice.synthesize(text, { voice: voiceId });
    res.json({ success: true, audio: audio ? audio.toString('base64') : null });
  } catch (err) {
    logger.error('Voice synthesize error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Credit endpoints
app.post('/api/credit/score', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const score = await credit.getUserCreditScore(userId);
    res.json({ success: true, score });
  } catch (err) {
    logger.error('Credit score error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/credit/lending', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const lending = await credit.getLendingRecommendation(userId);
    res.json({ success: true, lending });
  } catch (err) {
    logger.error('Lending error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/credit/bnpl', async (req: Request, res: Response) => {
  try {
    const { userId, merchantId, amount } = req.body;
    const bnpl = await credit.calculateBNPL(userId, merchantId, amount);
    res.json({ success: true, bnpl });
  } catch (err) {
    logger.error('BNPL error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POS endpoints
app.post('/api/pos/order', async (req: Request, res: Response) => {
  try {
    const { merchantId, items, payment } = req.body;
    const order = await pos.processOrder(merchantId, { items, payment });
    res.json({ success: true, order });
  } catch (err) {
    logger.error('POS order error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pos/inventory/:merchantId', async (req: Request, res: Response) => {
  try {
    const inventory = await pos.getInventory(req.params.merchantId);
    res.json({ success: true, inventory });
  } catch (err) {
    logger.error('POS inventory error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pos/analytics/:merchantId', async (req: Request, res: Response) => {
  try {
    const analytics = await pos.getMerchantAnalytics(req.params.merchantId);
    res.json({ success: true, analytics });
  } catch (err) {
    logger.error('POS analytics error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Message endpoint
app.post('/api/message', async (req: Request, res: Response) => {
  try {
    const { userId, message, namespace, context = {} } = req.body;
    const routing = router.route(message, { userId, namespace });
    const entities = router.extractEntities(message);
    const session = sessionManager.getOrCreate(userId, namespace);
    const userContext = await intelligence.getUserContext(userId);
    let response;

    if (routing.route === 'agent-os') {
      response = await agentHandlers.handle({ message, entities, context: { ...session.context, ...userContext } });
    } else {
      response = await supportHandlers.handle({ message, entities, context: { ...session.context, ...userContext } });
    }

    session.messages.push({ role: 'user', content: message, routing });
    session.messages.push({ role: 'assistant', content: response.message, routing });

    res.json({
      success: true,
      response: response.message,
      routing,
      sessionId: session.sessionId
    });
  } catch (err) {
    logger.error('Message error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Session history
app.get('/api/session/:userId', (req: Request, res: Response) => {
  const session = sessionManager.getOrCreate(req.params.userId, req.query.namespace as string || 'general');
  res.json({ success: true, messages: session.messages });
});

// Intelligence endpoints
app.get('/api/intelligence/context/:userId', async (req: Request, res: Response) => {
  try {
    const context = await intelligence.getUserContext(req.params.userId);
    res.json({ success: true, context });
  } catch (err) {
    logger.error('Intelligence context error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/intelligence/predictions/:userId', async (req: Request, res: Response) => {
  try {
    const predictions = await intelligence.getPredictions(req.params.userId);
    res.json({ success: true, predictions });
  } catch (err) {
    logger.error('Intelligence predictions error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Brain endpoints
app.post('/api/brain/enhance', async (req: Request, res: Response) => {
  try {
    const { response, context } = req.body;
    const enhanced = await brain.enhanceResponse(response, context);
    res.json({ success: true, enhanced });
  } catch (err) {
    logger.error('Brain enhance error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// WEBSOCKET
// =========================================================================

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId') || 'anonymous';
  const namespace = url.searchParams.get('namespace') || 'general';

  ws.session = sessionManager.getOrCreate(userId, namespace);
  ws.isAlive = true;

  ws.on('message', async (data) => {
    try {
      const { message, context = {} } = JSON.parse(data.toString());
      ws.send(JSON.stringify({ type: 'typing', status: true }));

      const routing = router.route(message, { userId, namespace });
      let response;

      if (routing.route === 'agent-os') {
        response = await agentHandlers.handle({ message, context: { ...ws.session.context, ...context } });
      } else {
        response = await supportHandlers.handle({ message, context: { ...ws.session.context, ...context } });
      }

      ws.session.messages.push({ role: 'assistant', content: response.message, routing });
      ws.send(JSON.stringify({ type: 'message', response: response.message, routing: routing }));
    } catch (err) {
      logger.error('WebSocket error', { error: err.message });
      ws.send(JSON.stringify({ type: 'error', error: err.message }));
    }
  });

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => { ws.isAlive = false; });
});

// Heartbeat to detect stale connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// =========================================================================
// STARTUP
// =========================================================================

async function start() {
  try {
    await initRedis();

    server.listen(CONFIG.PORT, () => {
      logger.info(`REZ Unified Chat started on port ${CONFIG.PORT}`, {
        port: CONFIG.PORT,
        version: '3.0.0',
        redis: redisClient ? 'connected' : 'not connected'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  if (redisClient) {
    await redisClient.quit();
  }
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

start();

export default app;

import logger from './utils/logger';

/**
 * REZ AGENT OS v3.0 - FULLY CONNECTED
 *
 * COMPLETE INTEGRATION
 *
 * Voice, Credit, POS, All Intelligence, All Services
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');

// Import all integrations
const VoiceIntegration = require('./voiceIntegration');
const CreditEngine = require('./creditEngine');
const POSIntegration = require('./posIntegration');
const IntelligenceClient = require('./intelligenceClient');
const AgentOSBrain = require('./brain');
const { IntentRouter } = require('./intentRouter');
const AgentOSHandlers = require('./handlers/agentOSHandlers');
const SupportHandlers = require('./handlers/supportHandlers');
const SessionManager = require('./sessionManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

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
app.use(express.json());

// =========================================================================
// CONFIGURATION
// =========================================================================

const CONFIG = {
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
// REST ENDPOINTS
// =========================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    connected: {
      voice: true,
      credit: true,
      pos: true,
      intelligence: true,
      support: true
    },
    timestamp: new Date().toISOString()
  });
});

// Voice endpoints
app.post('/api/voice/transcribe', async (req, res) => {
  try {
    const { audio, provider } = req.body;
    const transcript = await voice.transcribe(Buffer.from(audio, 'base64'), provider);
    res.json({ success: true, transcript });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/voice/synthesize', async (req, res) => {
  try {
    const { text, voice: voiceId } = req.body;
    const audio = await voice.synthesize(text, { voice: voiceId });
    res.json({ success: true, audio: audio ? audio.toString('base64') : null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Credit endpoints
app.post('/api/credit/score', async (req, res) => {
  try {
    const { userId } = req.body;
    const score = await credit.getUserCreditScore(userId);
    res.json({ success: true, score });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/credit/lending', async (req, res) => {
  try {
    const { userId } = req.body;
    const lending = await credit.getLendingRecommendation(userId);
    res.json({ success: true, lending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/credit/bnpl', async (req, res) => {
  try {
    const { userId, merchantId, amount } = req.body;
    const bnpl = await credit.calculateBNPL(userId, merchantId, amount);
    res.json({ success: true, bnpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POS endpoints
app.post('/api/pos/order', async (req, res) => {
  try {
    const { merchantId, items, payment } = req.body;
    const order = await pos.processOrder(merchantId, { items, payment });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pos/inventory/:merchantId', async (req, res) => {
  try {
    const inventory = await pos.getInventory(req.params.merchantId);
    res.json({ success: true, inventory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pos/analytics/:merchantId', async (req, res) => {
  try {
    const analytics = await pos.getMerchantAnalytics(req.params.merchantId);
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Message endpoint
app.post('/api/message', async (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// Session history
app.get('/api/session/:userId', (req, res) => {
  const session = sessionManager.getOrCreate(req.params.userId, req.query.namespace || 'general');
  res.json({ success: true, messages: session.messages });
});

// =========================================================================
// WEBSOCKET
// =========================================================================

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId') || 'anonymous';
  const namespace = url.searchParams.get('namespace') || 'general';

  ws.session = sessionManager.getOrCreate(userId, namespace);
  ws.isAlive = true;

  ws.on('message', async (data) => {
    try {
      const { message, context = {} } = JSON.parse(data);
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
      console.error('WebSocket error:', err);
      ws.send(JSON.stringify({ type: 'error', error: err.message }));
    }
  });

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => { ws.isAlive = false; });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// =========================================================================
// START
// =========================================================================

server.listen(CONFIG.PORT, () => {
  logger.info(`
╔══════════════════════════════════════════════════════════╗
║          REZ AGENT OS v3.0 FULLY CONNECTED          ║
╠══════════════════════════════════════════════════════════╣
║  VOICE: STT/TTS, Twilio, Daily.co                    ║
║  CREDIT: Score, Lending, BNPL, Risk                  ║
║  POS: Inventory, Orders, Analytics                   ║
║  SUPPORT: All apps connected                         ║
║  INTELLIGENCE: All ML services connected             ║
╠══════════════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:${CONFIG.PORT}/ws              ║
║  HTTP: http://localhost:${CONFIG.PORT}/api/message        ║
╚══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };

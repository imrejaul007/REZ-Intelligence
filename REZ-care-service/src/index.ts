/**
 * REZ Care Service v3.3
 * Complete Support Operating System
 *
 * INTEGRATES with:
 * - REZ-support-copilot (4033) - Sentiment, history, AI suggestions
 * - REZ-merchant-intelligence (4122) - Merchant insights
 * - rez-knowledge-base-service (4005) - KB search
 * - RABTUL Services (Auth, Wallet, Payment, Notifications)
 * - REZ Intelligence (Intent, Predictive, Signals)
 *
 * UNIQUE VALUE:
 * - CSAT surveys & tracking
 * - Proactive issue detection
 * - Self-service recovery
 * - Auto-ticket creation
 * - Merchant communication
 * - Cross-platform issue memory
 * - Agent management & routing
 * - Escalation engine
 * - WhatsApp support
 * - Reports & analytics
 * - Subscription billing (Razorpay)
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import cron from 'node-cron';

import { CSATService } from './services/csatService';
import { ProactiveDetectionService } from './services/proactiveDetectionService';
import { SelfServiceService } from './services/selfServiceService';
import { AutoTicketService } from './services/autoTicketService';
import { SupportMetricsService } from './services/supportMetricsService';
import { MerchantCommunicationService } from './services/merchantCommunicationService';
import { CrossPlatformIssueMemory } from './services/crossPlatformIssueMemory';
import { AgentManagementService } from './services/agentManagementService';
import { WhatsAppSupportService } from './services/whatsappSupportService';
import { EscalationEngine } from './services/escalationEngine';
import { ReportsService } from './services/reportsService';
import { initWebSocketServer, getWebSocketServer } from './services/websocketServer';
import { logger } from './utils/logger';
import * as integrations from './services/serviceIntegrations';
import { checkAllServicesHealth } from './integrations/ecosystemServices';
import selfServiceRoutes from './routes/selfServiceRoutes';
import mobileRoutes from './routes/mobileRoutes';
import supportRoutes from './routes/supportRoutes';
import emailRoutes from './routes/emailRoutes';
import clientRoutes from './routes/clientRoutes';
import merchantRoutes from './routes/merchantRoutes';
import upsellRoutes from './routes/upsellRoutes';
import smartUpsellRoutes from './routes/smartUpsellRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import ecosystemRoutes from './routes/ecosystemRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import { subscriptionService } from './services/subscriptionService';

// Middleware imports
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimits } from './middleware/rateLimit';
import { initializeRABTULCircuitBreakers, circuitBreakerRegistry } from './utils/circuitBreaker';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4058;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';

// ============================================
// CORS CONFIGURATION (Fixed for production)
// ============================================

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://rez-care.onrender.com',
      'https://rez-admin.onrender.com',
    ];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Internal-Token',
    'X-Customer-Id',
    'X-Customer-Phone',
    'x-razorpay-signature',
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Rate limiting - apply to all routes (skip internal/health)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path.startsWith('/api/services')) {
    return next();
  }
  if (req.headers['x-internal-token']) {
    return rateLimits.internal(req, res, next);
  }
  return rateLimits.api(req, res, next);
});

// Initialize RABTUL circuit breakers
initializeRABTULCircuitBreakers();

// Initialize all services
const csatService = new CSATService();
const proactiveDetectionService = new ProactiveDetectionService();
const selfServiceService = new SelfServiceService();
const autoTicketService = new AutoTicketService();
const metricsService = new SupportMetricsService();
const merchantCommService = new MerchantCommunicationService();
const crossPlatformMemory = new CrossPlatformIssueMemory();
const agentService = new AgentManagementService();
const whatsappService = new WhatsAppSupportService();
const escalationEngine = new EscalationEngine();
const reportsService = new ReportsService();

// Health check
app.get('/health', (req: Request, res: Response) => {
  // Include circuit breaker stats
  const circuitStats = circuitBreakerRegistry.getAllStats();
  const hasOpenCircuits = circuitBreakerRegistry.hasOpenCircuits();

  res.json({
    status: 'healthy',
    service: 'REZ Care Service',
    version: '3.3.0',
    uptime: process.uptime(),
    description: 'AI Commerce Recovery & Customer Intelligence Platform',
    circuitBreakers: circuitStats.map(s => ({
      name: s.name,
      state: s.state,
      uptime: `${s.uptime.toFixed(1)}%`,
    })),
    hasDegradedServices: hasOpenCircuits,
    integrates: [
      'REZ-support-copilot (sentiment, history)',
      'REZ-merchant-intelligence (insights)',
      'REZ-memory-layer (timeline)',
      'REZ-unified-profile (Customer 360)',
      'REZ-workflow-builder (automation)',
      'Vector Search (RAG/Knowledge)'
    ],
    unique_features: [
      'csat-surveys',
      'proactive-detection',
      'self-service',
      'auto-tickets',
      'merchant-communication',
      'cross-platform-memory',
      'agent-management',
      'whatsapp-support',
      'escalation-engine',
      'reports-analytics',
      'customer-timeline',
      'unified-profile',
      'workflow-automation',
      'rag-knowledge',
      'subscription-billing',
      'multi-tenant-saas'
    ],
    ecosystem: '/api/ecosystem/health'
  });
});

// ============================================
// INTEGRATION ENDPOINTS (Uses existing services)
// ============================================

// Get unified customer view (aggregates all services)
app.get('/api/unified/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const unified = await integrations.getUnifiedCustomerView(customerId);
    res.json({ success: true, data: unified });
  } catch (error) {
    logger.error('Failed to get unified view', error);
    res.status(500).json({ error: 'Failed to get unified view' });
  }
});

// Get support history from REZ-support-copilot
app.get('/api/support/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const history = await integrations.getSupportHistory(userId);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Failed to get support history', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get AI suggestions from REZ-support-copilot
app.get('/api/support/suggestions/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const suggestions = await integrations.getTicketSuggestions(ticketId);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('Failed to get suggestions', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Get sentiment from REZ-support-copilot
app.post('/api/sentiment/analyze', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const analysis = await integrations.getSentimentAnalysis(text);
    res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Failed to analyze sentiment', error);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

// Get merchant dashboard from REZ-merchant-intelligence
app.get('/api/merchant/dashboard/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const dashboard = await integrations.getMerchantDashboard(merchantId);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    logger.error('Failed to get merchant dashboard', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// Get merchant recommendations
app.get('/api/merchant/recommendations/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const recommendations = await integrations.getMerchantRecommendations(merchantId);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    logger.error('Failed to get recommendations', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Search KB from rez-knowledge-base-service
app.get('/api/kb/search', async (req: Request, res: Response) => {
  try {
    const { q, category, limit } = req.query;
    const results = await integrations.searchKnowledgeBase(q as string, {
      category: category as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to search KB', error);
    res.status(500).json({ error: 'Failed to search KB' });
  }
});

// Service health check
app.get('/api/services/health', async (req: Request, res: Response) => {
  try {
    const health = await integrations.checkServiceHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    logger.error('Failed to check service health', error);
    res.status(500).json({ error: 'Failed to check health' });
  }
});

// ============================================
// CSAT ENDPOINTS (Unique to REZ Care)
// ============================================

app.post('/api/csat/respond', async (req: Request, res: Response) => {
  try {
    const result = await csatService.submitResponse(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to submit CSAT', error);
    res.status(500).json({ error: 'Failed to submit CSAT' });
  }
});

app.get('/api/csat/metrics', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    const metrics = await csatService.getMetrics({
      start: start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    });
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to get CSAT metrics', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

app.post('/api/csat/send', async (req: Request, res: Response) => {
  try {
    const result = await csatService.sendSurvey(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to send CSAT', error);
    res.status(500).json({ error: 'Failed to send CSAT' });
  }
});

// ============================================
// PROACTIVE DETECTION ENDPOINTS (Unique to REZ Care)
// ============================================

app.get('/api/alerts/active', async (req: Request, res: Response) => {
  try {
    const { type, severity } = req.query;
    const alerts = await proactiveDetectionService.getActiveAlerts({
      type: type as string,
      severity: severity as string
    });
    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Failed to get alerts', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

app.post('/api/alerts', async (req: Request, res: Response) => {
  try {
    const alert = await proactiveDetectionService.createAlert(req.body);
    res.json({ success: true, data: alert });
  } catch (error) {
    logger.error('Failed to create alert', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// ============================================
// SELF-SERVICE ENDPOINTS (Unique to REZ Care)
// ============================================

app.get('/api/self-service/:customerId/actions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const actions = await selfServiceService.getAvailableActions(customerId);
    res.json({ success: true, data: actions });
  } catch (error) {
    logger.error('Failed to get actions', error);
    res.status(500).json({ error: 'Failed to get actions' });
  }
});

app.post('/api/self-service/execute', async (req: Request, res: Response) => {
  try {
    const { customerId, actionType, actionData } = req.body;
    if (!customerId || !actionType) {
      return res.status(400).json({ error: 'customerId and actionType required' });
    }
    const result = await selfServiceService.executeAction(customerId, actionType, actionData || {});
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to execute', error);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

app.post('/api/self-service/cashback-retry', async (req: Request, res: Response) => {
  try {
    const { customerId, transactionId } = req.body;
    const result = await selfServiceService.retryCashback(customerId, transactionId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to retry cashback', error);
    res.status(500).json({ error: 'Failed to retry cashback' });
  }
});

app.post('/api/self-service/wallet-sync', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;
    const result = await selfServiceService.syncWallet(customerId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to sync wallet', error);
    res.status(500).json({ error: 'Failed to sync wallet' });
  }
});

// ============================================
// AUTO-TICKET ENDPOINTS (Unique to REZ Care)
// ============================================

app.get('/api/auto-tickets', async (req: Request, res: Response) => {
  try {
    const { status, severity, limit } = req.query;
    const tickets = await autoTicketService.getTickets({
      status: status as string,
      severity: severity as string,
      limit: limit ? parseInt(limit as string) : 50
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    logger.error('Failed to get tickets', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

app.post('/api/auto-tickets', async (req: Request, res: Response) => {
  try {
    const ticket = await autoTicketService.createTicket(req.body);
    res.json({ success: true, data: ticket });
  } catch (error) {
    logger.error('Failed to create ticket', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

app.post('/api/auto-tickets/:ticketId/resolve', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { resolution, resolvedBy } = req.body;
    const ticket = await autoTicketService.resolveTicket(ticketId, resolution, resolvedBy);
    res.json({ success: true, data: ticket });
  } catch (error) {
    logger.error('Failed to resolve ticket', error);
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

// ============================================
// MERCHANT COMMUNICATION ENDPOINTS (Unique to REZ Care)
// ============================================

app.post('/api/merchant/communicate', async (req: Request, res: Response) => {
  try {
    const result = await merchantCommService.sendToPartner(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to send communication', error);
    res.status(500).json({ error: 'Failed to send communication' });
  }
});

app.post('/api/merchant/respond', async (req: Request, res: Response) => {
  try {
    const result = await merchantCommService.receiveResponse(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to receive response', error);
    res.status(500).json({ error: 'Failed to receive response' });
  }
});

app.get('/api/merchant/:partnerId/communications', async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { status, limit } = req.query;
    const result = await merchantCommService.getPartnerCommunications(partnerId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to get communications', error);
    res.status(500).json({ error: 'Failed to get communications' });
  }
});

app.get('/api/merchant/:partnerId/metrics', async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const result = await merchantCommService.getPartnerMetrics(partnerId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to get partner metrics', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============================================
// CROSS-PLATFORM ISSUE MEMORY ENDPOINTS (Unique to REZ Care)
// ============================================

app.post('/api/issues/record', async (req: Request, res: Response) => {
  try {
    const result = await crossPlatformMemory.recordIssue(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to record issue', error);
    res.status(500).json({ error: 'Failed to record issue' });
  }
});

app.get('/api/customers/:customerId/issue-history', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const result = await crossPlatformMemory.getCustomerIssueHistory(customerId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to get issue history', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

app.get('/api/issues/similar', async (req: Request, res: Response) => {
  try {
    const { customerId, partnerId, platform, category } = req.query;
    const result = await crossPlatformMemory.findSimilarIssues({
      customerId: customerId as string,
      partnerId: partnerId as string,
      platform: platform as string,
      category: category as string
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to find similar issues', error);
    res.status(500).json({ error: 'Failed to find similar' });
  }
});

app.get('/api/merchant/:partnerId/issue-profile', async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const result = await crossPlatformMemory.getPartnerIssueProfile(partnerId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to get issue profile', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.get('/api/issues/platform-wide', async (req: Request, res: Response) => {
  try {
    const result = await crossPlatformMemory.detectPlatformWideIssues();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to detect platform-wide', error);
    res.status(500).json({ error: 'Failed to detect' });
  }
});

app.get('/api/customers/:customerId/predict-issues', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const result = await crossPlatformMemory.predictCustomerIssues(customerId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to predict issues', error);
    res.status(500).json({ error: 'Failed to predict' });
  }
});

// ============================================
// AGENT MANAGEMENT ENDPOINTS
// ============================================

// Create agent
app.post('/api/agents', async (req: Request, res: Response) => {
  try {
    const agent = await agentService.createAgent(req.body);
    res.json({ success: true, data: agent });
  } catch (error) {
    logger.error('Failed to create agent', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Get all agents
app.get('/api/agents', async (req: Request, res: Response) => {
  try {
    const { status, role, platform, onlineOnly } = req.query;
    const agents = await agentService.getAllAgents({
      status: status as string,
      role: role as string,
      platform: platform as string,
      onlineOnly: onlineOnly === 'true'
    });
    res.json({ success: true, data: agents });
  } catch (error) {
    logger.error('Failed to get agents', error);
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

// Get agent by ID
app.get('/api/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agent = await agentService.getAgent(req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, data: agent });
  } catch (error) {
    logger.error('Failed to get agent', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// Update agent
app.patch('/api/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agent = await agentService.updateAgent(req.params.agentId, req.body);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, data: agent });
  } catch (error) {
    logger.error('Failed to update agent', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Set agent status
app.post('/api/agents/:agentId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const agent = await agentService.setStatus(req.params.agentId, status);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, data: agent });
  } catch (error) {
    logger.error('Failed to set status', error);
    res.status(500).json({ error: 'Failed to set status' });
  }
});

// Assign ticket (auto-route)
app.post('/api/agents/assign', async (req: Request, res: Response) => {
  try {
    const { ticketId, category, platform, priority, customerId } = req.body;
    const result = await agentService.assignTicket({ ticketId, category, platform, priority, customerId });
    if (!result) return res.status(503).json({ error: 'No available agents' });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to assign ticket', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// Manual assign
app.post('/api/agents/:agentId/assign', async (req: Request, res: Response) => {
  try {
    const { ticketId, assignedBy } = req.body;
    const success = await agentService.manualAssign(ticketId, req.params.agentId, assignedBy);
    res.json({ success });
  } catch (error) {
    logger.error('Failed to assign', error);
    res.status(500).json({ error: 'Failed to assign' });
  }
});

// Escalate ticket
app.post('/api/agents/:agentId/escalate', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.body;
    const escalatedTo = await agentService.escalateTicket(ticketId, req.params.agentId);
    res.json({ success: true, data: { escalatedTo } });
  } catch (error) {
    logger.error('Failed to escalate', error);
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

// Get agent performance
app.get('/api/agents/:agentId/performance', async (req: Request, res: Response) => {
  try {
    const performance = await agentService.getAgentPerformance(req.params.agentId);
    if (!performance) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, data: performance });
  } catch (error) {
    logger.error('Failed to get performance', error);
    res.status(500).json({ error: 'Failed to get performance' });
  }
});

// Get team performance
app.get('/api/agents/team/performance', async (req: Request, res: Response) => {
  try {
    const teamPerf = await agentService.getTeamPerformance();
    res.json({ success: true, data: teamPerf });
  } catch (error) {
    logger.error('Failed to get team performance', error);
    res.status(500).json({ error: 'Failed to get team performance' });
  }
});

// Update agent performance
app.post('/api/agents/:agentId/performance', async (req: Request, res: Response) => {
  try {
    await agentService.updatePerformance(req.params.agentId, req.body);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update performance', error);
    res.status(500).json({ error: 'Failed to update performance' });
  }
});

// ============================================
// METRICS ENDPOINTS
// ============================================

app.get('/api/metrics/dashboard', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    // Get metrics from all sources
    const [supportMetrics, serviceHealth] = await Promise.all([
      metricsService.getDashboardMetrics({
        start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: end ? new Date(end as string) : new Date()
      }),
      integrations.checkServiceHealth()
    ]);

    res.json({
      success: true,
      data: {
        ...supportMetrics,
        integratedServices: serviceHealth
      }
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============================================
// EVENTS (From other services)
// ============================================

app.post('/api/events', async (req: Request, res: Response) => {
  try {
    const { eventType, data } = req.body;

    switch (eventType) {
      case 'payment_failed':
        await proactiveDetectionService.handlePaymentFailure(data);
        break;
      case 'qr_scan_failed':
        await proactiveDetectionService.handleQRFailure(data);
        break;
      case 'app_error':
        await proactiveDetectionService.handleAppError(data);
        break;
      case 'complaint_received':
        await proactiveDetectionService.handleComplaint(data);
        break;
      case 'ticket_resolved':
        await csatService.triggerSurvey(data);
        break;
      case 'order_delivered':
        await proactiveDetectionService.handleOrderDelivered(data);
        break;
      case 'payout_failed':
        await proactiveDetectionService.handlePayoutFailure(data);
        break;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to process event', error);
    res.status(500).json({ error: 'Failed to process event' });
  }
});

// ============================================
// WEBSOCKET
// ============================================

app.get('/api/websocket/status', (req: Request, res: Response) => {
  const ws = getWebSocketServer();
  res.json({
    connected: !!ws,
    clients: ws?.getClientCount() || 0,
    agents: ws?.getAgentCount() || 0
  });
});

// ============================================
// MOBILE SELF-SERVICE ROUTES
// ============================================

app.use('/api/mobile', selfServiceRoutes);
app.use('/api/mobile-sdk', mobileRoutes);

// ============================================
// UNIFIED SUPPORT ROUTES
// Combines: Customer tickets, Merchant tickets, AI features
// ============================================
app.use('/api/support', supportRoutes);

// ============================================
// EMAIL SUPPORT ROUTES
// Webhooks: SendGrid, SES, Mailgun, Postmark
// ============================================
app.use('/api/email', emailRoutes);

// ============================================
// MULTI-TENANT CLIENT ROUTES
// Each merchant has their own email & branding
// ============================================
app.use('/api/clients', clientRoutes);

// ============================================
// MERCHANT PORTAL ROUTES
// Each merchant gets their own support inbox, KB, team
// ============================================
app.use('/api/merchant', merchantRoutes);

// ============================================
// UPSELL & CROSS-SELL ROUTES
// ============================================
app.use('/api/upsell', upsellRoutes);

// SMART PRODUCT UPSELL ROUTES
// ============================================
app.use('/api/smart-upsell', smartUpsellRoutes);

// ============================================
// WHATSAPP SUPPORT ROUTES (Modular)
// ============================================
app.use('/api/whatsapp', whatsappRoutes);

// ============================================
// ECOSYSTEM INTEGRATION ROUTES
// Connects to: memory-layer, unified-profile, workflow-builder, vector-search
// ============================================
app.use('/api/ecosystem', ecosystemRoutes);

// ============================================
// SUBSCRIPTION & BILLING ROUTES
// Multi-tenant SaaS: Lite/Pro/Enterprise tiers
// ============================================
app.use('/api/subscription', subscriptionRoutes);

// ============================================
// ESCALATION ROUTES
// ============================================

// Check escalations for ticket
app.post('/api/escalation/check', async (req: Request, res: Response) => {
  try {
    const result = await escalationEngine.checkEscalations(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to check escalations', error);
    res.status(500).json({ error: 'Failed to check' });
  }
});

// Create escalation rule
app.post('/api/escalation/rules', async (req: Request, res: Response) => {
  try {
    const rule = await escalationEngine.createRule(req.body);
    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Failed to create rule', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// Get escalation metrics
app.get('/api/escalation/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await escalationEngine.getMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to get escalation metrics', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Get ticket escalation history
app.get('/api/escalation/history/:ticketId', async (req: Request, res: Response) => {
  try {
    const history = await escalationEngine.getTicketHistory(req.params.ticketId);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Failed to get escalation history', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ============================================
// REPORTS ROUTES
// ============================================

// Overview dashboard
app.get('/api/reports/overview', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    const overview = await reportsService.getOverview({
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    });
    res.json({ success: true, data: overview });
  } catch (error) {
    logger.error('Failed to get overview', error);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

// CSAT trends
app.get('/api/reports/csat-trends', async (req: Request, res: Response) => {
  try {
    const { start, end, granularity } = req.query;
    const trends = await reportsService.getCSATTrends({
      start: start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date(),
      granularity: (['day', 'week', 'month'].includes(granularity as string) ? granularity : 'day') as 'day' | 'week' | 'month'
    });
    res.json({ success: true, data: trends });
  } catch (error) {
    logger.error('Failed to get CSAT trends', error);
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

// Category breakdown
app.get('/api/reports/categories', async (req: Request, res: Response) => {
  try {
    const { start, end, platform } = req.query;
    const breakdown = await reportsService.getCategoryBreakdown({
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date(),
      platform: platform as string
    });
    res.json({ success: true, data: breakdown });
  } catch (error) {
    logger.error('Failed to get categories', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Platform comparison
app.get('/api/reports/platforms', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    const comparison = await reportsService.getPlatformComparison({
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    });
    res.json({ success: true, data: comparison });
  } catch (error) {
    logger.error('Failed to get platform comparison', error);
    res.status(500).json({ error: 'Failed to get comparison' });
  }
});

// Agent leaderboard
app.get('/api/reports/leaderboard', async (req: Request, res: Response) => {
  try {
    const { start, end, limit } = req.query;
    const leaderboard = await reportsService.getAgentLeaderboard({
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date(),
      limit: limit ? parseInt(limit as string) : 10
    });
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    logger.error('Failed to get leaderboard', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Merchant issues report
app.get('/api/reports/merchants', async (req: Request, res: Response) => {
  try {
    const { start, end, sortBy, limit } = req.query;
    const report = await reportsService.getMerchantIssuesReport({
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date(),
      sortBy: (['count', 'csat', 'resolutionTime'].includes(sortBy as string) ? sortBy : undefined) as 'count' | 'csat' | 'resolutionTime' | undefined,
      limit: limit ? parseInt(limit as string) : 10
    });
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to get merchant report', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

// ============================================
// STARTUP
// ============================================

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Initialize WebSocket
    initWebSocketServer(httpServer);

    // Initialize proactive detection
    await proactiveDetectionService.initialize();

    // Initialize escalation rules
    await escalationEngine.initializeDefaultRules();
    escalationEngine.startMonitoring();

    // Initialize WhatsApp templates
    await whatsappService.initializeTemplates();

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`REZ Care Service v3.0 running on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`Mobile API: http://localhost:${PORT}/api/mobile`);
      logger.info(`WhatsApp: http://localhost:${PORT}/api/whatsapp`);
      logger.info(`Reports: http://localhost:${PORT}/api/reports`);
    });

    // Scheduled jobs
    cron.schedule('0 * * * *', () => csatService.processPendingSurveys());
    cron.schedule('*/5 * * * *', () => proactiveDetectionService.runDetectionChecks());
    cron.schedule('0 0 * * *', () => metricsService.generateDailyReport());
    cron.schedule('0 1 * * *', () => autoTicketService.expireOldTickets());

  } catch (error) {
    logger.error('Failed to start', error);
    process.exit(1);
  }
}

start();

// Error handlers (after routes)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

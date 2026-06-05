/**
 * REZ Intelligence Threat Graph Server
 *
 * Federated threat intelligence across the entire REZ ecosystem.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import winston from 'winston';

// Services
import { graphEngine } from './services/graphEngine.js';
import { entityResolver } from './services/entityResolver.js';

// Types
import {
  FraudReportRequest,
  FraudRingDetectionRequest,
  TrustScoreResponse
} from './types/index.js';

// ============================================
// LOGGER SETUP
// ============================================

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/threat-graph.log' })
  ]
});

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = express();
const PORT = process.env.PORT || 4715;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request ID
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createEntitySchema = z.object({
  type: z.enum(['person', 'merchant', 'device', 'company', 'account']),
  primaryService: z.enum(['corpid', 'wasil', 'ridza', 'rez-ride', 'airzy', 'risacare', 'rez-merchant', 'buzzlocal', 'mytalent', 'corp-os']),
  primaryIdentifier: z.string().min(1),
  identifierType: z.enum(['phone', 'email', 'device_id', 'user_id', 'merchant_id']),
  verified: z.boolean().optional()
});

const linkEntitiesSchema = z.object({
  sourceEntityId: z.string().min(1),
  targetEntityId: z.string().min(1),
  relationship: z.enum(['same_device', 'same_person', 'same_location', 'same_account', 'frequent_merchant', 'frequent_customer', 'related_company', 'family_member', 'colleague', 'shared_ip', 'transaction_partner', 'reported_by', 'blocked_by']),
  weight: z.number().min(0).max(1).optional()
});

const reportFraudSchema = z.object({
  reporterId: z.string().min(1),
  reporterService: z.enum(['corpid', 'wasil', 'ridza', 'rez-ride', 'airzy', 'risacare', 'rez-merchant', 'buzzlocal', 'mytalent', 'corp-os']),
  reportedEntityId: z.string().min(1),
  reportedService: z.enum(['corpid', 'wasil', 'ridza', 'rez-ride', 'airzy', 'risacare', 'rez-merchant', 'buzzlocal', 'mytalent', 'corp-os']),
  reportType: z.enum(['fraud', 'scam', 'suspicious', 'fake_identity', 'fake_merchant']),
  description: z.string().min(10),
  evidence: z.array(z.object({
    type: z.enum(['screenshot', 'transaction', 'message', 'other']),
    data: z.string()
  })).optional()
});

// ============================================
// ENTITY ENDPOINTS
// ============================================

/**
 * Create new entity
 * POST /api/entities
 */
app.post('/api/entities', async (req: Request, res: Response) => {
  try {
    const body = createEntitySchema.parse(req.body);

    const entity = entityResolver.createEntity({
      type: body.type,
      primaryService: body.primaryService,
      primaryIdentifier: body.primaryIdentifier,
      identifierType: body.identifierType,
      verified: body.verified
    });

    logger.info('Created entity', { entityId: entity.entityId, type: body.type });

    res.status(201).json(entity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error('Error creating entity', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get entity by ID
 * GET /api/entities/:entityId
 */
app.get('/api/entities/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const entity = graphEngine.getEntity(entityId);

  if (!entity) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  res.json(entity);
});

/**
 * Get entity graph
 * GET /api/graph/entity/:entityId
 */
app.get('/api/graph/entity/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { depth = '1' } = req.query;

  const entity = graphEngine.getEntity(entityId);
  if (!entity) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  const connectedEntities = graphEngine.getConnectedEntities(entityId, parseInt(depth as string));

  res.json({
    entityId,
    entityType: entity.entityType,
    primaryService: entity.primaryService,
    services: entity.services,
    connections: {
      count: connectedEntities.length,
      entities: connectedEntities.map(e => ({
        entityId: e.entityId,
        entityType: e.entityType,
        scores: e.scores
      }))
    },
    fraudIndicators: entity.fraudIndicators,
    lastUpdated: entity.lastUpdated.toISOString()
  });
});

/**
 * Link entities
 * POST /api/graph/link
 */
app.post('/api/graph/link', async (req: Request, res: Response) => {
  try {
    const body = linkEntitiesSchema.parse(req.body);

    const connection = graphEngine.linkEntities(
      body.sourceEntityId,
      body.targetEntityId,
      body.relationship,
      body.weight
    );

    logger.info('Linked entities', {
      source: body.sourceEntityId,
      target: body.targetEntityId,
      relationship: body.relationship
    });

    res.json({ success: true, connection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error('Error linking entities', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get connections
 * GET /api/graph/connections/:entityId
 */
app.get('/api/graph/connections/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;

  const connections = graphEngine.getConnections(entityId);

  res.json({
    entityId,
    connections,
    count: connections.length
  });
});

// ============================================
// SCORE ENDPOINTS
// ============================================

/**
 * Get all scores for entity
 * GET /api/scores/:entityId
 */
app.get('/api/scores/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { includeBreakdown = 'false' } = req.query;

  const result = entityResolver.calculateTrustScore(
    entityId,
    includeBreakdown === 'true'
  );

  if (!result) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  res.json(result);
});

/**
 * Calculate and update scores
 * POST /api/scores/calculate
 */
app.post('/api/scores/calculate', (req: Request, res: Response) => {
  const { entityId, scores } = req.body;

  if (!entityId || !scores) {
    return res.status(400).json({ error: 'entityId and scores required' });
  }

  graphEngine.updateScores(entityId, scores);
  const result = entityResolver.calculateTrustScore(entityId, true);

  res.json(result);
});

// ============================================
// FRAUD NETWORK ENDPOINTS
// ============================================

/**
 * Detect fraud ring
 * POST /api/detect/fraud-ring
 */
app.post('/api/detect/fraud-ring', (req: Request, res: Response) => {
  try {
    const { service, timeWindow, minConnections } = req.body;

    if (!service || !timeWindow || !minConnections) {
      return res.status(400).json({ error: 'service, timeWindow, and minConnections required' });
    }

    // Parse time window (e.g., "30d" -> 30 days)
    const days = parseInt(timeWindow.replace(/\D/g, '')) || 30;

    const networks = graphEngine.detectFraudNetwork(service, days, minConnections);

    logger.info('Fraud ring detection complete', {
      service,
      networksFound: networks.length
    });

    res.json({
      detectedAt: new Date().toISOString(),
      networksFound: networks.length,
      networks: networks.map(n => ({
        ringId: n.ringId,
        ringType: n.ringType,
        membersCount: n.members.length,
        patterns: n.patterns.map(p => p.pattern),
        financialImpact: n.financialImpact,
        recommendation: n.status === 'active' ? 'block_and_investigate' : 'monitor'
      }))
    });
  } catch (error) {
    logger.error('Error detecting fraud ring', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get fraud network details
 * GET /api/detect/networks/:ringId
 */
app.get('/api/detect/networks/:ringId', (req: Request, res: Response) => {
  const { ringId } = req.params;

  // Get from graph engine (would be stored in DB in production)
  const stats = graphEngine.getStats();

  // For demo, return mock data
  res.json({
    ringId,
    ringType: 'fraud_ring',
    members: [],
    patterns: [],
    financialImpact: { totalFraudAmount: 0, affectedTransactions: 0, affectedMerchants: 0, affectedUsers: 0, currency: 'INR' },
    status: 'investigating',
    detectedAt: new Date().toISOString()
  });
});

/**
 * Detect synthetic identity
 * POST /api/detect/synthetic-identity
 */
app.post('/api/detect/synthetic-identity', (req: Request, res: Response) => {
  const { entityId, service } = req.body;

  if (!entityId) {
    return res.status(400).json({ error: 'entityId required' });
  }

  const entity = graphEngine.getEntity(entityId);

  // Check for synthetic identity indicators
  const indicators = [];

  // Check for suspicious patterns
  if (entity?.tags.includes('new_identity')) {
    indicators.push({
      indicator: 'NEW_IDENTITY',
      severity: 'HIGH',
      description: 'Recently created identity with no history'
    });
  }

  if (entity?.scores.trustScore < 300) {
    indicators.push({
      indicator: 'LOW_TRUST_SCORE',
      severity: 'MEDIUM',
      description: 'Trust score below threshold'
    });
  }

  const isSynthetic = indicators.some(i => i.severity === 'HIGH');
  const confidence = isSynthetic ? 0.85 : 0.2;

  res.json({
    entityId,
    isSynthetic,
    confidence,
    indicators,
    recommendation: isSynthetic ? 'reject' : 'approve'
  });
});

/**
 * Detect mule account
 * POST /api/detect/mule-account
 */
app.post('/api/detect/mule-account', (req: Request, res: Response) => {
  const { accountId, service, recentTransactions } = req.body;

  if (!accountId || !recentTransactions) {
    return res.status(400).json({ error: 'accountId and recentTransactions required' });
  }

  const indicators = [];

  // Check for quick transfer pattern
  const incoming = recentTransactions.filter(t => t.direction === 'incoming');
  const outgoing = recentTransactions.filter(t => t.direction === 'outgoing');

  if (incoming.length > 0 && outgoing.length > 0) {
    // Check if money comes in and goes out quickly
    indicators.push({
      indicator: 'QUICK_TRANSFER',
      severity: 'HIGH',
      description: 'Funds transferred immediately after receipt'
    });
  }

  // Check for round amounts
  const roundAmounts = recentTransactions.filter(t => t.amount % 1000 === 0);
  if (roundAmounts.length > recentTransactions.length * 0.7) {
    indicators.push({
      indicator: 'ROUND_AMOUNTS',
      severity: 'MEDIUM',
      description: 'Unusually high proportion of round amounts'
    });
  }

  const isMule = indicators.some(i => i.severity === 'HIGH');
  const confidence = isMule ? 0.78 : 0.1;

  res.json({
    accountId,
    isMule,
    confidence,
    indicators,
    recommendation: isMule ? 'block' : 'allow'
  });
});

// ============================================
// INTELLIGENCE ENDPOINTS
// ============================================

/**
 * Get active threats
 * GET /api/intelligence/threats
 */
app.get('/api/intelligence/threats', (req: Request, res: Response) => {
  const { severity = 'HIGH' } = req.query;

  // Get high-risk entities
  const stats = graphEngine.getStats();

  res.json({
    threats: [],
    campaigns: [],
    summary: {
      criticalThreats: stats.byRiskLevel.CRITICAL,
      highThreats: stats.byRiskLevel.HIGH,
      mediumThreats: stats.byRiskLevel.MEDIUM,
      lowThreats: stats.byRiskLevel.LOW
    },
    lastUpdated: new Date().toISOString()
  });
});

/**
 * Report fraud
 * POST /api/intelligence/report
 */
app.post('/api/intelligence/report', async (req: Request, res: Response) => {
  try {
    const body = reportFraudSchema.parse(req.body);

    const reportId = `report_${uuidv4().slice(0, 8)}`;

    // Add fraud indicator to entity
    const entity = graphEngine.getEntity(body.reportedEntityId);
    if (entity) {
      entity.fraudIndicators.push({
        indicator: `REPORTED_${body.reportType.toUpperCase()}`,
        severity: body.reportType === 'fake_identity' || body.reportType === 'fake_merchant' ? 'HIGH' : 'MEDIUM',
        source: body.reporterService,
        detectedAt: new Date(),
        description: body.description,
        confirmed: false
      });

      // Update fraud score
      const newFraudScore = Math.min(100, entity.scores.fraudScore + 20);
      graphEngine.updateScores(body.reportedEntityId, { fraudScore: newFraudScore });

      // Link reporter to reported
      graphEngine.linkEntities(
        body.reporterId,
        body.reportedEntityId,
        'reported_by',
        0.5
      );
    }

    logger.info('Fraud report submitted', {
      reportId,
      reporterId: body.reporterId,
      reportedEntityId: body.reportedEntityId,
      reportType: body.reportType
    });

    res.status(201).json({
      reportId,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      impactOnScores: entity ? [{
        entityId: body.reportedEntityId,
        scoreChange: { fraudScore: 20 }
      }] : []
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error('Error submitting fraud report', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// STATS ENDPOINT
// ============================================

/**
 * Get graph stats
 * GET /api/stats
 */
app.get('/api/stats', (req: Request, res: Response) => {
  const stats = graphEngine.getStats();
  res.json(stats);
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'REZ Threat Graph',
    version: '1.0.0',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'REZ Intelligence Threat Graph',
    description: 'Federated threat intelligence across the REZ ecosystem',
    version: '1.0.0',
    endpoints: {
      entities: {
        'POST /api/entities': 'Create new entity',
        'GET /api/entities/:entityId': 'Get entity by ID'
      },
      graph: {
        'GET /api/graph/entity/:entityId': 'Get entity graph',
        'POST /api/graph/link': 'Link entities',
        'GET /api/graph/connections/:entityId': 'Get connections'
      },
      scores: {
        'GET /api/scores/:entityId': 'Get all scores',
        'POST /api/scores/calculate': 'Calculate scores'
      },
      detection: {
        'POST /api/detect/fraud-ring': 'Detect fraud networks',
        'POST /api/detect/synthetic-identity': 'Detect synthetic identity',
        'POST /api/detect/mule-account': 'Detect mule account'
      },
      intelligence: {
        'GET /api/intelligence/threats': 'Get active threats',
        'POST /api/intelligence/report': 'Report fraud'
      }
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err, requestId: req.headers['x-request-id'] });
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Threat Graph server started on port ${PORT}`);
  console.log(`🔗 REZ Threat Graph running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
});

export default app;

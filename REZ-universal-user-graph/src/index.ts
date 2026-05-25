import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { UserGraph } from './userGraph.js';
import { IdentityResolver } from './identityResolver.js';
import { careerGraphService } from './services/careerGraph.js';
import careerRoutes from './api/routes/career.js';
import { asyncHandler } from './errors.js';
import { logger } from './logger.js';
import {
  validateUniversalUserSchema,
  validateUserLinkSchema,
  validateIdentityQuerySchema,
  UniversalUser,
  AppLink,
  IdentityQuery,
  Profile,
  Behavioral,
  Lifetime,
} from './types.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize services
const userGraph = new UserGraph();
const identityResolver = new IdentityResolver(userGraph);

// Initialize Career Graph service
userGraph.connect().then(() => {
  if (userGraph.db) {
    careerGraphService.setDatabase(userGraph.db);
    if ((userGraph as unknown).redis) {
      careerGraphService.setRedis((userGraph as unknown).redis);
    }
    careerGraphService.createIndexes();
    logger.info('Career Graph service initialized');
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'universal-user-graph', timestamp: new Date().toISOString() });
});

// Internal authentication middleware
const authenticateInternal = (req: Request, res: Response, next: express.NextFunction): void => {
  const token = req.headers['x-internal-token'];
  const validTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');

  if (!token || !Object.values(validTokens).includes(token as string)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as Request & { callingService?: string }).callingService = Object.keys(validTokens).find(key => validTokens[key] === token);
  next();
};

// ============ USER GRAPH ENDPOINTS ============

// Get universal user by ID
app.get('/api/v1/users/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await userGraph.getUser(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found', userId });
  }

  res.json({ success: true, data: user });
}));

// Get universal user by identifier (phone/email)
app.get('/api/v1/users/lookup/:type/:value', asyncHandler(async (req: Request, res: Response) => {
  const { type, value } = req.params;

  if (!['phone', 'email'].includes(type)) {
    return res.status(400).json({ error: 'Invalid identifier type. Use "phone" or "email"' });
  }

  const user = await identityResolver.resolveByIdentifier(type, value);

  if (!user) {
    return res.status(404).json({ error: 'User not found', identifier: { type, value } });
  }

  res.json({ success: true, data: user });
}));

// Search users with filters
app.post('/api/v1/users/search', asyncHandler(async (req: Request, res: Response) => {
  const { query, filters, pagination } = req.body;
  const results = await userGraph.searchUsers(query, filters || {}, pagination || {});
  res.json({ success: true, ...results });
}));

// Create or update universal user
app.post('/api/v1/users', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  try {
    const validated = validateUniversalUserSchema(req.body);
    const user = await userGraph.upsertUser(validated);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if ((error as Error).name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: (error as Error).message });
    }
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', message: (error as Error).message });
  }
}));

// Update user profile
app.patch('/api/v1/users/:userId/profile', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const profile = req.body as Partial<Profile>;
  const user = await userGraph.updateProfile(userId, profile);

  if (!user) {
    return res.status(404).json({ error: 'User not found', userId });
  }

  res.json({ success: true, data: user });
}));

// ============ IDENTITY LINKING ENDPOINTS ============

// Link app identity to universal user
app.post('/api/v1/users/:userId/links', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const validated = validateUserLinkSchema(req.body);
    const user = await userGraph.linkAppIdentity(userId, validated);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    const err = error as Error & { code?: string; details?: Record<string, unknown> };
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.message });
    }
    if (err.code === 'DUPLICATE_LINK') {
      return res.status(409).json({ error: 'Identity already linked', details: err.details });
    }
    logger.error('Error linking identity:', error);
    res.status(500).json({ error: 'Failed to link identity', message: err.message });
  }
}));

// Unlink app identity
app.delete('/api/v1/users/:userId/links/:appId/:appUserId', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  const { userId, appId, appUserId } = req.params;
  const user = await userGraph.unlinkAppIdentity(userId, appId, appUserId);

  if (!user) {
    return res.status(404).json({ error: 'User not found', userId });
  }

  res.json({ success: true, data: user });
}));

// Get all linked identities for a user
app.get('/api/v1/users/:userId/links', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const links = await userGraph.getLinkedIdentities(userId);
  res.json({ success: true, data: links });
}));

// ============ IDENTITY RESOLUTION ENDPOINTS ============

// Resolve identity with confidence
app.post('/api/v1/identity/resolve', asyncHandler(async (req: Request, res: Response) => {
  try {
    const validated = validateIdentityQuerySchema(req.body);
    const result = await identityResolver.resolve(validated);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error resolving identity:', error);
    res.status(500).json({ error: 'Failed to resolve identity', message: (error as Error).message });
  }
}));

// Merge two users
app.post('/api/v1/identity/merge', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  const { sourceUserId, targetUserId, reason } = req.body;

  if (!sourceUserId || !targetUserId) {
    return res.status(400).json({ error: 'sourceUserId and targetUserId are required' });
  }

  try {
    const result = await identityResolver.mergeUsers(sourceUserId, targetUserId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    const err = error as Error & { code?: string; details?: Record<string, unknown> };
    if (err.code === 'MERGE_CONFLICT') {
      return res.status(409).json({ error: 'Merge conflict', details: err.details });
    }
    logger.error('Error merging users:', error);
    res.status(500).json({ error: 'Failed to merge users', message: err.message });
  }
}));

// ============ BEHAVIORAL DATA ENDPOINTS ============

// Update behavioral data
app.patch('/api/v1/users/:userId/behavioral', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const behavioral = req.body as Partial<Behavioral>;
  const user = await userGraph.updateBehavioralData(userId, behavioral);

  if (!user) {
    return res.status(404).json({ error: 'User not found', userId });
  }

  res.json({ success: true, data: user });
}));

// Get user segments
app.get('/api/v1/users/:userId/segments', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const segments = await userGraph.getUserSegments(userId);

  if (segments === null) {
    return res.status(404).json({ error: 'User not found', userId });
  }

  res.json({ success: true, data: segments });
}));

// ============ LIFETIME VALUE ENDPOINTS ============

// Get user LTV metrics
app.get('/api/v1/users/:userId/ltv', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const ltv = await userGraph.getLifetimeValue(userId);

  if (!ltv) {
    return res.status(404).json({ error: 'User not found', userId });
  }

  res.json({ success: true, data: ltv });
}));

// Update LTV metrics
app.patch('/api/v1/users/:userId/ltv', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const ltvData = req.body as Partial<Lifetime>;
  const user = await userGraph.updateLifetimeValue(userId, ltvData);

  if (!user) {
    return res.status(404).json({ error: 'User not found', userId });
  }

  res.json({ success: true, data: user });
}));

// ============ GRAPH QUERIES ============

// Get user connections (who is connected to this user)
app.get('/api/v1/users/:userId/connections', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { type } = req.query;
  const connections = await userGraph.getConnections(userId, type as string | undefined);
  res.json({ success: true, data: connections });
}));

// Get graph stats
app.get('/api/v1/graph/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await userGraph.getGraphStats();
  res.json({ success: true, data: stats });
}));

// Sync from external sources
app.post('/api/v1/sync/:source', authenticateInternal, asyncHandler(async (req: Request, res: Response) => {
  const { source } = req.params;
  const { userId, data } = req.body;

  const validSources = ['intent-graph', 'consumer-graph', 'cdp', 'wallet', 'support'];
  if (!validSources.includes(source)) {
    return res.status(400).json({ error: 'Invalid sync source', validSources });
  }

  try {
    const result = await identityResolver.syncFromSource(source, userId, data);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error syncing from source:', error);
    res.status(500).json({ error: 'Failed to sync', message: (error as Error).message });
  }
}));

// ============ CAREER GRAPH ENDPOINTS ============

// Mount career routes
app.use('/api/career', careerRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 4055;

async function startServer(): Promise<void> {
  try {
    await userGraph.connect();
    await identityResolver.connect();

    app.listen(PORT, () => {
      logger.info(`Universal User Graph service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await userGraph.disconnect();
  await identityResolver.disconnect();
  process.exit(0);
});

startServer();

export { app, userGraph, identityResolver };

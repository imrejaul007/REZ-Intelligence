import 'dotenv/config';
import express import logger from './utils/logger';
import from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { UserGraph } from './userGraph.js';
import { IdentityResolver } from './identityResolver.js';
import { validateUniversalUserSchema, validateUserLinkSchema, validateIdentityQuerySchema } from './schemas.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize services
const userGraph = new UserGraph();
const identityResolver = new IdentityResolver(userGraph);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'universal-user-graph', timestamp: new Date().toISOString() });
});

// Internal authentication middleware
const authenticateInternal = (req, res, next) => {
  const token = req.headers['x-internal-token'];
  const validTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');

  if (!token || !Object.values(validTokens).includes(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.callingService = Object.keys(validTokens).find(key => validTokens[key] === token);
  next();
};

// ============ USER GRAPH ENDPOINTS ============

// Get universal user by ID
app.get('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userGraph.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user', message: error.message });
  }
});

// Get universal user by identifier (phone/email)
app.get('/api/v1/users/lookup/:type/:value', async (req, res) => {
  try {
    const { type, value } = req.params;

    if (!['phone', 'email'].includes(type)) {
      return res.status(400).json({ error: 'Invalid identifier type. Use "phone" or "email"' });
    }

    const user = await identityResolver.resolveByIdentifier(type, value);

    if (!user) {
      return res.status(404).json({ error: 'User not found', identifier: { type, value } });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error resolving user:', error);
    res.status(500).json({ error: 'Failed to resolve user', message: error.message });
  }
});

// Search users with filters
app.post('/api/v1/users/search', async (req, res) => {
  try {
    const { query, filters, pagination } = req.body;
    const results = await userGraph.searchUsers(query, filters, pagination);
    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users', message: error.message });
  }
});

// Create or update universal user
app.post('/api/v1/users', authenticateInternal, async (req, res) => {
  try {
    const validated = validateUniversalUserSchema(req.body);
    const user = await userGraph.upsertUser(validated);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', message: error.message });
  }
});

// Update user profile
app.patch('/api/v1/users/:userId/profile', authenticateInternal, async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = req.body;
    const user = await userGraph.updateProfile(userId, profile);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile', message: error.message });
  }
});

// ============ IDENTITY LINKING ENDPOINTS ============

// Link app identity to universal user
app.post('/api/v1/users/:userId/links', authenticateInternal, async (req, res) => {
  try {
    const { userId } = req.params;
    const validated = validateUserLinkSchema(req.body);
    const user = await userGraph.linkAppIdentity(userId, validated);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error.code === 'DUPLICATE_LINK') {
      return res.status(409).json({ error: 'Identity already linked', details: error.details });
    }
    console.error('Error linking identity:', error);
    res.status(500).json({ error: 'Failed to link identity', message: error.message });
  }
});

// Unlink app identity
app.delete('/api/v1/users/:userId/links/:appId/:appUserId', authenticateInternal, async (req, res) => {
  try {
    const { userId, appId, appUserId } = req.params;
    const user = await userGraph.unlinkAppIdentity(userId, appId, appUserId);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error unlinking identity:', error);
    res.status(500).json({ error: 'Failed to unlink identity', message: error.message });
  }
});

// Get all linked identities for a user
app.get('/api/v1/users/:userId/links', async (req, res) => {
  try {
    const { userId } = req.params;
    const links = await userGraph.getLinkedIdentities(userId);
    res.json({ success: true, data: links });
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links', message: error.message });
  }
});

// ============ IDENTITY RESOLUTION ENDPOINTS ============

// Resolve identity with confidence
app.post('/api/v1/identity/resolve', async (req, res) => {
  try {
    const validated = validateIdentityQuerySchema(req.body);
    const result = await identityResolver.resolve(validated);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error resolving identity:', error);
    res.status(500).json({ error: 'Failed to resolve identity', message: error.message });
  }
});

// Merge two users
app.post('/api/v1/identity/merge', authenticateInternal, async (req, res) => {
  try {
    const { sourceUserId, targetUserId, reason } = req.body;

    if (!sourceUserId || !targetUserId) {
      return res.status(400).json({ error: 'sourceUserId and targetUserId are required' });
    }

    const result = await identityResolver.mergeUsers(sourceUserId, targetUserId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.code === 'MERGE_CONFLICT') {
      return res.status(409).json({ error: 'Merge conflict', details: error.details });
    }
    console.error('Error merging users:', error);
    res.status(500).json({ error: 'Failed to merge users', message: error.message });
  }
});

// ============ BEHAVIORAL DATA ENDPOINTS ============

// Update behavioral data
app.patch('/api/v1/users/:userId/behavioral', authenticateInternal, async (req, res) => {
  try {
    const { userId } = req.params;
    const behavioral = req.body;
    const user = await userGraph.updateBehavioralData(userId, behavioral);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating behavioral data:', error);
    res.status(500).json({ error: 'Failed to update behavioral data', message: error.message });
  }
});

// Get user segments
app.get('/api/v1/users/:userId/segments', async (req, res) => {
  try {
    const { userId } = req.params;
    const segments = await userGraph.getUserSegments(userId);
    res.json({ success: true, data: segments });
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ error: 'Failed to fetch segments', message: error.message });
  }
});

// ============ LIFETIME VALUE ENDPOINTS ============

// Get user LTV metrics
app.get('/api/v1/users/:userId/ltv', async (req, res) => {
  try {
    const { userId } = req.params;
    const ltv = await userGraph.getLifetimeValue(userId);
    res.json({ success: true, data: ltv });
  } catch (error) {
    console.error('Error fetching LTV:', error);
    res.status(500).json({ error: 'Failed to fetch LTV', message: error.message });
  }
});

// Update LTV metrics
app.patch('/api/v1/users/:userId/ltv', authenticateInternal, async (req, res) => {
  try {
    const { userId } = req.params;
    const ltvData = req.body;
    const user = await userGraph.updateLifetimeValue(userId, ltvData);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating LTV:', error);
    res.status(500).json({ error: 'Failed to update LTV', message: error.message });
  }
});

// ============ GRAPH QUERIES ============

// Get user connections (who is connected to this user)
app.get('/api/v1/users/:userId/connections', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;
    const connections = await userGraph.getConnections(userId, type);
    res.json({ success: true, data: connections });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections', message: error.message });
  }
});

// Get graph stats
app.get('/api/v1/graph/stats', async (req, res) => {
  try {
    const stats = await userGraph.getGraphStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching graph stats:', error);
    res.status(500).json({ error: 'Failed to fetch graph stats', message: error.message });
  }
});

// Sync from external sources
app.post('/api/v1/sync/:source', authenticateInternal, async (req, res) => {
  try {
    const { source } = req.params;
    const { userId, data } = req.body;

    const validSources = ['intent-graph', 'consumer-graph', 'cdp', 'wallet', 'support'];
    if (!validSources.includes(source)) {
      return res.status(400).json({ error: 'Invalid sync source', validSources });
    }

    const result = await identityResolver.syncFromSource(source, userId, data);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error syncing from source:', error);
    res.status(500).json({ error: 'Failed to sync', message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 4055;

async function startServer() {
  try {
    await userGraph.connect();
    await identityResolver.connect();

    app.listen(PORT, () => {
      logger.info(`Universal User Graph service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
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

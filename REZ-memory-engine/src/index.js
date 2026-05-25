import logger from './utils/logger';

'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = require('../shared/logger');
const { errorHandler, asyncHandler } = require('../shared/errorHandler');

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Memory types
const MEMORY_TYPES = {
  SHORT_TERM: 'short_term', // Current session, expires in 1 hour
  LONG_TERM: 'long_term', // Persistent across sessions, expires in 90 days
  EPISODIC: 'episodic', // Specific events/experiences
  SEMANTIC: 'semantic', // Facts, preferences, knowledge
  PROCEDURAL: 'procedural', // How to do things, workflows
  WORKING: 'working', // Active context for current task
  IDENTITY: 'identity' // User identity, preferences, history
};

// Memory priorities
const MEMORY_PRIORITY = {
  CRITICAL: 1, // Never forget (identity, key preferences)
  HIGH: 2, // Important but can expire
  MEDIUM: 3, // Normal importance
  LOW: 4 // Can be evicted under pressure
};

// TTL configurations (in seconds)
const TTL_CONFIG = {
  [MEMORY_TYPES.SHORT_TERM]: 3600, // 1 hour
  [MEMORY_TYPES.LONG_TERM]: 7776000, // 90 days
  [MEMORY_TYPES.EPISODIC]: 2592000, // 30 days
  [MEMORY_TYPES.SEMANTIC]: 2592000, // 30 days
  [MEMORY_TYPES.PROCEDURAL]: 2592000, // 30 days
  [MEMORY_TYPES.WORKING]: 1800, // 30 minutes
  [MEMORY_TYPES.IDENTITY]: 7776000 // 90 days (but refreshed on access)
};

// MongoDB Schemas
const memorySchema = new mongoose.Schema({
  // Memory ID
  memoryId: { type: String, required: true, unique: true, index: true },

  // Ownership
  userId: { type: String, required: true, index: true },
  entityType: { type: String, enum: ['user', 'merchant', 'session', 'conversation'] },
  entityId: { type: String, index: true },

  // Memory content
  type: { type: String, enum: Object.values(MEMORY_TYPES), required: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },

  // Metadata
  metadata: {
    source: { type: String, default: 'ai' }, // 'ai', 'user', 'system', 'action'
    action: String, // 'order', 'booking', 'query', 'preference'
    category: String, // 'order_history', 'preferences', 'context'
    tags: [String],
    language: { type: String, default: 'en' }
  },

  // Importance scoring
  importance: {
    score: { type: Number, min: 0, max: 1, default: 0.5 },
    accessCount: { type: Number, default: 0 },
    lastAccessed: Date,
    lastUpdated: Date
  },

  // Recall helpers
  recall: {
    keywords: [String], // For semantic search
    embeddings: [Number], // For vector search (future)
    entities: [{
      type: String, // 'merchant', 'item', 'category', 'location'
      id: String,
      name: String
    }]
  },

  // Privacy
  privacy: {
    isPublic: { type: Boolean, default: false }, // Shareable across users
    isShared: { type: Boolean, default: false }, // Shared with merchant/copilot
    consentGiven: { type: Boolean, default: true }
  },

  // Expiration
  expiresAt: Date,
  persistent: { type: Boolean, default: false }
}, { timestamps: true });

memorySchema.index({ userId: 1, type: 1 });
memorySchema.index({ userId: 1, 'metadata.action': 1 });
memorySchema.index({ userId: 1, 'recall.keywords': 1 });
memorySchema.index({ entityType: 1, entityId: 1 });

const Memory = mongoose.model('Memory', memorySchema);

// Redis client for caching
let redis;

// Memory Engine class
class MemoryEngine {
  constructor() {
    this.redis = null;
  }

  async init() {
    try {
      this.redis = createClient({ url: process.env.REDIS_URL });
      this.redis.on('error', err => logger.error('Redis error', { error: err.message }));
      await this.redis.connect();
      logger.info('Redis connected');
    } catch (err) {
      logger.warn('Redis connection failed, using MongoDB only', { error: err.message });
    }
  }

  // Generate memory ID
  generateMemoryId() {
    return `mem_${Date.now().toString(36)}_${uuidv4().substring(0, 8)}`;
  }

  // Store memory
  async store(options) {
    const {
      userId,
      type = MEMORY_TYPES.SHEMANTIC,
      content,
      entityType,
      entityId,
      metadata = {},
      importance = 0.5,
      keywords = [],
      entities = [],
      ttl = null,
      persistent = false
    } = options;

    const memoryId = this.generateMemoryId();
    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) :
                     !persistent ? new Date(Date.now() + (TTL_CONFIG[type] || 86400) * 1000) :
                     null;

    const memory = new Memory({
      memoryId,
      userId,
      entityType,
      entityId,
      type,
      content,
      metadata,
      importance: { score: importance },
      recall: { keywords, entities },
      expiresAt,
      persistent
    });

    await memory.save();

    // Cache in Redis if available
    if (this.redis) {
      try {
        await this.redis.setEx(
          `memory:${userId}:${memoryId}`,
          TTL_CONFIG[type] || 3600,
          JSON.stringify({ memoryId, type, content, importance })
        );
      } catch (err) {
        logger.warn('Redis cache failed', { error: err.message });
      }
    }

    return memory;
  }

  // Retrieve memory
  async retrieve(memoryId, userId) {
    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get(`memory:${userId}:${memoryId}`);
        if (cached) {
          // Update access count
          await Memory.findOneAndUpdate(
            { memoryId, userId },
            {
              $inc: { 'importance.accessCount': 1 },
              $set: { 'importance.lastAccessed': new Date() }
            }
          );
          return JSON.parse(cached);
        }
      } catch (err) {
        logger.warn('Redis read failed', { error: err.message });
      }
    }

    // Fall back to MongoDB
    const memory = await Memory.findOneAndUpdate(
      { memoryId, userId },
      {
        $inc: { 'importance.accessCount': 1 },
        $set: { 'importance.lastAccessed': new Date() }
      },
      { new: true }
    );

    return memory;
  }

  // Search memories
  async search(userId, options = {}) {
    const {
      type,
      keywords = [],
      entities = [],
      minImportance = 0,
      limit = 20,
      offset = 0
    } = options;

    const query = { userId };

    if (type) query.type = type;
    if (minImportance > 0) query['importance.score'] = { $gte: minImportance };

    if (keywords.length > 0) {
      query['recall.keywords'] = { $in: keywords };
    }

    if (entities.length > 0) {
      query['recall.entities.id'] = { $in: entities };
    }

    const memories = await Memory.find(query)
      .sort({ 'importance.score': -1, 'importance.lastAccessed': -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return memories;
  }

  // Get context for AI (concise summary)
  async getContext(userId, options = {}) {
    const { types = Object.values(MEMORY_TYPES), limit = 10 } = options;

    const memories = await Memory.find({
      userId,
      type: { $in: types }
    })
    .sort({ 'importance.score': -1, updatedAt: -1 })
    .limit(limit)
    .lean();

    // Format for AI consumption
    return {
      userId,
      timestamp: new Date().toISOString(),
      memories: memories.map(m => ({
        type: m.type,
        content: this.formatForAI(m),
        importance: m.importance.score,
        lastUpdated: m.updatedAt
      }))
    };
  }

  // Format memory content for AI
  formatForAI(memory) {
    const content = memory.content;

    if (typeof content === 'string') return content;

    if (memory.type === MEMORY_TYPES.IDENTITY) {
      return `User profile: ${JSON.stringify(content)}`;
    }

    if (memory.type === MEMORY_TYPES.EPISODIC) {
      return `[${memory.metadata.action || 'event'}]: ${content.summary || JSON.stringify(content)}`;
    }

    return JSON.stringify(content);
  }

  // Consolidate memory (move important short-term to long-term)
  async consolidate(userId) {
    const threshold = 0.7; // High importance threshold

    const candidates = await Memory.find({
      userId,
      type: MEMORY_TYPES.SHORT_TERM,
      'importance.score': { $gte: threshold },
      persistent: false
    });

    for (const memory of candidates) {
      memory.type = MEMORY_TYPES.SEMANTIC;
      memory.expiresAt = new Date(Date.now() + TTL_CONFIG[MEMORY_TYPES.SEMANTIC] * 1000);
      await memory.save();

      logger.info('Memory consolidated', { memoryId: memory.memoryId, userId });
    }

    return { consolidated: candidates.length };
  }

  // Forget (delete) memory
  async forget(memoryId, userId) {
    const result = await Memory.deleteOne({ memoryId, userId });

    if (this.redis) {
      await this.redis.del(`memory:${userId}:${memoryId}`);
    }

    return result.deletedCount > 0;
  }

  // Update memory importance based on interactions
  async updateImportance(memoryId, userId, delta) {
    const memory = await Memory.findOne({ memoryId, userId });
    if (!memory) return null;

    memory.importance.score = Math.min(1, Math.max(0, memory.importance.score + delta));
    await memory.save();

    return memory;
  }

  // Get conversation history
  async getConversationHistory(userId, sessionId, limit = 50) {
    const memories = await Memory.find({
      userId,
      entityType: 'conversation',
      entityId: sessionId
    })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

    return memories.map(m => ({
      role: m.metadata.source === 'user' ? 'user' : 'assistant',
      content: typeof m.content === 'string' ? m.content : m.content.message,
      timestamp: m.createdAt
    }));
  }

  // Store conversation turn
  async storeConversationTurn(userId, sessionId, role, message, metadata = {}) {
    return this.store({
      userId,
      entityType: 'conversation',
      entityId: sessionId,
      type: MEMORY_TYPES.EPISODIC,
      content: { role, message },
      metadata: { ...metadata, source: role },
      importance: 0.5
    });
  }

  // Extract and store entities from conversation
  async extractAndStoreEntities(userId, entities, sessionId) {
    for (const entity of entities) {
      await this.store({
        userId,
        entityType: entity.type,
        entityId: entity.id,
        type: MEMORY_TYPES.SEMANTIC,
        content: entity,
        metadata: { source: 'ai_extraction', action: 'entity_extraction' },
        entities: [entity],
        keywords: [entity.name?.toLowerCase()],
        importance: 0.7,
        persistent: entity.type === 'preference'
      });
    }
  }
}

const memoryEngine = new MemoryEngine();

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'memory-engine',
    types: Object.values(MEMORY_TYPES),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready', mongodb: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Store new memory
app.post('/api/memory', asyncHandler(async (req, res) => {
  const { userId, type, content, entityType, entityId, metadata, importance, keywords, entities } = req.body;

  if (!userId || !content) {
    return res.status(400).json({ error: 'userId and content required' });
  }

  const memory = await memoryEngine.store({
    userId,
    type: type || MEMORY_TYPES.SEMANTIC,
    content,
    entityType,
    entityId,
    metadata,
    importance: importance || 0.5,
    keywords,
    entities
  });

  res.json({
    success: true,
    memoryId: memory.memoryId,
    type: memory.type
  });
}));

// Retrieve memory
app.get('/api/memory/:memoryId', asyncHandler(async (req, res) => {
  const { memoryId } = req.params;
  const { userId } = req.query;

  const memory = await memoryEngine.retrieve(memoryId, userId);

  if (!memory) {
    return res.status(404).json({ error: 'Memory not found' });
  }

  res.json({ success: true, memory });
}));

// Search memories
app.get('/api/memory/user/:userId/search', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { type, keywords, entities, minImportance, limit } = req.query;

  const results = await memoryEngine.search(userId, {
    type,
    keywords: keywords ? keywords.split(',') : [],
    entities: entities ? entities.split(',') : [],
    minImportance: parseFloat(minImportance) || 0,
    limit: parseInt(limit) || 20
  });

  res.json({
    success: true,
    results,
    count: results.length
  });
}));

// Get AI context
app.get('/api/memory/user/:userId/context', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { types, limit } = req.query;

  const context = await memoryEngine.getContext(userId, {
    types: types ? types.split(',') : undefined,
    limit: parseInt(limit) || 10
  });

  res.json({ success: true, context });
}));

// Store conversation turn
app.post('/api/memory/conversation', asyncHandler(async (req, res) => {
  const { userId, sessionId, role, message, metadata } = req.body;

  if (!userId || !sessionId || !role || !message) {
    return res.status(400).json({ error: 'userId, sessionId, role, and message required' });
  }

  const memory = await memoryEngine.storeConversationTurn(userId, sessionId, role, message, metadata);

  res.json({ success: true, memoryId: memory.memoryId });
}));

// Get conversation history
app.get('/api/memory/conversation/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { userId, limit } = req.query;

  const history = await memoryEngine.getConversationHistory(userId, sessionId, parseInt(limit) || 50);

  res.json({ success: true, history });
}));

// Extract entities
app.post('/api/memory/extract', asyncHandler(async (req, res) => {
  const { userId, sessionId, entities } = req.body;

  if (!userId || !entities) {
    return res.status(400).json({ error: 'userId and entities required' });
  }

  await memoryEngine.extractAndStoreEntities(userId, entities, sessionId);

  res.json({ success: true, extracted: entities.length });
}));

// Update memory importance
app.patch('/api/memory/:memoryId/importance', asyncHandler(async (req, res) => {
  const { memoryId } = req.params;
  const { userId, delta } = req.body;

  const memory = await memoryEngine.updateImportance(memoryId, userId, delta);

  if (!memory) {
    return res.status(404).json({ error: 'Memory not found' });
  }

  res.json({ success: true, importance: memory.importance.score });
}));

// Delete memory
app.delete('/api/memory/:memoryId', asyncHandler(async (req, res) => {
  const { memoryId } = req.params;
  const { userId } = req.query;

  const deleted = await memoryEngine.forget(memoryId, userId);

  if (!deleted) {
    return res.status(404).json({ error: 'Memory not found' });
  }

  res.json({ success: true });
}));

// Consolidate memories
app.post('/api/memory/user/:userId/consolidate', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const result = await memoryEngine.consolidate(userId);

  res.json({ success: true, ...result });
}));

// Memory stats
app.get('/api/memory/stats', asyncHandler(async (req, res) => {
  const { userId } = req.query;

  const match = userId ? { userId } : {};

  const stats = await Memory.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgImportance: { $avg: '$importance.score' }
      }
    }
  ]);

  const total = await Memory.countDocuments(match);

  res.json({
    success: true,
    total,
    byType: stats
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4051;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    await memoryEngine.init();

    app.listen(PORT, () => {
      logger.info(`Memory Engine started on port ${PORT}`);
      logger.info(`Memory types: ${Object.values(MEMORY_TYPES).join(', ')}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

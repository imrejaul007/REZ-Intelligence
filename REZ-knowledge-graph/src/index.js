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
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Entity types
const ENTITY_TYPES = {
  MERCHANT: 'merchant',
  PRODUCT: 'product',
  CATEGORY: 'category',
  USER: 'user',
  LOCATION: 'location',
  BRAND: 'brand',
  CREATOR: 'creator',
  EVENT: 'event',
  TAG: 'tag',
  MENU: 'menu'
};

// Relationship types
const RELATIONSHIP_TYPES = {
  // Product relationships
  BELONGS_TO: 'belongs_to', // Product -> Category
  SIMILAR_TO: 'similar_to', // Product -> Product
  ALTERNATIVE_TO: 'alternative_to',
  COMBOS_WITH: 'combos_with', // Frequently bought together

  // Merchant relationships
  OFFERS: 'offers', // Merchant -> Product
  LOCATED_AT: 'located_at', // Merchant -> Location
  SERVES: 'serves', // Merchant -> Category
  COMPETES_WITH: 'competes_with',
  PARTNERS_WITH: 'partners_with',

  // User relationships
  PURCHASED: 'purchased', // User -> Product
  VISITED: 'visited', // User -> Merchant
  REVIEWED: 'reviewed',
  INTERESTS_IN: 'interests_in', // User -> Category
  SIMILAR_TO_USER: 'similar_to_user',

  // Category relationships
  PARENT_OF: 'parent_of',
  CHILD_OF: 'child_of',
  RELATED_TO: 'related_to'
};

// MongoDB Schemas
const entitySchema = new mongoose.Schema({
  entityId: { type: String, required: true, unique: true, index: true },
  entityType: { type: String, enum: Object.values(ENTITY_TYPES), required: true, index: true },

  // Core attributes
  name: { type: String, required: true },
  aliases: [String], // Alternative names
  description: String,
  imageUrl: String,

  // Attributes by type
  attributes: mongoose.Schema.Types.Mixed,

  // For products
  product: {
    sku: String,
    price: Number,
    currency: { type: String, default: 'INR' },
    brand: String,
    tags: [String],
    rating: Number,
    reviewCount: Number
  },

  // For merchants
  merchant: {
    merchantId: String,
    category: String,
    subcategories: [String],
    priceRange: { type: String, enum: ['budget', 'moderate', 'premium', 'luxury'] },
    rating: Number,
    location: {
      address: String,
      city: String,
      state: String,
      pincode: String,
      lat: Number,
      lng: Number
    },
    hours: mongoose.Schema.Types.Mixed
  },

  // For categories
  category: {
    parentCategory: String,
    level: Number,
    icon: String,
    color: String
  },

  // For locations
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: String,
    city: String,
    type: { type: String, enum: ['home', 'work', 'commercial', 'other'] }
  },

  // Graph metrics
  metrics: {
    popularity: { type: Number, default: 0 },
    relevance: { type: Number, default: 0.5 },
    connections: { type: Number, default: 0 }
  },

  // Embeddings for semantic search (future)
  embeddings: [Number],

  // Status
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },

  // Source tracking
  sources: [{
    source: String,
    externalId: String,
    linkedAt: Date
  }]
}, { timestamps: true });

entitySchema.index({ entityType: 1, name: 'text' });
entitySchema.index({ 'merchant.location.city': 1 });
entitySchema.index({ 'product.tags': 1 });

const Entity = mongoose.model('Entity', entitySchema);

// Relationship schema
const relationshipSchema = new mongoose.Schema({
  relationshipId: { type: String, required: true, unique: true, index: true },

  fromEntity: { type: String, required: true, index: true },
  toEntity: { type: String, required: true, index: true },
  relationshipType: { type: String, enum: Object.values(RELATIONSHIP_TYPES), required: true, index: true },

  // Relationship metadata
  metadata: mongoose.Schema.Types.Mixed,

  // Strength/direction
  strength: { type: Number, min: 0, max: 1, default: 1 }, // How strong is this relationship
  bidirectional: { type: Boolean, default: false },

  // For learned relationships (ML-derived)
  isInferred: { type: Boolean, default: false },
  confidence: { type: Number, min: 0, max: 1 },

  // Usage tracking
  usageCount: { type: Number, default: 0 },
  lastUsed: Date
}, { timestamps: true });

relationshipSchema.index({ fromEntity: 1, relationshipType: 1 });
relationshipSchema.index({ toEntity: 1, relationshipType: 1 });
relationshipSchema.index({ relationshipType: 1, strength: -1 });

const Relationship = mongoose.model('Relationship', relationshipSchema);

// Knowledge Graph Engine
class KnowledgeGraph {
  // Create or update entity
  async upsertEntity(entityData) {
    const { entityId, entityType, name, attributes = {} } = entityData;

    let entity = await Entity.findOne({ entityId });

    if (entity) {
      // Update
      Object.assign(entity, entityData);
      await entity.save();
    } else {
      // Create
      entity = await Entity.create({
        entityId,
        entityType,
        name,
        ...entityData
      });
    }

    // Update connections count
    const connectionCount = await Relationship.countDocuments({
      $or: [{ fromEntity: entityId }, { toEntity: entityId }]
    });
    entity.metrics.connections = connectionCount;
    await entity.save();

    return entity;
  }

  // Create relationship
  async relate(fromEntity, toEntity, relationshipType, metadata = {}, options = {}) {
    const { strength = 1, bidirectional = false, confidence = 1 } = options;

    const relationshipId = `rel_${fromEntity}_${relationshipType}_${toEntity}`;

    let relationship = await Relationship.findOne({ relationshipId });

    if (relationship) {
      relationship.strength = Math.max(relationship.strength, strength);
      relationship.usageCount += 1;
      relationship.lastUsed = new Date();
      await relationship.save();
    } else {
      relationship = await Relationship.create({
        relationshipId,
        fromEntity,
        toEntity,
        relationshipType,
        metadata,
        strength,
        bidirectional,
        isInferred: false,
        confidence
      });
    }

    // Update entity connection counts
    await this.updateEntityMetrics(fromEntity);
    await this.updateEntityMetrics(toEntity);

    // Create reverse relationship if bidirectional
    if (bidirectional) {
      const reverseType = this.getReverseRelationship(relationshipType);
      await this.relate(toEntity, fromEntity, reverseType, metadata, { strength });
    }

    return relationship;
  }

  // Get reverse relationship type
  getReverseRelationship(type) {
    const reverses = {
      [RELATIONSHIP_TYPES.BELONGS_TO]: RELATIONSHIP_TYPES.SERVES,
      [RELATIONSHIP_TYPES.SIMILAR_TO]: RELATIONSHIP_TYPES.SIMILAR_TO,
      [RELATIONSHIP_TYPES.OFFERS]: RELATIONSHIP_TYPES.PURCHASED,
      [RELATIONSHIP_TYPES.LOCATED_AT]: RELATIONSHIP_TYPES.VISITED,
      [RELATIONSHIP_TYPES.SERVES]: RELATIONSHIP_TYPES.BELONGS_TO,
      [RELATIONSHIP_TYPES.PURCHASED]: RELATIONSHIP_TYPES.OFFERS,
      [RELATIONSHIP_TYPES.INTERESTS_IN]: RELATIONSHIP_TYPES.SERVES,
      [RELATIONSHIP_TYPES.PARENT_OF]: RELATIONSHIP_TYPES.CHILD_OF,
      [RELATIONSHIP_TYPES.COMPETES_WITH]: RELATIONSHIP_TYPES.COMPETES_WITH
    };
    return reverses[type] || type;
  }

  // Update entity metrics
  async updateEntityMetrics(entityId) {
    const connectionCount = await Relationship.countDocuments({
      $or: [{ fromEntity: entityId }, { toEntity: entityId }]
    });
    await Entity.findOneAndUpdate(
      { entityId },
      { $set: { 'metrics.connections': connectionCount } }
    );
  }

  // Get entity with relationships
  async getEntity(entityId, options = {}) {
    const { depth = 1, relationshipTypes = [] } = options;

    const entity = await Entity.findOne({ entityId });
    if (!entity) return null;

    const query = {
      $or: [{ fromEntity: entityId }, { toEntity: entityId }]
    };

    if (relationshipTypes.length > 0) {
      query.relationshipType = { $in: relationshipTypes };
    }

    const relationships = await Relationship.find(query)
      .sort({ strength: -1 })
      .limit(100)
      .lean();

    // Group by type
    const grouped = {};
    for (const rel of relationships) {
      const isFrom = rel.fromEntity === entityId;
      const connectedId = isFrom ? rel.toEntity : rel.fromEntity;

      if (!grouped[rel.relationshipType]) {
        grouped[rel.relationshipType] = [];
      }

      grouped[rel.relationshipType].push({
        entityId: connectedId,
        direction: isFrom ? 'outgoing' : 'incoming',
        strength: rel.strength,
        metadata: rel.metadata
      });
    }

    // Fetch connected entities
    const connectedIds = [...new Set(relationships.map(r =>
      r.fromEntity === entityId ? r.toEntity : r.fromEntity
    ))];

    const connectedEntities = await Entity.find({
      entityId: { $in: connectedIds }
    }).lean();

    const entityMap = new Map(connectedEntities.map(e => [e.entityId, e]));

    // Add entity details to relationships
    for (const type of Object.keys(grouped)) {
      for (const rel of grouped[type]) {
        rel.entity = entityMap.get(rel.entityId);
      }
    }

    return {
      entity,
      relationships: grouped
    };
  }

  // Find entities by type and filters
  async findEntities(entityType, filters = {}) {
    const query = { entityType, status: 'active' };

    if (filters.category) query['merchant.category'] = filters.category;
    if (filters.city) query['merchant.location.city'] = filters.city;
    if (filters.priceRange) query['merchant.priceRange'] = filters.priceRange;
    if (filters.tags) query['product.tags'] = { $in: filters.tags };

    return Entity.find(query)
      .sort({ 'metrics.popularity': -1 })
      .limit(filters.limit || 50)
      .lean();
  }

  // Find path between two entities
  async findPath(fromEntity, toEntity, maxDepth = 3) {
    // BFS to find shortest path
    const visited = new Set();
    const queue = [{ entityId: fromEntity, path: [] }];

    while (queue.length > 0) {
      const { entityId, path } = queue.shift();

      if (entityId === toEntity) {
        return path;
      }

      if (visited.has(entityId) || path.length >= maxDepth) {
        continue;
      }

      visited.add(entityId);

      const relationships = await Relationship.find({
        $or: [{ fromEntity: entityId }, { toEntity: entityId }],
        strength: { $gte: 0.5 }
      }).lean();

      for (const rel of relationships) {
        const nextEntity = rel.fromEntity === entityId ? rel.toEntity : rel.fromEntity;
        if (!visited.has(nextEntity)) {
          queue.push({
            entityId: nextEntity,
            path: [...path, {
              entityId: nextEntity,
              relationship: rel.relationshipType,
              strength: rel.strength
            }]
          });
        }
      }
    }

    return null; // No path found
  }

  // Get recommendations based on entity
  async getRecommendations(entityId, options = {}) {
    const { types = [RELATIONSHIP_TYPES.SIMILAR_TO, RELATIONSHIP_TYPES.SERVES], limit = 10 } = options;

    const entity = await Entity.findOne({ entityId });
    if (!entity) return [];

    // Get direct relationships
    const relationships = await Relationship.find({
      $or: [{ fromEntity: entityId }, { toEntity: entityId }],
      relationshipType: { $in: types },
      strength: { $gte: 0.6 }
    })
    .sort({ strength: -1 })
    .limit(limit * 2)
    .lean();

    // Get unique entities
    const relatedIds = relationships.map(r =>
      r.fromEntity === entityId ? r.toEntity : r.fromEntity
    );

    const relatedEntities = await Entity.find({
      entityId: { $in: [...new Set(relatedIds)] }
    }).lean();

    return relatedEntities.slice(0, limit).map(e => ({
      entity: e,
      relationship: relationships.find(r =>
        r.fromEntity === entityId ? r.toEntity === e.entityId : r.fromEntity === e.entityId
      )
    }));
  }

  // Learn relationship from behavior
  async learnRelationship(fromEntity, toEntity, relationshipType, metadata = {}) {
    // Check if relationship exists
    const existing = await Relationship.findOne({
      fromEntity,
      toEntity,
      relationshipType
    });

    if (existing) {
      // Increase strength based on usage
      existing.strength = Math.min(1, existing.strength + 0.05);
      existing.usageCount += 1;
      existing.lastUsed = new Date();
      await existing.save();
    } else {
      // Create new inferred relationship
      await this.relate(fromEntity, toEntity, relationshipType, metadata, {
        strength: 0.6,
        isInferred: true,
        confidence: 0.6
      });
    }

    // Update entity metrics
    await Entity.findOneAndUpdate(
      { entityId: fromEntity },
      { $inc: { 'metrics.relevance': 0.01 } }
    );
  }

  // Batch import entities and relationships
  async batchImport(data) {
    const { entities = [], relationships: rels = [] } = data;

    // Import entities
    for (const entity of entities) {
      await this.upsertEntity(entity);
    }

    // Import relationships
    for (const rel of rels) {
      await this.relate(rel.from, rel.to, rel.type, rel.metadata, rel.options);
    }

    return { entities: entities.length, relationships: rels.length };
  }
}

const knowledgeGraph = new KnowledgeGraph();

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
    service: 'knowledge-graph',
    entityTypes: Object.values(ENTITY_TYPES),
    relationshipTypes: Object.values(RELATIONSHIP_TYPES),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Create/update entity
app.post('/api/entity', asyncHandler(async (req, res) => {
  const entity = await knowledgeGraph.upsertEntity(req.body);
  res.json({ success: true, entity });
}));

// Batch create entities
app.post('/api/entity/batch', asyncHandler(async (req, res) => {
  const { entities } = req.body;
  const results = [];

  for (const entity of entities) {
    const result = await knowledgeGraph.upsertEntity(entity);
    results.push(result);
  }

  res.json({ success: true, count: results.length });
}));

// Get entity
app.get('/api/entity/:entityId', asyncHandler(async (req, res) => {
  const { entityId } = req.params;
  const { depth = 1 } = req.query;

  const result = await knowledgeGraph.getEntity(entityId, { depth: parseInt(depth) });

  if (!result) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  res.json({ success: true, ...result });
}));

// Find entities
app.get('/api/entities/:entityType', asyncHandler(async (req, res) => {
  const { entityType } = req.params;
  const { category, city, priceRange, tags, limit } = req.query;

  const entities = await knowledgeGraph.findEntities(entityType, {
    category,
    city,
    priceRange,
    tags: tags?.split(','),
    limit: parseInt(limit) || 50
  });

  res.json({ success: true, entities, count: entities.length });
}));

// Create relationship
app.post('/api/relate', asyncHandler(async (req, res) => {
  const { fromEntity, toEntity, relationshipType, metadata, strength, bidirectional } = req.body;

  const relationship = await knowledgeGraph.relate(
    fromEntity,
    toEntity,
    relationshipType,
    metadata,
    { strength, bidirectional }
  );

  logger.info('Relationship created', { fromEntity, toEntity, relationshipType });

  res.json({ success: true, relationship });
}));

// Learn relationship from behavior
app.post('/api/learn', asyncHandler(async (req, res) => {
  const { fromEntity, toEntity, relationshipType, metadata } = req.body;

  await knowledgeGraph.learnRelationship(fromEntity, toEntity, relationshipType, metadata);

  res.json({ success: true });
}));

// Get recommendations
app.get('/api/recommend/:entityId', asyncHandler(async (req, res) => {
  const { entityId } = req.params;
  const { types, limit } = req.query;

  const recommendations = await knowledgeGraph.getRecommendations(entityId, {
    types: types?.split(',') || [RELATIONSHIP_TYPES.SIMILAR_TO],
    limit: parseInt(limit) || 10
  });

  res.json({ success: true, recommendations });
}));

// Find path
app.get('/api/path/:fromEntity/:toEntity', asyncHandler(async (req, res) => {
  const { fromEntity, toEntity } = req.params;
  const { maxDepth = 3 } = req.query;

  const path = await knowledgeGraph.findPath(fromEntity, toEntity, parseInt(maxDepth));

  res.json({ success: true, path });
}));

// Batch import
app.post('/api/import', asyncHandler(async (req, res) => {
  const result = await knowledgeGraph.batchImport(req.body);
  res.json({ success: true, ...result });
}));

// Stats
app.get('/api/stats', asyncHandler(async (req, res) => {
  const [entityStats, relationshipStats] = await Promise.all([
    Entity.aggregate([
      { $group: { _id: '$entityType', count: { $sum: 1 } } }
    ]),
    Relationship.aggregate([
      { $group: { _id: '$relationshipType', count: { $sum: 1 } } }
    ])
  ]);

  res.json({
    success: true,
    entities: entityStats,
    relationships: relationshipStats
  });
}));

app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '4145', 10);

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Knowledge Graph Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

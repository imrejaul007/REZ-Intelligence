import { MongoClient, ObjectId } from 'mongodb';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const COLLECTIONS = {
  USERS: 'universal_users',
  IDENTITIES: 'identity_index',
  AUDIT_LOG: 'audit_log',
};

export class UserGraph {
  constructor() {
    this.mongoClient = null;
    this.redis = null;
    this.db = null;
    this.cacheTtl = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);
    this.confidenceThreshold = parseFloat(process.env.IDENTITY_CONFIDENCE_THRESHOLD || '0.85');
  }

  async connect() {
    // MongoDB connection
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-universal-user-graph';
    this.mongoClient = new MongoClient(mongoUri);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db();

    // Create indexes
    await this.createIndexes();

    // Redis connection
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    console.log('UserGraph connected to MongoDB and Redis');
  }

  async disconnect() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    if (this.redis) {
      await this.redis.quit();
    }
    console.log('UserGraph disconnected');
  }

  async createIndexes() {
    const usersCollection = this.db.collection(COLLECTIONS.USERS);
    const identitiesCollection = this.db.collection(COLLECTIONS.IDENTITIES);

    // User indexes
    await usersCollection.createIndex({ 'id': 1 }, { unique: true });
    await usersCollection.createIndex({ 'phone': 1 }, { sparse: true });
    await usersCollection.createIndex({ 'email': 1 }, { sparse: true });
    await usersCollection.createIndex({ 'apps.appId': 1, 'apps.userId': 1 });
    await usersCollection.createIndex({ 'profile.segments': 1 });
    await usersCollection.createIndex({ 'lifetime.churnRisk': 1 });
    await usersCollection.createIndex({ 'createdAt': 1 });

    // Identity index
    await identitiesCollection.createIndex({ 'phone': 1 }, { sparse: true });
    await identitiesCollection.createIndex({ 'email': 1 }, { sparse: true });
    await identitiesCollection.createIndex({ 'universalUserId': 1 });
    await identitiesCollection.createIndex({ 'lastUpdated': 1 });
  }

  // ============ CORE USER OPERATIONS ============

  async getUser(userId) {
    const cacheKey = `user:${userId}`;

    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const collection = this.db.collection(COLLECTIONS.USERS);
    const user = await collection.findOne({ id: userId });

    if (user) {
      // Enrich with data from external sources
      const enriched = await this.enrichUser(user);
      await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(enriched));
      return enriched;
    }

    return null;
  }

  async enrichUser(user) {
    const enriched = { ...user };

    // Fetch data from Intent Graph
    try {
      const intentData = await this.fetchFromIntentGraph(user);
      enriched.intentGraph = intentData;
    } catch (error) {
      console.warn(`Failed to enrich from Intent Graph: ${error.message}`);
    }

    // Fetch data from Consumer Graph
    try {
      const consumerData = await this.fetchFromConsumerGraph(user);
      enriched.consumerGraph = consumerData;
    } catch (error) {
      console.warn(`Failed to enrich from Consumer Graph: ${error.message}`);
    }

    // Fetch financial data from Wallet
    try {
      const walletData = await this.fetchFromWallet(user);
      enriched.wallet = walletData;
    } catch (error) {
      console.warn(`Failed to enrich from Wallet: ${error.message}`);
    }

    // Fetch support history
    try {
      const supportData = await this.fetchFromSupport(user);
      enriched.supportHistory = supportData;
    } catch (error) {
      console.warn(`Failed to enrich from Support: ${error.message}`);
    }

    return enriched;
  }

  async fetchFromIntentGraph(user) {
    const url = `${process.env.INTENT_GRAPH_URL || 'http://localhost:4050'}/api/users/lookup`;
    const params = {};

    if (user.phone) params.phone = user.phone;
    if (user.email) params.email = user.email;

    if (Object.keys(params).length === 0) return null;

    const response = await axios.get(url, { params });
    return response.data.data;
  }

  async fetchFromConsumerGraph(user) {
    const url = `${process.env.CONSUMER_GRAPH_URL || 'http://localhost:4051'}/api/users/lookup`;
    const params = {};

    if (user.phone) params.phone = user.phone;
    if (user.email) params.email = user.email;

    if (Object.keys(params).length === 0) return null;

    const response = await axios.get(url, { params });
    return response.data.data;
  }

  async fetchFromWallet(user) {
    const url = `${process.env.WALLET_SERVICE_URL || 'http://localhost:4002'}/api/wallets/lookup`;
    const params = {};

    if (user.phone) params.phone = user.phone;

    if (!params.phone) return null;

    const response = await axios.get(url, { params });
    return response.data.data;
  }

  async fetchFromSupport(user) {
    const url = `${process.env.SUPPORT_SERVICE_URL || 'http://localhost:4003'}/api/users/history`;
    const params = {};

    if (user.phone) params.phone = user.phone;
    if (user.email) params.email = user.email;

    if (Object.keys(params).length === 0) return null;

    const response = await axios.get(url, { params });
    return response.data.data;
  }

  async upsertUser(userData) {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const now = new Date().toISOString();

    const user = {
      id: userData.id || `u_${uuidv4()}`,
      phone: userData.phone || null,
      email: userData.email || null,
      apps: userData.apps || [],
      profile: userData.profile || {},
      behavioral: userData.behavioral || {},
      financial: userData.financial || {},
      lifetime: userData.lifetime || {},
      connections: userData.connections || [],
      metadata: userData.metadata || {},
      updatedAt: now,
      createdAt: now,
    };

    // Merge strategy
    const mergeStrategy = process.env.GRAPH_MERGE_STRATEGY || 'weighted';

    if (mergeStrategy === 'weighted') {
      const existing = await collection.findOne({ id: user.id });
      if (existing) {
        user.createdAt = existing.createdAt;
        user.behavioral = this.mergeBehavioral(existing.behavioral, user.behavioral);
        user.profile = this.mergeProfile(existing.profile, user.profile);
        user.financial = { ...existing.financial, ...user.financial };
        user.lifetime = { ...existing.lifetime, ...user.lifetime };
        user.apps = this.mergeApps(existing.apps, user.apps);
        user.connections = this.mergeConnections(existing.connections, user.connections);
      }
    }

    await collection.updateOne(
      { id: user.id },
      { $set: user },
      { upsert: true }
    );

    // Update identity index
    await this.updateIdentityIndex(user);

    // Invalidate cache
    await this.redis.del(`user:${user.id}`);

    // Audit log
    await this.logAuditEvent('USER_UPSERT', user.id, { action: 'upsert' });

    return user;
  }

  mergeBehavioral(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    return {
      frequency: {
        daily: (existing.frequency?.daily || 0) + (incoming.frequency?.daily || 0),
        weekly: (existing.frequency?.weekly || 0) + (incoming.frequency?.weekly || 0),
        monthly: (existing.frequency?.monthly || 0) + (incoming.frequency?.monthly || 0),
      },
      preferences: { ...existing.preferences, ...incoming.preferences },
      patterns: { ...existing.patterns, ...incoming.patterns },
      engagementScore: Math.max(existing.engagementScore || 0, incoming.engagementScore || 0),
    };
  }

  mergeProfile(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    return {
      name: {
        first: incoming.name?.first || existing.name?.first,
        last: incoming.name?.last || existing.name?.last,
        display: incoming.name?.display || existing.name?.display,
      },
      avatar: incoming.avatar || existing.avatar,
      segments: [...new Set([...existing.segments || [], ...incoming.segments || []])],
      tags: [...new Set([...existing.tags || [], ...incoming.tags || []])],
      preferences: { ...existing.preferences, ...incoming.preferences },
    };
  }

  mergeApps(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    const merged = [...existing];
    for (const newApp of incoming) {
      const existingIndex = merged.findIndex(a => a.appId === newApp.appId);
      if (existingIndex >= 0) {
        // Keep the one with higher confidence or newer linkedAt
        if ((newApp.confidence || 1) > (merged[existingIndex].confidence || 1)) {
          merged[existingIndex] = newApp;
        }
      } else {
        merged.push(newApp);
      }
    }
    return merged;
  }

  mergeConnections(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    const connectionMap = new Map();
    for (const conn of existing) {
      connectionMap.set(`${conn.targetUserId}:${conn.type}`, conn);
    }
    for (const conn of incoming) {
      const key = `${conn.targetUserId}:${conn.type}`;
      const existingConn = connectionMap.get(key);
      if (!existingConn || conn.strength > existingConn.strength) {
        connectionMap.set(key, conn);
      }
    }
    return Array.from(connectionMap.values());
  }

  async updateIdentityIndex(user) {
    const collection = this.db.collection(COLLECTIONS.IDENTITIES);
    const now = new Date().toISOString();

    const updates = [];

    if (user.phone) {
      updates.push({
        updateOne: {
          filter: { phone: user.phone },
          update: {
            $set: { universalUserId: user.id, lastUpdated: now },
            $setOnInsert: { phone: user.phone, createdAt: now },
          },
          upsert: true,
        },
      });
    }

    if (user.email) {
      updates.push({
        updateOne: {
          filter: { email: user.email },
          update: {
            $set: { universalUserId: user.id, lastUpdated: now },
            $setOnInsert: { email: user.email, createdAt: now },
          },
          upsert: true,
        },
      });
    }

    if (updates.length > 0) {
      await collection.bulkWrite(updates);
    }
  }

  // ============ PROFILE OPERATIONS ============

  async updateProfile(userId, profile) {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const now = new Date().toISOString();

    const updateFields = { updatedAt: now };

    if (profile.name) {
      updateFields['profile.name'] = profile.name;
    }
    if (profile.avatar !== undefined) {
      updateFields['profile.avatar'] = profile.avatar;
    }
    if (profile.segments) {
      updateFields['profile.segments'] = profile.segments;
    }
    if (profile.tags) {
      updateFields['profile.tags'] = profile.tags;
    }
    if (profile.preferences) {
      updateFields['profile.preferences'] = profile.preferences;
    }

    await collection.updateOne(
      { id: userId },
      { $set: updateFields }
    );

    await this.redis.del(`user:${userId}`);
    await this.logAuditEvent('PROFILE_UPDATE', userId, { profile });

    return this.getUser(userId);
  }

  // ============ IDENTITY LINKING ============

  async linkAppIdentity(userId, linkData) {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const now = new Date().toISOString();

    // Check if already linked
    const existing = await collection.findOne({
      id: userId,
      'apps.appId': linkData.appId,
      'apps.userId': linkData.userId,
    });

    if (existing) {
      const error = new Error('Identity already linked');
      error.code = 'DUPLICATE_LINK';
      error.details = { appId: linkData.appId, userId: linkData.userId };
      throw error;
    }

    const newAppLink = {
      appId: linkData.appId,
      userId: linkData.userId,
      linkedAt: now,
      confidence: 1.0,
      metadata: linkData.metadata || {},
    };

    await collection.updateOne(
      { id: userId },
      {
        $push: { apps: newAppLink },
        $set: { updatedAt: now },
      }
    );

    // Create identity index entry
    await this.db.collection(COLLECTIONS.IDENTITIES).insertOne({
      appId: linkData.appId,
      appUserId: linkData.userId,
      universalUserId: userId,
      linkedAt: now,
    });

    await this.redis.del(`user:${userId}`);
    await this.logAuditEvent('IDENTITY_LINK', userId, { appId: linkData.appId, userId: linkData.userId });

    return this.getUser(userId);
  }

  async unlinkAppIdentity(userId, appId, appUserId) {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const now = new Date().toISOString();

    await collection.updateOne(
      { id: userId },
      {
        $pull: { apps: { appId, userId: appUserId } },
        $set: { updatedAt: now },
      }
    );

    await this.db.collection(COLLECTIONS.IDENTITIES).deleteOne({
      appId,
      appUserId,
      universalUserId: userId,
    });

    await this.redis.del(`user:${userId}`);
    await this.logAuditEvent('IDENTITY_UNLINK', userId, { appId, userId: appUserId });

    return this.getUser(userId);
  }

  async getLinkedIdentities(userId) {
    const user = await this.getUser(userId);
    if (!user) return null;

    return user.apps || [];
  }

  // ============ BEHAVIORAL OPERATIONS ============

  async updateBehavioralData(userId, behavioral) {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const now = new Date().toISOString();

    const updateFields = { updatedAt: now };

    if (behavioral.frequency) {
      updateFields['behavioral.frequency'] = behavioral.frequency;
    }
    if (behavioral.preferences) {
      updateFields['behavioral.preferences'] = behavioral.preferences;
    }
    if (behavioral.patterns) {
      updateFields['behavioral.patterns'] = behavioral.patterns;
    }
    if (behavioral.engagementScore !== undefined) {
      updateFields['behavioral.engagementScore'] = behavioral.engagementScore;
    }

    await collection.updateOne(
      { id: userId },
      { $set: updateFields }
    );

    await this.redis.del(`user:${userId}`);
    await this.logAuditEvent('BEHAVIORAL_UPDATE', userId, { behavioral });

    return this.getUser(userId);
  }

  async getUserSegments(userId) {
    const user = await this.getUser(userId);
    if (!user) return null;

    const segments = new Set(user.profile?.segments || []);

    // Add segment based on churn risk
    if (user.lifetime?.churnRisk) {
      segments.add(`churn_${user.lifetime.churnRisk}`);
    }

    // Add segment based on engagement
    if (user.behavioral?.engagementScore >= 80) {
      segments.add('high_engagement');
    } else if (user.behavioral?.engagementScore >= 50) {
      segments.add('medium_engagement');
    } else {
      segments.add('low_engagement');
    }

    // Add segment based on LTV
    if (user.lifetime?.LTV >= 10000) {
      segments.add('high_value');
    } else if (user.lifetime?.LTV >= 1000) {
      segments.add('medium_value');
    } else {
      segments.add('low_value');
    }

    // Add segment based on risk tier
    if (user.financial?.riskTier) {
      segments.add(`risk_${user.financial.riskTier}`);
    }

    return Array.from(segments);
  }

  // ============ LIFETIME VALUE OPERATIONS ============

  async getLifetimeValue(userId) {
    const user = await this.getUser(userId);
    if (!user) return null;

    return user.lifetime || {};
  }

  async updateLifetimeValue(userId, ltvData) {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const now = new Date().toISOString();

    const updateFields = { updatedAt: now };

    if (ltvData.LTV !== undefined) {
      updateFields['lifetime.LTV'] = ltvData.LTV;
    }
    if (ltvData.churnRisk) {
      updateFields['lifetime.churnRisk'] = ltvData.churnRisk;
    }
    if (ltvData.engagementScore !== undefined) {
      updateFields['lifetime.engagementScore'] = ltvData.engagementScore;
    }
    if (ltvData.firstSeen) {
      updateFields['lifetime.firstSeen'] = ltvData.firstSeen;
    }
    if (ltvData.lastSeen) {
      updateFields['lifetime.lastSeen'] = ltvData.lastSeen;
    }
    if (ltvData.daysActive !== undefined) {
      updateFields['lifetime.daysActive'] = ltvData.daysActive;
    }

    await collection.updateOne(
      { id: userId },
      { $set: updateFields }
    );

    await this.redis.del(`user:${userId}`);
    await this.logAuditEvent('LTV_UPDATE', userId, { ltvData });

    return this.getUser(userId);
  }

  // ============ CONNECTION OPERATIONS ============

  async getConnections(userId, type = null) {
    const user = await this.getUser(userId);
    if (!user) return null;

    let connections = user.connections || [];

    if (type) {
      connections = connections.filter(c => c.type === type);
    }

    // Enrich with connected user data
    const enrichedConnections = [];
    for (const conn of connections) {
      const connectedUser = await this.getUser(conn.targetUserId);
      if (connectedUser) {
        enrichedConnections.push({
          ...conn,
          user: {
            id: connectedUser.id,
            phone: connectedUser.phone,
            profile: connectedUser.profile,
          },
        });
      }
    }

    return enrichedConnections;
  }

  // ============ SEARCH OPERATIONS ============

  async searchUsers(query, filters = {}, pagination = { page: 1, limit: 20 }) {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const filter = {};

    if (query) {
      filter.$or = [
        { 'profile.name.display': { $regex: query, $options: 'i' } },
        { 'profile.name.first': { $regex: query, $options: 'i' } },
        { 'profile.name.last': { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ];
    }

    if (filters.segments?.length) {
      filter['profile.segments'] = { $in: filters.segments };
    }

    if (filters.churnRisk) {
      filter['lifetime.churnRisk'] = filters.churnRisk;
    }

    if (filters.appId) {
      filter['apps.appId'] = filters.appId;
    }

    if (filters.minLTV !== undefined) {
      filter['lifetime.LTV'] = { $gte: filters.minLTV };
    }

    if (filters.maxLTV !== undefined) {
      filter['lifetime.LTV'] = { ...filter['lifetime.LTV'], $lte: filters.maxLTV };
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      collection.find(filter).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============ GRAPH STATS ============

  async getGraphStats() {
    const collection = this.db.collection(COLLECTIONS.USERS);

    const [
      totalUsers,
      usersWithPhone,
      usersWithEmail,
      appDistribution,
      churnDistribution,
      segmentStats,
    ] = await Promise.all([
      collection.countDocuments(),
      collection.countDocuments({ phone: { $ne: null } }),
      collection.countDocuments({ email: { $ne: null } }),
      this.getAppDistribution(),
      this.getChurnDistribution(),
      this.getSegmentStats(),
    ]);

    return {
      totalUsers,
      usersWithPhone,
      usersWithEmail,
      appDistribution,
      churnDistribution,
      segmentStats,
      timestamp: new Date().toISOString(),
    };
  }

  async getAppDistribution() {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const pipeline = [
      { $unwind: '$apps' },
      { $group: { _id: '$apps.appId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return results.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
  }

  async getChurnDistribution() {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const pipeline = [
      { $match: { 'lifetime.churnRisk': { $ne: null } } },
      { $group: { _id: '$lifetime.churnRisk', count: { $sum: 1 } } },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return results.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
  }

  async getSegmentStats() {
    const collection = this.db.collection(COLLECTIONS.USERS);
    const pipeline = [
      { $unwind: '$profile.segments' },
      { $group: { _id: '$profile.segments', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ];

    return collection.aggregate(pipeline).toArray();
  }

  // ============ AUDIT LOG ============

  async logAuditEvent(eventType, userId, details) {
    const collection = this.db.collection(COLLECTIONS.AUDIT_LOG);

    await collection.insertOne({
      eventType,
      userId,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

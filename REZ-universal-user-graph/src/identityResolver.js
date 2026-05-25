import logger from './utils/logger';

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class IdentityResolver {
  constructor(userGraph) {
    this.userGraph = userGraph;
    this.confidenceThreshold = parseFloat(process.env.IDENTITY_CONFIDENCE_THRESHOLD || '0.85');

    // Source priority (higher = more authoritative)
    this.sourcePriority = {
      'wallet': 100,
      'cdp': 90,
      'consumer-graph': 80,
      'intent-graph': 70,
      'support': 60,
    };
  }

  async connect() {
    // Identity resolver uses the userGraph's connections
    logger.info('IdentityResolver initialized');
  }

  async disconnect() {
    logger.info('IdentityResolver disconnected');
  }

  // ============ IDENTITY RESOLUTION ============

  async resolve(query) {
    const results = {
      resolved: false,
      confidence: 0,
      candidates: [],
      primary: null,
    };

    // Try to resolve by phone
    if (query.phone) {
      const phoneResult = await this.resolveByPhone(query.phone);
      if (phoneResult) {
        results.candidates.push(...phoneResult.candidates);
        if (phoneResult.primary) {
          results.primary = phoneResult.primary;
          results.resolved = true;
          results.confidence = Math.max(results.confidence, phoneResult.confidence);
        }
      }
    }

    // Try to resolve by email
    if (query.email) {
      const emailResult = await this.resolveByEmail(query.email);
      if (emailResult) {
        results.candidates.push(...emailResult.candidates);
        if (emailResult.primary) {
          if (!results.primary) {
            results.primary = emailResult.primary;
            results.resolved = true;
          }
          results.confidence = Math.max(results.confidence, emailResult.confidence);
        }
      }
    }

    // Try to resolve by device ID
    if (query.deviceId) {
      const deviceResult = await this.resolveByDeviceId(query.deviceId);
      if (deviceResult) {
        results.candidates.push(...deviceResult.candidates);
      }
    }

    // Try cross-reference with external sources
    if (query.intentUserId) {
      const intentResult = await this.resolveFromIntentGraph(query.intentUserId);
      if (intentResult) {
        results.candidates.push(intentResult);
      }
    }

    if (query.consumerUserId) {
      const consumerResult = await this.resolveFromConsumerGraph(query.consumerUserId);
      if (consumerResult) {
        results.candidates.push(consumerResult);
      }
    }

    if (query.walletUserId) {
      const walletResult = await this.resolveFromWallet(query.walletUserId);
      if (walletResult) {
        results.candidates.push(walletResult);
      }
    }

    // Deduplicate candidates and pick best
    results.candidates = this.deduplicateCandidates(results.candidates);

    if (results.candidates.length > 0 && !results.primary) {
      // Pick the candidate with highest confidence
      results.primary = results.candidates.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      results.resolved = true;
      results.confidence = results.primary.confidence;
    }

    // If still not resolved, return resolution status
    if (!results.resolved) {
      return {
        ...results,
        suggestedAction: 'CREATE_NEW',
      };
    }

    return results;
  }

  async resolveByPhone(phone) {
    const collection = this.userGraph.db.collection('universal_users');
    const candidates = [];

    // Direct match in universal users
    const directMatch = await collection.findOne({ phone });
    if (directMatch) {
      candidates.push({
        userId: directMatch.id,
        source: 'universal_user_graph',
        matchType: 'direct',
        confidence: 1.0,
        data: directMatch,
      });
    }

    // Match via identity index
    const identityIndex = this.userGraph.db.collection('identity_index');
    const indexMatches = await identityIndex.find({ phone }).toArray();

    for (const match of indexMatches) {
      if (match.universalUserId && match.universalUserId !== directMatch?.id) {
        const user = await this.userGraph.getUser(match.universalUserId);
        if (user) {
          candidates.push({
            userId: user.id,
            source: 'identity_index',
            matchType: 'phone_index',
            confidence: 0.95,
            data: user,
          });
        }
      }
    }

    // Try CDP for phone lookup
    try {
      const cdpResult = await this.lookupInCDP({ phone });
      if (cdpResult) {
        candidates.push({
          userId: cdpResult.userId,
          source: 'cdp',
          matchType: 'phone',
          confidence: 0.85,
          data: cdpResult,
        });
      }
    } catch (error) {
      // CDP lookup failed, continue with other sources
    }

    // Determine primary match
    const primary = candidates.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    , null);

    return {
      candidates,
      primary,
      confidence: primary?.confidence || 0,
    };
  }

  async resolveByEmail(email) {
    const collection = this.userGraph.db.collection('universal_users');
    const candidates = [];

    // Direct match
    const directMatch = await collection.findOne({ email });
    if (directMatch) {
      candidates.push({
        userId: directMatch.id,
        source: 'universal_user_graph',
        matchType: 'direct',
        confidence: 1.0,
        data: directMatch,
      });
    }

    // Match via identity index
    const identityIndex = this.userGraph.db.collection('identity_index');
    const indexMatches = await identityIndex.find({ email }).toArray();

    for (const match of indexMatches) {
      if (match.universalUserId && match.universalUserId !== directMatch?.id) {
        const user = await this.userGraph.getUser(match.universalUserId);
        if (user) {
          candidates.push({
            userId: user.id,
            source: 'identity_index',
            matchType: 'email_index',
            confidence: 0.95,
            data: user,
          });
        }
      }
    }

    // Try CDP for email lookup
    try {
      const cdpResult = await this.lookupInCDP({ email });
      if (cdpResult) {
        candidates.push({
          userId: cdpResult.userId,
          source: 'cdp',
          matchType: 'email',
          confidence: 0.85,
          data: cdpResult,
        });
      }
    } catch (error) {
      // CDP lookup failed
    }

    const primary = candidates.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    , null);

    return {
      candidates,
      primary,
      confidence: primary?.confidence || 0,
    };
  }

  async resolveByDeviceId(deviceId) {
    const collection = this.userGraph.db.collection('universal_users');
    const candidates = [];

    // Search for device ID in metadata
    const deviceMatches = await collection.find({
      'metadata.deviceIds': deviceId,
    }).toArray();

    for (const match of deviceMatches) {
      candidates.push({
        userId: match.id,
        source: 'universal_user_graph',
        matchType: 'device_id',
        confidence: 0.75,
        data: match,
      });
    }

    // Try Intent Graph for device resolution
    try {
      const intentUrl = `${process.env.INTENT_GRAPH_URL || 'http://localhost:4050'}/api/devices/${deviceId}`;
      const response = await axios.get(intentUrl, {
        headers: { 'X-Internal-Token': this.getServiceToken('intent-graph') },
        timeout: 5000,
      });

      if (response.data?.userId) {
        const user = await this.userGraph.getUser(response.data.userId);
        if (user) {
          candidates.push({
            userId: user.id,
            source: 'intent-graph',
            matchType: 'device_id',
            confidence: 0.80,
            data: user,
          });
        }
      }
    } catch (error) {
      // Intent Graph lookup failed
    }

    return {
      candidates,
      primary: null,
      confidence: 0,
    };
  }

  async resolveByIdentifier(type, value) {
    if (type === 'phone') {
      const result = await this.resolveByPhone(value);
      return result.primary?.data || null;
    } else if (type === 'email') {
      const result = await this.resolveByEmail(value);
      return result.primary?.data || null;
    }
    return null;
  }

  // ============ EXTERNAL SOURCE RESOLUTION ============

  async resolveFromIntentGraph(intentUserId) {
    try {
      const url = `${process.env.INTENT_GRAPH_URL || 'http://localhost:4050'}/api/users/${intentUserId}`;
      const response = await axios.get(url, {
        headers: { 'X-Internal-Token': this.getServiceToken('intent-graph') },
        timeout: 5000,
      });

      if (response.data?.data) {
        const userData = response.data.data;
        return {
          userId: userData.id || intentUserId,
          source: 'intent-graph',
          matchType: 'intent_user_id',
          confidence: this.sourcePriority['intent-graph'] / 100,
          data: userData,
        };
      }
    } catch (error) {
      logger.warn(`Intent Graph resolution failed: ${error.message}`);
    }
    return null;
  }

  async resolveFromConsumerGraph(consumerUserId) {
    try {
      const url = `${process.env.CONSUMER_GRAPH_URL || 'http://localhost:4051'}/api/users/${consumerUserId}`;
      const response = await axios.get(url, {
        headers: { 'X-Internal-Token': this.getServiceToken('consumer-graph') },
        timeout: 5000,
      });

      if (response.data?.data) {
        const userData = response.data.data;
        return {
          userId: userData.id || consumerUserId,
          source: 'consumer-graph',
          matchType: 'consumer_user_id',
          confidence: this.sourcePriority['consumer-graph'] / 100,
          data: userData,
        };
      }
    } catch (error) {
      logger.warn(`Consumer Graph resolution failed: ${error.message}`);
    }
    return null;
  }

  async resolveFromWallet(walletUserId) {
    try {
      const url = `${process.env.WALLET_SERVICE_URL || 'http://localhost:4002'}/api/users/${walletUserId}`;
      const response = await axios.get(url, {
        headers: { 'X-Internal-Token': this.getServiceToken('wallet') },
        timeout: 5000,
      });

      if (response.data?.data) {
        const userData = response.data.data;
        return {
          userId: userData.universalUserId || userData.id,
          source: 'wallet',
          matchType: 'wallet_user_id',
          confidence: this.sourcePriority['wallet'] / 100,
          data: userData,
        };
      }
    } catch (error) {
      logger.warn(`Wallet resolution failed: ${error.message}`);
    }
    return null;
  }

  async lookupInCDP(query) {
    try {
      const url = `${process.env.CDP_URL || 'http://localhost:3005'}/api/profiles/lookup`;
      const response = await axios.post(url, query, {
        headers: {
          'X-Internal-Token': this.getServiceToken('cdp'),
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      if (response.data?.data) {
        return response.data.data;
      }
    } catch (error) {
      logger.warn(`CDP lookup failed: ${error.message}`);
    }
    return null;
  }

  // ============ USER MERGING ============

  async mergeUsers(sourceUserId, targetUserId, reason) {
    const collection = this.userGraph.db.collection('universal_users');
    const now = new Date().toISOString();

    // Fetch both users
    const [sourceUser, targetUser] = await Promise.all([
      this.userGraph.getUser(sourceUserId),
      this.userGraph.getUser(targetUserId),
    ]);

    if (!sourceUser || !targetUser) {
      const error = new Error('One or both users not found');
      error.code = 'MERGE_CONFLICT';
      error.details = {
        sourceFound: !!sourceUser,
        targetFound: !!targetUser,
      };
      throw error;
    }

    // Check for critical conflicts
    const conflicts = this.detectMergeConflicts(sourceUser, targetUser);
    if (conflicts.length > 0 && reason !== 'FORCE_MERGE') {
      const error = new Error('Merge conflicts detected');
      error.code = 'MERGE_CONFLICT';
      error.details = { conflicts };
      throw error;
    }

    // Merge users
    const mergedUser = this.performMerge(sourceUser, targetUser);

    // Update target user
    await collection.updateOne(
      { id: targetUserId },
      { $set: { ...mergedUser, updatedAt: now } }
    );

    // Archive source user (don't delete for audit trail)
    await collection.updateOne(
      { id: sourceUserId },
      {
        $set: {
          mergedInto: targetUserId,
          mergedAt: now,
          mergeReason: reason,
          updatedAt: now,
        },
      }
    );

    // Update identity index
    if (sourceUser.phone && sourceUser.phone !== targetUser.phone) {
      await this.userGraph.db.collection('identity_index').updateOne(
        { universalUserId: sourceUserId, phone: sourceUser.phone },
        { $set: { universalUserId: targetUserId, mergedFrom: sourceUserId } }
      );
    }

    if (sourceUser.email && sourceUser.email !== targetUser.email) {
      await this.userGraph.db.collection('identity_index').updateOne(
        { universalUserId: sourceUserId, email: sourceUser.email },
        { $set: { universalUserId: targetUserId, mergedFrom: sourceUserId } }
      );
    }

    // Invalidate caches
    await Promise.all([
      this.userGraph.redis.del(`user:${sourceUserId}`),
      this.userGraph.redis.del(`user:${targetUserId}`),
    ]);

    // Audit log
    await this.userGraph.logAuditEvent('USER_MERGE', targetUserId, {
      sourceUserId,
      reason,
      conflicts,
    });

    return {
      mergedUser: await this.userGraph.getUser(targetUserId),
      archivedUserId: sourceUserId,
    };
  }

  detectMergeConflicts(source, target) {
    const conflicts = [];

    // Check for different phones
    if (source.phone && target.phone && source.phone !== target.phone) {
      conflicts.push({
        type: 'DIFFERENT_PHONES',
        source: source.phone,
        target: target.phone,
        resolution: 'KEEP_TARGET',
      });
    }

    // Check for different emails
    if (source.email && target.email && source.email !== target.email) {
      conflicts.push({
        type: 'DIFFERENT_EMAILS',
        source: source.email,
        target: target.email,
        resolution: 'KEEP_TARGET',
      });
    }

    // Check for conflicting app links
    const sourceApps = new Set(source.apps?.map(a => a.appId) || []);
    const targetApps = new Set(target.apps?.map(a => a.appId) || []);
    const sharedApps = [...sourceApps].filter(appId => targetApps.has(appId));

    if (sharedApps.length > 0) {
      conflicts.push({
        type: 'SHARED_APP_LINKS',
        apps: sharedApps,
        resolution: 'KEEP_BOTH',
      });
    }

    return conflicts;
  }

  performMerge(source, target) {
    return {
      // Primary identifiers - prefer authoritative source
      phone: target.phone || source.phone,
      email: target.email || source.email,

      // Apps - combine both
      apps: this.mergeApps(source.apps, target.apps),

      // Profile - weighted merge
      profile: this.userGraph.mergeProfile(source.profile, target.profile),

      // Behavioral - combine frequencies, max engagement
      behavioral: this.userGraph.mergeBehavioral(source.behavioral, target.behavioral),

      // Financial - prefer higher values
      financial: {
        walletBalance: Math.max(
          source.financial?.walletBalance || 0,
          target.financial?.walletBalance || 0
        ),
        creditScore: Math.max(
          source.financial?.creditScore || 0,
          target.financial?.creditScore || 0
        ),
        riskTier: target.financial?.riskTier || source.financial?.riskTier,
        totalSpent: (source.financial?.totalSpent || 0) + (target.financial?.totalSpent || 0),
        totalOrders: (source.financial?.totalOrders || 0) + (target.financial?.totalOrders || 0),
      },

      // Lifetime - aggregate values
      lifetime: {
        LTV: (source.lifetime?.LTV || 0) + (target.lifetime?.LTV || 0),
        churnRisk: this.resolveChurnRisk(
          source.lifetime?.churnRisk,
          target.lifetime?.churnRisk
        ),
        engagementScore: Math.max(
          source.lifetime?.engagementScore || 0,
          target.lifetime?.engagementScore || 0
        ),
        firstSeen: this.earliestDate(source.lifetime?.firstSeen, target.lifetime?.firstSeen),
        lastSeen: this.latestDate(source.lifetime?.lastSeen, target.lifetime?.lastSeen),
        daysActive: (source.lifetime?.daysActive || 0) + (target.lifetime?.daysActive || 0),
      },

      // Connections - combine
      connections: this.userGraph.mergeConnections(source.connections, target.connections),

      // Metadata - merge
      metadata: {
        ...source.metadata,
        ...target.metadata,
        mergedFrom: [source.id],
      },
    };
  }

  mergeApps(sourceApps = [], targetApps = []) {
    const merged = new Map();

    for (const app of targetApps) {
      merged.set(app.appId, app);
    }

    for (const app of sourceApps) {
      if (!merged.has(app.appId)) {
        merged.set(app.appId, app);
      }
    }

    return Array.from(merged.values());
  }

  resolveChurnRisk(sourceRisk, targetRisk) {
    const riskPriority = { critical: 4, high: 3, medium: 2, low: 1 };
    const sourcePriority = riskPriority[sourceRisk] || 0;
    const targetPriority = riskPriority[targetRisk] || 0;
    return sourcePriority >= targetPriority ? sourceRisk : targetRisk;
  }

  earliestDate(date1, date2) {
    if (!date1) return date2;
    if (!date2) return date1;
    return new Date(date1) < new Date(date2) ? date1 : date2;
  }

  latestDate(date1, date2) {
    if (!date1) return date2;
    if (!date2) return date1;
    return new Date(date1) > new Date(date2) ? date1 : date2;
  }

  // ============ SYNC FROM EXTERNAL SOURCES ============

  async syncFromSource(source, userId, data) {
    const now = new Date().toISOString();
    const results = {
      source,
      synced: false,
      userId,
      changes: [],
    };

    let user = await this.userGraph.getUser(userId);

    if (!user && data?.phone) {
      // Try to find existing user by phone
      const existingResult = await this.resolveByPhone(data.phone);
      if (existingResult.primary) {
        userId = existingResult.primary.userId;
        user = existingResult.primary.data;
        results.userId = userId;
      }
    }

    if (!user) {
      // Create new user
      const newUser = await this.userGraph.upsertUser({
        id: userId || `u_${uuidv4()}`,
        phone: data?.phone,
        email: data?.email,
        apps: data?.appId ? [{ appId: data.appId, userId: data.userId }] : [],
        profile: {
          name: data?.name,
          avatar: data?.avatar,
          segments: data?.segments,
        },
        metadata: {
          createdViaSync: source,
        },
      });

      results.synced = true;
      results.newUser = true;
      results.user = newUser;
      return results;
    }

    // Update existing user with source data
    const updates = {};

    if (data.phone && !user.phone) {
      updates.phone = data.phone;
      results.changes.push('phone');
    }

    if (data.email && !user.email) {
      updates.email = data.email;
      results.changes.push('email');
    }

    if (data.profile) {
      if (data.profile.name) {
        updates['profile.name'] = data.profile.name;
        results.changes.push('profile.name');
      }
      if (data.profile.segments) {
        const newSegments = data.profile.segments.filter(
          s => !user.profile?.segments?.includes(s)
        );
        if (newSegments.length > 0) {
          updates['profile.segments'] = [...(user.profile?.segments || []), ...newSegments];
          results.changes.push('profile.segments');
        }
      }
    }

    if (data.behavioral) {
      if (data.behavioral.engagementScore !== undefined) {
        updates['behavioral.engagementScore'] = data.behavioral.engagementScore;
        results.changes.push('behavioral.engagementScore');
      }
    }

    if (data.lifetime) {
      if (data.lifetime.lastSeen) {
        updates['lifetime.lastSeen'] = data.lifetime.lastSeen;
        results.changes.push('lifetime.lastSeen');
      }
    }

    if (data.appId && data.userId) {
      const existingApp = user.apps?.find(a => a.appId === data.appId);
      if (!existingApp) {
        updates['apps'] = [
          ...(user.apps || []),
          { appId: data.appId, userId: data.userId, linkedAt: now },
        ];
        results.changes.push('apps');
      }
    }

    // Apply updates
    if (results.changes.length > 0) {
      const collection = this.userGraph.db.collection('universal_users');
      await collection.updateOne(
        { id: userId },
        {
          $set: {
            ...updates,
            updatedAt: now,
            [`metadata.lastSyncFrom.${source}`]: now,
          },
        }
      );

      await this.userGraph.redis.del(`user:${userId}`);
      results.synced = true;
    }

    results.user = await this.userGraph.getUser(userId);

    // Audit log
    await this.userGraph.logAuditEvent('SYNC_FROM_SOURCE', userId, {
      source,
      changes: results.changes,
    });

    return results;
  }

  // ============ HELPER METHODS ============

  deduplicateCandidates(candidates) {
    const seen = new Map();

    for (const candidate of candidates) {
      const key = candidate.userId;
      const existing = seen.get(key);

      if (!existing || candidate.confidence > existing.confidence) {
        seen.set(key, candidate);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
  }

  getServiceToken(serviceName) {
    const tokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');
    return tokens[serviceName] || '';
  }
}

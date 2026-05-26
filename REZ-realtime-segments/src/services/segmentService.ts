import {
  DEFAULT_SEGMENTS,
  evaluateSegment,
  evaluateAllSegments,
  findSegmentById,
  getAllSegmentIds,
  getQualifyingSegments
} from './segmentEngine.js';
import {
  cacheEvaluation,
  getCachedEvaluation,
  invalidateEvaluation,
  addUserToSegment,
  removeUserFromSegment,
  getUserSegments,
  setUserSegments,
  getSegmentMemberCount
} from './redisCache.js';
import {
  emitUserEnteredSegment,
  emitUserExitedSegment
} from './webhookEmitter.js';
import {
  SegmentDefinitionModel,
  UserSegmentMembershipModel,
  SegmentEvaluationJobModel,
  SegmentStatsModel
} from '../database/models.js';
import type {
  SegmentDefinition,
  SegmentEvaluationResult,
  UserData,
  SegmentStats,
  UserSegmentMembership,
  SegmentRule
} from '../types/index.js';
import { SegmentDefinitionSchema } from '../types/index.js';

// Get all segments (from DB or defaults)
export async function getAllSegments(): Promise<SegmentDefinition[]> {
  try {
    const dbSegments = await SegmentDefinitionModel.find({ isActive: true }).lean();
    if (dbSegments.length > 0) {
      return dbSegments.map(s => ({
        segmentId: s.segmentId,
        name: s.name,
        description: s.description,
        rules: s.rules as SegmentDefinition['rules'],
        refreshInterval: s.refreshInterval
      }));
    }
  } catch (error) {
    console.warn('Failed to fetch segments from DB, using defaults:', error);
  }

  return DEFAULT_SEGMENTS;
}

// Get segment by ID
export async function getSegmentById(segmentId: string): Promise<SegmentDefinition | null> {
  try {
    const dbSegment = await SegmentDefinitionModel.findOne({ segmentId, isActive: true }).lean();
    if (dbSegment) {
      return {
        segmentId: dbSegment.segmentId,
        name: dbSegment.name,
        description: dbSegment.description,
        rules: dbSegment.rules as SegmentDefinition['rules'],
        refreshInterval: dbSegment.refreshInterval
      };
    }
  } catch (error) {
    console.warn('Failed to fetch segment from DB:', error);
  }

  return findSegmentById(segmentId) || null;
}

// Evaluate user against a single segment
export async function evaluateUserSegment(
  userId: string,
  segmentId: string,
  userData?: UserData
): Promise<SegmentEvaluationResult | null> {
  const segment = await getSegmentById(segmentId);
  if (!segment) {
    return null;
  }

  // Get user data if not provided
  const data = userData || await fetchUserData(userId);
  if (!data) {
    throw new Error(`User data not found for userId: ${userId}`);
  }

  // Check cache first
  const cached = await getCachedEvaluation(userId, segmentId);
  if (cached && !userData) {
    return cached.result;
  }

  // Evaluate segment
  const result = evaluateSegment(segment, data);

  // Cache result
  await cacheEvaluation(userId, segmentId, result);

  // Check if membership changed
  const previousMembership = await wasUserInSegment(userId, segmentId);

  if (result.matches && !previousMembership) {
    // User entered segment
    await updateMembership(userId, segmentId, segment.name, true);
    emitUserEnteredSegment(userId, segmentId, segment.name, previousMembership);
  } else if (!result.matches && previousMembership) {
    // User exited segment
    await updateMembership(userId, segmentId, segment.name, false);
    emitUserExitedSegment(userId, segmentId, segment.name, previousMembership);
  }

  return result;
}

// Evaluate user against all segments
export async function evaluateUserAllSegments(
  userId: string,
  userData?: UserData
): Promise<SegmentEvaluationResult[]> {
  const segments = await getAllSegments();

  // Get user data if not provided
  const data = userData || await fetchUserData(userId);
  if (!data) {
    throw new Error(`User data not found for userId: ${userId}`);
  }

  // Get current segment membership
  const currentSegments = await getUserSegments(userId);
  const currentSegmentsSet = new Set(currentSegments);

  // Evaluate all segments
  const results = evaluateAllSegments(segments, data);

  // Process membership changes
  const changes: Array<{ segmentId: string; segmentName: string; entered: boolean }> = [];

  for (const result of results) {
    if (result.matches && !currentSegmentsSet.has(result.segmentId)) {
      // User entered segment
      await updateMembership(userId, result.segmentId, result.segmentName, true);
      await addUserToSegment(userId, result.segmentId);
      await addSegmentToUserCache(userId, result.segmentId);
      changes.push({ segmentId: result.segmentId, segmentName: result.segmentName, entered: true });
    } else if (!result.matches && currentSegmentsSet.has(result.segmentId)) {
      // User exited segment
      await updateMembership(userId, result.segmentId, result.segmentName, false);
      await removeUserFromSegment(userId, result.segmentId);
      await removeSegmentFromUserCache(userId, result.segmentId);
      changes.push({ segmentId: result.segmentId, segmentName: result.segmentName, entered: false });
    }

    // Cache the evaluation result
    await cacheEvaluation(userId, result.segmentId, result);
  }

  // Emit webhook events for changes
  for (const change of changes) {
    if (change.entered) {
      emitUserEnteredSegment(userId, change.segmentId, change.segmentName, false);
    } else {
      emitUserExitedSegment(userId, change.segmentId, change.segmentName, true);
    }
  }

  // Update user's segment cache
  const qualifyingSegments = getQualifyingSegments(results).map(r => r.segmentId);
  await setUserSegments(userId, qualifyingSegments);

  return results;
}

// Check if user was previously in segment
async function wasUserInSegment(userId: string, segmentId: string): Promise<boolean> {
  try {
    const membership = await UserSegmentMembershipModel.findOne({
      userId,
      segmentId,
      isActive: true
    }).lean();
    return !!membership;
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
}

// Update membership record
async function updateMembership(
  userId: string,
  segmentId: string,
  segmentName: string,
  isActive: boolean
): Promise<void> {
  try {
    if (isActive) {
      await UserSegmentMembershipModel.findOneAndUpdate(
        { userId, segmentId },
        {
          $set: {
            isActive: true,
            enteredAt: new Date(),
            exitedAt: null,
            lastEvaluatedAt: new Date()
          },
          $setOnInsert: {
            userId,
            segmentId,
            segmentName
          }
        },
        { upsert: true }
      );
    } else {
      await UserSegmentMembershipModel.findOneAndUpdate(
        { userId, segmentId },
        {
          $set: {
            isActive: false,
            exitedAt: new Date(),
            lastEvaluatedAt: new Date()
          }
        }
      );
    }
  } catch (error) {
    console.error('Error updating membership:', error);
  }
}

// Cache helpers
async function addSegmentToUserCache(userId: string, segmentId: string): Promise<void> {
  const segments = await getUserSegments(userId);
  if (!segments.includes(segmentId)) {
    segments.push(segmentId);
    await setUserSegments(userId, segments);
  }
}

async function removeSegmentFromUserCache(userId: string, segmentId: string): Promise<void> {
  const segments = await getUserSegments(userId);
  const filtered = segments.filter(s => s !== segmentId);
  await setUserSegments(userId, filtered);
}

// Fetch user data from external service or return mock
async function fetchUserData(userId: string): Promise<UserData | null> {
  // In production, this would fetch from intent graph or attribution service
  // For now, return mock data structure
  try {
    // Try to fetch from intent graph
    const intentUrl = `${process.env.REZ_INTENT_GRAPH_URL || 'http://localhost:4007'}/api/users/${userId}`;
    const response = await fetch(intentUrl, {
      headers: {
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || ''
      }
    });

    if (response.ok) {
      const data = await response.json();
      return mapExternalUserData(data);
    }
  } catch {
    // Service unavailable, return null
  }

  return null;
}

// Map external data to UserData format
function mapExternalUserData(externalData: Record<string, unknown>): UserData {
  return {
    userId: String(externalData.userId || externalData.id || ''),
    lifetime: {
      totalSpend: Number(externalData.totalSpend || externalData.lifetimeValue || 0),
      totalOrders: Number(externalData.totalOrders || 0),
      avgOrderValue: Number(externalData.avgOrderValue || 0),
      tenureDays: Number(externalData.tenureDays || externalData.accountAgeDays || 0)
    },
    activity: {
      last30Days: {
        orders: Number(externalData.recentOrders || externalData.ordersLast30Days || 0),
        visits: Number(externalData.visitsLast30Days || 0)
      },
      engagement: {
        engagementIndex: Number(externalData.engagementIndex || 0)
      }
    },
    signals: {
      competitor: {
        switchRisk: String(externalData.switchRisk || 'LOW'),
        loyaltyScore: Number(externalData.loyaltyScore || 0)
      },
      behavioral: {
        cashbackSensitivity: Number(externalData.cashbackSensitivity || 0),
        dealSeeking: Number(externalData.dealSeeking || 0),
        luxuryAffinity: Number(externalData.luxuryAffinity || 0)
      },
      social: {
        influenceTier: String(externalData.influenceTier || 'none')
      },
      location: {
        segments: Array.isArray(externalData.locationSegments)
          ? externalData.locationSegments
          : []
      }
    },
    ...externalData
  } as UserData;
}

// Get segment members
export async function getSegmentMembers(
  segmentId: string,
  page = 1,
  limit = 100
): Promise<{ members: string[]; total: number }> {
  const skip = (page - 1) * limit;

  try {
    const [memberships, total] = await Promise.all([
      UserSegmentMembershipModel.find({ segmentId, isActive: true })
        .select('userId')
        .skip(skip)
        .limit(limit)
        .lean(),
      UserSegmentMembershipModel.countDocuments({ segmentId, isActive: true })
    ]);

    return {
      members: memberships.map(m => m.userId),
      total
    };
  } catch (error) {
    console.error('Error fetching segment members:', error);
    throw error;
  }
}

// Get segment statistics
export async function getSegmentStats(segmentId: string): Promise<SegmentStats | null> {
  const segment = await getSegmentById(segmentId);
  if (!segment) {
    return null;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalMembers,
      newMembersToday,
      churnedToday,
      avgDuration
    ] = await Promise.all([
      UserSegmentMembershipModel.countDocuments({ segmentId, isActive: true }),
      UserSegmentMembershipModel.countDocuments({
        segmentId,
        isActive: true,
        enteredAt: { $gte: today, $lte: todayEnd }
      }),
      UserSegmentMembershipModel.countDocuments({
        segmentId,
        isActive: false,
        exitedAt: { $gte: today, $lte: todayEnd }
      }),
      getAverageMembershipDuration(segmentId)
    ]);

    return {
      segmentId,
      segmentName: segment.name,
      totalMembers,
      newMembersToday,
      churnedMembersToday: churnedToday,
      avgMembershipDuration: avgDuration,
      lastRefreshed: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching segment stats:', error);
    throw error;
  }
}

// Calculate average membership duration
async function getAverageMembershipDuration(segmentId: string): Promise<number> {
  const result = await UserSegmentMembershipModel.aggregate([
    { $match: { segmentId, isActive: true } },
    {
      $project: {
        durationDays: {
          $divide: [
            { $subtract: [new Date(), '$enteredAt'] },
            1000 * 60 * 60 * 24 // Convert ms to days
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgDuration: { $avg: '$durationDays' }
      }
    }
  ]);

  return result.length > 0 ? Math.round(result[0].avgDuration) : 0;
}

// Trigger segment evaluation job
export async function triggerSegmentEvaluation(segmentId: string): Promise<{
  jobId: string;
  status: string;
}> {
  const jobId = `job-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;

  // Create job record
  await SegmentEvaluationJobModel.create({
    jobId,
    segmentId,
    status: 'pending',
    startedAt: new Date()
  });

  // Start async processing
  processSegmentEvaluation(jobId, segmentId);

  return { jobId, status: 'pending' };
}

// Process segment evaluation asynchronously
async function processSegmentEvaluation(jobId: string, segmentId: string): Promise<void> {
  try {
    await SegmentEvaluationJobModel.findOneAndUpdate(
      { jobId },
      { status: 'processing' }
    );

    // In production, this would batch process all users
    // For now, just update the job as completed
    await SegmentEvaluationJobModel.findOneAndUpdate(
      { jobId },
      {
        status: 'completed',
        completedAt: new Date(),
        usersProcessed: 0,
        usersMatched: 0
      }
    );
  } catch (error) {
    await SegmentEvaluationJobModel.findOneAndUpdate(
      { jobId },
      {
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
}

// Get job status
export async function getJobStatus(jobId: string): Promise<{
  jobId: string;
  status: string;
  usersProcessed: number;
  usersMatched: number;
} | null> {
  const job = await SegmentEvaluationJobModel.findOne({ jobId }).lean();
  if (!job) {
    return null;
  }

  return {
    jobId: job.jobId,
    status: job.status,
    usersProcessed: job.usersProcessed,
    usersMatched: job.usersMatched
  };
}

// Get user's current segments
export async function getUserCurrentSegments(userId: string): Promise<string[]> {
  return getUserSegments(userId);
}

// Refresh segment definitions from database
export async function refreshSegmentDefinitions(): Promise<SegmentDefinition[]> {
  return getAllSegments();
}

// Create a new segment
export async function createSegment(
  segment: Omit<SegmentDefinition, 'refreshInterval'> & { refreshInterval?: number }
): Promise<SegmentDefinition> {
  try {
    // Check if segment already exists
    const existing = await getSegmentById(segment.segmentId);
    if (existing) {
      throw new Error(`Segment already exists: ${segment.segmentId}`);
    }

    // Validate and transform rules with default logic
    const validatedSegment = SegmentDefinitionSchema.parse({
      segmentId: segment.segmentId,
      name: segment.name,
      description: segment.description || '',
      rules: segment.rules,
      refreshInterval: segment.refreshInterval || 60
    });

    // Create in database
    await SegmentDefinitionModel.create({
      segmentId: validatedSegment.segmentId,
      name: validatedSegment.name,
      description: validatedSegment.description,
      rules: validatedSegment.rules,
      refreshInterval: validatedSegment.refreshInterval,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return validatedSegment;
  } catch (error) {
    // If DB fails, return the segment as-is (will be in-memory only)
    console.warn('Failed to create segment in DB, using in-memory:', error);
    return {
      segmentId: segment.segmentId,
      name: segment.name,
      description: segment.description || '',
      rules: segment.rules,
      refreshInterval: segment.refreshInterval || 60,
    };
  }
}

// Update an existing segment
export async function updateSegment(
  segmentId: string,
  updates: Partial<SegmentDefinition>
): Promise<SegmentDefinition | null> {
  try {
    const updated = await SegmentDefinitionModel.findOneAndUpdate(
      { segmentId },
      {
        $set: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.rules && { rules: updates.rules }),
          ...(updates.refreshInterval && { refreshInterval: updates.refreshInterval }),
          updatedAt: new Date(),
        },
      },
      { new: true, lean: true }
    );

    if (updated) {
      return {
        segmentId: updated.segmentId,
        name: updated.name,
        description: updated.description,
        rules: updated.rules as SegmentDefinition['rules'],
        refreshInterval: updated.refreshInterval,
      };
    }
  } catch (error) {
    console.error('Failed to update segment in DB:', error);
  }

  // Fallback: update in-memory
  const inMemory = findSegmentById(segmentId);
  if (inMemory) {
    return {
      ...inMemory,
      ...updates,
    };
  }

  return null;
}

// Delete a segment
export async function deleteSegment(segmentId: string): Promise<boolean> {
  try {
    const result = await SegmentDefinitionModel.findOneAndUpdate(
      { segmentId },
      { $set: { isActive: false, deletedAt: new Date() } }
    );

    return !!result;
  } catch (error) {
    console.error('Failed to delete segment:', error);
    return false;
  }
}

// Export segment members
export async function exportSegmentMembers(
  segmentId: string,
  format: 'json' | 'csv' = 'json',
  includeMetadata = false
): Promise<string | null> {
  const segment = await getSegmentById(segmentId);
  if (!segment) {
    return null;
  }

  try {
    const memberships = await UserSegmentMembershipModel.find({
      segmentId,
      isActive: true,
    }).lean();

    if (format === 'csv') {
      const headers = includeMetadata
        ? 'userId,segmentId,segmentName,enteredAt,exitedAt,isActive'
        : 'userId';
      const rows = memberships.map((m) =>
        includeMetadata
          ? `${m.userId},${m.segmentId},${m.segmentName},${m.enteredAt},${m.exitedAt || ''},${m.isActive}`
          : m.userId
      );
      return [headers, ...rows].join('\n');
    }

    return JSON.stringify(
      includeMetadata
        ? memberships.map((m) => ({
            userId: m.userId,
            segmentId: m.segmentId,
            segmentName: m.segmentName,
            enteredAt: m.enteredAt,
            exitedAt: m.exitedAt,
            isActive: m.isActive,
          }))
        : memberships.map((m) => m.userId),
      null,
      2
    );
  } catch (error) {
    console.error('Failed to export segment members:', error);
    return null;
  }
}

// Segment analytics
export interface SegmentAnalytics {
  segmentId: string;
  segmentName: string;
  period: 'daily' | 'weekly' | 'monthly';
  totalMembers: number;
  newMembers: number;
  exitedMembers: number;
  netChange: number;
  growthRate: number;
  memberTrend: Array<{ date: string; count: number }>;
  avgMembershipDuration: number;
  topEntranceReasons: Array<{ reason: string; count: number }>;
  topExitReasons: Array<{ reason: string; count: number }>;
}

export async function getSegmentAnalytics(
  segmentId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<SegmentAnalytics | null> {
  const segment = await getSegmentById(segmentId);
  if (!segment) {
    return null;
  }

  try {
    const now = new Date();
    let startDate: Date;
    let dateFormat: string;
    let groupFormat: string;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFormat = '%Y-%m-%d';
        groupFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
        dateFormat = '%Y-W%v';
        groupFormat = '%Y-W%v';
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        dateFormat = '%Y-%m';
        groupFormat = '%Y-%m';
        break;
    }

    // Get current total
    const totalMembers = await UserSegmentMembershipModel.countDocuments({
      segmentId,
      isActive: true,
    });

    // Get new members in period
    const newMembers = await UserSegmentMembershipModel.countDocuments({
      segmentId,
      isActive: true,
      enteredAt: { $gte: startDate },
    });

    // Get exited members in period
    const exitedMembers = await UserSegmentMembershipModel.countDocuments({
      segmentId,
      isActive: false,
      exitedAt: { $gte: startDate },
    });

    // Get member trend
    const trendData = await UserSegmentMembershipModel.aggregate([
      {
        $match: {
          segmentId,
          enteredAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: '$enteredAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Calculate average membership duration
    const avgDurationResult = await UserSegmentMembershipModel.aggregate([
      { $match: { segmentId, isActive: true } },
      {
        $project: {
          durationDays: {
            $divide: [{ $subtract: [new Date(), '$enteredAt'] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$durationDays' },
        },
      },
    ]);

    const avgMembershipDuration = avgDurationResult.length > 0 ? avgDurationResult[0].avgDuration : 0;

    return {
      segmentId,
      segmentName: segment.name,
      period,
      totalMembers,
      newMembers,
      exitedMembers,
      netChange: newMembers - exitedMembers,
      growthRate: totalMembers > 0 ? ((newMembers - exitedMembers) / totalMembers) * 100 : 0,
      memberTrend: trendData.map((d) => ({ date: d._id, count: d.count })),
      avgMembershipDuration: Math.round(avgMembershipDuration * 10) / 10,
      topEntranceReasons: [],
      topExitReasons: [],
    };
  } catch (error) {
    console.error('Failed to get segment analytics:', error);
    return null;
  }
}

// Refresh segment definitions
export async function refreshSegmentDefinitions(): Promise<SegmentDefinition[]> {
  return getAllSegments();
}

export default {
  getAllSegments,
  getSegmentById,
  evaluateUserSegment,
  evaluateUserAllSegments,
  getSegmentMembers,
  getSegmentStats,
  triggerSegmentEvaluation,
  getJobStatus,
  getUserCurrentSegments,
  refreshSegmentDefinitions,
  createSegment,
  updateSegment,
  deleteSegment,
  exportSegmentMembers,
  getSegmentAnalytics,
};

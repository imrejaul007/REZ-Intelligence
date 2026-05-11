/**
 * REZ Intelligence Hub - Monitoring Dashboard Routes
 *
 * Provides metrics and health status for REZ Mind services
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_intelligence';

/**
 * GET /api/dashboard/stats
 * Get overall REZ Mind statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats: Record<string, any> = {
      timestamp: now.toISOString(),
      services: {
        intelligenceHub: { status: 'healthy', port: 4020 },
        intentGraph: { status: 'unknown', port: 3007 },
        personalization: { status: 'unknown', port: 4017 },
        recommendation: { status: 'unknown', port: 4015 },
        targeting: { status: 'unknown', port: 3013 },
        actionEngine: { status: 'unknown', port: 3014 },
      },
    };

    // Try to connect to Intent Graph DB for stats
    try {
      await mongoose.connect(MONGODB_URI.replace('rez_intelligence', 'rez_intent_graph'));

      const Intent = mongoose.models.Intent || mongoose.model('Intent', new mongoose.Schema({
        userId: String,
        status: String,
        category: String,
        lastSeenAt: Date,
      }, { collection: 'intents' }));

      // Get stats
      const [totalIntents, activeUsers, dormantUsers, fulfilledIntents] = await Promise.all([
        Intent.countDocuments(),
        Intent.countDocuments({ status: 'ACTIVE' }),
        Intent.countDocuments({ status: 'DORMANT' }),
        Intent.countDocuments({ status: 'FULFILLED' }),
      ]);

      const recentIntents = await Intent.countDocuments({ lastSeenAt: { $gte: oneDayAgo } });
      const weeklyIntents = await Intent.countDocuments({ lastSeenAt: { $gte: oneWeekAgo } });

      stats.intentGraph = {
        status: 'healthy',
        totalIntents,
        activeUsers,
        dormantUsers,
        fulfilledIntents,
        recentIntents24h: recentIntents,
        weeklyIntents,
        fulfillmentRate: totalIntents > 0 ? (fulfilledIntents / totalIntents * 100).toFixed(2) + '%' : '0%',
      };

      await mongoose.disconnect();
    } catch (err) {
      stats.intentGraph = { status: 'unavailable', error: 'Could not connect' };
    }

    // Try Personalization DB
    try {
      await mongoose.connect(MONGODB_URI);

      const UserProfile = mongoose.models.UserProfile || mongoose.model('UserProfile', new mongoose.Schema({
        userId: String,
        segments: [String],
        updatedAt: Date,
      }, { collection: 'user_profiles' }));

      const totalProfiles = await UserProfile.countDocuments();
      const recentlyUpdated = await UserProfile.countDocuments({ updatedAt: { $gte: oneDayAgo } });

      stats.personalization = {
        status: 'healthy',
        totalProfiles,
        recentlyUpdated24h: recentlyUpdated,
      };

      await mongoose.disconnect();
    } catch (err) {
      stats.personalization = { status: 'unavailable', error: 'Could not connect' };
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Dashboard] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/dashboard/segments
 * Get user segment distribution
 */
router.get('/segments', async (req: Request, res: Response) => {
  try {
    await mongoose.connect(MONGODB_URI);

    const UserProfile = mongoose.models.UserProfile || mongoose.model('UserProfile', new mongoose.Schema({
      userId: String,
      segments: [String],
    }, { collection: 'user_profiles' }));

    const segments = await UserProfile.aggregate([
      { $unwind: '$segments' },
      { $group: { _id: '$segments', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    await mongoose.disconnect();

    res.json({
      success: true,
      data: {
        segments: segments.map(s => ({ name: s._id, count: s.count })),
        total: segments.reduce((sum, s) => sum + s.count, 0),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch segments' });
  }
});

/**
 * GET /api/dashboard/dormancy
 * Get dormancy report
 */
router.get('/dormancy', async (req: Request, res: Response) => {
  try {
    await mongoose.connect(MONGODB_URI);

    const DormancyReport = mongoose.models.DormancyReport || mongoose.model('DormancyReport', new mongoose.Schema({
      userId: String,
      category: String,
      daysSinceActive: Number,
      reEngagementSent: Boolean,
    }, { collection: 'dormancy_reports' }));

    const [total, sent, pending] = await Promise.all([
      DormancyReport.countDocuments(),
      DormancyReport.countDocuments({ reEngagementSent: true }),
      DormancyReport.countDocuments({ reEngagementSent: false }),
    ]);

    await mongoose.disconnect();

    res.json({
      success: true,
      data: {
        totalDormantUsers: total,
        reEngagementSent,
        reEngagementPending: pending,
        reEngagementRate: total > 0 ? (sent / total * 100).toFixed(2) + '%' : '0%',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch dormancy' });
  }
});

/**
 * GET /api/dashboard/health
 * Overall system health
 */
router.get('/health', async (req: Request, res: Response) => {
  const checks: Record<string, any> = {};
  let overallHealthy = true;

  // Check MongoDB
  try {
    await mongoose.connect(MONGODB_URI);
    await mongoose.connection.db?.admin().ping();
    checks.mongodb = { status: 'healthy' };
    await mongoose.disconnect();
  } catch {
    checks.mongodb = { status: 'unhealthy' };
    overallHealthy = false;
  }

  // Check Intent Graph
  try {
    const response = await fetch(`${process.env.INTENT_GRAPH_URL || 'https://rez-intent-graph.onrender.com'}/health`, { timeout: 3000 });
    checks.intentGraph = { status: response.ok ? 'healthy' : 'unhealthy' };
  } catch {
    checks.intentGraph = { status: 'unavailable' };
  }

  // Check Personalization
  try {
    const response = await fetch(`${process.env.PERSONALIZATION_URL || 'https://rez-personalization-service.onrender.com'}/health`, { timeout: 3000 });
    checks.personalization = { status: response.ok ? 'healthy' : 'unhealthy' };
  } catch {
    checks.personalization = { status: 'unavailable' };
  }

  res.json({
    success: true,
    data: {
      overall: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
  });
});

export default router;

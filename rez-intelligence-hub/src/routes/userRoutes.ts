/**
 * REZ Intelligence Hub - User Routes
 *
 * Provides user profile and intelligence endpoints
 */

import { Router, Request, Response } from 'express';
import { userIntelligence } from '../services/userIntelligenceService';

const router = Router();

// Validation schemas
const userIdParams = {
  params: {
    userId: { type: 'string', required: true }
  }
};

const paginationQuery = {
  query: {
    limit: { type: 'number', required: false, default: 20 },
    offset: { type: 'number', required: false, default: 0 }
  }
};

/**
 * GET /api/intelligence/user/:userId/intents
 * Get user's active intents from Intent Graph
 */
router.get('/user/:userId/intents', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const intents = await userIntelligence.getUserIntents(userId, limit);

    res.json({
      success: true,
      data: {
        userId,
        count: intents.length,
        intents
      }
    });
  } catch (error) {
    console.error('[UserRoutes] Error fetching intents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch intents'
    });
  }
});

/**
 * GET /api/intelligence/user/:userId/profile
 * Get user's enriched profile from Intent Graph
 */
router.get('/user/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const profile = await userIntelligence.getUserProfile(userId);

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('[UserRoutes] Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

/**
 * GET /api/intelligence/users/by-intent
 * Get users filtered by intent category
 */
router.get('/users/by-intent', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    const limit = parseInt(req.query.limit as string) || 100;

    const userIds = await userIntelligence.getUsersWithIntent(category, limit);

    res.json({
      success: true,
      data: {
        count: userIds.length,
        category: category || 'all',
        userIds
      }
    });
  } catch (error) {
    console.error('[UserRoutes] Error fetching users by intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/intelligence/users/dormant
 * Get dormant users for re-engagement
 */
router.get('/users/dormant', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 100;

    const dormantUsers = await userIntelligence.getDormantUsers(days, limit);

    res.json({
      success: true,
      data: {
        count: dormantUsers.length,
        thresholdDays: days,
        users: dormantUsers
      }
    });
  } catch (error) {
    console.error('[UserRoutes] Error fetching dormant users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dormant users'
    });
  }
});

/**
 * GET /api/intelligence/segments
 * Get all user segments
 */
router.get('/segments', async (req: Request, res: Response) => {
  try {
    const { userIntelligence } = require('../services/userIntelligenceService');

    // Get sample users for each segment
    const segments = ['travel_lover', 'foodie', 'shopper', 'multi_category'];
    const segmentUsers: Record<string, string[]> = {};

    for (const segment of segments) {
      const users = await userIntelligence.getUsersWithIntent(undefined, 10);
      segmentUsers[segment] = users.slice(0, 5);
    }

    res.json({
      success: true,
      data: {
        segments: Object.keys(segmentUsers),
        counts: segmentUsers
      }
    });
  } catch (error) {
    console.error('[UserRoutes] Error fetching segments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch segments'
    });
  }
});

/**
 * GET /api/intelligence/stats
 * Get intelligence hub statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'operational',
        features: [
          'user_profiles',
          'intent_tracking',
          'dormancy_detection',
          'segmentation',
          'predictions'
        ],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[UserRoutes] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

export default router;

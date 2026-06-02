/**
 * REZ RL Learning Service - API Routes
 * REST API endpoints for bandit operations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getBanditEngine } from '../services/banditEngine.js';
import { getExplorationEngine } from '../services/explorationEngine.js';
import { getPolicyManager } from '../services/policyManager.js';
import { getModelUpdater } from '../services/modelUpdater.js';
import {
  PolicyType,
  PolicyConfig,
  Arm,
  SelectionRequest,
  RewardRequest,
} from '../types/index.js';

// Validation schemas
const ArmSchema = z.object({
  armId: z.string().min(1),
  name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const PolicyConfigSchema = z.object({
  type: z.enum(['epsilon-greedy', 'ucb1', 'thompson-sampling']),
  epsilon: z.number().min(0).max(1).optional(),
  ucbConfidence: z.number().positive().optional(),
  thompsonAlpha: z.number().positive().optional(),
  thompsonBeta: z.number().positive().optional(),
  decayRate: z.number().min(0).max(1).optional(),
  minEpsilon: z.number().min(0).max(1).optional(),
});

const BanditSelectSchema = z.object({
  banditId: z.string().min(1),
  userId: z.string().min(1),
  arms: z.array(ArmSchema).min(1),
  policy: PolicyConfigSchema,
  context: z.record(z.unknown()).optional(),
});

const RewardRecordSchema = z.object({
  banditId: z.string().min(1),
  armId: z.string().min(1),
  userId: z.string().min(1),
  reward: z.number().min(0).max(1),
  rewardType: z.enum(['click', 'conversion', 'purchase', 'engagement', 'rating', 'custom']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ExploreSchema = z.object({
  banditId: z.string().min(1),
  userId: z.string().min(1),
  excludeArms: z.array(z.string()).optional(),
});

const PolicySwitchSchema = z.object({
  banditId: z.string().min(1),
  policyType: z.enum(['epsilon-greedy', 'ucb1', 'thompson-sampling']),
});

const PolicyUpdateSchema = z.object({
  banditId: z.string().min(1),
  params: PolicyConfigSchema,
});

export function createRlRoutes(): Router {
  const router = Router();
  const banditEngine = getBanditEngine();
  const explorationEngine = getExplorationEngine();
  const policyManager = getPolicyManager();
  const modelUpdater = getModelUpdater();

  // Health check
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await banditEngine.healthCheck();
      res.json({
        success: true,
        data: health,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        timestamp: Date.now(),
      });
    }
  });

  // POST /api/bandit/select - Select best action using epsilon-greedy
  router.post('/bandit/select', async (req: Request, res: Response) => {
    try {
      const validation = BanditSelectSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
          timestamp: Date.now(),
        });
        return;
      }

      const request: SelectionRequest = {
        ...validation.data,
        policy: validation.data.policy as PolicyConfig,
      };

      const result = await banditEngine.selectArm(request);

      // Record selection for exploration tracking
      await explorationEngine.recordSelection(
        request.userId,
        result.selectedArm.armId,
        0, // No reward yet
        result.isExploration
      );

      res.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Bandit select error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Selection failed',
        timestamp: Date.now(),
      });
    }
  });

  // POST /api/reward/record - Record reward feedback
  router.post('/reward/record', async (req: Request, res: Response) => {
    try {
      const validation = RewardRecordSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
          timestamp: Date.now(),
        });
        return;
      }

      const request: RewardRequest = validation.data;
      const record = await banditEngine.recordReward(request);

      // Queue model update
      await modelUpdater.queueUpdate(request.banditId, request.armId, request.reward);

      res.json({
        success: true,
        data: record,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Reward record error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Reward recording failed',
        timestamp: Date.now(),
      });
    }
  });

  // GET /api/policy/:userId - Get user's current policy
  router.get('/policy/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Get exploration stats
      const explorationStats = await explorationEngine.getExplorationStats(userId);

      // Get adaptive epsilon
      const recommendedEpsilon = await explorationEngine.getAdaptiveEpsilon(userId);

      // Get exploration summary
      const summary = await explorationEngine.getExplorationSummary(userId);

      res.json({
        success: true,
        data: {
          userId,
          explorationStats,
          recommendedEpsilon,
          ...summary,
          lastUpdated: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Get policy error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get policy',
        timestamp: Date.now(),
      });
    }
  });

  // POST /api/explore - Force exploration
  router.post('/explore', async (req: Request, res: Response) => {
    try {
      const validation = ExploreSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
          timestamp: Date.now(),
        });
        return;
      }

      const { banditId, excludeArms = [] } = validation.data;

      // Force exploration by selecting an arm to explore
      const forcedArmId = await explorationEngine.forceExploration(banditId, excludeArms);

      if (!forcedArmId) {
        res.status(404).json({
          success: false,
          error: 'Bandit not found or no arms available',
          timestamp: Date.now(),
        });
        return;
      }

      // Get exploration stats
      const stats = await explorationEngine.getExplorationStats(validation.data.userId);

      res.json({
        success: true,
        data: {
          banditId,
          forcedArmId,
          reason: 'Exploration triggered',
          stats,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Force explore error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Exploration failed',
        timestamp: Date.now(),
      });
    }
  });

  // GET /api/bandit/:banditId - Get bandit state
  router.get('/bandit/:banditId', async (req: Request, res: Response) => {
    try {
      const { banditId } = req.params;

      const state = await banditEngine.getBanditState(banditId);

      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Bandit not found',
          timestamp: Date.now(),
        });
        return;
      }

      res.json({
        success: true,
        data: state,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Get bandit error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bandit',
        timestamp: Date.now(),
      });
    }
  });

  // GET /api/bandit/:banditId/performance - Get performance summary
  router.get('/bandit/:banditId/performance', async (req: Request, res: Response) => {
    try {
      const { banditId } = req.params;

      const summary = await banditEngine.getPerformanceSummary(banditId);

      if (!summary) {
        res.status(404).json({
          success: false,
          error: 'Bandit not found',
          timestamp: Date.now(),
        });
        return;
      }

      res.json({
        success: true,
        data: summary,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Get performance error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get performance',
        timestamp: Date.now(),
      });
    }
  });

  // GET /api/bandit/:banditId/recommendations - Get top recommendations
  router.get('/bandit/:banditId/recommendations', async (req: Request, res: Response) => {
    try {
      const { banditId } = req.params;
      const count = parseInt(req.query.count as string) || 5;

      const recommendations = await banditEngine.getRecommendations(banditId, '', count);

      res.json({
        success: true,
        data: recommendations,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recommendations',
        timestamp: Date.now(),
      });
    }
  });

  // POST /api/policy/switch - Switch bandit policy
  router.post('/policy/switch', async (req: Request, res: Response) => {
    try {
      const validation = PolicySwitchSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
          timestamp: Date.now(),
        });
        return;
      }

      const { banditId, policyType } = validation.data;
      const updated = await policyManager.switchPolicy(banditId, policyType);

      if (!updated) {
        res.status(404).json({
          success: false,
          error: 'Bandit not found',
          timestamp: Date.now(),
        });
        return;
      }

      res.json({
        success: true,
        data: updated,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Policy switch error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch policy',
        timestamp: Date.now(),
      });
    }
  });

  // PATCH /api/policy/update - Update policy parameters
  router.patch('/policy/update', async (req: Request, res: Response) => {
    try {
      const validation = PolicyUpdateSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
          timestamp: Date.now(),
        });
        return;
      }

      const { banditId, params } = validation.data;

      try {
        const updated = await policyManager.updatePolicyParams(banditId, params);

        if (!updated) {
          res.status(404).json({
            success: false,
            error: 'Bandit not found',
            timestamp: Date.now(),
          });
          return;
        }

        res.json({
          success: true,
          data: updated,
          timestamp: Date.now(),
        });
      } catch (policyError) {
        res.status(400).json({
          success: false,
          error: policyError instanceof Error ? policyError.message : 'Invalid policy parameters',
          timestamp: Date.now(),
        });
        return;
      }
    } catch (error) {
      console.error('Policy update error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update policy',
        timestamp: Date.now(),
      });
    }
  });

  // POST /api/bandit/:banditId/reset - Reset bandit to initial state
  router.post('/bandit/:banditId/reset', async (req: Request, res: Response) => {
    try {
      const { banditId } = req.params;

      const reset = await banditEngine.resetBandit(banditId);

      if (!reset) {
        res.status(404).json({
          success: false,
          error: 'Bandit not found',
          timestamp: Date.now(),
        });
        return;
      }

      res.json({
        success: true,
        data: reset,
        message: 'Bandit reset successfully',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Reset bandit error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset bandit',
        timestamp: Date.now(),
      });
    }
  });

  // GET /api/exploration/:userId/stats - Get exploration statistics
  router.get('/exploration/:userId/stats', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const stats = await explorationEngine.getExplorationStats(userId);

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Get exploration stats error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get exploration stats',
        timestamp: Date.now(),
      });
    }
  });

  // POST /api/exploration/:userId/adapt - Adapt exploration rate
  router.post('/exploration/:userId/adapt', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const rewards = req.body.rewards as number[];

      if (!Array.isArray(rewards)) {
        res.status(400).json({
          success: false,
          error: 'rewards must be an array of numbers',
          timestamp: Date.now(),
        });
        return;
      }

      const newRate = await explorationEngine.adaptExplorationRate(userId, rewards);

      res.json({
        success: true,
        data: {
          userId,
          newExplorationRate: newRate,
          rewardCount: rewards.length,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Adapt exploration error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adapt exploration',
        timestamp: Date.now(),
      });
    }
  });

  // GET /api/bandit/:banditId/arm/:armId/stats - Get arm statistics
  router.get('/bandit/:banditId/arm/:armId/stats', async (req: Request, res: Response) => {
    try {
      const { banditId, armId } = req.params;

      const stats = await banditEngine.getArmStats(banditId, armId);

      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Arm not found',
          timestamp: Date.now(),
        });
        return;
      }

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Get arm stats error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get arm stats',
        timestamp: Date.now(),
      });
    }
  });

  // POST /api/bandit/:banditId/arm/:armId/recompute - Recompute arm statistics
  router.post('/bandit/:banditId/arm/:armId/recompute', async (req: Request, res: Response) => {
    try {
      const { banditId, armId } = req.params;

      const stats = await modelUpdater.recomputeStats(banditId, armId);

      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Arm not found',
          timestamp: Date.now(),
        });
        return;
      }

      res.json({
        success: true,
        data: stats,
        message: 'Statistics recomputed successfully',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Recompute stats error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to recompute statistics',
        timestamp: Date.now(),
      });
    }
  });

  return router;
}

export { createRlRoutes as router };

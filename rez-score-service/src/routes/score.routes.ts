/**
 * Score Routes
 */

import { Router, Request, Response } from 'express';
import { ReZScoreService } from '../services/ReZScoreService';
import { redis, getLeaderboardKey } from '../config/redis';

const router = Router();
const service = new ReZScoreService();

// Get score
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const score = await service.getScore(req.params.userId);
    res.json({ success: true, data: score });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get score' });
  }
});

// Calculate score
router.post('/:userId/calculate', async (req: Request, res: Response) => {
  try {
    const score = await service.calculateScore(req.params.userId, req.body);
    res.json({ success: true, data: score });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

// Get breakdown
router.get('/:userId/breakdown', async (req: Request, res: Response) => {
  try {
    const score = await service.getScore(req.params.userId);
    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    res.json({
      success: true,
      data: {
        composite: score.composite,
        breakdown: {
          engagement: score.engagement,
          spending: score.spending,
          karma: score.karma,
          social: score.social,
          streak: score.streak,
          crossMerchant: score.crossMerchant,
        },
        tier: score.tier,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get breakdown' });
  }
});

// Get progress to next tier
router.get('/:userId/next-tier', async (req: Request, res: Response) => {
  try {
    const score = await service.getScore(req.params.userId);
    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    const nextTier = service.getNextTier(score.tier);
    const progress = service.calculateProgress(score.composite, score.tier);

    res.json({
      success: true,
      data: {
        currentTier: score.tier,
        currentScore: score.composite,
        nextTier: nextTier?.tier,
        nextThreshold: nextTier?.threshold,
        progress: Math.round(progress),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// Get leaderboard
router.get('/leaderboard/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { limit = '50' } = req.query;

    const key = getLeaderboardKey(type);
    const results = await redis.zrevrange(key, 0, parseInt(limit as string) - 1, 'WITHSCORES');

    const leaderboard = [];
    for (let i = 0; i < results.length; i += 2) {
      leaderboard.push({
        userId: results[i],
        score: parseInt(results[i + 1]),
        rank: Math.floor(i / 2) + 1,
      });
    }

    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get user rank
router.get('/leaderboard/:userId/rank', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type = 'all' } = req.query;

    const key = getLeaderboardKey(type as string);
    const rank = await redis.zrevrank(key, userId);

    if (rank === null) {
      return res.status(404).json({ error: 'User not in leaderboard' });
    }

    const score = await redis.zscore(key, userId);
    const total = await redis.zcard(key);

    res.json({
      success: true,
      data: {
        rank: rank + 1,
        score: parseInt(score || '0'),
        total,
        percentile: Math.round(((total - rank) / total) * 100),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rank' });
  }
});

export { router as scoreRoutes };

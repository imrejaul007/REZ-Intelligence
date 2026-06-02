/**
 * Profile Routes
 */

import { Router, Request, Response } from 'express';
import { ProfileAggregator } from '../services/ProfileAggregator';

const router = Router();
const aggregator = new ProfileAggregator();

// Get full profile
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await aggregator.getProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get profile summary
router.get('/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await aggregator.getProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      success: true,
      data: {
        userId: profile.userId,
        reZScore: {
          composite: profile.reZScore.composite,
          tier: profile.reZScore.tier,
        },
        wallet: {
          total: profile.wallet.totalValue,
          coins: profile.wallet.balances.rez,
          cashback: profile.wallet.balances.cashback,
        },
        loyalty: {
          points: profile.loyalty.totalPoints,
          streak: profile.loyalty.streak.current,
          tier: profile.loyalty.globalTier,
        },
        karma: {
          level: profile.karma.level,
          score: profile.karma.score,
        },
        gamification: {
          level: profile.gamification.level,
          xp: profile.gamification.xp,
          achievements: profile.gamification.achievements.length,
        },
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get profile summary' });
  }
});

// Get behavior data
router.get('/:userId/behavior', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await aggregator.getProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      success: true,
      data: {
        avgOrderValue: profile.behavior.avgOrderValue,
        orderFrequency: profile.behavior.orderFrequency,
        preferredCategories: profile.behavior.preferredCategories,
        priceRange: profile.behavior.priceRange,
        churnRisk: profile.behavior.churnRisk,
        ltv: profile.behavior.ltv,
        bestContactTime: profile.behavior.bestContactTime,
        preferredChannel: profile.behavior.preferredChannel,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get behavior data' });
  }
});

// Get ReZ Score
router.get('/:userId/score', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await aggregator.getProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      success: true,
      data: profile.reZScore,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get score' });
  }
});

// Recalculate score
router.post('/:userId/recalculate', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await aggregator.recalculateReZScore(userId);
    const profile = await aggregator.getProfile(userId);

    res.json({ success: true, data: profile?.reZScore });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to recalculate score' });
  }
});

// Get streak data
router.get('/:userId/streak', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const summary = await aggregator.getLoyaltySummary(userId);

    res.json({
      success: true,
      data: summary.streak || { currentStreak: 0, longestStreak: 0 },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get streak data' });
  }
});

// Get cross-merchant data
router.get('/:userId/cross-merchant', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const summary = await aggregator.getLoyaltySummary(userId);

    res.json({
      success: true,
      data: summary.crossMerchant || { totalMerchantsVisited: 0, badgesEarned: [] },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get cross-merchant data' });
  }
});

// Get karma-bridge stats
router.get('/:userId/karma-bridge', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const summary = await aggregator.getLoyaltySummary(userId);

    res.json({
      success: true,
      data: summary.karmaBridge || { totalKarmaConverted: 0, totalLoyaltyAwarded: 0 },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get karma-bridge stats' });
  }
});

// Get full loyalty summary (streak + cross-merchant + karma-bridge)
router.get('/:userId/loyalty-summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const summary = await aggregator.getLoyaltySummary(userId);

    res.json({
      success: true,
      data: {
        streak: summary.streak || null,
        crossMerchant: summary.crossMerchant || null,
        karmaBridge: summary.karmaBridge || null,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get loyalty summary' });
  }
});

export { router as profileRoutes };

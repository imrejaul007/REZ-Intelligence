import { Router } from 'express';
import { profileService } from '../services/profiles';
import { scoringService } from '../services/scoring';
import { adaptiveScoringService } from '../services/scoring';

const router = Router();

// GET /profiles/:userId
router.get('/:userId', async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.params.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /profiles/:userId/scores
router.post('/:userId/scores', async (req, res) => {
  try {
    const scores = await scoringService.calculateScores(req.params.userId);
    res.json({ success: true, data: scores });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /profiles/:userId/recommendations
router.get('/:userId/recommendations', async (req, res) => {
  try {
    const { limit } = req.query;
    const recommendations = await profileService.getRecommendations(
      req.params.userId,
      parseInt(limit as string) || 10
    );
    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /profiles/:userId/segments
router.get('/:userId/segments', async (req, res) => {
  try {
    const segments = await profileService.getSegments(req.params.userId);
    res.json({ success: true, data: segments });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /profiles/:userId/lifetime-value
router.get('/:userId/lifetime-value', async (req, res) => {
  try {
    const ltv = await profileService.getLifetimeValue(req.params.userId);
    res.json({ success: true, data: ltv });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /profiles/:userId/churn-risk
router.get('/:userId/churn-risk', async (req, res) => {
  try {
    const churnRisk = await profileService.getChurnRisk(req.params.userId);
    res.json({ success: true, data: churnRisk });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export { router as profileRoutes };

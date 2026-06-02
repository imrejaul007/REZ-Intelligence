import { Router } from 'express';
import { dormantIntentService } from '../services/dormancy';
import { adaptiveScoringService } from '../services/scoring';
import { z } from 'zod';

const router = Router();
const dormantService = new dormantIntentService();
const scoringService = adaptiveScoringService;

// POST /dormant/mark
router.post('/mark/:intentId', async (req, res) => {
  try {
    const result = await dormantService.markDormant(req.params.intentId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /dormant/detect
router.post('/detect', async (req, res) => {
  try {
    const { days } = req.body;
    const count = await dormantService.detectAndMarkDormant(days);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /dormant/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const intents = await dormantService.getUserDormantIntents(req.params.userId);
    res.json({ success: true, data: intents });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /dormant/score/:intentId
router.get('/score/:intentId', async (req, res) => {
  try {
    const score = await dormantService.calculateRevivalScore(req.params.intentId);
    res.json({ success: true, score });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /dormant/trigger/:intentId
router.post('/trigger/:intentId', async (req, res) => {
  try {
    const { triggerType } = req.body;
    const result = await dormantService.triggerRevival(req.params.intentId, triggerType);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /dormant/revive/:intentId
router.post('/revive/:intentId', async (req, res) => {
  try {
    await dormantService.markRevived(req.params.intentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /dormant/optimal-time
router.get('/optimal-time', async (req, res) => {
  try {
    const { category, dormantDays } = req.query;
    const optimalTime = dormantService.calculateIdealNudgeTime(
      category as string,
      parseInt(dormantDays as string) || 0
    );
    res.json({ success: true, optimalTime });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export { router as dormantRoutes };

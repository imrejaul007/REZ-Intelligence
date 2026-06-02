import { Router } from 'express';
import { intentService } from '../services/intentService';

const router = Router();
const service = intentService;

// GET /intents/active/:userId
router.get('/active/:userId', async (req, res) => {
  try {
    const intents = await service.getActiveIntents(req.params.userId);
    res.json({ success: true, data: intents });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /intents/dormant/:userId
router.get('/dormant/:userId', async (req, res) => {
  try {
    const intents = await service.getDormantIntents(req.params.userId);
    res.json({ success: true, data: intents });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /intents/profile/:userId
router.get('/profile/:userId', async (req, res) => {
  try {
    const profile = await service.getProfile(req.params.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /intents/enriched/:userId
router.post('/enriched/:userId', async (req, res) => {
  try {
    const enriched = await service.getEnrichedContext(req.params.userId);
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /intents/revival
router.post('/revival', async (req, res) => {
  try {
    const { intentId, triggerType } = req.body;
    const result = await service.triggerRevival(intentId, triggerType);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /intents/revived/:intentId
router.post('/revived/:intentId', async (req, res) => {
  try {
    await service.markRevived(req.params.intentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server intent
    });
  }
});

// GET /intents/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await service.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export { router as intentRoutes };

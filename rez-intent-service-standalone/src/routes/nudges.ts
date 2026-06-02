import { Router } from 'express';
import { nudgeService } from '../services/nudges';

const router = Router();

// POST /nudges/send
router.post('/send', async (req, res) => {
  try {
    const { userId, intentId, channel, message } = req.body;
    const result = await nudgeService.send({ userId, intentId, channel, message });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /nudges/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const history = await nudgeService.getUserHistory(req.params.userId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /nudges/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await nudgeService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export { router as nudgeRoutes };

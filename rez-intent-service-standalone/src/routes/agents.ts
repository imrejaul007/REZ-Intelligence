import { Router } from 'express';
import { agentService } from '../services/agents';

const router = Router();

// GET /agents/status
router.get('/status', async (req, res) => {
  try {
    const status = await agentService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /agents/run/:agentName
router.post('/run/:agentName', async (req, res) => {
  try {
    const result = await agentService.runAgent(req.params.agentName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// POST /agents/stop
router.post('/stop', async (req, res) => {
  try {
    await agentService.stop();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export { router as agentRoutes };

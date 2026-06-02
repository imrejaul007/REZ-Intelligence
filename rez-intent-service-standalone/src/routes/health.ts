import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    service: 'rez-intent-service',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/ready', (req, res) => {
  res.json({ ready: true });
});

export { router as healthRoutes };

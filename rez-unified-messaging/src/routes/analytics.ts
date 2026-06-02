import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      volume: { sent: 0, delivered: 0, read: 0, clicked: 0 },
      byChannel: {},
      trends: []
    }
  });
});

export default router;

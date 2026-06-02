import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: [] });
});

router.post('/', (req, res) => {
  res.json({ success: true, data: { id: `tmpl_${Date.now()}`, ...req.body } });
});

export default router;

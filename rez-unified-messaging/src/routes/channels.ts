import { Router } from 'express';
const router = Router();

router.post('/whatsapp', async (req, res) => {
  res.json({ success: true, messageId: `wamid_${Date.now()}` });
});

router.post('/sms', async (req, res) => {
  res.json({ success: true, messageId: `sms_${Date.now()}` });
});

router.post('/email', async (req, res) => {
  res.json({ success: true, messageId: `email_${Date.now()}` });
});

router.post('/push', async (req, res) => {
  res.json({ success: true, messageId: `push_${Date.now()}` });
});

export default router;

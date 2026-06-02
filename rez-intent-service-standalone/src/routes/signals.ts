import { Router } from 'express';
import { z } from 'zod';
import { signalCaptureService } from '../services/signalCapture';

const router = Router();
const signalService = new signalCaptureService();

// Validation schemas
const CaptureSignalSchema = z.object({
  userId: z.string().min(1),
  appType: z.enum(['hotel_ota', 'restaurant', 'retail', 'hotel_guest']),
  eventType: z.enum(['search', 'view', 'wishlist', 'cart_add', 'hold', 'checkout_start', 'fulfilled', 'abandoned']),
  category: z.enum(['TRAVEL', 'DINING', 'RETAIL', 'HOTEL_SERVICE', 'GENERAL']),
  intentKey: z.string().min(1),
  intentQuery: z.string().optional(),
  merchantId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

// POST /signals/capture
router.post('/capture', async (req, res) => {
  try {
    const data = CaptureSignalSchema.parse(req.body);
    const result = await signalService.capture(data);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
});

// GET /signals/active/:userId
router.get('/active/:userId', async (req, res) => {
  try {
    const intents = await signalService.getActiveIntents(req.params.userId);
    res.json({ success: true, data: intents });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /signals/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const intents = await signalService.getUserIntents(req.params.userId);
    res.json({ success: true, data: intents });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /signals/app/:userId/:appType
router.get('/app/:userId/:appType', async (req, res) => {
  try {
    const intents = await signalService.getIntentsByApp(req.params.userId, req.params.appType);
    res.json({ success: true, data: intents });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// GET /signals/similar/:userId
router.get('/similar/:userId', async (req, res) => {
  try {
    const { intentKey, category, limit } = req.query;
    const similar = await signalService.findSimilarIntents(
      req.params.userId,
      intentKey as string,
      category as string,
      parseInt(limit as string) || 10
    );
    res.json({ success: true, data: similar });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export { router as signalRoutes };

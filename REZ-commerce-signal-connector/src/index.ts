import express, { Express, Request, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';

const app: Express = express();
app.use(express.json());

// Service URLs
const SERVICES = {
  unifiedProfile: process.env.UNIFIED_PROFILE_URL || 'http://localhost:4120',
  signalAggregator: process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4121',
  predictiveEngine: process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123',
  behavioral: process.env.BEHAVIORAL_SERVICE_URL || 'http://localhost:4110',
  competitor: process.env.COMPETITOR_SERVICE_URL || 'http://localhost:4117',
  social: process.env.SOCIAL_SERVICE_URL || 'http://localhost:4116',
  location: process.env.LOCATION_SERVICE_URL || 'http://localhost:4115'
};

// Event schemas
const orderSchema = z.object({
  userId: z.string(),
  orderId: z.string(),
  merchantId: z.string(),
  total: z.number(),
  items: z.array(z.object({
    category: z.string(),
    value: z.number()
  })),
  paymentMethod: z.string(),
  timestamp: z.string()
});

const paymentSchema = z.object({
  userId: z.string(),
  transactionId: z.string(),
  amount: z.number(),
  method: z.string(),
  status: z.string()
});

const reviewSchema = z.object({
  userId: z.string(),
  merchantId: z.string(),
  rating: z.number(),
  comment: z.string().optional()
});

// Signal emitters
async function emitToService(url: string, endpoint: string, data: any) {
  try {
    await axios.post(`${url}${endpoint}`, data, { timeout: 5000 });
  } catch (error) {
    console.error(`Failed to emit to ${url}${endpoint}:`, error);
  }
}

// Webhook: Order completed
app.post('/webhook/order', async (req: Request, res: Response) => {
  try {
    const order = orderSchema.parse(req.body);

    // Extract signals from order
    const signals = {
      userId: order.userId,
      orderValue: order.total,
      orderCount: 1,
      preferredCategories: order.items.map(i => i.category),
      preferredPaymentMethod: order.paymentMethod
    };

    // Emit to all services
    await Promise.all([
      emitToService(SERVICES.unifiedProfile, '/api/profile/enrich', signals),
      emitToService(SERVICES.signalAggregator, '/signals/compute', { userId: order.userId }),
      emitToService(SERVICES.predictiveEngine, '/predict/recompute', { userId: order.userId }),
      emitToService(SERVICES.behavioral, '/api/psychology/event', {
        userId: order.userId,
        eventType: 'order_completed',
        amount: order.total
      })
    ]);

    res.json({ success: true, message: 'Signals emitted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook: Payment completed
app.post('/webhook/payment', async (req: Request, res: Response) => {
  try {
    const payment = paymentSchema.parse(req.body);

    await Promise.all([
      emitToService(SERVICES.unifiedProfile, '/api/profile/enrich', {
        userId: payment.userId,
        lastPaymentDate: payment.timestamp,
        paymentMethod: payment.method
      }),
      emitToService(SERVICES.behavioral, '/api/psychology/event', {
        userId: payment.userId,
        eventType: 'payment_completed',
        amount: payment.amount
      })
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook: Review submitted
app.post('/webhook/review', async (req: Request, res: Response) => {
  try {
    const review = reviewSchema.parse(req.body);

    await emitToService(SERVICES.social, '/api/social/event', {
      userId: review.userId,
      eventType: 'review_submitted',
      rating: review.rating
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook: Cart abandoned
app.post('/webhook/cart', async (req: Request, res: Response) => {
  try {
    const { userId, cartValue, items } = req.body;

    await emitToService(SERVICES.predictiveEngine, '/predict/event', {
      userId,
      eventType: 'cart_abandoned',
      cartValue,
      itemCount: items?.length || 0
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'rez-commerce-signal-connector' });
});

const PORT = parseInt(process.env.PORT || '4150', 10);
app.listen(PORT, () => {
  console.log(`Commerce Signal Connector listening on port ${PORT}`);
});

export { app };

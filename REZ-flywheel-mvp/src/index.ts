import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Document, Model } from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
// Simple logger implementation
const logger = {
  info: (msg: string, meta?: unknown) => console.log(`[FLYWHEEL] ${msg}`, meta || ''),
  error: (msg: string, meta?: unknown) => console.error(`[FLYWHEEL] ${msg}`, meta || ''),
  warn: (msg: string, meta?: unknown) => console.warn(`[FLYWHEEL] ${msg}`, meta || ''),
};

// ============================================
// Zod Validation Schemas
// ============================================

const QRScanSchema = z.object({
  userId: z.string().min(1),
  merchantId: z.string().min(1),
});

const OrderItemSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
});

const OrderSchema = z.object({
  userId: z.string().min(1),
  merchantId: z.string().min(1),
  items: z.array(OrderItemSchema).min(1),
  total: z.number().positive(),
});

const NudgeClickSchema = z.object({
  userId: z.string().min(1),
  merchantId: z.string().min(1),
});

const NudgeConvertSchema = z.object({
  userId: z.string().min(1),
  merchantId: z.string().min(1),
  orderId: z.string().optional(),
});

type QRScanInput = z.infer<typeof QRScanSchema>;
type OrderInput = z.infer<typeof OrderSchema>;
type NudgeClickInput = z.infer<typeof NudgeClickSchema>;
type NudgeConvertInput = z.infer<typeof NudgeConvertSchema>;

// ============================================
// MongoDB Types
// ============================================

interface IUser extends Document {
  userId: string;
  phone?: string;
  name?: string;
  createdAt: Date;
  lastActive: Date;
}

interface IMerchant extends Document {
  merchantId: string;
  name?: string;
  category?: string;
  location?: string;
  createdAt: Date;
}

type EventType = 'qr_scan' | 'browse' | 'search' | 'order' | 'reorder_nudge' | 'reorder_click' | 'reorder_convert';

interface IEvent extends Document {
  userId?: string;
  merchantId?: string;
  type: EventType;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

interface IOrder extends Document {
  orderId: string;
  userId?: string;
  merchantId?: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  source: 'direct' | 'reorder_nudge';
  createdAt: Date;
}

interface IReorderProfile extends Document {
  userId: string;
  merchantId: string;
  lastOrderDate?: Date;
  orderCount: number;
  avgOrderValue?: number;
  reorderScore: number;
  shouldNudge: boolean;
  nudged: boolean;
  nudgedAt?: Date;
  clicked: boolean;
  converted: boolean;
  updatedAt: Date;
}

// ============================================
// MongoDB Schemas
// ============================================

const userSchema = new Schema<IUser>({
  userId: { type: String, required: true, unique: true },
  phone: String,
  name: String,
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
});

const merchantSchema = new Schema<IMerchant>({
  merchantId: { type: String, required: true, unique: true },
  name: String,
  category: String,
  location: String,
  createdAt: { type: Date, default: Date.now },
});

const eventSchema = new Schema<IEvent>({
  userId: String,
  merchantId: String,
  type: {
    type: String,
    enum: ['qr_scan', 'browse', 'search', 'order', 'reorder_nudge', 'reorder_click', 'reorder_convert'],
  },
  metadata: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
});

const orderSchema = new Schema<IOrder>({
  orderId: { type: String, required: true, unique: true },
  userId: String,
  merchantId: String,
  items: [{
    name: String,
    price: Number,
    quantity: Number,
  }],
  total: Number,
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' },
  source: { type: String, enum: ['direct', 'reorder_nudge'], default: 'direct' },
  createdAt: { type: Date, default: Date.now },
});

const reorderProfileSchema = new Schema<IReorderProfile>({
  userId: String,
  merchantId: String,
  lastOrderDate: Date,
  orderCount: { type: Number, default: 1 },
  avgOrderValue: Number,
  reorderScore: { type: Number, default: 0 },
  shouldNudge: { type: Boolean, default: false },
  nudged: { type: Boolean, default: false },
  nudgedAt: Date,
  clicked: { type: Boolean, default: false },
  converted: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

reorderProfileSchema.index({ userId: 1, merchantId: 1 }, { unique: true });

// ============================================
// Models
// ============================================

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
const Merchant: Model<IMerchant> = mongoose.model<IMerchant>('Merchant', merchantSchema);
const Event: Model<IEvent> = mongoose.model<IEvent>('Event', eventSchema);
const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);
const ReorderProfile: Model<IReorderProfile> = mongoose.model<IReorderProfile>('ReorderProfile', reorderProfileSchema);

// ============================================
// Scoring Algorithm
// ============================================

interface ProfileScoreInput {
  lastOrderDate?: Date;
  orderCount: number;
  avgOrderValue?: number;
}

function calculateReorderScore(profile: ProfileScoreInput): number {
  if (!profile.lastOrderDate) return 0;

  const daysSinceOrder = Math.floor((Date.now() - profile.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
  const orderCount = profile.orderCount || 1;

  let score = 0;

  // Recency (max 40 points)
  if (daysSinceOrder <= 1) score += 40;
  else if (daysSinceOrder <= 3) score += 35;
  else if (daysSinceOrder <= 7) score += 25;
  else if (daysSinceOrder <= 14) score += 15;
  else score += 5;

  // Frequency (max 30 points)
  if (orderCount >= 5) score += 30;
  else if (orderCount >= 3) score += 20;
  else if (orderCount >= 2) score += 10;

  // Value consistency (max 30 points)
  if ((profile.avgOrderValue || 0) >= 500) score += 30;
  else if ((profile.avgOrderValue || 0) >= 300) score += 20;
  else if ((profile.avgOrderValue || 0) >= 150) score += 10;

  return Math.min(100, score);
}

// ============================================
// Express App
// ============================================

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // Request ID middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req.headers as Record<string, string>)['x-request-id'] = uuidv4();
    next();
  });

  // Public routes
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'flywheel-mvp', timestamp: new Date().toISOString() });
  });

  // Auth middleware for API routes - placeholder
  // In production, add authentication middleware here
  // app.use('/api', createAuthMiddleware());

  // 1. QR Scan - Discovery
  app.post('/api/qr-scan', async (req: Request, res: Response) => {
    try {
      const validated = QRScanSchema.parse(req.body);
      const { userId, merchantId } = validated;

      await Event.create({ userId, merchantId, type: 'qr_scan' });
      await User.findOneAndUpdate({ userId }, { lastActive: new Date() }, { upsert: true });

      logger.info('QR Scan', { userId, merchantId });

      res.json({ success: true, message: 'QR scan recorded' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
        return;
      }
      logger.error('QR scan failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 2. Order - Conversion
  app.post('/api/order', async (req: Request, res: Response) => {
    try {
      const validated = OrderSchema.parse(req.body);
      const { userId, merchantId, items, total } = validated;
      const orderId = 'ord_' + uuidv4().substring(0, 8);

      await Order.create({ orderId, userId, merchantId, items, total });
      await Event.create({ userId, merchantId, type: 'order', metadata: { orderId, total } });
      await User.findOneAndUpdate({ userId }, { lastActive: new Date() }, { upsert: true });

      let profile = await ReorderProfile.findOne({ userId, merchantId });

      if (profile) {
        const prevOrders = profile.orderCount;
        profile.lastOrderDate = new Date();
        profile.orderCount += 1;
        profile.avgOrderValue = ((profile.avgOrderValue || 0) * prevOrders + total) / profile.orderCount;
        profile.reorderScore = calculateReorderScore(profile);
        profile.shouldNudge = profile.reorderScore >= 60;
        profile.nudged = false;
        profile.updatedAt = new Date();
        await profile.save();
      } else {
        await ReorderProfile.create({
          userId,
          merchantId,
          lastOrderDate: new Date(),
          orderCount: 1,
          avgOrderValue: total,
          reorderScore: calculateReorderScore({ lastOrderDate: new Date(), orderCount: 1, avgOrderValue: total }),
          shouldNudge: false,
        });
      }

      logger.info('Order placed', { orderId, userId, merchantId, total });

      res.json({ success: true, orderId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
        return;
      }
      logger.error('Order failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 3. Trigger Reorder Nudges
  app.post('/api/nudge/trigger', async (_req: Request, res: Response) => {
    try {
      const profiles = await ReorderProfile.find({
        shouldNudge: true,
        nudged: false,
        reorderScore: { $gte: 60 },
      }).limit(100);

      const nudges: Array<{ userId: string; merchantId: string; score: number; message: string }> = [];

      for (const profile of profiles) {
        profile.nudged = true;
        profile.nudgedAt = new Date();
        await profile.save();

        await Event.create({
          userId: profile.userId,
          merchantId: profile.merchantId,
          type: 'reorder_nudge',
        });

        nudges.push({
          userId: profile.userId,
          merchantId: profile.merchantId,
          score: profile.reorderScore,
          message: 'Time to reorder! Score: ' + profile.reorderScore,
        });
      }

      logger.info('Nudges triggered', { count: nudges.length });

      res.json({ success: true, count: nudges.length, nudges });
    } catch (error) {
      logger.error('Nudge trigger failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 4. Nudge Clicked
  app.post('/api/nudge/click', async (req: Request, res: Response) => {
    try {
      const validated = NudgeClickSchema.parse(req.body);
      const { userId, merchantId } = validated;

      await ReorderProfile.findOneAndUpdate({ userId, merchantId }, { clicked: true });
      await Event.create({ userId, merchantId, type: 'reorder_click' });

      logger.info('Nudge clicked', { userId, merchantId });

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
        return;
      }
      logger.error('Nudge click failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 5. Nudge Converted
  app.post('/api/nudge/convert', async (req: Request, res: Response) => {
    try {
      const validated = NudgeConvertSchema.parse(req.body);
      const { userId, merchantId, orderId } = validated;

      await ReorderProfile.findOneAndUpdate({ userId, merchantId }, { converted: true });

      if (orderId) {
        await Order.findOneAndUpdate({ orderId }, { source: 'reorder_nudge' });
      }

      await Event.create({ userId, merchantId, type: 'reorder_convert', metadata: { orderId } });

      logger.info('Nudge converted', { userId, merchantId, orderId });

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
        return;
      }
      logger.error('Nudge convert failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Status endpoint
  app.get('/api/status', async (_req: Request, res: Response) => {
    try {
      const [
        totalUsers,
        totalMerchants,
        totalOrders,
        totalEvents,
        nudgeProfiles,
        clickedProfiles,
        convertedProfiles,
        reorderOrders,
      ] = await Promise.all([
        User.countDocuments(),
        Merchant.countDocuments(),
        Order.countDocuments(),
        Event.countDocuments(),
        ReorderProfile.countDocuments({ nudged: true }),
        ReorderProfile.countDocuments({ clicked: true }),
        ReorderProfile.countDocuments({ converted: true }),
        Order.countDocuments({ source: 'reorder_nudge' }),
      ]);

      const events = await Event.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]);

      const eventCounts: Record<string, number> = {};
      events.forEach(e => { eventCounts[e._id as string] = e.count; });

      const nudgeRate = nudgeProfiles > 0 ? (clickedProfiles / nudgeProfiles * 100).toFixed(1) : '0';
      const clickToConvert = clickedProfiles > 0 ? (convertedProfiles / clickedProfiles * 100).toFixed(1) : '0';
      const reorderAttribution = totalOrders > 0 ? (reorderOrders / totalOrders * 100).toFixed(1) : '0';

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        metrics: {
          users: totalUsers,
          merchants: totalMerchants,
          orders: totalOrders,
          events: totalEvents,
        },
        funnel: {
          qrScans: eventCounts.qr_scan || 0,
          orders: eventCounts.order || 0,
          nudgesSent: nudgeProfiles,
          nudgesClicked: clickedProfiles,
          nudgesConverted: convertedProfiles,
          reorderOrders,
        },
        kpis: {
          nudgeClickRate: nudgeRate,
          nudgeConversionRate: clickToConvert,
          reorderAttributionRate: reorderAttribution,
          status: parseFloat(nudgeRate) >= 8 && parseFloat(clickToConvert) >= 10 ? 'GREEN' :
                  parseFloat(nudgeRate) >= 5 || parseFloat(clickToConvert) >= 5 ? 'YELLOW' : 'BUILDING',
        },
        flywheelHealth: {
          discovery: (eventCounts.qr_scan ?? 0) > 0 ? 'ACTIVE' : 'NO_DATA',
          conversion: (eventCounts.order ?? 0) > 0 ? 'ACTIVE' : 'NO_DATA',
          retention: nudgeProfiles > 0 ? 'ACTIVE' : 'NO_DATA',
        },
      });
    } catch (error) {
      logger.error('Status check failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  });

  return app;
}

// ============================================
// Startup
// ============================================

async function start(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error('MONGODB_URI is required');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    process.exit(1);
  }

  const app = createApp();
  const port = parseInt(process.env.PORT || '4101', 10);

  app.listen(port, () => {
    logger.info('Flywheel MVP running on port ' + port);
    logger.info('Status: http://localhost:' + port + '/api/status');
  });
}

start().catch((error) => {
  logger.error('Startup failed', { error });
  process.exit(1);
});

export { calculateReorderScore };

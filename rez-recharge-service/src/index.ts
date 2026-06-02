// Recharge Service - Mobile & DTH Recharge
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

// Import routes
import mobileRoutes from './routes/mobile.routes.js';
import dthRoutes from './routes/dth.routes.js';
import planRoutes from './routes/plan.routes.js';

// Import services
import { rechargeService } from './services/recharge.service.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'ok',
    service: 'recharge-service',
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus,
  });
});

// API Routes
// Mobile recharge routes
app.use('/api/recharge/mobile', mobileRoutes);

// DTH recharge routes
app.use('/api/recharge/dth', dthRoutes);

// Plan routes
app.use('/api/plans', planRoutes);

// Combined recharge routes (for backward compatibility)
app.use('/api/recharge', (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/mobile') {
    return mobileRoutes(req, res, next);
  } else if (req.path === '/dth') {
    return dthRoutes(req, res, next);
  }
  next();
});

// Operator status endpoint
app.get('/api/operators/status', async (req: Request, res: Response) => {
  try {
    const statuses = await rechargeService.getAllOperatorsStatus();
    res.json({
      success: true,
      operators: statuses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Operator status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operator statuses',
    });
  }
});

// Daily summary endpoint
app.get('/api/reports/daily-summary', async (req: Request, res: Response) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const summary = await rechargeService.getDailySummary(date);

    res.json({
      success: true,
      date: date.toISOString().split('T')[0],
      ...summary,
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily summary',
    });
  }
});

// Transaction history endpoint
app.get('/api/reports/history', async (req: Request, res: Response) => {
  try {
    const { userId, type, operator, status, startDate, endDate, page, limit } = req.query;

    const history = await rechargeService.getTransactionHistory({
      userId: userId as string | undefined,
      type: type as any,
      operator: operator as string | undefined,
      status: status as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      ...history,
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// MongoDB connection
const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/recharge-service';

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 4111;

const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Recharge Service Started                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                 ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                               ║
║  Endpoints:                                                   ║
║  - GET  /health                    Health check              ║
║  - POST /api/recharge/mobile       Mobile recharge           ║
║  - POST /api/recharge/dth          DTH recharge               ║
║  - GET  /api/plans                 List plans                ║
║  - GET  /api/operators/status      Operator status           ║
║  - GET  /api/reports/daily-summary Daily summary             ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;

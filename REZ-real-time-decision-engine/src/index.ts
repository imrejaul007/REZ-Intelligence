import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

import { DecisionRouter } from './decision/decision-router';
import { checkOfferEligibility } from './offers/eligibility';
import { RealTimeFraudBlocker } from './fraud/real-time-block';
import { RecommendationRouter } from './recommend/routing';
import { LoyaltyTriggerEngine } from './loyalty/triggers';
import { RealTimePersonalization } from './personalization/realtime';

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined,
});

// Request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  req.headers['x-request-id'] = requestId;
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });

  next();
};

// Error handler
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || 'unknown';
  logger.error({
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: 'Internal decision engine error',
    requestId,
    timestamp: new Date().toISOString(),
  });
};

// Initialize services
const initializeServices = () => {
  logger.info('Initializing REZ Real-Time Decision Engine services...');

  const decisionRouter = new DecisionRouter(logger);
  const fraudBlocker = new RealTimeFraudBlocker(logger);
  const recommendationRouter = new RecommendationRouter(logger);
  const loyaltyEngine = new LoyaltyTriggerEngine(logger);
  const personalization = new RealTimePersonalization(logger);

  logger.info('All services initialized successfully');

  return { decisionRouter, fraudBlocker, recommendationRouter, loyaltyEngine, personalization };
};

// Create Express app
const createApp = (): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Health check endpoints
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'rez-real-time-decision-engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (req: Request, res: Response) => {
    // Readiness check - verify dependencies
    const checks = {
      redis: true, // Would check actual Redis connection in production
      models: true,
    };

    const allHealthy = Object.values(checks).every(v => v);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
};

// Main bootstrap
const bootstrap = async () => {
  const app = createApp();
  const services = initializeServices();

  // Decision endpoints
  app.post('/api/v1/decide', async (req: Request, res: Response) => {
    try {
      const result = await services.decisionRouter.route(req.body, req.headers);
      res.json({
        success: true,
        data: result,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message, body: req.body }, 'Decision routing failed');
      res.status(400).json({
        success: false,
        error: err.message,
        requestId: req.headers['x-request-id'],
      });
    }
  });

  // Offer eligibility
  app.post('/api/v1/offers/eligibility', async (req: Request, res: Response) => {
    try {
      const result = await checkOfferEligibility(req.body, services.fraudBlocker);
      res.json({
        success: true,
        data: result,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({
        success: false,
        error: err.message,
        requestId: req.headers['x-request-id'],
      });
    }
  });

  // Fraud check
  app.post('/api/v1/fraud/check', async (req: Request, res: Response) => {
    try {
      const result = await services.fraudBlocker.checkTransaction(req.body);
      res.json({
        success: true,
        data: result,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({
        success: false,
        error: err.message,
        requestId: req.headers['x-request-id'],
      });
    }
  });

  // Recommendations
  app.post('/api/v1/recommend', async (req: Request, res: Response) => {
    try {
      const result = await services.recommendationRouter.getRecommendations(req.body);
      res.json({
        success: true,
        data: result,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({
        success: false,
        error: err.message,
        requestId: req.headers['x-request-id'],
      });
    }
  });

  // Loyalty triggers
  app.post('/api/v1/loyalty/trigger', async (req: Request, res: Response) => {
    try {
      const result = await services.loyaltyEngine.evaluateTrigger(req.body);
      res.json({
        success: true,
        data: result,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({
        success: false,
        error: err.message,
        requestId: req.headers['x-request-id'],
      });
    }
  });

  // Personalization
  app.post('/api/v1/personalize', async (req: Request, res: Response) => {
    try {
      const result = await services.personalization.getPersonalizedContent(req.body);
      res.json({
        success: true,
        data: result,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({
        success: false,
        error: err.message,
        requestId: req.headers['x-request-id'],
      });
    }
  });

  // Batch decisions
  app.post('/api/v1/decide/batch', async (req: Request, res: Response) => {
    try {
      const { decisions } = req.body;

      if (!Array.isArray(decisions)) {
        throw new Error('decisions must be an array');
      }

      if (decisions.length > 100) {
        throw new Error('Maximum 100 decisions per batch');
      }

      const results = await Promise.all(
        decisions.map((d: any) => services.decisionRouter.route(d, req.headers))
      );

      res.json({
        success: true,
        data: { results },
        count: results.length,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({
        success: false,
        error: err.message,
        requestId: req.headers['x-request-id'],
      });
    }
  });

  // Error handling
  app.use(errorHandler);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
    });
  });

  return app;
};

// Start server
const PORT = process.env.PORT || 3000;

bootstrap().then(app => {
  app.listen(PORT, () => {
    logger.info(`REZ Real-Time Decision Engine running on port ${PORT}`);
    logger.info('Endpoints:');
    logger.info('  POST /api/v1/decide - Central decision routing');
    logger.info('  POST /api/v1/decide/batch - Batch decisions');
    logger.info('  POST /api/v1/offers/eligibility - Offer eligibility');
    logger.info('  POST /api/v1/fraud/check - Fraud detection');
    logger.info('  POST /api/v1/recommend - Recommendations');
    logger.info('  POST /api/v1/loyalty/trigger - Loyalty triggers');
    logger.info('  POST /api/v1/personalize - Real-time personalization');
  });
}).catch(error => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});

export { bootstrap, createApp };

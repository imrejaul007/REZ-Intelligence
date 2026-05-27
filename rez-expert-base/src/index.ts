/**
 * REZ Expert Base - Main Entry Point
 * Express server for the expert base class template
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { Logger } from './utils/logger.js';
import { ExpertRoutes, ExpertRoutesConfig } from './routes/expert.routes';
import { ExpertAgentRegistry } from './base/ExpertAgent';
import {
  ExpertConfig,
  ExpertCapability,
  RateLimitConfig
} from './types/expert.types';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Configuration
const PORT = parseInt(process.env.PORT || '4113', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize logger
const logger = new Logger('rez-expert-base');
logger.info(`Starting REZ Expert Base (${NODE_ENV})`);

// Initialize Express app
const app = express();

// Trust proxy for rate limiting behind load balancer
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for API
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Internal-Token']
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Rate limiter middleware
const createRateLimiter = (config?: RateLimitConfig) => {
  const limiter = new RateLimiterMemory({
    points: config?.maxRequests || 100,
    duration: (config?.windowMs || 60000) / 1000
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.ip || 'unknown';
      await limiter.consume(key);
      next();
    } catch {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((config?.windowMs || 60000) / 1000)
      });
    }
  };
};

// Initialize expert registry
const expertRegistry = new ExpertAgentRegistry(logger);

// Internal service authentication middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const internalToken = req.headers['x-internal-token'] as string;
  const expectedTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');

  // Skip auth for health checks
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }

  // For now, allow all requests (add proper auth logic as needed)
  if (!internalToken || !expectedTokens[internalToken]) {
    // Log but don't block in development
    if (NODE_ENV === 'production') {
      logger.warn('Unauthorized request attempt', {
        path: req.path,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  next();
};

// Initialize routes
const rateLimitConfig: RateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  keyPrefix: 'rez:expert:ratelimit:'
};

const routesConfig: ExpertRoutesConfig = {
  registry: expertRegistry,
  logger,
  authMiddleware,
  rateLimitMiddleware: createRateLimiter(rateLimitConfig)
};

const expertRoutes = new ExpertRoutes(routesConfig);
app.use('/', expertRoutes.getRouter());

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Register a default expert for testing
async function registerDefaultExpert(): Promise<void> {
  const defaultExpertConfig: ExpertConfig = {
    expertId: 'base-expert',
    name: 'REZ Base Expert',
    industry: 'general',
    version: '1.0.0',
    description: 'A base expert template for the REZ platform',
    tone: (process.env.EXPERT_TONE as unknown) || 'professional',
    expertiseLevel: 'intermediate',
    capabilities: [
      {
        domain: 'general',
        actions: ['query', 'explain', 'recommend'],
        description: 'General purpose expert capabilities',
        confidenceRange: { min: 0.5, max: 0.9 }
      }
    ],
    knowledgeBase: {
      enabled: process.env.KNOWLEDGE_BASE_ENABLED !== 'false',
      provider: 'redis',
      cacheTtlSeconds: parseInt(process.env.KNOWLEDGE_BASE_CACHE_TTL || '3600', 10),
      maxResults: 5,
      similarityThreshold: 0.7,
      namespace: 'rez:expert:base'
    },
    modelConfig: {
      provider: 'anthropic',
      modelName: process.env.MODEL_NAME || 'claude-3-sonnet-20240229',
      maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7')
    },
    workflowConfig: {
      enabled: true,
      timeoutMs: parseInt(process.env.WORKFLOW_TIMEOUT_MS || '30000', 10),
      maxRetries: parseInt(process.env.WORKFLOW_MAX_RETRIES || '3', 10),
      retryDelayMs: 1000
    },
    rateLimitConfig: rateLimitConfig
  };

  // Create a simple expert class for testing
  const { ExpertAgent } = await import('./base/ExpertAgent');

  class DefaultExpert extends ExpertAgent {
    protected async processIntentCore(intent, context) {
      return {
        content: `Hello! I am the REZ Base Expert. You asked: "${intent.input}". This is a template response - extend me to add real functionality.`,
        confidence: 'high' as const,
        actions: [],
        metadata: {
          template: true
        }
      };
    }

    protected canHandleCore(intent): boolean {
      return true; // Accept all intents in base expert
    }
  }

  try {
    const defaultExpert = new DefaultExpert(defaultExpertConfig, logger);
    await expertRegistry.register(defaultExpert);
    logger.info('Default expert registered successfully');
  } catch (error) {
    logger.error('Failed to register default expert:', error);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Unregister all experts
    const experts = expertRegistry.getAllExperts();
    for (const expert of experts) {
      await expertRegistry.unregister(expert.expertId);
    }

    logger.info('All experts unregistered');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start(): Promise<void> {
  try {
    // Register default expert
    await registerDefaultExpert();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`REZ Expert Base listening on port ${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export for testing
export { app, expertRegistry, logger };

// Start if running directly
if (require.main === module) {
  start();
}

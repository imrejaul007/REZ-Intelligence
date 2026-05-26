#!/usr/bin/env node
/**
 * Script to add auth middleware to services missing it
 * Usage: node scripts/add-auth-middleware.js <service-name>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auth middleware template
const AUTH_MIDDLEWARE = `import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
}

export function createAuthMiddleware(config: AuthConfig) {
  const { apiKeys = [], internalTokens = [], bypassPaths = ['/health', '/ready'] } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;

    // Bypass health checks
    if (bypassPaths.some(p => path.startsWith(p))) {
      return next();
    }

    // Check API key
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey && apiKeys.includes(apiKey)) {
      return next();
    }

    // Check internal token
    const internalToken = req.headers['x-internal-token'] as string | undefined;
    if (internalToken && internalTokens.includes(internalToken)) {
      return next();
    }

    // No valid auth found
    logger.warn('Unauthorized access attempt', {
      path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key or internal token required',
    });
  };
}
`;

// Rate limiter template
const RATE_LIMITER = `import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  cache: Map<string, { count: number; resetAt: number }>;
  get(key: string): { count: number; resetAt: number } | undefined;
  set(key: string, value: { count: number; resetAt: number }): void;
}

const memoryStore: RateLimitStore = {
  cache: new Map(),
  get(key: string) {
    const record = this.cache.get(key);
    if (record && Date.now() > record.resetAt) {
      this.cache.delete(key);
      return undefined;
    }
    return record;
  },
  set(key: string, value: { count: number; resetAt: number }) {
    this.cache.set(key, value);
  },
};

export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(config: RateLimitConfig = {}) {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = (req: Request) => req.ip || 'unknown',
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const record = memoryStore.get(key);

    if (!record) {
      memoryStore.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      return next();
    }

    if (record.count >= max) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    next();
  };
}
`;

// Error handler template
const ERROR_HANDLER = `import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(\`[\${req.method}] \${req.path}:\`, err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: \`Route \${req.method} \${req.path} not found\`,
  });
}
`;

// Index template
const INDEX_TEMPLATE = `export * from './auth.js';
export * from './rateLimit.js';
export * from './errorHandler.js';
`;

function addAuthMiddleware(servicePath) {
  const middlewareDir = path.join(servicePath, 'src', 'middleware');

  // Create middleware directory if it doesn't exist
  if (!fs.existsSync(middlewareDir)) {
    fs.mkdirSync(middlewareDir, { recursive: true });
  }

  // Write middleware files
  fs.writeFileSync(path.join(middlewareDir, 'auth.ts'), AUTH_MIDDLEWARE);
  fs.writeFileSync(path.join(middlewareDir, 'rateLimit.ts'), RATE_LIMITER);
  fs.writeFileSync(path.join(middlewareDir, 'errorHandler.ts'), ERROR_HANDLER);
  fs.writeFileSync(path.join(middlewareDir, 'index.ts'), INDEX_TEMPLATE);

  console.log(`Added auth middleware to ${servicePath}`);
}

// Get service name from command line
const serviceName = process.argv[2];

if (!serviceName) {
  // Find all services missing auth
  const servicesDir = path.join(__dirname, '..');
  const services = fs.readdirSync(servicesDir).filter(f => {
    const indexPath = path.join(servicesDir, f, 'src', 'index.ts');
    if (!fs.existsSync(indexPath)) return false;
    const content = fs.readFileSync(indexPath, 'utf-8');
    return !content.includes('createAuthMiddleware') && !content.includes('x-api-key');
  });

  console.log(`Found ${services.length} services missing auth:`);
  services.forEach(s => console.log(`  - ${s}`));

  console.log('\nTo add auth to a specific service:');
  console.log('  node scripts/add-auth-middleware.js <service-name>');
  console.log('\nTo add auth to all missing services:');
  console.log('  node scripts/add-auth-middleware.js --all');
  process.exit(0);
}

if (serviceName === '--all') {
  // Add auth to all missing services
  const servicesDir = path.join(__dirname, '..');
  const services = fs.readdirSync(servicesDir).filter(f => {
    const indexPath = path.join(servicesDir, f, 'src', 'index.ts');
    if (!fs.existsSync(indexPath)) return false;
    const content = fs.readFileSync(indexPath, 'utf-8');
    return !content.includes('createAuthMiddleware') && !content.includes('x-api-key');
  });

  services.forEach(s => {
    try {
      addAuthMiddleware(path.join(servicesDir, s));
    } catch (e) {
      console.error(`Failed to add auth to ${s}:`, e.message);
    }
  });

  console.log(`\nAdded auth middleware to ${services.length} services`);
} else {
  const servicePath = path.join(__dirname, '..', serviceName);
  if (!fs.existsSync(path.join(servicePath, 'src', 'index.ts'))) {
    console.error(`Service not found: ${serviceName}`);
    process.exit(1);
  }
  addAuthMiddleware(servicePath);
}

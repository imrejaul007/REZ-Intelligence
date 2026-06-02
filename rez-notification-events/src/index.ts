/**
 * rez-notification-events — Standalone BullMQ Worker Service
 *
 * Phase C extraction from REZ monolith (Strangler Fig pattern).
 * Consumes jobs from the shared Redis/BullMQ queue and processes them
 * independently of the monolith process.
 *
 * Also exposes HTTP API endpoints for:
 *   - Marketing notifications (campaign, voucher, broadcast)
 *   - Audience preference sync
 */

import 'dotenv/config';

process.env.SERVICE_NAME = 'rez-notification-events';

import { logger } from './config/logger';
import mongoose from 'mongoose';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb';
import { bullmqRedis, bullmqSubscriber } from './config/redis';
import { startHealthServer, setHealthy, setReady } from './health';
import { startNotificationWorker, stopWorker, startIntentEventSubscriber, stopIntentEventSubscriber } from './worker';
import { startStreakAtRiskScheduler, stopStreakAtRiskScheduler } from './workers/streakAtRiskWorker';
import { startDlqHandler, stopDlqHandler, startDlqCleanup, stopDlqCleanup } from './workers/dlqWorker';
import express, { Request, Response } from 'express';
import crypto from 'crypto';

function validateEnv(): void {
  const required = ['MONGODB_URI', 'REDIS_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();
  logger.info('[rez-notification-events] Starting...');

  await connectMongoDB();
  // NE-02 FIX (2026-04-17): confirm MongoDB is actually connected before marking ready.
  // connectMongoDB() returns a Promise that resolves immediately — the connection
  // happens asynchronously in the background. We must ping to confirm.
  try {
    // mongoose.connection.readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    if (mongoose.connection.readyState !== 1) {
      throw new Error(`MongoDB readyState is ${mongoose.connection.readyState}, not connected`);
    }
    // mongoose.connection.db may be null if driver isn't fully initialized.
    // Fall back to client.db() which is always available post-connect.
    const client = (mongoose.connection as any).client as any;
    const db = mongoose.connection.db ?? (client?.db ? client.db() : null);
    if (!db) {
      throw new Error('MongoDB db object not available — connection may not be fully initialized');
    }
    await db.admin().ping();
    logger.info('[rez-notification-events] MongoDB connection confirmed via ping');
  } catch (pingErr) {
    logger.error('[rez-notification-events] MongoDB ping failed — marking unhealthy', { error: pingErr });
    setHealthy(false);
    setReady(false);
    // NTF-SEC-FIX: Do not proceed — refuse to accept traffic until MongoDB is confirmed.
    // Previously the service would start without confirming DB connectivity, causing
    // workers to fail on every job with connection errors. This now throws to prevent
    // startup with a dead DB connection.
    throw new Error(`MongoDB connection not confirmed: ${pingErr instanceof Error ? pingErr.message : String(pingErr)}`);
  }
  setHealthy(true);
  setReady(true);

  // ── Express HTTP API for Marketing Notifications ──────────────────────────────

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint (bypass auth)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'rez-notification-events', uptime: process.uptime() });
  });

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Internal service auth middleware (for marketing routes)
  interface ScopedTokens {
    [serviceName: string]: string;
  }

  function validateInternalAuth(req: Request, res: Response, next: Function): void {
    const key = req.headers['x-internal-token'] as string || req.headers['x-internal-key'] as string;
    const callerService = req.headers['x-internal-service'] as string | undefined;

    if (!callerService) {
      res.status(401).json({ error: 'Missing x-internal-service header' });
      return;
    }

    let scopedTokens: ScopedTokens | null = null;
    try {
      const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
      scopedTokens = raw ? JSON.parse(raw) : null;
    } catch {
      scopedTokens = null;
    }

    const expected = scopedTokens?.[callerService];
    if (!expected) {
      res.status(401).json({ error: 'Unknown caller service' });
      return;
    }

    const providedBuf = Buffer.from(key || '');
    const expectedBuf = Buffer.from(expected);

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      res.status(401).json({ error: 'Invalid internal token' });
      return;
    }

    next();
  }

  // Mount marketing routes
  app.use('/api/marketing', validateInternalAuth, (req, res, next) => {
    // Lazy import to avoid circular deps
    import('./routes/marketing').then(({ default: marketingRoutes }) => {
      (req as Request).url = req.url;
      marketingRoutes(req, res, next);
    }).catch((err) => {
      logger.error('[Marketing] Failed to load routes', { error: err.message });
      res.status(500).json({ error: 'Internal error' });
    });
  });

  // Start HTTP server on separate port (or use HEALTH_PORT)
  const httpPort = parseInt(process.env.HTTP_PORT || process.env.HEALTH_PORT || '3005', 10);
  app.listen(httpPort, () => {
    logger.info(`[HTTP] Marketing API listening on port ${httpPort}`);
  });

  // ── Start BullMQ Workers ──────────────────────────────────────────────────────

  const worker = startNotificationWorker();
  startDlqHandler(worker);
  // BE-EVT-014: Start periodic DLQ cleanup (archive after 7 days, delete after 90 days)
  startDlqCleanup();
  await startStreakAtRiskScheduler();
  // ── ReZ Mind Intent Subscriber ────────────────────────────────────────────
  // Subscribe to 'rez-mind' channel to receive intent signals from ReZ Mind
  await startIntentEventSubscriber();

  // Use HEALTH_PORT (set in render.yaml) not PORT (Render injects PORT as a random dynamic value on worker services)
  const healthPort = parseInt(process.env.HEALTH_PORT || process.env.PORT || '3005', 10);
  const healthServer = startHealthServer(healthPort);

  const shutdown = async (signal: string) => {
    logger.info(`[${signal}] Graceful shutdown initiated`);
    try {
      await stopIntentEventSubscriber();
      await stopWorker();
      await stopDlqHandler();
      stopDlqCleanup();
      await stopStreakAtRiskScheduler();
      healthServer.close();
      await bullmqRedis.quit();
      await bullmqSubscriber.quit();
      await disconnectMongoDB();
      logger.info('[rez-notification-events] Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('[rez-notification-events] Shutdown error:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  logger.info('[rez-notification-events] Ready');
}

main().catch((err) => {
  logger.error('[FATAL] Failed to start:', err);
  process.exit(1);
});

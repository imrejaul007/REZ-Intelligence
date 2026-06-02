// REZ Knowledge Service - Signal Routes
// Handles signal collection from ALL apps in the ecosystem

import { Router, Response } from 'express';
import { profileService, signalCollector } from '../services';
import {
  asyncHandler,
  validateUserId,
  ServiceAuthRequest,
  NotFoundError,
  ValidationError,
} from '../middleware';
import { AppEcosystem } from '../types';

const router = Router();

// Valid app ecosystem types
const VALID_APPS: AppEcosystem[] = [
  'stayown',
  'rez-consumer',
  'rendez',
  'corpspark',
  'restaurant',
  'salon',
  'healthcare',
];

// POST /signal - Add a signal
router.post(
  '/',
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId, type, action, data, source } = req.body;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    if (!type) {
      throw new ValidationError('type is required');
    }

    if (!action) {
      throw new ValidationError('action is required');
    }

    if (!source || !VALID_APPS.includes(source as AppEcosystem)) {
      throw new ValidationError(
        `source is required and must be one of: ${VALID_APPS.join(', ')}`
      );
    }

    // Get or create profile
    let profile = await profileService.getByUserId(userId);

    if (!profile) {
      if (process.env.NODE_ENV === 'development') {
        profile = await profileService.create({ userId });
      } else {
        throw new NotFoundError('User profile');
      }
    }

    const result = await profileService.addSignal(userId, {
      userId,
      type,
      action,
      data: data || {},
      timestamp: new Date(),
      source: source as AppEcosystem,
    });

    res.status(201).json({
      success: true,
      data: {
        signalId: result.signalId,
        profileId: result.profile?.id,
      },
      message: 'Signal added successfully',
    });
  })
);

// POST /signal/batch - Add multiple signals
router.post(
  '/batch',
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { signals } = req.body;

    if (!Array.isArray(signals)) {
      throw new ValidationError('signals must be an array');
    }

    const results: { userId: string; success: boolean; signalId?: string; error?: string }[] = [];

    for (const signal of signals) {
      try {
        const { userId, type, action, data, source } = signal;

        if (!userId || !type || !action || !source) {
          results.push({
            userId: userId || 'unknown',
            success: false,
            error: 'Missing required fields',
          });
          continue;
        }

        if (!VALID_APPS.includes(source as AppEcosystem)) {
          results.push({
            userId,
            success: false,
            error: `Invalid source. Must be one of: ${VALID_APPS.join(', ')}`,
          });
          continue;
        }

        const result = await profileService.addSignal(userId, {
          userId,
          type,
          action,
          data: data || {},
          timestamp: new Date(),
          source: source as AppEcosystem,
        });

        results.push({ userId, success: true, signalId: result.signalId });
      } catch (error) {
        results.push({
          userId: signal.userId || 'unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      summary: {
        total: signals.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    });
  })
);

// POST /signal/webhook/:app - Receive signal from an app (webhook)
router.post(
  '/webhook/:app',
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { app } = req.params;
    const signal = req.body;

    if (!VALID_APPS.includes(app as AppEcosystem)) {
      throw new ValidationError(
        `Invalid app. Must be one of: ${VALID_APPS.join(', ')}`
      );
    }

    const result = await signalCollector.receiveSignal(app as AppEcosystem, signal);

    if (!result) {
      throw new ValidationError('Failed to process signal');
    }

    res.status(201).json({
      success: true,
      data: {
        signalId: result.id,
        source: app,
      },
    });
  })
);

// GET /signal/:userId - Get signals for a user
router.get(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { type, app, source, limit } = req.query;

    const signals = await profileService.getSignals(userId, {
      type: type as string,
      app: app as AppEcosystem || source as AppEcosystem,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: signals,
      count: signals.length,
    });
  })
);

// GET /signal/:userId/:app - Get signals from a specific app
router.get(
  '/:userId/:app',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId, app } = req.params;
    const { limit } = req.query;

    if (!VALID_APPS.includes(app as AppEcosystem)) {
      throw new ValidationError(
        `Invalid app. Must be one of: ${VALID_APPS.join(', ')}`
      );
    }

    const signals = await profileService.getSignals(userId, {
      app: app as AppEcosystem,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: signals,
      count: signals.length,
      app,
    });
  })
);

// POST /signal/:userId/collect - Collect signals from a specific app
router.post(
  '/:userId/collect',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { app, since } = req.body;

    if (!app || !VALID_APPS.includes(app as AppEcosystem)) {
      throw new ValidationError(
        `Invalid app. Must be one of: ${VALID_APPS.join(', ')}`
      );
    }

    const sinceDate = since ? new Date(since) : undefined;
    const signals = await signalCollector.collectFromApp(
      app as AppEcosystem,
      userId,
      sinceDate
    );

    // Store collected signals
    let stored = 0;
    for (const signal of signals) {
      try {
        await profileService.addSignal(userId, signal);
        stored++;
      } catch (error) {
        console.error('Failed to store collected signal:', error);
      }
    }

    res.json({
      success: true,
      data: {
        app,
        collected: signals.length,
        stored,
      },
    });
  })
);

// POST /signal/:userId/sync-all - Collect signals from ALL apps
router.post(
  '/:userId/sync-all',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { since } = req.body;

    const sinceDate = since ? new Date(since) : undefined;
    const result = await signalCollector.syncSignalsToProfile(userId, sinceDate);

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;

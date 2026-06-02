// REZ Knowledge Service - Unified Preferences Routes
// Handles preferences for ALL apps in the ecosystem

import { Router, Response } from 'express';
import { profileService } from '../services';
import {
  asyncHandler,
  validateUserId,
  ServiceAuthRequest,
  NotFoundError,
  ValidationError,
} from '../middleware';
import { AppEcosystem, UnifiedUserPreferences } from '../types';

const router = Router();

// Valid app ecosystem types - use UnifiedUserPreferences keys
const VALID_APPS: string[] = [
  'hotel',
  'restaurant',
  'salon',
  'healthcare',
  'lifestyle',
  'corporate',
];

// GET /preferences/:userId - Get all preferences
router.get(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { app } = req.query;

    let profile = await profileService.getByUserId(userId);

    // Auto-create if not exists (development only)
    if (!profile && process.env.NODE_ENV === 'development') {
      profile = await profileService.create({ userId });
    }

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    if (app && VALID_APPS.includes(app as AppEcosystem)) {
      const appKey = app as AppEcosystem;
      res.json({
        success: true,
        data: {
          [appKey]: (profile.preferences as any)[appKey],
        },
      });
    } else {
      res.json({
        success: true,
        data: profile.preferences,
      });
    }
  })
);

// PUT /preferences/:userId - Update preferences for a specific app
router.put(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { app, preferences } = req.body;

    if (!app) {
      throw new ValidationError('app is required');
    }

    if (!VALID_APPS.includes(app as AppEcosystem)) {
      throw new ValidationError(
        `Invalid app. Must be one of: ${VALID_APPS.join(', ')}`
      );
    }

    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('Valid preferences object is required');
    }

    const profile = await profileService.updatePreferences(
      userId,
      app as AppEcosystem,
      preferences
    );

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences,
    });
  })
);

// PATCH /preferences/:userId/:app - Update specific app preferences
router.patch(
  '/:userId/:app',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId, app } = req.params;
    const preferences = req.body;

    if (!VALID_APPS.includes(app as AppEcosystem)) {
      throw new ValidationError(
        `Invalid app. Must be one of: ${VALID_APPS.join(', ')}`
      );
    }

    const profile = await profileService.updatePreferences(
      userId,
      app as AppEcosystem,
      preferences
    );

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences,
    });
  })
);

// ─── Hotel Preferences (StayOwn) ───────────────────────────────────────────────

// GET /preferences/:userId/hotel - Get hotel preferences
router.get(
  '/:userId/hotel',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.hotel,
    });
  })
);

// PUT /preferences/:userId/hotel - Update hotel preferences
router.put(
  '/:userId/hotel',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const preferences = req.body;

    const profile = await profileService.updatePreferences(
      userId,
      'stayown',
      preferences
    );

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.hotel,
    });
  })
);

// ─── Restaurant Preferences ─────────────────────────────────────────────────────

// GET /preferences/:userId/restaurant - Get restaurant preferences
router.get(
  '/:userId/restaurant',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.restaurant,
    });
  })
);

// PUT /preferences/:userId/restaurant - Update restaurant preferences
router.put(
  '/:userId/restaurant',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const preferences = req.body;

    const profile = await profileService.updatePreferences(
      userId,
      'restaurant',
      preferences
    );

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.restaurant,
    });
  })
);

// ─── Salon Preferences ─────────────────────────────────────────────────────────

// GET /preferences/:userId/salon - Get salon preferences
router.get(
  '/:userId/salon',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.salon,
    });
  })
);

// PUT /preferences/:userId/salon - Update salon preferences
router.put(
  '/:userId/salon',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const preferences = req.body;

    const profile = await profileService.updatePreferences(userId, 'salon', preferences);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.salon,
    });
  })
);

// ─── Healthcare Preferences ────────────────────────────────────────────────────

// GET /preferences/:userId/healthcare - Get healthcare preferences
router.get(
  '/:userId/healthcare',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.healthcare,
    });
  })
);

// PUT /preferences/:userId/healthcare - Update healthcare preferences
router.put(
  '/:userId/healthcare',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const preferences = req.body;

    const profile = await profileService.updatePreferences(
      userId,
      'healthcare',
      preferences
    );

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.healthcare,
    });
  })
);

// ─── Lifestyle Preferences (Rendez) ──────────────────────────────────────────

// GET /preferences/:userId/lifestyle - Get lifestyle preferences
router.get(
  '/:userId/lifestyle',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.lifestyle,
    });
  })
);

// PUT /preferences/:userId/lifestyle - Update lifestyle preferences
router.put(
  '/:userId/lifestyle',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const preferences = req.body;

    const profile = await profileService.updatePreferences(userId, 'rendez', preferences);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.lifestyle,
    });
  })
);

// ─── Corporate Preferences (Corpspark) ────────────────────────────────────────

// GET /preferences/:userId/corporate - Get corporate preferences
router.get(
  '/:userId/corporate',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.corporate,
    });
  })
);

// PUT /preferences/:userId/corporate - Update corporate preferences
router.put(
  '/:userId/corporate',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const preferences = req.body;

    const profile = await profileService.updatePreferences(
      userId,
      'corpspark',
      preferences
    );

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.preferences.corporate,
    });
  })
);

export default router;

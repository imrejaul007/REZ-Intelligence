// REZ Knowledge Service - Unified Profile Routes
// Provides unified profile access across ALL apps

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

// GET /profile/:userId - Get unified user profile
router.get(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;

    let profile = await profileService.getByUserId(userId);

    // Auto-create if not exists (for development)
    if (!profile && process.env.NODE_ENV === 'development') {
      profile = await profileService.create({ userId });
    }

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile,
    });
  })
);

// POST /profile - Create new unified profile
router.post(
  '/',
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId, name, email, phone, avatar, dateOfBirth, gender } = req.body;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const existing = await profileService.getByUserId(userId);
    if (existing) {
      throw new ValidationError('Profile already exists for this user');
    }

    const profile = await profileService.create({
      userId,
      name,
      email,
      phone,
      avatar,
      dateOfBirth,
      gender,
    });

    res.status(201).json({
      success: true,
      data: profile,
    });
  })
);

// PUT /profile/:userId - Update unified profile
router.put(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { name, email, phone, avatar, dateOfBirth, gender } = req.body;

    const profile = await profileService.updateProfile(userId, {
      name,
      email,
      phone,
      avatar,
      dateOfBirth,
      gender: gender as 'male' | 'female' | 'non-binary' | 'prefer-not-to-say',
    });

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile,
    });
  })
);

// DELETE /profile/:userId - Delete unified profile
router.delete(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;

    const deleted = await profileService.deleteProfile(userId);

    if (!deleted) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      message: 'Profile deleted successfully',
    });
  })
);

// GET /profile/:userId/signals - Get signals for user
router.get(
  '/:userId/signals',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { type, app, limit, startDate, endDate } = req.query;

    const signals = await profileService.getSignals(userId, {
      type: type as string,
      app: app as AppEcosystem,
      limit: limit ? parseInt(limit as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: signals,
      count: signals.length,
    });
  })
);

// GET /profile/search - Search profiles
router.get(
  '/search',
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { email, phone, name, loyaltyTier } = req.query;

    const profiles = await profileService.searchProfiles({
      email: email as string,
      phone: phone as string,
      name: name as string,
      loyaltyTier: loyaltyTier as string,
    });

    res.json({
      success: true,
      data: profiles,
      count: profiles.length,
    });
  })
);

// POST /profile/:userId/link - Link another app's account
router.post(
  '/:userId/link',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { appSource, externalUserId } = req.body;

    if (!appSource || !VALID_APPS.includes(appSource as AppEcosystem)) {
      throw new ValidationError(
        `Invalid appSource. Must be one of: ${VALID_APPS.join(', ')}`
      );
    }

    if (!externalUserId) {
      throw new ValidationError('externalUserId is required');
    }

    const profile = await profileService.linkAccount(
      userId,
      appSource as AppEcosystem,
      externalUserId
    );

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile,
      message: `Account linked from ${appSource}`,
    });
  })
);

// POST /profile/:userId/sync - Sync data from all connected apps
router.post(
  '/:userId/sync',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { since } = req.body;

    const sinceDate = since ? new Date(since) : undefined;

    // Sync signals
    const signalResult = await signalCollector.syncSignalsToProfile(userId, sinceDate);

    // Sync preferences
    await signalCollector.syncPreferencesToProfile(userId);

    // Get updated profile
    const profile = await profileService.getByUserId(userId);

    res.json({
      success: true,
      data: {
        profile,
        syncResult: {
          signals: signalResult,
          preferences: 'synced',
        },
      },
    });
  })
);

// GET /profile/apps/status - Get status of all connected apps
router.get(
  '/apps/status',
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const status = await signalCollector.getAppStatus();

    res.json({
      success: true,
      data: status,
    });
  })
);

export default router;

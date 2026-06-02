// REZ Knowledge Service - Personalization Routes
// Provides unified personalization data for ALL apps

import { Router, Response } from 'express';
import { profileService } from '../services';
import {
  asyncHandler,
  validateUserId,
  ServiceAuthRequest,
  NotFoundError,
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

// GET /personalization/:userId - Get unified personalization data
router.get(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { apps } = req.query;

    let profile = await profileService.getByUserId(userId);

    // Auto-create if not exists (development only)
    if (!profile && process.env.NODE_ENV === 'development') {
      profile = await profileService.create({ userId });
    }

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    // Get personalization data
    const personalization = await profileService.getPersonalization(userId);

    const response: Record<string, unknown> = {
      profile: {
        userId: profile.userId,
        name: profile.name,
        email: profile.email,
        preferences: profile.preferences,
        history: profile.history,
        linkedAccounts: profile.linkedAccounts,
        personalization: profile.personalization,
      },
      personalization,
    };

    // Filter apps if specified
    if (apps) {
      const appList = (apps as string).split(',');
      response.profile = {
        ...(response.profile as object),
        preferences: Object.fromEntries(
          appList.map((app) => [app, (profile!.preferences as unknown as Record<string, unknown>)[app]])
        ),
      };
    }

    res.json({
      success: true,
      data: response,
    });
  })
);

// GET /personalization/:userId/recommendations - Get personalized recommendations
router.get(
  '/:userId/recommendations',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { apps } = req.query;

    const personalization = await profileService.getPersonalization(userId);

    if (!personalization) {
      throw new NotFoundError('User profile');
    }

    // Filter recommendations by app if specified
    if (apps) {
      const appList = (apps as string).split(',');
      const filteredRecommendations: Record<string, string[]> = {};

      for (const app of appList) {
        if (app === 'stayown' || app === 'hotel') {
          filteredRecommendations.hotels = personalization.recommendations.hotels || [];
        } else if (app === 'restaurant') {
          filteredRecommendations.restaurants = personalization.recommendations.restaurants || [];
        } else if (app === 'salon') {
          filteredRecommendations.salonServices = personalization.recommendations.salonServices || [];
        } else if (app === 'rendez') {
          filteredRecommendations.dates = personalization.recommendations.dates || [];
        } else if (app === 'corpspark') {
          filteredRecommendations.corporate = personalization.recommendations.corporate || [];
        }
      }

      res.json({
        success: true,
        data: {
          recommendations: filteredRecommendations,
          insights: personalization.insights,
        },
      });
    } else {
      res.json({
        success: true,
        data: personalization,
      });
    }
  })
);

// GET /personalization/:userId/:app - Get app-specific personalization
router.get(
  '/:userId/:app',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId, app } = req.params;

    if (!VALID_APPS.includes(app as AppEcosystem)) {
      res.status(400).json({
        success: false,
        error: `Invalid app. Must be one of: ${VALID_APPS.join(', ')}`,
      });
      return;
    }

    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    // Map app to preference key
    const preferenceKey = app === 'rez-consumer' ? 'restaurant' : app as keyof typeof profile.preferences;
    const appPreferences = profile.preferences[preferenceKey as keyof typeof profile.preferences];

    const personalization = await profileService.getPersonalization(userId);

    res.json({
      success: true,
      data: {
        userId,
        app,
        preferences: appPreferences || {},
        history: profile.history,
        signals: profile.signals.filter((s) => s.source === app),
        personalization: personalization ? {
          recommendations: personalization.recommendations,
          insights: personalization.insights,
        } : null,
      },
    });
  })
);

// GET /personalization/:userId/insights - Get user insights
router.get(
  '/:userId/insights',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;

    const personalization = await profileService.getPersonalization(userId);

    if (!personalization) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: {
        insights: personalization.insights,
        loyaltyTier: personalization.insights.loyaltyBenefits ? 'active' : 'inactive',
      },
    });
  })
);

// POST /personalization/:userId/infer - Trigger preference inference
router.post(
  '/:userId/infer',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;

    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    // Analyze signals to infer interests
    const signals = await profileService.getSignals(userId, { limit: 100 });

    // Extract interests from signals
    const interestsSet = new Set<string>();
    const categoriesSet = new Set<string>();

    for (const signal of signals) {
      if (signal.enrichedData?.tags) {
        signal.enrichedData.tags.forEach((tag) => interestsSet.add(tag));
      }
      if (signal.enrichedData?.category) {
        signal.enrichedData.category.forEach((cat) => categoriesSet.add(cat));
      }
      // Extract from type
      const typeParts = signal.type.split('.');
      if (typeParts.length > 1) {
        categoriesSet.add(typeParts[0]);
      }
    }

    // Update personalization
    const inferredInterests = Array.from(interestsSet);
    const inferredCategories = Array.from(categoriesSet);

    res.json({
      success: true,
      data: {
        inferredInterests,
        inferredCategories,
        totalSignalsAnalyzed: signals.length,
      },
    });
  })
);

export default router;

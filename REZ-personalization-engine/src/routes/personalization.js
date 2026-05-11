const express = require('express');
const router = express.Router();
const personalizationService = require('../services/personalizationService');
const cache = require('../utils/cache');
const logger = require('../utils/logger.ts');

// Zod validation schemas
const {
  validateBody,
  validateQuery,
  HomepageQuerySchema,
  RecommendationsQuerySchema,
  SearchPersonalizationRequestSchema,
  UserDNAProfileUpdateSchema,
  RecordInteractionRequestSchema,
  BatchRequestSchema,
  CampaignTrackingRequestSchema
} = require('../schemas/index');

/**
 * GET /personalize/homepage
 * Get personalized homepage feed for a user
 */
router.get('/homepage', validateQuery(HomepageQuerySchema), async (req, res) => {
  try {
    const { userId, limit, refresh } = req.query;

    const result = await personalizationService.personalizeHomepage(userId, {
      limit: parseInt(limit),
      refresh
    });

    res.json(result);

  } catch (error) {
    logger.error('Error in GET /personalize/homepage:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate personalized homepage'
    });
  }
});

/**
 * GET /personalize/search
 * Personalize search results for a user
 */
router.get('/search', validateQuery(z.object({
  userId: z.string().min(1),
  query: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})), async (req, res) => {
  try {
    const { userId, query, q } = req.query;
    const searchQuery = query || q;

    if (!searchQuery) {
      return res.status(400).json({
        error: 'Search query is required',
        message: 'Please provide a query or q query parameter'
      });
    }

    // In a real implementation, this would call the search service
    // For now, we return the query for the client to handle
    res.json({
      userId,
      query: searchQuery,
      meta: {
        message: 'Please provide search results to personalize',
        personalized: false
      }
    });

  } catch (error) {
    logger.error('Error in GET /personalize/search:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to personalize search results'
    });
  }
});

/**
 * POST /personalize/search
 * Personalize provided search results
 */
router.post('/search', validateBody(SearchPersonalizationRequestSchema), async (req, res) => {
  try {
    const { userId, query, results, limit } = req.body;

    const personalizedResults = await personalizationService.personalizeSearch(
      userId,
      query,
      results,
      { limit }
    );

    res.json(personalizedResults);

  } catch (error) {
    logger.error('Error in POST /personalize/search:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to personalize search results'
    });
  }
});

/**
 * GET /personalize/recommendations
 * Get personalized recommendations for a user
 */
router.get('/recommendations', validateQuery(RecommendationsQuerySchema), async (req, res) => {
  try {
    const { userId, type, limit } = req.query;

    const result = await personalizationService.getRecommendations(userId, type, {
      limit
    });

    res.json(result);

  } catch (error) {
    logger.error('Error in GET /personalize/recommendations:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate recommendations'
    });
  }
});

/**
 * POST /personalize/user/:userId
 * Update user profile with new data
 */
router.post('/user/:userId', validateBody(UserDNAProfileUpdateSchema), async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const updatedProfile = await personalizationService.updateUserProfile(userId, updates);

    res.json({
      success: true,
      message: 'User profile updated successfully',
      profile: updatedProfile
    });

  } catch (error) {
    logger.error('Error in POST /personalize/user/:userId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user profile'
    });
  }
});

/**
 * GET /personalize/user/:userId
 * Get user profile
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const UserDNAProfile = require('../models/UserDNAProfile');

    const profile = await UserDNAProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        error: 'Profile not found',
        message: `No profile found for userId: ${userId}`
      });
    }

    res.json({
      userId,
      profile,
      segment: await personalizationService.getUserSegment(userId)
    });

  } catch (error) {
    logger.error('Error in GET /personalize/user/:userId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user profile'
    });
  }
});

/**
 * POST /personalize/interaction
 * Record a user interaction
 */
router.post('/interaction', validateBody(RecordInteractionRequestSchema), async (req, res) => {
  try {
    const { userId, itemId, itemType, type, context, value, duration, metadata } = req.body;

    const interaction = await personalizationService.recordInteraction(userId, {
      itemId,
      itemType,
      type,
      context,
      value,
      duration,
      metadata
    });

    res.status(201).json({
      success: true,
      interaction: {
        id: interaction._id,
        userId: interaction.userId,
        itemId: interaction.itemId,
        type: interaction.type,
        timestamp: interaction.timestamp
      }
    });

  } catch (error) {
    logger.error('Error in POST /personalize/interaction:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to record interaction'
    });
  }
});

/**
 * GET /personalize/segment/:userId
 * Get user segment for targeting
 */
router.get('/segment/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const segment = await personalizationService.getUserSegment(userId);

    if (!segment) {
      return res.status(404).json({
        error: 'User not found',
        message: `No segment data for userId: ${userId}`
      });
    }

    res.json(segment);

  } catch (error) {
    logger.error('Error in GET /personalize/segment/:userId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user segment'
    });
  }
});

/**
 * POST /personalize/campaign/:campaignId/track
 * Track campaign performance
 */
router.post('/campaign/:campaignId/track', validateBody(CampaignTrackingRequestSchema), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { interactions } = req.body;

    // Store campaign interactions
    if (interactions && Array.isArray(interactions)) {
      const Interaction = require('../models/Interaction');
      const InteractionModel = require('../models/Interaction');

      const docs = interactions.map(i => ({
        ...i,
        metadata: { ...i.metadata, campaignId }
      }));

      await InteractionModel.insertMany(docs);
    }

    res.json({
      success: true,
      tracked: interactions?.length || 0
    });

  } catch (error) {
    logger.error('Error in POST /personalize/campaign/:campaignId/track:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /personalize/campaign/:campaignId/performance
 * Get campaign performance metrics
 */
router.get('/campaign/:campaignId/performance', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const performance = await personalizationService.getCampaignPerformance(campaignId);

    res.json(performance);

  } catch (error) {
    logger.error('Error in GET /personalize/campaign/:campaignId/performance:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /personalize/similar/:itemId
 * Get similar items to a given item
 */
router.get('/similar/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { limit = 10 } = req.query;

    const ContentItem = require('../models/ContentItem');

    // Get similar items using collaborative filtering
    const similarItems = await require('../algorithms/collaborativeFiltering').getSimilarItems(
      itemId,
      parseInt(limit)
    );

    // Enrich with item data
    const itemIds = similarItems.map(i => i.itemId);
    const items = await ContentItem.find({ itemId: { $in: itemIds } }).lean();

    const enrichedSimilar = similarItems.map(s => ({
      ...s,
      item: items.find(i => i.itemId === s.itemId)
    }));

    res.json({
      itemId,
      similarItems: enrichedSimilar
    });

  } catch (error) {
    logger.error('Error in GET /personalize/similar/:itemId:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /personalize/batch
 * Batch personalization for multiple users
 */
router.post('/batch', validateBody(BatchRequestSchema), async (req, res) => {
  try {
    const { requests } = req.body;

    const results = await Promise.allSettled(
      requests.map(async (request) => {
        const { type, userId, params } = request;

        switch (type) {
          case 'homepage':
            return personalizationService.personalizeHomepage(userId, params);
          case 'recommendations':
            return personalizationService.getRecommendations(userId, params?.type || 'for_you', params);
          default:
            throw new Error(`Unknown batch request type: ${type}`);
        }
      })
    );

    const responses = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { index, success: true, data: result.value };
      } else {
        return { index, success: false, error: result.reason.message };
      }
    });

    res.json({
      total: requests.length,
      successful: responses.filter(r => r.success).length,
      failed: responses.filter(r => !r.success).length,
      results: responses
    });

  } catch (error) {
    logger.error('Error in POST /personalize/batch:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /personalize/stats
 * Get personalization engine statistics
 */
router.get('/stats', (req, res) => {
  res.json({
    cache: cache.stats(),
    banditStats: require('../algorithms/contextualBandits').getStats(),
    weights: {
      collaborative: parseFloat(process.env.COLLABORATIVE_FILTERING_WEIGHT) || 0.4,
      contentBased: parseFloat(process.env.CONTENT_BASED_WEIGHT) || 0.35
    },
    uptime: process.uptime()
  });
});

/**
 * DELETE /personalize/cache
 * Clear personalization cache
 */
router.delete('/cache', (req, res) => {
  const { pattern } = req.query;

  if (pattern) {
    cache.delPattern(pattern);
    res.json({ success: true, message: `Cleared cache matching pattern: ${pattern}` });
  } else {
    cache.flush();
    res.json({ success: true, message: 'All personalization cache cleared' });
  }
});

module.exports = router;

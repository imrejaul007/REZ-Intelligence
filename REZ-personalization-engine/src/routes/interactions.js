const express = require('express');
const router = express.Router();
const Interaction = require('../models/Interaction');
const logger = require('../utils/logger.ts');

// Zod validation schemas
const {
  validateQuery,
  validateBody,
  InteractionListQuerySchema,
  AnalyticsQuerySchema
} = require('../schemas/index');
const { z } = require('zod');

/**
 * GET /interactions
 * Get interactions with filtering
 */
router.get('/', validateQuery(InteractionListQuerySchema), async (req, res) => {
  try {
    const {
      userId,
      itemId,
      type,
      startDate,
      endDate,
      page,
      limit
    } = req.query;

    const query = {};

    if (userId) query.userId = userId;
    if (itemId) query.itemId = itemId;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [interactions, total] = await Promise.all([
      Interaction.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Interaction.countDocuments(query)
    ]);

    res.json({
      interactions,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error getting interactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /interactions/user/:userId
 * Get all interactions for a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, type } = req.query;

    const query = { userId };
    if (type) query.type = type;

    const interactions = await Interaction.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      userId,
      interactions,
      count: interactions.length
    });

  } catch (error) {
    logger.error('Error getting user interactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /interactions/item/:itemId
 * Get all interactions for an item
 */
router.get('/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { limit = 100 } = req.query;

    const interactions = await Interaction.find({ itemId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Get interaction type distribution
    const distribution = await Interaction.aggregate([
      { $match: { itemId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      itemId,
      interactions,
      count: interactions.length,
      distribution: distribution.reduce((acc, d) => {
        acc[d._id] = d.count;
        return acc;
      }, {})
    });

  } catch (error) {
    logger.error('Error getting item interactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /interactions/analytics/user/:userId
 * Get interaction analytics for a user
 */
router.get('/analytics/user/:userId', validateQuery(AnalyticsQuerySchema), async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.query;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const analytics = await Interaction.aggregate([
      {
        $match: {
          userId,
          timestamp: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: null,
          totalInteractions: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemId' },
          interactionTypes: { $addToSet: '$type' },
          avgValue: { $avg: '$value' },
          firstInteraction: { $min: '$timestamp' },
          lastInteraction: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          _id: 0,
          totalInteractions: 1,
          uniqueItemCount: { $size: '$uniqueItems' },
          interactionTypeCount: { $size: '$interactionTypes' },
          avgValue: 1,
          firstInteraction: 1,
          lastInteraction: 1,
          daysActive: {
            $divide: [
              { $subtract: ['$lastInteraction', '$firstInteraction'] },
              24 * 60 * 60 * 1000
            ]
          }
        }
      }
    ]);

    // Get type distribution
    const typeDistribution = await Interaction.aggregate([
      {
        $match: {
          userId,
          timestamp: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgValue: { $avg: '$value' }
        }
      }
    ]);

    // Get daily activity
    const dailyActivity = await Interaction.aggregate([
      {
        $match: {
          userId,
          timestamp: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      userId,
      period: { days, from: cutoffDate },
      summary: analytics[0] || {
        totalInteractions: 0,
        uniqueItemCount: 0,
        avgValue: 0
      },
      typeDistribution: typeDistribution.reduce((acc, d) => {
        acc[d._id] = { count: d.count, avgValue: d.avgValue };
        return acc;
      }, {}),
      dailyActivity
    });

  } catch (error) {
    logger.error('Error getting user interaction analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /interactions/analytics/popular-items
 * Get popular items based on interactions
 */
router.get('/analytics/popular-items', validateQuery(z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['view', 'click', 'hover', 'add_to_cart', 'purchase', 'like', 'share', 'save', 'review', 'dismiss']).optional()
})), async (req, res) => {
  try {
    const { days, limit, type } = req.query;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const match = { timestamp: { $gte: cutoffDate } };
    if (type) match.type = type;

    const popularItems = await Interaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$itemId',
          interactionCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          types: { $push: '$type' }
        }
      },
      {
        $addFields: {
          userCount: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { interactionCount: -1 } },
      { $limit: limit }
    ]);

    res.json({
      period: { days, from: cutoffDate },
      popularItems: popularItems.map(item => ({
        itemId: item._id,
        interactionCount: item.interactionCount,
        uniqueUsers: item.userCount,
        interactionTypes: [...new Set(item.types)]
      }))
    });

  } catch (error) {
    logger.error('Error getting popular items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /interactions/cleanup
 * Clean up old interactions
 */
router.delete('/cleanup', validateBody(z.object({
  days: z.number().int().min(1).max(365).default(90)
})), async (req, res) => {
  try {
    const { days } = req.body;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await Interaction.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    res.json({
      success: true,
      deleted: result.deletedCount,
      cutoffDate
    });

  } catch (error) {
    logger.error('Error cleaning up interactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

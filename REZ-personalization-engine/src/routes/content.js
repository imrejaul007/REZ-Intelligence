const express = require('express');
const router = express.Router();
const ContentItem = require('../models/ContentItem');
const logger = require('../utils/logger.ts');

// Zod validation schemas
const {
  validateBody,
  validateQuery,
  ContentItemCreateSchema,
  ContentItemUpdateSchema,
  ContentListQuerySchema
} = require('../schemas/index');
const { z } = require('zod');

/**
 * POST /content
 * Create a new content item
 */
router.post('/', validateBody(ContentItemCreateSchema), async (req, res) => {
  try {
    const contentData = req.body;

    const contentItem = new ContentItem(contentData);
    await contentItem.save();

    res.status(201).json({
      success: true,
      item: contentItem
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Item already exists',
        message: `An item with itemId ${req.body.itemId} already exists`
      });
    }
    logger.error('Error creating content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /content/:itemId
 * Get content item by ID
 */
router.get('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await ContentItem.findOne({ itemId }).lean();

    if (!item) {
      return res.status(404).json({
        error: 'Item not found',
        message: `No item found with itemId: ${itemId}`
      });
    }

    res.json(item);

  } catch (error) {
    logger.error('Error getting content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /content/:itemId
 * Update content item
 */
router.put('/:itemId', validateBody(ContentItemUpdateSchema), async (req, res) => {
  try {
    const { itemId } = req.params;
    const updates = req.body;

    const item = await ContentItem.findOneAndUpdate(
      { itemId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    res.json({
      success: true,
      item
    });

  } catch (error) {
    logger.error('Error updating content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /content/:itemId
 * Delete content item
 */
router.delete('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await ContentItem.deleteOne({ itemId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    res.json({
      success: true,
      message: `Item ${itemId} deleted`
    });

  } catch (error) {
    logger.error('Error deleting content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /content
 * List content items with filtering
 */
router.get('/', validateQuery(ContentListQuerySchema), async (req, res) => {
  try {
    const {
      category,
      itemType,
      brandId,
      available,
      minRating,
      minPrice,
      maxPrice,
      sort,
      page,
      limit
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (itemType) query.itemType = itemType;
    if (brandId) query.brandId = brandId;
    if (available !== undefined) query.available = available;
    if (minRating) query['rating'] = { $gte: minRating };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ContentItem.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ContentItem.countDocuments(query)
    ]);

    res.json({
      items,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error listing content items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /content/bulk
 * Bulk create/update content items
 */
router.post('/bulk', validateBody(z.object({
  items: z.array(ContentItemCreateSchema).min(1, 'At least one item is required')
})), async (req, res) => {
  try {
    const { items } = req.body;

    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { itemId: item.itemId },
        update: { $set: { ...item, updatedAt: new Date() } },
        upsert: true
      }
    }));

    const result = await ContentItem.bulkWrite(bulkOps);

    res.json({
      success: true,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
      matched: result.matchedCount
    });

  } catch (error) {
    logger.error('Error in bulk content operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /content/categories
 * Get list of categories with item counts
 */
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await ContentItem.aggregate([
      { $match: { available: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      categories: categories.map(c => ({
        category: c._id,
        itemCount: c.count,
        avgRating: c.avgRating,
        avgPrice: c.avgPrice
      }))
    });

  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /content/brands
 * Get list of brands with item counts
 */
router.get('/meta/brands', async (req, res) => {
  try {
    const brands = await ContentItem.aggregate([
      { $match: { available: true, brandId: { $exists: true } } },
      {
        $group: {
          _id: '$brandId',
          name: { $first: '$brandName' },
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 100 }
    ]);

    res.json({
      brands: brands.map(b => ({
        brandId: b._id,
        brandName: b.name,
        itemCount: b.count,
        avgRating: b.avgRating
      }))
    });

  } catch (error) {
    logger.error('Error getting brands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

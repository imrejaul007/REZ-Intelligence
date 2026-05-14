import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Franchise, Location } from '../index.js';

const router = Router();

/**
 * POST /api/franchises
 * Create a new franchise
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, ownerId, businessType, branding, contact, billing, settings } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name and ownerId are required'
      });
    }

    const franchiseId = `FRN-${uuidv4().substring(0, 8).toUpperCase()}`;

    const franchise = new Franchise({
      franchiseId,
      name,
      ownerId,
      businessType: businessType || 'retail',
      branding,
      contact,
      billing,
      settings,
      status: 'active'
    });

    await franchise.save();

    res.status(201).json({
      success: true,
      data: franchise
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/franchises
 * List all franchises
 */
router.get('/', async (req, res, next) => {
  try {
    const { ownerId, businessType, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (ownerId) query.ownerId = ownerId;
    if (businessType) query.businessType = businessType;
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [franchises, total] = await Promise.all([
      Franchise.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Franchise.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        franchises,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/franchises/:franchiseId
 * Get franchise details
 */
router.get('/:franchiseId', async (req, res, next) => {
  try {
    const { franchiseId } = req.params;

    const franchise = await Franchise.findOne({ franchiseId });

    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Franchise not found: ${franchiseId}`
      });
    }

    // Get location count
    const locationCount = await Location.countDocuments({ franchiseId });

    res.json({
      success: true,
      data: {
        ...franchise.toObject(),
        locationCount
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/franchises/:franchiseId
 * Update franchise
 */
router.patch('/:franchiseId', async (req, res, next) => {
  try {
    const { franchiseId } = req.params;
    const updates = req.body;

    delete updates.franchiseId;
    delete updates.createdAt;

    updates.updatedAt = new Date();

    const franchise = await Franchise.findOneAndUpdate(
      { franchiseId },
      updates,
      { new: true }
    );

    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Franchise not found: ${franchiseId}`
      });
    }

    res.json({
      success: true,
      data: franchise
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/franchises/:franchiseId/status
 * Update franchise status
 */
router.patch('/:franchiseId/status', async (req, res, next) => {
  try {
    const { franchiseId } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'suspended', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const franchise = await Franchise.findOneAndUpdate(
      { franchiseId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Franchise not found: ${franchiseId}`
      });
    }

    // Update all locations if suspending/closing
    if (status === 'suspended' || status === 'closed') {
      await Location.updateMany(
        { franchiseId },
        { status: 'inactive', updatedAt: new Date() }
      );
    } else if (status === 'active') {
      await Location.updateMany(
        { franchiseId, status: 'inactive' },
        { status: 'active', updatedAt: new Date() }
      );
    }

    res.json({
      success: true,
      data: franchise
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/franchises/:franchiseId
 * Delete franchise (soft delete)
 */
router.delete('/:franchiseId', async (req, res, next) => {
  try {
    const { franchiseId } = req.params;

    const franchise = await Franchise.findOneAndUpdate(
      { franchiseId },
      { status: 'closed', updatedAt: new Date() },
      { new: true }
    );

    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Franchise not found: ${franchiseId}`
      });
    }

    // Close all locations
    await Location.updateMany(
      { franchiseId },
      { status: 'inactive', updatedAt: new Date() }
    );

    res.json({
      success: true,
      data: { franchiseId, status: 'closed' }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

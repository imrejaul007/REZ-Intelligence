import { Router } from 'express';
import { Franchise, Location, LocationInventory } from '../index.js';

const router = Router();

/**
 * GET /api/analytics/franchise/:franchiseId
 * Get franchise analytics
 */
router.get('/franchise/:franchiseId', async (req, res, next) => {
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

    const locationStats = await Location.aggregate([
      { $match: { franchiseId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalLocations = await Location.countDocuments({ franchiseId });

    const inventoryStats = await LocationInventory.aggregate([
      { $match: { franchiseId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$quantity' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        franchise: {
          franchiseId: franchise.franchiseId,
          name: franchise.name,
          status: franchise.status
        },
        locations: {
          total: totalLocations,
          byStatus: locationStats
        },
        inventory: {
          byStatus: inventoryStats
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/location/:locationId
 * Get location analytics
 */
router.get('/location/:locationId', async (req, res, next) => {
  try {
    const { locationId } = req.params;

    const location = await Location.findOne({ locationId });

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Location not found: ${locationId}`
      });
    }

    const inventoryStats = await LocationInventory.aggregate([
      { $match: { locationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    const lowStockCount = await LocationInventory.countDocuments({
      locationId,
      $or: [
        { status: 'low_stock' },
        { status: 'out_of_stock' }
      ]
    });

    res.json({
      success: true,
      data: {
        location: {
          locationId: location.locationId,
          name: location.name,
          code: location.code,
          status: location.status,
          stats: location.stats
        },
        inventory: {
          byStatus: inventoryStats,
          lowStockCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/inventory-summary
 * Get inventory summary across all locations
 */
router.get('/inventory-summary', async (req, res, next) => {
  try {
    const { franchiseId } = req.query;

    const query = franchiseId ? { franchiseId } : {};

    const summary = await LocationInventory.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    const totalInventory = await LocationInventory.countDocuments(query);

    res.json({
      success: true,
      data: {
        summary,
        totalItems: totalInventory,
        franchiseId: franchiseId || 'all'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/top-locations
 * Get top performing locations
 */
router.get('/top-locations', async (req, res, next) => {
  try {
    const { franchiseId, metric = 'totalRevenue', limit = 10 } = req.query;

    const query = franchiseId ? { franchiseId, status: 'active' } : { status: 'active' };

    const topLocations = await Location.find(query)
      .sort({ [`stats.${metric}`]: -1 })
      .limit(parseInt(limit))
      .select('locationId name code stats');

    res.json({
      success: true,
      data: {
        metric,
        locations: topLocations
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Driver, Delivery, broadcastLocationUpdate } from '../index.js';

const router = Router();

// Validation helpers
function handleValidationError(error, res) {
  res.status(400).json({
    success: false,
    error: 'Validation Error',
    message: error.message
  });
}

/**
 * POST /api/drivers
 * Register a new driver
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, vehicle } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name and phone are required'
      });
    }

    const driverId = `DRV-${uuidv4().substring(0, 8).toUpperCase()}`;

    const driver = new Driver({
      driverId,
      name,
      phone,
      email,
      vehicle,
      status: 'offline',
      stats: {
        totalDeliveries: 0,
        completedToday: 0,
        averageRating: 5,
        totalDistanceKm: 0
      }
    });

    await driver.save();

    res.status(201).json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/drivers
 * List all drivers
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [drivers, total] = await Promise.all([
      Driver.find(query)
        .sort({ 'stats.totalDeliveries': -1 })
        .skip(skip)
        .limit(limitNum),
      Driver.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        drivers,
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
 * GET /api/drivers/:driverId
 * Get driver details
 */
router.get('/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/drivers/:driverId/status
 * Update driver status
 */
router.patch('/:driverId/status', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { status } = req.body;

    const validStatuses = ['available', 'busy', 'offline', 'on_break'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { driverId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/drivers/:driverId/location
 * Update driver location (GPS tracking)
 */
router.post('/:driverId/location', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { latitude, longitude, heading, speed } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'latitude and longitude are required'
      });
    }

    const location = {
      latitude,
      longitude,
      heading: heading || 0,
      speed: speed || 0,
      updatedAt: new Date()
    };

    const driver = await Driver.findOneAndUpdate(
      { driverId },
      {
        currentLocation: location,
        $push: {
          locationHistory: {
            $each: [location],
            $slice: -100 // Keep last 100 locations
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    // Broadcast location update
    await broadcastLocationUpdate(driverId, location);

    // Update any active delivery's current location
    await Delivery.updateOne(
      { driverId, status: 'in_transit' },
      { currentLocation: location }
    );

    res.json({
      success: true,
      data: {
        driverId,
        location: driver.currentLocation
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/drivers/:driverId/location
 * Get current driver location
 */
router.get('/:driverId/location', async (req, res, next) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findOne({ driverId }, { currentLocation: 1, driverId: 1, name: 1, status: 1 });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/drivers/:driverId/location/history
 * Get driver location history
 */
router.get('/:driverId/location/history', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { hours = 24 } = req.query;

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    const cutoffTime = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const history = driver.locationHistory.filter(loc => loc.updatedAt >= cutoffTime);

    res.json({
      success: true,
      data: {
        driverId,
        history,
        params: { hours: parseInt(hours) }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/drivers/:driverId/deliveries
 * Get driver's deliveries
 */
router.get('/:driverId/deliveries', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { driverId };
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [deliveries, total] = await Promise.all([
      Delivery.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Delivery.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        driverId,
        deliveries,
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
 * GET /api/drivers/nearby
 * Find nearby available drivers
 */
router.get('/search/nearby', async (req, res, next) => {
  try {
    const { latitude, longitude, radiusKm = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radius = parseFloat(radiusKm);

    // Find available drivers
    const drivers = await Driver.find({
      status: 'available',
      currentLocation: {
        $exists: true
      }
    }).limit(50);

    // Calculate distances and filter
    const nearbyDrivers = drivers
      .map(driver => {
        if (!driver.currentLocation) return null;

        const R = 6371000;
        const dLat = (driver.currentLocation.latitude - lat) * Math.PI / 180;
        const dLng = (driver.currentLocation.longitude - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(driver.currentLocation.latitude * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return {
          ...driver.toObject(),
          distanceMeters: Math.round(distance)
        };
      })
      .filter(d => d && d.distanceMeters <= radius * 1000)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    res.json({
      success: true,
      data: {
        drivers: nearbyDrivers,
        searchParams: { latitude: lat, longitude: lng, radiusKm: radius }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/drivers/:driverId/stats
 * Get driver statistics
 */
router.get('/:driverId/stats', async (req, res, next) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findOne({ driverId }, { stats: 1, driverId: 1, name: 1 });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    // Get today's deliveries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await Delivery.aggregate([
      {
        $match: {
          driverId,
          status: 'delivered',
          'timeline.timestamp': { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        driverId,
        stats: {
          ...driver.stats,
          completedToday: todayStats[0]?.count || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/drivers/:driverId
 * Remove a driver
 */
router.delete('/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;

    // Check for active deliveries
    const activeDeliveries = await Delivery.countDocuments({
      driverId,
      status: { $in: ['assigned', 'picked_up', 'in_transit'] }
    });

    if (activeDeliveries > 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Driver has ${activeDeliveries} active deliveries. Complete or reassign them first.`
      });
    }

    const result = await Driver.deleteOne({ driverId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    res.json({
      success: true,
      data: { driverId, deleted: true }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Delivery, Driver, calculateETA } from '../index.js';

const router = Router();

// Validation helpers
function handleValidationError(error, res) {
  res.status(400).json({
    success: false,
    error: 'Validation Error',
    message: error.message
  });
}

// Validate coordinates
function validateCoordinates(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * POST /api/delivery
 * Create a new delivery
 */
router.post('/', async (req, res, next) => {
  try {
    const { orderId, pickup, dropoff, driverId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'orderId is required'
      });
    }

    if (!pickup || !pickup.latitude || !pickup.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Pickup location with latitude and longitude is required'
      });
    }

    if (!dropoff || !dropoff.latitude || !dropoff.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Dropoff location with latitude and longitude is required'
      });
    }

    if (!validateCoordinates(pickup.latitude, pickup.longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid pickup coordinates'
      });
    }

    if (!validateCoordinates(dropoff.latitude, dropoff.longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid dropoff coordinates'
      });
    }

    const deliveryId = `DEL-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Calculate initial ETA
    const eta = calculateETA(
      pickup.latitude, pickup.longitude,
      dropoff.latitude, dropoff.longitude
    );

    const delivery = new Delivery({
      deliveryId,
      orderId,
      driverId,
      status: driverId ? 'assigned' : 'pending',
      pickup,
      dropoff,
      eta: {
        estimatedMinutes: eta.estimatedMinutes,
        calculatedAt: new Date(),
        distanceMeters: eta.distanceMeters
      },
      timeline: [{
        status: 'pending',
        timestamp: new Date(),
        location: { latitude: pickup.latitude, longitude: pickup.longitude },
        notes: 'Delivery created'
      }]
    });

    await delivery.save();

    res.status(201).json({
      success: true,
      data: delivery
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/delivery/:deliveryId
 * Get delivery details
 */
router.get('/:deliveryId', async (req, res, next) => {
  try {
    const { deliveryId } = req.params;

    const delivery = await Delivery.findOne({ deliveryId });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Delivery not found: ${deliveryId}`
      });
    }

    res.json({
      success: true,
      data: delivery
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/delivery
 * List deliveries with filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, driverId, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (driverId) query.driverId = driverId;

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
 * PATCH /api/delivery/:deliveryId/status
 * Update delivery status
 */
router.patch('/:deliveryId/status', async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { status, location, notes } = req.body;

    const validTransitions = {
      pending: ['assigned', 'cancelled'],
      assigned: ['picked_up', 'cancelled'],
      picked_up: ['in_transit', 'cancelled'],
      in_transit: ['delivered', 'failed'],
      delivered: [],
      cancelled: [],
      failed: ['in_transit']
    };

    const delivery = await Delivery.findOne({ deliveryId });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Delivery not found: ${deliveryId}`
      });
    }

    if (!validTransitions[delivery.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Cannot transition from ${delivery.status} to ${status}`
      });
    }

    delivery.status = status;
    delivery.timeline.push({
      status,
      timestamp: new Date(),
      location: location || delivery.currentLocation,
      notes: notes || `Status changed to ${status}`
    });

    if (status === 'delivered') {
      delivery.metadata = delivery.metadata || {};
      delivery.metadata.actualDeliveryTime = new Date();
    }

    delivery.updatedAt = new Date();
    await delivery.save();

    // Update driver stats if delivered
    if (status === 'delivered' && delivery.driverId) {
      await Driver.updateOne(
        { driverId: delivery.driverId },
        {
          $inc: {
            'stats.totalDeliveries': 1,
            'stats.completedToday': 1
          }
        }
      );
    }

    res.json({
      success: true,
      data: delivery
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/delivery/:deliveryId/assign
 * Assign driver to delivery
 */
router.patch('/:deliveryId/assign', async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'driverId is required'
      });
    }

    const driver = await Driver.findOne({ driverId });
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Driver not found: ${driverId}`
      });
    }

    const delivery = await Delivery.findOneAndUpdate(
      { deliveryId, status: 'pending' },
      {
        driverId,
        status: 'assigned',
        $push: {
          timeline: {
            status: 'assigned',
            timestamp: new Date(),
            notes: `Driver ${driver.name} assigned`
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Pending delivery not found: ${deliveryId}`
      });
    }

    // Update driver status
    await Driver.updateOne(
      { driverId },
      { status: 'busy' }
    );

    res.json({
      success: true,
      data: delivery
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/delivery/:deliveryId/eta
 * Update delivery ETA
 */
router.patch('/:deliveryId/eta', async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { driverLatitude, driverLongitude } = req.body;

    if (driverLatitude === undefined || driverLongitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'driverLatitude and driverLongitude are required'
      });
    }

    const delivery = await Delivery.findOne({ deliveryId });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Delivery not found: ${deliveryId}`
      });
    }

    const eta = calculateETA(
      driverLatitude, driverLongitude,
      delivery.dropoff.latitude, delivery.dropoff.longitude
    );

    delivery.eta = {
      estimatedMinutes: eta.estimatedMinutes,
      calculatedAt: new Date(),
      distanceMeters: eta.distanceMeters
    };
    delivery.updatedAt = new Date();
    await delivery.save();

    res.json({
      success: true,
      data: {
        deliveryId,
        eta: delivery.eta
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/delivery/nearby
 * Find nearby deliveries
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

    // Simple bounding box filter (not accurate for large distances)
    const latDelta = radius / 111; // ~111km per degree latitude
    const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180));

    const deliveries = await Delivery.find({
      status: { $in: ['pending', 'assigned'] },
      'pickup.latitude': { $gte: lat - latDelta, $lte: lat + latDelta },
      'pickup.longitude': { $gte: lng - lngDelta, $lte: lng + lngDelta }
    }).limit(50);

    // Filter by actual distance
    const nearbyDeliveries = deliveries.filter(d => {
      const eta = calculateETA(
        lat, lng,
        d.pickup.latitude, d.pickup.longitude
      );
      return eta.distanceMeters <= radius * 1000;
    });

    res.json({
      success: true,
      data: {
        deliveries: nearbyDeliveries,
        searchParams: { latitude: lat, longitude: lng, radiusKm: radius }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/delivery/:deliveryId/timeline
 * Get delivery timeline
 */
router.get('/:deliveryId/timeline', async (req, res, next) => {
  try {
    const { deliveryId } = req.params;

    const delivery = await Delivery.findOne({ deliveryId }, { timeline: 1, deliveryId: 1 });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Delivery not found: ${deliveryId}`
      });
    }

    res.json({
      success: true,
      data: {
        deliveryId,
        timeline: delivery.timeline
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/delivery/:deliveryId
 * Cancel a delivery
 */
router.delete('/:deliveryId', async (req, res, next) => {
  try {
    const { deliveryId } = req.params;

    const delivery = await Delivery.findOneAndUpdate(
      { deliveryId, status: { $in: ['pending', 'assigned'] } },
      {
        status: 'cancelled',
        $push: {
          timeline: {
            status: 'cancelled',
            timestamp: new Date(),
            notes: 'Delivery cancelled'
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Active delivery not found: ${deliveryId}`
      });
    }

    // Free up driver if assigned
    if (delivery.driverId) {
      await Driver.updateOne(
        { driverId: delivery.driverId },
        { status: 'available' }
      );
    }

    res.json({
      success: true,
      data: { deliveryId, status: 'cancelled' }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

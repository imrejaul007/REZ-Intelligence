import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Location, Franchise } from '../index.js';

const router = Router();

/**
 * POST /api/locations
 * Create a new location
 */
router.post('/', async (req, res, next) => {
  try {
    const { franchiseId, name, code, type, address, contact, operatingHours, capacity, amenities, settings } = req.body;

    if (!franchiseId || !name || !code) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'franchiseId, name, and code are required'
      });
    }

    // Verify franchise exists
    const franchise = await Franchise.findOne({ franchiseId });
    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Franchise not found: ${franchiseId}`
      });
    }

    // Check code uniqueness within franchise
    const existingCode = await Location.findOne({ franchiseId, code });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Location code ${code} already exists in this franchise`
      });
    }

    const locationId = `LOC-${uuidv4().substring(0, 8).toUpperCase()}`;

    const location = new Location({
      locationId,
      franchiseId,
      name,
      code,
      type: type || 'store',
      address,
      contact,
      operatingHours: operatingHours || getDefaultOperatingHours(),
      capacity,
      amenities: amenities || [],
      settings,
      status: 'active',
      stats: {
        totalOrders: 0,
        totalRevenue: 0,
        averageRating: 0,
        totalReviews: 0
      }
    });

    await location.save();

    res.status(201).json({
      success: true,
      data: location
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/locations
 * List all locations
 */
router.get('/', async (req, res, next) => {
  try {
    const { franchiseId, city, status, type, page = 1, limit = 20 } = req.query;

    const query = {};
    if (franchiseId) query.franchiseId = franchiseId;
    if (city) query['address.city'] = city;
    if (status) query.status = status;
    if (type) query.type = type;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [locations, total] = await Promise.all([
      Location.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Location.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        locations,
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
 * GET /api/locations/:locationId
 * Get location details
 */
router.get('/:locationId', async (req, res, next) => {
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

    // Get franchise info
    const franchise = await Franchise.findOne({ franchiseId: location.franchiseId });

    res.json({
      success: true,
      data: {
        ...location.toObject(),
        franchise: franchise ? { franchiseId: franchise.franchiseId, name: franchise.name } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/locations/:locationId
 * Update location
 */
router.patch('/:locationId', async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const updates = req.body;

    delete updates.locationId;
    delete updates.franchiseId;
    delete updates.createdAt;

    updates.updatedAt = new Date();

    const location = await Location.findOneAndUpdate(
      { locationId },
      updates,
      { new: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Location not found: ${locationId}`
      });
    }

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/locations/:locationId/status
 * Update location status
 */
router.patch('/:locationId/status', async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'temporary_closed', 'renovating'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const location = await Location.findOneAndUpdate(
      { locationId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Location not found: ${locationId}`
      });
    }

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/locations/search/nearby
 * Find nearby locations
 */
router.get('/search/nearby', async (req, res, next) => {
  try {
    const { latitude, longitude, radiusKm = 10, franchiseId } = req.query;

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

    const query = {
      status: 'active',
      'address.coordinates': { $exists: true }
    };

    if (franchiseId) query.franchiseId = franchiseId;

    const locations = await Location.find(query).limit(100);

    // Filter and calculate distances
    const nearbyLocations = locations
      .map(loc => {
        if (!loc.address.coordinates) return null;

        const R = 6371000;
        const dLat = (loc.address.coordinates.latitude - lat) * Math.PI / 180;
        const dLng = (loc.address.coordinates.longitude - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(loc.address.coordinates.latitude * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return {
          ...loc.toObject(),
          distanceKm: (distance / 1000).toFixed(2)
        };
      })
      .filter(l => l && l.distanceKm <= radius)
      .sort((a, b) => parseFloat(a.distanceKm) - parseFloat(b.distanceKm));

    res.json({
      success: true,
      data: {
        locations: nearbyLocations,
        searchParams: { latitude: lat, longitude: lng, radiusKm: radius }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/locations/:locationId/operating-hours
 * Get operating hours for a location
 */
router.get('/:locationId/operating-hours', async (req, res, next) => {
  try {
    const { locationId } = req.params;

    const location = await Location.findOne({ locationId }, { operatingHours: 1, locationId: 1, name: 1 });

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Location not found: ${locationId}`
      });
    }

    // Calculate if currently open
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = dayNames[now.getDay()];
    const currentHours = location.operatingHours[today];

    let isOpen = false;
    if (currentHours && !currentHours.closed) {
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const openTime = parseInt(currentHours.open.replace(':', '')) || 0;
      const closeTime = parseInt(currentHours.close.replace(':', '')) || 0;

      const openMinutes = Math.floor(openTime / 100) * 60 + (openTime % 100);
      const closeMinutes = Math.floor(closeTime / 100) * 60 + (closeTime % 100);

      isOpen = currentTime >= openMinutes && currentTime <= closeMinutes;
    }

    res.json({
      success: true,
      data: {
        locationId: location.locationId,
        name: location.name,
        operatingHours: location.operatingHours,
        currentStatus: isOpen ? 'open' : 'closed'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/locations/:locationId/operating-hours
 * Update operating hours
 */
router.patch('/:locationId/operating-hours', async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { operatingHours } = req.body;

    const location = await Location.findOneAndUpdate(
      { locationId },
      { operatingHours, updatedAt: new Date() },
      { new: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Location not found: ${locationId}`
      });
    }

    res.json({
      success: true,
      data: {
        locationId: location.locationId,
        operatingHours: location.operatingHours
      }
    });
  } catch (error) {
    next(error);
  }
});

function getDefaultOperatingHours() {
  return {
    monday: { open: '09:00', close: '21:00', closed: false },
    tuesday: { open: '09:00', close: '21:00', closed: false },
    wednesday: { open: '09:00', close: '21:00', closed: false },
    thursday: { open: '09:00', close: '21:00', closed: false },
    friday: { open: '09:00', close: '22:00', closed: false },
    saturday: { open: '10:00', close: '22:00', closed: false },
    sunday: { open: '10:00', close: '20:00', closed: false }
  };
}

export default router;

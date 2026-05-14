import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Supplier, Product } from '../index.js';

const router = Router();

/**
 * POST /api/suppliers
 * Register a new supplier
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      businessName, ownerName, email, phone,
      businessType, categories, address, certifications,
      minimumOrder, paymentTerms, deliveryCapabilities
    } = req.body;

    if (!businessName || !ownerName || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'businessName, ownerName, email, and phone are required'
      });
    }

    const supplierId = `SUP-${uuidv4().substring(0, 8).toUpperCase()}`;

    const supplier = new Supplier({
      supplierId,
      businessName,
      ownerName,
      email,
      phone,
      businessType,
      categories,
      address,
      certifications,
      minimumOrder,
      paymentTerms,
      deliveryCapabilities,
      status: 'pending'
    });

    await supplier.save();

    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/suppliers
 * List all suppliers
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      businessType, category, city, status,
      minRating, page = 1, limit = 20
    } = req.query;

    const query = {};
    if (businessType) query.businessType = businessType;
    if (city) query['address.city'] = city;
    if (status) query.status = status;
    else query.status = { $in: ['verified', 'active'] };
    if (category) query.categories = category;
    if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .sort({ 'rating.average': -1, 'stats.totalOrders': -1 })
        .skip(skip)
        .limit(limitNum),
      Supplier.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        suppliers,
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
 * GET /api/suppliers/:supplierId
 * Get supplier details
 */
router.get('/:supplierId', async (req, res, next) => {
  try {
    const { supplierId } = req.params;

    const supplier = await Supplier.findOne({ supplierId });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Supplier not found: ${supplierId}`
      });
    }

    // Get product count
    const productCount = await Product.countDocuments({ supplierId, status: 'active' });

    res.json({
      success: true,
      data: {
        ...supplier.toObject(),
        productCount
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/suppliers/:supplierId
 * Update supplier
 */
router.patch('/:supplierId', async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const updates = req.body;

    delete updates.supplierId;
    delete updates.createdAt;

    updates.updatedAt = new Date();

    const supplier = await Supplier.findOneAndUpdate(
      { supplierId },
      updates,
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Supplier not found: ${supplierId}`
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/suppliers/:supplierId/status
 * Update supplier status (verification)
 */
router.patch('/:supplierId/status', async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'verified', 'active', 'suspended', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const supplier = await Supplier.findOneAndUpdate(
      { supplierId },
      {
        status,
        verifiedAt: status === 'verified' || status === 'active' ? new Date() : supplier?.verifiedAt,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Supplier not found: ${supplierId}`
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/suppliers/search
 * Search suppliers
 */
router.get('/search/query', async (req, res, next) => {
  try {
    const { q, category, businessType, city, minRating, page = 1, limit = 20 } = req.query;

    const query = { status: { $in: ['verified', 'active'] } };

    if (q) {
      query.$text = { $search: q };
    }
    if (category) query.categories = category;
    if (businessType) query.businessType = businessType;
    if (city) query['address.city'] = city;
    if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let queryBuilder = Supplier.find(query);

    if (q) {
      queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      queryBuilder = queryBuilder.sort({ 'rating.average': -1 });
    }

    const [suppliers, total] = await Promise.all([
      queryBuilder.skip(skip).limit(limitNum),
      Supplier.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        suppliers,
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
 * GET /api/suppliers/:supplierId/products
 * Get supplier's products
 */
router.get('/:supplierId/products', async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { status, category, page = 1, limit = 20 } = req.query;

    const supplier = await Supplier.findOne({ supplierId });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Supplier not found: ${supplierId}`
      });
    }

    const query = { supplierId };
    if (status) query.status = status;
    else query.status = 'active';
    if (category) query.category = category;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        supplier: {
          supplierId: supplier.supplierId,
          businessName: supplier.businessName
        },
        products,
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
 * GET /api/suppliers/:supplierId/stats
 * Get supplier statistics
 */
router.get('/:supplierId/stats', async (req, res, next) => {
  try {
    const { supplierId } = req.params;

    const supplier = await Supplier.findOne({ supplierId });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Supplier not found: ${supplierId}`
      });
    }

    const productCount = await Product.countDocuments({ supplierId, status: 'active' });

    res.json({
      success: true,
      data: {
        supplierId,
        stats: supplier.stats,
        productCount,
        rating: supplier.rating
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

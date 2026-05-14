import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Product, Supplier } from '../index.js';

const router = Router();

/**
 * POST /api/products
 * Create a new product
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      supplierId, name, description, category, subcategory,
      sku, unit, moq, price, specifications, images,
      availability, tags
    } = req.body;

    if (!supplierId || !name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'supplierId, name, and category are required'
      });
    }

    // Verify supplier exists and is active
    const supplier = await Supplier.findOne({ supplierId });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Supplier not found: ${supplierId}`
      });
    }

    if (!['active', 'verified'].includes(supplier.status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Supplier must be active or verified to list products'
      });
    }

    const productId = `PRD-${uuidv4().substring(0, 8).toUpperCase()}`;

    const product = new Product({
      productId,
      supplierId,
      name,
      description,
      category,
      subcategory,
      sku,
      unit,
      moq,
      price,
      specifications,
      images,
      availability,
      tags,
      status: 'draft'
    });

    await product.save();

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products
 * List all products
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      supplierId, category, subcategory, minPrice, maxPrice,
      inStock, status, tags, page = 1, limit = 20
    } = req.query;

    const query = {};

    if (supplierId) query.supplierId = supplierId;
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (tags) query.tags = { $in: tags.split(',') };

    if (minPrice || maxPrice) {
      query['price.minPrice'] = {};
      if (minPrice) query['price.minPrice'].$gte = parseFloat(minPrice);
      if (maxPrice) query['price.minPrice'].$lte = parseFloat(maxPrice);
    }

    if (inStock === 'true') {
      query['availability.inStock'] = true;
      query['availability.stockQuantity'] = { $gt: 0 };
    }

    if (status) query.status = status;
    else query.status = 'active';

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
 * GET /api/products/:productId
 * Get product details
 */
router.get('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({ productId });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Product not found: ${productId}`
      });
    }

    // Get supplier info
    const supplier = await Supplier.findOne({ supplierId: product.supplierId });

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        supplier: supplier ? {
          supplierId: supplier.supplierId,
          businessName: supplier.businessName,
          rating: supplier.rating
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/products/:productId
 * Update product
 */
router.patch('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const updates = req.body;

    delete updates.productId;
    delete updates.supplierId;
    delete updates.createdAt;

    updates.updatedAt = new Date();

    const product = await Product.findOneAndUpdate(
      { productId },
      updates,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Product not found: ${productId}`
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/products/:productId/status
 * Update product status
 */
router.patch('/:productId/status', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'active', 'out_of_stock', 'discontinued'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const product = await Product.findOneAndUpdate(
      { productId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Product not found: ${productId}`
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/search
 * Search products
 */
router.get('/search/query', async (req, res, next) => {
  try {
    const { q, category, minPrice, maxPrice, minRating, page = 1, limit = 20 } = req.query;

    const query = { status: 'active', 'availability.inStock': true };

    if (q) {
      query.$text = { $search: q };
    }
    if (category) query.category = category;
    if (minPrice) query['price.minPrice'] = { $gte: parseFloat(minPrice) };
    if (maxPrice) query['price.minPrice'] = { ...query['price.minPrice'], $lte: parseFloat(maxPrice) };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let queryBuilder = Product.find(query);

    if (q) {
      queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      queryBuilder = queryBuilder.sort({ 'rating.average': -1, createdAt: -1 });
    }

    const [products, total] = await Promise.all([
      queryBuilder.skip(skip).limit(limitNum),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
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
 * GET /api/products/categories
 * Get all categories
 */
router.get('/meta/categories', async (req, res, next) => {
  try {
    const categories = await Product.distinct('category', { status: 'active' });

    const categoryStats = await Product.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        categories,
        stats: categoryStats
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/products/:productId
 * Delete/discontinue product
 */
router.delete('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOneAndUpdate(
      { productId },
      { status: 'discontinued', updatedAt: new Date() },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Product not found: ${productId}`
      });
    }

    res.json({
      success: true,
      data: { productId, status: 'discontinued' }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

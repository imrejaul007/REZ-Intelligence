import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Order, Product, Supplier } from '../index.js';

const router = Router();

/**
 * POST /api/orders
 * Create a new order
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      buyerId, supplierId, products, deliveryAddress, notes, expectedDelivery
    } = req.body;

    if (!buyerId || !supplierId || !products || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'buyerId, supplierId, and products are required'
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
        message: 'Supplier is not active'
      });
    }

    // Validate and enrich products
    let subtotal = 0;
    const enrichedProducts = [];

    for (const item of products) {
      const product = await Product.findOne({ productId: item.productId, status: 'active' });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Product not found: ${item.productId}`
        });
      }

      if (item.quantity < product.moq) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Minimum order quantity for ${product.name} is ${product.moq}`
        });
      }

      const unitPrice = item.unitPrice || product.price.minPrice;
      const totalPrice = unitPrice * item.quantity;

      enrichedProducts.push({
        productId: product.productId,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice
      });

      subtotal += totalPrice;
    }

    // Check minimum order value
    if (subtotal < supplier.minimumOrder) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Minimum order value is ${supplier.minimumOrder}`
      });
    }

    const tax = subtotal * 0.18; // 18% GST
    const deliveryFee = supplier.deliveryCapabilities.localDelivery ? 50 : 100;
    const totalAmount = subtotal + tax + deliveryFee;

    const orderId = `ORD-${uuidv4().substring(0, 8).toUpperCase()}`;

    const order = new Order({
      orderId,
      buyerId,
      supplierId,
      products: enrichedProducts,
      subtotal,
      tax,
      deliveryFee,
      totalAmount,
      deliveryAddress,
      expectedDelivery,
      notes,
      status: 'pending',
      paymentStatus: 'pending',
      timeline: [{
        status: 'pending',
        timestamp: new Date(),
        notes: 'Order created'
      }]
    });

    await order.save();

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders
 * List orders
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      buyerId, supplierId, status, paymentStatus,
      startDate, endDate, page = 1, limit = 20
    } = req.query;

    const query = {};
    if (buyerId) query.buyerId = buyerId;
    if (supplierId) query.supplierId = supplierId;
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        orders,
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
 * GET /api/orders/:orderId
 * Get order details
 */
router.get('/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Order not found: ${orderId}`
      });
    }

    // Get supplier info
    const supplier = await Supplier.findOne({ supplierId: order.supplierId });

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        supplier: supplier ? {
          supplierId: supplier.supplierId,
          businessName: supplier.businessName
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/orders/:orderId/status
 * Update order status
 */
router.patch('/:orderId/status', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Order not found: ${orderId}`
      });
    }

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'disputed'],
      delivered: ['disputed'],
      cancelled: [],
      disputed: ['delivered', 'cancelled']
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Cannot transition from ${order.status} to ${status}`
      });
    }

    order.status = status;
    order.timeline.push({
      status,
      timestamp: new Date(),
      notes: notes || `Status changed to ${status}`
    });

    if (status === 'delivered') {
      order.actualDelivery = new Date();
      order.paymentStatus = 'paid';

      // Update supplier stats
      await Supplier.updateOne(
        { supplierId: order.supplierId },
        {
          $inc: {
            'stats.totalOrders': 1,
            'stats.completedOrders': 1,
            'stats.totalRevenue': order.totalAmount
          }
        }
      );
    }

    if (status === 'cancelled') {
      // Update supplier stats
      await Supplier.updateOne(
        { supplierId: order.supplierId },
        { $inc: { 'stats.totalOrders': 1 } }
      );
    }

    order.updatedAt = new Date();
    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/orders/:orderId/payment
 * Update payment status
 */
router.patch('/:orderId/payment', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus } = req.body;

    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];

    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await Order.findOneAndUpdate(
      { orderId },
      {
        paymentStatus,
        $push: {
          timeline: {
            status: `payment_${paymentStatus}`,
            timestamp: new Date(),
            notes: `Payment status changed to ${paymentStatus}`
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Order not found: ${orderId}`
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/buyer/:buyerId
 * Get orders for a buyer
 */
router.get('/buyer/:buyerId', async (req, res, next) => {
  try {
    const { buyerId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { buyerId };
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        orders,
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
 * GET /api/orders/supplier/:supplierId
 * Get orders for a supplier
 */
router.get('/supplier/:supplierId', async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { supplierId };
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        orders,
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

export default router;

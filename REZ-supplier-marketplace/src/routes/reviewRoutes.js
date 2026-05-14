import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Review, Order, Supplier, Product } from '../index.js';

const router = Router();

/**
 * POST /api/reviews
 * Create a review
 */
router.post('/', async (req, res, next) => {
  try {
    const { orderId, supplierId, productId, buyerId, rating, title, comment, pros, cons } = req.body;

    if (!orderId || !supplierId || !buyerId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'orderId, supplierId, buyerId, and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Rating must be between 1 and 5'
      });
    }

    // Verify order exists and is delivered
    const order = await Order.findOne({ orderId, buyerId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Order not found'
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Can only review delivered orders'
      });
    }

    // Check for existing review
    const existingReview = await Review.findOne({ orderId, supplierId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Review already exists for this order'
      });
    }

    const reviewId = `REV-${uuidv4().substring(0, 8).toUpperCase()}`;

    const review = new Review({
      reviewId,
      orderId,
      supplierId,
      productId,
      buyerId,
      rating,
      title,
      comment,
      pros,
      cons,
      isVerifiedPurchase: true,
      status: 'pending'
    });

    await review.save();

    // Update supplier rating
    await updateSupplierRating(supplierId);

    // Update product rating if applicable
    if (productId) {
      await updateProductRating(productId);
    }

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reviews
 * List reviews
 */
router.get('/', async (req, res, next) => {
  try {
    const { supplierId, productId, buyerId, minRating, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (supplierId) query.supplierId = supplierId;
    if (productId) query.productId = productId;
    if (buyerId) query.buyerId = buyerId;
    if (status) query.status = status;
    else query.status = 'approved';
    if (minRating) query.rating = { $gte: parseInt(minRating) };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Review.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        reviews,
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
 * GET /api/reviews/:reviewId
 * Get review details
 */
router.get('/:reviewId', async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findOne({ reviewId });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Review not found: ${reviewId}`
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/reviews/:reviewId/status
 * Update review status (approve/reject)
 */
router.patch('/:reviewId/status', async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected', 'flagged'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const review = await Review.findOneAndUpdate(
      { reviewId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Review not found: ${reviewId}`
      });
    }

    // Update ratings if approved
    if (status === 'approved') {
      await updateSupplierRating(review.supplierId);
      if (review.productId) {
        await updateProductRating(review.productId);
      }
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/:reviewId/respond
 * Supplier responds to review
 */
router.post('/:reviewId/respond', async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Response text is required'
      });
    }

    const review = await Review.findOneAndUpdate(
      { reviewId },
      {
        response: {
          text,
          respondedAt: new Date()
        },
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Review not found: ${reviewId}`
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reviews/supplier/:supplierId/summary
 * Get review summary for supplier
 */
router.get('/supplier/:supplierId/summary', async (req, res, next) => {
  try {
    const { supplierId } = req.params;

    const summary = await Review.aggregate([
      { $match: { supplierId, status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
        }
      }
    ]);

    const recentReviews = await Review.find({ supplierId, status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        supplierId,
        summary: summary[0] || {
          averageRating: 0,
          totalReviews: 0,
          fiveStar: 0,
          fourStar: 0,
          threeStar: 0,
          twoStar: 0,
          oneStar: 0
        },
        recentReviews
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/:reviewId/helpful
 * Mark review as helpful
 */
router.post('/:reviewId/helpful', async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findOneAndUpdate(
      { reviewId },
      { $inc: { helpful: 1 } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Review not found: ${reviewId}`
      });
    }

    res.json({
      success: true,
      data: { reviewId, helpful: review.helpful }
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function updateSupplierRating(supplierId) {
  const result = await Review.aggregate([
    { $match: { supplierId, status: 'approved' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (result.length > 0) {
    await Supplier.updateOne(
      { supplierId },
      {
        'rating.average': Math.round(result[0].average * 10) / 10,
        'rating.totalReviews': result[0].count
      }
    );
  }
}

async function updateProductRating(productId) {
  const result = await Review.aggregate([
    { $match: { productId, status: 'approved' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (result.length > 0) {
    await Product.updateOne(
      { productId },
      {
        'rating.average': Math.round(result[0].average * 10) / 10,
        'rating.totalReviews': result[0].count
      }
    );
  }
}

export default router;

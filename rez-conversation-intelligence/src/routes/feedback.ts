import { Router, Request, Response, NextFunction } from 'express';
import { feedbackLoop } from '../services/feedbackLoop.js';
import { FeedbackCreateSchema } from '../utils/validators.js';
import { ValidationError } from '../utils/errors.js';
import { z } from 'zod';

const router = Router();

// Validation middleware
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError('Invalid request body', {
          errors: result.error.issues,
        });
      }
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Submit feedback
router.post(
  '/',
  validateBody(FeedbackCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const feedback = await feedbackLoop.submitFeedback(req.body);

      res.status(201).json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get feedback by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feedback = await feedbackLoop.getFeedback(req.params.id);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
});

// Get feedback by conversation
router.get('/conversation/:conversationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feedback = await feedbackLoop.getFeedbackByConversation(req.params.conversationId);

    res.json({
      success: true,
      data: feedback,
      count: feedback.length,
    });
  } catch (error) {
    next(error);
  }
});

// List feedback with filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const result = await feedbackLoop.listFeedback(filters);

    res.json({
      success: true,
      data: result.feedback,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Mark feedback as reviewed
router.post(
  '/:id/review',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reviewerId, notes } = req.body;

      if (!reviewerId) {
        throw new ValidationError('Reviewer ID is required');
      }

      const feedback = await feedbackLoop.markAsReviewed(req.params.id, reviewerId, notes);

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Mark feedback as applied
router.post('/:id/apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feedback = await feedbackLoop.markAsApplied(req.params.id);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
});

// Get pending reviews
router.get('/reviews/pending', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await feedbackLoop.getPendingReviews();

    res.json({
      success: true,
      data: pending,
      count: pending.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

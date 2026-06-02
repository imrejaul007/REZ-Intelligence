import { Router, Request, Response } from 'express';
import { CustomerContextSchema, CustomerContext } from '../types';
import { nextBestActionService } from '../services/actionService';
import logger from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/recommend', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CustomerContextSchema.parse(req.body);
    const context = validatedData as CustomerContext;
    const recommendations = nextBestActionService.generateRecommendations(context);

    logger.info(`Recommendations generated for customer: ${context.customerId}`, {
      customerId: context.customerId,
      recommendationCount: recommendations.recommendations.length,
      topAction: recommendations.recommendations[0]?.action,
    });

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    logger.error('Error generating recommendations', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/recommend/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customers } = req.body;

    if (!Array.isArray(customers)) {
      res.status(400).json({
        success: false,
        error: 'customers must be an array',
      });
      return;
    }

    const results = customers.map((customer) => {
      try {
        const validatedData = CustomerContextSchema.parse(customer);
        return nextBestActionService.generateRecommendations(validatedData as CustomerContext);
      } catch (error) {
        return {
          customerId: customer.customerId || 'unknown',
          error: 'Validation failed',
        };
      }
    });

    logger.info(`Batch recommendations generated for ${customers.length} customers`);

    res.json({
      success: true,
      data: results,
      total: customers.length,
    });
  } catch (error) {
    logger.error('Error generating batch recommendations', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/channels/optimize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customers } = req.body;

    if (!Array.isArray(customers)) {
      res.status(400).json({
        success: false,
        error: 'customers must be an array',
      });
      return;
    }

    const channelOptimization = nextBestActionService.optimizeChannels(customers);

    logger.info('Channel optimization completed', {
      recommendedChannels: channelOptimization.filter(c => c.recommended).map(c => c.channel),
    });

    res.json({
      success: true,
      data: channelOptimization,
    });
  } catch (error) {
    logger.error('Error optimizing channels', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/timing/optimize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customers } = req.body;

    if (!Array.isArray(customers)) {
      res.status(400).json({
        success: false,
        error: 'customers must be an array',
      });
      return;
    }

    const timingOptimization = nextBestActionService.optimizeTiming(customers);

    logger.info('Timing optimization completed', {
      topSlots: timingOptimization.slice(0, 3).map(t => `${t.dayOfWeek}d ${t.hourOfDay}h`),
    });

    res.json({
      success: true,
      data: timingOptimization,
    });
  } catch (error) {
    logger.error('Error optimizing timing', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    modelLoaded: true,
    uptime: process.uptime(),
    version: nextBestActionService.getModelVersion(),
  });
});

export default router;

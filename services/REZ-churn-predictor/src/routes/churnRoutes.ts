import { Router, Request, Response } from 'express';
import { CustomerFeaturesSchema, CustomerFeatures } from '../types';
import { churnPredictionService } from '../services/churnService';
import logger from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/predict', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CustomerFeaturesSchema.parse(req.body);
    const features = validatedData as CustomerFeatures;
    const prediction = churnPredictionService.calculateChurnProbability(features);

    logger.info(`Churn prediction completed for customer: ${features.customerId}`, {
      customerId: features.customerId,
      churnProbability: prediction.churnProbability,
      riskLevel: prediction.riskLevel,
    });

    res.json({
      success: true,
      data: prediction,
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

    logger.error('Error calculating churn prediction', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/predict/batch', async (req: Request, res: Response): Promise<void> => {
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
        const validatedData = CustomerFeaturesSchema.parse(customer);
        const features = validatedData as CustomerFeatures;
        const prediction = churnPredictionService.calculateChurnProbability(features);
        return {
          customerId: features.customerId,
          churnProbability: prediction.churnProbability,
          riskLevel: prediction.riskLevel,
        };
      } catch (error) {
        return {
          customerId: customer.customerId || 'unknown',
          error: 'Validation failed',
        };
      }
    });

    logger.info(`Batch churn prediction completed for ${customers.length} customers`);

    res.json({
      success: true,
      data: results,
      total: customers.length,
    });
  } catch (error) {
    logger.error('Error calculating batch churn predictions', { error });
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
    version: churnPredictionService.getModelVersion(),
  });
});

export default router;

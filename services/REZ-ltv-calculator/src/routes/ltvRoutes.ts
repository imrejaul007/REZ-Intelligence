import { Router, Request, Response } from 'express';
import { CustomerLTVSchema, CustomerLTV } from '../types';
import { ltvService } from '../services/ltvService';
import logger from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/calculate', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CustomerLTVSchema.parse(req.body);
    const customer = validatedData as CustomerLTV;
    const ltvScore = ltvService.calculateLTV(customer);

    logger.info(`LTV calculated for customer: ${customer.customerId}`, {
      customerId: customer.customerId,
      predictedLTV: ltvScore.predictedLTV,
      segment: ltvScore.segmentScore,
    });

    res.json({
      success: true,
      data: ltvScore,
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

    logger.error('Error calculating LTV', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/calculate/batch', async (req: Request, res: Response): Promise<void> => {
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
        const validatedData = CustomerLTVSchema.parse(customer);
        return ltvService.calculateLTV(validatedData as CustomerLTV);
      } catch (error) {
        return {
          customerId: customer.customerId || 'unknown',
          error: 'Validation failed',
        };
      }
    });

    logger.info(`Batch LTV calculation completed for ${customers.length} customers`);

    res.json({
      success: true,
      data: results,
      total: customers.length,
    });
  } catch (error) {
    logger.error('Error calculating batch LTV', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/segments/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customers } = req.body;

    if (!Array.isArray(customers)) {
      res.status(400).json({
        success: false,
        error: 'customers must be an array',
      });
      return;
    }

    const segmentAnalysis = ltvService.calculateSegmentAnalysis(customers);

    logger.info('Segment analysis completed', {
      segments: segmentAnalysis.map(s => ({ segment: s.segment, count: s.customerCount })),
    });

    res.json({
      success: true,
      data: segmentAnalysis,
    });
  } catch (error) {
    logger.error('Error analyzing segments', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/forecast', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customers, months = 12 } = req.body;

    if (!Array.isArray(customers)) {
      res.status(400).json({
        success: false,
        error: 'customers must be an array',
      });
      return;
    }

    const forecast = ltvService.forecastRevenue(customers, months);

    logger.info('Revenue forecast generated', {
      period: forecast.period,
      projectedRevenue: forecast.projectedRevenue,
    });

    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    logger.error('Error generating forecast', { error });
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
    version: ltvService.getModelVersion(),
  });
});

export default router;

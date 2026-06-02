import { Router, Request, Response } from 'express';
import {
  CompetitorSchema,
  PriceDataSchema,
  FeatureDataSchema,
  ReviewDataSchema,
  Competitor,
  PriceData,
  FeatureData,
  ReviewData,
} from '../types';
import { competitorMonitorService } from '../services/competitorService';
import logger from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/competitors', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CompetitorSchema.parse(req.body);
    const competitor = validatedData as Competitor;
    competitorMonitorService.addCompetitor(competitor);

    logger.info(`Competitor added: ${competitor.name}`);

    res.json({
      success: true,
      data: competitor,
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

    logger.error('Error adding competitor', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/competitors', (_req: Request, res: Response): void => {
  const competitors = competitorMonitorService.getAllCompetitors();
  res.json({
    success: true,
    data: competitors,
    count: competitors.length,
  });
});

router.delete('/competitors/:competitorId', (req: Request, res: Response): void => {
  const { competitorId } = req.params;
  const removed = competitorMonitorService.removeCompetitor(competitorId);

  if (removed) {
    res.json({
      success: true,
      message: 'Competitor removed',
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Competitor not found',
    });
  }
});

router.post('/prices', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prices } = req.body;

    if (Array.isArray(prices)) {
      const validatedPrices = prices.map(p => PriceDataSchema.parse(p)) as PriceData[];
      competitorMonitorService.recordBatchPriceData(validatedPrices);
      logger.info(`Batch price data recorded: ${prices.length} records`);
    } else {
      const validatedData = PriceDataSchema.parse(req.body);
      competitorMonitorService.recordPriceData(validatedData as PriceData);
      logger.info(`Price data recorded for competitor: ${validatedData.competitorId}`);
    }

    res.json({
      success: true,
      message: 'Price data recorded',
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

    logger.error('Error recording price data', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/prices/:competitorId', (req: Request, res: Response): void => {
  const { competitorId } = req.params;
  const monitoring = competitorMonitorService.monitorPrices(competitorId);

  if (monitoring) {
    res.json({
      success: true,
      data: monitoring,
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Competitor not found or no price data available',
    });
  }
});

router.post('/features', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = FeatureDataSchema.parse(req.body);
    competitorMonitorService.recordFeatureData(validatedData as FeatureData);

    logger.info(`Feature data recorded for competitor: ${validatedData.competitorId}`);

    res.json({
      success: true,
      message: 'Feature data recorded',
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

    logger.error('Error recording feature data', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/features/:competitorId', (req: Request, res: Response): void => {
  const { competitorId } = req.params;
  const tracking = competitorMonitorService.trackFeatures(competitorId);

  if (tracking) {
    res.json({
      success: true,
      data: tracking,
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Competitor not found',
    });
  }
});

router.post('/reviews', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reviews } = req.body;

    if (Array.isArray(reviews)) {
      const validatedReviews = reviews.map(r => ReviewDataSchema.parse(r)) as ReviewData[];
      competitorMonitorService.recordBatchReviews(validatedReviews);
      logger.info(`Batch review data recorded: ${reviews.length} reviews`);
    } else {
      const validatedData = ReviewDataSchema.parse(req.body);
      competitorMonitorService.recordReviewData(validatedData as ReviewData);
      logger.info(`Review data recorded for competitor: ${validatedData.competitorId}`);
    }

    res.json({
      success: true,
      message: 'Review data recorded',
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

    logger.error('Error recording review data', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/reviews/:competitorId', (req: Request, res: Response): void => {
  const { competitorId } = req.params;
  const analysis = competitorMonitorService.analyzeReviews(competitorId);

  if (analysis) {
    res.json({
      success: true,
      data: analysis,
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Competitor not found',
    });
  }
});

router.get('/share-of-voice', (req: Request, res: Response): void => {
  const competitors = competitorMonitorService.getAllCompetitors();
  const competitorIds = competitors.map(c => c.competitorId);
  const sov = competitorMonitorService.calculateShareOfVoice(competitorIds);

  res.json({
    success: true,
    data: sov,
  });
});

router.get('/overview', (_req: Request, res: Response): void => {
  const overview = competitorMonitorService.getCompetitorOverview();

  logger.info('Competitor overview generated');

  res.json({
    success: true,
    data: overview,
  });
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    monitorActive: true,
    uptime: process.uptime(),
    version: competitorMonitorService.getModelVersion(),
  });
});

export default router;

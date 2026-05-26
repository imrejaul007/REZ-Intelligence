import { Router, Request, Response, NextFunction } from 'express';
import { dailyExportScheduler, modelUpdateScheduler } from '../schedulers/index.js';
import { extractionPipeline, labelingPipeline } from '../pipelines/index.js';
import logger from './utils/logger';

const router = Router();

// Get scheduler status
router.get('/status', (_req: Request, res: Response) => {
  const dailyExportStatus = {
    isRunning: dailyExportScheduler.isSchedulerRunning(),
    lastRun: dailyExportScheduler.getLastRunResult(),
    schedule: dailyExportScheduler.getScheduleInfo(),
  };

  const modelUpdateStatus = {
    isRunning: modelUpdateScheduler.isSchedulerRunning(),
    lastRun: modelUpdateScheduler.getLastRunResult(),
    schedule: modelUpdateScheduler.getScheduleInfo(),
  };

  res.json({
    success: true,
    data: {
      dailyExport: dailyExportStatus,
      modelUpdate: modelUpdateStatus,
    },
  });
});

// Trigger daily export pipeline manually
router.post('/trigger/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual export trigger requested');

    const result = await dailyExportScheduler.runFullPipeline();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Trigger extraction pipeline manually
router.post('/trigger/extraction', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual extraction trigger requested');

    const result = await extractionPipeline.run();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Trigger labeling pipeline manually
router.post('/trigger/labeling', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual labeling trigger requested');

    const result = await labelingPipeline.run();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Trigger model update manually
router.post('/trigger/model-update', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual model update trigger requested');

    const result = await modelUpdateScheduler.runModelUpdate();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Rollback to a specific model version
router.post('/rollback/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Model rollback requested', { versionId: req.params.versionId });

    const success = await modelUpdateScheduler.rollbackToVersion(req.params.versionId);

    if (success) {
      res.json({
        success: true,
        message: `Successfully rolled back to version ${req.params.versionId}`,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Rollback failed',
      });
    }
  } catch (error) {
    next(error);
  }
});

// Start all schedulers
router.post('/start', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await Promise.all([
      dailyExportScheduler.start(),
      modelUpdateScheduler.start(),
    ]);

    res.json({
      success: true,
      message: 'All schedulers started',
    });
  } catch (error) {
    next(error);
  }
});

// Stop all schedulers
router.post('/stop', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await Promise.all([
      dailyExportScheduler.stop(),
      modelUpdateScheduler.stop(),
    ]);

    res.json({
      success: true,
      message: 'All schedulers stopped',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

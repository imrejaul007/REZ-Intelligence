import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { federatedMLService } from '../services/federatedService.js';
import { logger } from './utils/logger.js';

const router = Router();

router.post('/clients', async (req: Request, res: Response) => {
  try {
    const client = await federatedMLService.registerClient(req.body);
    res.status(201).json({ success: true, data: client });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Register client error:', error);
      res.status(500).json({ success: false, error: 'Registration failed' });
    }
  }
});

router.get('/clients', async (req: Request, res: Response) => {
  try {
    const nodeType = req.query.nodeType as string | undefined;
    const clients = await federatedMLService.listClients(nodeType);
    res.json({ success: true, data: clients, count: clients.length });
  } catch (error) {
    logger.error('List clients error:', error);
    res.status(500).json({ success: false, error: 'Failed to list clients' });
  }
});

router.get('/clients/:clientId', async (req: Request, res: Response) => {
  try {
    const client = await federatedMLService.getClient(req.params.clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    res.json({ success: true, data: client });
  } catch (error) {
    logger.error('Get client error:', error);
    res.status(500).json({ success: false, error: 'Failed to get client' });
  }
});

router.patch('/clients/:clientId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const client = await federatedMLService.updateClientStatus(req.params.clientId, status);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    res.json({ success: true, data: client });
  } catch (error) {
    logger.error('Update client status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

router.post('/training/start', async (req: Request, res: Response) => {
  try {
    const status = await federatedMLService.startTraining(req.body);
    res.status(201).json({ success: true, data: status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Start training error:', error);
      res.status(500).json({ success: false, error: 'Failed to start training' });
    }
  }
});

router.get('/training/:trainingId', async (req: Request, res: Response) => {
  try {
    const status = await federatedMLService.getTrainingStatus(req.params.trainingId);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Training session not found' });
    }
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Get training status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get training status' });
  }
});

router.get('/training', async (req: Request, res: Response) => {
  try {
    const sessions = await federatedMLService.listTrainingSessions();
    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (error) {
    logger.error('List training sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to list training sessions' });
  }
});

router.post('/model/update', async (req: Request, res: Response) => {
  try {
    const update = await federatedMLService.submitModelUpdate(req.body);
    res.json({ success: true, data: update });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Submit model update error:', error);
      res.status(500).json({ success: false, error: 'Failed to submit update' });
    }
  }
});

router.get('/model/:modelId', async (req: Request, res: Response) => {
  try {
    const model = await federatedMLService.getModel(req.params.modelId);
    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    res.json({ success: true, data: model });
  } catch (error) {
    logger.error('Get model error:', error);
    res.status(500).json({ success: false, error: 'Failed to get model' });
  }
});

router.get('/model/latest/current', async (req: Request, res: Response) => {
  try {
    const model = await federatedMLService.getLatestModel();
    if (!model) {
      return res.status(404).json({ success: false, error: 'No models available' });
    }
    res.json({ success: true, data: model });
  } catch (error) {
    logger.error('Get latest model error:', error);
    res.status(500).json({ success: false, error: 'Failed to get latest model' });
  }
});

router.get('/metrics/:trainingId', async (req: Request, res: Response) => {
  try {
    const metrics = await federatedMLService.getMetrics(req.params.trainingId);
    if (!metrics) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Get metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get metrics' });
  }
});

router.get('/client-metrics/:clientId', async (req: Request, res: Response) => {
  try {
    const metrics = await federatedMLService.getClientMetrics(req.params.clientId);
    if (!metrics) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Get client metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get client metrics' });
  }
});

router.post('/training/:trainingId/pause', async (req: Request, res: Response) => {
  try {
    const status = await federatedMLService.pauseTraining(req.params.trainingId);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Training not found or not running' });
    }
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Pause training error:', error);
    res.status(500).json({ success: false, error: 'Failed to pause training' });
  }
});

router.post('/training/:trainingId/resume', async (req: Request, res: Response) => {
  try {
    const status = await federatedMLService.resumeTraining(req.params.trainingId);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Training not found or not paused' });
    }
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Resume training error:', error);
    res.status(500).json({ success: false, error: 'Failed to resume training' });
  }
});

export default router;

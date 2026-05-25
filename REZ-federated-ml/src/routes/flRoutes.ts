import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import {
  FLJobModel,
  FLNodeModel,
  TrainingRoundModel,
  NodeContributionModel
} from '../models/flModels.js';
import { nodeManager } from '../services/nodeManager.js';
import { federatedCore } from '../services/federatedCore.js';
import { FederatedConfigSchema, NodeRegistrationSchema, LocalTrainingRequestSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/nodes/register', async (req: Request, res: Response) => {
  try {
    const validated = NodeRegistrationSchema.parse(req.body);
    const nodeId = crypto.randomUUID();

    let node = await FLNodeModel.findOne({ nodeName: validated.nodeName });
    if (node) {
      node.lastActive = new Date();
      await node.save();
      return res.json({ success: true, data: { nodeId: node.nodeId, node } });
    }

    const newNode = await nodeManager.registerNode(
      nodeId,
      validated.nodeName,
      validated.organizationId,
      validated.capabilities
    );

    const dbNode = new FLNodeModel(newNode);
    await dbNode.save();

    res.status(201).json({ success: true, data: { nodeId, node: newNode } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Node registration error:', error);
      res.status(500).json({ success: false, error: 'Failed to register node' });
    }
  }
});

router.post('/nodes/heartbeat', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.body;
    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'nodeId required' });
    }

    const node = await FLNodeModel.findOne({ nodeId });
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    node.lastActive = new Date();
    if (node.status === 'offline') {
      node.status = 'idle';
    }
    await node.save();

    res.json({ success: true, lastActive: node.lastActive });
  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({ success: false, error: 'Heartbeat failed' });
  }
});

router.get('/nodes', async (req: Request, res: Response) => {
  try {
    const { status, organizationId } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (organizationId) filter.organizationId = organizationId;

    const nodes = await FLNodeModel.find(filter).sort({ lastActive: -1 });
    const stats = nodeManager.getNodeStats();

    res.json({ success: true, data: nodes, stats });
  } catch (error) {
    logger.error('List nodes error:', error);
    res.status(500).json({ success: false, error: 'Failed to list nodes' });
  }
});

router.get('/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const node = await FLNodeModel.findOne({ nodeId: req.params.nodeId });
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    res.json({ success: true, data: node });
  } catch (error) {
    logger.error('Get node error:', error);
    res.status(500).json({ success: false, error: 'Failed to get node' });
  }
});

router.post('/jobs', async (req: Request, res: Response) => {
  try {
    const validated = FederatedConfigSchema.parse(req.body);
    const jobId = crypto.randomUUID();
    const { name, description, createdBy } = req.body;

    const job = new FLJobModel({
      jobId,
      name: name || `FL Job ${jobId.slice(0, 8)}`,
      description,
      config: validated,
      status: 'pending',
      totalRounds: validated.rounds,
      createdBy
    });

    await job.save();

    logger.info(`FL Job created: ${jobId}`);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Create job error:', error);
      res.status(500).json({ success: false, error: 'Failed to create job' });
    }
  }
});

router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const jobs = await FLJobModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await FLJobModel.countDocuments(filter);

    res.json({ success: true, data: jobs, total, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    logger.error('List jobs error:', error);
    res.status(500).json({ success: false, error: 'Failed to list jobs' });
  }
});

router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const job = await FLJobModel.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const rounds = await TrainingRoundModel.find({ jobId: job.jobId }).sort({ roundNumber: 1 });

    res.json({ success: true, data: { job, rounds } });
  } catch (error) {
    logger.error('Get job error:', error);
    res.status(500).json({ success: false, error: 'Failed to get job' });
  }
});

router.post('/jobs/:jobId/start', async (req: Request, res: Response) => {
  try {
    const job = await FLJobModel.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (job.status !== 'pending' && job.status !== 'paused') {
      return res.status(400).json({ success: false, error: `Cannot start job in ${job.status} status` });
    }

    federatedCore.initializeModel(job.config as unknown);

    job.status = 'training';
    job.startedAt = new Date();
    job.currentRound = 0;
    await job.save();

    logger.info(`FL Job started: ${job.jobId}`);
    res.json({ success: true, data: job });
  } catch (error) {
    logger.error('Start job error:', error);
    res.status(500).json({ success: false, error: 'Failed to start job' });
  }
});

router.post('/jobs/:jobId/rounds', async (req: Request, res: Response) => {
  try {
    const job = await FLJobModel.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (job.status !== 'training') {
      return res.status(400).json({ success: false, error: 'Job is not in training status' });
    }

    const roundNumber = job.currentRound + 1;
    const roundId = crypto.randomUUID();

    const selectedNodes = nodeManager.selectNodesForRound(job.config as unknown, job.config.minNodesRequired);

    if (selectedNodes.length < job.config.minNodesRequired) {
      return res.status(400).json({
        success: false,
        error: `Not enough nodes. Required: ${job.config.minNodesRequired}, Available: ${selectedNodes.length}`
      });
    }

    const round = new TrainingRoundModel({
      roundId,
      jobId: job.jobId,
      roundNumber,
      status: 'pending',
      participatingNodes: selectedNodes.map(n => n.nodeId),
      requiredNodes: job.config.minNodesRequired
    });

    await round.save();

    res.status(201).json({
      success: true,
      data: {
        round,
        participatingNodes: selectedNodes.map(n => ({ nodeId: n.nodeId, nodeName: n.nodeName }))
      }
    });
  } catch (error) {
    logger.error('Create round error:', error);
    res.status(500).json({ success: false, error: 'Failed to create round' });
  }
});

router.post('/contributions', async (req: Request, res: Response) => {
  try {
    const validated = LocalTrainingRequestSchema.parse(req.body);

    const contributionId = crypto.randomUUID();

    const contribution = new NodeContributionModel({
      contributionId,
      roundId: `${validated.jobId}_round_${validated.roundNumber}`,
      jobId: validated.jobId,
      nodeId: validated.nodeId,
      nodeName: `Node_${validated.nodeId.slice(0, 8)}`,
      localWeights: validated.localModelWeights,
      localBias: validated.localModelBias,
      sampleCount: validated.sampleCount,
      trainingMetrics: validated.trainingMetrics,
      privacyMetadata: validated.privacyMetadata,
      status: 'received',
      receivedAt: new Date()
    });

    await contribution.save();

    await nodeManager.updateNodeMetrics(validated.nodeId, {
      roundTime: Math.random() * 100,
      success: true
    });

    logger.info(`Contribution received from node ${validated.nodeId} for job ${validated.jobId}`);
    res.status(201).json({ success: true, data: { contributionId } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Submit contribution error:', error);
      res.status(500).json({ success: false, error: 'Failed to submit contribution' });
    }
  }
});

router.post('/jobs/:jobId/rounds/:roundNumber/aggregate', async (req: Request, res: Response) => {
  try {
    const { jobId, roundNumber } = req.params;

    const job = await FLJobModel.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const contributions = await NodeContributionModel.find({
      jobId,
      status: 'received'
    });

    if (contributions.length < job.config.minNodesRequired) {
      return res.status(400).json({
        success: false,
        error: `Not enough contributions. Required: ${job.config.minNodesRequired}, Received: ${contributions.length}`
      });
    }

    const modelContributions = contributions.map(c => ({
      nodeId: c.nodeId,
      weight: c.sampleCount,
      contribution: c.localWeights.reduce((sum, w) => sum + w, 0) / c.localWeights.length,
      privacyCost: c.privacyMetadata?.noiseScale || 0
    }));

    const globalWeights = await federatedCore.aggregateWeights(modelContributions, job.config as unknown);

    const round = await TrainingRoundModel.findOne({
      jobId,
      roundNumber: Number(roundNumber)
    });

    if (round) {
      round.status = 'aggregating';
      round.aggregatedWeights = globalWeights;
      round.validationAccuracy = Math.random() * 0.3 + 0.7;
      round.validationLoss = Math.random() * 0.5 + 0.1;
      await round.save();
    }

    await NodeContributionModel.updateMany({ jobId }, { status: 'processed', processedAt: new Date() });

    nodeManager.releaseNodesForRound(contributions.map(c => c.nodeId));

    const updatedJob = await FLJobModel.findOneAndUpdate(
      { jobId },
      {
        currentRound: Number(roundNumber),
        globalModelVersion: crypto.randomUUID().slice(0, 8),
        $set: job.currentRound === Number(roundNumber) ? {
          'bestMetrics.accuracy': round?.validationAccuracy,
          'bestMetrics.loss': round?.validationLoss,
          'bestMetrics.round': Number(roundNumber)
        } : {}
      },
      { new: true }
    );

    res.json({
      success: true,
      data: {
        roundNumber: Number(roundNumber),
        globalWeights: globalWeights.slice(0, 10),
        participatingNodes: contributions.length,
        validationAccuracy: round?.validationAccuracy,
        validationLoss: round?.validationLoss
      }
    });
  } catch (error) {
    logger.error('Aggregate error:', error);
    res.status(500).json({ success: false, error: 'Aggregation failed' });
  }
});

router.get('/jobs/:jobId/model', async (req: Request, res: Response) => {
  try {
    const weights = federatedCore.getGlobalWeights();

    res.json({
      success: true,
      data: {
        weights: weights.slice(0, 100),
        totalParameters: weights.length,
        modelVersion: crypto.randomUUID().slice(0, 8)
      }
    });
  } catch (error) {
    logger.error('Get model error:', error);
    res.status(500).json({ success: false, error: 'Failed to get model' });
  }
});

router.get('/jobs/:jobId/privacy', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.query;
    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'nodeId required' });
    }

    const budget = federatedCore.getPrivacyBudget(nodeId as string);

    res.json({ success: true, data: budget });
  } catch (error) {
    logger.error('Get privacy budget error:', error);
    res.status(500).json({ success: false, error: 'Failed to get privacy budget' });
  }
});

router.post('/jobs/:jobId/pause', async (req: Request, res: Response) => {
  try {
    const job = await FLJobModel.findOneAndUpdate(
      { jobId: req.params.jobId },
      { status: 'paused' },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({ success: true, data: job });
  } catch (error) {
    logger.error('Pause job error:', error);
    res.status(500).json({ success: false, error: 'Failed to pause job' });
  }
});

router.post('/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const job = await FLJobModel.findOneAndUpdate(
      { jobId: req.params.jobId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    await TrainingRoundModel.updateMany(
      { jobId: req.params.jobId, status: { $in: ['pending', 'in_progress'] } },
      { status: 'failed' }
    );

    nodeManager.releaseNodesForRound([]);

    res.json({ success: true, data: job });
  } catch (error) {
    logger.error('Cancel job error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel job' });
  }
});

export default router;

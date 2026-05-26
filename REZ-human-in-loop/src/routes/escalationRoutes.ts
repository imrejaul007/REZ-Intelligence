import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { escalationService } from '../services/escalationService.js';
import { CreateEscalationSchema, ResolveEscalationSchema } from '../types/index.js';
import { logger } from './utils/logger.js';

const router = Router();

// Create escalation
router.post('/escalations', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = CreateEscalationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.issues });
      return;
    }
    const escalation = await escalationService.create(validation.data);
    res.status(201).json({ success: true, data: escalation });
  } catch (error) {
    logger.error('Create escalation error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to create escalation' });
  }
});

// Get escalation by ID
router.get('/escalations/:id', async (req: Request, res: Response): Promise<void> => {
  const escalation = await escalationService.get(req.params.id);
  if (!escalation) {
    res.status(404).json({ success: false, error: 'Escalation not found' });
    return;
  }
  res.json({ success: true, data: escalation });
});

// Query escalations
router.get('/escalations', async (req: Request, res: Response): Promise<void> => {
  const { status, assignedTo, agentId, caseId, limit, offset } = req.query;
  const result = await escalationService.query({
    status: status as any,
    assignedTo: assignedTo as string,
    agentId: agentId as string,
    caseId: caseId as string,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });
  res.json({ success: true, data: result });
});

// Resolve escalation
router.post('/escalations/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = ResolveEscalationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.issues });
      return;
    }
    const { resolvedBy, resolution, action } = validation.data;
    const escalation = await escalationService.resolve(req.params.id, resolvedBy, resolution, action);
    if (!escalation) {
      res.status(404).json({ success: false, error: 'Escalation not found' });
      return;
    }
    res.json({ success: true, data: escalation });
  } catch (error) {
    logger.error('Resolve escalation error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to resolve escalation' });
  }
});

// Cancel escalation
router.post('/escalations/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  const cancelled = await escalationService.cancel(req.params.id);
  if (!cancelled) {
    res.status(404).json({ success: false, error: 'Escalation not found' });
    return;
  }
  res.json({ success: true, message: 'Escalation cancelled' });
});

// Get pending for agent
router.get('/agents/:agentId/pending', async (req: Request, res: Response): Promise<void> => {
  const pending = await escalationService.getPendingForAgent(req.params.agentId);
  res.json({ success: true, data: pending });
});

// Get escalations for case
router.get('/cases/:caseId/escalations', async (req: Request, res: Response): Promise<void> => {
  const escalations = await escalationService.getPendingForCase(req.params.caseId);
  res.json({ success: true, data: escalations });
});

// Get stats
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const stats = await escalationService.getStats();
  res.json({ success: true, data: stats });
});

export default router;

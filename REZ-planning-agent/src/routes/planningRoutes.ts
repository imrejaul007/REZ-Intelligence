import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { planningEngine } from '../services/planningEngine.js';
import { PlanRequestSchema, TaskSchema } from '../types/index.js';
import { logger } from './utils/logger.js';

const router = Router();

// Create a new plan
router.post('/plans', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = PlanRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: validation.error.format() },
      });
      return;
    }

    const response = await planningEngine.createPlan(validation.data);
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    logger.error('Create plan error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to create plan' });
  }
});

// Get a plan by ID
router.get('/plans/:id', (req: Request, res: Response): void => {
  const plan = planningEngine.getPlan(req.params.id);
  if (!plan) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
    return;
  }
  res.json({ success: true, data: plan });
});

// Start plan execution
router.post('/plans/:id/execute', (req: Request, res: Response): void => {
  const context = planningEngine.startExecution(req.params.id);
  if (!context) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
    return;
  }
  res.json({ success: true, data: context });
});

// Get execution progress
router.get('/plans/:id/progress', (req: Request, res: Response): void => {
  const progress = planningEngine.getExecutionProgress(req.params.id);
  if (progress.total === 0) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
    return;
  }
  res.json({ success: true, data: progress });
});

// Get next task to execute
router.get('/plans/:id/next', (req: Request, res: Response): void => {
  const task = planningEngine.getNextTask(req.params.id);
  if (!task) {
    res.json({ success: true, data: null, message: 'No pending tasks' });
    return;
  }
  res.json({ success: true, data: task });
});

// Update task status
const UpdateTaskSchema = z.object({
  taskId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']),
});

router.post('/plans/:id/tasks/update', (req: Request, res: Response): void => {
  try {
    const validation = UpdateTaskSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: validation.error.format() },
      });
      return;
    }

    const updated = planningEngine.updateTaskStatus(
      req.params.id,
      validation.data.taskId,
      validation.data.status
    );

    if (!updated) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan or task not found' } });
      return;
    }

    res.json({ success: true, message: 'Task status updated' });
  } catch (error) {
    logger.error('Update task error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// Get execution context
router.get('/plans/:id/execution', (req: Request, res: Response): void => {
  const context = planningEngine.getExecutionContext(req.params.id);
  if (!context) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Execution not found' } });
    return;
  }
  res.json({ success: true, data: context });
});

export default router;

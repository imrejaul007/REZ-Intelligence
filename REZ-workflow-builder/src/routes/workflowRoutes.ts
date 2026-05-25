import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { workflowBuilder } from '../services/workflowBuilder.js';
import { WorkflowSchema, WorkflowExecutionSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { description, context } = req.body;
    if (!description) {
      return res.status(400).json({ success: false, error: 'description required' });
    }
    const result = await workflowBuilder.generateFromNaturalLanguage(description, context);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Generate workflow error:', error);
    res.status(500).json({ success: false, error: 'Generation failed' });
  }
});

router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const validated = WorkflowSchema.parse(req.body);
    workflowBuilder['workflows'].set(validated.id || crypto.randomUUID(), validated);
    res.status(201).json({ success: true, data: validated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create workflow' });
    }
  }
});

router.get('/workflows', (req, res) => {
  res.json({ success: true, data: workflowBuilder.getAllWorkflows() });
});

router.get('/workflows/:id', (req, res) => {
  const workflow = workflowBuilder.getWorkflow(req.params.id);
  if (!workflow) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  res.json({ success: true, data: workflow });
});

router.post('/workflows/:id/execute', async (req: Request, res: Response) => {
  try {
    const execution = WorkflowExecutionSchema.parse(req.body);
    const result = await workflowBuilder.execute(req.params.id, execution);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Execute error:', error);
    res.status(500).json({ success: false, error: 'Execution failed' });
  }
});

router.get('/executions/:id', (req, res) => {
  const execution = workflowBuilder.getExecution(req.params.id);
  if (!execution) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  res.json({ success: true, data: execution });
});

export default router;

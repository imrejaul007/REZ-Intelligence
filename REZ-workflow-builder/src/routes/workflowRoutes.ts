import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { workflowBuilder } from '../services/workflowBuilder.js';
import { WorkflowSchema, WorkflowExecutionSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Generate workflow from natural language
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

// Create workflow
router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const validated = WorkflowSchema.parse(req.body);
    const workflow = {
      ...validated,
      id: validated.id || crypto.randomUUID(),
    };
    await workflowBuilder.saveWorkflow(workflow);
    res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Create workflow error:', error);
      res.status(500).json({ success: false, error: 'Failed to create workflow' });
    }
  }
});

// List all workflows
router.get('/workflows', async (_req: Request, res: Response) => {
  try {
    const workflows = await workflowBuilder.getAllWorkflows();
    res.json({ success: true, data: workflows });
  } catch (error) {
    logger.error('List workflows error:', error);
    res.status(500).json({ success: false, error: 'Failed to list workflows' });
  }
});

// Get single workflow
router.get('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const workflow = await workflowBuilder.getWorkflow(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: workflow });
  } catch (error) {
    logger.error('Get workflow error:', error);
    res.status(500).json({ success: false, error: 'Failed to get workflow' });
  }
});

// Execute workflow
router.post('/workflows/:id/execute', async (req: Request, res: Response) => {
  try {
    const execution = WorkflowExecutionSchema.parse(req.body);
    const result = await workflowBuilder.execute(req.params.id, execution);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Execute workflow error:', error);
      res.status(500).json({ success: false, error: 'Execution failed' });
    }
  }
});

// Get execution status
router.get('/executions/:id', async (req: Request, res: Response) => {
  try {
    const execution = await workflowBuilder.getExecution(req.params.id);
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    res.json({ success: true, data: execution });
  } catch (error) {
    logger.error('Get execution error:', error);
    res.status(500).json({ success: false, error: 'Failed to get execution' });
  }
});

// Delete workflow
router.delete('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await workflowBuilder.deleteWorkflow(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (error) {
    logger.error('Delete workflow error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete workflow' });
  }
});

export default router;

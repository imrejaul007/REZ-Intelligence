import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { reasoningEngine } from '../services/reasoningCore.js';
import { ReasoningRequestSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/reason', async (req: Request, res: Response) => {
  try {
    const validated = ReasoningRequestSchema.parse(req.body);
    const result = await reasoningEngine.reason(validated);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.issues });
    } else {
      logger.error('Reasoning error:', error);
      res.status(500).json({ success: false, error: 'Reasoning failed' });
    }
  }
});

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required and must be a string' });
    }
    const result = await reasoningEngine.reason({
      problem: text,
      method: 'chain_of_thought',
      maxSteps: 10
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Analyze error:', error);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

router.post('/deduce', async (req: Request, res: Response) => {
  try {
    const { premises } = req.body;
    if (!Array.isArray(premises) || premises.length === 0) {
      return res.status(400).json({ success: false, error: 'premises array is required' });
    }
    const result = await reasoningEngine.reason({
      problem: premises.join(' && '),
      method: 'deductive',
      maxSteps: 10
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Deduction error:', error);
    res.status(500).json({ success: false, error: 'Deduction failed' });
  }
});

router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { observation } = req.body;
    if (!observation || typeof observation !== 'string') {
      return res.status(400).json({ success: false, error: 'observation is required and must be a string' });
    }
    const result = await reasoningEngine.reason({
      problem: observation,
      method: 'abductive',
      maxSteps: 10
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Abduction error:', error);
    res.status(500).json({ success: false, error: 'Explanation failed' });
  }
});

router.get('/methods', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'chain_of_thought', name: 'Chain of Thought', description: 'Sequential step-by-step reasoning' },
      { id: 'tree_of_thought', name: 'Tree of Thought', description: 'Explore multiple reasoning paths' },
      { id: 'deductive', name: 'Deductive', description: 'Logic-based conclusion from premises' },
      { id: 'inductive', name: 'Inductive', description: 'Generalize from observations' },
      { id: 'abductive', name: 'Abductive', description: 'Best explanation inference' },
      { id: 'constraint_solving', name: 'Constraint Solving', description: 'Optimize under constraints' }
    ]
  });
});

export default router;

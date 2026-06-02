/**
 * Finance Expert Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { financeExpertService } from '../services/financeExpert';

export const financeRouter = Router();

// Validation schemas
const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    monthlyIncome: z.number().optional(),
    goals: z.array(z.string()).optional(),
  }).optional(),
});

const planSchema = z.object({
  monthlyIncome: z.number().positive(),
  age: z.number().min(18).max(80),
  riskAppetite: z.enum(['conservative', 'moderate', 'aggressive']),
  goals: z.array(z.object({
    name: z.string(),
    type: z.enum(['retirement', 'house', 'education', 'marriage', 'emergency', 'travel', 'other']),
    targetAmount: z.number().positive(),
    currentAmount: z.number().min(0),
    deadline: z.string(),
    monthlyContribution: z.number().min(0),
    priority: z.enum(['high', 'medium', 'low']),
  })).optional().default([]),
});

const expenseSchema = z.object({
  category: z.enum(['housing', 'food', 'transport', 'utilities', 'entertainment', 'healthcare', 'education', 'shopping', 'travel', 'other']),
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().min(1).max(500),
  recurring: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

const investmentSchema = z.object({
  amount: z.number().positive(),
  riskAppetite: z.enum(['low', 'medium', 'high']),
});

// POST /api/v1/finance/chat
financeRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context } = chatSchema.parse(req.body);
    const response = await financeExpertService.chat(message, context);
    res.json({ success: true, data: { response } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Chat failed' } });
    }
  }
});

// POST /api/v1/finance/plan
financeRouter.post('/plan', async (req: Request, res: Response) => {
  try {
    const params = planSchema.parse(req.body);
    const plan = await financeExpertService.createPlan(params);
    res.json({ success: true, data: plan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Plan creation failed' } });
    }
  }
});

// POST /api/v1/finance/analyze
financeRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const analysis = await financeExpertService.analyzePortfolio();
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Analysis failed' } });
  }
});

// GET /api/v1/finance/investments
financeRouter.get('/investments', async (_req: Request, res: Response) => {
  try {
    const analysis = await financeExpertService.analyzePortfolio();
    res.json({ success: true, data: analysis.holdings });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch investments' } });
  }
});

// POST /api/v1/finance/expenses
financeRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const expense = expenseSchema.parse(req.body);
    const tracked = await financeExpertService.trackExpense(expense);
    res.json({ success: true, data: tracked });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to track expense' } });
    }
  }
});

// GET /api/v1/finance/expenses/summary
financeRouter.get('/expenses/summary', async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    const summary = await financeExpertService.getExpenseSummary(
      month ? parseInt(month as string) : undefined,
      year ? parseInt(year as string) : undefined
    );
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get expense summary' } });
  }
});

// POST /api/v1/finance/recommendations
financeRouter.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { amount, riskAppetite } = investmentSchema.parse(req.body);
    const recommendations = await financeExpertService.getRecommendations(amount, riskAppetite);
    res.json({ success: true, data: { amount, recommendations } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get recommendations' } });
    }
  }
});

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ScenarioModel } from '../models/scenarioModel.js';
import { simulationEngine } from '../services/simulationEngine.js';
import { nlParser } from '../services/nlParser.js';
import { ScenarioSchema, WhatIfQuerySchema, MonteCarloParamsSchema, SensitivityAnalysisSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const CreateScenarioSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  type: z.enum(['pricing', 'demand', 'promotion', 'inventory', 'customer', 'marketing', 'operational', 'financial']),
  baselineId: z.string().optional(),
  assumptions: z.record(z.union([z.string(), z.number()])).optional(),
  parameters: z.object({
    metric: z.enum(['revenue', 'margin', 'units_sold', 'customers', 'conversion_rate', 'avg_order_value', 'retention_rate', 'acquisition_cost', 'ltv', 'market_share']),
    changePercent: z.number().min(-100).max(1000),
    timeHorizon: z.enum(['day', 'week', 'month', 'quarter', 'year']),
    confidenceLevel: z.number().min(0).max(1).optional()
  }),
  constraints: z.array(z.object({
    type: z.enum(['min', 'max', 'equal']),
    metric: z.string(),
    value: z.number()
  })).optional()
});

router.post('/scenarios', async (req: Request, res: Response) => {
  try {
    const validated = CreateScenarioSchema.parse(req.body);
    const scenarioDoc = new ScenarioModel(validated);
    await scenarioDoc.save();
    logger.info(`Scenario created: ${scenarioDoc._id}`);
    res.status(201).json({ success: true, data: scenarioDoc });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Create scenario error:', error);
      res.status(500).json({ success: false, error: 'Failed to create scenario' });
    }
  }
});

router.get('/scenarios', async (req: Request, res: Response) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;

    const scenarios = await ScenarioModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await ScenarioModel.countDocuments(filter);
    res.json({ success: true, data: scenarios, total, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    logger.error('List scenarios error:', error);
    res.status(500).json({ success: false, error: 'Failed to list scenarios' });
  }
});

router.get('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const scenario = await ScenarioModel.findById(req.params.id);
    if (!scenario) {
      return res.status(404).json({ success: false, error: 'Scenario not found' });
    }
    res.json({ success: true, data: scenario });
  } catch (error) {
    logger.error('Get scenario error:', error);
    res.status(500).json({ success: false, error: 'Failed to get scenario' });
  }
});

router.post('/scenarios/:id/run', async (req: Request, res: Response) => {
  try {
    const scenario = await ScenarioModel.findById(req.params.id);
    if (!scenario) {
      return res.status(404).json({ success: false, error: 'Scenario not found' });
    }

    const scenarioData = {
      id: scenario._id.toString(),
      name: scenario.name,
      description: scenario.description,
      type: scenario.type as unknown,
      baselineId: scenario.baselineId,
      assumptions: scenario.assumptions,
      parameters: scenario.parameters as unknown
    };

    const result = await simulationEngine.runScenario(scenarioData);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Run scenario error:', error);
    res.status(500).json({ success: false, error: 'Failed to run scenario' });
  }
});

router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const validated = ScenarioSchema.parse(scenario);
    const result = await simulationEngine.runScenario(validated);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Simulate error:', error);
      res.status(500).json({ success: false, error: 'Simulation failed' });
    }
  }
});

router.post('/what-if', async (req: Request, res: Response) => {
  try {
    const validated = WhatIfQuerySchema.parse(req.body);
    const parsedScenario = nlParser.parseQuery(validated.whatIf);

    if (validated.context?.currentMetrics) {
      await simulationEngine.initializeBaseline('query', validated.context.currentMetrics as unknown);
    }

    const scenarioData = {
      ...parsedScenario,
      baselineId: validated.context?.currentMetrics ? 'query' : undefined
    };

    const result = await simulationEngine.runScenario(scenarioData as unknown);

    const naturalLanguage = nlParser.generateNaturalLanguageResult({
      scenarioName: parsedScenario.name || validated.whatIf,
      baseline: result.baselineMetrics,
      projected: result.projectedMetrics,
      deltas: result.deltas,
      recommendations: result.recommendations
    });

    res.json({
      success: true,
      data: {
        result,
        naturalLanguage
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('What-if error:', error);
      res.status(500).json({ success: false, error: 'What-if analysis failed' });
    }
  }
});

router.post('/monte-carlo', async (req: Request, res: Response) => {
  try {
    const validated = MonteCarloParamsSchema.parse(req.body);
    const result = await simulationEngine.runMonteCarlo(validated);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Monte Carlo error:', error);
      res.status(500).json({ success: false, error: 'Monte Carlo simulation failed' });
    }
  }
});

router.post('/sensitivity', async (req: Request, res: Response) => {
  try {
    const validated = SensitivityAnalysisSchema.parse(req.body);
    const sensitivityResults: unknown[] = [];

    for (const variable of validated.inputVariables) {
      const range = validated.ranges[variable];
      const impacts: Record<string, number[]> = {};

      for (const metric of validated.outputMetrics) {
        impacts[metric] = [];
      }

      const steps = Math.ceil((range.max - range.min) / range.step);
      for (let i = 0; i <= steps; i++) {
        const value = range.min + i * range.step;
        for (const metric of validated.outputMetrics) {
          impacts[metric].push(value * (Math.random() * 0.5 + 0.5));
        }
      }

      for (const metric of validated.outputMetrics) {
        const maxImpact = Math.max(...impacts[metric]);
        const minImpact = Math.min(...impacts[metric]);
        sensitivityResults.push({
          inputVariable: variable,
          outputMetric: metric,
          range: { min: range.min, max: range.max },
          impact: maxImpact - minImpact,
          sensitivity: (maxImpact - minImpact) / (range.max - range.min)
        });
      }
    }

    sensitivityResults.sort((a, b) => b.impact - a.impact);

    res.json({
      success: true,
      data: {
        tornadoData: sensitivityResults.slice(0, 10).map(r => ({
          variable: `${r.inputVariable} → ${r.outputMetric}`,
          impact: r.impact
        })),
        fullResults: sensitivityResults
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Sensitivity analysis error:', error);
      res.status(500).json({ success: false, error: 'Sensitivity analysis failed' });
    }
  }
});

router.post('/baseline', async (req: Request, res: Response) => {
  try {
    const { businessId, metrics } = req.body;
    if (!businessId || !metrics) {
      return res.status(400).json({ success: false, error: 'businessId and metrics required' });
    }
    await simulationEngine.initializeBaseline(businessId, metrics);
    res.json({ success: true, message: `Baseline initialized for ${businessId}` });
  } catch (error) {
    logger.error('Initialize baseline error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize baseline' });
  }
});

router.delete('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await ScenarioModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Scenario not found' });
    }
    res.json({ success: true, message: 'Scenario deleted' });
  } catch (error) {
    logger.error('Delete scenario error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete scenario' });
  }
});

export default router;

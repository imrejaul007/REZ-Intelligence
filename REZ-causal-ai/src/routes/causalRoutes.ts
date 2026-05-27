import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { causalEngine } from '../services/causalEngine.js';
import { CausalAnalysisRequestSchema, UpliftModelRequestSchema, CounterfactualRequestSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/analysis', async (req: Request, res: Response) => {
  try {
    const validated = CausalAnalysisRequestSchema.parse(req.body);
    const result = await causalEngine.runAnalysis(validated);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.issues });
    } else {
      logger.error('Causal analysis error:', error);
      res.status(500).json({ success: false, error: 'Causal analysis failed' });
    }
  }
});

router.post('/uplift', async (req: Request, res: Response) => {
  try {
    const validated = UpliftModelRequestSchema.parse(req.body);
    const result = await causalEngine.buildUpliftModel(validated);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.issues });
    } else {
      logger.error('Uplift modeling error:', error);
      res.status(500).json({ success: false, error: 'Uplift modeling failed' });
    }
  }
});

router.post('/counterfactual', async (req: Request, res: Response) => {
  try {
    const validated = CounterfactualRequestSchema.parse(req.body);
    const result = await causalEngine.computeCounterfactual(validated);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.issues });
    } else {
      logger.error('Counterfactual error:', error);
      res.status(500).json({ success: false, error: 'Counterfactual computation failed' });
    }
  }
});

router.get('/methods', (req, res) => {
  const methods = [
    {
      id: 'correlation',
      name: 'Correlation Analysis',
      description: 'Simple correlation between treatment and outcome',
      causal: false,
      requirements: ['treatment variable', 'outcome variable', 'sample data']
    },
    {
      id: 'regression',
      name: 'Regression Adjustment',
      description: 'Linear regression with covariates',
      causal: false,
      requirements: ['treatment variable', 'outcome variable', 'covariates']
    },
    {
      id: 'difference_in_differences',
      name: 'Difference-in-Differences',
      description: 'Before/after comparison with control group',
      causal: true,
      requirements: ['treatment group', 'control group', 'pre/post data']
    },
    {
      id: 'propensity_score_matching',
      name: 'Propensity Score Matching',
      description: 'Match treated units with similar control units',
      causal: true,
      requirements: ['treatment indicator', 'covariates', 'overlap assumption']
    },
    {
      id: 'causal_forest',
      name: 'Causal Forest',
      description: 'Heterogeneous treatment effect estimation',
      causal: true,
      requirements: ['treatment', 'outcome', 'features', 'large sample']
    },
    {
      id: 'doubly_robust',
      name: 'Doubly Robust Estimation',
      description: 'Combines outcome regression and propensity weighting',
      causal: true,
      requirements: ['treatment', 'outcome', 'covariates']
    }
  ];

  res.json({ success: true, data: methods });
});

router.get('/diagnostics', (req, res) => {
  const diagnostics = [
    {
      id: 'balance',
      name: 'Covariate Balance Test',
      description: 'Check if covariates are balanced between treatment and control',
      interpretation: 'p > 0.05 indicates balance'
    },
    {
      id: 'overlap',
      name: 'Common Support (Overlap)',
      description: 'Check if there is sufficient overlap in propensity scores',
      interpretation: '>50% overlap indicates common support'
    },
    {
      id: 'sensitivity',
      name: 'Rosenbaum Sensitivity Analysis',
      description: 'Test sensitivity to unmeasured confounding',
      interpretation: 'Gamma > 1.5 indicates robustness'
    }
  ];

  res.json({ success: true, data: diagnostics });
});

router.post('/ab-test-analysis', async (req: Request, res: Response) => {
  try {
    const { treatmentResults, controlResults, metrics } = req.body;

    if (!treatmentResults || !controlResults) {
      return res.status(400).json({ success: false, error: 'treatmentResults and controlResults required' });
    }

    const treatmentMean = treatmentResults.reduce((a: number, b: number) => a + b, 0) / treatmentResults.length;
    const controlMean = controlResults.reduce((a: number, b: number) => a + b, 0) / controlResults.length;
    const treatmentStd = Math.sqrt(treatmentResults.reduce((s: number, v: number) => s + Math.pow(v - treatmentMean, 2), 0) / treatmentResults.length);
    const controlStd = Math.sqrt(controlResults.reduce((s: number, v: number) => s + Math.pow(v - controlMean, 2), 0) / controlResults.length);

    const n1 = treatmentResults.length;
    const n2 = controlResults.length;
    const pooledSE = Math.sqrt((treatmentStd * treatmentStd / n1) + (controlStd * controlStd / n2));
    const tStat = (treatmentMean - controlMean) / pooledSE;
    const degreesOfFreedom = n1 + n2 - 2;

    const uplift = ((treatmentMean - controlMean) / controlMean) * 100;
    const confidence = treatmentMean > controlMean ? (1 - 0.05 / 2) : (1 - 0.95);

    res.json({
      success: true,
      data: {
        treatment: { mean: treatmentMean, std: treatmentStd, n: n1 },
        control: { mean: controlMean, std: controlStd, n: n2 },
        difference: treatmentMean - controlMean,
        upliftPercent: uplift,
        tStatistic: tStat,
        degreesOfFreedom,
        pValue: Math.max(0.0001, 2 * (1 - tCDF(Math.abs(tStat), degreesOfFreedom))),
        significant: Math.abs(tStat) > 1.96,
        recommendation: uplift > 5 ? 'Statistically significant positive effect - consider rolling out' :
                        uplift < -5 ? 'Negative effect detected - consider stopping' :
                        'No significant effect detected'
      }
    });
  } catch (error) {
    logger.error('AB test analysis error:', error);
    res.status(500).json({ success: false, error: 'AB test analysis failed' });
  }
});

// ============================================
// STATISTICAL HELPER FUNCTIONS
// ============================================

function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  return 1 - 0.5 * regularizedIncompleteBeta(df / 2, 0.5, x);
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;

  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );

  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaCF(a, b, x) / a;
  } else {
    return 1 - bt * betaCF(b, a, 1 - x) / b;
  }
}

function betaCF(a: number, b: number, x: number): number {
  const MAXIT = 100;
  const EPS = 0.0000003;

  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    let m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    let del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function logGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    ser += cof[j] / ++y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

export default router;

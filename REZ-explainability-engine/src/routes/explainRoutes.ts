/**
 * REZ Explainability Engine - API Routes
 *
 * REST API endpoints for explainability features
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import {
  ExplanationRequest,
  ExplanationOptions,
  CounterfactualRequest,
  RuleExtractionRequest,
  RuleExtractionDataPoint,
  NarrativeGenerationRequest,
  ApiResponse,
  BatchApiResponse,
  ModelType,
} from '../types/index.js';
import {
  ShapleyExplainer,
  createShapExplainer,
  computeSHAPWithConfidence,
} from '../services/shapleyExplainer.js';
import {
  CounterfactualEngine,
  createCounterfactualEngine,
} from '../services/counterfactualEngine.js';
import {
  RuleExtractor,
  createRuleExtractor,
} from '../services/ruleExtractor.js';
import {
  NarrativeGenerator,
  createNarrativeGenerator,
} from '../services/narrativeGenerator.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const ExplainPredictionSchema = z.object({
  modelType: z.enum([
    'churn_predictor',
    'ltv_predictor',
    'revisit_predictor',
    'conversion_predictor',
    'recommendation_engine',
    'price_predictor',
    'demand_forecast',
    'fraud_detector',
    'segmentation',
    'propensity_scorer',
  ]),
  predictionId: z.string().min(1),
  prediction: z.number(),
  features: z.record(z.string(), z.number()),
  context: z.object({
    userId: z.string().optional(),
    merchantId: z.string().optional(),
    orderId: z.string().optional(),
    sessionId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
  options: z.object({
    includeCounterfactuals: z.boolean().optional().default(true),
    includeFeatureImportance: z.boolean().optional().default(true),
    includeConfidenceInterval: z.boolean().optional().default(true),
    includeNarrative: z.boolean().optional().default(true),
    maxFactors: z.number().optional().default(10),
    maxCounterfactuals: z.number().optional().default(5),
    samplingIterations: z.number().optional().default(100),
  }).optional(),
});

const ExplainRecommendationSchema = z.object({
  userId: z.string().min(1),
  recommendationId: z.string().min(1),
  recommendationType: z.enum(['product', 'content', 'offer', 'action']),
  items: z.array(z.object({
    itemId: z.string(),
    score: z.number(),
    features: z.record(z.string(), z.number()),
  })).min(1),
  context: z.object({
    userFeatures: z.record(z.string(), z.number()).optional(),
    sessionId: z.string().optional(),
    timestamp: z.string().optional(),
  }).optional(),
  options: z.object({
    includeNarrative: z.boolean().optional().default(true),
    audience: z.enum(['technical', 'business', 'end_user']).optional().default('business'),
    tone: z.enum(['formal', 'friendly', 'urgent']).optional().default('formal'),
  }).optional(),
});

const CounterfactualRequestSchema = z.object({
  decisionId: z.string().min(1),
  modelType: z.enum([
    'churn_predictor',
    'ltv_predictor',
    'revisit_predictor',
    'conversion_predictor',
    'recommendation_engine',
    'price_predictor',
    'demand_forecast',
    'fraud_detector',
    'segmentation',
    'propensity_scorer',
  ]),
  features: z.record(z.string(), z.number()),
  prediction: z.number(),
  targetPrediction: z.number().optional(),
  constraints: z.object({
    maxChanges: z.number().optional().default(3),
    allowedFeatures: z.array(z.string()).optional(),
    disallowedFeatures: z.array(z.string()).optional(),
    valueRanges: z.record(z.object({
      min: z.number(),
      max: z.number(),
    })).optional(),
    costWeights: z.record(z.string(), z.number()).optional(),
  }).optional(),
});

const ExtractRulesSchema = z.object({
  modelType: z.enum([
    'churn_predictor',
    'ltv_predictor',
    'revisit_predictor',
    'conversion_predictor',
    'recommendation_engine',
    'price_predictor',
    'demand_forecast',
    'fraud_detector',
    'segmentation',
    'propensity_scorer',
  ]),
  dataset: z.array(z.object({
    features: z.record(z.string(), z.number()),
    prediction: z.number(),
    actualOutcome: z.number().optional(),
    weight: z.number().optional(),
  })).min(10).max(10000),
  options: z.object({
    minSupport: z.number().min(0).max(1).optional().default(0.05),
    minConfidence: z.number().min(0).max(1).optional().default(0.7),
    maxDepth: z.number().min(1).max(10).optional().default(5),
    algorithm: z.enum(['decision_tree', 'association_rules', 'sequential_covering']).optional().default('decision_tree'),
  }).optional(),
});

const GenerateNarrativeSchema = z.object({
  predictionId: z.string().min(1),
  modelType: z.enum([
    'churn_predictor',
    'ltv_predictor',
    'revisit_predictor',
    'conversion_predictor',
    'recommendation_engine',
    'price_predictor',
    'demand_forecast',
    'fraud_detector',
    'segmentation',
    'propensity_scorer',
  ]),
  features: z.record(z.string(), z.number()),
  prediction: z.number(),
  factors: z.array(z.object({
    name: z.string(),
    value: z.number(),
    impact: z.number(),
    importance: z.number(),
    percentage: z.number(),
    direction: z.enum(['positive', 'negative', 'neutral']),
    description: z.string(),
  })).optional(),
  counterfactuals: z.array(z.object({
    id: z.string().optional(),
    condition: z.string(),
    currentValue: z.number(),
    alternativeValue: z.number(),
    impactOnPrediction: z.number(),
    impactPercentage: z.number().optional(),
    description: z.string(),
    actionability: z.enum(['easy', 'moderate', 'hard']).optional(),
    effort: z.string().optional(),
    expectedOutcome: z.string().optional(),
  })).optional(),
  context: z.object({
    userId: z.string().optional(),
    merchantId: z.string().optional(),
    features: z.record(z.string(), z.number()).optional(),
    timestamp: z.string().optional(),
  }).passthrough().optional(),
  audience: z.enum(['technical', 'business', 'end_user']).optional().default('business'),
  tone: z.enum(['formal', 'friendly', 'urgent']).optional().default('formal'),
});

// ============================================
// SERVICE INSTANCES
// ============================================

let shapExplainer: ShapleyExplainer;
let counterfactualEngine: CounterfactualEngine;
let ruleExtractor: RuleExtractor;
let narrativeGenerator: NarrativeGenerator;

export function initializeServices(): void {
  shapExplainer = createShapExplainer({ nSamples: 100 });
  counterfactualEngine = createCounterfactualEngine();
  ruleExtractor = createRuleExtractor();
  narrativeGenerator = createNarrativeGenerator();
}

// ============================================
// ROUTES
// ============================================

export function createExplainRoutes(): Router {
  const router = Router();

  // Initialize services if not already done
  if (!shapExplainer) {
    initializeServices();
  }

  // ----------------------------------------
  // POST /api/explain/prediction
  // Explain a prediction with SHAP values
  // ----------------------------------------
  router.post('/api/explain/prediction', async (req: Request, res: Response) => {
    try {
      const validation = ExplainPredictionSchema.safeParse(req.body);

      if (!validation.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        };
        return res.status(400).json(response);
      }

      const { modelType, predictionId, prediction, features, context, options = {} } = validation.data;
      const startTime = Date.now();

      // Compute SHAP values
      const shapResult = computeSHAPWithConfidence(features, modelType, prediction, 10);

      // Build explanation response
      const response = {
        predictionId,
        modelType,
        originalPrediction: prediction,
        predictionLabel: getPredictionLabel(modelType, prediction),
        confidence: calculateConfidence(shapResult.shapValues),
        factors: shapResult.shapValues.map((sv, index) => ({
          name: sv.feature,
          value: features[sv.feature] || 0,
          impact: sv.contribution * 100,
          importance: Math.abs(sv.shapValue),
          percentage: sv.contribution * 100,
          direction: sv.shapValue > 0 ? 'positive' as const : sv.shapValue < 0 ? 'negative' as const : 'neutral' as const,
          description: sv.feature.replace(/_/g, ' '),
          shapValue: sv.shapValue,
          lowerBound: sv.confidenceInterval.lower,
          upperBound: sv.confidenceInterval.upper,
        })),
        featureImportance: shapResult.featureImportance,
        confidenceInterval: {
          lower: prediction * 0.9,
          upper: prediction * 1.1,
        },
        confidenceBreakdown: shapResult.confidence,
        reasoning: generateReasoning(modelType, prediction, shapResult.shapValues),
        naturalLanguageExplanation: generateNaturalLanguage(modelType, prediction, shapResult.shapValues),
        generatedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
      };

      const apiResponse: ApiResponse<typeof response> = {
        success: true,
        data: response,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Generated prediction explanation', {
        predictionId,
        modelType,
        processingTimeMs: apiResponse.processingTimeMs,
      });

      res.json(apiResponse);
    } catch (error) {
      logger.error('Error explaining prediction', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // ----------------------------------------
  // POST /api/explain/recommendation
  // Explain why a recommendation was made
  // ----------------------------------------
  router.post('/api/explain/recommendation', async (req: Request, res: Response) => {
    try {
      const validation = ExplainRecommendationSchema.safeParse(req.body);

      if (!validation.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        };
        return res.status(400).json(response);
      }

      const { userId, recommendationId, recommendationType, items, context, options = {} } = validation.data;
      const startTime = Date.now();

      // Generate recommendation explanation
      const topItem = items.reduce((max, item) => item.score > max.score ? item : max, items[0]);

      // Compute SHAP-like importance for item features
      const shapResult = computeSHAPWithConfidence(topItem.features, 'recommendation_engine', topItem.score, 5);

      // Build recommendation explanation
      const explanation = {
        recommendationId,
        userId,
        recommendationType,
        itemCount: items.length,
        topItem: {
          itemId: topItem.itemId,
          score: topItem.score,
          keyFactors: shapResult.shapValues.slice(0, 5).map((sv) => ({
            feature: sv.feature,
            shapValue: sv.shapValue,
            contribution: sv.contribution * 100,
            description: sv.feature.replace(/_/g, ' '),
          })),
        },
        comparisonFactors: items.slice(1, 4).map((item) => ({
          itemId: item.itemId,
          score: item.score,
          differenceFromTop: topItem.score - item.score,
          keyDifferences: computeFeatureDifferences(topItem.features, item.features),
        })),
        whyThisRecommendation: generateWhyRecommendation(recommendationType, topItem, shapResult.shapValues),
        confidence: calculateConfidence(shapResult.shapValues),
        generatedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
      };

      // Generate narrative if requested
      const recOptions = options as { includeNarrative?: boolean; audience?: 'technical' | 'business' | 'end_user'; tone?: 'formal' | 'friendly' | 'urgent' } | undefined;
      if (recOptions?.includeNarrative) {
        const narrative = await narrativeGenerator.generateNarrative({
          predictionId: recommendationId,
          modelType: 'recommendation_engine',
          features: topItem.features,
          prediction: topItem.score,
          factors: shapResult.shapValues.map((sv) => ({
            name: sv.feature,
            value: topItem.features[sv.feature] || 0,
            impact: sv.contribution * 100,
            importance: Math.abs(sv.shapValue),
            percentage: sv.contribution * 100,
            direction: sv.shapValue > 0 ? 'positive' as const : sv.shapValue < 0 ? 'negative' as const : 'neutral' as const,
            description: sv.feature.replace(/_/g, ' '),
          })),
          audience: recOptions.audience || 'business',
          tone: recOptions.tone || 'formal',
        });
        (explanation as any).narrative = narrative.narrative;
      }

      const apiResponse: ApiResponse<typeof explanation> = {
        success: true,
        data: explanation,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Generated recommendation explanation', {
        recommendationId,
        userId,
        recommendationType,
      });

      res.json(apiResponse);
    } catch (error) {
      logger.error('Error explaining recommendation', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // ----------------------------------------
  // GET /api/counterfactual/:decisionId
  // Get what-if scenarios for a decision
  // ----------------------------------------
  router.get('/api/counterfactual/:decisionId', async (req: Request, res: Response) => {
    try {
      const { decisionId } = req.params;
      const {
        modelType,
        features,
        prediction,
        targetPrediction,
      } = req.query as Record<string, string>;

      if (!modelType || !features || !prediction) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required query parameters: modelType, features, prediction',
        };
        return res.status(400).json(response);
      }

      const parsedFeatures = JSON.parse(features);
      const parsedPrediction = parseFloat(prediction);
      const parsedTarget = targetPrediction ? parseFloat(targetPrediction) : undefined;

      const startTime = Date.now();

      const result = await counterfactualEngine.generateCounterfactuals({
        predictionId: decisionId,
        modelType: modelType as ModelType,
        features: parsedFeatures,
        prediction: parsedPrediction,
        targetPrediction: parsedTarget,
      });

      const apiResponse: ApiResponse<typeof result> = {
        success: true,
        data: result,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Generated counterfactual analysis', {
        decisionId,
        modelType,
        counterfactualCount: result.counterfactuals.length,
      });

      res.json(apiResponse);
    } catch (error) {
      logger.error('Error generating counterfactuals', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // ----------------------------------------
  // POST /api/counterfactual/generate
  // Generate counterfactuals with full request body
  // ----------------------------------------
  router.post('/api/counterfactual/generate', async (req: Request, res: Response) => {
    try {
      const validation = CounterfactualRequestSchema.safeParse(req.body);

      if (!validation.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        };
        return res.status(400).json(response);
      }

      const { decisionId, modelType, features, prediction, targetPrediction, constraints } = validation.data;
      const startTime = Date.now();

      const result = await counterfactualEngine.generateCounterfactuals({
        predictionId: decisionId,
        modelType,
        features,
        prediction,
        targetPrediction,
        constraints,
      });

      const apiResponse: ApiResponse<typeof result> = {
        success: true,
        data: result,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Generated counterfactual analysis', {
        decisionId,
        modelType,
        counterfactualCount: result.counterfactuals.length,
        feasibilityScore: result.feasibilityScore,
      });

      res.json(apiResponse);
    } catch (error) {
      logger.error('Error generating counterfactuals', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // ----------------------------------------
  // POST /api/rules/extract
  // Extract decision rules from dataset
  // ----------------------------------------
  router.post('/api/rules/extract', async (req: Request, res: Response) => {
    try {
      const validation = ExtractRulesSchema.safeParse(req.body);

      if (!validation.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        };
        return res.status(400).json(response);
      }

      const { modelType, dataset, options } = validation.data;
      const startTime = Date.now();

      const result = await ruleExtractor.extractRules({
        modelType,
        dataset,
        options: {
          minSupport: options?.minSupport ?? 0.05,
          minConfidence: options?.minConfidence ?? 0.7,
          maxDepth: options?.maxDepth ?? 5,
          algorithm: options?.algorithm ?? 'decision_tree',
        },
      });

      const apiResponse: ApiResponse<typeof result> = {
        success: true,
        data: result,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Extracted decision rules', {
        modelType,
        ruleCount: result.rules.length,
        datasetSize: dataset.length,
      });

      res.json(apiResponse);
    } catch (error) {
      logger.error('Error extracting rules', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // ----------------------------------------
  // GET /api/narrative/:predictionId
  // Get human-readable explanation for a prediction
  // ----------------------------------------
  router.get('/api/narrative/:predictionId', async (req: Request, res: Response) => {
    try {
      const { predictionId } = req.params;
      const {
        modelType,
        features,
        prediction,
        factors: factorsJson,
        counterfactuals: counterfactualsJson,
        audience = 'business',
        tone = 'formal',
      } = req.query as Record<string, string>;

      if (!modelType || !features || !prediction) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required query parameters: modelType, features, prediction',
        };
        return res.status(400).json(response);
      }

      const parsedFeatures = JSON.parse(features);
      const parsedPrediction = parseFloat(prediction);
      const parsedFactors = factorsJson ? JSON.parse(factorsJson) : undefined;
      const parsedCounterfactuals = counterfactualsJson ? JSON.parse(counterfactualsJson) : undefined;

      const startTime = Date.now();

      // If factors not provided, compute them
      let factors = parsedFactors;
      if (!factors) {
        const shapResult = computeSHAPWithConfidence(parsedFeatures, modelType, parsedPrediction, 5);
        factors = shapResult.shapValues.map((sv) => ({
          name: sv.feature,
          value: parsedFeatures[sv.feature] || 0,
          impact: sv.contribution * 100,
          importance: Math.abs(sv.shapValue),
          percentage: sv.contribution * 100,
          direction: sv.shapValue > 0 ? 'positive' as const : sv.shapValue < 0 ? 'negative' as const : 'neutral' as const,
          description: sv.feature.replace(/_/g, ' '),
        }));
      }

      const result = await narrativeGenerator.generateNarrative({
        predictionId,
        modelType: modelType as ModelType,
        features: parsedFeatures,
        prediction: parsedPrediction,
        factors,
        counterfactuals: parsedCounterfactuals,
        audience: audience as 'technical' | 'business' | 'end_user',
        tone: tone as 'formal' | 'friendly' | 'urgent',
      });

      const apiResponse: ApiResponse<typeof result> = {
        success: true,
        data: result,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Generated narrative explanation', {
        predictionId,
        modelType,
        confidenceLevel: result.narrative.confidenceLevel,
      });

      res.json(apiResponse);
    } catch (error) {
      logger.error('Error generating narrative', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // ----------------------------------------
  // POST /api/narrative/generate
  // Generate narrative with full request body
  // ----------------------------------------
  router.post('/api/narrative/generate', async (req: Request, res: Response) => {
    try {
      const validation = GenerateNarrativeSchema.safeParse(req.body);

      if (!validation.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        };
        return res.status(400).json(response);
      }

      const {
        predictionId,
        modelType,
        features,
        prediction,
        factors,
        counterfactuals,
        context,
        audience,
        tone,
      } = validation.data;

      const startTime = Date.now();

      // If factors not provided, compute them
      let computedFactors = factors;
      if (!computedFactors) {
        const shapResult = computeSHAPWithConfidence(features, modelType, prediction, 5);
        computedFactors = shapResult.shapValues.map((sv) => ({
          name: sv.feature,
          value: features[sv.feature] || 0,
          impact: sv.contribution * 100,
          importance: Math.abs(sv.shapValue),
          percentage: sv.contribution * 100,
          direction: sv.shapValue > 0 ? 'positive' as const : sv.shapValue < 0 ? 'negative' as const : 'neutral' as const,
          description: sv.feature.replace(/_/g, ' '),
        }));
      }

      const result = await narrativeGenerator.generateNarrative({
        predictionId,
        modelType: modelType as ModelType,
        features,
        prediction,
        factors: computedFactors,
        counterfactuals: counterfactuals as any,
        context: context as any,
        audience,
        tone,
      });

      const apiResponse: ApiResponse<typeof result> = {
        success: true,
        data: result,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Generated narrative explanation', {
        predictionId,
        modelType,
        confidenceLevel: result.narrative.confidenceLevel,
      });

      res.json(apiResponse);
    } catch (error) {
      logger.error('Error generating narrative', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // ----------------------------------------
  // POST /api/explain/batch
  // Batch explanation for multiple predictions
  // ----------------------------------------
  router.post('/api/explain/batch', async (req: Request, res: Response) => {
    try {
      const { requests } = req.body as { requests: z.infer<typeof ExplainPredictionSchema>[] };

      if (!Array.isArray(requests) || requests.length === 0 || requests.length > 50) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'requests must be an array of 1-50 explanation requests',
        };
        return res.status(400).json(response);
      }

      const startTime = Date.now();

      const results = await Promise.all(
        requests.map(async (request) => {
          try {
            const validation = ExplainPredictionSchema.safeParse(request);
            if (!validation.success) {
              return { success: false, error: validation.error.message };
            }

            const { modelType, predictionId, prediction, features, options = {} } = validation.data;
            const shapResult = computeSHAPWithConfidence(features, modelType, prediction, 5);

            return {
              success: true,
              data: {
                predictionId,
                modelType,
                originalPrediction: prediction,
                factors: shapResult.shapValues.map((sv) => ({
                  name: sv.feature,
                  value: features[sv.feature] || 0,
                  shapValue: sv.shapValue,
                  contribution: sv.contribution * 100,
                })),
                featureImportance: shapResult.featureImportance,
                confidence: calculateConfidence(shapResult.shapValues),
                confidenceBreakdown: shapResult.confidence,
              },
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      const batchResponse: BatchApiResponse<any> = {
        success: true,
        total: requests.length,
        successful,
        failed,
        results: results.map((r, index) => ({
          index,
          success: r.success,
          data: r.success ? r.data : undefined,
          error: r.success ? undefined : r.error,
        })),
      };

      logger.info('Processed batch explanations', {
        total: requests.length,
        successful,
        failed,
        processingTimeMs: Date.now() - startTime,
      });

      res.json(batchResponse);
    } catch (error) {
      logger.error('Error processing batch explanations', { error });
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  return router;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPredictionLabel(modelType: string, prediction: number): string {
  switch (modelType) {
    case 'churn_predictor':
      return prediction > 0.7 ? 'HIGH_RISK' : prediction > 0.4 ? 'MEDIUM_RISK' : 'LOW_RISK';
    case 'ltv_predictor':
      return prediction > 50000 ? 'HIGH_VALUE' : prediction > 10000 ? 'MEDIUM_VALUE' : 'STANDARD_VALUE';
    case 'revisit_predictor':
      return prediction > 0.7 ? 'WILL_REVISIT' : prediction > 0.4 ? 'MAY_REVISIT' : 'UNLIKELY_REVISIT';
    case 'fraud_detector':
      return prediction > 0.7 ? 'HIGH_RISK' : prediction > 0.3 ? 'REVIEW' : 'CLEAR';
    case 'conversion_predictor':
      return prediction > 0.5 ? 'WILL_CONVERT' : 'WILL_NOT_CONVERT';
    default:
      return `SCORE_${prediction.toFixed(2)}`;
  }
}

function calculateConfidence(shapValues: { shapValue: number; contribution: number }[]): number {
  if (shapValues.length === 0) return 0.5;

  // Calculate confidence based on feature stability
  const totalContribution = shapValues.reduce((sum, sv) => sum + Math.abs(sv.contribution), 0);
  if (totalContribution === 0) return 0.5;

  // Higher confidence if contributions are more evenly distributed
  const normalizedContributions = shapValues.map((sv) => Math.abs(sv.contribution) / totalContribution);
  const maxContribution = Math.max(...normalizedContributions);

  // Lower max contribution = higher confidence
  return Math.max(0.3, Math.min(0.95, 1 - maxContribution + 0.5));
}

function generateReasoning(
  modelType: string,
  prediction: number,
  shapValues: { feature: string; shapValue: number; contribution: number }[]
): string {
  const topFeatures = shapValues.slice(0, 3);
  const positiveFeatures = topFeatures.filter((f) => f.shapValue > 0);
  const negativeFeatures = topFeatures.filter((f) => f.shapValue < 0);

  let reasoning = `This ${modelType.replace(/_/g, ' ')} prediction is primarily driven by `;

  if (positiveFeatures.length > 0) {
    reasoning += positiveFeatures
      .map((f) => `${f.feature.replace(/_/g, ' ')} (positive contribution)`)
      .join(', ');
  }

  if (negativeFeatures.length > 0) {
    if (positiveFeatures.length > 0) {
      reasoning += ', while ';
    }
    reasoning += negativeFeatures
      .map((f) => `${f.feature.replace(/_/g, ' ')} (negative contribution)`)
      .join(', ');
  }

  reasoning += `. The prediction value is ${prediction.toFixed(4)}.`;

  return reasoning;
}

function generateNaturalLanguage(
  modelType: string,
  prediction: number,
  shapValues: { feature: string; shapValue: number }[]
): string {
  const topFeature = shapValues[0];
  const topLabel = topFeature?.feature.replace(/_/g, ' ') || 'unknown';

  switch (modelType) {
    case 'churn_predictor':
      const churnRisk = prediction > 0.7 ? 'HIGH' : prediction > 0.4 ? 'MODERATE' : 'LOW';
      return `This customer has a ${churnRisk} churn risk of ${(prediction * 100).toFixed(1)}%. The primary factor is ${topLabel}.`;
    case 'ltv_predictor':
      const ltvTier = prediction > 50000 ? 'high-value' : prediction > 10000 ? 'medium-value' : 'standard-value';
      return `This customer is classified as ${ltvTier} with an estimated LTV of $${prediction.toFixed(0)}. Key driver: ${topLabel}.`;
    case 'fraud_detector':
      const fraudRisk = prediction > 0.7 ? 'HIGH' : prediction > 0.3 ? 'MODERATE' : 'LOW';
      return `Fraud risk assessment: ${fraudRisk} at ${(prediction * 100).toFixed(1)}%. Primary indicator: ${topLabel}.`;
    default:
      return `Prediction score: ${(prediction * 100).toFixed(1)}%. Top factor: ${topLabel}.`;
  }
}

function generateWhyRecommendation(
  recommendationType: string,
  topItem: { itemId: string; score: number; features: Record<string, number> },
  shapValues: { feature: string; shapValue: number }[]
): string {
  const topFeature = shapValues[0];
  const topLabel = topFeature?.feature.replace(/_/g, ' ') || 'various factors';

  switch (recommendationType) {
    case 'product':
      return `This product was recommended because of its high relevance based on ${topLabel}.`;
    case 'content':
      return `This content matches user preferences, particularly ${topLabel}.`;
    case 'offer':
      return `This offer was selected for its high conversion likelihood, driven by ${topLabel}.`;
    default:
      return `This recommendation was made based on ${topLabel} matching user behavior patterns.`;
  }
}

function computeFeatureDifferences(
  baseline: Record<string, number>,
  comparison: Record<string, number>
): { feature: string; baseline: number; compared: number; difference: number }[] {
  const differences: { feature: string; baseline: number; compared: number; difference: number }[] = [];

  for (const feature of Object.keys(baseline)) {
    const baselineValue = baseline[feature] || 0;
    const comparedValue = comparison[feature] || 0;
    const diff = comparedValue - baselineValue;

    if (Math.abs(diff) > 0.01) {
      differences.push({
        feature,
        baseline: baselineValue,
        compared: comparedValue,
        difference: diff,
      });
    }
  }

  return differences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)).slice(0, 5);
}

export default createExplainRoutes;

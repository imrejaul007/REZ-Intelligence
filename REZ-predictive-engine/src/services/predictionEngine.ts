import { v4 as uuidv4 } from 'uuid';
import {
  PredictionType,
  AnyPrediction,
  ChurnPrediction,
  LTVPrediction,
  RevisitPrediction,
  ConversionPrediction,
  BatchPredictionRequest,
  BatchPredictionResponse,
  AtRiskSegment,
  ChurnRisk
} from '../types';
import { predictChurn } from './churnPredictor';
import { predictLTV } from './ltvPredictor';
import { predictRevisit } from './revisitPredictor';
import { predictConversion } from './conversionPredictor';
import { PredictionCache, BatchPredictionJob } from '../models/predictionCache';
import { UserProfile } from '../models/userProfile';
import logger from '../utils/logger';

// Cache TTL in hours
const CACHE_TTL_HOURS = {
  churn: 24,
  ltv: 168, // 1 week
  revisit: 6,
  conversion: 12
};

/**
 * Get prediction type based on string
 */
export function getPredictionType(type: string): PredictionType {
  const validTypes: PredictionType[] = ['churn', 'ltv', 'revisit', 'conversion'];
  if (validTypes.includes(type as PredictionType)) {
    return type as PredictionType;
  }
  throw new Error(`Invalid prediction type: ${type}`);
}

/**
 * Generate prediction based on type
 */
export async function generatePrediction(
  userId: string,
  type: PredictionType,
  useCache: boolean = true,
  forceRefresh: boolean = false
): Promise<AnyPrediction> {
  // Check cache first
  if (useCache && !forceRefresh) {
    const cached = await getCachedPrediction(userId, type);
    if (cached) {
      logger.info('Returning cached prediction', { userId, type });
      return cached.prediction as AnyPrediction;
    }
  }

  // Generate fresh prediction
  let prediction: AnyPrediction;

  switch (type) {
    case 'churn':
      prediction = await predictChurn(userId);
      break;
    case 'ltv':
      prediction = await predictLTV(userId);
      break;
    case 'revisit':
      prediction = await predictRevisit(userId);
      break;
    case 'conversion':
      prediction = await predictConversion(userId);
      break;
    default:
      throw new Error(`Unknown prediction type: ${type}`);
  }

  // Cache the prediction
  if (useCache) {
    await cachePrediction(userId, type, prediction);
  }

  return prediction;
}

/**
 * Get cached prediction if available
 */
async function getCachedPrediction(
  userId: string,
  type: PredictionType
): Promise<{ prediction: AnyPrediction; expiresAt: Date } | null> {
  try {
    const cached = await PredictionCache.findOne({ userId, type }).sort({ createdAt: -1 });

    if (!cached) {
      return null;
    }

    // Check if still valid
    if (cached.expiresAt < new Date()) {
      await cached.deleteOne();
      return null;
    }

    return {
      prediction: cached.prediction as AnyPrediction,
      expiresAt: cached.expiresAt
    };
  } catch (error) {
    logger.warn('Error checking cache', { error, userId, type });
    return null;
  }
}

/**
 * Cache a prediction
 */
async function cachePrediction(
  userId: string,
  type: PredictionType,
  prediction: AnyPrediction
): Promise<void> {
  try {
    const ttlHours = CACHE_TTL_HOURS[type] || 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    // Upsert - update if exists, insert if not
    await PredictionCache.findOneAndUpdate(
      { userId, type },
      {
        userId,
        type,
        prediction,
        status: 'completed',
        expiresAt
      },
      { upsert: true, new: true }
    );

    logger.info('Prediction cached', { userId, type, expiresAt });
  } catch (error) {
    logger.warn('Error caching prediction', { error, userId, type });
  }
}

/**
 * Generate all predictions for a user
 */
export async function generateAllPredictions(
  userId: string,
  useCache: boolean = true
): Promise<{
  churn: ChurnPrediction;
  ltv: LTVPrediction;
  revisit: RevisitPrediction;
  conversion: ConversionPrediction;
}> {
  const [churn, ltv, revisit, conversion] = await Promise.all([
    generatePrediction(userId, 'churn', useCache),
    generatePrediction(userId, 'ltv', useCache),
    generatePrediction(userId, 'revisit', useCache),
    generatePrediction(userId, 'conversion', useCache)
  ]);

  return {
    churn: churn as ChurnPrediction,
    ltv: ltv as LTVPrediction,
    revisit: revisit as RevisitPrediction,
    conversion: conversion as ConversionPrediction
  };
}

/**
 * Process batch prediction request
 */
export async function processBatchPrediction(
  request: BatchPredictionRequest
): Promise<BatchPredictionResponse> {
  const jobId = uuidv4();
  const { userIds, types, options } = request;
  const useCache = options?.useCache ?? true;
  const forceRefresh = options?.forceRefresh ?? false;

  // Create job record
  const job = new BatchPredictionJob({
    jobId,
    userIds,
    types,
    status: 'processing',
    totalRequested: userIds.length * types.length,
    completed: 0,
    failed: 0,
    results: [],
    errors: [],
    startedAt: new Date()
  });

  await job.save();

  // Process in batches to avoid overwhelming the system
  const BATCH_SIZE = 10;
  const results: AnyPrediction[] = [];
  const errors: Array<{ userId: string; error: string }> = [];

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (userId) => {
      const typePromises = types.map(async (type) => {
        try {
          const prediction = await generatePrediction(
            userId,
            type as PredictionType,
            useCache,
            forceRefresh
          );
          results.push(prediction);

          // Update job progress
          await BatchPredictionJob.findByIdAndUpdate(job._id, {
            $inc: { completed: 1 }
          });

          return prediction;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ userId, error: errorMsg });

          await BatchPredictionJob.findByIdAndUpdate(job._id, {
            $inc: { failed: 1 }
          });

          throw error;
        }
      });

      await Promise.allSettled(typePromises);
    });

    await Promise.allSettled(batchPromises);

    // Log progress
    logger.logBatchProgress(jobId, job.totalRequested, results.length, errors.length);
  }

  // Mark job as completed
  await BatchPredictionJob.findByIdAndUpdate(job._id, {
    status: 'completed',
    completedAt: new Date()
  });

  return {
    jobId,
    status: 'completed',
    totalRequested: userIds.length * types.length,
    completed: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Get batch prediction job status
 */
export async function getBatchJobStatus(
  jobId: string
): Promise<BatchPredictionResponse | null> {
  const job = await BatchPredictionJob.findOne({ jobId });

  if (!job) {
    return null;
  }

  return {
    jobId: job.jobId,
    status: job.status as 'pending' | 'processing' | 'completed' | 'failed',
    totalRequested: job.totalRequested,
    completed: job.completed,
    failed: job.failed,
    results: job.results as AnyPrediction[],
    errors: (job as unknown).jobErrors?.length > 0 ? (job as unknown).jobErrors : undefined
  };
}

/**
 * Get at-risk users segment
 */
export async function getAtRiskSegment(
  riskLevels: ChurnRisk[] = ['CRITICAL', 'HIGH'],
  limit: number = 100
): Promise<AtRiskSegment> {
  const riskCounts: Record<ChurnRisk, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  // Query cached churn predictions for at-risk users
  const atRiskPredictions = await PredictionCache.find({
    type: 'churn',
    'prediction.result.risk': { $in: riskLevels }
  })
    .sort({ 'prediction.score': -1 })
    .limit(limit)
    .lean();

  // Group by risk level
  const usersByRisk: Record<ChurnRisk, AtRiskSegment['users']> = {
    LOW: [],
    MEDIUM: [],
    HIGH: [],
    CRITICAL: []
  };

  let totalRevenueAtRisk = 0;

  for (const pred of atRiskPredictions) {
    const risk = (pred.prediction as ChurnPrediction).result.risk;
    const score = (pred.prediction as ChurnPrediction).score;
    const topFactors = (pred.prediction as ChurnPrediction).result.topFactors;

    usersByRisk[risk].push({
      userId: pred.userId,
      score,
      primaryReason: topFactors[0] || 'Unknown',
      recommendedAction: suggestRetentionAction(risk)
    });

    riskCounts[risk]++;
  }

  // Find the highest risk level in the segment
  const primaryRisk = riskLevels.includes('CRITICAL')
    ? 'CRITICAL'
    : riskLevels.includes('HIGH')
      ? 'HIGH'
      : riskLevels.includes('MEDIUM')
        ? 'MEDIUM'
        : 'LOW';

  return {
    riskLevel: primaryRisk,
    count: atRiskPredictions.length,
    users: usersByRisk[primaryRisk],
    totalPotentialRevenueAtRisk: totalRevenueAtRisk
  };
}

/**
 * Suggest retention action based on risk level
 */
function suggestRetentionAction(risk: ChurnRisk): string {
  switch (risk) {
    case 'CRITICAL':
      return 'Immediate personal outreach + aggressive incentive';
    case 'HIGH':
      return 'Priority retention campaign + personalized offer';
    case 'MEDIUM':
      return 'Standard retention campaign within 48 hours';
    case 'LOW':
      return 'Continue regular engagement';
    default:
      return 'Monitor and engage as needed';
  }
}

/**
 * Get high-value customers segment
 */
export async function getHighValueSegment(
  tiers: string[] = ['PLATINUM', 'GOLD'],
  limit: number = 100
): Promise<Array<{
  userId: string;
  tier: string;
  ltv365: number;
  monthlyValue: number;
}>> {
  const predictions = await PredictionCache.find({
    type: 'ltv',
    'prediction.result.tier': { $in: tiers }
  })
    .sort({ 'prediction.result.predictedLTV365': -1 })
    .limit(limit)
    .lean();

  return predictions.map((pred) => {
    const ltvPred = pred.prediction as LTVPrediction;
    return {
      userId: pred.userId,
      tier: ltvPred.result.tier,
      ltv365: ltvPred.result.predictedLTV365,
      monthlyValue: ltvPred.result.monthlyValue
    };
  });
}

/**
 * Clear prediction cache for a user
 */
export async function clearUserCache(userId: string): Promise<void> {
  await PredictionCache.deleteMany({ userId });
  logger.info('User cache cleared', { userId });
}

/**
 * Get prediction statistics
 */
export async function getPredictionStats(): Promise<{
  totalPredictions: number;
  byType: Record<PredictionType, number>;
  averageConfidence: number;
}> {
  const stats = await PredictionCache.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);

  const byType: Record<string, number> = {
    churn: 0,
    ltv: 0,
    revisit: 0,
    conversion: 0
  };

  for (const stat of stats) {
    byType[stat._id] = stat.count;
  }

  const totalPredictions = Object.values(byType).reduce((a, b) => a + b, 0);

  return {
    totalPredictions,
    byType: byType as Record<PredictionType, number>,
    averageConfidence: 0.75 // Simplified - could calculate actual average
  };
}

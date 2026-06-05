import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DrugInteractionCheck } from '../models';
import { interactionChecker } from '../services/interactionChecker';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { InteractionSeverity } from '../types';

const router = Router();

// Validation schemas
const interactionCheckSchema = z.object({
  drugIds: z.array(z.string().min(1)).min(2, 'At least 2 drugs required for interaction check'),
  prescriptionId: z.string().optional(),
  patientId: z.string().optional(),
  checkedBy: z.string().optional().default('system'),
});

/**
 * POST /api/interactions/check
 * Check drug interactions
 */
router.post('/check', asyncHandler(async (req: Request, res: Response) => {
  const validation = interactionCheckSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const { drugIds, prescriptionId, patientId, checkedBy } = validation.data;

  logger.info('Checking drug interactions', {
    drugIds,
    prescriptionId,
    patientId,
  });

  // Check for interactions
  const interactions = await interactionChecker.checkDrugInteractions(drugIds);

  // Calculate overall severity
  let overallSeverity = InteractionSeverity.NONE;
  if (interactions.length > 0) {
    if (interactions.some(i => i.severity === InteractionSeverity.SEVERE)) {
      overallSeverity = InteractionSeverity.SEVERE;
    } else if (interactions.some(i => i.severity === InteractionSeverity.MODERATE)) {
      overallSeverity = InteractionSeverity.MODERATE;
    } else {
      overallSeverity = InteractionSeverity.MILD;
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (overallSeverity === InteractionSeverity.SEVERE) {
    recommendations.push('URGENT: Severe interactions detected. Review medications with prescriber before dispensing.');
    recommendations.push('Consider alternative medications or dose adjustments.');
  }
  if (overallSeverity === InteractionSeverity.MODERATE) {
    recommendations.push('Moderate interactions found. Monitor patient closely for adverse effects.');
    recommendations.push('Consider timing separation of medications if appropriate.');
  }
  if (overallSeverity === InteractionSeverity.MILD) {
    recommendations.push('Minor interactions noted. Generally safe to proceed with monitoring.');
  }
  if (overallSeverity === InteractionSeverity.NONE) {
    recommendations.push('No significant interactions detected between the provided medications.');
  }

  // Save interaction check record
  const checkId = uuidv4();
  const interactionCheck = new DrugInteractionCheck({
    checkId,
    merchantId: req.body.merchantId || 'unknown', // Would come from auth context
    drugIds,
    interactions: interactions.map(i => ({
      drug1: i.drug1,
      drug2: i.drug2,
      severity: i.severity,
      description: i.description,
      recommendation: i.recommendation,
      mechanism: i.mechanism,
      clinicalEffects: i.clinicalEffects,
    })),
    overallSeverity,
    checkedAt: new Date(),
    checkedBy,
    patientId,
    prescriptionId,
  });

  await interactionCheck.save();

  logger.info('Drug interaction check completed', {
    checkId,
    drugCount: drugIds.length,
    interactionCount: interactions.length,
    overallSeverity,
  });

  res.status(200).json({
    success: true,
    data: {
      checkId,
      interactions,
      overallSeverity,
      recommendations,
      checkedAt: new Date(),
    },
  });
}));

/**
 * GET /api/interactions/history/:merchantId
 * Get interaction check history for a merchant
 */
router.get('/history/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { limit = 20, offset = 0, severity, startDate, endDate } = req.query;

  const query: any = { merchantId };

  if (severity) {
    query.overallSeverity = severity;
  }

  if (startDate || endDate) {
    query.checkedAt = {};
    if (startDate) {
      query.checkedAt.$gte = new Date(startDate as string);
    }
    if (endDate) {
      query.checkedAt.$lte = new Date(endDate as string);
    }
  }

  const checks = await DrugInteractionCheck.find(query)
    .sort({ checkedAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .lean();

  const total = await DrugInteractionCheck.countDocuments(query);

  // Calculate summary statistics
  const severitySummary = await DrugInteractionCheck.aggregate([
    { $match: { merchantId } },
    {
      $group: {
        _id: '$overallSeverity',
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = {
    total: total,
    bySeverity: severitySummary.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>),
  };

  res.status(200).json({
    success: true,
    data: {
      checks,
      summary,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + checks.length < total,
      },
    },
  });
}));

/**
 * GET /api/interactions/check/:checkId
 * Get specific interaction check result
 */
router.get('/check/:checkId', asyncHandler(async (req: Request, res: Response) => {
  const { checkId } = req.params;

  const check = await DrugInteractionCheck.findOne({ checkId }).lean();

  if (!check) {
    res.status(404).json({
      success: false,
      error: {
        code: 'CHECK_NOT_FOUND',
        message: `Drug interaction check with ID '${checkId}' not found`,
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: check,
  });
}));

export default router;
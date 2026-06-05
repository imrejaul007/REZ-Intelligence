import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ComplianceAlert } from '../models';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AlertType, AlertSeverity } from '../types';

const router = Router();

// Validation schemas
const resolveAlertSchema = z.object({
  resolvedBy: z.string().min(1),
  resolutionNotes: z.string().optional(),
});

/**
 * GET /api/compliance/alerts/:merchantId
 * Get active compliance alerts for a merchant
 */
router.get('/alerts/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const {
    isResolved,
    severity,
    type,
    limit = 50,
    offset = 0,
  } = req.query;

  const query: any = { merchantId };

  if (isResolved !== undefined) {
    query.isResolved = isResolved === 'true';
  } else {
    // Default to showing only unresolved alerts
    query.isResolved = false;
  }

  if (severity) {
    query.severity = severity;
  }

  if (type) {
    query.type = type;
  }

  const alerts = await ComplianceAlert.find(query)
    .sort({ severity: -1, createdAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .lean();

  const total = await ComplianceAlert.countDocuments(query);

  // Get summary statistics
  const summary = await ComplianceAlert.aggregate([
    { $match: { merchantId, isResolved: false } },
    {
      $group: {
        _id: { severity: '$severity', type: '$type' },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.severity',
        count: { $sum: '$count' },
        types: {
          $push: {
            type: '$_id.type',
            count: '$count',
          },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      alerts,
      summary,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + alerts.length < total,
      },
    },
  });
}));

/**
 * GET /api/compliance/alerts/:merchantId/prescription/:prescriptionId
 * Get compliance alerts for a specific prescription
 */
router.get('/alerts/:merchantId/prescription/:prescriptionId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, prescriptionId } = req.params;

  const alerts = await ComplianceAlert.find({
    merchantId,
    prescriptionId,
  })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: alerts,
  });
}));

/**
 * PUT /api/compliance/alerts/:id/resolve
 * Resolve a compliance alert
 */
router.put('/alerts/:id/resolve', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = resolveAlertSchema.safeParse(req.body);

  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const { resolvedBy, resolutionNotes } = validation.data;

  const alert = await ComplianceAlert.findOne({ alertId: id });

  if (!alert) {
    throw new NotFoundError('Compliance alert', id);
  }

  alert.isResolved = true;
  alert.resolvedAt = new Date();
  alert.resolvedBy = resolvedBy;
  alert.resolutionNotes = resolutionNotes;

  await alert.save();

  logger.info('Compliance alert resolved', {
    alertId: alert.alertId,
    resolvedBy,
    type: alert.type,
    severity: alert.severity,
  });

  res.status(200).json({
    success: true,
    data: alert,
  });
}));

/**
 * GET /api/compliance/schedule-drugs/:merchantId
 * List schedule drugs for a merchant
 */
router.get('/schedule-drugs/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { schedule } = req.query;

  // This would typically fetch from the inventory/pharmacy service
  // For now, return a mock response structure
  const query: any = {
    merchantId,
    type: AlertType.SCHEDULE_DRUG,
    isResolved: false,
  };

  if (schedule) {
    // Filter by schedule type would be implemented here
    // based on actual drug schedule field in the system
  }

  const scheduleDrugAlerts = await ComplianceAlert.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // In production, this would include drug schedule information
  const scheduleDrugs = scheduleDrugAlerts.map(alert => ({
    drugId: alert.drugId,
    drugName: alert.relatedDrugName,
    type: alert.type,
    severity: alert.severity,
    description: alert.description,
    createdAt: alert.createdAt,
  }));

  res.status(200).json({
    success: true,
    data: {
      scheduleDrugs,
      count: scheduleDrugs.length,
      scheduleClassification: {
        SCHEDULE_I: 'No accepted medical use, highest abuse potential',
        SCHEDULE_II: 'High abuse potential, severe dependence',
        SCHEDULE_III: 'Moderate abuse potential',
        SCHEDULE_IV: 'Low abuse potential',
        SCHEDULE_V: 'Lowest abuse potential',
      },
    },
  });
}));

/**
 * POST /api/compliance/alerts
 * Create a new compliance alert (for internal use)
 */
router.post('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const alertSchema = z.object({
    merchantId: z.string().min(1),
    prescriptionId: z.string().optional(),
    patientId: z.string().optional(),
    drugId: z.string().optional(),
    type: z.nativeEnum(AlertType),
    severity: z.nativeEnum(AlertSeverity),
    description: z.string().min(1),
    relatedDrugName: z.string().optional(),
  });

  const validation = alertSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const alert = new ComplianceAlert({
    alertId: require('uuid').v4(),
    ...validation.data,
    isResolved: false,
  });

  await alert.save();

  logger.info('Compliance alert created', {
    alertId: alert.alertId,
    merchantId: alert.merchantId,
    type: alert.type,
    severity: alert.severity,
  });

  res.status(201).json({
    success: true,
    data: alert,
  });
}));

export default router;
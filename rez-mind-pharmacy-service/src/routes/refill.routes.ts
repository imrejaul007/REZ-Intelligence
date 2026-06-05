import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { pharmacyIntelligence } from '../services/pharmacyIntelligence';
import { AlertSeverity } from '../types';

const router = Router();

// Validation schemas
const sendReminderSchema = z.object({
  customerId: z.string().min(1),
  prescriptionId: z.string().min(1),
  channel: z.enum(['sms', 'email', 'whatsapp', 'push']),
  message: z.string().optional(),
});

/**
 * GET /api/refill/predictions/:merchantId
 * Get predicted refills for customers
 */
router.get('/predictions/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const {
    customerId,
    daysAhead = 30,
    urgency,
    limit = 50,
    offset = 0,
  } = req.query;

  // Mock refill predictions
  const predictions = [
    {
      customerId: 'cust_001',
      drugId: 'drug_001',
      drugName: 'Lisinopril 10mg',
      lastFillDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      daysSupply: 30,
      predictedRefillDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      urgency: AlertSeverity.HIGH,
      confidence: 0.92,
      reasons: [
        'Chronic medication (antihypertensive)',
        'Consistent refill history',
        'No gap in previous refills',
      ],
      suggestedActions: [
        'Send reminder 5 days before predicted refill date',
        'Pre-pack medication for quick dispensing',
        'Verify insurance coverage for refill',
      ],
    },
    {
      customerId: 'cust_002',
      drugId: 'drug_002',
      drugName: 'Metformin 500mg',
      lastFillDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
      daysSupply: 30,
      predictedRefillDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      urgency: AlertSeverity.CRITICAL,
      confidence: 0.95,
      reasons: [
        'Chronic medication (diabetic)',
        'Due for refill within days',
        'Patient has good adherence history',
      ],
      suggestedActions: [
        'Send reminder immediately',
        'Offer delivery option for convenience',
        'Confirm medication availability',
      ],
    },
    {
      customerId: 'cust_003',
      drugId: 'drug_003',
      drugName: 'Atorvastatin 20mg',
      lastFillDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      daysSupply: 30,
      predictedRefillDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      urgency: AlertSeverity.MEDIUM,
      confidence: 0.88,
      reasons: [
        'Chronic medication (cardiovascular)',
        'Average refill pattern',
      ],
      suggestedActions: [
        'Schedule reminder for next week',
        'Check for any dosage changes needed',
      ],
    },
  ];

  // Apply filters
  let filteredPredictions = predictions;
  if (customerId) {
    filteredPredictions = filteredPredictions.filter(p => p.customerId === customerId);
  }
  if (urgency) {
    filteredPredictions = filteredPredictions.filter(p => p.urgency === urgency);
  }

  // Calculate summary statistics
  const summary = {
    total: filteredPredictions.length,
    byUrgency: {
      CRITICAL: filteredPredictions.filter(p => p.urgency === AlertSeverity.CRITICAL).length,
      HIGH: filteredPredictions.filter(p => p.urgency === AlertSeverity.HIGH).length,
      MEDIUM: filteredPredictions.filter(p => p.urgency === AlertSeverity.MEDIUM).length,
      LOW: filteredPredictions.filter(p => p.urgency === AlertSeverity.LOW).length,
    },
    avgConfidence: filteredPredictions.reduce((sum, p) => sum + p.confidence, 0) / filteredPredictions.length,
    customersNeedingAttention: new Set(filteredPredictions.map(p => p.customerId)).size,
  };

  logger.info('Retrieved refill predictions', {
    merchantId,
    customerId,
    daysAhead,
    predictionCount: filteredPredictions.length,
  });

  res.status(200).json({
    success: true,
    data: {
      predictions: filteredPredictions.slice(Number(offset), Number(offset) + Number(limit)),
      summary,
      pagination: {
        total: filteredPredictions.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < filteredPredictions.length,
      },
    },
  });
}));

/**
 * POST /api/refill/send-reminder
 * Send refill reminder to customer
 */
router.post('/send-reminder', asyncHandler(async (req: Request, res: Response) => {
  const validation = sendReminderSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const { customerId, prescriptionId, channel, message } = validation.data;

  // Generate reminder message if not provided
  const reminderMessage = message || `Your prescription is due for a refill. Please visit us soon or use our app to schedule a pickup.`;

  // Mock sending reminder
  const reminderResult = {
    reminderId: `rem_${Date.now()}`,
    customerId,
    prescriptionId,
    channel,
    message: reminderMessage,
    status: 'pending' as const,
    scheduledAt: new Date(),
    sentAt: null as Date | null,
  };

  logger.info('Refill reminder sent', {
    reminderId: reminderResult.reminderId,
    customerId,
    prescriptionId,
    channel,
  });

  res.status(200).json({
    success: true,
    data: {
      reminder: reminderResult,
      message: `Reminder scheduled via ${channel}`,
    },
  });
}));

/**
 * GET /api/refill/customer/:customerId
 * Get refill history for a customer
 */
router.get('/customer/:customerId', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  // Mock refill history
  const refillHistory = [
    {
      refillId: 'ref_001',
      prescriptionId: 'rx_001',
      drugName: 'Lisinopril 10mg',
      filledAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      daysSupply: 30,
      adherenceScore: 0.95,
    },
    {
      refillId: 'ref_002',
      prescriptionId: 'rx_001',
      drugName: 'Lisinopril 10mg',
      filledAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
      daysSupply: 30,
      adherenceScore: 0.92,
    },
    {
      refillId: 'ref_003',
      prescriptionId: 'rx_001',
      drugName: 'Lisinopril 10mg',
      filledAt: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000),
      daysSupply: 30,
      adherenceScore: 0.88,
    },
  ];

  // Calculate adherence metrics
  const adherenceMetrics = {
    avgAdherence: refillHistory.reduce((sum, r) => sum + r.adherenceScore, 0) / refillHistory.length,
    totalRefills: refillHistory.length,
    gapDays: [] as number[],
  };

  // Calculate gaps between refills
  for (let i = 1; i < refillHistory.length; i++) {
    const gap = Math.abs(
      new Date(refillHistory[i - 1].filledAt).getTime() -
      new Date(refillHistory[i].filledAt).getTime()
    ) / (24 * 60 * 60 * 1000);
    adherenceMetrics.gapDays.push(gap);
  }

  res.status(200).json({
    success: true,
    data: {
      refillHistory,
      adherenceMetrics,
      customerId,
    },
  });
}));

/**
 * POST /api/refill/batch-reminder
 * Send batch refill reminders
 */
router.post('/batch-reminder', asyncHandler(async (req: Request, res: Response) => {
  const batchSchema = z.object({
    merchantId: z.string().min(1),
    customerIds: z.array(z.string().min(1)).min(1).max(100),
    channel: z.enum(['sms', 'email', 'whatsapp', 'push']),
    message: z.string().optional(),
    urgencyFilter: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  });

  const validation = batchSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const { merchantId, customerIds, channel, message, urgencyFilter } = validation.data;

  // Mock batch reminder results
  const results = {
    total: customerIds.length,
    successful: customerIds.length,
    failed: 0,
    reminders: customerIds.map(id => ({
      reminderId: `rem_${Date.now()}_${id}`,
      customerId: id,
      status: 'pending' as const,
      scheduledAt: new Date(),
    })),
  };

  logger.info('Batch refill reminders scheduled', {
    merchantId,
    totalReminders: results.total,
    channel,
    urgencyFilter,
  });

  res.status(200).json({
    success: true,
    data: results,
    message: `Scheduled ${results.total} reminders via ${channel}`,
  });
}));

export default router;
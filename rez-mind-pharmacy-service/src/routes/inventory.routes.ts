import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AlertSeverity, DrugCategory } from '../types';
import { INVENTORY_RULES } from '../config/knowledge';

const router = Router();

// Validation schemas
const predictDemandSchema = z.object({
  merchantId: z.string().min(1),
  drugIds: z.array(z.string()).optional(),
  forecastPeriodDays: z.number().int().min(1).max(365).optional().default(30),
});

/**
 * GET /api/inventory/expiring/:merchantId
 * Get medications expiring soon
 */
router.get('/expiring/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { daysBeforeExpiry = 60, limit = 50, offset = 0 } = req.query;

  // In production, this would query the actual inventory service
  // For now, returning mock data structure
  const expiringItems = [
    {
      drugId: 'drug_001',
      drugName: 'Amoxicillin 500mg',
      category: DrugCategory.ANTIBIOTIC,
      currentStock: 50,
      batchNumber: 'BATCH2024001',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 30,
      urgency: AlertSeverity.HIGH,
      recommendation: 'Use FIFO. Consider promotional pricing.',
      estimatedWasteValue: 25.00,
    },
    {
      drugId: 'drug_002',
      drugName: 'Lisinopril 10mg',
      category: DrugCategory.ANTIHYPERTENSIVE,
      currentStock: 100,
      batchNumber: 'BATCH2024002',
      expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 45,
      urgency: AlertSeverity.MEDIUM,
      recommendation: 'Monitor sales velocity. May need mark-down if slow.',
      estimatedWasteValue: 50.00,
    },
  ];

  // Calculate totals
  const totalEstimatedWaste = expiringItems.reduce(
    (sum, item) => sum + (item.estimatedWasteValue || 0),
    0
  );

  logger.info('Retrieved expiring inventory', {
    merchantId,
    itemCount: expiringItems.length,
    totalEstimatedWaste,
  });

  res.status(200).json({
    success: true,
    data: {
      expiringItems,
      summary: {
        count: expiringItems.length,
        totalEstimatedWaste,
        byUrgency: {
          HIGH: expiringItems.filter(i => i.urgency === AlertSeverity.HIGH).length,
          MEDIUM: expiringItems.filter(i => i.urgency === AlertSeverity.MEDIUM).length,
          LOW: expiringItems.filter(i => i.urgency === AlertSeverity.LOW).length,
        },
      },
      expiryThresholds: INVENTORY_RULES.expiry_thresholds,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        hasMore: false,
      },
    },
  });
}));

/**
 * GET /api/inventory/out-of-stock/:merchantId
 * Get stock alerts and reorder recommendations
 */
router.get('/out-of-stock/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { daysOfSupply = 14 } = req.query;

  // Mock data - would query actual inventory service
  const stockAlerts = [
    {
      drugId: 'drug_010',
      drugName: 'Metformin 500mg',
      category: DrugCategory.DIABETIC,
      currentStock: 0,
      reorderPoint: 100,
      maxStock: 500,
      daysOfSupply: 0,
      urgency: AlertSeverity.CRITICAL,
      recommendation: 'URGENT: Contact supplier immediately. Consider emergency procurement.',
      estimatedDailyDemand: 20,
      leadTimeDays: 3,
    },
    {
      drugId: 'drug_011',
      drugName: 'Atorvastatin 20mg',
      category: DrugCategory.CARDIOVASCULAR,
      currentStock: 15,
      reorderPoint: 50,
      maxStock: 300,
      daysOfSupply: 3,
      urgency: AlertSeverity.HIGH,
      recommendation: 'Reorder within 24 hours to maintain stock levels.',
      estimatedDailyDemand: 5,
      leadTimeDays: 5,
    },
  ];

  // Calculate reorder recommendations
  const reorderRecommendations = stockAlerts
    .filter(item => item.currentStock <= item.reorderPoint)
    .map(item => ({
      drugId: item.drugId,
      drugName: item.drugName,
      recommendedOrderQuantity: item.maxStock - item.currentStock,
      urgency: item.urgency,
      estimatedCost: (item.maxStock - item.currentStock) * 0.50, // Placeholder price
    }));

  logger.info('Retrieved out-of-stock alerts', {
    merchantId,
    alertCount: stockAlerts.length,
    reorderCount: reorderRecommendations.length,
  });

  res.status(200).json({
    success: true,
    data: {
      stockAlerts,
      reorderRecommendations,
      summary: {
        criticalCount: stockAlerts.filter(i => i.urgency === AlertSeverity.CRITICAL).length,
        highCount: stockAlerts.filter(i => i.urgency === AlertSeverity.HIGH).length,
        totalReorderCost: reorderRecommendations.reduce(
          (sum, r) => sum + (r.estimatedCost || 0),
          0
        ),
      },
      reorderPoints: INVENTORY_RULES.reorder_points,
    },
  });
}));

/**
 * POST /api/inventory/predict-demand
 * Predict inventory demand
 */
router.post('/predict-demand', asyncHandler(async (req: Request, res: Response) => {
  const validation = predictDemandSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.errors,
      },
    });
    return;
  }

  const { merchantId, drugIds, forecastPeriodDays } = validation.data;

  // Mock demand predictions
  const demandForecasts = [
    {
      drugId: 'drug_001',
      drugName: 'Amoxicillin 500mg',
      category: DrugCategory.ANTIBIOTIC,
      currentStock: 50,
      predictedDemand: 180,
      daysOfSupply: 8,
      reorderPoint: 100,
      recommendedOrderQuantity: 200,
      confidenceInterval: {
        lower: 150,
        upper: 210,
      },
      trend: 'stable',
      seasonality: {
        factor: 1.1,
        peakMonths: ['october', 'november', 'december'],
      },
    },
    {
      drugId: 'drug_005',
      drugName: 'Ibuprofen 400mg',
      category: DrugCategory.ANALGESIC,
      currentStock: 200,
      predictedDemand: 300,
      daysOfSupply: 20,
      reorderPoint: 150,
      recommendedOrderQuantity: 250,
      confidenceInterval: {
        lower: 270,
        upper: 330,
      },
      trend: 'increasing',
      seasonality: {
        factor: 1.3,
        peakMonths: ['january', 'february'],
      },
    },
  ];

  logger.info('Generated demand predictions', {
    merchantId,
    forecastPeriodDays,
    itemCount: demandForecasts.length,
  });

  res.status(200).json({
    success: true,
    data: {
      forecasts: demandForecasts,
      parameters: {
        merchantId,
        forecastPeriodDays,
        generatedAt: new Date(),
      },
    },
  });
}));

/**
 * GET /api/inventory/waste-analysis/:merchantId
 * Analyze inventory waste and suggest reductions
 */
router.get('/waste-analysis/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  // Mock waste analysis
  const wasteAnalysis = {
    totalExpiredValue: 1250.00,
    totalExpiringSoonValue: 2500.00,
    wasteByCategory: {
      ANTIBIOTIC: { count: 15, value: 450.00 },
      ANALGESIC: { count: 12, value: 380.00 },
      ANTIHYPERTENSIVE: { count: 8, value: 420.00 },
    },
    recommendations: [
      'Implement FIFO dispensing strictly',
      'Review seasonal demand patterns for better ordering',
      'Consider reducing order quantities for slow-moving items',
      'Partner with suppliers for return policies on near-expiry items',
      'Implement expiry tracking alerts at 90/60/30 days',
    ],
  };

  res.status(200).json({
    success: true,
    data: wasteAnalysis,
  });
}));

export default router;
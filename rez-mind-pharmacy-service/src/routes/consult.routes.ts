import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { PharmacyMindSession } from '../models';
import { pharmacyIntelligence } from '../services/pharmacyIntelligence';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { SessionType, DrugCategory } from '../types';

const router = Router();

// Validation schemas
const consultSchema = z.object({
  merchantId: z.string().min(1),
  pharmacistId: z.string().optional(),
  patientId: z.string().optional(),
  drugs: z.array(z.object({
    drugId: z.string().min(1),
    name: z.string().min(1),
    category: z.nativeEnum(DrugCategory),
    dosage: z.string().min(1),
  })).optional(),
  request: z.enum(['interaction_check', 'refill_reminder', 'compliance', 'inventory']),
  prescriptionId: z.string().optional(),
  customerProfile: z.object({
    customerId: z.string(),
    conditions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * POST /api/consult
 * AI pharmacy consultation endpoint
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validation = consultSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', validation.error.errors);
  }

  const {
    merchantId,
    pharmacistId,
    patientId,
    drugs,
    request: requestType,
    prescriptionId,
    customerProfile,
  } = validation.data;

  logger.info('Processing pharmacy consultation', {
    merchantId,
    pharmacistId,
    patientId,
    requestType,
    prescriptionId,
  });

  // Determine session type based on request
  const sessionTypeMap: Record<string, SessionType> = {
    interaction_check: SessionType.INTERACTION_CHECK,
    refill_reminder: SessionType.CONSULT,
    compliance: SessionType.PRESCRIPTION_ANALYSIS,
    inventory: SessionType.INVENTORY,
  };

  // Process based on request type
  let analysis;
  let recommendations: string[] = [];
  let alerts: any[] = [];

  try {
    switch (requestType) {
      case 'interaction_check':
        if (drugs && drugs.length >= 2) {
          const drugIds = drugs.map(d => d.drugId);
          const interactionResult = await pharmacyIntelligence.checkInteractions(drugIds);
          analysis = {
            interactions: interactionResult.interactions,
          };
          recommendations = interactionResult.recommendations;
        }
        break;

      case 'compliance':
        analysis = await pharmacyIntelligence.analyzePrescription({
          prescriptionId: prescriptionId || '',
          patientId: patientId || '',
          drugs: drugs || [],
        } as any);
        break;

      case 'inventory':
        const inventoryResult = await pharmacyIntelligence.optimizeInventory(merchantId);
        analysis = {
          inventoryAlerts: inventoryResult,
        };
        break;

      case 'refill_reminder':
        if (customerProfile?.customerId) {
          const refillPredictions = await pharmacyIntelligence.predictRefills(customerProfile.customerId);
          analysis = {
            recommendations: refillPredictions.map(p =>
              `Customer ${customerProfile.customerId} needs refill for ${p.drugName} by ${p.predictedRefillDate.toLocaleDateString()}`
            ),
          };
        }
        break;

      default:
        analysis = {};
    }
  } catch (error) {
    logger.error('Error processing consultation', { error, merchantId, requestType });
    // Continue with empty analysis - don't fail the request
    analysis = {};
  }

  // Calculate confidence based on data availability
  let confidence = 0.5;
  if (drugs && drugs.length > 0) confidence += 0.1;
  if (customerProfile) confidence += 0.2;
  if (prescriptionId) confidence += 0.1;
  confidence = Math.min(confidence, 0.95);

  // Create session
  const sessionId = uuidv4();
  const session = new PharmacyMindSession({
    sessionId,
    merchantId,
    pharmacistId,
    patientId,
    sessionType: sessionTypeMap[requestType] || SessionType.CONSULT,
    context: {
      drugs,
      prescriptionId,
      customerProfile: customerProfile ? {
        customerId: customerProfile.customerId,
        conditions: customerProfile.conditions || [],
        allergies: customerProfile.allergies || [],
      } : undefined,
    },
    analysis: analysis || {},
    recommendations,
    confidence,
  });

  await session.save();

  logger.info('Consultation session created', {
    sessionId,
    merchantId,
    sessionType: requestType,
    confidence,
  });

  res.status(201).json({
    success: true,
    data: {
      sessionId,
      analysis,
      recommendations,
      alerts,
      confidence,
    },
  });
}));

/**
 * GET /api/consult/:sessionId
 * Retrieve consultation session by ID
 */
router.get('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = await PharmacyMindSession.findOne({ sessionId }).lean();

  if (!session) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `Consultation session with ID '${sessionId}' not found`,
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: session,
  });
}));

/**
 * GET /api/consult/merchant/:merchantId
 * Retrieve consultation sessions for a merchant
 */
router.get('/merchant/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { limit = 20, offset = 0, sessionType } = req.query;

  const query: any = { merchantId };
  if (sessionType) {
    query.sessionType = sessionType;
  }

  const sessions = await PharmacyMindSession.find(query)
    .sort({ createdAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .lean();

  const total = await PharmacyMindSession.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      sessions,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + sessions.length < total,
      },
    },
  });
}));

export default router;
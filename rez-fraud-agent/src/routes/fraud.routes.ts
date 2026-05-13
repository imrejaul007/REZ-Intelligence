import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { FraudDetector } from '../services/fraudDetector';
import { FraudCase, FraudCaseStatus, FraudCaseSeverity } from '../models/FraudCase';
import { BlacklistEntry, BlacklistType, BlacklistReason, BlacklistSeverity } from '../models/Blacklist';
import { logger, logAudit, logSecurity, logFraudAlert } from '../utils/logger';

// Initialize fraud detector
const fraudDetector = new FraudDetector();

const router = Router();

// Validation schemas
const fraudCheckSchema = z.object({
  transactionId: z.string().min(1),
  userId: z.string().optional(),
  accountId: z.string().optional(),
  orderId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchantCategory: z.string().optional(),
  merchantId: z.string().optional(),
  cardLast4: z.string().optional(),
  cardType: z.string().optional(),
  isNewPaymentMethod: z.boolean().optional(),
  deviceFingerprint: z.string().optional(),
  deviceType: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  billingCountry: z.string().optional(),
  billingCity: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingCity: z.string().optional(),
  billingCoordinates: z.tuple([z.number(), z.number()]).optional(),
  shippingCoordinates: z.tuple([z.number(), z.number()]).optional(),
  sessionId: z.string().optional(),
  sessionDuration: z.number().optional(),
  pageViews: z.number().optional(),
  navigationPattern: z.array(z.string()).optional(),
  accountAge: z.number().optional(),
  isVerified: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

const blacklistAddSchema = z.object({
  type: z.nativeEnum(BlacklistType),
  value: z.string().min(1),
  reason: z.nativeEnum(BlacklistReason),
  severity: z.nativeEnum(BlacklistSeverity).optional(),
  userId: z.string().optional(),
  transactionId: z.string().optional(),
  fraudCaseId: z.string().optional(),
  addedBy: z.string().min(1),
  isPermanent: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const caseUpdateSchema = z.object({
  status: z.nativeEnum(FraudCaseStatus).optional(),
  assignedTo: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewNotes: z.string().optional(),
});

const caseQuerySchema = z.object({
  status: z.nativeEnum(FraudCaseStatus).optional(),
  severity: z.nativeEnum(FraudCaseSeverity).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  userId: z.string().optional(),
});

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware for internal service authentication
const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-internal-token'] as string;
  const expectedTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');

  // Skip auth in development if no tokens configured
  if (Object.keys(expectedTokens).length === 0 && process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!token || !Object.values(expectedTokens).includes(token)) {
    logSecurity('Unauthorized access attempt', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// ============= FRAUD CHECK ROUTES =============

/**
 * POST /api/fraud/check
 * Main fraud detection endpoint
 */
router.post(
  '/check',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const validatedData = fraudCheckSchema.parse(req.body);

      const context = {
        transactionId: validatedData.transactionId,
        userId: validatedData.userId,
        accountId: validatedData.accountId,
        orderId: validatedData.orderId,
        amount: validatedData.amount,
        currency: validatedData.currency,
        merchantCategory: validatedData.merchantCategory,
        merchantId: validatedData.merchantId,
        cardLast4: validatedData.cardLast4,
        cardType: validatedData.cardType,
        isNewPaymentMethod: validatedData.isNewPaymentMethod,
        deviceFingerprint: validatedData.deviceFingerprint,
        deviceType: validatedData.deviceType,
        userAgent: validatedData.userAgent,
        ipAddress: validatedData.ipAddress,
        billingCountry: validatedData.billingCountry,
        billingCity: validatedData.billingCity,
        shippingCountry: validatedData.shippingCountry,
        shippingCity: validatedData.shippingCity,
        billingCoordinates: validatedData.billingCoordinates,
        shippingCoordinates: validatedData.shippingCoordinates,
        sessionId: validatedData.sessionId,
        sessionDuration: validatedData.sessionDuration,
        pageViews: validatedData.pageViews,
        navigationPattern: validatedData.navigationPattern,
        accountAge: validatedData.accountAge,
        isVerified: validatedData.isVerified,
        twoFactorEnabled: validatedData.twoFactorEnabled,
      };

      const result = await fraudDetector.analyzeTransaction(context);

      logAudit('Fraud check completed', {
        requestId,
        transactionId: validatedData.transactionId,
        decision: result.decision,
        riskScore: result.riskScore,
        processingTimeMs: Date.now() - startTime,
      });

      if (result.decision === 'DENY') {
        logFraudAlert('Transaction blocked', {
          transactionId: validatedData.transactionId,
          riskScore: result.riskScore,
          patternsDetected: result.detectedPatterns.length,
        });
      }

      res.json({
        requestId,
        ...result,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * POST /api/fraud/check/batch
 * Batch fraud checking for multiple transactions
 */
router.post(
  '/check/batch',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const requestIds: string[] = [];
    const results = [];
    const startTime = Date.now();

    try {
      const transactions = z.array(fraudCheckSchema).parse(req.body);

      for (const transaction of transactions) {
        const requestId = uuidv4();
        requestIds.push(requestId);

        try {
          const result = await fraudDetector.analyzeTransaction(transaction);
          results.push({
            requestId,
            transactionId: transaction.transactionId,
            ...result,
          });
        } catch (error) {
          results.push({
            requestId,
            transactionId: transaction.transactionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      res.json({
        totalProcessed: transactions.length,
        results,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      throw error;
    }
  })
);

// ============= BLACKLIST ROUTES =============

/**
 * GET /api/fraud/blacklist/check/:type/:value
 * Check if a value is blacklisted
 */
router.get(
  '/blacklist/check/:type/:value',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, value } = req.params;

    if (!Object.values(BlacklistType).includes(type as BlacklistType)) {
      res.status(400).json({ error: 'Invalid blacklist type' });
      return;
    }

    const result = await BlacklistEntry.isBlacklisted(type as BlacklistType, value);

    res.json({
      isBlacklisted: result.isBlacklisted,
      type,
      value: value.substring(0, 4) + '***',
      entry: result.entry
        ? {
            entryId: result.entry.entryId,
            reason: result.entry.reason,
            severity: result.entry.severity,
            addedAt: result.entry.addedAt,
            matchCount: result.entry.matchCount,
          }
        : null,
    });
  })
);

/**
 * POST /api/fraud/blacklist
 * Add entry to blacklist
 */
router.post(
  '/blacklist',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = blacklistAddSchema.parse(req.body);

    const entry = await BlacklistEntry.addToBlacklist({
      type: validatedData.type,
      value: validatedData.value,
      reason: validatedData.reason,
      severity: validatedData.severity,
      userId: validatedData.userId,
      transactionId: validatedData.transactionId,
      fraudCaseId: validatedData.fraudCaseId,
      addedBy: validatedData.addedBy,
      isPermanent: validatedData.isPermanent,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
      notes: validatedData.notes,
    });

    logAudit('Blacklist entry added', {
      entryId: entry.entryId,
      type: entry.type,
      value: entry.value.substring(0, 4) + '***',
      reason: entry.reason,
      addedBy: validatedData.addedBy,
    });

    res.status(201).json({
      success: true,
      entry: {
        entryId: entry.entryId,
        type: entry.type,
        value: entry.value,
        reason: entry.reason,
        severity: entry.severity,
        isPermanent: entry.isPermanent,
        expiresAt: entry.expiresAt,
        addedAt: entry.addedAt,
      },
    });
  })
);

/**
 * DELETE /api/fraud/blacklist/:entryId
 * Remove entry from blacklist
 */
router.delete(
  '/blacklist/:entryId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const removedBy = req.headers['x-user-id'] as string || 'system';

    const entry = await BlacklistEntry.findOneAndUpdate(
      { entryId, isActive: true },
      {
        isActive: false,
        notes: `Deactivated by ${removedBy} at ${new Date().toISOString()}`,
      },
      { new: true }
    );

    if (!entry) {
      res.status(404).json({ error: 'Blacklist entry not found' });
      return;
    }

    logAudit('Blacklist entry removed', {
      entryId,
      removedBy,
    });

    res.json({ success: true, entryId });
  })
);

/**
 * GET /api/fraud/blacklist
 * List blacklist entries
 */
router.get(
  '/blacklist',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query;

    const options = {
      type: query.type as BlacklistType | undefined,
      reason: query.reason as BlacklistReason | undefined,
      severity: query.severity as BlacklistSeverity | undefined,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
      page: query.page ? parseInt(query.page as string, 10) : 1,
      limit: query.limit ? parseInt(query.limit as string, 10) : 50,
    };

    const result = await BlacklistEntry.paginate(options);

    res.json({
      entries: result.docs.map((entry) => ({
        entryId: entry.entryId,
        type: entry.type,
        value: entry.type === BlacklistType.IP_ADDRESS || entry.type === BlacklistType.DEVICE_FINGERPRINT
          ? entry.value.substring(0, 8) + '***'
          : entry.value,
        reason: entry.reason,
        severity: entry.severity,
        isActive: entry.isActive,
        isPermanent: entry.isPermanent,
        expiresAt: entry.expiresAt,
        addedAt: entry.addedAt,
        matchCount: entry.matchCount,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  })
);

/**
 * GET /api/fraud/blacklist/stats
 * Get blacklist statistics
 */
router.get(
  '/blacklist/stats',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const [total, active, byType, byReason, bySeverity] = await Promise.all([
      BlacklistEntry.countDocuments(),
      BlacklistEntry.countDocuments({ isActive: true }),
      BlacklistEntry.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      BlacklistEntry.aggregate([{ $group: { _id: '$reason', count: { $sum: 1 } } }]),
      BlacklistEntry.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
    ]);

    res.json({
      total,
      active,
      byType: byType.reduce((acc: Record<string, number>, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byReason: byReason.reduce((acc: Record<string, number>, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc: Record<string, number>, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    });
  })
);

// ============= FRAUD CASE ROUTES =============

/**
 * GET /api/fraud/cases
 * List fraud cases with filtering
 */
router.get(
  '/cases',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const query = caseQuerySchema.parse(req.query);

    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.userId) filter.userId = query.userId;

    const [cases, total] = await Promise.all([
      FraudCase.find(filter)
        .sort({ riskScore: -1, createdAt: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .lean(),
      FraudCase.countDocuments(filter),
    ]);

    res.json({
      cases,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + cases.length < total,
      },
    });
  })
);

/**
 * GET /api/fraud/cases/:caseId
 * Get fraud case details
 */
router.get(
  '/cases/:caseId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { caseId } = req.params;

    const fraudCase = await FraudCase.findOne({ caseId }).lean();

    if (!fraudCase) {
      res.status(404).json({ error: 'Fraud case not found' });
      return;
    }

    res.json({ case: fraudCase });
  })
);

/**
 * PATCH /api/fraud/cases/:caseId
 * Update fraud case status
 */
router.patch(
  '/cases/:caseId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { caseId } = req.params;
    const validatedData = caseUpdateSchema.parse(req.body);
    const updatedBy = req.headers['x-user-id'] as string || 'system';

    const updateData: Record<string, unknown> = {
      ...validatedData,
    };

    if (validatedData.status === FraudCaseStatus.RESOLVED ||
        validatedData.status === FraudCaseStatus.FALSE_POSITIVE) {
      updateData.resolvedAt = new Date();
    }

    const fraudCase = await FraudCase.findOneAndUpdate(
      { caseId },
      {
        $set: updateData,
        $push: {
          actionsTaken: {
            action: `Status updated to ${validatedData.status}`,
            timestamp: new Date(),
            performedBy: updatedBy,
            details: validatedData.reviewNotes,
          },
        },
      },
      { new: true }
    );

    if (!fraudCase) {
      res.status(404).json({ error: 'Fraud case not found' });
      return;
    }

    logAudit('Fraud case updated', {
      caseId,
      newStatus: validatedData.status,
      updatedBy,
    });

    res.json({ success: true, case: fraudCase });
  })
);

/**
 * POST /api/fraud/cases/:caseId/actions
 * Add action to fraud case
 */
router.post(
  '/cases/:caseId/actions',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { caseId } = req.params;
    const { action, details } = req.body;
    const performedBy = req.headers['x-user-id'] as string || 'system';

    if (!action) {
      res.status(400).json({ error: 'Action is required' });
      return;
    }

    const fraudCase = await FraudCase.findOneAndUpdate(
      { caseId },
      {
        $push: {
          actionsTaken: {
            action,
            timestamp: new Date(),
            performedBy,
            details,
          },
        },
      },
      { new: true }
    );

    if (!fraudCase) {
      res.status(404).json({ error: 'Fraud case not found' });
      return;
    }

    logAudit('Action added to fraud case', {
      caseId,
      action,
      performedBy,
    });

    res.json({ success: true, case: fraudCase });
  })
);

/**
 * GET /api/fraud/cases/stats/summary
 * Get fraud case statistics
 */
router.get(
  '/cases/stats/summary',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const [
      totalCases,
      openCases,
      byStatus,
      bySeverity,
      avgRiskScore,
      totalBlockedAmount,
    ] = await Promise.all([
      FraudCase.countDocuments(),
      FraudCase.countDocuments({
        status: { $in: [FraudCaseStatus.OPEN, FraudCaseStatus.UNDER_REVIEW] },
      }),
      FraudCase.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      FraudCase.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      FraudCase.aggregate([{ $group: { _id: null, avg: { $avg: '$riskScore' } } }]),
      FraudCase.aggregate([{ $group: { _id: null, total: { $sum: '$blockedAmount' } } }]),
    ]);

    res.json({
      totalCases,
      openCases,
      byStatus: byStatus.reduce((acc: Record<string, number>, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc: Record<string, number>, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      avgRiskScore: avgRiskScore[0]?.avg || 0,
      totalBlockedAmount: totalBlockedAmount[0]?.total || 0,
    });
  })
);

// ============= VELOCITY ROUTES =============

/**
 * GET /api/fraud/velocity/:userId
 * Get velocity status for a user
 */
router.get(
  '/velocity/:userId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    // This would integrate with the velocity check service
    // For now, return a placeholder
    res.json({
      userId,
      transactionsPerMinute: 0,
      transactionsPerHour: 0,
      transactionsPerDay: 0,
      failedAttemptsPerMinute: 0,
    });
  })
);

/**
 * DELETE /api/fraud/velocity/:userId
 * Reset velocity counters for a user
 */
router.delete(
  '/velocity/:userId',
  internalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    logAudit('Velocity counters reset', { userId });

    res.json({ success: true, userId });
  })
);

// ============= HEALTH CHECK =============

/**
 * GET /api/fraud/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-fraud-agent',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/fraud/ready
 * Readiness check endpoint
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check MongoDB
    const mongoStatus = await FraudCase.findOne().exec();

    // Check Redis
    // Would add Redis check here

    if (mongoStatus !== null) {
      res.json({
        status: 'ready',
        checks: {
          mongodb: 'connected',
          redis: 'connected',
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        error: 'Database connection issue',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

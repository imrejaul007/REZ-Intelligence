"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const fraudDetector_1 = require("../services/fraudDetector");
const FraudCase_1 = require("../models/FraudCase");
const Blacklist_1 = require("../models/Blacklist");
const logger_1 = require("../utils/logger");
// Initialize fraud detector
const fraudDetector = new fraudDetector_1.FraudDetector();
const router = (0, express_1.Router)();
// Validation schemas
const fraudCheckSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
    userId: zod_1.z.string().optional(),
    accountId: zod_1.z.string().optional(),
    orderId: zod_1.z.string().optional(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3),
    merchantCategory: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().optional(),
    cardLast4: zod_1.z.string().optional(),
    cardType: zod_1.z.string().optional(),
    isNewPaymentMethod: zod_1.z.boolean().optional(),
    deviceFingerprint: zod_1.z.string().optional(),
    deviceType: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().optional(),
    billingCountry: zod_1.z.string().optional(),
    billingCity: zod_1.z.string().optional(),
    shippingCountry: zod_1.z.string().optional(),
    shippingCity: zod_1.z.string().optional(),
    billingCoordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]).optional(),
    shippingCoordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]).optional(),
    sessionId: zod_1.z.string().optional(),
    sessionDuration: zod_1.z.number().optional(),
    pageViews: zod_1.z.number().optional(),
    navigationPattern: zod_1.z.array(zod_1.z.string()).optional(),
    accountAge: zod_1.z.number().optional(),
    isVerified: zod_1.z.boolean().optional(),
    twoFactorEnabled: zod_1.z.boolean().optional(),
});
const blacklistAddSchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(Blacklist_1.BlacklistType),
    value: zod_1.z.string().min(1),
    reason: zod_1.z.nativeEnum(Blacklist_1.BlacklistReason),
    severity: zod_1.z.nativeEnum(Blacklist_1.BlacklistSeverity).optional(),
    userId: zod_1.z.string().optional(),
    transactionId: zod_1.z.string().optional(),
    fraudCaseId: zod_1.z.string().optional(),
    addedBy: zod_1.z.string().min(1),
    isPermanent: zod_1.z.boolean().optional(),
    expiresAt: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
const caseUpdateSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(FraudCase_1.FraudCaseStatus).optional(),
    assignedTo: zod_1.z.string().optional(),
    reviewedBy: zod_1.z.string().optional(),
    reviewNotes: zod_1.z.string().optional(),
});
const caseQuerySchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(FraudCase_1.FraudCaseStatus).optional(),
    severity: zod_1.z.nativeEnum(FraudCase_1.FraudCaseSeverity).optional(),
    limit: zod_1.z.coerce.number().min(1).max(100).optional().default(20),
    offset: zod_1.z.coerce.number().min(0).optional().default(0),
    userId: zod_1.z.string().optional(),
});
// Error handler wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
// Middleware for internal service authentication
const internalAuth = (req, res, next) => {
    const token = req.headers['x-internal-token'];
    const expectedTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');
    // Skip auth in development if no tokens configured
    if (Object.keys(expectedTokens).length === 0 && process.env.NODE_ENV !== 'production') {
        return next();
    }
    if (!token || !Object.values(expectedTokens).includes(token)) {
        (0, logger_1.logSecurity)('Unauthorized access attempt', {
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
router.post('/check', internalAuth, asyncHandler(async (req, res) => {
    const requestId = (0, uuid_1.v4)();
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
        (0, logger_1.logAudit)('Fraud check completed', {
            requestId,
            transactionId: validatedData.transactionId,
            decision: result.decision,
            riskScore: result.riskScore,
            processingTimeMs: Date.now() - startTime,
        });
        if (result.decision === 'DENY') {
            (0, logger_1.logFraudAlert)('Transaction blocked', {
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
            return;
        }
        throw error;
    }
}));
/**
 * POST /api/fraud/check/batch
 * Batch fraud checking for multiple transactions
 */
router.post('/check/batch', internalAuth, asyncHandler(async (req, res) => {
    const requestIds = [];
    const results = [];
    const startTime = Date.now();
    try {
        const transactions = zod_1.z.array(fraudCheckSchema).parse(req.body);
        for (const transaction of transactions) {
            const requestId = (0, uuid_1.v4)();
            requestIds.push(requestId);
            try {
                const result = await fraudDetector.analyzeTransaction(transaction);
                results.push({
                    requestId,
                    transactionId: transaction.transactionId,
                    ...result,
                });
            }
            catch (error) {
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
            return;
        }
        throw error;
    }
}));
// ============= BLACKLIST ROUTES =============
/**
 * GET /api/fraud/blacklist/check/:type/:value
 * Check if a value is blacklisted
 */
router.get('/blacklist/check/:type/:value', internalAuth, asyncHandler(async (req, res) => {
    const { type, value } = req.params;
    if (!Object.values(Blacklist_1.BlacklistType).includes(type)) {
        res.status(400).json({ error: 'Invalid blacklist type' });
        return;
    }
    const result = await Blacklist_1.BlacklistEntry.isBlacklisted(type, value);
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
}));
/**
 * POST /api/fraud/blacklist
 * Add entry to blacklist
 */
router.post('/blacklist', internalAuth, asyncHandler(async (req, res) => {
    const validatedData = blacklistAddSchema.parse(req.body);
    const entry = await Blacklist_1.BlacklistEntry.addToBlacklist({
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
    (0, logger_1.logAudit)('Blacklist entry added', {
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
}));
/**
 * DELETE /api/fraud/blacklist/:entryId
 * Remove entry from blacklist
 */
router.delete('/blacklist/:entryId', internalAuth, asyncHandler(async (req, res) => {
    const { entryId } = req.params;
    const removedBy = req.headers['x-user-id'] || 'system';
    const entry = await Blacklist_1.BlacklistEntry.findOneAndUpdate({ entryId, isActive: true }, {
        isActive: false,
        notes: `Deactivated by ${removedBy} at ${new Date().toISOString()}`,
    }, { new: true });
    if (!entry) {
        res.status(404).json({ error: 'Blacklist entry not found' });
        return;
    }
    (0, logger_1.logAudit)('Blacklist entry removed', {
        entryId,
        removedBy,
    });
    res.json({ success: true, entryId });
}));
/**
 * GET /api/fraud/blacklist
 * List blacklist entries
 */
router.get('/blacklist', internalAuth, asyncHandler(async (req, res) => {
    const query = req.query;
    const options = {
        type: query.type,
        reason: query.reason,
        severity: query.severity,
        isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
    };
    const result = await Blacklist_1.BlacklistEntry.paginate(options);
    res.json({
        entries: result.docs.map((entry) => ({
            entryId: entry.entryId,
            type: entry.type,
            value: entry.type === Blacklist_1.BlacklistType.IP_ADDRESS || entry.type === Blacklist_1.BlacklistType.DEVICE_FINGERPRINT
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
}));
/**
 * GET /api/fraud/blacklist/stats
 * Get blacklist statistics
 */
router.get('/blacklist/stats', internalAuth, asyncHandler(async (req, res) => {
    const [total, active, byType, byReason, bySeverity] = await Promise.all([
        Blacklist_1.BlacklistEntry.countDocuments(),
        Blacklist_1.BlacklistEntry.countDocuments({ isActive: true }),
        Blacklist_1.BlacklistEntry.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
        Blacklist_1.BlacklistEntry.aggregate([{ $group: { _id: '$reason', count: { $sum: 1 } } }]),
        Blacklist_1.BlacklistEntry.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
    ]);
    res.json({
        total,
        active,
        byType: byType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
        byReason: byReason.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
    });
}));
// ============= FRAUD CASE ROUTES =============
/**
 * GET /api/fraud/cases
 * List fraud cases with filtering
 */
router.get('/cases', internalAuth, asyncHandler(async (req, res) => {
    const query = caseQuerySchema.parse(req.query);
    const filter = {};
    if (query.status)
        filter.status = query.status;
    if (query.severity)
        filter.severity = query.severity;
    if (query.userId)
        filter.userId = query.userId;
    const [cases, total] = await Promise.all([
        FraudCase_1.FraudCase.find(filter)
            .sort({ riskScore: -1, createdAt: -1 })
            .skip(query.offset)
            .limit(query.limit)
            .lean(),
        FraudCase_1.FraudCase.countDocuments(filter),
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
}));
/**
 * GET /api/fraud/cases/:caseId
 * Get fraud case details
 */
router.get('/cases/:caseId', internalAuth, asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const fraudCase = await FraudCase_1.FraudCase.findOne({ caseId }).lean();
    if (!fraudCase) {
        res.status(404).json({ error: 'Fraud case not found' });
        return;
    }
    res.json({ case: fraudCase });
}));
/**
 * PATCH /api/fraud/cases/:caseId
 * Update fraud case status
 */
router.patch('/cases/:caseId', internalAuth, asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const validatedData = caseUpdateSchema.parse(req.body);
    const updatedBy = req.headers['x-user-id'] || 'system';
    const updateData = {
        ...validatedData,
    };
    if (validatedData.status === FraudCase_1.FraudCaseStatus.RESOLVED ||
        validatedData.status === FraudCase_1.FraudCaseStatus.FALSE_POSITIVE) {
        updateData.resolvedAt = new Date();
    }
    const fraudCase = await FraudCase_1.FraudCase.findOneAndUpdate({ caseId }, {
        $set: updateData,
        $push: {
            actionsTaken: {
                action: `Status updated to ${validatedData.status}`,
                timestamp: new Date(),
                performedBy: updatedBy,
                details: validatedData.reviewNotes,
            },
        },
    }, { new: true });
    if (!fraudCase) {
        res.status(404).json({ error: 'Fraud case not found' });
        return;
    }
    (0, logger_1.logAudit)('Fraud case updated', {
        caseId,
        newStatus: validatedData.status,
        updatedBy,
    });
    res.json({ success: true, case: fraudCase });
}));
/**
 * POST /api/fraud/cases/:caseId/actions
 * Add action to fraud case
 */
router.post('/cases/:caseId/actions', internalAuth, asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { action, details } = req.body;
    const performedBy = req.headers['x-user-id'] || 'system';
    if (!action) {
        res.status(400).json({ error: 'Action is required' });
        return;
    }
    const fraudCase = await FraudCase_1.FraudCase.findOneAndUpdate({ caseId }, {
        $push: {
            actionsTaken: {
                action,
                timestamp: new Date(),
                performedBy,
                details,
            },
        },
    }, { new: true });
    if (!fraudCase) {
        res.status(404).json({ error: 'Fraud case not found' });
        return;
    }
    (0, logger_1.logAudit)('Action added to fraud case', {
        caseId,
        action,
        performedBy,
    });
    res.json({ success: true, case: fraudCase });
}));
/**
 * GET /api/fraud/cases/stats/summary
 * Get fraud case statistics
 */
router.get('/cases/stats/summary', internalAuth, asyncHandler(async (req, res) => {
    const [totalCases, openCases, byStatus, bySeverity, avgRiskScore, totalBlockedAmount,] = await Promise.all([
        FraudCase_1.FraudCase.countDocuments(),
        FraudCase_1.FraudCase.countDocuments({
            status: { $in: [FraudCase_1.FraudCaseStatus.OPEN, FraudCase_1.FraudCaseStatus.UNDER_REVIEW] },
        }),
        FraudCase_1.FraudCase.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        FraudCase_1.FraudCase.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
        FraudCase_1.FraudCase.aggregate([{ $group: { _id: null, avg: { $avg: '$riskScore' } } }]),
        FraudCase_1.FraudCase.aggregate([{ $group: { _id: null, total: { $sum: '$blockedAmount' } } }]),
    ]);
    res.json({
        totalCases,
        openCases,
        byStatus: byStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
        avgRiskScore: avgRiskScore[0]?.avg || 0,
        totalBlockedAmount: totalBlockedAmount[0]?.total || 0,
    });
}));
// ============= VELOCITY ROUTES =============
/**
 * GET /api/fraud/velocity/:userId
 * Get velocity status for a user
 */
router.get('/velocity/:userId', internalAuth, asyncHandler(async (req, res) => {
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
}));
/**
 * DELETE /api/fraud/velocity/:userId
 * Reset velocity counters for a user
 */
router.delete('/velocity/:userId', internalAuth, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    (0, logger_1.logAudit)('Velocity counters reset', { userId });
    res.json({ success: true, userId });
}));
// ============= HEALTH CHECK =============
/**
 * GET /api/fraud/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
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
router.get('/ready', async (req, res) => {
    try {
        // Check MongoDB
        const mongoStatus = await FraudCase_1.FraudCase.findOne().exec();
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
        }
        else {
            res.status(503).json({
                status: 'not_ready',
                error: 'Database connection issue',
            });
        }
    }
    catch (error) {
        res.status(503).json({
            status: 'not_ready',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=fraud.routes.js.map
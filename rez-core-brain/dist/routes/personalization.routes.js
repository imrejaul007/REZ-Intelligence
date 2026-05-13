"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const personalizationService_1 = require("../services/personalizationService");
const contextService_1 = require("../services/contextService");
const intelligenceService_1 = require("../services/intelligenceService");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Validation schemas
const updatePreferencesSchema = zod_1.z.object({
    tone: zod_1.z.enum(['formal', 'casual', 'friendly', 'professional']).optional(),
    language: zod_1.z.string().min(2).max(10).optional(),
    timezone: zod_1.z.string().optional(),
    notificationPreferences: zod_1.z.object({
        email: zod_1.z.boolean().optional(),
        push: zod_1.z.boolean().optional(),
        sms: zod_1.z.boolean().optional(),
    }).optional(),
    privacyLevel: zod_1.z.enum(['strict', 'balanced', 'open']).optional(),
    accessibilityNeeds: zod_1.z.array(zod_1.z.string()).optional(),
    preferredContentTypes: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const updateLoyaltySchema = zod_1.z.object({
    points: zod_1.z.number().min(0).optional(),
    addPoints: zod_1.z.number().positive().optional(),
    deductPoints: zod_1.z.number().positive().optional(),
    preferences: zod_1.z.object({
        favoriteCategories: zod_1.z.array(zod_1.z.string()).optional(),
        preferredBrands: zod_1.z.array(zod_1.z.string()).optional(),
        communicationStyle: zod_1.z.string().optional(),
    }).optional(),
    history: zod_1.z.object({
        totalPurchases: zod_1.z.number().min(0).optional(),
        totalSpent: zod_1.z.number().min(0).optional(),
        lastPurchaseDate: zod_1.z.string().datetime().optional(),
        favoriteStore: zod_1.z.string().optional(),
    }).optional(),
});
const recordPurchaseSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    categories: zod_1.z.array(zod_1.z.string()).optional(),
});
// ==================== PREFERENCES ====================
/**
 * GET /api/personalization/preferences
 * Get user preferences
 */
router.get('/preferences', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const preferences = await personalizationService_1.personalizationService.getOrCreatePreferences(userId);
        res.json({
            success: true,
            data: preferences,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get preferences', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get preferences',
            },
        });
    }
});
/**
 * PATCH /api/personalization/preferences
 * Update user preferences
 */
router.patch('/preferences', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const validation = updatePreferencesSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: validation.error.flatten(),
                },
            });
            return;
        }
        const preferences = await personalizationService_1.personalizationService.updatePreferences(userId, validation.data);
        res.json({
            success: true,
            data: preferences,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update preferences', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update preferences',
            },
        });
    }
});
/**
 * POST /api/personalization/preferences/reset
 * Reset preferences to defaults
 */
router.post('/preferences/reset', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const preferences = await personalizationService_1.personalizationService.resetPreferences(userId);
        if (!preferences) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Preferences not found',
                },
            });
            return;
        }
        logger_1.logger.info(`Reset preferences for user: ${userId}`);
        res.json({
            success: true,
            data: preferences,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to reset preferences', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to reset preferences',
            },
        });
    }
});
// ==================== LOYALTY ====================
/**
 * GET /api/personalization/loyalty
 * Get loyalty profile
 */
router.get('/loyalty', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const profile = await personalizationService_1.personalizationService.getOrCreateLoyaltyProfile(userId);
        res.json({
            success: true,
            data: profile,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get loyalty profile', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get loyalty profile',
            },
        });
    }
});
/**
 * PATCH /api/personalization/loyalty
 * Update loyalty profile
 */
router.patch('/loyalty', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const validation = updateLoyaltySchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: validation.error.flatten(),
                },
            });
            return;
        }
        // Process history dates
        if (validation.data.history?.lastPurchaseDate) {
            validation.data.history.lastPurchaseDate = new Date(validation.data.history.lastPurchaseDate);
        }
        const profile = await personalizationService_1.personalizationService.updateLoyaltyProfile(userId, validation.data);
        res.json({
            success: true,
            data: profile,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Insufficient points') {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_POINTS',
                    message: 'Not enough points to redeem',
                },
            });
            return;
        }
        logger_1.logger.error('Failed to update loyalty profile', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update loyalty profile',
            },
        });
    }
});
/**
 * GET /api/personalization/loyalty/benefits
 * Get tier benefits
 */
router.get('/loyalty/benefits', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const benefits = await personalizationService_1.personalizationService.getTierBenefits(userId);
        if (!benefits) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Loyalty profile not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: benefits,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get tier benefits', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get tier benefits',
            },
        });
    }
});
/**
 * POST /api/personalization/loyalty/purchase
 * Record a purchase and update loyalty
 */
router.post('/loyalty/purchase', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const validation = recordPurchaseSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: validation.error.flatten(),
                },
            });
            return;
        }
        const profile = await personalizationService_1.personalizationService.recordPurchase(userId, validation.data.amount, validation.data.categories);
        logger_1.logger.info(`Recorded purchase of ${validation.data.amount} for user: ${userId}`);
        res.json({
            success: true,
            data: profile,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to record purchase', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to record purchase',
            },
        });
    }
});
// ==================== CONTEXT ====================
/**
 * GET /api/personalization/context
 * Get contextual data
 */
router.get('/context', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const context = await contextService_1.contextService.getOrCreateContextualData(userId);
        res.json({
            success: true,
            data: context,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get context', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get context',
            },
        });
    }
});
/**
 * PATCH /api/personalization/context
 * Update contextual data
 */
router.patch('/context', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const schema = zod_1.z.object({
            location: zod_1.z.string().optional(),
            device: zod_1.z.string().optional(),
            browser: zod_1.z.string().optional(),
            os: zod_1.z.string().optional(),
            appVersion: zod_1.z.string().optional(),
            sessionId: zod_1.z.string().optional(),
        });
        const validation = schema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: validation.error.flatten(),
                },
            });
            return;
        }
        const context = await contextService_1.contextService.updateContextualData(userId, validation.data);
        res.json({
            success: true,
            data: context,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update context', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update context',
            },
        });
    }
});
/**
 * POST /api/personalization/context/activity
 * Update recent activity
 */
router.post('/context/activity', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const schema = zod_1.z.object({
            action: zod_1.z.string().min(1),
            agent: zod_1.z.string().optional(),
            topic: zod_1.z.string().optional(),
            search: zod_1.z.string().optional(),
        });
        const validation = schema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: validation.error.flatten(),
                },
            });
            return;
        }
        await contextService_1.contextService.updateRecentActivity(userId, validation.data.action, validation.data.agent, validation.data.topic, validation.data.search);
        // Also update intelligence
        await intelligenceService_1.intelligenceService.updateUserIntent(userId, validation.data.action);
        res.json({
            success: true,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update activity', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update activity',
            },
        });
    }
});
// ==================== INTELLIGENCE ====================
/**
 * GET /api/personalization/intelligence
 * Get comprehensive intelligence data
 */
router.get('/intelligence', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const schema = zod_1.z.object({
            includeMetrics: zod_1.z.coerce.boolean().optional().default(true),
            includeContext: zod_1.z.coerce.boolean().optional().default(true),
            includePreferences: zod_1.z.coerce.boolean().optional().default(false),
            includeRecentMemories: zod_1.z.coerce.boolean().optional().default(false),
            includeSessionContext: zod_1.z.coerce.boolean().optional().default(false),
        });
        const validation = schema.safeParse(req.query);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid query parameters',
                    details: validation.error.flatten(),
                },
            });
            return;
        }
        const data = await intelligenceService_1.intelligenceService.getIntelligenceData({
            userId,
            ...validation.data,
        });
        res.json({
            success: true,
            data,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get intelligence data', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get intelligence data',
            },
        });
    }
});
/**
 * POST /api/personalization/recommendations
 * Generate personalized recommendations
 */
router.post('/recommendations', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const schema = zod_1.z.object({
            context: zod_1.z.string().optional(),
            excludedItems: zod_1.z.array(zod_1.z.string()).optional(),
            limit: zod_1.z.number().min(1).max(20).optional().default(5),
        });
        const validation = schema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: validation.error.flatten(),
                },
            });
            return;
        }
        const recommendations = await intelligenceService_1.intelligenceService.generateRecommendations({
            userId,
            context: validation.data.context,
            excludedItems: validation.data.excludedItems,
            limit: validation.data.limit,
        });
        res.json({
            success: true,
            data: recommendations,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to generate recommendations', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to generate recommendations',
            },
        });
    }
});
/**
 * GET /api/personalization/engagement
 * Get engagement score
 */
router.get('/engagement', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const score = await intelligenceService_1.intelligenceService.getEngagementScore(userId);
        res.json({
            success: true,
            data: score,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get engagement score', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get engagement score',
            },
        });
    }
});
/**
 * GET /api/personalization/behavior
 * Analyze behavior patterns
 */
router.get('/behavior', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const analysis = await intelligenceService_1.intelligenceService.analyzeBehaviorPatterns(userId);
        res.json({
            success: true,
            data: analysis,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to analyze behavior', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to analyze behavior',
            },
        });
    }
});
/**
 * POST /api/personalization/greeting
 * Get personalized greeting
 */
router.post('/greeting', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const schema = zod_1.z.object({
            defaultGreeting: zod_1.z.string().optional(),
        });
        const validation = schema.safeParse(req.body);
        const greeting = await personalizationService_1.personalizationService.getPersonalizedGreeting(userId, validation.data?.defaultGreeting);
        res.json({
            success: true,
            data: { greeting },
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get greeting', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get greeting',
            },
        });
    }
});
exports.default = router;
//# sourceMappingURL=personalization.routes.js.map
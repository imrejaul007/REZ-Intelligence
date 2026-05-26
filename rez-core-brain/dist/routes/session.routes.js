"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const sessionService_1 = require("../services/sessionService");
const contextService_1 = require("../services/contextService");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Validation schemas
const createSessionSchema = zod_1.z.object({
    agentId: zod_1.z.string().optional(),
    context: zod_1.z.record(zod_1.z.unknown()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const updateSessionSchema = zod_1.z.object({
    context: zod_1.z.record(zod_1.z.unknown()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const addContextSchema = zod_1.z.object({
    key: zod_1.z.string().min(1),
    value: zod_1.z.unknown(),
});
const getSessionsSchema = zod_1.z.object({
    state: zod_1.z.enum(['active', 'paused', 'ended']).optional(),
    limit: zod_1.z.coerce.number().min(1).max(100).optional(),
    skip: zod_1.z.coerce.number().min(0).optional(),
});
/**
 * POST /api/session
 * Create a new session
 */
router.post('/', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const requestIdVal = req.requestId || 'unknown';
        const validation = createSessionSchema.safeParse(req.body);
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
        const session = await sessionService_1.sessionService.createSession({
            userId,
            agentId: validation.data.agentId,
            context: validation.data.context,
            metadata: validation.data.metadata,
        });
        // Register agent if provided
        if (validation.data.agentId) {
            await contextService_1.contextService.addActiveAgent(userId, validation.data.agentId);
        }
        logger_1.logger.info(`Session created: ${session.id}`, { requestId: requestIdVal, userId });
        res.status(201).json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: requestIdVal,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create session', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to create session',
            },
        });
    }
});
/**
 * GET /api/session
 * Get or create a session for the current user
 */
router.get('/', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const agentId = req.query.agentId;
        const session = await sessionService_1.sessionService.getOrCreateSession(userId, agentId);
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get/create session', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get session',
            },
        });
    }
});
/**
 * GET /api/session/:id
 * Get a session by ID
 */
router.get('/:id', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const session = await sessionService_1.sessionService.getSession(id, userId);
        if (!session) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Session not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get session', { error, sessionId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get session',
            },
        });
    }
});
/**
 * GET /api/session/list/user
 * Get all sessions for the current user
 */
router.get('/list/user', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const validation = getSessionsSchema.safeParse(req.query);
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
        const { state, limit, skip } = validation.data;
        const sessions = await sessionService_1.sessionService.getUserSessions(userId, {
            state: state,
            limit,
            skip,
        });
        res.json({
            success: true,
            data: sessions,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
                pagination: {
                    page: Math.floor((skip || 0) / (limit || 20)) + 1,
                    limit: limit || 20,
                    total: sessions.length,
                    hasMore: sessions.length === (limit || 20),
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get user sessions', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get sessions',
            },
        });
    }
});
/**
 * PATCH /api/session/:id
 * Update a session
 */
router.patch('/:id', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const validation = updateSessionSchema.safeParse(req.body);
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
        const session = await sessionService_1.sessionService.updateSession(id, userId, validation.data);
        if (!session) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Session not found',
                },
            });
            return;
        }
        logger_1.logger.info(`Session updated: ${id}`);
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update session', { error, sessionId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update session',
            },
        });
    }
});
/**
 * POST /api/session/:id/context
 * Add context to a session
 */
router.post('/:id/context', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const validation = addContextSchema.safeParse(req.body);
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
        const session = await sessionService_1.sessionService.addContext(id, userId, validation.data.key, validation.data.value);
        if (!session) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Session not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to add context', { error, sessionId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to add context',
            },
        });
    }
});
/**
 * DELETE /api/session/:id/context/:key
 * Remove context from a session
 */
router.delete('/:id/context/:key', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const key = req.params.key;
        const session = await sessionService_1.sessionService.removeContext(id, userId, key);
        if (!session) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Session not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to remove context', { error, sessionId: req.params.id, key: req.params.key });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to remove context',
            },
        });
    }
});
/**
 * POST /api/session/:id/pause
 * Pause a session
 */
router.post('/:id/pause', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const session = await sessionService_1.sessionService.pauseSession(id, userId);
        if (!session) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Session not found or cannot be paused',
                },
            });
            return;
        }
        logger_1.logger.info(`Session paused: ${id}`);
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to pause session', { error, sessionId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to pause session',
            },
        });
    }
});
/**
 * POST /api/session/:id/resume
 * Resume a session
 */
router.post('/:id/resume', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const session = await sessionService_1.sessionService.resumeSession(id, userId);
        if (!session) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Session not found or cannot be resumed',
                },
            });
            return;
        }
        logger_1.logger.info(`Session resumed: ${id}`);
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to resume session', { error, sessionId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to resume session',
            },
        });
    }
});
/**
 * POST /api/session/:id/end
 * End a session
 */
router.post('/:id/end', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const session = await sessionService_1.sessionService.endSession(id, userId);
        if (!session) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Session not found',
                },
            });
            return;
        }
        // Remove from active agents
        if (session.agentId) {
            await contextService_1.contextService.removeActiveAgent(userId, session.agentId);
        }
        logger_1.logger.info(`Session ended: ${id}`);
        res.json({
            success: true,
            data: session,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to end session', { error, sessionId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to end session',
            },
        });
    }
});
/**
 * POST /api/session/end-all
 * End all active sessions for the current user
 */
router.post('/end-all', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const count = await sessionService_1.sessionService.endAllUserSessions(userId);
        logger_1.logger.info(`Ended ${count} sessions for user: ${userId}`);
        res.json({
            success: true,
            data: { endedCount: count },
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to end all sessions', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to end all sessions',
            },
        });
    }
});
/**
 * GET /api/session/stats
 * Get session statistics for the current user
 */
router.get('/stats', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const stats = await sessionService_1.sessionService.getSessionStats(userId);
        res.json({
            success: true,
            data: stats,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get session stats', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get session statistics',
            },
        });
    }
});
/**
 * GET /api/session/count
 * Get active session count for the current user
 */
router.get('/count', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const count = await sessionService_1.sessionService.getActiveSessionCount(userId);
        res.json({
            success: true,
            data: { activeCount: count },
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get session count', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get session count',
            },
        });
    }
});
exports.default = router;
//# sourceMappingURL=session.routes.js.map
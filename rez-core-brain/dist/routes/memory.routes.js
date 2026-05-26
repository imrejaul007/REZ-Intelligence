"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const memoryService_1 = require("../services/memoryService");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Validation schemas
const createMemorySchema = zod_1.z.object({
    type: zod_1.z.enum(['short_term', 'long_term', 'episodic', 'semantic']).optional(),
    content: zod_1.z.string().min(1).max(10000),
    importance: zod_1.z.number().min(0).max(10).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    source: zod_1.z.string().optional(),
    ttlSeconds: zod_1.z.number().positive().optional(),
});
const updateMemorySchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(10000).optional(),
    importance: zod_1.z.number().min(0).max(10).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const searchMemoriesSchema = zod_1.z.object({
    type: zod_1.z.enum(['short_term', 'long_term', 'episodic', 'semantic']).optional(),
    tags: zod_1.z.string().transform((s) => s.split(',')).optional(),
    query: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().min(1).max(100).optional(),
    skip: zod_1.z.coerce.number().min(0).optional(),
    minImportance: zod_1.z.coerce.number().min(0).max(10).optional(),
});
/**
 * POST /api/memory
 * Create a new memory
 */
router.post('/', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const requestIdVal = req.requestId || 'unknown';
        const validation = createMemorySchema.safeParse(req.body);
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
        const memory = await memoryService_1.memoryService.createMemory({
            userId,
            content: validation.data.content,
            type: validation.data.type,
            metadata: validation.data.metadata,
            importance: validation.data.importance,
            tags: validation.data.tags,
            source: validation.data.source,
            ttlSeconds: validation.data.ttlSeconds,
        });
        logger_1.logger.info(`Memory created: ${memory.id}`, { requestId: requestIdVal, userId });
        res.status(201).json({
            success: true,
            data: memory,
            meta: {
                timestamp: new Date(),
                requestId: requestIdVal,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create memory', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to create memory',
            },
        });
    }
});
/**
 * GET /api/memory/:id
 * Get a memory by ID
 */
router.get('/:id', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const memory = await memoryService_1.memoryService.getMemory(id, userId);
        if (!memory) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Memory not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: memory,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get memory', { error, memoryId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get memory',
            },
        });
    }
});
/**
 * GET /api/memory
 * Get all memories for the current user
 */
router.get('/', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const validation = searchMemoriesSchema.safeParse(req.query);
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
        const { type, tags, query, limit, skip, minImportance } = validation.data;
        const memories = await memoryService_1.memoryService.getUserMemories({
            userId,
            type: type,
            tags,
            query,
            limit,
            skip,
            minImportance,
        });
        res.json({
            success: true,
            data: memories,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
                pagination: {
                    page: Math.floor((skip || 0) / (limit || 50)) + 1,
                    limit: limit || 50,
                    total: memories.length,
                    hasMore: memories.length === (limit || 50),
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get memories', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get memories',
            },
        });
    }
});
/**
 * PATCH /api/memory/:id
 * Update a memory
 */
router.patch('/:id', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const validation = updateMemorySchema.safeParse(req.body);
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
        const memory = await memoryService_1.memoryService.updateMemory(id, userId, validation.data);
        if (!memory) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Memory not found',
                },
            });
            return;
        }
        logger_1.logger.info(`Memory updated: ${id}`);
        res.json({
            success: true,
            data: memory,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update memory', { error, memoryId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update memory',
            },
        });
    }
});
/**
 * DELETE /api/memory/:id
 * Delete a memory
 */
router.delete('/:id', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const deleted = await memoryService_1.memoryService.deleteMemory(id, userId);
        if (!deleted) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Memory not found',
                },
            });
            return;
        }
        logger_1.logger.info(`Memory deleted: ${id}`);
        res.json({
            success: true,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete memory', { error, memoryId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to delete memory',
            },
        });
    }
});
/**
 * DELETE /api/memory
 * Delete all memories for the current user
 */
router.delete('/', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const type = req.query.type;
        const deletedCount = await memoryService_1.memoryService.deleteAllUserMemories(userId, type);
        logger_1.logger.info(`Deleted ${deletedCount} memories for user: ${userId}`);
        res.json({
            success: true,
            data: { deletedCount },
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete memories', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to delete memories',
            },
        });
    }
});
/**
 * POST /api/memory/search
 * Semantic search for memories
 */
router.post('/search', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const schema = zod_1.z.object({
            query: zod_1.z.string().min(1),
            limit: zod_1.z.number().min(1).max(50).optional().default(10),
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
        const memories = await memoryService_1.memoryService.semanticSearch(userId, validation.data.query, validation.data.limit);
        res.json({
            success: true,
            data: memories,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to search memories', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to search memories',
            },
        });
    }
});
/**
 * POST /api/memory/batch
 * Batch create memories
 */
router.post('/batch', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const schema = zod_1.z.object({
            memories: zod_1.z.array(createMemorySchema).min(1).max(100),
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
        const memoriesWithUserId = validation.data.memories.map((m) => ({
            userId,
            content: m.content,
            type: m.type,
            metadata: m.metadata,
            importance: m.importance,
            tags: m.tags,
            source: m.source,
            ttlSeconds: m.ttlSeconds,
        }));
        const memories = await memoryService_1.memoryService.batchCreateMemories(memoriesWithUserId);
        logger_1.logger.info(`Batch created ${memories.length} memories`);
        res.status(201).json({
            success: true,
            data: memories,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to batch create memories', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to batch create memories',
            },
        });
    }
});
/**
 * GET /api/memory/stats
 * Get memory statistics for the current user
 */
router.get('/stats', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const stats = await memoryService_1.memoryService.getMemoryStats(userId);
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
        logger_1.logger.error('Failed to get memory stats', { error, userId: req.userId });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get memory statistics',
            },
        });
    }
});
/**
 * POST /api/memory/:id/access
 * Access a memory (increment access count)
 */
router.post('/:id/access', auth_1.requestId, auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const memory = await memoryService_1.memoryService.accessMemory(id, userId);
        if (!memory) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Memory not found',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: memory,
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to access memory', { error, memoryId: req.params.id });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to access memory',
            },
        });
    }
});
exports.default = router;
//# sourceMappingURL=memory.routes.js.map
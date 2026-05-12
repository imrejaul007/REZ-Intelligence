import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { memoryService } from '../services/memoryService';
import { authenticate, requestId } from '../middleware/auth';
import { MemoryType } from '../models/UserMemory';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation schemas
const createMemorySchema = z.object({
  type: z.enum(['short_term', 'long_term', 'episodic', 'semantic']).optional(),
  content: z.string().min(1).max(10000),
  importance: z.number().min(0).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  ttlSeconds: z.number().positive().optional(),
});

const updateMemorySchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  importance: z.number().min(0).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const searchMemoriesSchema = z.object({
  type: z.enum(['short_term', 'long_term', 'episodic', 'semantic']).optional(),
  tags: z.string().transform((s) => s.split(',')).optional(),
  query: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  skip: z.coerce.number().min(0).optional(),
  minImportance: z.coerce.number().min(0).max(10).optional(),
});

/**
 * POST /api/memory
 * Create a new memory
 */
router.post('/', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const requestId = req.requestId!;

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

    const memory = await memoryService.createMemory({
      userId,
      ...validation.data,
    });

    logger.info(`Memory created: ${memory.id}`, { requestId, userId });

    res.status(201).json({
      success: true,
      data: memory,
      meta: {
        timestamp: new Date(),
        requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to create memory', { error, userId: req.userId });
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
router.get('/:id', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const memory = await memoryService.getMemory(id, userId);

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
  } catch (error) {
    logger.error('Failed to get memory', { error, memoryId: req.params.id });
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
router.get('/', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

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

    const memories = await memoryService.getUserMemories({
      userId,
      type: type as MemoryType | undefined,
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
  } catch (error) {
    logger.error('Failed to get memories', { error, userId: req.userId });
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
router.patch('/:id', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
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

    const memory = await memoryService.updateMemory(id, userId, validation.data);

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

    logger.info(`Memory updated: ${id}`);

    res.json({
      success: true,
      data: memory,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to update memory', { error, memoryId: req.params.id });
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
router.delete('/:id', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const deleted = await memoryService.deleteMemory(id, userId);

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

    logger.info(`Memory deleted: ${id}`);

    res.json({
      success: true,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to delete memory', { error, memoryId: req.params.id });
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
router.delete('/', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const type = req.query.type as MemoryType | undefined;

    const deletedCount = await memoryService.deleteAllUserMemories(userId, type);

    logger.info(`Deleted ${deletedCount} memories for user: ${userId}`);

    res.json({
      success: true,
      data: { deletedCount },
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to delete memories', { error, userId: req.userId });
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
router.post('/search', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).optional().default(10),
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

    const memories = await memoryService.semanticSearch(
      userId,
      validation.data.query,
      validation.data.limit
    );

    res.json({
      success: true,
      data: memories,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to search memories', { error, userId: req.userId });
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
router.post('/batch', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      memories: z.array(createMemorySchema).min(1).max(100),
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
      ...m,
      userId,
    }));

    const memories = await memoryService.batchCreateMemories(memoriesWithUserId);

    logger.info(`Batch created ${memories.length} memories`);

    res.status(201).json({
      success: true,
      data: memories,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to batch create memories', { error, userId: req.userId });
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
router.get('/stats', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const stats = await memoryService.getMemoryStats(userId);

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get memory stats', { error, userId: req.userId });
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
router.post('/:id/access', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const memory = await memoryService.accessMemory(id, userId);

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
  } catch (error) {
    logger.error('Failed to access memory', { error, memoryId: req.params.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to access memory',
      },
    });
  }
});

export default router;

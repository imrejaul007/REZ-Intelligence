import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sessionService } from '../services/sessionService';
import { contextService } from '../services/contextService';
import { authenticate, requestId } from '../middleware/auth';
import { SessionState } from '../models/SessionContext';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const createSessionSchema = z.object({
  agentId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSessionSchema = z.object({
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const addContextSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

const getSessionsSchema = z.object({
  state: z.enum(['active', 'paused', 'ended']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  skip: z.coerce.number().min(0).optional(),
});

/**
 * POST /api/session
 * Create a new session
 */
router.post('/', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const requestId = req.requestId!;

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

    const session = await sessionService.createSession({
      userId,
      agentId: validation.data.agentId,
      context: validation.data.context,
      metadata: validation.data.metadata,
    });

    // Register agent if provided
    if (validation.data.agentId) {
      await contextService.addActiveAgent(userId, validation.data.agentId);
    }

    logger.info(`Session created: ${session.id}`, { requestId, userId });

    res.status(201).json({
      success: true,
      data: session,
      meta: {
        timestamp: new Date(),
        requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to create session', { error, userId: req.userId });
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
router.get('/', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const agentId = req.query.agentId as string | undefined;

    const session = await sessionService.getOrCreateSession(userId, agentId);

    res.json({
      success: true,
      data: session,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get/create session', { error, userId: req.userId });
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
router.get('/:id', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const session = await sessionService.getSession(id, userId);

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
  } catch (error) {
    logger.error('Failed to get session', { error, sessionId: req.params.id });
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
router.get('/list/user', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

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

    const sessions = await sessionService.getUserSessions(userId, {
      state: state as SessionState | undefined,
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
  } catch (error) {
    logger.error('Failed to get user sessions', { error, userId: req.userId });
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
router.patch('/:id', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

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

    const session = await sessionService.updateSession(id, userId, validation.data);

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

    logger.info(`Session updated: ${id}`);

    res.json({
      success: true,
      data: session,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to update session', { error, sessionId: req.params.id });
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
router.post('/:id/context', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

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

    const session = await sessionService.addContext(
      id,
      userId,
      validation.data.key,
      validation.data.value
    );

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
  } catch (error) {
    logger.error('Failed to add context', { error, sessionId: req.params.id });
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
router.delete('/:id/context/:key', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id, key } = req.params;

    const session = await sessionService.removeContext(id, userId, key);

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
  } catch (error) {
    logger.error('Failed to remove context', { error, sessionId: req.params.id, key: req.params.key });
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
router.post('/:id/pause', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const session = await sessionService.pauseSession(id, userId);

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

    logger.info(`Session paused: ${id}`);

    res.json({
      success: true,
      data: session,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to pause session', { error, sessionId: req.params.id });
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
router.post('/:id/resume', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const session = await sessionService.resumeSession(id, userId);

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

    logger.info(`Session resumed: ${id}`);

    res.json({
      success: true,
      data: session,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to resume session', { error, sessionId: req.params.id });
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
router.post('/:id/end', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const session = await sessionService.endSession(id, userId);

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
      await contextService.removeActiveAgent(userId, session.agentId);
    }

    logger.info(`Session ended: ${id}`);

    res.json({
      success: true,
      data: session,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to end session', { error, sessionId: req.params.id });
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
router.post('/end-all', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const count = await sessionService.endAllUserSessions(userId);

    logger.info(`Ended ${count} sessions for user: ${userId}`);

    res.json({
      success: true,
      data: { endedCount: count },
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to end all sessions', { error, userId: req.userId });
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
router.get('/stats', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const stats = await sessionService.getSessionStats(userId);

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get session stats', { error, userId: req.userId });
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
router.get('/count', requestId, authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const count = await sessionService.getActiveSessionCount(userId);

    res.json({
      success: true,
      data: { activeCount: count },
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get session count', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get session count',
      },
    });
  }
});

export default router;

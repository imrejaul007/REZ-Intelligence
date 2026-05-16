import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getAllSegments,
  getSegmentById,
  evaluateUserSegment,
  evaluateUserAllSegments,
  getSegmentMembers,
  getSegmentStats,
  triggerSegmentEvaluation,
  getJobStatus,
  getUserCurrentSegments
} from '../services/segmentService.js';
import { redisHealthCheck } from '../services/redisCache.js';
import { getQueueStatus } from '../services/webhookEmitter.js';
import { getConnectionStatus } from '../database/index.js';
import type { ApiResponse, SegmentEvaluationResult, SegmentDefinition, UserData } from '../types/index.js';

const router = Router();

// Validation schemas
const UserIdParamsSchema = z.object({
  userId: z.string().min(1, 'userId is required')
});

const SegmentIdParamsSchema = z.object({
  segmentId: z.string().min(1, 'segmentId is required')
});

const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(100)
});

const EvaluateUserBodySchema = z.object({
  userData: z.any().optional()
});

const CreateSegmentBodySchema = z.object({
  segmentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  rules: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']),
    value: z.unknown(),
    logic: z.enum(['AND', 'OR']).optional()
  })),
  refreshInterval: z.number().min(1).default(60)
});

// Auth middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing X-Internal-Token header',
      timestamp: new Date().toISOString()
    } as ApiResponse<never>);
    return;
  }

  // In production, validate against INTERNAL_SERVICE_TOKENS_JSON
  // For now, just check if token exists
  next();
}

// Error handler wrapper
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

// Health check
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const mongoHealthy = getConnectionStatus();
  const redisHealthy = await redisHealthCheck();

  const healthy = mongoHealthy && redisHealthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected'
    }
  });
}));

// Get system status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const segments = await getAllSegments();
  const webhookStatus = getQueueStatus();
  const redisHealthy = await redisHealthCheck();

  res.json({
    success: true,
    data: {
      service: 'REZ Realtime Segments',
      version: '1.0.0',
      segments: {
        total: segments.length,
        active: segments.filter(s => s.refreshInterval > 0).length
      },
      redis: {
        connected: redisHealthy,
        cachedSegments: Object.keys(webhookStatus).length
      },
      webhooks: {
        queued: webhookStatus.queued,
        processing: webhookStatus.processing
      },
      uptime: process.uptime()
    },
    timestamp: new Date().toISOString()
  } as ApiResponse<unknown>);
}));

// GET /segments - List all segments
router.get('/segments', asyncHandler(async (req: Request, res: Response) => {
  const segments = await getAllSegments();

  res.json({
    success: true,
    data: segments,
    timestamp: new Date().toISOString()
  } as ApiResponse<SegmentDefinition[]>);
}));

// GET /segments/:segmentId - Get segment definition
router.get('/segments/:segmentId', asyncHandler(async (req: Request, res: Response) => {
  const params = SegmentIdParamsSchema.parse(req.params);
  const segment = await getSegmentById(params.segmentId);

  if (!segment) {
    res.status(404).json({
      success: false,
      error: `Segment not found: ${params.segmentId}`,
      timestamp: new Date().toISOString()
    } as ApiResponse<never>);
    return;
  }

  res.json({
    success: true,
    data: segment,
    timestamp: new Date().toISOString()
  } as ApiResponse<SegmentDefinition>);
}));

// POST /segments/:segmentId/evaluate/:userId - Evaluate single user
router.post(
  '/segments/:segmentId/evaluate/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.merge(UserIdParamsSchema).parse(req.params);
    const body = EvaluateUserBodySchema.parse(req.body);

    const startTime = Date.now();

    const result = await evaluateUserSegment(
      params.segmentId,
      params.userId,
      body.userData as UserData | undefined
    );

    if (!result) {
      res.status(404).json({
        success: false,
        error: `Segment not found: ${params.segmentId}`,
        timestamp: new Date().toISOString()
      } as ApiResponse<never>);
      return;
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        ...result,
        responseTimeMs: responseTime
      },
      timestamp: new Date().toISOString()
    } as ApiResponse<SegmentEvaluationResult>);
  })
);

// POST /segments/evaluate/:userId - Evaluate all segments for user
router.post(
  '/segments/evaluate/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);
    const body = EvaluateUserBodySchema.parse(req.body);

    const startTime = Date.now();

    const results = await evaluateUserAllSegments(
      params.userId,
      body.userData as UserData | undefined
    );

    const qualifyingSegments = results.filter(r => r.matches);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        userId: params.userId,
        totalSegments: results.length,
        matchingSegments: qualifyingSegments.length,
        segments: results,
        responseTimeMs: responseTime
      },
      timestamp: new Date().toISOString()
    } as ApiResponse<unknown>);
  })
);

// GET /segments/:segmentId/members - Get users in segment
router.get(
  '/segments/:segmentId/members',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.parse(req.params);
    const query = PaginationQuerySchema.parse(req.query);

    const { members, total } = await getSegmentMembers(
      params.segmentId,
      query.page,
      query.limit
    );

    res.json({
      success: true,
      data: members,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      },
      timestamp: new Date().toISOString()
    });
  })
);

// GET /segments/:segmentId/stats - Segment statistics
router.get(
  '/segments/:segmentId/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.parse(req.params);

    const stats = await getSegmentStats(params.segmentId);

    if (!stats) {
      res.status(404).json({
        success: false,
        error: `Segment not found: ${params.segmentId}`,
        timestamp: new Date().toISOString()
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    } as ApiResponse<unknown>);
  })
);

// POST /segments/:segmentId/trigger - Trigger segment evaluation job
router.post(
  '/segments/:segmentId/trigger',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.parse(req.params);

    const segment = await getSegmentById(params.segmentId);

    if (!segment) {
      res.status(404).json({
        success: false,
        error: `Segment not found: ${params.segmentId}`,
        timestamp: new Date().toISOString()
      } as ApiResponse<never>);
      return;
    }

    const { jobId, status } = await triggerSegmentEvaluation(params.segmentId);

    res.json({
      success: true,
      data: {
        jobId,
        status,
        segmentId: params.segmentId,
        segmentName: segment.name,
        message: 'Segment evaluation job triggered successfully'
      },
      timestamp: new Date().toISOString()
    } as ApiResponse<unknown>);
  })
);

// GET /jobs/:jobId - Get job status
router.get(
  '/jobs/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = z.object({ jobId: z.string().min(1) }).parse(req.params);

    const job = await getJobStatus(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        error: `Job not found: ${jobId}`,
        timestamp: new Date().toISOString()
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString()
    } as ApiResponse<unknown>);
  })
);

// GET /users/:userId/segments - Get user's current segments
router.get(
  '/users/:userId/segments',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);

    const segments = await getUserCurrentSegments(params.userId);

    res.json({
      success: true,
      data: {
        userId: params.userId,
        segments,
        count: segments.length
      },
      timestamp: new Date().toISOString()
    } as ApiResponse<unknown>);
  })
);

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Route error:', err);

  if (err instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      })),
      timestamp: new Date().toISOString()
    } as ApiResponse<never>);
    return;
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  } as ApiResponse<never>);
});

export default router;

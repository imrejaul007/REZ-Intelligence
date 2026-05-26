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
  getUserCurrentSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  exportSegmentMembers,
  getSegmentAnalytics,
} from '../services/segmentService.js';
import { redisHealthCheck } from '../services/redisCache.js';
import { getQueueStatus } from '../services/webhookEmitter.js';
import { getConnectionStatus } from '../database/index.js';
import {
  trackEvent,
  getUserBehaviorProfile,
  getCachedRFMScore,
  getEventAggregation,
  startSession,
  endSession,
  getUserEvents,
  getUserSessions,
} from '../services/behaviorTracker.js';
import {
  subscribe,
  unsubscribe,
  getSubscriptionStats,
  emitSegmentChange,
} from '../services/realtimeUpdate.js';
import type {
  ApiResponse,
  SegmentEvaluationResult,
  SegmentDefinition,
  UserData,
} from '../types/index.js';

const router = Router();

// Validation schemas
const UserIdParamsSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

const SegmentIdParamsSchema = z.object({
  segmentId: z.string().min(1, 'segmentId is required'),
});

const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(100),
});

const EvaluateUserBodySchema = z.object({
  userData: z.unknown().optional(),
});

const CreateSegmentBodySchema = z.object({
  segmentId: z.string().min(1).regex(/^[a-z0-9_]+$/, 'segmentId must be lowercase with underscores'),
  name: z.string().min(1),
  description: z.string().default(''),
  rules: z.array(
    z.object({
      field: z.string().min(1),
      operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']),
      value: z.unknown(),
      logic: z.enum(['AND', 'OR']).optional(),
    })
  ).min(1),
  refreshInterval: z.number().min(1).default(60),
  isActive: z.boolean().default(true),
});

const UpdateSegmentBodySchema = CreateSegmentBodySchema.partial().omit({ segmentId: true });

// Event tracking schemas
const TrackEventBodySchema = z.object({
  eventType: z.string().min(1),
  eventName: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
  sessionId: z.string().optional(),
  source: z.string().default('api'),
  deviceId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const StartSessionBodySchema = z.object({
  metadata: z.record(z.unknown()).optional(),
});

const EndSessionBodySchema = z.object({
  sessionId: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// Webhook configuration schemas
const WebhookConfigBodySchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(['USER_ENTERED_SEGMENT', 'USER_EXITED_SEGMENT', 'SEGMENT_UPDATED'])).optional(),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
});

// Subscription schema
const SubscribeBodySchema = z.object({
  userId: z.string().optional(),
  segmentIds: z.array(z.string()).optional(),
  allSegments: z.boolean().default(false),
  ttl: z.number().min(60).max(86400).optional(),
});

// Export schema
const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  includeMetadata: z.boolean().default(false),
});

// Error handler wrapper
function asyncHandler(
  fn: (req: Request, res: Response, next?: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================================================
// API v1 Routes
// ============================================================================

// Health check
router.get('/api/v1/health', asyncHandler(async (req: Request, res: Response) => {
  const mongoHealthy = getConnectionStatus();
  const redisHealthy = await redisHealthCheck();

  const healthy = mongoHealthy && redisHealthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
    },
  });
}));

// Get system status
router.get('/api/v1/status', asyncHandler(async (req: Request, res: Response) => {
  const segments = await getAllSegments();
  const webhookStatus = getQueueStatus();
  const redisHealthy = await redisHealthCheck();
  const subscriptionStats = getSubscriptionStats();

  res.json({
    success: true,
    data: {
      service: 'REZ Realtime Segments',
      version: '1.0.0',
      segments: {
        total: segments.length,
        active: segments.filter((s) => s.refreshInterval > 0).length,
      },
      redis: {
        connected: redisHealthy,
        cachedSegments: Object.keys(webhookStatus).length,
      },
      webhooks: {
        queued: webhookStatus.queued,
        processing: webhookStatus.processing,
      },
      realtime: {
        subscribers: subscriptionStats.totalSubscribers,
        recentEvents: subscriptionStats.recentEvents,
      },
      uptime: process.uptime(),
    },
    timestamp: new Date().toISOString(),
  } as ApiResponse<unknown>);
}));

// ============================================================================
// Segment Management Routes
// ============================================================================

// GET /api/v1/segments - List all segments
router.get('/api/v1/segments', asyncHandler(async (_req: Request, res: Response) => {
  const segments = await getAllSegments();

  res.json({
    success: true,
    data: segments,
    count: segments.length,
    timestamp: new Date().toISOString(),
  } as ApiResponse<SegmentDefinition[]>);
}));

// POST /api/v1/segments - Create segment
router.post('/api/v1/segments', asyncHandler(async (req: Request, res: Response) => {
  const body = CreateSegmentBodySchema.parse(req.body);

  const segment = await createSegment(body);

  res.status(201).json({
    success: true,
    data: segment,
    message: 'Segment created successfully',
    timestamp: new Date().toISOString(),
  } as ApiResponse<SegmentDefinition>);
}));

// GET /api/v1/segments/:segmentId - Get segment definition
router.get('/api/v1/segments/:segmentId', asyncHandler(async (req: Request, res: Response) => {
  const params = SegmentIdParamsSchema.parse(req.params);
  const segment = await getSegmentById(params.segmentId);

  if (!segment) {
    res.status(404).json({
      success: false,
      error: `Segment not found: ${params.segmentId}`,
      timestamp: new Date().toISOString(),
    } as ApiResponse<never>);
    return;
  }

  res.json({
    success: true,
    data: segment,
    timestamp: new Date().toISOString(),
  } as ApiResponse<SegmentDefinition>);
}));

// PUT /api/v1/segments/:segmentId - Update segment
router.put('/api/v1/segments/:segmentId', asyncHandler(async (req: Request, res: Response) => {
  const params = SegmentIdParamsSchema.parse(req.params);
  const body = UpdateSegmentBodySchema.parse(req.body);

  const segment = await updateSegment(params.segmentId, body);

  if (!segment) {
    res.status(404).json({
      success: false,
      error: `Segment not found: ${params.segmentId}`,
      timestamp: new Date().toISOString(),
    } as ApiResponse<never>);
    return;
  }

  res.json({
    success: true,
    data: segment,
    message: 'Segment updated successfully',
    timestamp: new Date().toISOString(),
  } as ApiResponse<SegmentDefinition>);
}));

// DELETE /api/v1/segments/:segmentId - Delete segment
router.delete('/api/v1/segments/:segmentId', asyncHandler(async (req: Request, res: Response) => {
  const params = SegmentIdParamsSchema.parse(req.params);

  const deleted = await deleteSegment(params.segmentId);

  if (!deleted) {
    res.status(404).json({
      success: false,
      error: `Segment not found: ${params.segmentId}`,
      timestamp: new Date().toISOString(),
    } as ApiResponse<never>);
    return;
  }

  res.json({
    success: true,
    message: 'Segment deleted successfully',
    timestamp: new Date().toISOString(),
  } as ApiResponse<unknown>);
}));

// ============================================================================
// Segment Evaluation Routes
// ============================================================================

// POST /api/v1/segments/:segmentId/evaluate/:userId - Evaluate single user
router.post(
  '/api/v1/segments/:segmentId/evaluate/:userId',
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
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        ...result,
        responseTimeMs: responseTime,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse<SegmentEvaluationResult>);
  })
);

// POST /api/v1/segments/evaluate/:userId - Evaluate all segments for user
router.post(
  '/api/v1/segments/evaluate/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);
    const body = EvaluateUserBodySchema.parse(req.body);

    const startTime = Date.now();

    const results = await evaluateUserAllSegments(
      params.userId,
      body.userData as UserData | undefined
    );

    const qualifyingSegments = results.filter((r) => r.matches);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        userId: params.userId,
        totalSegments: results.length,
        matchingSegments: qualifyingSegments.length,
        segments: results,
        responseTimeMs: responseTime,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// ============================================================================
// Segment Members & Analytics Routes
// ============================================================================

// GET /api/v1/segments/:segmentId/members - Get users in segment
router.get(
  '/api/v1/segments/:segmentId/members',
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
        totalPages: Math.ceil(total / query.limit),
      },
      timestamp: new Date().toISOString(),
    });
  })
);

// GET /api/v1/segments/:segmentId/analytics - Get segment analytics
router.get(
  '/api/v1/segments/:segmentId/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.parse(req.params);
    const { period } = z.object({
      period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    }).parse(req.query);

    const analytics = await getSegmentAnalytics(params.segmentId, period);

    if (!analytics) {
      res.status(404).json({
        success: false,
        error: `Segment not found: ${params.segmentId}`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// GET /api/v1/segments/:segmentId/stats - Segment statistics
router.get(
  '/api/v1/segments/:segmentId/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.parse(req.params);

    const stats = await getSegmentStats(params.segmentId);

    if (!stats) {
      res.status(404).json({
        success: false,
        error: `Segment not found: ${params.segmentId}`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// ============================================================================
// Segment Refresh Routes
// ============================================================================

// POST /api/v1/segments/:segmentId/refresh - Refresh segment
router.post(
  '/api/v1/segments/:segmentId/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.parse(req.params);

    const segment = await getSegmentById(params.segmentId);

    if (!segment) {
      res.status(404).json({
        success: false,
        error: `Segment not found: ${params.segmentId}`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    const { jobId, status } = await triggerSegmentEvaluation(params.segmentId);

    // Emit refresh event
    emitSegmentChange('*', params.segmentId, segment.name, false, false);

    res.json({
      success: true,
      data: {
        jobId,
        status,
        segmentId: params.segmentId,
        segmentName: segment.name,
        message: 'Segment refresh triggered successfully',
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// GET /api/v1/jobs/:jobId - Get job status
router.get(
  '/api/v1/jobs/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = z.object({ jobId: z.string().min(1) }).parse(req.params);

    const job = await getJobStatus(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        error: `Job not found: ${jobId}`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// ============================================================================
// Customer Routes
// ============================================================================

// GET /api/v1/customer/:userId/segments - Get customer's segments
router.get(
  '/api/v1/customer/:userId/segments',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);

    // Get current segments
    const segments = await getUserCurrentSegments(params.userId);

    // Get behavior profile
    const profile = await getUserBehaviorProfile(params.userId);

    // Get RFM score
    const rfmScore = await getCachedRFMScore(params.userId);

    res.json({
      success: true,
      data: {
        userId: params.userId,
        segments,
        segmentCount: segments.length,
        behaviorProfile: profile
          ? {
              sessionCount: profile.sessionCount,
              totalEvents: profile.totalEvents,
              avgSessionDuration: profile.avgSessionDuration,
              behavioralTraits: profile.behavioralTraits,
              rfmScore: profile.rfmScore,
            }
          : null,
        rfmScore,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

// GET /api/v1/customer/:userId/profile - Get complete customer behavior profile
router.get(
  '/api/v1/customer/:userId/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);

    const profile = await getUserBehaviorProfile(params.userId);

    if (!profile) {
      res.status(404).json({
        success: false,
        error: 'No behavior profile found for user',
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// ============================================================================
// Event Tracking Routes
// ============================================================================

// POST /api/v1/events - Track behavior event
router.post('/api/v1/events', asyncHandler(async (req: Request, res: Response) => {
  const params = UserIdParamsSchema.parse(req.params).catch(() => ({ userId: '' }));
  const body = TrackEventBodySchema.parse(req.body);

  // Extract userId from body if not in params
  const userId = params.userId || (body.metadata?.userId as string);

  if (!userId) {
    res.status(400).json({
      success: false,
      error: 'userId is required in params or body.metadata',
      timestamp: new Date().toISOString(),
    } as ApiResponse<never>);
    return;
  }

  const event = await trackEvent({
    userId,
    eventType: body.eventType,
    eventName: body.eventName,
    properties: body.properties || {},
    sessionId: body.sessionId,
    source: body.source,
    deviceId: body.deviceId,
    ipAddress: body.ipAddress,
    userAgent: body.userAgent,
    metadata: body.metadata,
  });

  res.status(201).json({
    success: true,
    data: event,
    timestamp: new Date().toISOString(),
  } as ApiResponse<unknown>);
}));

// POST /api/v1/sessions/start - Start a user session
router.post(
  '/api/v1/sessions/start',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params).catch(() => ({ userId: '' }));
    const body = StartSessionBodySchema.parse(req.body);

    const userId = params.userId || (body.metadata?.userId as string);

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'userId is required',
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    const session = await startSession(userId, body.metadata || {});

    res.status(201).json({
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// POST /api/v1/sessions/end - End a user session
router.post(
  '/api/v1/sessions/end',
  asyncHandler(async (req: Request, res: Response) => {
    const body = EndSessionBodySchema.parse(req.body);

    const result = await endSession(body.sessionId, body.metadata || {});

    if (!result) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// GET /api/v1/customer/:userId/events - Get user's behavior events
router.get(
  '/api/v1/customer/:userId/events',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);
    const query = z.object({
      limit: z.coerce.number().min(1).max(1000).default(100),
      since: z.string().optional(),
    }).parse(req.query);

    const events = await getUserEvents(params.userId, query.limit, query.since);

    res.json({
      success: true,
      data: events,
      count: events.length,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// GET /api/v1/customer/:userId/sessions - Get user's session history
router.get(
  '/api/v1/customer/:userId/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);
    const query = z.object({
      limit: z.coerce.number().min(1).max(100).default(50),
    }).parse(req.query);

    const sessions = await getUserSessions(params.userId, query.limit);

    res.json({
      success: true,
      data: sessions,
      count: sessions.length,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// GET /api/v1/customer/:userId/aggregations - Get user's event aggregations
router.get(
  '/api/v1/customer/:userId/aggregations',
  asyncHandler(async (req: Request, res: Response) => {
    const params = UserIdParamsSchema.parse(req.params);
    const query = z.object({
      period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    }).parse(req.query);

    const aggregation = await getEventAggregation(params.userId, query.period);

    res.json({
      success: true,
      data: aggregation,
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// ============================================================================
// Subscription Routes
// ============================================================================

// POST /api/v1/subscriptions - Subscribe to segment changes
router.post('/api/v1/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const body = SubscribeBodySchema.parse(req.body);

  // Create a mock callback for SSE
  const callback = (event: unknown) => {
    // In production, this would push to WebSocket/SSE
    console.log('Segment change event:', event);
  };

  const subscription = subscribe(body, callback);

  if (!subscription) {
    res.status(503).json({
      success: false,
      error: 'Failed to subscribe - max subscribers reached',
      timestamp: new Date().toISOString(),
    } as ApiResponse<never>);
    return;
  }

  res.status(201).json({
    success: true,
    data: subscription,
    timestamp: new Date().toISOString(),
  } as ApiResponse<unknown>);
}));

// DELETE /api/v1/subscriptions/:subscriberId - Unsubscribe
router.delete(
  '/api/v1/subscriptions/:subscriberId',
  asyncHandler(async (req: Request, res: Response) => {
    const { subscriberId } = z.object({ subscriberId: z.string() }).parse(req.params);

    const unsubscribed = unsubscribe(subscriberId);

    if (!unsubscribed) {
      res.status(404).json({
        success: false,
        error: 'Subscription not found',
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    res.json({
      success: true,
      message: 'Unsubscribed successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<unknown>);
  })
);

// GET /api/v1/subscriptions/stats - Get subscription statistics
router.get('/api/v1/subscriptions/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = getSubscriptionStats();

  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString(),
  } as ApiResponse<unknown>);
}));

// ============================================================================
// Webhook Routes
// ============================================================================

// POST /api/v1/webhooks - Configure webhook
router.post('/api/v1/webhooks', asyncHandler(async (req: Request, res: Response) => {
  const body = WebhookConfigBodySchema.parse(req.body);

  // Store webhook configuration (in production, would persist to database)
  const webhookId = `webhook_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;

  const webhookConfig = {
    id: webhookId,
    ...body,
    createdAt: new Date().toISOString(),
  };

  // In production, would save to database
  console.log('Webhook configured:', webhookConfig);

  res.status(201).json({
    success: true,
    data: webhookConfig,
    message: 'Webhook configured successfully',
    timestamp: new Date().toISOString(),
  } as ApiResponse<unknown>);
}));

// ============================================================================
// Export Routes
// ============================================================================

// GET /api/v1/segments/:segmentId/export - Export segment members
router.get(
  '/api/v1/segments/:segmentId/export',
  asyncHandler(async (req: Request, res: Response) => {
    const params = SegmentIdParamsSchema.parse(req.params);
    const query = ExportQuerySchema.parse(req.query);

    const exportData = await exportSegmentMembers(
      params.segmentId,
      query.format,
      query.includeMetadata
    );

    if (!exportData) {
      res.status(404).json({
        success: false,
        error: `Segment not found: ${params.segmentId}`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<never>);
      return;
    }

    if (query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${params.segmentId}_members.csv"`
      );
      res.send(exportData);
    } else {
      res.json({
        success: true,
        data: exportData,
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>);
    }
  })
);

// ============================================================================
// Error Handling Middleware
// ============================================================================

// Error handling middleware
router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Route error:', err);

  if (err instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
      timestamp: new Date().toISOString(),
    } as ApiResponse<never>);
    return;
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  } as ApiResponse<never>);
});

export default router;

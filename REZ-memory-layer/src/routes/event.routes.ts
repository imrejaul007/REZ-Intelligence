/**
 * REZ Memory Layer - Event Routes
 * API endpoints for event ingestion
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { normalizeEvent, toTimelineEvent } from '../utils/eventNormalizer';
import { TimelineEvent as TimelineEventModel } from '../models/TimelineEvent';
import { timelineAggregator } from '../services/timelineAggregator';
import { ApiResponse, EventIngestionRequest, EventIngestionResponse, BatchEventIngestionRequest, BatchEventIngestionResponse } from '../types/timeline';
import { logger } from '../config/logger';

const router = Router();

// Event ingestion schema
const EventSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  category: z.enum(['commerce', 'engagement', 'identity', 'loyalty', 'intelligence', 'support', 'marketing', 'notification']),
  source: z.enum(['whatsapp', 'support', 'order', 'payment', 'loyalty', 'campaign', 'qr', 'ai', 'push', 'auth', 'catalog', 'search', 'delivery', 'booking', 'dooh']),
  data: z.record(z.unknown()).optional().default({}),
  metadata: z.object({
    sessionId: z.string().optional(),
    deviceId: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    correlationId: z.string().optional()
  }).optional().default({}),
  timestamp: z.string().datetime().optional()
});

// Request ID middleware
function addRequestId(req: Request, res: Response, next: Function): void {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
}

/**
 * POST /api/events
 * Ingest a single event
 */
router.post('/', addRequestId, async (req: Request, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;

    // Validate event
    const validationResult = EventSchema.safeParse(req.body);
    if (!validationResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'INVALID_EVENT',
          message: 'Invalid event data',
          details: validationResult.error.errors
        },
        metadata: {
          timestamp: new Date(),
          requestId
        }
      };
      res.status(400).json(response);
      return;
    }

    const eventData = validationResult.data;
    const eventId = uuidv4();

    // Create event document
    const doc = new TimelineEventModel({
      id: eventId,
      userId: eventData.userId,
      type: eventData.type,
      category: eventData.category,
      source: eventData.source,
      timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
      data: eventData.data,
      metadata: {
        ...eventData.metadata,
        correlationId: eventData.metadata.correlationId || requestId
      }
    });

    await doc.save();

    logger.info('Event ingested', {
      eventId,
      userId: eventData.userId,
      type: eventData.type,
      source: eventData.source
    });

    // Update user profile asynchronously
    timelineAggregator.updateUserProfile(eventData.userId).catch(err => {
      logger.error('Failed to update profile:', err);
    });

    const response: ApiResponse<EventIngestionResponse> = {
      success: true,
      data: {
        success: true,
        eventId,
        message: 'Event ingested successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId
      }
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to ingest event:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to ingest event'
      }
    });
  }
});

/**
 * POST /api/events/batch
 * Batch ingest events
 */
router.post('/batch', addRequestId, async (req: Request, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;

    // Validate batch
    const BatchSchema = z.object({
      events: z.array(EventSchema).min(1).max(1000)
    });

    const validationResult = BatchSchema.safeParse(req.body);
    if (!validationResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'INVALID_BATCH',
          message: 'Invalid batch data',
          details: validationResult.error.errors
        },
        metadata: {
          timestamp: new Date(),
          requestId
        }
      };
      res.status(400).json(response);
      return;
    }

    const { events } = validationResult.data;
    const results: BatchEventIngestionResponse['results'] = [];
    let processed = 0;
    let failed = 0;

    // Process in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (eventData, index) => {
        const globalIndex = i + index;
        try {
          const eventId = uuidv4();

          const doc = new TimelineEventModel({
            id: eventId,
            userId: eventData.userId,
            type: eventData.type,
            category: eventData.category,
            source: eventData.source,
            timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
            data: eventData.data,
            metadata: {
              ...eventData.metadata,
              correlationId: eventData.metadata.correlationId || requestId
            }
          });

          await doc.save();

          results.push({
            index: globalIndex,
            success: true,
            eventId
          });
          processed++;

          // Update user profile (debounced)
          if (globalIndex % 10 === 0) {
            timelineAggregator.updateUserProfile(eventData.userId).catch(err => {
              logger.error('Failed to update profile:', err);
            });
          }
        } catch (error) {
          results.push({
            index: globalIndex,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failed++;
        }
      });

      await Promise.all(batchPromises);
    }

    // Sort results by index
    results.sort((a, b) => a.index - b.index);

    logger.info('Batch events ingested', {
      total: events.length,
      processed,
      failed,
      requestId
    });

    const response: ApiResponse<BatchEventIngestionResponse> = {
      success: true,
      data: {
        success: failed === 0,
        processed,
        failed,
        results
      },
      metadata: {
        timestamp: new Date(),
        requestId
      }
    };

    res.status(failed === 0 ? 201 : 207).json(response); // 207 = Multi-Status
  } catch (error) {
    logger.error('Failed to ingest batch:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to ingest batch'
      }
    });
  }
});

/**
 * POST /api/events/normalize
 * Normalize and preview an event without storing
 */
router.post('/normalize', addRequestId, async (req: Request, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const normalized = normalizeEvent(req.body);

      const response: ApiResponse<typeof normalized> = {
        success: true,
        data: normalized,
        metadata: {
          timestamp: new Date(),
          requestId
        }
      };

      res.json(response);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NORMALIZATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to normalize event'
        },
        metadata: {
          timestamp: new Date(),
          requestId
        }
      });
    }
  } catch (error) {
    logger.error('Failed to normalize event:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to normalize event'
      }
    });
  }
});

/**
 * GET /api/events/stats
 * Get event ingestion statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [lastHourCount, lastDayCount, totalCount, bySource] = await Promise.all([
      TimelineEventModel.countDocuments({ timestamp: { $gte: oneHourAgo } }),
      TimelineEventModel.countDocuments({ timestamp: { $gte: oneDayAgo } }),
      TimelineEventModel.countDocuments({}),
      TimelineEventModel.aggregate([
        { $match: { timestamp: { $gte: oneDayAgo } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        lastHour: lastHourCount,
        last24Hours: lastDayCount,
        total: totalCount,
        bySource: Object.fromEntries(bySource.map(s => [s._id, s.count]))
      },
      metadata: {
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve stats'
      }
    });
  }
});

export default router;

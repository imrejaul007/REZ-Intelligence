import { Router, Request, Response, NextFunction } from 'express';
import { OrchestrationRequestSchema, OrchestrationRequest } from '../models/OrchestrationRequest';
import { MessageProcessor } from '../services/messageProcessor';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

const router = Router();

export interface MessageRoutesConfig {
  processor: MessageProcessor;
}

export function createMessageRoutes(config: MessageRoutesConfig): Router {
  const { processor } = config;

  /**
   * POST /api/v2/message/process
   * Process an orchestration request
   */
  router.post('/process', async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || `REQ-${Date.now()}`;

    try {
      // Validate request body
      const validationResult = OrchestrationRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errorResponse = {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validationResult.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
          requestId,
        };

        logger.warn('Request validation failed', {
          requestId,
          errors: validationResult.error.issues,
        });

        return res.status(400).json(errorResponse);
      }

      const request: OrchestrationRequest = validationResult.data;

      logger.info('Processing message request', {
        requestId,
        messageLength: request.message.length,
        hasRoutingHints: !!request.routingHints,
      });

      const result = await processor.processMessage(request, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const processingTimeMs = Date.now() - startTime;

      // Log performance metrics
      if (processingTimeMs > 5000) {
        logger.warn('Request processing exceeded threshold', {
          requestId,
          processingTimeMs,
          threshold: 5000,
        });
      }

      res.status(result.response.status === 'failed' ? 500 : 200).json({
        ...result.response,
        processingTimeMs,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v2/message/process/stream
   * Process an orchestration request with streaming response
   */
  router.post('/process/stream', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || `REQ-${Date.now()}`;

    try {
      const validationResult = OrchestrationRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validationResult.error.issues,
          requestId,
        });
      }

      const request: OrchestrationRequest = validationResult.data;

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Request-Id', requestId);

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connected', requestId })}\n\n`);

      // Process request (in production, this would stream results)
      const result = await processor.processMessage(request);

      // Send completion event
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        requestId,
        response: result.response,
      })}\n\n`);

      res.end();
    } catch (error) {
      // Send error event
      res.write(`data: ${JSON.stringify({
        type: 'error',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })}\n\n`);
      res.end();
      next(error);
    }
  });

  /**
   * POST /api/v2/message/batch
   * Process multiple orchestration requests in batch
   */
  router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = `BATCH-${Date.now()}`;

    try {
      const { requests, parallel = false } = req.body;

      if (!Array.isArray(requests)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'requests must be an array',
          requestId,
        });
      }

      if (requests.length > 50) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Maximum 50 requests per batch',
          requestId,
        });
      }

      logger.info('Processing batch request', {
        requestId,
        requestCount: requests.length,
        parallel,
      });

      const results = [];
      const startTime = Date.now();

      if (parallel) {
        // Process all requests in parallel
        const promises = requests.map(async (request, index) => {
          try {
            const validationResult = OrchestrationRequestSchema.safeParse(request);
            if (!validationResult.success) {
              return {
                index,
                success: false,
                error: validationResult.error.issues,
              };
            }

            const result = await processor.processMessage(validationResult.data);
            return {
              index,
              success: true,
              response: result.response,
            };
          } catch (error) {
            return {
              index,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      } else {
        // Process requests sequentially
        for (let i = 0; i < requests.length; i++) {
          try {
            const validationResult = OrchestrationRequestSchema.safeParse(requests[i]);
            if (!validationResult.success) {
              results.push({
                index: i,
                success: false,
                error: validationResult.error.issues,
              });
              continue;
            }

            const result = await processor.processMessage(validationResult.data);
            results.push({
              index: i,
              success: true,
              response: result.response,
            });
          } catch (error) {
            results.push({
              index: i,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      const totalTimeMs = Date.now() - startTime;

      res.json({
        requestId,
        totalTimeMs,
        processedCount: results.filter(r => r.success).length,
        failedCount: results.filter(r => !r.success).length,
        results: results.sort((a, b) => a.index - b.index),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createMessageRoutes;

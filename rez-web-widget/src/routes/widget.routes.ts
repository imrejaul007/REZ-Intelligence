import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// Session creation request schema
const createSessionSchema = z.object({
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /widget.js - Serve the widget JavaScript
 */
router.get('/widget.js', (_req: Request, res: Response) => {
  const widgetPath = path.join(__dirname, '../public/widget.js');

  // Check if file exists
  if (!fs.existsSync(widgetPath)) {
    res.status(404).send('Widget script not found');
    return;
  }

  // Set appropriate headers for JavaScript
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.sendFile(widgetPath);
});

/**
 * GET /widget.css - Serve the widget styles
 */
router.get('/widget.css', (_req: Request, res: Response) => {
  const cssPath = path.join(__dirname, '../public/widget.css');

  // Check if file exists
  if (!fs.existsSync(cssPath)) {
    res.status(404).send('Widget styles not found');
    return;
  }

  // Set appropriate headers for CSS
  res.setHeader('Content-Type', 'text/css');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.sendFile(cssPath);
});

/**
 * POST /api/session - Create a new chat session
 * Used when embedding the widget without WebSocket (REST fallback)
 */
router.post('/api/session', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = createSessionSchema.parse(req.body);

    // Generate session ID
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session = {
      sessionId,
      userId: body.userId,
      createdAt: now,
      lastActivityAt: now,
      messageCount: 0,
      metadata: body.metadata || {},
    };

    // Store session in memory (in production, use Redis)
    // For now, we'll store it in a simple Map
    globalThis.__widgetSessions = globalThis.__widgetSessions || new Map();
    globalThis.__widgetSessions.set(sessionId, session);

    res.status(201).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        userId: session.userId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create session',
    });
  }
});

/**
 * POST /api/session/:sessionId/message - Send a message (REST fallback)
 */
router.post(
  '/api/session/:sessionId/message',
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Validate request body
      const messageSchema = z.object({
        message: z.string().min(1).max(5000),
      });

      const { message } = messageSchema.parse(req.body);

      // Retrieve session
      globalThis.__widgetSessions = globalThis.__widgetSessions || new Map();
      const session = globalThis.__widgetSessions.get(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found or expired',
        });
        return;
      }

      // Update session activity
      session.lastActivityAt = new Date().toISOString();
      session.messageCount += 1;

      // Store user message
      session.messages = session.messages || [];
      session.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });

      // In production, this would call the orchestrator
      // For now, return a simple acknowledgment
      const responseMessage = {
        role: 'assistant' as const,
        content: 'Thanks for your message! For real-time AI responses, please use the WebSocket connection.',
        timestamp: new Date().toISOString(),
      };

      session.messages.push(responseMessage);

      res.json({
        success: true,
        response: responseMessage,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process message',
      });
    }
  }
);

/**
 * GET /api/session/:sessionId - Get session details
 */
router.get('/api/session/:sessionId', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  globalThis.__widgetSessions = globalThis.__widgetSessions || new Map();
  const session = globalThis.__widgetSessions.get(sessionId);

  if (!session) {
    res.status(404).json({
      success: false,
      error: 'Session not found or expired',
    });
    return;
  }

  res.json({
    success: true,
    session: {
      sessionId: session.sessionId,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      messageCount: session.messageCount,
    },
  });
});

/**
 * DELETE /api/session/:sessionId - End a session
 */
router.delete('/api/session/:sessionId', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  globalThis.__widgetSessions = globalThis.__widgetSessions || new Map();
  const existed = globalThis.__widgetSessions.delete(sessionId);

  if (!existed) {
    res.status(404).json({
      success: false,
      error: 'Session not found or expired',
    });
    return;
  }

  res.json({
    success: true,
    message: 'Session ended successfully',
  });
});

/**
 * GET /api/health - Widget service health check
 */
router.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-web-widget',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as widgetRoutes };

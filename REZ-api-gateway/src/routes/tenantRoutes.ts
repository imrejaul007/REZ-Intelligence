/**
 * Tenant Routes
 * Routes requests with tenant isolation context
 */

import { Router, Request, Response } from 'express';
import { ClientType } from '../middleware/tenantIsolation';
import { ValidationError } from '../middleware/errorHandler';

export function createTenantRouter(): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────
  // INTELLIGENCE ROUTES
  // ─────────────────────────────────────────────────────────

  // Get user profile/segments
  router.get('/profile/:userId', (req: Request, res: Response) => {
    const { tenant } = req;
    const { userId } = req.params;

    // Check data isolation rules
    if (tenant?.clientType === ClientType.NON_REZ || tenant?.clientType === ClientType.RABTUL_SAAS) {
      // These clients can only access their own user data
      // In production, verify user belongs to tenant
    }

    // Proxy to appropriate service
    res.json({
      success: true,
      data: {
        userId,
        tenantId: tenant?.tenantId,
        clientType: tenant?.clientType,
        // In production: fetch from REZ-memory-layer or unified profile
        segments: [],
        signals: {},
        preferences: {}
      }
    });
  });

  // Get intent predictions
  router.post('/intent/predict', (req: Request, res: Response) => {
    const { tenant } = req;
    const { userId, context } = req.body;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    res.json({
      success: true,
      data: {
        userId,
        intent: {},
        confidence: 0.8,
        tenantId: tenant?.tenantId,
        // In production: call REZ intent service
      }
    });
  });

  // Get recommendations
  router.get('/recommendations/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    res.json({
      success: true,
      data: {
        userId,
        recommendations: [],
        // In production: call recommendation service
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // MEMORY ROUTES
  // ─────────────────────────────────────────────────────────

  // Get customer timeline
  router.get('/timeline/:userId', (req: Request, res: Response) => {
    const { tenant } = req;
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    res.json({
      success: true,
      data: {
        userId,
        tenantId: tenant?.tenantId,
        events: [],
        // In production: call REZ-memory-layer
      }
    });
  });

  // Add to timeline
  router.post('/timeline', (req: Request, res: Response) => {
    const { tenant } = req;
    const { userId, eventType, data } = req.body;

    if (!userId || !eventType) {
      throw new ValidationError('userId and eventType are required');
    }

    res.json({
      success: true,
      data: {
        eventId: `evt_${Date.now()}`,
        userId,
        tenantId: tenant?.tenantId,
        // In production: call REZ-memory-layer
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // PREDICTION ROUTES
  // ─────────────────────────────────────────────────────────

  // Get churn prediction
  router.get('/predict/churn/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;

    res.json({
      success: true,
      data: {
        userId,
        churnRisk: 'low',
        probability: 0.15,
        // In production: call REZ-predictive-engine
      }
    });
  });

  // Get LTV prediction
  router.get('/predict/ltv/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;

    res.json({
      success: true,
      data: {
        userId,
        ltv: 0,
        tier: 'standard',
        // In production: call REZ-predictive-engine
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // CARE ROUTES
  // ─────────────────────────────────────────────────────────

  // Get support tickets
  router.get('/care/tickets', (req: Request, res: Response) => {
    const { tenant } = req;
    const { userId, status } = req.query;

    res.json({
      success: true,
      data: {
        tickets: [],
        tenantId: tenant?.tenantId,
        // In production: call REZ-care-service
      }
    });
  });

  // Create support ticket
  router.post('/care/tickets', (req: Request, res: Response) => {
    const { tenant } = req;
    const { userId, subject, message, category } = req.body;

    if (!userId || !subject || !message) {
      throw new ValidationError('userId, subject, and message are required');
    }

    res.json({
      success: true,
      data: {
        ticketId: `ticket_${Date.now()}`,
        userId,
        tenantId: tenant?.tenantId,
        // In production: call REZ-care-service
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // WHATSAPP ROUTES
  // ─────────────────────────────────────────────────────────

  // Send WhatsApp message
  router.post('/whatsapp/send', (req: Request, res: Response) => {
    const { tenant } = req;
    const { phone, template, variables } = req.body;

    if (!phone || !template) {
      throw new ValidationError('phone and template are required');
    }

    res.json({
      success: true,
      data: {
        messageId: `msg_${Date.now()}`,
        tenantId: tenant?.tenantId,
        // In production: call REZ-whatsapp
      }
    });
  });

  return router;
}

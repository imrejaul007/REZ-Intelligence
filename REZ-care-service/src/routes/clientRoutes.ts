/**
 * REZ Care - Multi-Tenant Client Routes
 *
 * API for managing client/merchant email configurations:
 * - Register new clients
 * - Configure custom emails
 * - Set up routing rules
 * - Brand customization
 */

import express, { Request, Response } from 'express';
import { multiTenantEmail, ClientConfig } from '../services/multiTenantEmail';
import { logger } from '../utils/logger';

const router = express.Router();

// ============================================
// CLIENT MANAGEMENT
// ============================================

/**
 * Register a new client
 * POST /api/clients
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const config: ClientConfig = req.body;

    // Validate required fields
    if (!config.clientId || !config.email || !config.domain) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, email, domain',
      });
      return;
    }

    multiTenantEmail.registerClient(config);

    logger.info('[ClientRoutes] Registered new client', { clientId: config.clientId });

    res.json({
      success: true,
      message: `Client ${config.clientId} registered`,
      client: {
        clientId: config.clientId,
        email: config.email,
        domain: config.domain,
      },
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to register client', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all clients
 * GET /api/clients
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const clients = multiTenantEmail.getAllClients();

    res.json({
      success: true,
      count: clients.length,
      clients: clients.map(c => ({
        clientId: c.clientId,
        clientName: c.clientName,
        email: c.email,
        domain: c.domain,
        industry: c.industry,
      })),
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to get clients', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get client by ID
 * GET /api/clients/:clientId
 */
router.get('/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const client = multiTenantEmail.getClient(clientId);

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({ success: true, client });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to get client', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update client
 * PUT /api/clients/:clientId
 */
router.put('/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const updates = req.body;

    const existing = multiTenantEmail.getClient(clientId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Re-register with updates
    const updated = { ...existing, ...updates, clientId };
    multiTenantEmail.registerClient(updated);

    res.json({
      success: true,
      message: `Client ${clientId} updated`,
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to update client', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete client
 * DELETE /api/clients/:clientId
 */
router.delete('/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    // Note: In real implementation, remove from registry
    logger.info('[ClientRoutes] Delete requested', { clientId });

    res.json({
      success: true,
      message: `Client ${clientId} deleted (stub)`,
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to delete client', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT EMAIL CONFIG
// ============================================

/**
 * Configure client email settings
 * POST /api/clients/:clientId/email
 */
router.post('/:clientId/email', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { supportEmail, smtpConfig, autoResponseTemplate } = req.body;

    const client = multiTenantEmail.getClient(clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Update email config
    const updated = {
      ...client,
      email: supportEmail || client.email,
      smtpConfig,
      autoResponseTemplate,
    };

    multiTenantEmail.registerClient(updated);

    res.json({
      success: true,
      message: 'Email configuration updated',
      email: supportEmail || client.email,
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to configure email', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get client email configuration
 * GET /api/clients/:clientId/email
 */
router.get('/:clientId/email', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const client = multiTenantEmail.getClient(clientId);

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({
      success: true,
      email: {
        supportEmail: client.email,
        domain: client.domain,
        hasSMTP: !!client.smtpConfig,
        hasCustomTemplate: !!client.autoResponseTemplate,
      },
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to get email config', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT ROUTING RULES
// ============================================

/**
 * Set routing rules for client
 * POST /api/clients/:clientId/routing
 */
router.post('/:clientId/routing', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { rules } = req.body;

    const client = multiTenantEmail.getClient(clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const updated = { ...client, routingRules: rules };
    multiTenantEmail.registerClient(updated);

    res.json({
      success: true,
      message: 'Routing rules updated',
      rules,
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to set routing rules', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get routing rules
 * GET /api/clients/:clientId/routing
 */
router.get('/:clientId/routing', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const client = multiTenantEmail.getClient(clientId);

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({
      success: true,
      rules: client.routingRules || [],
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to get routing rules', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT BRANDING
// ============================================

/**
 * Set client branding
 * POST /api/clients/:clientId/branding
 */
router.post('/:clientId/branding', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { color, logo, language, timezone } = req.body;

    const client = multiTenantEmail.getClient(clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const updated = {
      ...client,
      color: color || client.color,
      logo,
      language: language || client.language,
      timezone: timezone || client.timezone,
    };

    multiTenantEmail.registerClient(updated);

    res.json({
      success: true,
      message: 'Branding updated',
      branding: { color: updated.color, logo: updated.logo, language: updated.language },
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to set branding', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT CUSTOM RESPONSES
// ============================================

/**
 * Set custom responses for client
 * POST /api/clients/:clientId/responses
 */
router.post('/:clientId/responses', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { responses } = req.body;

    const client = multiTenantEmail.getClient(clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const updated = { ...client, customResponses: responses };
    multiTenantEmail.registerClient(updated);

    res.json({
      success: true,
      message: 'Custom responses updated',
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to set responses', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT STATISTICS
// ============================================

/**
 * Get client statistics
 * GET /api/clients/:clientId/stats
 */
router.get('/:clientId/stats', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const stats = multiTenantEmail.getClientStats(clientId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to get stats', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMAIL PROCESSING
// ============================================

/**
 * Process email for specific client
 * POST /api/clients/process-email
 */
router.post('/process-email', async (req: Request, res: Response) => {
  try {
    const { from, to, subject, body, attachments } = req.body;

    const result = await multiTenantEmail.processEmailForClient({
      from,
      to,
      subject,
      body,
      attachments,
      date: new Date().toISOString(),
      messageId: `api-${Date.now()}`,
    });

    res.json({
      success: true,
      clientId: result.client.clientId,
      clientName: result.client.clientName,
      actions: result.actions,
      parsed: {
        category: result.parsed.category,
        priority: result.parsed.priority,
        sentiment: result.parsed.sentiment,
      },
    });
  } catch (error) {
    logger.error('[ClientRoutes] Failed to process email', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

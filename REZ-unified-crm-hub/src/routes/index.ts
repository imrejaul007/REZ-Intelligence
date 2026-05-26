/**
 * REZ Unified CRM Hub - API Routes
 *
 * ⚠️ INTERNAL USE ONLY - For REZ Platform Team Only ⚠️
 *
 * This API contains sensitive internal intelligence data.
 * All endpoints require internal service token authentication.
 *
 * Endpoint Classification:
 * - /internal/* - 🔒 INTERNAL: Full intelligence data (AI predictions, intent, engagement)
 * - /merchant/* - 👁️ MERCHANT-FACING: Sanitized data safe for merchants
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { customerAggregator } from '../services/customerAggregator.js';
import { dashboardService } from '../services/dashboardService.js';
import { inboxService } from '../services/inboxService.js';
import { validateInternalToken } from '../middleware/auth.js';
import { logger } from './utils/logger.js';
import type {
  InternalCustomer,
  InternalSmartTag,
  InternalSegment,
  DashboardOverview,
  InboxMessage,
  InboxChannel,
} from '../types/index.js';

const router = Router();

// Apply internal token validation
router.use(validateInternalToken);

// ============================================
// 🔒 INTERNAL DASHBOARD ROUTES
// ============================================

/**
 * 🔒 GET /api/v1/internal/dashboard/overview
 * Get complete dashboard overview with internal metrics
 */
router.get('/internal/dashboard/overview', async (req: Request, res: Response) => {
  try {
    const filters = {
      merchantId: req.query.merchantId as string,
      storeId: req.query.storeId as string,
    };

    const overview = await dashboardService.getOverview(filters);

    res.json({
      success: true,
      data: overview,
      // 🔒 INTERNAL: Metadata about data freshness and sources
      meta: {
        generatedAt: new Date(),
        dataSources: ['REZ_NOW', 'REZ_MEDIA', 'REZ_INTELLIGENCE', 'CORPPERKS'],
        internal: true,
      },
    });
  } catch (error) {
    logger.error('Error fetching internal dashboard overview', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard overview',
    });
  }
});

// ============================================
// CUSTOMER ROUTES
// ============================================

/**
 * GET /api/v1/internal/customers
 * List customers with internal intelligence
 */
router.get('/internal/customers', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await customerAggregator.searchCustomers({
      query: req.query.q as string,
      segmentIds: req.query.segmentIds
        ? (req.query.segmentIds as string).split(',')
        : undefined,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result.customers,
      meta: {
        page,
        limit,
        total: result.total,
        hasMore: page * limit < result.total,
      },
    });
  } catch (error) {
    logger.error('Error listing customers', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list customers',
    });
  }
});

/**
 * GET /api/v1/customers/:customerId
 * Get customer details
 */
router.get('/customers/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const customer = await customerAggregator.getCustomer(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Get smart tags for this customer
    const smartTags = await customerAggregator.getCustomerSmartTags(customerId);
    customer.smartTags = smartTags;

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    logger.error('Error fetching customer', {
      customerId: req.params.customerId,
      error,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer',
    });
  }
});

/**
 * GET /api/v1/internal/customers/:customerId/segments
 * Get customer segments
 */
router.get(
  '/internal/customers/:customerId/segments',
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const segments = await customerAggregator.getInternalSegments(customerId);

      res.json({
        success: true,
        data: segments,
      });
    } catch (error) {
      logger.error('Error fetching customer segments', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch segments',
      });
    }
  }
);

/**
 * GET /api/v1/internal/customers/:customerId/predictions
 * Get AI predictions for customer
 */
router.get(
  '/internal/customers/:customerId/predictions',
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const predictions =
        await customerAggregator.getInternalPredictions(customerId);

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error) {
      logger.error('Error fetching customer predictions', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch predictions',
      });
    }
  }
);

/**
 * GET /api/v1/customers/:customerId/tags
 * Get smart tags for customer
 */
router.get('/customers/:customerId/tags', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const tags = await customerAggregator.getCustomerSmartTags(customerId);

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    logger.error('Error fetching customer tags', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tags',
    });
  }
});

// ============================================
// SEGMENT ROUTES
// ============================================

/**
 * GET /api/v1/segments
 * List all segments
 */
router.get('/segments', async (req: Request, res: Response) => {
  try {
    // Would fetch from segments service
    const segments: InternalSegment[] = [
      {
        id: 'champions',
        name: 'Champions',
        type: 'RFM',
        description: 'Best customers with high recency, frequency, and monetary value',
        rules: [],
        logic: 'AND',
        customerCount: 150,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'loyal',
        name: 'Loyal Customers',
        type: 'RFM',
        description: 'Customers with moderate frequency and monetary value',
        rules: [],
        logic: 'AND',
        customerCount: 320,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'potential',
        name: 'Potential Loyalists',
        type: 'RFM',
        description: 'Recent customers with good potential',
        rules: [],
        logic: 'AND',
        customerCount: 280,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'at_risk',
        name: 'At Risk',
        type: 'PREDICTIVE',
        description: 'Customers showing signs of churn',
        rules: [],
        logic: 'AND',
        customerCount: 120,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'new',
        name: 'New Customers',
        type: 'BEHAVIORAL',
        description: 'Recently acquired customers',
        rules: [],
        logic: 'AND',
        customerCount: 200,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    res.json({
      success: true,
      data: segments,
    });
  } catch (error) {
    logger.error('Error listing segments', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list segments',
    });
  }
});

/**
 * GET /api/v1/segments/:segmentId
 * Get segment details
 */
router.get('/segments/:segmentId', async (req: Request, res: Response) => {
  try {
    const { segmentId } = req.params;

    // Would fetch from segments service
    res.json({
      success: true,
      data: {
        id: segmentId,
        name: 'Segment',
        type: 'BEHAVIORAL' as const,
        rules: [],
        logic: 'AND' as const,
        customerCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error fetching segment', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch segment',
    });
  }
});

// ============================================
// SMART TAGS ROUTES
// ============================================

/**
 * GET /api/v1/tags
 * List all smart tags
 */
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const tags: InternalSmartTag[] = [
      {
        id: 'high_spender',
        name: 'High Spender',
        slug: 'high_spender',
        description: 'Average order value is 2x above store average',
        category: 'SPENDING',
        color: '#9333ea',
        customerCount: 245,
        confidence: 0.85,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
      {
        id: 'weekend_visitor',
        name: 'Weekend Visitor',
        slug: 'weekend_visitor',
        description: '>60% of visits on Saturday/Sunday',
        category: 'TIMING',
        color: '#3b82f6',
        customerCount: 380,
        confidence: 0.78,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
      {
        id: 'late_night_customer',
        name: 'Late Night Customer',
        slug: 'late_night_customer',
        description: '>40% of orders placed after 9 PM',
        category: 'TIMING',
        color: '#6366f1',
        customerCount: 165,
        confidence: 0.72,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
      {
        id: 'brand_loyalist',
        name: 'Brand Loyalist',
        slug: 'brand_loyalist',
        description: 'Single merchant/store preference',
        category: 'LOYALTY',
        color: '#8b5cf6',
        customerCount: 520,
        confidence: 0.82,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
      {
        id: 'returning_customer',
        name: 'Returning Customer',
        slug: 'returning_customer',
        description: 'Has placed 5+ orders',
        category: 'LOYALTY',
        color: '#84cc16',
        customerCount: 680,
        confidence: 0.95,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
      {
        id: 'churn_risk',
        name: 'Churn Risk',
        slug: 'churn_risk',
        description: 'High probability of churn',
        category: 'LOYALTY',
        color: '#ef4444',
        customerCount: 85,
        confidence: 0.68,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
      {
        id: 'vegan_customer',
        name: 'Vegan Customer',
        slug: 'vegan_customer',
        description: 'Multiple vegan/vegetarian orders detected',
        category: 'PREFERENCES',
        color: '#22c55e',
        customerCount: 120,
        confidence: 0.75,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
      {
        id: 'fitness_focused',
        name: 'Fitness Focused',
        slug: 'fitness_focused',
        description: 'Regularly purchases fitness/health products',
        category: 'LIFESTYLE',
        color: '#06b6d4',
        customerCount: 95,
        confidence: 0.71,
        isAutoGenerated: true,
        createdAt: new Date(),
      },
    ];

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    logger.error('Error listing tags', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list tags',
    });
  }
});

// ============================================
// INBOX ROUTES
// ============================================

/**
 * GET /api/v1/inbox/messages
 * Get inbox messages
 */
router.get('/inbox/messages', async (req: Request, res: Response) => {
  try {
    const filters = {
      channel: req.query.channel as unknown,
      customerId: req.query.customerId as string,
      status: req.query.status as unknown,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await inboxService.getMessages(filters);

    res.json({
      success: true,
      data: result.messages,
      meta: {
        total: result.total,
        unreadCount: result.unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching inbox messages', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
    });
  }
});

/**
 * GET /api/v1/inbox/channels
 * Get inbox channels summary
 */
router.get('/inbox/channels', async (req: Request, res: Response) => {
  try {
    const channels = await inboxService.getChannels();

    res.json({
      success: true,
      data: channels,
    });
  } catch (error) {
    logger.error('Error fetching inbox channels', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels',
    });
  }
});

/**
 * POST /api/v1/inbox/messages/:messageId/reply
 * Reply to a message
 */
router.post('/inbox/messages/:messageId/reply', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { content, channel } = req.body;

    const message = await inboxService.sendMessage(
      channel,
      messageId,
      content
    );

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    logger.error('Error sending reply', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to send reply',
    });
  }
});

// ============================================
// HEALTH ROUTES
// ============================================

import { rezServices } from '../services/rezServices.js';

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-unified-crm-hub',
    type: 'internal',
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check service connections
    const services = await rezServices.checkServicesHealth();
    const allHealthy = services.every(s => s.healthy);

    res.json({
      ready: allHealthy,
      service: 'rez-unified-crm-hub',
      type: 'internal',
      services,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      service: 'rez-unified-crm-hub',
      error: 'Service health check failed',
    });
  }
});

router.get('/services', async (_req: Request, res: Response) => {
  try {
    const services = await rezServices.checkServicesHealth();
    res.json({
      success: true,
      data: services,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check services',
    });
  }
});

export default router;

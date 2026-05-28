/**
 * Merchant API Routes
 *
 * MERCHANT-FACING API - Safe data only for merchants
 *
 * These endpoints return ONLY merchant-safe data:
 * - Customer names, orders, basic segments
 * - NO AI predictions, engagement scores, intent signals
 * - NO raw behavioral data
 *
 * This API is safe to expose to merchants and their applications.
 */

import { Router, Request, Response } from 'express';
import { customerAggregator } from '../services/customerAggregator.js';
import { inboxService } from '../services/inboxService.js';
import {
  toMerchantCustomer,
  toMerchantCustomerDetail,
  toMerchantSegment,
  sanitizeCustomerList,
  sanitizeSegmentList,
  validateMerchantSafe,
} from '../services/sanitizer.js';
import { logger } from '../utils/logger.js';
import type {
  MerchantCustomer,
  MerchantCustomerDetail,
  MerchantSegment,
  MerchantTag,
  InboxMessage,
  InboxChannel,
} from '../types/index.js';

// Extended Request interface for merchant auth
interface MerchantRequest extends Request {
  merchantId?: string;
  merchantName?: string;
  merchantPermissions?: string[];
}

const router = Router();

// ============================================
// PUBLIC AUTH ENDPOINTS (No auth required)
// ============================================

// Simple token generation for development
function generateMerchantToken(data: { merchantId: string; merchantName: string; permissions: string[]; storeIds: string[] }): string {
  const payload = {
    ...data,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * POST /api/v1/merchant/auth/token
 * Generate test token (development only)
 */
router.post('/auth/token', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Token generation not available in production',
    });
  }

  const { merchantId, merchantName } = req.body;

  if (!merchantId) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'merchantId required',
    });
  }

  const token = generateMerchantToken({
    merchantId,
    merchantName: merchantName || 'Test Merchant',
    permissions: ['read:customers', 'write:customers', 'read:orders', 'write:orders'],
    storeIds: [],
  });

  res.json({
    success: true,
    data: {
      token,
      type: 'Bearer',
      expiresIn: '7d',
    },
  });
});

/**
 * GET /api/v1/merchant/auth/me
 * Get current merchant info
 */
router.get('/auth/me', (req: MerchantRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      merchantId: req.merchantId,
      merchantName: req.merchantName,
      permissions: req.merchantPermissions,
    },
  });
});


// ============================================
// CUSTOMER ROUTES
// ============================================

/**
 * GET /api/v1/merchant/customers
 * List merchant's customers (sanitized)
 */
router.get('/customers', async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    logger.info('Merchant API: Fetching customers', {
      merchantId,
      page,
      limit,
    });

    // In production, filter by merchant's customers only
    // For now, return mock data
    const mockCustomers: MerchantCustomer[] = [
      {
        id: '1',
        userId: 'user-1',
        name: 'Rahul Sharma',
        phone: '+91 98765 43210',
        segments: ['VIP', 'Regular'],
        totalOrders: 45,
        totalSpend: 125000,
        averageOrderValue: 2778,
        lastVisit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        joinedDate: new Date('2024-01-15'),
      },
      {
        id: '2',
        userId: 'user-2',
        name: 'Priya Patel',
        phone: '+91 87654 32109',
        segments: ['Regular'],
        totalOrders: 28,
        totalSpend: 72000,
        averageOrderValue: 2571,
        lastVisit: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        joinedDate: new Date('2024-02-20'),
      },
      {
        id: '3',
        userId: 'user-3',
        name: 'Amit Kumar',
        phone: '+91 76543 21098',
        segments: ['New'],
        totalOrders: 8,
        totalSpend: 18000,
        averageOrderValue: 2250,
        lastVisit: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        joinedDate: new Date('2024-03-10'),
      },
      {
        id: '4',
        userId: 'user-4',
        name: 'Sneha Reddy',
        phone: '+91 65432 10987',
        segments: ['VIP'],
        totalOrders: 52,
        totalSpend: 156000,
        averageOrderValue: 3000,
        lastVisit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        joinedDate: new Date('2023-06-15'),
      },
      {
        id: '5',
        userId: 'user-5',
        name: 'Vikram Singh',
        phone: '+91 54321 09876',
        segments: ['Regular'],
        totalOrders: 15,
        totalSpend: 38000,
        averageOrderValue: 2533,
        lastVisit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        joinedDate: new Date('2024-01-05'),
      },
    ];

    // Apply search filter
    let filtered = mockCustomers;
    if (req.query.search) {
      const search = (req.query.search as string).toLowerCase();
      filtered = mockCustomers.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.phone?.includes(search)
      );
    }

    // Apply segment filter
    if (req.query.segment) {
      const segment = req.query.segment as string;
      filtered = filtered.filter(c => c.segments.includes(segment));
    }

    // Validate response is merchant-safe
    for (const customer of filtered) {
      validateMerchantSafe(customer as unknown as Record<string, unknown>);
    }

    res.json({
      success: true,
      data: filtered,
      meta: {
        page,
        limit,
        total: filtered.length,
        hasMore: page * limit < filtered.length,
      },
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching customers', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
    });
  }
});

/**
 * GET /api/v1/merchant/customers/:id
 * Get customer details (sanitized)
 */
router.get('/customers/:id', async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { id } = req.params;

    logger.info('Merchant API: Fetching customer detail', {
      merchantId,
      customerId: id,
    });

    // In production, fetch from customer aggregator with merchant filter
    // Return mock data for now
    const customerDetail: MerchantCustomerDetail = {
      id,
      name: 'Rahul Sharma',
      phone: '+91 98765 43210',
      email: 'rahul@example.com',
      orders: [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          storeName: 'Main Store',
          items: ['Premium Pizza', 'Garlic Bread', 'Coke'],
          total: 1250,
          status: 'delivered',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'order-2',
          orderNumber: 'ORD-002',
          storeName: 'Main Store',
          items: ['Biryani Combo', 'Raita'],
          total: 450,
          status: 'delivered',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      ],
      reviews: [
        {
          id: 'review-1',
          rating: 5,
          comment: 'Great food and service!',
          storeName: 'Main Store',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      ],
      totalOrders: 45,
      totalSpend: 125000,
      averageOrderValue: 2778,
      lastVisit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      joinedDate: new Date('2024-01-15'),
      segments: ['VIP', 'Regular'],
      tags: [
        { name: 'Weekend Visitor', color: '#3b82f6' },
        { name: 'Foodie', color: '#f59e0b' },
      ],
    };

    // Validate response is merchant-safe
    validateMerchantSafe(customerDetail as unknown as Record<string, unknown>);

    res.json({
      success: true,
      data: customerDetail,
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching customer detail', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer details',
    });
  }
});

/**
 * GET /api/v1/merchant/customers/:id/orders
 * Get customer orders
 */
router.get('/customers/:id/orders', async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { id } = req.params;

    // Mock order data
    const orders = [
      {
        id: 'order-1',
        orderNumber: 'ORD-001',
        storeName: 'Main Store',
        items: ['Premium Pizza', 'Garlic Bread', 'Coke'],
        total: 1250,
        status: 'delivered',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'order-2',
        orderNumber: 'ORD-002',
        storeName: 'Main Store',
        items: ['Biryani Combo', 'Raita'],
        total: 450,
        status: 'delivered',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    ];

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching orders', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
    });
  }
});

/**
 * GET /api/v1/merchant/customers/:id/reviews
 * Get customer reviews
 */
router.get('/customers/:id/reviews', async (req: Request, res: Response) => {
  try {
    const reviews = [
      {
        id: 'review-1',
        rating: 5,
        comment: 'Great food and service!',
        storeName: 'Main Store',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    ];

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching reviews', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews',
    });
  }
});

// ============================================
// SEGMENT ROUTES
// ============================================

/**
 * GET /api/v1/merchant/segments
 * List merchant's segments (sanitized)
 */
router.get('/segments', async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId;

    logger.info('Merchant API: Fetching segments', { merchantId });

    // Mock segment data
    const segments: MerchantSegment[] = [
      {
        id: 'vip',
        name: 'VIP Customers',
        description: 'High-value repeat customers',
        customerCount: 150,
        totalRevenue: 450000,
      },
      {
        id: 'regular',
        name: 'Regular Customers',
        description: 'Occasional visitors',
        customerCount: 320,
        totalRevenue: 640000,
      },
      {
        id: 'new',
        name: 'New Customers',
        description: 'Recently acquired',
        customerCount: 200,
        totalRevenue: 200000,
      },
      {
        id: 'at-risk',
        name: 'Needs Attention',
        description: 'Havent visited recently',
        customerCount: 120,
        totalRevenue: 180000,
      },
    ];

    // Validate response is merchant-safe
    for (const segment of segments) {
      validateMerchantSafe(segment as unknown as Record<string, unknown>);
    }

    res.json({
      success: true,
      data: segments,
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching segments', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch segments',
    });
  }
});

// ============================================
// INBOX ROUTES
// ============================================

/**
 * GET /api/v1/merchant/inbox/messages
 * Get inbox messages (sanitized)
 */
router.get('/inbox/messages', async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const channel = req.query.channel as string;

    // Mock messages
    const messages: InboxMessage[] = [
      {
        id: 'msg-1',
        channel: 'WHATSAPP',
        customerId: 'user-1',
        customerName: 'Rahul Sharma',
        customerPhone: '+91 98765 43210',
        direction: 'INBOUND',
        type: 'TEXT',
        content: 'Thanks for the order!',
        status: 'RECEIVED',
        createdAt: new Date(Date.now() - 2 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 60 * 1000),
      },
      {
        id: 'msg-2',
        channel: 'INSTAGRAM',
        customerId: 'user-2',
        customerName: 'Priya Patel',
        direction: 'INBOUND',
        type: 'TEXT',
        content: 'Is the weekend special still available?',
        status: 'READ',
        readAt: new Date(Date.now() - 5 * 60 * 1000),
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: 'msg-3',
        channel: 'APP_PUSH',
        customerId: 'user-3',
        customerName: 'Amit Kumar',
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: 'We miss you! Here is a special offer...',
        status: 'RECEIVED',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ];

    // Filter by channel if specified
    let filtered = messages;
    if (channel) {
      filtered = messages.filter(m => m.channel === channel);
    }

    res.json({
      success: true,
      data: filtered,
      meta: {
        total: filtered.length,
        unreadCount: filtered.filter(m => m.status === 'RECEIVED').length,
      },
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching messages', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
    });
  }
});

/**
 * GET /api/v1/merchant/inbox/channels
 * Get inbox channels status
 */
router.get('/inbox/channels', async (req: Request, res: Response) => {
  try {
    const channels: InboxChannel[] = [
      {
        channel: 'WHATSAPP',
        name: 'WhatsApp',
        icon: 'message-circle',
        unreadCount: 12,
        isConnected: true,
      },
      {
        channel: 'INSTAGRAM',
        name: 'Instagram',
        icon: 'instagram',
        unreadCount: 5,
        isConnected: true,
      },
      {
        channel: 'SMS',
        name: 'SMS',
        icon: 'message-square',
        unreadCount: 3,
        isConnected: true,
      },
      {
        channel: 'APP_PUSH',
        name: 'App Push',
        icon: 'bell',
        unreadCount: 8,
        isConnected: true,
      },
    ];

    res.json({
      success: true,
      data: channels,
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching channels', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels',
    });
  }
});

/**
 * POST /api/v1/merchant/inbox/messages/:id/reply
 * Reply to a message
 */
router.post('/inbox/messages/:id/reply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, channel } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required',
      });
    }

    logger.info('Merchant API: Sending reply', {
      messageId: id,
      channel,
      contentLength: content.length,
    });

    // In production, send via appropriate channel
    const reply: InboxMessage = {
      id: `reply-${Date.now()}`,
      channel: channel || 'WHATSAPP',
      customerId: 'unknown',
      customerName: 'Customer',
      direction: 'OUTBOUND',
      type: 'TEXT',
      content,
      status: 'RECEIVED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.json({
      success: true,
      data: reply,
    });
  } catch (error) {
    logger.error('Merchant API: Error sending reply', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to send reply',
    });
  }
});

// ============================================
// ANALYTICS ROUTES (Merchant-safe only)
// ============================================

/**
 * GET /api/v1/merchant/analytics/overview
 * Get merchant analytics (sanitized)
 */
router.get('/analytics/overview', async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId;

    // Mock analytics - only merchant-safe data
    const analytics = {
      totalCustomers: 1070,
      activeCustomers: 890,
      newThisMonth: 120,
      revenue: {
        total: 1897000,
        averageOrderValue: 1627,
        totalOrders: 2340,
      },
      growth: {
        customerGrowth: 8.5,
        revenueGrowth: 15.2,
        orderGrowth: 11.4,
      },
      retention: {
        rate: 85,
        repeatCustomers: 520,
      },
      topProducts: [
        { name: 'Premium Pizza', orders: 1250, revenue: 187500 },
        { name: 'Biryani Combo', orders: 980, revenue: 147000 },
        { name: 'Cold Coffee', orders: 2100, revenue: 105000 },
      ],
    };

    // Validate response is merchant-safe
    validateMerchantSafe(analytics as unknown as Record<string, unknown>);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Merchant API: Error fetching analytics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

export default router;

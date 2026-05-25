/**
 * AggregatorHub Usage Examples
 *
 * This file demonstrates how to use the AggregatorHub library
 * for integrating with Swiggy, Zomato, and Magicpin
 */

import {
  AggregatorHub,
  createAggregatorHub,
  MenuItem,
  AvailabilityUpdate,
  DateRange,
} from '../src';

// ============================================
// Example 1: Basic Setup
// ============================================

async function basicSetup() {
  // Create the hub with your API credentials
  const hub = createAggregatorHub({
    swiggy: {
      apiKey: process.env.SWIGGY_API_KEY!,
      storeId: 'your-swiggy-store-id',
      baseUrl: 'https://partner-api.swiggy.com',
      webhookSecret: process.env.SWIGGY_WEBHOOK_SECRET,
      timeout: 30000,
      retryAttempts: 3,
    },
    zomato: {
      apiKey: process.env.ZOMATO_API_KEY!,
      storeId: 'your-zomato-restaurant-id',
      baseUrl: 'https://api.zomato.com/v2',
      webhookSecret: process.env.ZOMATO_WEBHOOK_SECRET,
    },
    magicpin: {
      apiKey: process.env.MAGICPIN_API_KEY!,
      storeId: 'your-magicpin-store-id',
      baseUrl: 'https://partner.magicpin.com/api/v1',
      webhookSecret: process.env.MAGICPIN_WEBHOOK_SECRET,
    },
    storeId: 'your-internal-store-id',
    logLevel: 'info',
  });

  return hub;
}

// ============================================
// Example 2: Fetch Orders
// ============================================

async function fetchOrdersExample(hub: AggregatorHub) {
  // Get all orders from all aggregators
  const allOrders = await hub.getOrders('store-123');
  logger.info(`Total orders: ${allOrders.length}`);

  // Filter by specific aggregators
  const swiggyOrders = await hub.getOrders('store-123', {
    aggregators: ['swiggy'],
  });

  // Get orders for a specific date range
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const recentOrders = await hub.getOrders('store-123', {
    startDate: weekAgo.toISOString(),
    endDate: today.toISOString(),
  });

  // Get only new orders
  const newOrders = await hub.getOrders('store-123', {
    status: 'new',
  });

  return { allOrders, swiggyOrders, recentOrders, newOrders };
}

// ============================================
// Example 3: Sync Menu
// ============================================

async function syncMenuExample(hub: AggregatorHub) {
  // Define your menu items
  const menuItems: MenuItem[] = [
    {
      id: 'biryani-001',
      name: 'Chicken Biryani',
      description: 'Aromatic rice with tender chicken',
      price: 299,
      category: 'Main Course',
      isAvailable: true,
      isVeg: false,
      isBestseller: true,
      preparationTime: 25,
      tags: ['spicy', 'popular'],
    },
    {
      id: 'paneer-001',
      name: 'Paneer Butter Masala',
      description: 'Creamy tomato gravy with cottage cheese',
      price: 249,
      category: 'Main Course',
      isAvailable: true,
      isVeg: true,
      preparationTime: 20,
    },
    {
      id: 'roti-001',
      name: 'Butter Naan',
      description: 'Soft flatbread with butter',
      price: 60,
      category: 'Breads',
      isAvailable: true,
      isVeg: true,
      preparationTime: 5,
      variants: [
        { id: 'roti-plain', name: 'Plain Naan', price: 50 },
        { id: 'roti-butter', name: 'Butter Naan', price: 60 },
        { id: 'roti-garlic', name: 'Garlic Naan', price: 70 },
      ],
    },
  ];

  // Sync to all aggregators
  const syncResults = await hub.syncMenu('store-123', menuItems);

  // Check results
  for (const result of syncResults) {
    logger.info(`${result.aggregator}: ${result.itemsSuccess}/${result.itemsProcessed} items synced`);
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
    }
  }

  // Sync to specific aggregators
  const swiggyResult = await hub.syncMenu('store-123', menuItems, {
    aggregators: ['swiggy'],
  });

  return syncResults;
}

// ============================================
// Example 4: Update Availability
// ============================================

async function updateAvailabilityExample(hub: AggregatorHub) {
  const updates: AvailabilityUpdate[] = [
    {
      itemId: 'biryani-001',
      storeItemId: 'swiggy-biryani-001',
      isAvailable: false,
      reason: 'Out of chicken',
      effectiveFrom: new Date(),
    },
    {
      itemId: 'paneer-001',
      storeItemId: 'swiggy-paneer-001',
      isAvailable: true,
    },
  ];

  // Update on all aggregators
  await hub.updateAvailability('store-123', updates);

  // Update on specific aggregators
  await hub.updateAvailability('store-123', updates, {
    aggregators: ['swiggy', 'zomato'],
  });
}

// ============================================
// Example 5: Accept/Reject Orders
// ============================================

async function orderActionsExample(hub: AggregatorHub) {
  // Get new orders
  const newOrders = await hub.getOrders('store-123', { status: 'new' });

  for (const order of newOrders) {
    // Check for high priority
    if (order.isHighPriority) {
      // Accept immediately
      const accepted = await hub.acceptOrder(
        'store-123',
        order.aggregatorOrderId,
        order.aggregator
      );
      logger.info(`Order ${order.id} accepted: ${accepted}`);
    } else {
      // Reject with reason
      const rejected = await hub.rejectOrder(
        'store-123',
        order.aggregatorOrderId,
        order.aggregator,
        'Kitchen is busy, please try later'
      );
      logger.info(`Order ${order.id} rejected: ${rejected}`);
    }
  }
}

// ============================================
// Example 6: Handle Webhooks (Express.js)
// ============================================

async function webhookExample(hub: AggregatorHub) {
  // In an Express.js app:
  /*
  import express import logger from './utils/logger';
import from 'express';
  const app = express();

  app.use(express.json());

  // Swiggy webhook endpoint
  app.post('/webhooks/swiggy', async (req, res) => {
    const signature = req.headers['x-swiggy-signature'] as string;

    // Verify signature
    const payload = JSON.stringify(req.body);

    const result = await hub.handleWebhook('swiggy', req.body);

    if (result.success) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(400).json({ error: result.error });
    }
  });

  // Zomato webhook endpoint
  app.post('/webhooks/zomato', async (req, res) => {
    const result = await hub.handleWebhook('zomato', req.body);
    res.status(result.success ? 200 : 400).json(result);
  });

  // Magicpin webhook endpoint
  app.post('/webhooks/magicpin', async (req, res) => {
    const result = await hub.handleWebhook('magicpin', req.body);
    res.status(result.success ? 200 : 400).json(result);
  });
  */
}

// ============================================
// Example 7: Analytics
// ============================================

async function analyticsExample(hub: AggregatorHub) {
  const dateRange: DateRange = {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  };

  const analytics = await hub.getAnalytics('store-123', dateRange);

  logger.info('=== Analytics Summary ===');
  logger.info(`Total Orders: ${analytics.totalOrders}`);
  logger.info(`Total Revenue: ₹${analytics.totalRevenue.toFixed(2)}`);
  logger.info(`Average Order Value: ₹${analytics.averageOrderValue.toFixed(2)}`);
  logger.info(`Cancellation Rate: ${(analytics.cancellationRate * 100).toFixed(1)}%`);

  logger.info('\n=== By Aggregator ===');
  for (const agg of analytics.byAggregator) {
    logger.info(`${agg.aggregator}: ${agg.orderCount} orders, ₹${agg.revenue.toFixed(2)} revenue`);
  }

  logger.info('\n=== Peak Hours ===');
  for (const hour of analytics.peakHours.slice(0, 5)) {
    logger.info(`${hour.hour}:00 - ${hour.orderCount} orders`);
  }

  logger.info('\n=== Top Items ===');
  for (const item of analytics.topItems.slice(0, 5)) {
    logger.info(`${item.itemName}: ${item.quantitySold} sold`);
  }

  return analytics;
}

// ============================================
// Example 8: Health Check
// ============================================

async function healthCheckExample(hub: AggregatorHub) {
  const healthChecks = await hub.healthCheck();

  for (const health of healthChecks) {
    const status = health.status === 'healthy' ? '✓' : health.status === 'degraded' ? '⚠' : '✗';
    console.log(`${status} ${health.aggregator}: ${health.status}${health.latencyMs ? ` (${health.latencyMs}ms)` : ''}`);
  }

  // Get full status
  const status = await hub.getStatus();
  logger.info('\n=== Hub Status ===');
  logger.info(`Overall: ${status.healthy ? 'Healthy' : 'Unhealthy'}`);
  logger.info(`Today's Orders: ${status.totalOrdersToday}`);
  logger.info(`Pending Orders: ${status.pendingOrders}`);
}

// ============================================
// Example 9: Event Handlers
// ============================================

async function eventHandlersExample() {
  const hub = createAggregatorHub({
    swiggy: { apiKey: '...', storeId: '...' },
    zomato: { apiKey: '...', storeId: '...' },
    magicpin: { apiKey: '...', storeId: '...' },
    storeId: 'store-123',
  }, {
    onNewOrder: async (order) => {
      logger.info(`New order received: ${order.id}`);
      // Send notification to kitchen
      // Play audio alert
      // Auto-accept if criteria met
    },
    onOrderUpdate: async (order) => {
      logger.info(`Order updated: ${order.id} -> ${order.orderStatus}`);
      // Update local database
      // Notify customer
    },
    onOrderCancelled: async (order, reason) => {
      logger.info(`Order cancelled: ${order.id}, Reason: ${reason}`);
      // Update inventory
      // Send refund if applicable
    },
    onError: async (error, context) => {
      console.error(`Error in ${context.aggregator} ${context.operation}:`, error);
      // Send to error tracking
      // Alert ops team
    },
  });

  return hub;
}

// ============================================
// Example 10: Complete Integration
// ============================================

async function completeIntegration() {
  const hub = await basicSetup();

  try {
    // 1. Health check
    const status = await hub.getStatus();
    if (!status.healthy) {
      console.warn('Some aggregators are not healthy:', status.aggregators);
    }

    // 2. Sync menu
    logger.info('Syncing menu...');
    await syncMenuExample(hub);

    // 3. Fetch and process orders
    logger.info('Fetching orders...');
    const orders = await hub.getOrders('store-123', { status: 'new' });

    for (const order of orders) {
      // Accept order
      const accepted = await hub.acceptOrder(
        'store-123',
        order.aggregatorOrderId,
        order.aggregator
      );

      if (accepted) {
        logger.info(`Accepted order ${order.id}`);
        // Update local system
      }
    }

    // 4. Get analytics
    logger.info('Fetching analytics...');
    const analytics = await hub.getAnalytics('store-123', {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    });

    logger.info('Weekly Report:');
    logger.info(`  Orders: ${analytics.totalOrders}`);
    logger.info(`  Revenue: ₹${analytics.totalRevenue.toFixed(2)}`);

    // 5. Cleanup
    hub.destroy();
    logger.info('Done!');
  } catch (error) {
    console.error('Integration error:', error);
    hub.destroy();
    throw error;
  }
}

// Run examples
if (require.main === module) {
  completeIntegration().catch(console.error);
}

export {
  basicSetup,
  fetchOrdersExample,
  syncMenuExample,
  updateAvailabilityExample,
  orderActionsExample,
  webhookExample,
  analyticsExample,
  healthCheckExample,
  eventHandlersExample,
  completeIntegration,
};

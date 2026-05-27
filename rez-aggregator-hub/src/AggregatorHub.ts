/**
 * AggregatorHub
 * Unified interface for managing orders across Swiggy, Zomato, and Magicpin
 */

import {
  Order,
  MenuItem,
  AvailabilityUpdate,
  SyncResult,
  Analytics,
  DateRange,
  AggregatorConfig,
  HealthCheck,
  WebhookHandlerResult,
  Aggregator,
} from './types';
import { Logger } from './utils/logger.js';
import { OrderNormalizer } from './utils/normalizer';
import { SwiggyClient } from './clients/swiggy';
import { ZomatoClient } from './clients/zomato';
import { MagicpinClient } from './clients/magicpin';
import {
  WebhookRouter,
  WebhookEventHandlers,
} from './webhooks/handlers';

// ============================================
// Configuration Types
// ============================================

export interface AggregatorHubConfig {
  swiggy: AggregatorConfig;
  zomato: AggregatorConfig;
  magicpin: AggregatorConfig;
  storeId: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableCaching?: boolean;
  cacheTtlSeconds?: number;
}

export interface AggregatorHubOptions {
  onNewOrder?: (order: Order) => void | Promise<void>;
  onOrderUpdate?: (order: Order) => void | Promise<void>;
  onOrderCancelled?: (order: Order, reason: string) => void | Promise<void>;
  onError?: (error: Error, context: { aggregator: Aggregator; operation: string }) => void | Promise<void>;
}

// ============================================
// AggregatorHub Class
// ============================================

export class AggregatorHub {
  private readonly config: AggregatorHubConfig;
  private readonly logger: Logger;
  private readonly normalizer: OrderNormalizer;

  // API Clients
  private readonly swiggy: SwiggyClient;
  private readonly zomato: ZomatoClient;
  private readonly magicpin: MagicpinClient;

  // Webhook router
  private webhookRouter: WebhookRouter | null = null;

  // Cache for orders (optional)
  private orderCache: Map<string, { order: Order; timestamp: number }> = new Map();
  private cacheTtl: number = 30000; // 30 seconds default

  constructor(config: AggregatorHubConfig, options: AggregatorHubOptions = {}) {
    this.config = config;
    this.logger = new Logger({ level: config.logLevel || 'info' });
    this.normalizer = new OrderNormalizer(this.logger);

    // Initialize API clients
    this.swiggy = new SwiggyClient(config.swiggy, this.logger);
    this.zomato = new ZomatoClient(config.zomato, this.logger);
    this.magicpin = new MagicpinClient(config.magicpin, this.logger);

    // Set cache TTL
    if (config.cacheTtlSeconds) {
      this.cacheTtl = config.cacheTtlSeconds * 1000;
    }

    // Setup event handlers
    if (options.onNewOrder || options.onOrderUpdate || options.onOrderCancelled) {
      this.setupEventHandlers(options);
    }

    this.logger.info('AggregatorHub initialized', {
      storeId: config.storeId,
      logLevel: config.logLevel || 'info',
    });
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Setup webhook router with event handlers
   */
  private setupEventHandlers(options: AggregatorHubOptions): void {
    const handlers: WebhookEventHandlers = {};

    if (options.onNewOrder) {
      handlers.onOrderNew = async (order) => {
        options.onNewOrder!(order);
      };
    }

    if (options.onOrderUpdate) {
      handlers.onOrderUpdated = async (order) => {
        options.onOrderUpdate!(order);
      };
    }

    if (options.onOrderCancelled) {
      handlers.onOrderCancelled = async (order, reason) => {
        options.onOrderCancelled!(order, reason || 'Unknown');
      };
    }

    this.webhookRouter = new WebhookRouter(
      {
        swiggySecret: this.config.swiggy.webhookSecret || '',
        zomatoSecret: this.config.zomato.webhookSecret || '',
        magicpinSecret: this.config.magicpin.webhookSecret || '',
      },
      handlers,
      this.logger
    );
  }

  // ============================================
  // Order Operations
  // ============================================

  /**
   * Get unified orders from all aggregators
   * Fetches orders from Swiggy, Zomato, and Magicpin and normalizes them
   */
  async getOrders(storeId: string, options?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
    aggregators?: Aggregator[];
    useCache?: boolean;
  }): Promise<Order[]> {
    const startTime = Date.now();
    const orders: Order[] = [];
    const errors: Error[] = [];

    this.logger.info('Fetching orders from all aggregators', { storeId, options });

    // Determine which aggregators to fetch from
    const targetAggregators = options?.aggregators || ['swiggy', 'zomato', 'magicpin'];

    // Fetch orders from each aggregator in parallel
    const fetchPromises = targetAggregators.map(async (aggregator) => {
      try {
        let rawOrders: Order[] = [];

        switch (aggregator) {
          case 'swiggy':
            const swiggyResponse = await this.swiggy.getOrders(storeId, {
              startDate: options?.startDate,
              endDate: options?.endDate,
              status: options?.status,
              limit: options?.limit,
              offset: options?.offset,
            });
            if (swiggyResponse.success && swiggyResponse.data) {
              rawOrders = swiggyResponse.data.map((order) =>
                this.swiggy.transformOrderToNormalized(order, storeId)
              );
            }
            break;

          case 'zomato':
            const zomatoResponse = await this.zomato.getOrders({
              startDate: options?.startDate,
              endDate: options?.endDate,
              status: options?.status,
              limit: options?.limit,
              offset: options?.offset,
            });
            if (zomatoResponse.success && zomatoResponse.data) {
              rawOrders = zomatoResponse.data.map((order) =>
                this.zomato.transformOrderToNormalized(order, storeId)
              );
            }
            break;

          case 'magicpin':
            const magicpinResponse = await this.magicpin.getOrders(storeId, {
              startDate: options?.startDate,
              endDate: options?.endDate,
              status: options?.status,
              limit: options?.limit,
              offset: options?.offset,
            });
            if (magicpinResponse.success && magicpinResponse.data) {
              rawOrders = magicpinResponse.data.map((order) =>
                this.magicpin.transformOrderToNormalized(order, storeId)
              );
            }
            break;
        }

        // Enrich orders
        return rawOrders.map((order) => this.normalizer.enrichOrder(order));
      } catch (error) {
        this.logger.error(`Failed to fetch orders from ${aggregator}`, error as Error);
        errors.push(error as Error);
        return [];
      }
    });

    const results = await Promise.allSettled(fetchPromises);

    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        orders.push(...result.value);
      }
    }

    // Sort and filter orders
    let finalOrders = this.normalizer.sortOrders(orders);

    // Apply status filter if provided
    if (options?.status) {
      const statusMap = this.normalizer.normalizeStatus('swiggy', options.status);
      finalOrders = this.normalizer.filterByStatus(finalOrders, [statusMap]);
    }

    this.logger.performance('getOrders', Date.now() - startTime, {
      storeId,
      totalOrders: finalOrders.length,
      errorsCount: errors.length,
    });

    // Throw if all aggregators failed
    if (errors.length === targetAggregators.length) {
      throw new Error(`Failed to fetch orders from all aggregators: ${errors.map((e) => e.message).join(', ')}`);
    }

    return finalOrders;
  }

  /**
   * Get a single order by ID
   */
  async getOrder(storeId: string, orderId: string, aggregator: Aggregator): Promise<Order | null> {
    try {
      switch (aggregator) {
        case 'swiggy':
          const swiggyResponse = await this.swiggy.getOrder(storeId, orderId);
          if (swiggyResponse.success && swiggyResponse.data) {
            return this.swiggy.transformOrderToNormalized(swiggyResponse.data, storeId);
          }
          break;

        case 'zomato':
          const zomatoResponse = await this.zomato.getOrder(orderId);
          if (zomatoResponse.success && zomatoResponse.data) {
            return this.zomato.transformOrderToNormalized(zomatoResponse.data, storeId);
          }
          break;

        case 'magicpin':
          const magicpinResponse = await this.magicpin.getOrder(storeId, orderId);
          if (magicpinResponse.success && magicpinResponse.data) {
            return this.magicpin.transformOrderToNormalized(magicpinResponse.data, storeId);
          }
          break;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch order ${orderId} from ${aggregator}`, error as Error);
      return null;
    }
  }

  /**
   * Accept an order
   */
  async acceptOrder(storeId: string, orderId: string, aggregator: Aggregator): Promise<boolean> {
    this.logger.info(`Accepting order ${orderId} from ${aggregator}`);

    try {
      let result;

      switch (aggregator) {
        case 'swiggy':
          result = await this.swiggy.acceptOrder(storeId, orderId);
          break;
        case 'zomato':
          result = await this.zomato.acceptOrder(orderId);
          break;
        case 'magicpin':
          result = await this.magicpin.acceptOrder(storeId, orderId);
          break;
      }

      if (result?.success) {
        this.logger.info(`Order ${orderId} accepted successfully`);
        return true;
      }

      this.logger.error(`Failed to accept order ${orderId}: ${result?.error?.message}`);
      return false;
    } catch (error) {
      this.logger.error(`Error accepting order ${orderId}`, error as Error);
      return false;
    }
  }

  /**
   * Reject an order
   */
  async rejectOrder(storeId: string, orderId: string, aggregator: Aggregator, reason: string): Promise<boolean> {
    this.logger.info(`Rejecting order ${orderId} from ${aggregator}: ${reason}`);

    try {
      let result;

      switch (aggregator) {
        case 'swiggy':
          result = await this.swiggy.rejectOrder(storeId, orderId, reason);
          break;
        case 'zomato':
          result = await this.zomato.rejectOrder(orderId, reason);
          break;
        case 'magicpin':
          result = await this.magicpin.rejectOrder(storeId, orderId, reason);
          break;
      }

      if (result?.success) {
        this.logger.info(`Order ${orderId} rejected successfully`);
        return true;
      }

      this.logger.error(`Failed to reject order ${orderId}: ${result?.error?.message}`);
      return false;
    } catch (error) {
      this.logger.error(`Error rejecting order ${orderId}`, error as Error);
      return false;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    storeId: string,
    orderId: string,
    aggregator: Aggregator,
    status: string
  ): Promise<boolean> {
    this.logger.info(`Updating order ${orderId} status to ${status}`);

    try {
      let result;

      switch (aggregator) {
        case 'swiggy':
          result = await this.swiggy.updateOrderStatus(storeId, orderId, status);
          break;
        case 'zomato':
          result = await this.zomato.updateOrderStatus(orderId, status);
          break;
        case 'magicpin':
          result = await this.magicpin.updateOrderStatus(storeId, orderId, status);
          break;
      }

      if (result?.success) {
        this.logger.info(`Order ${orderId} status updated successfully`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error updating order status`, error as Error);
      return false;
    }
  }

  // ============================================
  // Menu Operations
  // ============================================

  /**
   * Sync menu to all aggregators
   * Pushes the menu to Swiggy, Zomato, and Magicpin in parallel
   */
  async syncMenu(storeId: string, menu: MenuItem[], options?: {
    aggregators?: Aggregator[];
    skipValidation?: boolean;
  }): Promise<SyncResult[]> {
    const startTime = Date.now();
    const targetAggregators = options?.aggregators || ['swiggy', 'zomato', 'magicpin'];

    this.logger.info(`Syncing menu to ${targetAggregators.length} aggregators`, {
      storeId,
      itemCount: menu.length,
    });

    // Validate menu items if not skipped
    if (!options?.skipValidation) {
      for (const item of menu) {
        const validation = this.normalizer.validateOrder({
          items: [{ id: item.id, name: item.name, quantity: 1, price: item.price }],
        } as Partial<Order>);

        if (!validation.valid) {
          this.logger.warn(`Menu item ${item.id} has validation issues: ${validation.errors.join(', ')}`);
        }
      }
    }

    // Sync to each aggregator in parallel
    const syncPromises = targetAggregators.map(async (aggregator) => {
      const syncStartTime = Date.now();

      try {
        let result;

        switch (aggregator) {
          case 'swiggy':
            const swiggyResult = await this.swiggy.syncMenu(storeId, menu);
            result = swiggyResult.success ? swiggyResult.data : null;
            break;

          case 'zomato':
            const zomatoResult = await this.zomato.syncMenu(menu);
            result = zomatoResult.success ? zomatoResult.data : null;
            break;

          case 'magicpin':
            const magicpinResult = await this.magicpin.syncMenu(storeId, menu);
            result = magicpinResult.success ? magicpinResult.data : null;
            break;
        }

        if (result) {
          this.logger.info(`Menu synced to ${aggregator}`, {
            itemsProcessed: result.itemsProcessed,
            itemsSuccess: result.itemsSuccess,
            itemsFailed: result.itemsFailed,
            durationMs: result.durationMs,
          });
        }

        return result;
      } catch (error) {
        this.logger.error(`Failed to sync menu to ${aggregator}`, error as Error);
        return {
          success: false,
          aggregator,
          syncedAt: new Date(),
          itemsProcessed: menu.length,
          itemsSuccess: 0,
          itemsFailed: menu.length,
          errors: [{
            itemId: 'all',
            itemName: 'All items',
            errorCode: 'SYNC_FAILED',
            message: (error as Error).message,
            retryable: true,
          }],
          warnings: [],
          durationMs: Date.now() - syncStartTime,
        };
      }
    });

    const results = await Promise.all(syncPromises);

    this.logger.performance('syncMenu', Date.now() - startTime, {
      storeId,
      aggregators: targetAggregators,
    });

    return results.filter((r): r is SyncResult => r !== null);
  }

  /**
   * Update item availability across all aggregators
   */
  async updateAvailability(
    storeId: string,
    items: AvailabilityUpdate[],
    options?: {
      aggregators?: Aggregator[];
    }
  ): Promise<void> {
    const targetAggregators = options?.aggregators || ['swiggy', 'zomato', 'magicpin'];

    this.logger.info(`Updating availability for ${items.length} items`, {
      storeId,
      aggregators: targetAggregators,
    });

    // Update availability on each aggregator in parallel
    const updatePromises = targetAggregators.map(async (aggregator) => {
      try {
        let result;

        switch (aggregator) {
          case 'swiggy':
            result = await this.swiggy.updateAvailability(storeId, items);
            break;
          case 'zomato':
            result = await this.zomato.updateAvailability(items);
            break;
          case 'magicpin':
            result = await this.magicpin.updateAvailability(storeId, items);
            break;
        }

        if (result?.success) {
          this.logger.info(`Availability updated on ${aggregator}`, {
            updatedCount: result.data?.updated || items.length,
          });
        } else {
          this.logger.error(`Failed to update availability on ${aggregator}`, {
            error: result?.error?.message,
          });
        }
      } catch (error) {
        this.logger.error(`Error updating availability on ${aggregator}`, error as Error);
      }
    });

    await Promise.allSettled(updatePromises);
  }

  // ============================================
  // Webhook Handling
  // ============================================

  /**
   * Handle incoming webhook from an aggregator
   */
  async handleWebhook(aggregator: string, payload: unknown): Promise<WebhookHandlerResult> {
    if (!this.webhookRouter) {
      this.setupEventHandlers({});
    }

    this.logger.info(`Handling webhook from ${aggregator}`, { aggregator });

    return this.webhookRouter!.route(aggregator, payload);
  }

  /**
   * Register webhooks for all aggregators
   */
  async registerWebhooks(webhookUrl: string): Promise<void> {
    const events = [
      'order.new',
      'order.accepted',
      'order.preparing',
      'order.ready',
      'order.picked_up',
      'order.delivered',
      'order.cancelled',
      'order.rejected',
    ];

    this.logger.info('Registering webhooks', { webhookUrl, events });

    // Register webhooks in parallel
    const registerPromises = [
      this.swiggy.registerWebhook(this.config.storeId, webhookUrl, events),
      this.zomato.registerWebhook(webhookUrl, events),
      this.magicpin.registerWebhook(this.config.storeId, webhookUrl, events),
    ];

    const results = await Promise.allSettled(registerPromises);

    for (let i = 0; i < results.length; i++) {
      const aggregator = ['swiggy', 'zomato', 'magicpin'][i];
      if (results[i].status === 'rejected') {
        this.logger.error(`Failed to register webhook for ${aggregator}`, results[i].reason as Error);
      } else if (results[i].value.success) {
        this.logger.info(`Webhook registered for ${aggregator}`);
      }
    }
  }

  // ============================================
  // Analytics
  // ============================================

  /**
   * Get consolidated analytics from all aggregators
   */
  async getAnalytics(storeId: string, dateRange: DateRange): Promise<Analytics> {
    const startTime = Date.now();

    this.logger.info('Fetching analytics', { storeId, dateRange });

    // Get orders for the date range
    const orders = await this.getOrders(storeId, {
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
    });

    // Filter by date range
    const filteredOrders = this.normalizer.filterByDateRange(orders, dateRange.start, dateRange.end);

    // Calculate stats
    const stats = this.normalizer.getOrderStats(filteredOrders);

    // Calculate peak hours
    const peakHours = this.calculatePeakHours(filteredOrders);

    // Calculate top items
    const topItems = this.calculateTopItems(filteredOrders);

    // Calculate order volume trend
    const orderVolumeTrend = this.calculateOrderVolumeTrend(filteredOrders, dateRange);

    // Calculate by-aggregator stats
    const byAggregator = this.calculateAggregatorStats(filteredOrders);

    // Calculate cancellation rate
    const totalOrders = filteredOrders.length;
    const cancelledOrders = filteredOrders.filter(
      (o) => o.orderStatus === 'cancelled' || o.orderStatus === 'rejected'
    ).length;
    const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;

    const analytics: Analytics = {
      storeId,
      period: dateRange,
      totalOrders,
      totalRevenue: stats.totalRevenue,
      averageOrderValue: stats.averageOrderValue,
      byAggregator,
      orderStatusBreakdown: stats.byStatus,
      peakHours,
      topItems,
      cancellationRate,
      orderVolumeTrend,
    };

    this.logger.performance('getAnalytics', Date.now() - startTime, {
      storeId,
      totalOrders,
      totalRevenue: stats.totalRevenue,
    });

    return analytics;
  }

  /**
   * Calculate peak hours from orders
   */
  private calculatePeakHours(orders: Order[]): { hour: number; orderCount: number; revenue: number }[] {
    const hourMap = new Map<number, { count: number; revenue: number }>();

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      const existing = hourMap.get(hour) || { count: 0, revenue: 0 };

      hourMap.set(hour, {
        count: existing.count + 1,
        revenue: existing.revenue + (order.orderStatus === 'delivered' ? order.total : 0),
      });
    }

    return Array.from(hourMap.entries())
      .map(([hour, data]) => ({
        hour,
        orderCount: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
  }

  /**
   * Calculate top items by sales
   */
  private calculateTopItems(orders: Order[]): { itemId: string; itemName: string; quantitySold: number; revenue: number; orderCount: number }[] {
    const itemMap = new Map<string, {
      itemId: string;
      itemName: string;
      quantitySold: number;
      revenue: number;
      orderCount: number;
    }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = itemMap.get(item.id) || {
          itemId: item.id,
          itemName: item.name,
          quantitySold: 0,
          revenue: 0,
          orderCount: 0,
        };

        existing.quantitySold += item.quantity;
        existing.revenue += item.price * item.quantity;
        existing.orderCount += 1;

        itemMap.set(item.id, existing);
      }
    }

    return Array.from(itemMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 20); // Top 20 items
  }

  /**
   * Calculate daily order volume trend
   */
  private calculateOrderVolumeTrend(
    orders: Order[],
    dateRange: DateRange
  ): { date: string; orders: number; revenue: number; byAggregator: Record<string, number> }[] {
    const dailyMap = new Map<string, {
      orders: number;
      revenue: number;
      byAggregator: Record<string, number>;
    }>();

    // Initialize all days in range
    const currentDate = new Date(dateRange.start);
    while (currentDate <= dateRange.end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailyMap.set(dateStr, { orders: 0, revenue: 0, byAggregator: {} });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate orders by day
    for (const order of orders) {
      const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr);

      if (existing) {
        existing.orders += 1;
        existing.revenue += order.orderStatus === 'delivered' ? order.total : 0;
        existing.byAggregator[order.aggregator] = (existing.byAggregator[order.aggregator] || 0) + 1;
      }
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate per-aggregator statistics
   */
  private calculateAggregatorStats(orders: Order[]): {
    aggregator: Aggregator;
    orderCount: number;
    revenue: number;
    averageOrderValue: number;
    cancellationRate: number;
  }[] {
    const aggregatorGroups = new Map<Aggregator, Order[]>();

    for (const order of orders) {
      const existing = aggregatorGroups.get(order.aggregator) || [];
      existing.push(order);
      aggregatorGroups.set(order.aggregator, existing);
    }

    return Array.from(aggregatorGroups.entries()).map(([aggregator, aggOrders]) => {
      const deliveredOrders = aggOrders.filter((o) => o.orderStatus === 'delivered');
      const cancelledOrders = aggOrders.filter(
        (o) => o.orderStatus === 'cancelled' || o.orderStatus === 'rejected'
      );
      const revenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0);

      return {
        aggregator,
        orderCount: aggOrders.length,
        revenue,
        averageOrderValue: deliveredOrders.length > 0 ? revenue / deliveredOrders.length : 0,
        cancellationRate: aggOrders.length > 0 ? cancelledOrders.length / aggOrders.length : 0,
      };
    });
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Check health of all aggregator connections
   */
  async healthCheck(): Promise<HealthCheck[]> {
    this.logger.info('Performing health check on all aggregators');

    const healthPromises = [
      this.swiggy.healthCheck(),
      this.zomato.healthCheck(),
      this.magicpin.healthCheck(),
    ];

    const results = await Promise.allSettled(healthPromises);

    return results.map((result, index) => {
      const aggregator: Aggregator = ['swiggy', 'zomato', 'magicpin'][index] as Aggregator;

      if (result.status === 'rejected') {
        return {
          aggregator,
          status: 'down' as const,
          lastChecked: new Date(),
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      }

      return result.value;
    });
  }

  /**
   * Get hub status summary
   */
  async getStatus(): Promise<{
    healthy: boolean;
    aggregators: { name: Aggregator; status: HealthCheck['status'] }[];
    totalOrdersToday: number;
    pendingOrders: number;
  }> {
    const healthChecks = await this.healthCheck();

    const healthy = healthChecks.every((h) => h.status === 'healthy');

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await this.getOrders(this.config.storeId, {
      startDate: today.toISOString(),
    });

    const pendingOrders = orders.filter(
      (o) => o.orderStatus === 'new' || o.orderStatus === 'pending_confirmation'
    ).length;

    return {
      healthy,
      aggregators: healthChecks.map((h) => ({
        name: h.aggregator,
        status: h.status,
      })),
      totalOrdersToday: orders.length,
      pendingOrders,
    };
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clear the order cache
   */
  clearCache(): void {
    this.orderCache.clear();
    this.logger.info('Order cache cleared');
  }

  /**
   * Destroy the hub and cleanup resources
   */
  destroy(): void {
    this.clearCache();
    this.logger.info('AggregatorHub destroyed');
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a new AggregatorHub instance
 */
export function createAggregatorHub(
  config: AggregatorHubConfig,
  options?: AggregatorHubOptions
): AggregatorHub {
  return new AggregatorHub(config, options);
}

export default AggregatorHub;

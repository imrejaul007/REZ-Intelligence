/**
 * Order Normalizer Utility
 * Normalizes orders from different aggregators into a unified format
 */

import { Order, OrderStatus, OrderItem, OrderAddon } from '../types';
import { Logger } from '../utils/logger';

// ============================================
// Status Mapping Configuration
// ============================================

export const AGGREGATOR_STATUS_MAPS: Record<string, Record<string, OrderStatus>> = {
  swiggy: {
    NEW: 'new',
    RESTAURANT_CONFIRMED: 'accepted',
    FOOD_PREPARING: 'preparing',
    READY_FOR_PICKUP: 'ready',
    PICKED_UP: 'picked_up',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REJECTED: 'rejected',
    PENDING_CONFIRMATION: 'pending_confirmation',
  },
  zomato: {
    NEW: 'new',
    CONFIRMED: 'accepted',
    PREPARING: 'preparing',
    READY: 'ready',
    PICKED_UP: 'picked_up',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REJECTED: 'rejected',
    PENDING: 'pending_confirmation',
  },
  magicpin: {
    NEW: 'new',
    ACCEPTED: 'accepted',
    PREPARING: 'preparing',
    READY: 'ready',
    PICKED_UP: 'picked_up',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REJECTED: 'rejected',
    PENDING_ACCEPTANCE: 'pending_confirmation',
  },
};

// ============================================
// Normalizer Class
// ============================================

export class OrderNormalizer {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Normalize order status to unified format
   */
  normalizeStatus(aggregator: string, rawStatus: string): OrderStatus {
    const statusMap = AGGREGATOR_STATUS_MAPS[aggregator];
    if (!statusMap) {
      this.logger.warn(`Unknown aggregator: ${aggregator}, using 'new' as default`);
      return 'new';
    }

    const normalized = statusMap[rawStatus.toUpperCase()];
    if (!normalized) {
      this.logger.warn(`Unknown status '${rawStatus}' for ${aggregator}, using 'new' as default`);
      return 'new';
    }

    return normalized;
  }

  /**
   * Denormalize unified status to aggregator-specific format
   */
  denormalizeStatus(aggregator: string, status: OrderStatus): string {
    const reverseMap = this.getReverseStatusMap(aggregator);
    return reverseMap[status] || 'NEW';
  }

  /**
   * Get reverse status map for an aggregator
   */
  private getReverseStatusMap(aggregator: string): Record<OrderStatus, string> {
    const forwardMap = AGGREGATOR_STATUS_MAPS[aggregator] || {};
    return Object.entries(forwardMap).reduce((acc, [key, value]) => {
      acc[value] = key;
      return acc;
    }, {} as Record<OrderStatus, string>);
  }

  /**
   * Normalize price to cents (integer) for consistent handling
   */
  normalizePrice(price: number): number {
    return Math.round(price * 100);
  }

  /**
   * Denormalize price from cents to decimal
   */
  denormalizePrice(priceInCents: number): number {
    return priceInCents / 100;
  }

  /**
   * Validate an order has all required fields
   */
  validateOrder(order: Partial<Order>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!order.id) errors.push('Order ID is required');
    if (!order.aggregatorOrderId) errors.push('Aggregator order ID is required');
    if (!order.aggregator) errors.push('Aggregator is required');
    if (!order.storeId) errors.push('Store ID is required');
    if (!order.customerName) errors.push('Customer name is required');
    if (!order.customerPhone) errors.push('Customer phone is required');
    if (!order.items || order.items.length === 0) errors.push('Order must have at least one item');
    if (typeof order.total !== 'number') errors.push('Order total is required');

    // Validate items
    if (order.items) {
      order.items.forEach((item, index) => {
        if (!item.id) errors.push(`Item ${index}: ID is required`);
        if (!item.name) errors.push(`Item ${index}: Name is required`);
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          errors.push(`Item ${index}: Valid quantity is required`);
        }
        if (typeof item.price !== 'number' || item.price < 0) {
          errors.push(`Item ${index}: Valid price is required`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Enrich order with computed fields
   */
  enrichOrder(order: Order): Order {
    // Calculate derived fields
    const calculatedSubtotal = order.items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const addonTotal = (item.addons || []).reduce((aSum, addon) => aSum + addon.price * item.quantity, 0);
      return sum + itemTotal + addonTotal;
    }, 0);

    // Validate billing totals
    const expectedTotal =
      calculatedSubtotal +
      order.tax +
      order.deliveryFee +
      order.packagingFee -
      order.discount;

    // Flag if totals don't match (within tolerance of 1 cent)
    const totalsMatch = Math.abs(order.total - expectedTotal) <= 1;

    return {
      ...order,
      subtotal: totalsMatch ? order.subtotal : calculatedSubtotal,
      // Recalculate total if it doesn't match
      total: totalsMatch ? order.total : expectedTotal,
    };
  }

  /**
   * Merge duplicate orders from different aggregators
   * Note: This is a basic implementation - real scenarios may need more complex logic
   */
  mergeOrders(orders: Order[]): Order[] {
    // Group by aggregator order ID
    const orderMap = new Map<string, Order>();

    for (const order of orders) {
      const key = `${order.aggregator}:${order.aggregatorOrderId}`;
      const existing = orderMap.get(key);

      if (existing) {
        // Keep the newer order
        if (new Date(order.updatedAt) > new Date(existing.updatedAt)) {
          orderMap.set(key, order);
        }
      } else {
        orderMap.set(key, order);
      }
    }

    return Array.from(orderMap.values());
  }

  /**
   * Sort orders by priority and creation time
   */
  sortOrders(orders: Order[]): Order[] {
    return orders.sort((a, b) => {
      // High priority orders first
      if (a.isHighPriority && !b.isHighPriority) return -1;
      if (!a.isHighPriority && b.isHighPriority) return 1;

      // Then by creation time (newer first)
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;

      // Then by order ID for consistency
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Filter orders by status
   */
  filterByStatus(orders: Order[], statuses: OrderStatus[]): Order[] {
    return orders.filter((order) => statuses.includes(order.orderStatus));
  }

  /**
   * Filter orders by aggregator
   */
  filterByAggregator(orders: Order[], aggregators: string[]): Order[] {
    return orders.filter((order) => aggregators.includes(order.aggregator));
  }

  /**
   * Filter orders by date range
   */
  filterByDateRange(orders: Order[], startDate: Date, endDate: Date): Order[] {
    return orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }

  /**
   * Get order statistics
   */
  getOrderStats(orders: Order[]): {
    total: number;
    byStatus: Record<OrderStatus, number>;
    byAggregator: Record<string, number>;
    totalRevenue: number;
    averageOrderValue: number;
  } {
    const byStatus: Record<OrderStatus, number> = {
      new: 0,
      accepted: 0,
      preparing: 0,
      ready: 0,
      picked_up: 0,
      delivered: 0,
      cancelled: 0,
      rejected: 0,
      pending_confirmation: 0,
    };

    const byAggregator: Record<string, number> = {};
    let totalRevenue = 0;

    for (const order of orders) {
      byStatus[order.orderStatus]++;
      byAggregator[order.aggregator] = (byAggregator[order.aggregator] || 0) + 1;
      if (order.orderStatus === 'delivered') {
        totalRevenue += order.total;
      }
    }

    const deliveredOrders = orders.filter((o) => o.orderStatus === 'delivered').length;

    return {
      total: orders.length,
      byStatus,
      byAggregator,
      totalRevenue,
      averageOrderValue: deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0,
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string, countryCode: string = '+91'): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // If already has country code, return as-is
  if (phone.startsWith('+')) {
    return `+${digits}`;
  }

  // Add country code
  return `${countryCode}${digits.slice(-10)}`;
}

/**
 * Parse customer name to extract components
 */
export function parseCustomerName(name: string): {
  firstName: string;
  lastName: string;
  title?: string;
} {
  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  // Check for common titles
  const titles = ['Mr', 'Mrs', 'Ms', 'Dr', 'Mr.', 'Mrs.', 'Ms.'];
  const hasTitle = titles.includes(parts[0]) || titles.includes(parts[0].replace('.', ''));

  if (hasTitle) {
    return {
      title: parts[0].replace('.', ''),
      firstName: parts[1],
      lastName: parts.slice(2).join(' ') || '',
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Calculate estimated delivery time based on order details
 */
export function calculateEstimatedDelivery(
  orderCreatedAt: Date,
  itemCount: number,
  preparationTime: number = 15
): Date {
  // Base preparation time + 5 mins per item (capped at 30 mins)
  const additionalPrepTime = Math.min((itemCount - 1) * 5, 30);
  const totalPrepTime = preparationTime + additionalPrepTime;

  // Add delivery time estimate (30-45 mins depending on distance)
  const deliveryTime = 40;

  const estimatedMinutes = totalPrepTime + deliveryTime;
  const estimatedTime = new Date(orderCreatedAt);
  estimatedTime.setMinutes(estimatedTime.getMinutes() + estimatedMinutes);

  return estimatedTime;
}

/**
 * Sanitize order data for logging/display
 */
export function sanitizeOrderForLogging(order: Order): Partial<Order> {
  return {
    id: order.id,
    aggregatorOrderId: order.aggregatorOrderId,
    aggregator: order.aggregator,
    storeId: order.storeId,
    customerName: order.customerName,
    // Mask phone number
    customerPhone: order.customerPhone.slice(0, -4) + '****',
    orderStatus: order.orderStatus,
    orderType: order.orderType,
    total: order.total,
    itemCount: order.items.length,
    isHighPriority: order.isHighPriority,
    createdAt: order.createdAt,
  };
}

// Default instance for convenience
export const normalizer = new OrderNormalizer();

import { Action, ActionLevel } from '../types/action-levels';

/**
 * Action Registry
 *
 * Central registry of all possible actions that can be triggered
 * by events from the REZ Event Platform.
 */

export const ACTION_REGISTRY: Record<string, Action> = {
  // Inventory Actions
  'inventory.low.reorder_suggestion': {
    id: 'inventory.low.reorder_suggestion',
    name: 'Create Reorder Suggestion',
    level: ActionLevel.SEMI_SAFE,
    eventTrigger: 'inventory.low',
    description: 'Suggest reorder to merchant when inventory is low',
    autoExecute: false,
    requiresApproval: true,
    timeoutMs: 30000,
    retryable: true,
    maxRetries: 3
  },

  'inventory.critical.alert': {
    id: 'inventory.critical.alert',
    name: 'Critical Inventory Alert',
    level: ActionLevel.SAFE,
    eventTrigger: 'inventory.critical',
    description: 'Send urgent notification when inventory reaches critical levels',
    autoExecute: true,
    timeoutMs: 10000,
    retryable: true,
    maxRetries: 2
  },

  'inventory.out_of_stock.auto_order': {
    id: 'inventory.out_of_stock.auto_order',
    name: 'Auto Order Out of Stock Items',
    level: ActionLevel.RISKY,
    eventTrigger: 'inventory.out_of_stock',
    description: 'Automatically create purchase order for out of stock items',
    autoExecute: false,
    requiresApproval: true,
    timeoutMs: 60000,
    retryable: true,
    maxRetries: 1
  },

  // Sales & Pricing Actions
  'sales.target.achieved.notification': {
    id: 'sales.target.achieved.notification',
    name: 'Sales Target Achievement',
    level: ActionLevel.SAFE,
    eventTrigger: 'sales.target.achieved',
    description: 'Notify team when sales target is achieved',
    autoExecute: true,
    timeoutMs: 5000,
    retryable: true,
    maxRetries: 3
  },

  'pricing.optimal_suggestion': {
    id: 'pricing.optimal_suggestion',
    name: 'Optimal Price Suggestion',
    level: ActionLevel.SEMI_SAFE,
    eventTrigger: 'pricing.optimize',
    description: 'Suggest optimal pricing based on market analysis',
    autoExecute: false,
    requiresApproval: true,
    timeoutMs: 30000,
    retryable: true,
    maxRetries: 2
  },

  'pricing.bulk_adjustment': {
    id: 'pricing.bulk_adjustment',
    name: 'Bulk Price Adjustment',
    level: ActionLevel.RISKY,
    eventTrigger: 'pricing.bulk_adjust',
    description: 'Apply price changes to multiple items',
    autoExecute: false,
    requiresApproval: true,
    timeoutMs: 120000,
    retryable: false
  },

  // Customer Actions
  'customer.order.ship_notification': {
    id: 'customer.order.ship_notification',
    name: 'Order Shipped Notification',
    level: ActionLevel.SAFE,
    eventTrigger: 'order.shipped',
    description: 'Send shipping notification to customer',
    autoExecute: true,
    timeoutMs: 10000,
    retryable: true,
    maxRetries: 3
  },

  'customer.abandoned_cart.reminder': {
    id: 'customer.abandoned_cart.reminder',
    name: 'Abandoned Cart Reminder',
    level: ActionLevel.SAFE,
    eventTrigger: 'cart.abandoned',
    description: 'Send reminder for abandoned cart',
    autoExecute: true,
    timeoutMs: 15000,
    retryable: true,
    maxRetries: 2
  },

  'customer.high_value.retention_offer': {
    id: 'customer.high_value.retention_offer',
    name: 'High Value Customer Retention',
    level: ActionLevel.SEMI_SAFE,
    eventTrigger: 'customer.high_value.risk',
    description: 'Create retention offer for high-value at-risk customer',
    autoExecute: false,
    requiresApproval: true,
    timeoutMs: 30000,
    retryable: false
  },

  // Supplier Actions
  'supplier.delivery.delay_notification': {
    id: 'supplier.delivery.delay_notification',
    name: 'Supplier Delay Alert',
    level: ActionLevel.SAFE,
    eventTrigger: 'supplier.delivery.delayed',
    description: 'Alert merchant about supplier delivery delays',
    autoExecute: true,
    timeoutMs: 10000,
    retryable: true,
    maxRetries: 3
  },

  'supplier.quality.issue_report': {
    id: 'supplier.quality.issue_report',
    name: 'Quality Issue Report',
    level: ActionLevel.SAFE,
    eventTrigger: 'supplier.quality.issue',
    description: 'Generate quality issue report for supplier',
    autoExecute: true,
    timeoutMs: 30000,
    retryable: true,
    maxRetries: 2
  },

  // Financial Actions
  'finance.invoice.auto_generation': {
    id: 'finance.invoice.auto_generation',
    name: 'Auto Invoice Generation',
    level: ActionLevel.SEMI_SAFE,
    eventTrigger: 'order.completed',
    description: 'Automatically generate invoice for completed orders',
    autoExecute: true,
    timeoutMs: 20000,
    retryable: true,
    maxRetries: 3
  },

  'finance.payment.failed.retry': {
    id: 'finance.payment.failed.retry',
    name: 'Payment Retry',
    level: ActionLevel.RISKY,
    eventTrigger: 'payment.failed',
    description: 'Retry failed payment with updated method',
    autoExecute: false,
    requiresApproval: true,
    timeoutMs: 60000,
    retryable: false
  },

  // Dashboard & Analytics Actions
  'dashboard.daily_report': {
    id: 'dashboard.daily_report',
    name: 'Daily Summary Report',
    level: ActionLevel.SAFE,
    eventTrigger: 'schedule.daily',
    description: 'Generate and send daily business summary',
    autoExecute: true,
    timeoutMs: 60000,
    retryable: true,
    maxRetries: 2
  },

  'analytics.trend.alert': {
    id: 'analytics.trend.alert',
    name: 'Trend Alert',
    level: ActionLevel.SAFE,
    eventTrigger: 'analytics.trend.detected',
    description: 'Alert on significant business trend changes',
    autoExecute: true,
    timeoutMs: 15000,
    retryable: true,
    maxRetries: 2
  }
};

/**
 * Get action by ID
 */
export function getAction(actionId: string): Action | undefined {
  return ACTION_REGISTRY[actionId];
}

/**
 * Get actions by trigger event
 */
export function getActionsByTrigger(eventTrigger: string): Action[] {
  return Object.values(ACTION_REGISTRY).filter(
    action => action.eventTrigger === eventTrigger
  );
}

/**
 * Get all actions by level
 */
export function getActionsByLevel(level: ActionLevel): Action[] {
  return Object.values(ACTION_REGISTRY).filter(
    action => action.level === level
  );
}

/**
 * Get all auto-executable actions
 */
export function getAutoExecutableActions(): Action[] {
  return Object.values(ACTION_REGISTRY).filter(
    action => action.autoExecute
  );
}

/**
 * Check if action requires approval
 */
export function requiresApproval(actionId: string): boolean {
  const action = getAction(actionId);
  if (!action) return true;
  return action.requiresApproval ?? action.level >= ActionLevel.SEMI_SAFE;
}

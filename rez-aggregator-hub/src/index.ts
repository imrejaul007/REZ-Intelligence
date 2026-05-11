/**
 * Aggregator Hub - Main Entry Point
 *
 * Unified interface for managing orders across Swiggy, Zomato, and Magicpin
 *
 * @example
 * ```typescript
 * import { AggregatorHub, createAggregatorHub } from 'rez-aggregator-hub';
 *
 * const hub = createAggregatorHub({
 *   swiggy: { apiKey: 'your-swiggy-key', storeId: '...' },
 *   zomato: { apiKey: 'your-zomato-key', storeId: '...' },
 *   magicpin: { apiKey: 'your-magicpin-key', storeId: '...' },
 *   storeId: 'your-store-id',
 * });
 *
 * // Fetch orders from all aggregators
 * const orders = await hub.getOrders('store-123');
 *
 * // Sync menu to all platforms
 * await hub.syncMenu('store-123', menuItems);
 *
 * // Handle webhooks
 * await hub.handleWebhook('swiggy', webhookPayload);
 *
 * // Get analytics
 * const analytics = await hub.getAnalytics('store-123', { start: new Date('2024-01-01'), end: new Date() });
 * ```
 */

// ============================================
// Main Class Export
// ============================================

export {
  AggregatorHub,
  createAggregatorHub,
} from './AggregatorHub';

export type {
  AggregatorHubConfig,
  AggregatorHubOptions,
} from './AggregatorHub';

// ============================================
// Type Exports
// ============================================

export type {
  Order,
  OrderItem,
  OrderAddon,
  OrderStatus,
  MenuItem,
  MenuVariant,
  MenuAddon,
  MenuCustomization,
  CustomizationOption,
  AvailabilityUpdate,
  SyncResult,
  SyncError,
  SyncWarning,
  DateRange,
  Analytics,
  AggregatorStats,
  PeakHourData,
  TopItemData,
  DailyVolume,
  WebhookPayload,
  WebhookEventType,
  WebhookHandlerResult,
  AggregatorConfig,
  ApiResponse,
  ApiError,
  Aggregator,
  Logger,
  HealthCheck,
} from './types';

// ============================================
// Client Exports
// ============================================

export { SwiggyClient } from './clients/swiggy';
export { ZomatoClient } from './clients/zomato';
export { MagicpinClient } from './clients/magicpin';

// ============================================
// Utility Exports
// ============================================

export { Logger, createLogger } from './utils/logger';
export type { LoggerConfig, LogLevel, LogEntry } from './utils/logger';

export {
  OrderNormalizer,
  normalizer,
  formatPhoneNumber,
  parseCustomerName,
  calculateEstimatedDelivery,
  sanitizeOrderForLogging,
} from './utils/normalizer';

export {
  WebhookRouter,
  SwiggyWebhookHandler,
  ZomatoWebhookHandler,
  MagicpinWebhookHandler,
} from './webhooks/handlers';

export type {
  WebhookEventHandlers,
  SwiggyWebhookData,
  ZomatoWebhookData,
  MagicpinWebhookData,
} from './webhooks/handlers';

// ============================================
// Re-export types from clients
// ============================================

export type {
  SwiggyOrder,
  SwiggyOrderItem,
  SwiggyAddon,
  SwiggyMenuItem,
  SwiggyVariant,
  SwiggyAddonDefinition,
  SwiggyWebhookPayload,
  SwiggyApiError,
} from './clients/swiggy';

export type {
  ZomatoOrder,
  ZomatoOrderItem,
  ZomatoAddon,
  ZomatoMenuItem,
  ZomatoVariant,
  ZomatoAddonDefinition,
  ZomatoWebhookPayload,
  ZomatoApiError,
  ZomatoAuthResponse,
} from './clients/zomato';

export type {
  MagicpinOrder,
  MagicpinOrderItem,
  MagicpinAddon,
  MagicpinMenuItem,
  MagicpinVariant,
  MagicpinAddonDefinition,
  MagicpinWebhookPayload,
  MagicpinApiError,
} from './clients/magicpin';

// ============================================
// Version Info
// ============================================

export const VERSION = '1.0.0';
export const NAME = 'rez-aggregator-hub';

/**
 * Library information
 */
export const INFO = {
  name: NAME,
  version: VERSION,
  description: 'Unified interface for Swiggy, Zomato, and Magicpin integration',
  documentation: 'https://github.com/rez/aggregator-hub',
};

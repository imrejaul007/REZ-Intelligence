/**
 * Core types for the Aggregator Hub
 * Defines all shared interfaces for Swiggy, Zomato, and Magicpin integration
 */

// ============================================
// Core Entity Types
// ============================================

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  variant?: string;
  addons?: OrderAddon[];
  notes?: string;
}

export interface OrderAddon {
  id: string;
  name: string;
  price: number;
}

export interface Order {
  id: string;
  aggregatorOrderId: string;
  aggregator: 'swiggy' | 'zomato' | 'magicpin';
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  packagingFee: number;
  discount: number;
  total: number;
  paymentMethod: 'prepaid' | 'cod' | 'upi' | 'card';
  orderStatus: OrderStatus;
  orderType: 'delivery' | 'pickup' | 'dine-in';
  specialInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedDeliveryTime?: Date;
  acceptedAt?: Date;
  readyAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  isHighPriority: boolean;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'rejected'
  | 'pending_confirmation';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
  isVeg: boolean;
  isBestseller?: boolean;
  preparationTime?: number; // in minutes
  variants?: MenuVariant[];
  addons?: MenuAddon[];
  tags?: string[];
  customizations?: MenuCustomization[];
  metadata?: Record<string, unknown>;
}

export interface MenuVariant {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface MenuAddon {
  id: string;
  name: string;
  price: number;
  maxQuantity?: number;
  isRequired?: boolean;
}

export interface MenuCustomization {
  id: string;
  name: string;
  type: 'single' | 'multi';
  options: CustomizationOption[];
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface AvailabilityUpdate {
  itemId: string;
  storeItemId: string;
  isAvailable: boolean;
  reason?: string;
  effectiveFrom?: Date;
}

// ============================================
// Sync & Analytics Types
// ============================================

export interface SyncResult {
  success: boolean;
  aggregator: 'swiggy' | 'zomato' | 'magicpin';
  syncedAt: Date;
  itemsProcessed: number;
  itemsSuccess: number;
  itemsFailed: number;
  errors: SyncError[];
  warnings: SyncWarning[];
  durationMs: number;
}

export interface SyncError {
  itemId: string;
  itemName: string;
  errorCode: string;
  message: string;
  retryable: boolean;
}

export interface SyncWarning {
  itemId: string;
  itemName: string;
  warningCode: string;
  message: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Analytics {
  storeId: string;
  period: DateRange;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  byAggregator: AggregatorStats[];
  orderStatusBreakdown: Record<OrderStatus, number>;
  peakHours: PeakHourData[];
  topItems: TopItemData[];
  cancellationRate: number;
  orderVolumeTrend: DailyVolume[];
}

export interface AggregatorStats {
  aggregator: 'swiggy' | 'zomato' | 'magicpin';
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
  cancellationRate: number;
}

export interface PeakHourData {
  hour: number;
  orderCount: number;
  revenue: number;
}

export interface TopItemData {
  itemId: string;
  itemName: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
}

export interface DailyVolume {
  date: string;
  orders: number;
  revenue: number;
  byAggregator: Record<string, number>;
}

// ============================================
// Webhook Types
// ============================================

export interface WebhookPayload {
  aggregator: 'swiggy' | 'zomato' | 'magicpin';
  eventType: WebhookEventType;
  timestamp: Date;
  data: unknown;
  signature?: string;
}

export type WebhookEventType =
  | 'order.new'
  | 'order.accepted'
  | 'order.preparing'
  | 'order.ready'
  | 'order.picked_up'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.rejected'
  | 'order.updated'
  | 'menu.updated'
  | 'item.updated'
  | 'store.updated';

export interface WebhookHandlerResult {
  success: boolean;
  processedAt: Date;
  message?: string;
  error?: string;
}

// ============================================
// API Client Types
// ============================================

export interface AggregatorConfig {
  apiKey: string;
  apiSecret?: string;
  storeId: string;
  baseUrl: string;
  webhookSecret?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Utility Types
// ============================================

export type Aggregator = 'swiggy' | 'zomato' | 'magicpin';

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export interface HealthCheck {
  aggregator: Aggregator;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  lastChecked: Date;
  error?: string;
}

/**
 * TypeScript type definitions for REZ Reorder Engine
 */

import { Types } from 'mongoose';

/**
 * Commerce categories supported by the reorder engine
 */
export const COMMERCE_CATEGORIES = {
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  RETAIL: 'retail',
  BOOKING: 'booking',
  SERVICES: 'services',
  FINTECH: 'fintech'
} as const;

export type CommerceCategory = typeof COMMERCE_CATEGORIES[keyof typeof COMMERCE_CATEGORIES];

/**
 * Nudge urgency levels
 */
export type UrgencyLevel = 'high' | 'medium' | 'low';

/**
 * Nudge types
 */
export const NUDGE_TYPES = {
  REORDER_REMINDER: 'reorder_reminder',
  DEAL_ALERT: 'deal_alert',
  NEW_ITEM: 'new_item',
  LOYALTY_REWARD: 'loyalty_reward',
  PRICE_DROP: 'price_drop'
} as const;

export type NudgeType = typeof NUDGE_TYPES[keyof typeof NUDGE_TYPES];

/**
 * Nudge delivery channels
 */
export const NUDGE_CHANNELS = {
  PUSH: 'push',
  SMS: 'sms',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp'
} as const;

export type NudgeChannel = typeof NUDGE_CHANNELS[keyof typeof NUDGE_CHANNELS];

/**
 * Nudge status
 */
export const NUDGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  CLICKED: 'clicked',
  CONVERTED: 'converted',
  DISMISSED: 'dismissed',
  FAILED: 'failed'
} as const;

export type NudgeStatus = typeof NUDGE_STATUS[keyof typeof NUDGE_STATUS];

/**
 * Order item in the summary
 */
export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

/**
 * Order summary
 */
export interface OrderSummary {
  items: OrderItem[];
  totalValue: number;
  currency: string;
}

/**
 * Profile metrics
 */
export interface ProfileMetrics {
  totalOrders: number;
  avgOrderValue: number;
  avgQuantity: number;
  lastInteraction: string;
  favoriteItemId: string | undefined;
  favoriteItemName: string | undefined;
}

/**
 * Nudge interaction tracking
 */
export interface NudgeInteractions {
  sent: number;
  clicked: number;
  converted: number;
}

/**
 * Reorder profile document interface
 */
export interface IReorderProfile {
  _id: Types.ObjectId;
  userId: string;
  merchantId: string;
  category: CommerceCategory;
  lastOrderId: string;
  lastOrderDate: Date;
  orderFrequencyDays: number;
  predictedReorderDate: Date | null;
  reorderScore: number;
  urgency: UrgencyLevel;
  nudgeSent: boolean;
  nudgeSentAt: Date | null;
  nudgeInteractions: NudgeInteractions;
  orderSummary: OrderSummary;
  metrics: ProfileMetrics;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Nudge content
 */
export interface NudgeContent {
  title?: string;
  body?: string;
  imageUrl?: string;
  actionText?: string;
  items?: string[];
}

/**
 * Nudge queue document interface
 */
export interface INudgeQueue {
  _id: Types.ObjectId;
  userId: string;
  merchantId: string;
  reorderProfileId: string;
  category: CommerceCategory;
  nudgeType: NudgeType;
  scheduledFor: Date;
  content: NudgeContent;
  channels: NudgeChannel[];
  status: NudgeStatus;
  sentAt: Date | null;
  clickAt: Date | null;
  convertAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

/**
 * Reorder recommendation
 */
export interface ReorderRecommendation {
  merchantId: string;
  category: CommerceCategory;
  reorderScore: number;
  urgency: UrgencyLevel;
  predictedReorderDate: Date;
  lastOrderDate: Date;
  avgOrderValue: number | undefined;
  favoriteItem: {
    id: string | undefined;
    name: string | undefined;
  };
  topItems: OrderItem[];
}

/**
 * Homepage recommendations
 */
export interface HomepageRecommendations {
  personalized: Array<{
    type: string;
    category: CommerceCategory;
    merchantId: string;
    title: string;
    subtitle: string | undefined;
    score: number;
    urgency: UrgencyLevel;
    items: OrderItem[];
  }>;
  imminent: Array<{
    type: string;
    category: CommerceCategory;
    merchantId: string;
    title: string;
    subtitle: string;
    score: number;
    urgency: UrgencyLevel;
  }>;
}

/**
 * Analytics data
 */
export interface ReorderAnalytics {
  totalProfiles: number;
  nudgesSent: number;
  conversions: number;
  conversionRate: number;
  byCategory: Array<{
    _id: CommerceCategory;
    count: number;
    avgScore: number;
  }>;
}

/**
 * Express request extension
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

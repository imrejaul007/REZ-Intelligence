import logger from './utils/logger';

/**
 * Data Sanitizer Service
 *
 * Transforms internal customer data into merchant-safe formats.
 * Removes all sensitive intelligence data before serving to merchants.
 *
 * ⚠️ IMPORTANT: This is the ONLY service that should be used for merchant-facing data.
 */

import type {
  InternalCustomer,
  MerchantCustomer,
  MerchantCustomerDetail,
  InternalSmartTag,
  MerchantTag,
  InternalSegment,
  MerchantSegment,
  MerchantOrderSummary,
} from '../types/index.js';

// Internal order type for transformation
interface InternalOrder {
  id: string;
  orderNumber: string;
  storeName: string;
  items: Array<{ productId: string; productName: string; quantity: number; price: number; imageUrl?: string }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  paymentMethod?: string;
  createdAt: Date;
}

/**
 * Transform InternalCustomer to MerchantCustomer
 * Removes ALL sensitive intelligence data
 */
export function toMerchantCustomer(internal: InternalCustomer): MerchantCustomer {
  return {
    id: internal.id,
    userId: internal.userId,
    name: internal.fullName || `${internal.firstName || ''} ${internal.lastName || ''}`.trim() || 'Customer',
    phone: internal.phone,
    avatar: internal.avatar,
    segments: internal.segments.map(s => s.name),
    totalOrders: internal.lifetime.totalOrders,
    totalSpend: internal.lifetime.totalSpend,
    averageOrderValue: internal.lifetime.averageOrderValue,
    lastVisit: internal.lifetime.lastOrderDate,
    joinedDate: internal.createdAt,
  };
}

/**
 * Transform InternalCustomer to MerchantCustomerDetail
 * Includes orders and reviews but no intelligence
 */
export function toMerchantCustomerDetail(
  internal: InternalCustomer,
  orders?: InternalOrder[],
  reviews?: Record<string, unknown>[]
): MerchantCustomerDetail {
  return {
    id: internal.id,
    name: internal.fullName || `${internal.firstName || ''} ${internal.lastName || ''}`.trim() || 'Customer',
    phone: internal.phone,
    email: internal.email,
    orders: (orders || []).map(toMerchantOrder),
    reviews: (reviews || []).map(toMerchantReview),
    totalOrders: internal.lifetime.totalOrders,
    totalSpend: internal.lifetime.totalSpend,
    averageOrderValue: internal.lifetime.averageOrderValue,
    lastVisit: internal.lifetime.lastOrderDate,
    joinedDate: internal.createdAt,
    segments: internal.segments.map(s => s.name),
    tags: internal.smartTags
      .filter(t => t.confidence >= 0.7) // Only show high-confidence tags
      .map(toMerchantTag),
  };
}

/**
 * Transform InternalSegment to MerchantSegment
 * Removes internal metrics
 */
export function toMerchantSegment(internal: InternalSegment): MerchantSegment {
  return {
    id: internal.id,
    name: internal.name,
    description: internal.description,
    customerCount: internal.customerCount,
    totalRevenue: internal.totalRevenue || 0,
  };
}

/**
 * Transform InternalSmartTag to MerchantTag
 * Removes confidence scores and internal rules
 */
export function toMerchantTag(internal: InternalSmartTag): MerchantTag {
  return {
    name: internal.name,
    icon: internal.icon,
    color: internal.color,
  };
}

/**
 * Transform order to merchant-safe format
 */
function toMerchantOrder(order: InternalOrder): MerchantOrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    storeName: order.storeName,
    items: order.items.map((item) => item.productName),
    total: order.total,
    status: order.status,
    createdAt: new Date(order.createdAt),
  };
}

/**
 * Transform review to merchant-safe format
 */
function toMerchantReview(review): unknown {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    storeName: review.storeName,
    createdAt: new Date(review.createdAt),
  };
}

/**
 * Filter customer to remove internal-only fields
 * Use this as a safety check
 */
export function sanitizeCustomerObject(customer: Record<string, unknown>): Record<string, unknown> {
  // Fields to NEVER send to merchants
  const forbiddenFields = [
    'predictions',
    'predictions_',
    'churnRisk',
    'churnProbability',
    'ltvPrediction',
    'engagement',
    'engagementScore',
    'intentSignals',
    'intent',
    'browsingSignals',
    'purchaseIntent',
    'brandAffinity',
    'sentiment',
    'smartTags', // Replace with sanitized version
    'segments', // Replace with names only
    'activity',
    'demographics',
    'inferredInterests',
    'inferredLifestyle',
    'devicePatterns',
    'sessionMetrics',
    'modelVersion',
    'confidence',
    'confidenceScore',
    '_confidence',
    'internal',
    '__internal',
  ];

  // Fields to keep (sanitized)
  const allowedFields = [
    'id',
    'userId',
    'name',
    'fullName',
    'firstName',
    'lastName',
    'phone',
    'email',
    'avatar',
    'totalOrders',
    'totalSpend',
    'averageOrderValue',
    'lastVisit',
    'lastOrderDate',
    'joinedDate',
    'createdAt',
  ];

  const sanitized: Record<string, unknown> = {};

  // Add only allowed fields
  for (const field of allowedFields) {
    if (field in customer) {
      sanitized[field] = customer[field];
    }
  }

  // Add segments as array of names
  if (customer.segments && Array.isArray(customer.segments)) {
    sanitized.segments = customer.segments.map((s) =>
      typeof s === 'string' ? s : s.name
    );
  }

  // Add tags without confidence
  if (customer.smartTags && Array.isArray(customer.smartTags)) {
    sanitized.tags = customer.smartTags
      .filter((t) => !t.confidence || t.confidence >= 0.7)
      .map((t) => ({
        name: t.name,
        icon: t.icon,
        color: t.color,
      }));
  }

  return sanitized;
}

/**
 * Validate that an object doesn't contain internal fields
 * Throws error if forbidden fields found
 */
export function validateMerchantSafe(obj: Record<string, unknown>): void {
  const forbiddenPatterns = [
    'prediction',
    'churn',
    'engagement',
    'intent',
    'confidence',
    'inferred',
    'internal',
    'ai_',
    '_ai',
    '__ai',
  ];

  const keys = Object.keys(obj);

  for (const key of keys) {
    const lowerKey = key.toLowerCase();

    for (const pattern of forbiddenPatterns) {
      if (lowerKey.includes(pattern.toLowerCase())) {
        logger.error(`[SECURITY] Forbidden field detected in merchant response: ${key}`);
        throw new Error(`Security violation: Internal field '${key}' found in merchant response`);
      }
    }

    // Recursively check nested objects
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      validateMerchantSafe(obj[key]);
    }
  }
}

/**
 * Sanitize array of customers
 */
export function sanitizeCustomerList(customers: InternalCustomer[]): MerchantCustomer[] {
  return customers.map(toMerchantCustomer);
}

/**
 * Sanitize array of segments
 */
export function sanitizeSegmentList(segments: InternalSegment[]): MerchantSegment[] {
  return segments.map(toMerchantSegment);
}

export default {
  toMerchantCustomer,
  toMerchantCustomerDetail,
  toMerchantSegment,
  toMerchantTag,
  sanitizeCustomerObject,
  validateMerchantSafe,
  sanitizeCustomerList,
  sanitizeSegmentList,
};

/**
 * REZ Memory Layer - Event Normalizer
 * Normalize events from different sources to a common schema
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  NormalizedEvent,
  EventSource,
  EventCategory,
  EventMetadata,
  TimelineEvent
} from '../types/timeline';
import { logger } from '../config/logger';

// Source-specific event schemas
const EventSourceSchema = z.enum([
  'whatsapp',
  'support',
  'order',
  'payment',
  'loyalty',
  'campaign',
  'qr',
  'ai',
  'push',
  'auth',
  'catalog',
  'search',
  'delivery',
  'booking',
  'dooh'
]);

const EventCategorySchema = z.enum([
  'commerce',
  'engagement',
  'identity',
  'loyalty',
  'intelligence',
  'support',
  'marketing',
  'notification'
]);

// Generic event schema - simplified for TypeScript compatibility
const GenericEventSchema = z.object({
  userId: z.string(),
  type: z.string(),
  category: z.string(),
  source: z.string(),
  data: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional()
});

// Source-specific normalizers
interface SourceNormalizer {
  canHandle: (event: unknown) => boolean;
  normalize: (event: unknown) => NormalizedEvent;
}

// WhatsApp event normalizer
const whatsappNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType === 'whatsapp_message' ||
      e.source === 'whatsapp' ||
      (e.channel && String(e.channel).toLowerCase().includes('whatsapp'))
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    return {
      userId: String(e.userId || e.user_id || e.phone),
      type: String(e.eventType || e.messageType || 'whatsapp_message'),
      category: 'engagement' as EventCategory,
      source: 'whatsapp' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        messageType: e.messageType || e.message_type,
        messageContent: e.messageContent || e.content,
        direction: e.direction || 'inbound',
        mediaUrl: e.mediaUrl || e.media_url,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// Order event normalizer
const orderNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType === 'order_placed' ||
      e.eventType === 'order_completed' ||
      e.eventType === 'order_cancelled' ||
      e.source === 'order' ||
      (e.orderId || e.order_id)
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    const eventType = String(e.eventType || e.type || 'order_event');

    return {
      userId: String(e.userId || e.user_id),
      type: eventType,
      category: 'commerce' as EventCategory,
      source: 'order' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        orderId: e.orderId || e.order_id,
        status: e.status,
        total: e.total || e.orderTotal,
        items: e.items,
        merchantId: e.merchantId || e.merchant_id,
        paymentMethod: e.paymentMethod || e.payment_method,
        deliveryAddress: e.deliveryAddress,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// Payment event normalizer
const paymentNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType?.toString().includes('payment') ||
      e.source === 'payment' ||
      (e.paymentId || e.razorpay_payment_id)
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    return {
      userId: String(e.userId || e.user_id),
      type: String(e.eventType || 'payment_event'),
      category: 'commerce' as EventCategory,
      source: 'payment' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        paymentId: e.paymentId || e.razorpay_payment_id,
        orderId: e.orderId || e.order_id,
        amount: e.amount,
        currency: e.currency || 'INR',
        status: e.status,
        method: e.method,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// Loyalty event normalizer
const loyaltyNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType?.toString().includes('loyalty') ||
      e.eventType?.toString().includes('coin') ||
      e.eventType?.toString().includes('points') ||
      e.source === 'loyalty'
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    return {
      userId: String(e.userId || e.user_id),
      type: String(e.eventType || 'loyalty_event'),
      category: 'loyalty' as EventCategory,
      source: 'loyalty' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        points: e.points || e.coins,
        balance: e.balance,
        transactionType: e.transactionType || e.type,
        reason: e.reason,
        source: e.source,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// Support event normalizer
const supportNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType?.toString().includes('ticket') ||
      e.eventType?.toString().includes('support') ||
      e.source === 'support'
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    return {
      userId: String(e.userId || e.user_id),
      type: String(e.eventType || 'support_event'),
      category: 'support' as EventCategory,
      source: 'support' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        ticketId: e.ticketId || e.ticket_id,
        subject: e.subject,
        status: e.status,
        priority: e.priority,
        category: e.category,
        resolution: e.resolution,
        agentId: e.agentId || e.agent_id,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// Campaign event normalizer
const campaignNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType?.toString().includes('campaign') ||
      e.eventType?.toString().includes('push') ||
      e.eventType?.toString().includes('email') ||
      e.source === 'campaign' ||
      e.source === 'push'
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    const source = e.source === 'push' ? 'push' : 'campaign';
    return {
      userId: String(e.userId || e.user_id),
      type: String(e.eventType || 'campaign_event'),
      category: 'marketing' as EventCategory,
      source: source as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        campaignId: e.campaignId || e.campaign_id,
        campaignName: e.campaignName,
        channel: e.channel,
        action: e.action,
        messageId: e.messageId || e.message_id,
        delivered: e.delivered,
        opened: e.opened,
        clicked: e.clicked,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// QR event normalizer
const qrNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType?.toString().includes('qr') ||
      e.source === 'qr' ||
      (e.qrId || e.qr_id)
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    return {
      userId: String(e.userId || e.user_id),
      type: String(e.eventType || 'qr_scan'),
      category: 'engagement' as EventCategory,
      source: 'qr' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        qrId: e.qrId || e.qr_id,
        qrType: e.qrType || e.type,
        merchantId: e.merchantId || e.merchant_id,
        scannedAt: e.scannedAt,
        action: e.action,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// AI event normalizer
const aiNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType?.toString().includes('ai') ||
      e.eventType?.toString().includes('chatbot') ||
      e.eventType?.toString().includes('intent') ||
      e.source === 'ai'
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    return {
      userId: String(e.userId || e.user_id),
      type: String(e.eventType || 'ai_interaction'),
      category: 'intelligence' as EventCategory,
      source: 'ai' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        agentId: e.agentId || e.agent_id,
        intent: e.intent,
        query: e.query,
        response: e.response,
        confidence: e.confidence,
        entities: e.entities,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// Auth event normalizer
const authNormalizer: SourceNormalizer = {
  canHandle: (event: unknown) => {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
      e.eventType?.toString().includes('auth') ||
      e.eventType?.toString().includes('login') ||
      e.eventType?.toString().includes('logout') ||
      e.eventType?.toString().includes('register') ||
      e.source === 'auth'
    );
  },

  normalize: (event: unknown) => {
    const e = event as Record<string, unknown>;
    return {
      userId: String(e.userId || e.user_id),
      type: String(e.eventType || 'auth_event'),
      category: 'identity' as EventCategory,
      source: 'auth' as EventSource,
      timestamp: new Date(
        e.timestamp as string || e.createdAt as string || Date.now()
      ),
      data: {
        method: e.method,
        provider: e.provider,
        status: e.status,
        deviceId: e.deviceId || e.device_id,
        ipAddress: e.ipAddress,
        ...e.extraData
      },
      metadata: extractMetadata(e)
    };
  }
};

// All normalizers in priority order
const normalizers: SourceNormalizer[] = [
  orderNormalizer,
  paymentNormalizer,
  loyaltyNormalizer,
  supportNormalizer,
  campaignNormalizer,
  whatsappNormalizer,
  qrNormalizer,
  aiNormalizer,
  authNormalizer
];

/**
 * Extract metadata from raw event data
 */
function extractMetadata(event: Record<string, unknown>): EventMetadata {
  const metadata: EventMetadata = {};

  if (event.sessionId || event.session_id) {
    metadata.sessionId = String(event.sessionId || event.session_id);
  }
  if (event.deviceId || event.device_id) {
    metadata.deviceId = String(event.deviceId || event.device_id);
  }
  if (event.ipAddress || event.ip_address) {
    metadata.ipAddress = String(event.ipAddress || event.ip_address);
  }
  if (event.userAgent || event.user_agent) {
    metadata.userAgent = String(event.userAgent || event.user_agent);
  }
  if (event.correlationId || event.correlation_id) {
    metadata.correlationId = String(event.correlationId || event.correlation_id);
  }
  if (event.parentEventId || event.parent_event_id) {
    metadata.parentEventId = String(event.parentEventId || event.parent_event_id);
  }

  if (event.location) {
    const loc = event.location as Record<string, unknown>;
    metadata.location = {
      type: 'Point',
      coordinates: [
        Number(loc.longitude || loc.lng || 0),
        Number(loc.latitude || loc.lat || 0)
      ],
      city: loc.city as string | undefined,
      country: loc.country as string | undefined
    };
  }

  return metadata;
}

/**
 * Normalize a single event from any source
 */
export function normalizeEvent(event: unknown): NormalizedEvent {
  // Try each normalizer
  for (const normalizer of normalizers) {
    try {
      if (normalizer.canHandle(event)) {
        return normalizer.normalize(event);
      }
    } catch (error) {
      logger.warn(`Normalizer failed: ${error}`);
    }
  }

  // Fallback: try generic schema validation
  try {
    const validated = GenericEventSchema.parse(event);
    return {
      userId: validated.userId,
      type: validated.type,
      category: validated.category,
      source: validated.source,
      timestamp: validated.timestamp ? new Date(validated.timestamp) : new Date(),
      data: validated.data,
      metadata: validated.metadata
    };
  } catch (error) {
    logger.error('Failed to normalize event:', error);
    throw new Error('Unable to normalize event: invalid format');
  }
}

/**
 * Normalize multiple events
 */
export function normalizeEvents(events: unknown[]): NormalizedEvent[] {
  return events.map((event, index) => {
    try {
      return normalizeEvent(event);
    } catch (error) {
      logger.error(`Failed to normalize event at index ${index}:`, error);
      throw error;
    }
  });
}

/**
 * Convert normalized event to TimelineEvent
 */
export function toTimelineEvent(normalized: NormalizedEvent): TimelineEvent {
  return {
    id: uuidv4(),
    userId: normalized.userId,
    type: normalized.type,
    category: normalized.category,
    source: normalized.source,
    timestamp: normalized.timestamp,
    data: normalized.data,
    metadata: normalized.metadata
  };
}

/**
 * Validate an event against the generic schema
 */
export function validateEvent(event: unknown): {
  valid: boolean;
  error?: string;
  data?: NormalizedEvent;
} {
  try {
    const normalized = normalizeEvent(event);
    return { valid: true, data: normalized };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

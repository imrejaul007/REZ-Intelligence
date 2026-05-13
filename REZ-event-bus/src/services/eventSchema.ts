/**
 * Event Schema Service
 * Standardized event types for the REZ Agent OS v3
 */

import { z } from 'zod';

/**
 * Standardized Event Types for REZ Agent OS v3
 * All services should use these event types for consistency
 */
export const EventType = {
  // User Messaging Events
  USER_MESSAGE_RECEIVED: 'USER_MESSAGE_RECEIVED',
  USER_MESSAGE_SENT: 'USER_MESSAGE_SENT',

  // Intent Detection Events
  INTENT_DETECTED: 'INTENT_DETECTED',
  AGENT_SELECTED: 'AGENT_SELECTED',
  AGENT_SWITCHED: 'AGENT_SWITCHED',

  // Collaboration Events
  COLLABORATION_STARTED: 'COLLABORATION_STARTED',

  // Order Events
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',

  // Payment Events
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',

  // Health Events
  SERVICE_HEALTH_CHANGED: 'SERVICE_HEALTH_CHANGED',
} as const;

export type EventTypeValue = typeof EventType[keyof typeof EventType];

/**
 * Event Type Categories
 */
export const EventCategory = {
  USER_INTERACTION: 'USER_INTERACTION',
  INTENT_PROCESSING: 'INTENT_PROCESSING',
  AGENT_ORCHESTRATION: 'AGENT_ORCHESTRATION',
  COLLABORATION: 'COLLABORATION',
  BUSINESS_LOGIC: 'BUSINESS_LOGIC',
  PAYMENT: 'PAYMENT',
  HEALTH: 'HEALTH',
} as const;

export type EventCategoryValue = typeof EventCategory[keyof typeof EventCategory];

/**
 * Map event types to categories
 */
export const EventTypeToCategory: Record<EventTypeValue, EventCategoryValue> = {
  [EventType.USER_MESSAGE_RECEIVED]: EventCategory.USER_INTERACTION,
  [EventType.USER_MESSAGE_SENT]: EventCategory.USER_INTERACTION,
  [EventType.INTENT_DETECTED]: EventCategory.INTENT_PROCESSING,
  [EventType.AGENT_SELECTED]: EventCategory.AGENT_ORCHESTRATION,
  [EventType.AGENT_SWITCHED]: EventCategory.AGENT_ORCHESTRATION,
  [EventType.COLLABORATION_STARTED]: EventCategory.COLLABORATION,
  [EventType.ORDER_CREATED]: EventCategory.BUSINESS_LOGIC,
  [EventType.ORDER_COMPLETED]: EventCategory.BUSINESS_LOGIC,
  [EventType.PAYMENT_INITIATED]: EventCategory.PAYMENT,
  [EventType.PAYMENT_COMPLETED]: EventCategory.PAYMENT,
  [EventType.SERVICE_HEALTH_CHANGED]: EventCategory.HEALTH,
};

/**
 * Event Payload Schemas
 */

// User Message Schema
export const UserMessagePayloadSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
  content: z.string(),
  channel: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.object({
    intent: z.string().optional(),
    sentiment: z.string().optional(),
    language: z.string().optional(),
  }).optional(),
});

// Intent Detection Schema
export const IntentDetectedPayloadSchema = z.object({
  userId: z.string(),
  messageId: z.string(),
  intent: z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
    entities: z.record(z.unknown()).optional(),
  }),
  context: z.object({
    previousIntents: z.array(z.string()).optional(),
    sessionId: z.string(),
    userProfile: z.record(z.unknown()).optional(),
  }),
  timestamp: z.string().datetime(),
});

// Agent Selection Schema
export const AgentSelectedPayloadSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  selectedAgent: z.object({
    agentId: z.string(),
    agentType: z.string(),
    name: z.string(),
    capabilities: z.array(z.string()),
  }),
  selectionCriteria: z.object({
    primary: z.string(),
    fallback: z.array(z.string()).optional(),
  }),
  confidence: z.number().min(0).max(1),
  timestamp: z.string().datetime(),
});

// Agent Switch Schema
export const AgentSwitchedPayloadSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  fromAgent: z.object({
    agentId: z.string(),
    agentType: z.string(),
    name: z.string(),
  }),
  toAgent: z.object({
    agentId: z.string(),
    agentType: z.string(),
    name: z.string(),
  }),
  reason: z.string(),
  timestamp: z.string().datetime(),
});

// Collaboration Started Schema
export const CollaborationStartedPayloadSchema = z.object({
  collaborationId: z.string(),
  participants: z.array(z.object({
    agentId: z.string(),
    agentType: z.string(),
    role: z.enum(['primary', 'secondary', 'consultant']),
  })),
  context: z.object({
    topic: z.string(),
    sharedState: z.record(z.unknown()).optional(),
  }),
  timestamp: z.string().datetime(),
});

// Order Created Schema
export const OrderCreatedPayloadSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  merchantId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    metadata: z.record(z.unknown()).optional(),
  })),
  totalAmount: z.number().positive(),
  currency: z.string().length(3),
  paymentMethod: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

// Order Completed Schema
export const OrderCompletedPayloadSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  merchantId: z.string(),
  status: z.enum(['completed', 'cancelled', 'refunded']),
  totalAmount: z.number().positive(),
  currency: z.string().length(3),
  completedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

// Payment Initiated Schema
export const PaymentInitiatedPayloadSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  userId: z.string(),
  merchantId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  paymentMethod: z.enum(['card', 'wallet', 'bank_transfer', 'upi']),
  gateway: z.string(),
  status: z.enum(['pending', 'processing', 'requires_action']),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

// Payment Completed Schema
export const PaymentCompletedPayloadSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  userId: z.string(),
  merchantId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  paymentMethod: z.enum(['card', 'wallet', 'bank_transfer', 'upi']),
  gateway: z.string(),
  gatewayTransactionId: z.string(),
  status: z.enum(['completed', 'failed', 'refunded', 'partially_refunded']),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

// Service Health Changed Schema
export const ServiceHealthChangedPayloadSchema = z.object({
  serviceName: z.string(),
  previousStatus: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  currentStatus: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  reason: z.string().optional(),
  metrics: z.object({
    latencyMs: z.number().optional(),
    errorRate: z.number().min(0).max(1).optional(),
    availability: z.number().min(0).max(1).optional(),
  }).optional(),
  timestamp: z.string().datetime(),
});

/**
 * Complete Event Schema
 */
export const ReZEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum([
    EventType.USER_MESSAGE_RECEIVED,
    EventType.USER_MESSAGE_SENT,
    EventType.INTENT_DETECTED,
    EventType.AGENT_SELECTED,
    EventType.AGENT_SWITCHED,
    EventType.COLLABORATION_STARTED,
    EventType.ORDER_CREATED,
    EventType.ORDER_COMPLETED,
    EventType.PAYMENT_INITIATED,
    EventType.PAYMENT_COMPLETED,
    EventType.SERVICE_HEALTH_CHANGED,
  ] as const),
  payload: z.unknown(), // Will be validated based on event type
  metadata: z.object({
    source: z.string(),
    timestamp: z.string().datetime(),
    correlationId: z.string().uuid().optional(),
    causationId: z.string().uuid().optional(),
    replyTo: z.string().optional(),
    priority: z.enum(['high', 'normal', 'low']).default('normal'),
    tags: z.array(z.string()).optional(),
  }),
  version: z.string().default('1.0'),
});

/**
 * Get payload schema for event type
 */
export function getPayloadSchema(eventType: EventTypeValue): z.ZodSchema {
  const schemas: Record<EventTypeValue, z.ZodSchema> = {
    [EventType.USER_MESSAGE_RECEIVED]: UserMessagePayloadSchema,
    [EventType.USER_MESSAGE_SENT]: UserMessagePayloadSchema,
    [EventType.INTENT_DETECTED]: IntentDetectedPayloadSchema,
    [EventType.AGENT_SELECTED]: AgentSelectedPayloadSchema,
    [EventType.AGENT_SWITCHED]: AgentSwitchedPayloadSchema,
    [EventType.COLLABORATION_STARTED]: CollaborationStartedPayloadSchema,
    [EventType.ORDER_CREATED]: OrderCreatedPayloadSchema,
    [EventType.ORDER_COMPLETED]: OrderCompletedPayloadSchema,
    [EventType.PAYMENT_INITIATED]: PaymentInitiatedPayloadSchema,
    [EventType.PAYMENT_COMPLETED]: PaymentCompletedPayloadSchema,
    [EventType.SERVICE_HEALTH_CHANGED]: ServiceHealthChangedPayloadSchema,
  };

  return schemas[eventType];
}

/**
 * Validate event payload against its schema
 */
export function validateEventPayload(
  eventType: EventTypeValue,
  payload: unknown
): { valid: boolean; error?: string; data?: unknown } {
  const schema = getPayloadSchema(eventType);
  const result = schema.safeParse(payload);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  return {
    valid: false,
    error: result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; '),
  };
}

/**
 * Get all valid event types
 */
export function getValidEventTypes(): EventTypeValue[] {
  return Object.values(EventType);
}

/**
 * Get event type info
 */
export function getEventTypeInfo(eventType: EventTypeValue): {
  category: EventCategoryValue;
  description: string;
  priority: 'high' | 'normal' | 'low';
} {
  const info: Record<EventTypeValue, { category: EventCategoryValue; description: string; priority: 'high' | 'normal' | 'low' }> = {
    [EventType.USER_MESSAGE_RECEIVED]: {
      category: EventCategory.USER_INTERACTION,
      description: 'User sent a message to the system',
      priority: 'normal',
    },
    [EventType.USER_MESSAGE_SENT]: {
      category: EventCategory.USER_INTERACTION,
      description: 'System sent a message to the user',
      priority: 'normal',
    },
    [EventType.INTENT_DETECTED]: {
      category: EventCategory.INTENT_PROCESSING,
      description: 'User intent was detected and classified',
      priority: 'high',
    },
    [EventType.AGENT_SELECTED]: {
      category: EventCategory.AGENT_ORCHESTRATION,
      description: 'An agent was selected to handle the request',
      priority: 'high',
    },
    [EventType.AGENT_SWITCHED]: {
      category: EventCategory.AGENT_ORCHESTRATION,
      description: 'Request was transferred to a different agent',
      priority: 'normal',
    },
    [EventType.COLLABORATION_STARTED]: {
      category: EventCategory.COLLABORATION,
      description: 'Multi-agent collaboration session started',
      priority: 'normal',
    },
    [EventType.ORDER_CREATED]: {
      category: EventCategory.BUSINESS_LOGIC,
      description: 'A new order was created',
      priority: 'high',
    },
    [EventType.ORDER_COMPLETED]: {
      category: EventCategory.BUSINESS_LOGIC,
      description: 'An order was completed, cancelled, or refunded',
      priority: 'high',
    },
    [EventType.PAYMENT_INITIATED]: {
      category: EventCategory.PAYMENT,
      description: 'A payment was initiated',
      priority: 'high',
    },
    [EventType.PAYMENT_COMPLETED]: {
      category: EventCategory.PAYMENT,
      description: 'A payment was completed or failed',
      priority: 'high',
    },
    [EventType.SERVICE_HEALTH_CHANGED]: {
      category: EventCategory.HEALTH,
      description: 'Service health status changed',
      priority: 'high',
    },
  };

  return info[eventType];
}

export default EventType;

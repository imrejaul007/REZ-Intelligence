"use strict";
/**
 * Event Schema Service
 * Standardized event types for the REZ Agent OS v3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReZEventSchema = exports.ServiceHealthChangedPayloadSchema = exports.PaymentCompletedPayloadSchema = exports.PaymentInitiatedPayloadSchema = exports.OrderCompletedPayloadSchema = exports.OrderCreatedPayloadSchema = exports.CollaborationStartedPayloadSchema = exports.AgentSwitchedPayloadSchema = exports.AgentSelectedPayloadSchema = exports.IntentDetectedPayloadSchema = exports.UserMessagePayloadSchema = exports.EventTypeToCategory = exports.EventCategory = exports.EventType = void 0;
exports.getPayloadSchema = getPayloadSchema;
exports.validateEventPayload = validateEventPayload;
exports.getValidEventTypes = getValidEventTypes;
exports.getEventTypeInfo = getEventTypeInfo;
const zod_1 = require("zod");
/**
 * Standardized Event Types for REZ Agent OS v3
 * All services should use these event types for consistency
 */
exports.EventType = {
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
};
/**
 * Event Type Categories
 */
exports.EventCategory = {
    USER_INTERACTION: 'USER_INTERACTION',
    INTENT_PROCESSING: 'INTENT_PROCESSING',
    AGENT_ORCHESTRATION: 'AGENT_ORCHESTRATION',
    COLLABORATION: 'COLLABORATION',
    BUSINESS_LOGIC: 'BUSINESS_LOGIC',
    PAYMENT: 'PAYMENT',
    HEALTH: 'HEALTH',
};
/**
 * Map event types to categories
 */
exports.EventTypeToCategory = {
    [exports.EventType.USER_MESSAGE_RECEIVED]: exports.EventCategory.USER_INTERACTION,
    [exports.EventType.USER_MESSAGE_SENT]: exports.EventCategory.USER_INTERACTION,
    [exports.EventType.INTENT_DETECTED]: exports.EventCategory.INTENT_PROCESSING,
    [exports.EventType.AGENT_SELECTED]: exports.EventCategory.AGENT_ORCHESTRATION,
    [exports.EventType.AGENT_SWITCHED]: exports.EventCategory.AGENT_ORCHESTRATION,
    [exports.EventType.COLLABORATION_STARTED]: exports.EventCategory.COLLABORATION,
    [exports.EventType.ORDER_CREATED]: exports.EventCategory.BUSINESS_LOGIC,
    [exports.EventType.ORDER_COMPLETED]: exports.EventCategory.BUSINESS_LOGIC,
    [exports.EventType.PAYMENT_INITIATED]: exports.EventCategory.PAYMENT,
    [exports.EventType.PAYMENT_COMPLETED]: exports.EventCategory.PAYMENT,
    [exports.EventType.SERVICE_HEALTH_CHANGED]: exports.EventCategory.HEALTH,
};
/**
 * Event Payload Schemas
 */
// User Message Schema
exports.UserMessagePayloadSchema = zod_1.z.object({
    messageId: zod_1.z.string(),
    userId: zod_1.z.string(),
    content: zod_1.z.string(),
    channel: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    metadata: zod_1.z.object({
        intent: zod_1.z.string().optional(),
        sentiment: zod_1.z.string().optional(),
        language: zod_1.z.string().optional(),
    }).optional(),
});
// Intent Detection Schema
exports.IntentDetectedPayloadSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    intent: zod_1.z.object({
        name: zod_1.z.string(),
        confidence: zod_1.z.number().min(0).max(1),
        entities: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    context: zod_1.z.object({
        previousIntents: zod_1.z.array(zod_1.z.string()).optional(),
        sessionId: zod_1.z.string(),
        userProfile: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    timestamp: zod_1.z.string().datetime(),
});
// Agent Selection Schema
exports.AgentSelectedPayloadSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    selectedAgent: zod_1.z.object({
        agentId: zod_1.z.string(),
        agentType: zod_1.z.string(),
        name: zod_1.z.string(),
        capabilities: zod_1.z.array(zod_1.z.string()),
    }),
    selectionCriteria: zod_1.z.object({
        primary: zod_1.z.string(),
        fallback: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    confidence: zod_1.z.number().min(0).max(1),
    timestamp: zod_1.z.string().datetime(),
});
// Agent Switch Schema
exports.AgentSwitchedPayloadSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    fromAgent: zod_1.z.object({
        agentId: zod_1.z.string(),
        agentType: zod_1.z.string(),
        name: zod_1.z.string(),
    }),
    toAgent: zod_1.z.object({
        agentId: zod_1.z.string(),
        agentType: zod_1.z.string(),
        name: zod_1.z.string(),
    }),
    reason: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
});
// Collaboration Started Schema
exports.CollaborationStartedPayloadSchema = zod_1.z.object({
    collaborationId: zod_1.z.string(),
    participants: zod_1.z.array(zod_1.z.object({
        agentId: zod_1.z.string(),
        agentType: zod_1.z.string(),
        role: zod_1.z.enum(['primary', 'secondary', 'consultant']),
    })),
    context: zod_1.z.object({
        topic: zod_1.z.string(),
        sharedState: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    timestamp: zod_1.z.string().datetime(),
});
// Order Created Schema
exports.OrderCreatedPayloadSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    userId: zod_1.z.string(),
    merchantId: zod_1.z.string(),
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.string(),
        quantity: zod_1.z.number().int().positive(),
        price: zod_1.z.number().positive(),
        metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    })),
    totalAmount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3),
    paymentMethod: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string().datetime(),
});
// Order Completed Schema
exports.OrderCompletedPayloadSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    userId: zod_1.z.string(),
    merchantId: zod_1.z.string(),
    status: zod_1.z.enum(['completed', 'cancelled', 'refunded']),
    totalAmount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3),
    completedAt: zod_1.z.string().datetime(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// Payment Initiated Schema
exports.PaymentInitiatedPayloadSchema = zod_1.z.object({
    paymentId: zod_1.z.string(),
    orderId: zod_1.z.string(),
    userId: zod_1.z.string(),
    merchantId: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3),
    paymentMethod: zod_1.z.enum(['card', 'wallet', 'bank_transfer', 'upi']),
    gateway: zod_1.z.string(),
    status: zod_1.z.enum(['pending', 'processing', 'requires_action']),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string().datetime(),
});
// Payment Completed Schema
exports.PaymentCompletedPayloadSchema = zod_1.z.object({
    paymentId: zod_1.z.string(),
    orderId: zod_1.z.string(),
    userId: zod_1.z.string(),
    merchantId: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3),
    paymentMethod: zod_1.z.enum(['card', 'wallet', 'bank_transfer', 'upi']),
    gateway: zod_1.z.string(),
    gatewayTransactionId: zod_1.z.string(),
    status: zod_1.z.enum(['completed', 'failed', 'refunded', 'partially_refunded']),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string().datetime(),
});
// Service Health Changed Schema
exports.ServiceHealthChangedPayloadSchema = zod_1.z.object({
    serviceName: zod_1.z.string(),
    previousStatus: zod_1.z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
    currentStatus: zod_1.z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
    reason: zod_1.z.string().optional(),
    metrics: zod_1.z.object({
        latencyMs: zod_1.z.number().optional(),
        errorRate: zod_1.z.number().min(0).max(1).optional(),
        availability: zod_1.z.number().min(0).max(1).optional(),
    }).optional(),
    timestamp: zod_1.z.string().datetime(),
});
/**
 * Complete Event Schema
 */
exports.ReZEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventType: zod_1.z.enum([
        exports.EventType.USER_MESSAGE_RECEIVED,
        exports.EventType.USER_MESSAGE_SENT,
        exports.EventType.INTENT_DETECTED,
        exports.EventType.AGENT_SELECTED,
        exports.EventType.AGENT_SWITCHED,
        exports.EventType.COLLABORATION_STARTED,
        exports.EventType.ORDER_CREATED,
        exports.EventType.ORDER_COMPLETED,
        exports.EventType.PAYMENT_INITIATED,
        exports.EventType.PAYMENT_COMPLETED,
        exports.EventType.SERVICE_HEALTH_CHANGED,
    ]),
    payload: zod_1.z.unknown(), // Will be validated based on event type
    metadata: zod_1.z.object({
        source: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
        correlationId: zod_1.z.string().uuid().optional(),
        causationId: zod_1.z.string().uuid().optional(),
        replyTo: zod_1.z.string().optional(),
        priority: zod_1.z.enum(['high', 'normal', 'low']).default('normal'),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    version: zod_1.z.string().default('1.0'),
});
/**
 * Get payload schema for event type
 */
function getPayloadSchema(eventType) {
    const schemas = {
        [exports.EventType.USER_MESSAGE_RECEIVED]: exports.UserMessagePayloadSchema,
        [exports.EventType.USER_MESSAGE_SENT]: exports.UserMessagePayloadSchema,
        [exports.EventType.INTENT_DETECTED]: exports.IntentDetectedPayloadSchema,
        [exports.EventType.AGENT_SELECTED]: exports.AgentSelectedPayloadSchema,
        [exports.EventType.AGENT_SWITCHED]: exports.AgentSwitchedPayloadSchema,
        [exports.EventType.COLLABORATION_STARTED]: exports.CollaborationStartedPayloadSchema,
        [exports.EventType.ORDER_CREATED]: exports.OrderCreatedPayloadSchema,
        [exports.EventType.ORDER_COMPLETED]: exports.OrderCompletedPayloadSchema,
        [exports.EventType.PAYMENT_INITIATED]: exports.PaymentInitiatedPayloadSchema,
        [exports.EventType.PAYMENT_COMPLETED]: exports.PaymentCompletedPayloadSchema,
        [exports.EventType.SERVICE_HEALTH_CHANGED]: exports.ServiceHealthChangedPayloadSchema,
    };
    return schemas[eventType];
}
/**
 * Validate event payload against its schema
 */
function validateEventPayload(eventType, payload) {
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
function getValidEventTypes() {
    return Object.values(exports.EventType);
}
/**
 * Get event type info
 */
function getEventTypeInfo(eventType) {
    const info = {
        [exports.EventType.USER_MESSAGE_RECEIVED]: {
            category: exports.EventCategory.USER_INTERACTION,
            description: 'User sent a message to the system',
            priority: 'normal',
        },
        [exports.EventType.USER_MESSAGE_SENT]: {
            category: exports.EventCategory.USER_INTERACTION,
            description: 'System sent a message to the user',
            priority: 'normal',
        },
        [exports.EventType.INTENT_DETECTED]: {
            category: exports.EventCategory.INTENT_PROCESSING,
            description: 'User intent was detected and classified',
            priority: 'high',
        },
        [exports.EventType.AGENT_SELECTED]: {
            category: exports.EventCategory.AGENT_ORCHESTRATION,
            description: 'An agent was selected to handle the request',
            priority: 'high',
        },
        [exports.EventType.AGENT_SWITCHED]: {
            category: exports.EventCategory.AGENT_ORCHESTRATION,
            description: 'Request was transferred to a different agent',
            priority: 'normal',
        },
        [exports.EventType.COLLABORATION_STARTED]: {
            category: exports.EventCategory.COLLABORATION,
            description: 'Multi-agent collaboration session started',
            priority: 'normal',
        },
        [exports.EventType.ORDER_CREATED]: {
            category: exports.EventCategory.BUSINESS_LOGIC,
            description: 'A new order was created',
            priority: 'high',
        },
        [exports.EventType.ORDER_COMPLETED]: {
            category: exports.EventCategory.BUSINESS_LOGIC,
            description: 'An order was completed, cancelled, or refunded',
            priority: 'high',
        },
        [exports.EventType.PAYMENT_INITIATED]: {
            category: exports.EventCategory.PAYMENT,
            description: 'A payment was initiated',
            priority: 'high',
        },
        [exports.EventType.PAYMENT_COMPLETED]: {
            category: exports.EventCategory.PAYMENT,
            description: 'A payment was completed or failed',
            priority: 'high',
        },
        [exports.EventType.SERVICE_HEALTH_CHANGED]: {
            category: exports.EventCategory.HEALTH,
            description: 'Service health status changed',
            priority: 'high',
        },
    };
    return info[eventType];
}
exports.default = exports.EventType;
//# sourceMappingURL=eventSchema.js.map
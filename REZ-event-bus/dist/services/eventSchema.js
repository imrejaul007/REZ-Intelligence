"use strict";
/**
 * Event Schema Service
 * Standardized event types for the REZ Agent OS v3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventValidationSchema = exports.EnrichedEventSchema = exports.GenericEventPayloadSchema = exports.ReZEventSchema = exports.ServiceHealthChangedPayloadSchema = exports.PaymentCompletedPayloadSchema = exports.PaymentInitiatedPayloadSchema = exports.OrderCompletedPayloadSchema = exports.OrderCreatedPayloadSchema = exports.CollaborationStartedPayloadSchema = exports.AgentSwitchedPayloadSchema = exports.AgentSelectedPayloadSchema = exports.IntentDetectedPayloadSchema = exports.UserMessagePayloadSchema = exports.EventTypeToCategory = exports.EventCategory = exports.ALL_EVENT_TYPES = exports.EventType = exports.AttributionSource = exports.ChannelType = void 0;
exports.validateEvent = validateEvent;
exports.getPayloadSchema = getPayloadSchema;
exports.validateEventPayload = validateEventPayload;
exports.getValidEventTypes = getValidEventTypes;
exports.getEventTypeInfo = getEventTypeInfo;
const zod_1 = require("zod");
/**
 * Channel Types for Event Attribution
 */
exports.ChannelType = {
    WHATSAPP: 'whatsapp',
    SMS: 'sms',
    PUSH: 'push',
    EMAIL: 'email',
    IN_APP: 'in_app',
    QR_SCAN: 'qr_scan',
    DEEP_LINK: 'deep_link',
};
/**
 * Attribution Sources for Event Tracking
 */
exports.AttributionSource = {
    ORGANIC: 'organic',
    PAID_AD: 'paid_ad',
    INFLUENCER: 'influencer',
    REFERRAL: 'referral',
    QR_CODE: 'qr_code',
    LOCATION: 'location',
    NOTIFICATION: 'notification',
    EMAIL_CAMPAIGN: 'email_campaign',
    SOCIAL_MEDIA: 'social_media',
    SEARCH: 'search',
};
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
    // Offer Events
    OFFER_SHARED: 'offer.shared',
    OFFER_OPENED: 'offer.opened',
    // Referral Events
    REFERRAL_CLICKED: 'referral.clicked',
    REFERRAL_SIGNED_UP: 'referral.signed_up',
    REFERRAL_PURCHASED: 'referral.purchased',
    // Location Events
    LOCATION_VISITED: 'location.visited',
    LOCATION_DWELL: 'location.dwell',
    // Search Events
    SEARCH_PERFORMED: 'search.performed',
    // Wishlist Events
    WISHLIST_ADDED: 'wishlist.added',
    WISHLIST_REMOVED: 'wishlist.removed',
    // Price Alert Events
    PRICE_ALERT_SET: 'price.alert_set',
    PRICE_ALERT_TRIGGERED: 'price.alert_triggered',
    // Review Events
    REVIEW_SUBMITTED: 'review.submitted',
    REVIEW_VIEWED: 'review.viewed',
    // Profile Events
    PROFILE_UPDATED: 'profile.updated',
    // Feedback Events
    FEEDBACK_GIVEN: 'feedback.given',
    // Subscription Events
    SUBSCRIPTION_STARTED: 'subscription.started',
    SUBSCRIPTION_RENEWED: 'subscription.renewed',
    SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
    // Membership Events
    MEMBERSHIP_UPGRADED: 'membership.upgraded',
    MEMBERSHIP_DOWNGRADED: 'membership.downgraded',
    // Loyalty Events
    LOYALTY_REDEEMED: 'loyalty.redeemed',
    LOYALTY_EARNED: 'loyalty.earned',
    // Competitor Events
    COMPETITOR_VISITED: 'competitor.visited',
    COMPETITOR_SWITCHED: 'competitor.switched',
    // App Events
    APP_INSTALLED: 'app.installed',
    APP_OPENED: 'app.opened',
    // Content Events
    CONTENT_VIEWED: 'content.viewed',
    CONTENT_SHARED: 'content.shared',
    // Campaign Events
    CAMPAIGN_STARTED: 'campaign.started',
    CAMPAIGN_COMPLETED: 'campaign.completed',
    // Survey Events
    SURVEY_STARTED: 'survey.started',
    SURVEY_COMPLETED: 'survey.completed',
};
/**
 * All valid event types as a string array (for validation)
 */
exports.ALL_EVENT_TYPES = Object.values(exports.EventType);
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
    MARKETING: 'MARKETING',
    LOYALTY: 'LOYALTY',
    REFERRAL: 'REFERRAL',
    ENGAGEMENT: 'ENGAGEMENT',
};
/**
 * Map event types to categories
 */
exports.EventTypeToCategory = {
    // Existing mappings
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
    // Offer Events
    [exports.EventType.OFFER_SHARED]: exports.EventCategory.MARKETING,
    [exports.EventType.OFFER_OPENED]: exports.EventCategory.MARKETING,
    // Referral Events
    [exports.EventType.REFERRAL_CLICKED]: exports.EventCategory.REFERRAL,
    [exports.EventType.REFERRAL_SIGNED_UP]: exports.EventCategory.REFERRAL,
    [exports.EventType.REFERRAL_PURCHASED]: exports.EventCategory.REFERRAL,
    // Location Events
    [exports.EventType.LOCATION_VISITED]: exports.EventCategory.ENGAGEMENT,
    [exports.EventType.LOCATION_DWELL]: exports.EventCategory.ENGAGEMENT,
    // Search Events
    [exports.EventType.SEARCH_PERFORMED]: exports.EventCategory.ENGAGEMENT,
    // Wishlist Events
    [exports.EventType.WISHLIST_ADDED]: exports.EventCategory.ENGAGEMENT,
    [exports.EventType.WISHLIST_REMOVED]: exports.EventCategory.ENGAGEMENT,
    // Price Alert Events
    [exports.EventType.PRICE_ALERT_SET]: exports.EventCategory.ENGAGEMENT,
    [exports.EventType.PRICE_ALERT_TRIGGERED]: exports.EventCategory.ENGAGEMENT,
    // Review Events
    [exports.EventType.REVIEW_SUBMITTED]: exports.EventCategory.ENGAGEMENT,
    [exports.EventType.REVIEW_VIEWED]: exports.EventCategory.ENGAGEMENT,
    // Profile Events
    [exports.EventType.PROFILE_UPDATED]: exports.EventCategory.USER_INTERACTION,
    // Feedback Events
    [exports.EventType.FEEDBACK_GIVEN]: exports.EventCategory.ENGAGEMENT,
    // Subscription Events
    [exports.EventType.SUBSCRIPTION_STARTED]: exports.EventCategory.BUSINESS_LOGIC,
    [exports.EventType.SUBSCRIPTION_RENEWED]: exports.EventCategory.BUSINESS_LOGIC,
    [exports.EventType.SUBSCRIPTION_CANCELLED]: exports.EventCategory.BUSINESS_LOGIC,
    // Membership Events
    [exports.EventType.MEMBERSHIP_UPGRADED]: exports.EventCategory.LOYALTY,
    [exports.EventType.MEMBERSHIP_DOWNGRADED]: exports.EventCategory.LOYALTY,
    // Loyalty Events
    [exports.EventType.LOYALTY_REDEEMED]: exports.EventCategory.LOYALTY,
    [exports.EventType.LOYALTY_EARNED]: exports.EventCategory.LOYALTY,
    // Competitor Events
    [exports.EventType.COMPETITOR_VISITED]: exports.EventCategory.ENGAGEMENT,
    [exports.EventType.COMPETITOR_SWITCHED]: exports.EventCategory.ENGAGEMENT,
    // App Events
    [exports.EventType.APP_INSTALLED]: exports.EventCategory.USER_INTERACTION,
    [exports.EventType.APP_OPENED]: exports.EventCategory.USER_INTERACTION,
    // Content Events
    [exports.EventType.CONTENT_VIEWED]: exports.EventCategory.ENGAGEMENT,
    [exports.EventType.CONTENT_SHARED]: exports.EventCategory.MARKETING,
    // Campaign Events
    [exports.EventType.CAMPAIGN_STARTED]: exports.EventCategory.MARKETING,
    [exports.EventType.CAMPAIGN_COMPLETED]: exports.EventCategory.MARKETING,
    // Survey Events
    [exports.EventType.SURVEY_STARTED]: exports.EventCategory.ENGAGEMENT,
    [exports.EventType.SURVEY_COMPLETED]: exports.EventCategory.ENGAGEMENT,
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
        // New event types
        exports.EventType.OFFER_SHARED,
        exports.EventType.OFFER_OPENED,
        exports.EventType.REFERRAL_CLICKED,
        exports.EventType.REFERRAL_SIGNED_UP,
        exports.EventType.REFERRAL_PURCHASED,
        exports.EventType.LOCATION_VISITED,
        exports.EventType.LOCATION_DWELL,
        exports.EventType.SEARCH_PERFORMED,
        exports.EventType.WISHLIST_ADDED,
        exports.EventType.WISHLIST_REMOVED,
        exports.EventType.PRICE_ALERT_SET,
        exports.EventType.PRICE_ALERT_TRIGGERED,
        exports.EventType.REVIEW_SUBMITTED,
        exports.EventType.REVIEW_VIEWED,
        exports.EventType.PROFILE_UPDATED,
        exports.EventType.FEEDBACK_GIVEN,
        exports.EventType.SUBSCRIPTION_STARTED,
        exports.EventType.SUBSCRIPTION_RENEWED,
        exports.EventType.SUBSCRIPTION_CANCELLED,
        exports.EventType.MEMBERSHIP_UPGRADED,
        exports.EventType.MEMBERSHIP_DOWNGRADED,
        exports.EventType.LOYALTY_REDEEMED,
        exports.EventType.LOYALTY_EARNED,
        exports.EventType.COMPETITOR_VISITED,
        exports.EventType.COMPETITOR_SWITCHED,
        exports.EventType.APP_INSTALLED,
        exports.EventType.APP_OPENED,
        exports.EventType.CONTENT_VIEWED,
        exports.EventType.CONTENT_SHARED,
        exports.EventType.CAMPAIGN_STARTED,
        exports.EventType.CAMPAIGN_COMPLETED,
        exports.EventType.SURVEY_STARTED,
        exports.EventType.SURVEY_COMPLETED,
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
 * Generic Event Payload Schema for new event types
 */
exports.GenericEventPayloadSchema = zod_1.z.object({
    userId: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    deviceId: zod_1.z.string().optional(),
    locationId: zod_1.z.string().optional(),
    data: zod_1.z.record(zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string().datetime().optional(),
});
/**
 * Enriched Event Schema for validation
 */
exports.EnrichedEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string().min(1),
    channel: zod_1.z.enum(Object.values(exports.ChannelType)).optional(),
    attributionSource: zod_1.z.enum(Object.values(exports.AttributionSource)).optional(),
    userId: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    deviceId: zod_1.z.string().optional(),
    locationId: zod_1.z.string().optional(),
    data: zod_1.z.record(zod_1.z.unknown()),
    timestamp: zod_1.z.string().datetime(),
    metadata: zod_1.z.object({
        ip: zod_1.z.string().optional(),
        userAgent: zod_1.z.string().optional(),
        referrer: zod_1.z.string().optional(),
        utm: zod_1.z.record(zod_1.z.string()).optional(),
    }),
});
/**
 * Event Validation Schema (for incoming events)
 */
exports.eventValidationSchema = zod_1.z.object({
    type: zod_1.z.string().min(1),
    channel: zod_1.z.enum(Object.values(exports.ChannelType)).optional(),
    attributionSource: zod_1.z.enum(Object.values(exports.AttributionSource)).optional(),
    userId: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().optional(),
    data: zod_1.z.record(zod_1.z.unknown()),
    timestamp: zod_1.z.string().datetime().optional(),
    metadata: zod_1.z.object({
        ip: zod_1.z.string().optional(),
        userAgent: zod_1.z.string().optional(),
        referrer: zod_1.z.string().optional(),
        utm: zod_1.z.record(zod_1.z.string()).optional(),
    }).optional(),
});
/**
 * Validate an event against the event validation schema
 */
function validateEvent(event) {
    const result = exports.eventValidationSchema.safeParse(event);
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
        // New event types use generic schema
        [exports.EventType.OFFER_SHARED]: exports.GenericEventPayloadSchema,
        [exports.EventType.OFFER_OPENED]: exports.GenericEventPayloadSchema,
        [exports.EventType.REFERRAL_CLICKED]: exports.GenericEventPayloadSchema,
        [exports.EventType.REFERRAL_SIGNED_UP]: exports.GenericEventPayloadSchema,
        [exports.EventType.REFERRAL_PURCHASED]: exports.GenericEventPayloadSchema,
        [exports.EventType.LOCATION_VISITED]: exports.GenericEventPayloadSchema,
        [exports.EventType.LOCATION_DWELL]: exports.GenericEventPayloadSchema,
        [exports.EventType.SEARCH_PERFORMED]: exports.GenericEventPayloadSchema,
        [exports.EventType.WISHLIST_ADDED]: exports.GenericEventPayloadSchema,
        [exports.EventType.WISHLIST_REMOVED]: exports.GenericEventPayloadSchema,
        [exports.EventType.PRICE_ALERT_SET]: exports.GenericEventPayloadSchema,
        [exports.EventType.PRICE_ALERT_TRIGGERED]: exports.GenericEventPayloadSchema,
        [exports.EventType.REVIEW_SUBMITTED]: exports.GenericEventPayloadSchema,
        [exports.EventType.REVIEW_VIEWED]: exports.GenericEventPayloadSchema,
        [exports.EventType.PROFILE_UPDATED]: exports.GenericEventPayloadSchema,
        [exports.EventType.FEEDBACK_GIVEN]: exports.GenericEventPayloadSchema,
        [exports.EventType.SUBSCRIPTION_STARTED]: exports.GenericEventPayloadSchema,
        [exports.EventType.SUBSCRIPTION_RENEWED]: exports.GenericEventPayloadSchema,
        [exports.EventType.SUBSCRIPTION_CANCELLED]: exports.GenericEventPayloadSchema,
        [exports.EventType.MEMBERSHIP_UPGRADED]: exports.GenericEventPayloadSchema,
        [exports.EventType.MEMBERSHIP_DOWNGRADED]: exports.GenericEventPayloadSchema,
        [exports.EventType.LOYALTY_REDEEMED]: exports.GenericEventPayloadSchema,
        [exports.EventType.LOYALTY_EARNED]: exports.GenericEventPayloadSchema,
        [exports.EventType.COMPETITOR_VISITED]: exports.GenericEventPayloadSchema,
        [exports.EventType.COMPETITOR_SWITCHED]: exports.GenericEventPayloadSchema,
        [exports.EventType.APP_INSTALLED]: exports.GenericEventPayloadSchema,
        [exports.EventType.APP_OPENED]: exports.GenericEventPayloadSchema,
        [exports.EventType.CONTENT_VIEWED]: exports.GenericEventPayloadSchema,
        [exports.EventType.CONTENT_SHARED]: exports.GenericEventPayloadSchema,
        [exports.EventType.CAMPAIGN_STARTED]: exports.GenericEventPayloadSchema,
        [exports.EventType.CAMPAIGN_COMPLETED]: exports.GenericEventPayloadSchema,
        [exports.EventType.SURVEY_STARTED]: exports.GenericEventPayloadSchema,
        [exports.EventType.SURVEY_COMPLETED]: exports.GenericEventPayloadSchema,
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
        // New event types
        [exports.EventType.OFFER_SHARED]: {
            category: exports.EventCategory.MARKETING,
            description: 'User shared an offer with others',
            priority: 'normal',
        },
        [exports.EventType.OFFER_OPENED]: {
            category: exports.EventCategory.MARKETING,
            description: 'User opened a shared offer',
            priority: 'normal',
        },
        [exports.EventType.REFERRAL_CLICKED]: {
            category: exports.EventCategory.REFERRAL,
            description: 'User clicked on a referral link',
            priority: 'normal',
        },
        [exports.EventType.REFERRAL_SIGNED_UP]: {
            category: exports.EventCategory.REFERRAL,
            description: 'Referred user completed signup',
            priority: 'high',
        },
        [exports.EventType.REFERRAL_PURCHASED]: {
            category: exports.EventCategory.REFERRAL,
            description: 'Referred user made a purchase',
            priority: 'high',
        },
        [exports.EventType.LOCATION_VISITED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User visited a physical location',
            priority: 'normal',
        },
        [exports.EventType.LOCATION_DWELL]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User dwelled at a location for extended time',
            priority: 'normal',
        },
        [exports.EventType.SEARCH_PERFORMED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User performed a search query',
            priority: 'normal',
        },
        [exports.EventType.WISHLIST_ADDED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User added item to wishlist',
            priority: 'normal',
        },
        [exports.EventType.WISHLIST_REMOVED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User removed item from wishlist',
            priority: 'normal',
        },
        [exports.EventType.PRICE_ALERT_SET]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User set a price alert for an item',
            priority: 'normal',
        },
        [exports.EventType.PRICE_ALERT_TRIGGERED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'Price alert was triggered',
            priority: 'high',
        },
        [exports.EventType.REVIEW_SUBMITTED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User submitted a review',
            priority: 'normal',
        },
        [exports.EventType.REVIEW_VIEWED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User viewed a review',
            priority: 'low',
        },
        [exports.EventType.PROFILE_UPDATED]: {
            category: exports.EventCategory.USER_INTERACTION,
            description: 'User updated their profile',
            priority: 'normal',
        },
        [exports.EventType.FEEDBACK_GIVEN]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User submitted feedback',
            priority: 'normal',
        },
        [exports.EventType.SUBSCRIPTION_STARTED]: {
            category: exports.EventCategory.BUSINESS_LOGIC,
            description: 'User started a subscription',
            priority: 'high',
        },
        [exports.EventType.SUBSCRIPTION_RENEWED]: {
            category: exports.EventCategory.BUSINESS_LOGIC,
            description: 'Subscription was renewed',
            priority: 'high',
        },
        [exports.EventType.SUBSCRIPTION_CANCELLED]: {
            category: exports.EventCategory.BUSINESS_LOGIC,
            description: 'Subscription was cancelled',
            priority: 'high',
        },
        [exports.EventType.MEMBERSHIP_UPGRADED]: {
            category: exports.EventCategory.LOYALTY,
            description: 'User upgraded their membership tier',
            priority: 'high',
        },
        [exports.EventType.MEMBERSHIP_DOWNGRADED]: {
            category: exports.EventCategory.LOYALTY,
            description: 'User downgraded their membership tier',
            priority: 'normal',
        },
        [exports.EventType.LOYALTY_REDEEMED]: {
            category: exports.EventCategory.LOYALTY,
            description: 'User redeemed loyalty points',
            priority: 'normal',
        },
        [exports.EventType.LOYALTY_EARNED]: {
            category: exports.EventCategory.LOYALTY,
            description: 'User earned loyalty points',
            priority: 'normal',
        },
        [exports.EventType.COMPETITOR_VISITED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User visited a competitor location',
            priority: 'normal',
        },
        [exports.EventType.COMPETITOR_SWITCHED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User switched to a competitor',
            priority: 'high',
        },
        [exports.EventType.APP_INSTALLED]: {
            category: exports.EventCategory.USER_INTERACTION,
            description: 'User installed the app',
            priority: 'high',
        },
        [exports.EventType.APP_OPENED]: {
            category: exports.EventCategory.USER_INTERACTION,
            description: 'User opened the app',
            priority: 'low',
        },
        [exports.EventType.CONTENT_VIEWED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User viewed content',
            priority: 'low',
        },
        [exports.EventType.CONTENT_SHARED]: {
            category: exports.EventCategory.MARKETING,
            description: 'User shared content',
            priority: 'normal',
        },
        [exports.EventType.CAMPAIGN_STARTED]: {
            category: exports.EventCategory.MARKETING,
            description: 'User joined a campaign',
            priority: 'normal',
        },
        [exports.EventType.CAMPAIGN_COMPLETED]: {
            category: exports.EventCategory.MARKETING,
            description: 'User completed a campaign',
            priority: 'normal',
        },
        [exports.EventType.SURVEY_STARTED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User started a survey',
            priority: 'normal',
        },
        [exports.EventType.SURVEY_COMPLETED]: {
            category: exports.EventCategory.ENGAGEMENT,
            description: 'User completed a survey',
            priority: 'normal',
        },
    };
    return info[eventType];
}
exports.default = exports.EventType;
//# sourceMappingURL=eventSchema.js.map
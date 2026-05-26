/**
 * Event Schema Service
 * Standardized event types for the REZ Agent OS v3
 */
import { z } from 'zod';
/**
 * Channel Types for Event Attribution
 */
export declare const ChannelType: {
    readonly WHATSAPP: "whatsapp";
    readonly SMS: "sms";
    readonly PUSH: "push";
    readonly EMAIL: "email";
    readonly IN_APP: "in_app";
    readonly QR_SCAN: "qr_scan";
    readonly DEEP_LINK: "deep_link";
};
export type ChannelTypeValue = typeof ChannelType[keyof typeof ChannelType];
/**
 * Attribution Sources for Event Tracking
 */
export declare const AttributionSource: {
    readonly ORGANIC: "organic";
    readonly PAID_AD: "paid_ad";
    readonly INFLUENCER: "influencer";
    readonly REFERRAL: "referral";
    readonly QR_CODE: "qr_code";
    readonly LOCATION: "location";
    readonly NOTIFICATION: "notification";
    readonly EMAIL_CAMPAIGN: "email_campaign";
    readonly SOCIAL_MEDIA: "social_media";
    readonly SEARCH: "search";
};
export type AttributionSourceValue = typeof AttributionSource[keyof typeof AttributionSource];
/**
 * Standardized Event Types for REZ Agent OS v3
 * All services should use these event types for consistency
 */
export declare const EventType: {
    readonly USER_MESSAGE_RECEIVED: "USER_MESSAGE_RECEIVED";
    readonly USER_MESSAGE_SENT: "USER_MESSAGE_SENT";
    readonly INTENT_DETECTED: "INTENT_DETECTED";
    readonly AGENT_SELECTED: "AGENT_SELECTED";
    readonly AGENT_SWITCHED: "AGENT_SWITCHED";
    readonly COLLABORATION_STARTED: "COLLABORATION_STARTED";
    readonly ORDER_CREATED: "ORDER_CREATED";
    readonly ORDER_COMPLETED: "ORDER_COMPLETED";
    readonly PAYMENT_INITIATED: "PAYMENT_INITIATED";
    readonly PAYMENT_COMPLETED: "PAYMENT_COMPLETED";
    readonly SERVICE_HEALTH_CHANGED: "SERVICE_HEALTH_CHANGED";
    readonly OFFER_SHARED: "offer.shared";
    readonly OFFER_OPENED: "offer.opened";
    readonly REFERRAL_CLICKED: "referral.clicked";
    readonly REFERRAL_SIGNED_UP: "referral.signed_up";
    readonly REFERRAL_PURCHASED: "referral.purchased";
    readonly LOCATION_VISITED: "location.visited";
    readonly LOCATION_DWELL: "location.dwell";
    readonly SEARCH_PERFORMED: "search.performed";
    readonly WISHLIST_ADDED: "wishlist.added";
    readonly WISHLIST_REMOVED: "wishlist.removed";
    readonly PRICE_ALERT_SET: "price.alert_set";
    readonly PRICE_ALERT_TRIGGERED: "price.alert_triggered";
    readonly REVIEW_SUBMITTED: "review.submitted";
    readonly REVIEW_VIEWED: "review.viewed";
    readonly PROFILE_UPDATED: "profile.updated";
    readonly FEEDBACK_GIVEN: "feedback.given";
    readonly SUBSCRIPTION_STARTED: "subscription.started";
    readonly SUBSCRIPTION_RENEWED: "subscription.renewed";
    readonly SUBSCRIPTION_CANCELLED: "subscription.cancelled";
    readonly MEMBERSHIP_UPGRADED: "membership.upgraded";
    readonly MEMBERSHIP_DOWNGRADED: "membership.downgraded";
    readonly LOYALTY_REDEEMED: "loyalty.redeemed";
    readonly LOYALTY_EARNED: "loyalty.earned";
    readonly COMPETITOR_VISITED: "competitor.visited";
    readonly COMPETITOR_SWITCHED: "competitor.switched";
    readonly APP_INSTALLED: "app.installed";
    readonly APP_OPENED: "app.opened";
    readonly CONTENT_VIEWED: "content.viewed";
    readonly CONTENT_SHARED: "content.shared";
    readonly CAMPAIGN_STARTED: "campaign.started";
    readonly CAMPAIGN_COMPLETED: "campaign.completed";
    readonly SURVEY_STARTED: "survey.started";
    readonly SURVEY_COMPLETED: "survey.completed";
};
export type EventTypeValue = typeof EventType[keyof typeof EventType];
/**
 * All valid event types as a string array (for validation)
 */
export declare const ALL_EVENT_TYPES: string[];
/**
 * Event Type Categories
 */
export declare const EventCategory: {
    readonly USER_INTERACTION: "USER_INTERACTION";
    readonly INTENT_PROCESSING: "INTENT_PROCESSING";
    readonly AGENT_ORCHESTRATION: "AGENT_ORCHESTRATION";
    readonly COLLABORATION: "COLLABORATION";
    readonly BUSINESS_LOGIC: "BUSINESS_LOGIC";
    readonly PAYMENT: "PAYMENT";
    readonly HEALTH: "HEALTH";
    readonly MARKETING: "MARKETING";
    readonly LOYALTY: "LOYALTY";
    readonly REFERRAL: "REFERRAL";
    readonly ENGAGEMENT: "ENGAGEMENT";
};
export type EventCategoryValue = typeof EventCategory[keyof typeof EventCategory];
/**
 * Map event types to categories
 */
export declare const EventTypeToCategory: Record<EventTypeValue, EventCategoryValue>;
/**
 * Event Payload Schemas
 */
export declare const UserMessagePayloadSchema: z.ZodObject<{
    messageId: z.ZodString;
    userId: z.ZodString;
    content: z.ZodString;
    channel: z.ZodString;
    timestamp: z.ZodString;
    metadata: z.ZodOptional<z.ZodObject<{
        intent: z.ZodOptional<z.ZodString>;
        sentiment: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        intent?: string | undefined;
        sentiment?: string | undefined;
        language?: string | undefined;
    }, {
        intent?: string | undefined;
        sentiment?: string | undefined;
        language?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    messageId: string;
    userId: string;
    content: string;
    channel: string;
    metadata?: {
        intent?: string | undefined;
        sentiment?: string | undefined;
        language?: string | undefined;
    } | undefined;
}, {
    timestamp: string;
    messageId: string;
    userId: string;
    content: string;
    channel: string;
    metadata?: {
        intent?: string | undefined;
        sentiment?: string | undefined;
        language?: string | undefined;
    } | undefined;
}>;
export declare const IntentDetectedPayloadSchema: z.ZodObject<{
    userId: z.ZodString;
    messageId: z.ZodString;
    intent: z.ZodObject<{
        name: z.ZodString;
        confidence: z.ZodNumber;
        entities: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        confidence: number;
        entities?: Record<string, unknown> | undefined;
    }, {
        name: string;
        confidence: number;
        entities?: Record<string, unknown> | undefined;
    }>;
    context: z.ZodObject<{
        previousIntents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sessionId: z.ZodString;
        userProfile: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        sessionId: string;
        previousIntents?: string[] | undefined;
        userProfile?: Record<string, unknown> | undefined;
    }, {
        sessionId: string;
        previousIntents?: string[] | undefined;
        userProfile?: Record<string, unknown> | undefined;
    }>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    messageId: string;
    userId: string;
    intent: {
        name: string;
        confidence: number;
        entities?: Record<string, unknown> | undefined;
    };
    context: {
        sessionId: string;
        previousIntents?: string[] | undefined;
        userProfile?: Record<string, unknown> | undefined;
    };
}, {
    timestamp: string;
    messageId: string;
    userId: string;
    intent: {
        name: string;
        confidence: number;
        entities?: Record<string, unknown> | undefined;
    };
    context: {
        sessionId: string;
        previousIntents?: string[] | undefined;
        userProfile?: Record<string, unknown> | undefined;
    };
}>;
export declare const AgentSelectedPayloadSchema: z.ZodObject<{
    userId: z.ZodString;
    sessionId: z.ZodString;
    selectedAgent: z.ZodObject<{
        agentId: z.ZodString;
        agentType: z.ZodString;
        name: z.ZodString;
        capabilities: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        agentId: string;
        agentType: string;
        capabilities: string[];
    }, {
        name: string;
        agentId: string;
        agentType: string;
        capabilities: string[];
    }>;
    selectionCriteria: z.ZodObject<{
        primary: z.ZodString;
        fallback: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        primary: string;
        fallback?: string[] | undefined;
    }, {
        primary: string;
        fallback?: string[] | undefined;
    }>;
    confidence: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    userId: string;
    confidence: number;
    sessionId: string;
    selectedAgent: {
        name: string;
        agentId: string;
        agentType: string;
        capabilities: string[];
    };
    selectionCriteria: {
        primary: string;
        fallback?: string[] | undefined;
    };
}, {
    timestamp: string;
    userId: string;
    confidence: number;
    sessionId: string;
    selectedAgent: {
        name: string;
        agentId: string;
        agentType: string;
        capabilities: string[];
    };
    selectionCriteria: {
        primary: string;
        fallback?: string[] | undefined;
    };
}>;
export declare const AgentSwitchedPayloadSchema: z.ZodObject<{
    userId: z.ZodString;
    sessionId: z.ZodString;
    fromAgent: z.ZodObject<{
        agentId: z.ZodString;
        agentType: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        agentId: string;
        agentType: string;
    }, {
        name: string;
        agentId: string;
        agentType: string;
    }>;
    toAgent: z.ZodObject<{
        agentId: z.ZodString;
        agentType: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        agentId: string;
        agentType: string;
    }, {
        name: string;
        agentId: string;
        agentType: string;
    }>;
    reason: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    userId: string;
    sessionId: string;
    fromAgent: {
        name: string;
        agentId: string;
        agentType: string;
    };
    toAgent: {
        name: string;
        agentId: string;
        agentType: string;
    };
    reason: string;
}, {
    timestamp: string;
    userId: string;
    sessionId: string;
    fromAgent: {
        name: string;
        agentId: string;
        agentType: string;
    };
    toAgent: {
        name: string;
        agentId: string;
        agentType: string;
    };
    reason: string;
}>;
export declare const CollaborationStartedPayloadSchema: z.ZodObject<{
    collaborationId: z.ZodString;
    participants: z.ZodArray<z.ZodObject<{
        agentId: z.ZodString;
        agentType: z.ZodString;
        role: z.ZodEnum<["primary", "secondary", "consultant"]>;
    }, "strip", z.ZodTypeAny, {
        agentId: string;
        agentType: string;
        role: "primary" | "secondary" | "consultant";
    }, {
        agentId: string;
        agentType: string;
        role: "primary" | "secondary" | "consultant";
    }>, "many">;
    context: z.ZodObject<{
        topic: z.ZodString;
        sharedState: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        topic: string;
        sharedState?: Record<string, unknown> | undefined;
    }, {
        topic: string;
        sharedState?: Record<string, unknown> | undefined;
    }>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    context: {
        topic: string;
        sharedState?: Record<string, unknown> | undefined;
    };
    collaborationId: string;
    participants: {
        agentId: string;
        agentType: string;
        role: "primary" | "secondary" | "consultant";
    }[];
}, {
    timestamp: string;
    context: {
        topic: string;
        sharedState?: Record<string, unknown> | undefined;
    };
    collaborationId: string;
    participants: {
        agentId: string;
        agentType: string;
        role: "primary" | "secondary" | "consultant";
    }[];
}>;
export declare const OrderCreatedPayloadSchema: z.ZodObject<{
    orderId: z.ZodString;
    userId: z.ZodString;
    merchantId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        price: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
    }, {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">;
    totalAmount: z.ZodNumber;
    currency: z.ZodString;
    paymentMethod: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    userId: string;
    orderId: string;
    merchantId: string;
    items: {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
    }[];
    totalAmount: number;
    currency: string;
    metadata?: Record<string, unknown> | undefined;
    paymentMethod?: string | undefined;
}, {
    timestamp: string;
    userId: string;
    orderId: string;
    merchantId: string;
    items: {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
    }[];
    totalAmount: number;
    currency: string;
    metadata?: Record<string, unknown> | undefined;
    paymentMethod?: string | undefined;
}>;
export declare const OrderCompletedPayloadSchema: z.ZodObject<{
    orderId: z.ZodString;
    userId: z.ZodString;
    merchantId: z.ZodString;
    status: z.ZodEnum<["completed", "cancelled", "refunded"]>;
    totalAmount: z.ZodNumber;
    currency: z.ZodString;
    completedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    status: "completed" | "cancelled" | "refunded";
    orderId: string;
    merchantId: string;
    totalAmount: number;
    currency: string;
    completedAt: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    userId: string;
    status: "completed" | "cancelled" | "refunded";
    orderId: string;
    merchantId: string;
    totalAmount: number;
    currency: string;
    completedAt: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const PaymentInitiatedPayloadSchema: z.ZodObject<{
    paymentId: z.ZodString;
    orderId: z.ZodString;
    userId: z.ZodString;
    merchantId: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodString;
    paymentMethod: z.ZodEnum<["card", "wallet", "bank_transfer", "upi"]>;
    gateway: z.ZodString;
    status: z.ZodEnum<["pending", "processing", "requires_action"]>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    userId: string;
    status: "pending" | "processing" | "requires_action";
    orderId: string;
    merchantId: string;
    currency: string;
    paymentMethod: "card" | "wallet" | "bank_transfer" | "upi";
    paymentId: string;
    amount: number;
    gateway: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    timestamp: string;
    userId: string;
    status: "pending" | "processing" | "requires_action";
    orderId: string;
    merchantId: string;
    currency: string;
    paymentMethod: "card" | "wallet" | "bank_transfer" | "upi";
    paymentId: string;
    amount: number;
    gateway: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const PaymentCompletedPayloadSchema: z.ZodObject<{
    paymentId: z.ZodString;
    orderId: z.ZodString;
    userId: z.ZodString;
    merchantId: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodString;
    paymentMethod: z.ZodEnum<["card", "wallet", "bank_transfer", "upi"]>;
    gateway: z.ZodString;
    gatewayTransactionId: z.ZodString;
    status: z.ZodEnum<["completed", "failed", "refunded", "partially_refunded"]>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    userId: string;
    status: "completed" | "refunded" | "failed" | "partially_refunded";
    orderId: string;
    merchantId: string;
    currency: string;
    paymentMethod: "card" | "wallet" | "bank_transfer" | "upi";
    paymentId: string;
    amount: number;
    gateway: string;
    gatewayTransactionId: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    timestamp: string;
    userId: string;
    status: "completed" | "refunded" | "failed" | "partially_refunded";
    orderId: string;
    merchantId: string;
    currency: string;
    paymentMethod: "card" | "wallet" | "bank_transfer" | "upi";
    paymentId: string;
    amount: number;
    gateway: string;
    gatewayTransactionId: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const ServiceHealthChangedPayloadSchema: z.ZodObject<{
    serviceName: z.ZodString;
    previousStatus: z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>;
    currentStatus: z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>;
    reason: z.ZodOptional<z.ZodString>;
    metrics: z.ZodOptional<z.ZodObject<{
        latencyMs: z.ZodOptional<z.ZodNumber>;
        errorRate: z.ZodOptional<z.ZodNumber>;
        availability: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        latencyMs?: number | undefined;
        errorRate?: number | undefined;
        availability?: number | undefined;
    }, {
        latencyMs?: number | undefined;
        errorRate?: number | undefined;
        availability?: number | undefined;
    }>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    serviceName: string;
    previousStatus: "unknown" | "healthy" | "degraded" | "unhealthy";
    currentStatus: "unknown" | "healthy" | "degraded" | "unhealthy";
    reason?: string | undefined;
    metrics?: {
        latencyMs?: number | undefined;
        errorRate?: number | undefined;
        availability?: number | undefined;
    } | undefined;
}, {
    timestamp: string;
    serviceName: string;
    previousStatus: "unknown" | "healthy" | "degraded" | "unhealthy";
    currentStatus: "unknown" | "healthy" | "degraded" | "unhealthy";
    reason?: string | undefined;
    metrics?: {
        latencyMs?: number | undefined;
        errorRate?: number | undefined;
        availability?: number | undefined;
    } | undefined;
}>;
/**
 * Complete Event Schema
 */
export declare const ReZEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodEnum<["USER_MESSAGE_RECEIVED", "USER_MESSAGE_SENT", "INTENT_DETECTED", "AGENT_SELECTED", "AGENT_SWITCHED", "COLLABORATION_STARTED", "ORDER_CREATED", "ORDER_COMPLETED", "PAYMENT_INITIATED", "PAYMENT_COMPLETED", "SERVICE_HEALTH_CHANGED", "offer.shared", "offer.opened", "referral.clicked", "referral.signed_up", "referral.purchased", "location.visited", "location.dwell", "search.performed", "wishlist.added", "wishlist.removed", "price.alert_set", "price.alert_triggered", "review.submitted", "review.viewed", "profile.updated", "feedback.given", "subscription.started", "subscription.renewed", "subscription.cancelled", "membership.upgraded", "membership.downgraded", "loyalty.redeemed", "loyalty.earned", "competitor.visited", "competitor.switched", "app.installed", "app.opened", "content.viewed", "content.shared", "campaign.started", "campaign.completed", "survey.started", "survey.completed"]>;
    payload: z.ZodUnknown;
    metadata: z.ZodObject<{
        source: z.ZodString;
        timestamp: z.ZodString;
        correlationId: z.ZodOptional<z.ZodString>;
        causationId: z.ZodOptional<z.ZodString>;
        replyTo: z.ZodOptional<z.ZodString>;
        priority: z.ZodDefault<z.ZodEnum<["high", "normal", "low"]>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        source: string;
        priority: "high" | "normal" | "low";
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        tags?: string[] | undefined;
    }, {
        timestamp: string;
        source: string;
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        priority?: "high" | "normal" | "low" | undefined;
        tags?: string[] | undefined;
    }>;
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        timestamp: string;
        source: string;
        priority: "high" | "normal" | "low";
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        tags?: string[] | undefined;
    };
    eventId: string;
    eventType: "USER_MESSAGE_RECEIVED" | "USER_MESSAGE_SENT" | "INTENT_DETECTED" | "AGENT_SELECTED" | "AGENT_SWITCHED" | "COLLABORATION_STARTED" | "ORDER_CREATED" | "ORDER_COMPLETED" | "PAYMENT_INITIATED" | "PAYMENT_COMPLETED" | "SERVICE_HEALTH_CHANGED" | "offer.shared" | "offer.opened" | "referral.clicked" | "referral.signed_up" | "referral.purchased" | "location.visited" | "location.dwell" | "search.performed" | "wishlist.added" | "wishlist.removed" | "price.alert_set" | "price.alert_triggered" | "review.submitted" | "review.viewed" | "profile.updated" | "feedback.given" | "subscription.started" | "subscription.renewed" | "subscription.cancelled" | "membership.upgraded" | "membership.downgraded" | "loyalty.redeemed" | "loyalty.earned" | "competitor.visited" | "competitor.switched" | "app.installed" | "app.opened" | "content.viewed" | "content.shared" | "campaign.started" | "campaign.completed" | "survey.started" | "survey.completed";
    version: string;
    payload?: unknown;
}, {
    metadata: {
        timestamp: string;
        source: string;
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        priority?: "high" | "normal" | "low" | undefined;
        tags?: string[] | undefined;
    };
    eventId: string;
    eventType: "USER_MESSAGE_RECEIVED" | "USER_MESSAGE_SENT" | "INTENT_DETECTED" | "AGENT_SELECTED" | "AGENT_SWITCHED" | "COLLABORATION_STARTED" | "ORDER_CREATED" | "ORDER_COMPLETED" | "PAYMENT_INITIATED" | "PAYMENT_COMPLETED" | "SERVICE_HEALTH_CHANGED" | "offer.shared" | "offer.opened" | "referral.clicked" | "referral.signed_up" | "referral.purchased" | "location.visited" | "location.dwell" | "search.performed" | "wishlist.added" | "wishlist.removed" | "price.alert_set" | "price.alert_triggered" | "review.submitted" | "review.viewed" | "profile.updated" | "feedback.given" | "subscription.started" | "subscription.renewed" | "subscription.cancelled" | "membership.upgraded" | "membership.downgraded" | "loyalty.redeemed" | "loyalty.earned" | "competitor.visited" | "competitor.switched" | "app.installed" | "app.opened" | "content.viewed" | "content.shared" | "campaign.started" | "campaign.completed" | "survey.started" | "survey.completed";
    payload?: unknown;
    version?: string | undefined;
}>;
/**
 * Generic Event Payload Schema for new event types
 */
export declare const GenericEventPayloadSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    merchantId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
    locationId: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timestamp?: string | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
    merchantId?: string | undefined;
    deviceId?: string | undefined;
    locationId?: string | undefined;
    data?: Record<string, unknown> | undefined;
}, {
    timestamp?: string | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
    merchantId?: string | undefined;
    deviceId?: string | undefined;
    locationId?: string | undefined;
    data?: Record<string, unknown> | undefined;
}>;
/**
 * Enriched Event Interface
 */
export interface EnrichedEvent {
    id: string;
    type: string;
    channel?: ChannelTypeValue;
    attributionSource?: AttributionSourceValue;
    userId?: string;
    merchantId?: string;
    sessionId?: string;
    deviceId?: string;
    locationId?: string;
    data: Record<string, unknown>;
    timestamp: string;
    metadata: {
        ip?: string;
        userAgent?: string;
        referrer?: string;
        utm?: Record<string, string>;
    };
}
/**
 * Enriched Event Schema for validation
 */
export declare const EnrichedEventSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    channel: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    attributionSource: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    userId: z.ZodOptional<z.ZodString>;
    merchantId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
    locationId: z.ZodOptional<z.ZodString>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodString;
    metadata: z.ZodObject<{
        ip: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        referrer: z.ZodOptional<z.ZodString>;
        utm: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    }, {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    type: string;
    metadata: {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    };
    data: Record<string, unknown>;
    id: string;
    userId?: string | undefined;
    channel?: string | undefined;
    sessionId?: string | undefined;
    merchantId?: string | undefined;
    deviceId?: string | undefined;
    locationId?: string | undefined;
    attributionSource?: string | undefined;
}, {
    timestamp: string;
    type: string;
    metadata: {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    };
    data: Record<string, unknown>;
    id: string;
    userId?: string | undefined;
    channel?: string | undefined;
    sessionId?: string | undefined;
    merchantId?: string | undefined;
    deviceId?: string | undefined;
    locationId?: string | undefined;
    attributionSource?: string | undefined;
}>;
/**
 * Event Validation Schema (for incoming events)
 */
export declare const eventValidationSchema: z.ZodObject<{
    type: z.ZodString;
    channel: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    attributionSource: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    userId: z.ZodOptional<z.ZodString>;
    merchantId: z.ZodOptional<z.ZodString>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        ip: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        referrer: z.ZodOptional<z.ZodString>;
        utm: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    }, {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    data: Record<string, unknown>;
    timestamp?: string | undefined;
    userId?: string | undefined;
    channel?: string | undefined;
    metadata?: {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    } | undefined;
    merchantId?: string | undefined;
    attributionSource?: string | undefined;
}, {
    type: string;
    data: Record<string, unknown>;
    timestamp?: string | undefined;
    userId?: string | undefined;
    channel?: string | undefined;
    metadata?: {
        ip?: string | undefined;
        userAgent?: string | undefined;
        referrer?: string | undefined;
        utm?: Record<string, string> | undefined;
    } | undefined;
    merchantId?: string | undefined;
    attributionSource?: string | undefined;
}>;
/**
 * Validate an event against the event validation schema
 */
export declare function validateEvent(event: unknown): {
    valid: boolean;
    data?: z.infer<typeof eventValidationSchema>;
    error?: string;
};
/**
 * Get payload schema for event type
 */
export declare function getPayloadSchema(eventType: EventTypeValue): z.ZodSchema;
/**
 * Validate event payload against its schema
 */
export declare function validateEventPayload(eventType: EventTypeValue, payload: unknown): {
    valid: boolean;
    error?: string;
    data?: unknown;
};
/**
 * Get all valid event types
 */
export declare function getValidEventTypes(): EventTypeValue[];
/**
 * Get event type info
 */
export declare function getEventTypeInfo(eventType: EventTypeValue): {
    category: EventCategoryValue;
    description: string;
    priority: 'high' | 'normal' | 'low';
};
export default EventType;
//# sourceMappingURL=eventSchema.d.ts.map
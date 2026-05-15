/**
 * Event Schema Service
 * Standardized event types for the REZ Agent OS v3
 */

import { z } from 'zod';

/**
 * Channel Types for Event Attribution
 */
export const ChannelType = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  PUSH: 'push',
  EMAIL: 'email',
  IN_APP: 'in_app',
  QR_SCAN: 'qr_scan',
  DEEP_LINK: 'deep_link',
} as const;

export type ChannelTypeValue = typeof ChannelType[keyof typeof ChannelType];

/**
 * Attribution Sources for Event Tracking
 */
export const AttributionSource = {
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
} as const;

export type AttributionSourceValue = typeof AttributionSource[keyof typeof AttributionSource];

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
} as const;

export type EventTypeValue = typeof EventType[keyof typeof EventType];

/**
 * All valid event types as a string array (for validation)
 */
export const ALL_EVENT_TYPES: string[] = Object.values(EventType);

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
  MARKETING: 'MARKETING',
  LOYALTY: 'LOYALTY',
  REFERRAL: 'REFERRAL',
  ENGAGEMENT: 'ENGAGEMENT',
} as const;

export type EventCategoryValue = typeof EventCategory[keyof typeof EventCategory];

/**
 * Map event types to categories
 */
export const EventTypeToCategory: Record<EventTypeValue, EventCategoryValue> = {
  // Existing mappings
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

  // Offer Events
  [EventType.OFFER_SHARED]: EventCategory.MARKETING,
  [EventType.OFFER_OPENED]: EventCategory.MARKETING,

  // Referral Events
  [EventType.REFERRAL_CLICKED]: EventCategory.REFERRAL,
  [EventType.REFERRAL_SIGNED_UP]: EventCategory.REFERRAL,
  [EventType.REFERRAL_PURCHASED]: EventCategory.REFERRAL,

  // Location Events
  [EventType.LOCATION_VISITED]: EventCategory.ENGAGEMENT,
  [EventType.LOCATION_DWELL]: EventCategory.ENGAGEMENT,

  // Search Events
  [EventType.SEARCH_PERFORMED]: EventCategory.ENGAGEMENT,

  // Wishlist Events
  [EventType.WISHLIST_ADDED]: EventCategory.ENGAGEMENT,
  [EventType.WISHLIST_REMOVED]: EventCategory.ENGAGEMENT,

  // Price Alert Events
  [EventType.PRICE_ALERT_SET]: EventCategory.ENGAGEMENT,
  [EventType.PRICE_ALERT_TRIGGERED]: EventCategory.ENGAGEMENT,

  // Review Events
  [EventType.REVIEW_SUBMITTED]: EventCategory.ENGAGEMENT,
  [EventType.REVIEW_VIEWED]: EventCategory.ENGAGEMENT,

  // Profile Events
  [EventType.PROFILE_UPDATED]: EventCategory.USER_INTERACTION,

  // Feedback Events
  [EventType.FEEDBACK_GIVEN]: EventCategory.ENGAGEMENT,

  // Subscription Events
  [EventType.SUBSCRIPTION_STARTED]: EventCategory.BUSINESS_LOGIC,
  [EventType.SUBSCRIPTION_RENEWED]: EventCategory.BUSINESS_LOGIC,
  [EventType.SUBSCRIPTION_CANCELLED]: EventCategory.BUSINESS_LOGIC,

  // Membership Events
  [EventType.MEMBERSHIP_UPGRADED]: EventCategory.LOYALTY,
  [EventType.MEMBERSHIP_DOWNGRADED]: EventCategory.LOYALTY,

  // Loyalty Events
  [EventType.LOYALTY_REDEEMED]: EventCategory.LOYALTY,
  [EventType.LOYALTY_EARNED]: EventCategory.LOYALTY,

  // Competitor Events
  [EventType.COMPETITOR_VISITED]: EventCategory.ENGAGEMENT,
  [EventType.COMPETITOR_SWITCHED]: EventCategory.ENGAGEMENT,

  // App Events
  [EventType.APP_INSTALLED]: EventCategory.USER_INTERACTION,
  [EventType.APP_OPENED]: EventCategory.USER_INTERACTION,

  // Content Events
  [EventType.CONTENT_VIEWED]: EventCategory.ENGAGEMENT,
  [EventType.CONTENT_SHARED]: EventCategory.MARKETING,

  // Campaign Events
  [EventType.CAMPAIGN_STARTED]: EventCategory.MARKETING,
  [EventType.CAMPAIGN_COMPLETED]: EventCategory.MARKETING,

  // Survey Events
  [EventType.SURVEY_STARTED]: EventCategory.ENGAGEMENT,
  [EventType.SURVEY_COMPLETED]: EventCategory.ENGAGEMENT,
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
    // New event types
    EventType.OFFER_SHARED,
    EventType.OFFER_OPENED,
    EventType.REFERRAL_CLICKED,
    EventType.REFERRAL_SIGNED_UP,
    EventType.REFERRAL_PURCHASED,
    EventType.LOCATION_VISITED,
    EventType.LOCATION_DWELL,
    EventType.SEARCH_PERFORMED,
    EventType.WISHLIST_ADDED,
    EventType.WISHLIST_REMOVED,
    EventType.PRICE_ALERT_SET,
    EventType.PRICE_ALERT_TRIGGERED,
    EventType.REVIEW_SUBMITTED,
    EventType.REVIEW_VIEWED,
    EventType.PROFILE_UPDATED,
    EventType.FEEDBACK_GIVEN,
    EventType.SUBSCRIPTION_STARTED,
    EventType.SUBSCRIPTION_RENEWED,
    EventType.SUBSCRIPTION_CANCELLED,
    EventType.MEMBERSHIP_UPGRADED,
    EventType.MEMBERSHIP_DOWNGRADED,
    EventType.LOYALTY_REDEEMED,
    EventType.LOYALTY_EARNED,
    EventType.COMPETITOR_VISITED,
    EventType.COMPETITOR_SWITCHED,
    EventType.APP_INSTALLED,
    EventType.APP_OPENED,
    EventType.CONTENT_VIEWED,
    EventType.CONTENT_SHARED,
    EventType.CAMPAIGN_STARTED,
    EventType.CAMPAIGN_COMPLETED,
    EventType.SURVEY_STARTED,
    EventType.SURVEY_COMPLETED,
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
 * Generic Event Payload Schema for new event types
 */
export const GenericEventPayloadSchema = z.object({
  userId: z.string().optional(),
  merchantId: z.string().optional(),
  sessionId: z.string().optional(),
  deviceId: z.string().optional(),
  locationId: z.string().optional(),
  data: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional(),
});

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
export const EnrichedEventSchema = z.object({
  id: z.string(),
  type: z.string().min(1),
  channel: z.enum(Object.values(ChannelType) as [string, ...string[]]).optional(),
  attributionSource: z.enum(Object.values(AttributionSource) as [string, ...string[]]).optional(),
  userId: z.string().optional(),
  merchantId: z.string().optional(),
  sessionId: z.string().optional(),
  deviceId: z.string().optional(),
  locationId: z.string().optional(),
  data: z.record(z.any()),
  timestamp: z.string().datetime(),
  metadata: z.object({
    ip: z.string().optional(),
    userAgent: z.string().optional(),
    referrer: z.string().optional(),
    utm: z.record(z.string()).optional(),
  }),
});

/**
 * Event Validation Schema (for incoming events)
 */
export const eventValidationSchema = z.object({
  type: z.string().min(1),
  channel: z.enum(Object.values(ChannelType) as [string, ...string[]]).optional(),
  attributionSource: z.enum(Object.values(AttributionSource) as [string, ...string[]]).optional(),
  userId: z.string().optional(),
  merchantId: z.string().optional(),
  data: z.record(z.any()),
  timestamp: z.string().datetime().optional(),
  metadata: z.object({
    ip: z.string().optional(),
    userAgent: z.string().optional(),
    referrer: z.string().optional(),
    utm: z.record(z.string()).optional(),
  }).optional(),
});

/**
 * Validate an event against the event validation schema
 */
export function validateEvent(event: unknown): {
  valid: boolean;
  data?: z.infer<typeof eventValidationSchema>;
  error?: string;
} {
  const result = eventValidationSchema.safeParse(event);

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
    // New event types use generic schema
    [EventType.OFFER_SHARED]: GenericEventPayloadSchema,
    [EventType.OFFER_OPENED]: GenericEventPayloadSchema,
    [EventType.REFERRAL_CLICKED]: GenericEventPayloadSchema,
    [EventType.REFERRAL_SIGNED_UP]: GenericEventPayloadSchema,
    [EventType.REFERRAL_PURCHASED]: GenericEventPayloadSchema,
    [EventType.LOCATION_VISITED]: GenericEventPayloadSchema,
    [EventType.LOCATION_DWELL]: GenericEventPayloadSchema,
    [EventType.SEARCH_PERFORMED]: GenericEventPayloadSchema,
    [EventType.WISHLIST_ADDED]: GenericEventPayloadSchema,
    [EventType.WISHLIST_REMOVED]: GenericEventPayloadSchema,
    [EventType.PRICE_ALERT_SET]: GenericEventPayloadSchema,
    [EventType.PRICE_ALERT_TRIGGERED]: GenericEventPayloadSchema,
    [EventType.REVIEW_SUBMITTED]: GenericEventPayloadSchema,
    [EventType.REVIEW_VIEWED]: GenericEventPayloadSchema,
    [EventType.PROFILE_UPDATED]: GenericEventPayloadSchema,
    [EventType.FEEDBACK_GIVEN]: GenericEventPayloadSchema,
    [EventType.SUBSCRIPTION_STARTED]: GenericEventPayloadSchema,
    [EventType.SUBSCRIPTION_RENEWED]: GenericEventPayloadSchema,
    [EventType.SUBSCRIPTION_CANCELLED]: GenericEventPayloadSchema,
    [EventType.MEMBERSHIP_UPGRADED]: GenericEventPayloadSchema,
    [EventType.MEMBERSHIP_DOWNGRADED]: GenericEventPayloadSchema,
    [EventType.LOYALTY_REDEEMED]: GenericEventPayloadSchema,
    [EventType.LOYALTY_EARNED]: GenericEventPayloadSchema,
    [EventType.COMPETITOR_VISITED]: GenericEventPayloadSchema,
    [EventType.COMPETITOR_SWITCHED]: GenericEventPayloadSchema,
    [EventType.APP_INSTALLED]: GenericEventPayloadSchema,
    [EventType.APP_OPENED]: GenericEventPayloadSchema,
    [EventType.CONTENT_VIEWED]: GenericEventPayloadSchema,
    [EventType.CONTENT_SHARED]: GenericEventPayloadSchema,
    [EventType.CAMPAIGN_STARTED]: GenericEventPayloadSchema,
    [EventType.CAMPAIGN_COMPLETED]: GenericEventPayloadSchema,
    [EventType.SURVEY_STARTED]: GenericEventPayloadSchema,
    [EventType.SURVEY_COMPLETED]: GenericEventPayloadSchema,
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
    // New event types
    [EventType.OFFER_SHARED]: {
      category: EventCategory.MARKETING,
      description: 'User shared an offer with others',
      priority: 'normal',
    },
    [EventType.OFFER_OPENED]: {
      category: EventCategory.MARKETING,
      description: 'User opened a shared offer',
      priority: 'normal',
    },
    [EventType.REFERRAL_CLICKED]: {
      category: EventCategory.REFERRAL,
      description: 'User clicked on a referral link',
      priority: 'normal',
    },
    [EventType.REFERRAL_SIGNED_UP]: {
      category: EventCategory.REFERRAL,
      description: 'Referred user completed signup',
      priority: 'high',
    },
    [EventType.REFERRAL_PURCHASED]: {
      category: EventCategory.REFERRAL,
      description: 'Referred user made a purchase',
      priority: 'high',
    },
    [EventType.LOCATION_VISITED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User visited a physical location',
      priority: 'normal',
    },
    [EventType.LOCATION_DWELL]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User dwelled at a location for extended time',
      priority: 'normal',
    },
    [EventType.SEARCH_PERFORMED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User performed a search query',
      priority: 'normal',
    },
    [EventType.WISHLIST_ADDED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User added item to wishlist',
      priority: 'normal',
    },
    [EventType.WISHLIST_REMOVED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User removed item from wishlist',
      priority: 'normal',
    },
    [EventType.PRICE_ALERT_SET]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User set a price alert for an item',
      priority: 'normal',
    },
    [EventType.PRICE_ALERT_TRIGGERED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'Price alert was triggered',
      priority: 'high',
    },
    [EventType.REVIEW_SUBMITTED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User submitted a review',
      priority: 'normal',
    },
    [EventType.REVIEW_VIEWED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User viewed a review',
      priority: 'low',
    },
    [EventType.PROFILE_UPDATED]: {
      category: EventCategory.USER_INTERACTION,
      description: 'User updated their profile',
      priority: 'normal',
    },
    [EventType.FEEDBACK_GIVEN]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User submitted feedback',
      priority: 'normal',
    },
    [EventType.SUBSCRIPTION_STARTED]: {
      category: EventCategory.BUSINESS_LOGIC,
      description: 'User started a subscription',
      priority: 'high',
    },
    [EventType.SUBSCRIPTION_RENEWED]: {
      category: EventCategory.BUSINESS_LOGIC,
      description: 'Subscription was renewed',
      priority: 'high',
    },
    [EventType.SUBSCRIPTION_CANCELLED]: {
      category: EventCategory.BUSINESS_LOGIC,
      description: 'Subscription was cancelled',
      priority: 'high',
    },
    [EventType.MEMBERSHIP_UPGRADED]: {
      category: EventCategory.LOYALTY,
      description: 'User upgraded their membership tier',
      priority: 'high',
    },
    [EventType.MEMBERSHIP_DOWNGRADED]: {
      category: EventCategory.LOYALTY,
      description: 'User downgraded their membership tier',
      priority: 'normal',
    },
    [EventType.LOYALTY_REDEEMED]: {
      category: EventCategory.LOYALTY,
      description: 'User redeemed loyalty points',
      priority: 'normal',
    },
    [EventType.LOYALTY_EARNED]: {
      category: EventCategory.LOYALTY,
      description: 'User earned loyalty points',
      priority: 'normal',
    },
    [EventType.COMPETITOR_VISITED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User visited a competitor location',
      priority: 'normal',
    },
    [EventType.COMPETITOR_SWITCHED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User switched to a competitor',
      priority: 'high',
    },
    [EventType.APP_INSTALLED]: {
      category: EventCategory.USER_INTERACTION,
      description: 'User installed the app',
      priority: 'high',
    },
    [EventType.APP_OPENED]: {
      category: EventCategory.USER_INTERACTION,
      description: 'User opened the app',
      priority: 'low',
    },
    [EventType.CONTENT_VIEWED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User viewed content',
      priority: 'low',
    },
    [EventType.CONTENT_SHARED]: {
      category: EventCategory.MARKETING,
      description: 'User shared content',
      priority: 'normal',
    },
    [EventType.CAMPAIGN_STARTED]: {
      category: EventCategory.MARKETING,
      description: 'User joined a campaign',
      priority: 'normal',
    },
    [EventType.CAMPAIGN_COMPLETED]: {
      category: EventCategory.MARKETING,
      description: 'User completed a campaign',
      priority: 'normal',
    },
    [EventType.SURVEY_STARTED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User started a survey',
      priority: 'normal',
    },
    [EventType.SURVEY_COMPLETED]: {
      category: EventCategory.ENGAGEMENT,
      description: 'User completed a survey',
      priority: 'normal',
    },
  };

  return info[eventType];
}

export default EventType;

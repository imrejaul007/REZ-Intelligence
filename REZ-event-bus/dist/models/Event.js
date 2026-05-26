"use strict";
/**
 * Event Model
 * Standardized event structure for the REZ Event Bus
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSchema = exports.EventStatus = exports.EventPriority = void 0;
exports.createEvent = createEvent;
exports.isValidEventType = isValidEventType;
const zod_1 = require("zod");
/**
 * Event Priority Levels
 */
var EventPriority;
(function (EventPriority) {
    EventPriority["HIGH"] = "high";
    EventPriority["NORMAL"] = "normal";
    EventPriority["LOW"] = "low";
})(EventPriority || (exports.EventPriority = EventPriority = {}));
/**
 * Event Status
 */
var EventStatus;
(function (EventStatus) {
    EventStatus["PENDING"] = "pending";
    EventStatus["PUBLISHED"] = "published";
    EventStatus["PROCESSING"] = "processing";
    EventStatus["COMPLETED"] = "completed";
    EventStatus["FAILED"] = "failed";
    EventStatus["DEAD_LETTER"] = "dead_letter";
})(EventStatus || (exports.EventStatus = EventStatus = {}));
/**
 * Event Schema using Zod
 * Validates incoming event payloads
 */
exports.EventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid().optional(),
    eventType: zod_1.z.string().min(1).max(100),
    payload: zod_1.z.record(zod_1.z.unknown()),
    metadata: zod_1.z.object({
        source: zod_1.z.string().min(1),
        timestamp: zod_1.z.string().datetime().or(zod_1.z.date()).transform(val => val instanceof Date ? val.toISOString() : val),
        correlationId: zod_1.z.string().uuid().optional(),
        causationId: zod_1.z.string().uuid().optional(),
        replyTo: zod_1.z.string().optional(),
        priority: zod_1.z.nativeEnum(EventPriority).default(EventPriority.NORMAL),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    version: zod_1.z.string().default('1.0'),
});
/**
 * Helper function to create a new event
 */
function createEvent(payload) {
    const { v4: uuidv4 } = require('uuid');
    return {
        eventId: uuidv4(),
        eventType: payload.eventType,
        payload: payload.payload,
        metadata: {
            source: payload.source,
            timestamp: new Date().toISOString(),
            correlationId: payload.correlationId,
            causationId: payload.causationId,
            priority: payload.priority || EventPriority.NORMAL,
            tags: payload.tags || [],
        },
        version: '1.0',
        status: EventStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
/**
 * Validate event type is in allowed list
 */
function isValidEventType(eventType) {
    const validTypes = [
        // Existing types
        'USER_MESSAGE_RECEIVED',
        'USER_MESSAGE_SENT',
        'INTENT_DETECTED',
        'AGENT_SELECTED',
        'AGENT_SWITCHED',
        'COLLABORATION_STARTED',
        'ORDER_CREATED',
        'ORDER_COMPLETED',
        'PAYMENT_INITIATED',
        'PAYMENT_COMPLETED',
        'SERVICE_HEALTH_CHANGED',
        // New event types
        'offer.shared',
        'offer.opened',
        'referral.clicked',
        'referral.signed_up',
        'referral.purchased',
        'location.visited',
        'location.dwell',
        'search.performed',
        'wishlist.added',
        'wishlist.removed',
        'price.alert_set',
        'price.alert_triggered',
        'review.submitted',
        'review.viewed',
        'profile.updated',
        'feedback.given',
        'subscription.started',
        'subscription.renewed',
        'subscription.cancelled',
        'membership.upgraded',
        'membership.downgraded',
        'loyalty.redeemed',
        'loyalty.earned',
        'competitor.visited',
        'competitor.switched',
        'app.installed',
        'app.opened',
        'content.viewed',
        'content.shared',
        'campaign.started',
        'campaign.completed',
        'survey.started',
        'survey.completed',
    ];
    return validTypes.includes(eventType);
}
exports.default = exports.EventSchema;
//# sourceMappingURL=Event.js.map
"use strict";
/**
 * Event Validator Service
 * Validates events and payloads using Zod schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventValidator = exports.ValidationError = void 0;
exports.validateBody = validateBody;
const zod_1 = require("zod");
const eventSchema_1 = require("./eventSchema");
const Event_1 = require("../models/Event");
const Subscription_1 = require("../models/Subscription");
const config_1 = require("../config");
/**
 * Validation Error
 */
class ValidationError extends Error {
    code;
    details;
    constructor(message, details = []) {
        super(message);
        this.name = 'ValidationError';
        this.code = 'VALIDATION_ERROR';
        this.details = details;
    }
}
exports.ValidationError = ValidationError;
/**
 * Event Validator Service
 */
class EventValidator {
    /**
     * Validate an event creation payload
     */
    static validateEventPayload(payload) {
        const schema = zod_1.z.object({
            eventType: zod_1.z.string().min(1, 'eventType is required').max(100, 'eventType too long'),
            payload: zod_1.z.record(zod_1.z.unknown(), {
                required_error: 'payload is required',
                invalid_type_error: 'payload must be an object',
            }),
            source: zod_1.z.string().min(1, 'source is required').max(100, 'source too long'),
            correlationId: zod_1.z.string().uuid().optional(),
            causationId: zod_1.z.string().uuid().optional(),
            priority: zod_1.z.nativeEnum(Event_1.EventPriority).optional(),
            tags: zod_1.z.array(zod_1.z.string().max(50)).max(10).optional(),
        });
        const result = schema.safeParse(payload);
        if (!result.success) {
            throw new ValidationError('Invalid event payload', result.error.issues.map((issue) => ({
                code: issue.code,
                expected: String(issue.expected || ''),
                received: String(issue.received || ''),
                path: issue.path.map(String),
                message: issue.message,
            })));
        }
        return result.data;
    }
    /**
     * Validate event type is in allowed list
     */
    static validateEventType(eventType) {
        const validTypes = Object.values(eventSchema_1.EventType);
        if (!validTypes.includes(eventType)) {
            throw new ValidationError(`Invalid event type: ${eventType}`, [{
                    code: 'invalid_enum_value',
                    expected: validTypes.join(' | '),
                    received: eventType,
                    path: ['eventType'],
                    message: `eventType must be one of: ${validTypes.join(', ')}`,
                }]);
        }
        return eventType;
    }
    /**
     * Validate a complete event
     */
    static validateEvent(event) {
        const result = eventSchema_1.ReZEventSchema.safeParse(event);
        if (!result.success) {
            throw new ValidationError('Invalid event', result.error.issues.map((issue) => ({
                code: issue.code,
                expected: String(issue.expected || ''),
                received: String(issue.received || ''),
                path: issue.path.map(String),
                message: issue.message,
            })));
        }
        return result.data;
    }
    /**
     * Validate payload against event type schema
     */
    static validatePayloadByType(eventType, payload) {
        const validation = (0, eventSchema_1.validateEventPayload)(eventType, payload);
        return validation.valid;
    }
    /**
     * Validate subscription payload
     */
    static validateSubscriptionPayload(payload) {
        const schema = zod_1.z.object({
            subscriberId: zod_1.z.string().min(1, 'subscriberId is required').max(100),
            eventTypes: zod_1.z.array(zod_1.z.string().min(1).max(100)).min(1, 'at least one eventType required'),
            url: zod_1.z.string().url().optional(),
            webhookUrl: zod_1.z.string().url().optional(),
            callbackUrl: zod_1.z.string().url().optional(),
            filter: zod_1.z.record(zod_1.z.unknown()).optional(),
            deliveryStrategy: zod_1.z.nativeEnum(Subscription_1.DeliveryStrategy).optional(),
            metadata: zod_1.z.object({
                description: zod_1.z.string().max(500).optional(),
                owner: zod_1.z.string().optional(),
                tags: zod_1.z.array(zod_1.z.string()).optional(),
                maxRetries: zod_1.z.number().int().min(0).max(10).optional(),
                retryDelayMs: zod_1.z.number().int().min(0).max(60000).optional(),
                timeoutMs: zod_1.z.number().int().min(1000).max(60000).optional(),
            }).optional(),
        });
        const result = schema.safeParse(payload);
        if (!result.success) {
            throw new ValidationError('Invalid subscription payload', result.error.issues.map((issue) => ({
                code: issue.code,
                expected: String(issue.expected || ''),
                received: String(issue.received || ''),
                path: issue.path.map(String),
                message: issue.message,
            })));
        }
        return result.data;
    }
    /**
     * Validate payload size
     */
    static validatePayloadSize(payload) {
        const jsonString = JSON.stringify(payload);
        const size = Buffer.byteLength(jsonString, 'utf8');
        const maxSize = config_1.config.eventBus.maxPayloadSize;
        if (size > maxSize) {
            throw new ValidationError(`Payload size ${size} bytes exceeds maximum allowed ${maxSize} bytes`, [{
                    code: 'payload_too_large',
                    expected: `max:${maxSize}`,
                    received: `actual:${size}`,
                    path: ['payload'],
                    message: `Payload must be less than ${maxSize} bytes`,
                }]);
        }
    }
    /**
     * Validate correlation chain (max depth)
     */
    static validateCorrelationChain(correlationId, causationId) {
        // Validate UUID format
        if (correlationId) {
            zod_1.z.string().uuid().parse(correlationId);
        }
        if (causationId) {
            zod_1.z.string().uuid().parse(causationId);
        }
    }
    /**
     * Sanitize string input
     */
    static sanitizeString(input, maxLength = 100) {
        return input
            .replace(/[<>]/g, '') // Remove potential XSS characters
            .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
            .trim()
            .substring(0, maxLength);
    }
    /**
     * Validate batch event payload
     */
    static validateBatchPayload(events) {
        const errors = [];
        for (let i = 0; i < events.length; i++) {
            try {
                this.validateEventPayload(events[i]);
            }
            catch (error) {
                if (error instanceof ValidationError) {
                    errors.push({ index: i, error: error.message });
                }
                else {
                    errors.push({ index: i, error: 'Unknown validation error' });
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * Parse ZodError to user-friendly format
     */
    static parseZodError(error) {
        return error.issues.map((issue) => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
        });
    }
}
exports.EventValidator = EventValidator;
/**
 * Middleware for validating request body
 */
function validateBody(schema) {
    return (body) => {
        const result = schema.safeParse(body);
        if (!result.success) {
            throw new ValidationError('Invalid request body', result.error.issues.map((issue) => ({
                code: issue.code,
                expected: String(issue.expected || ''),
                received: String(issue.received || ''),
                path: issue.path.map(String),
                message: issue.message,
            })));
        }
        return result.data;
    };
}
exports.default = EventValidator;
//# sourceMappingURL=eventValidator.js.map
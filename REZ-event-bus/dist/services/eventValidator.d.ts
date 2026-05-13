/**
 * Event Validator Service
 * Validates events and payloads using Zod schemas
 */
import { z, ZodError, ZodSchema } from 'zod';
import { EventTypeValue, ReZEventSchema } from './eventSchema';
import { EventCreatePayload } from '../models/Event';
import { SubscriptionCreatePayload } from '../models/Subscription';
/**
 * Custom issue for validation errors
 */
interface ValidationIssue {
    code: string;
    expected?: string;
    received?: string;
    path: string[];
    message: string;
}
/**
 * Validation Error
 */
export declare class ValidationError extends Error {
    readonly code: string;
    readonly details: ValidationIssue[];
    constructor(message: string, details?: ValidationIssue[]);
}
/**
 * Event Validator Service
 */
export declare class EventValidator {
    /**
     * Validate an event creation payload
     */
    static validateEventPayload(payload: unknown): EventCreatePayload;
    /**
     * Validate event type is in allowed list
     */
    static validateEventType(eventType: string): EventTypeValue;
    /**
     * Validate a complete event
     */
    static validateEvent(event: unknown): z.infer<typeof ReZEventSchema>;
    /**
     * Validate payload against event type schema
     */
    static validatePayloadByType(eventType: EventTypeValue, payload: unknown): boolean;
    /**
     * Validate subscription payload
     */
    static validateSubscriptionPayload(payload: unknown): SubscriptionCreatePayload;
    /**
     * Validate payload size
     */
    static validatePayloadSize(payload: unknown): void;
    /**
     * Validate correlation chain (max depth)
     */
    static validateCorrelationChain(correlationId: string | undefined, causationId: string | undefined): void;
    /**
     * Sanitize string input
     */
    static sanitizeString(input: string, maxLength?: number): string;
    /**
     * Validate batch event payload
     */
    static validateBatchPayload(events: unknown[]): {
        valid: boolean;
        errors: Array<{
            index: number;
            error: string;
        }>;
    };
    /**
     * Parse ZodError to user-friendly format
     */
    static parseZodError(error: ZodError): string[];
}
/**
 * Middleware for validating request body
 */
export declare function validateBody<T>(schema: ZodSchema<T>): (body: unknown) => T;
export default EventValidator;
//# sourceMappingURL=eventValidator.d.ts.map
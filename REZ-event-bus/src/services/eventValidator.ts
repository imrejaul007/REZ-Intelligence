/**
 * Event Validator Service
 * Validates events and payloads using Zod schemas
 */

import { z, ZodError, ZodSchema } from 'zod';
import { EventType, EventTypeValue, validateEventPayload, ReZEventSchema } from './eventSchema';
import { EventCreatePayload, EventPriority } from '../models/Event';
import { SubscriptionCreatePayload, DeliveryStrategy } from '../models/Subscription';
import { config } from '../config';

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
export class ValidationError extends Error {
  public readonly code: string;
  public readonly details: ValidationIssue[];

  constructor(message: string, details: ValidationIssue[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}

/**
 * Event Validator Service
 */
export class EventValidator {
  /**
   * Validate an event creation payload
   */
  static validateEventPayload(payload: unknown): EventCreatePayload {
    const schema = z.object({
      eventType: z.string().min(1, 'eventType is required').max(100, 'eventType too long'),
      payload: z.record(z.unknown(), {
        required_error: 'payload is required',
        invalid_type_error: 'payload must be an object',
      }),
      source: z.string().min(1, 'source is required').max(100, 'source too long'),
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      priority: z.nativeEnum(EventPriority).optional(),
      tags: z.array(z.string().max(50)).max(10).optional(),
    });

    const result = schema.safeParse(payload);

    if (!result.success) {
      throw new ValidationError(
        'Invalid event payload',
        result.error.issues.map((issue) => ({
          code: issue.code,
          expected: String((issue as { expected?: unknown }).expected || ''),
          received: String((issue as { received?: unknown }).received || ''),
          path: issue.path.map(String),
          message: issue.message,
        }))
      );
    }

    return result.data;
  }

  /**
   * Validate event type is in allowed list
   */
  static validateEventType(eventType: string): EventTypeValue {
    const validTypes = Object.values(EventType) as string[];

    if (!validTypes.includes(eventType)) {
      throw new ValidationError(
        `Invalid event type: ${eventType}`,
        [{
          code: 'invalid_enum_value',
          expected: validTypes.join(' | '),
          received: eventType,
          path: ['eventType'],
          message: `eventType must be one of: ${validTypes.join(', ')}`,
        }]
      );
    }

    return eventType as EventTypeValue;
  }

  /**
   * Validate a complete event
   */
  static validateEvent(event: unknown): z.infer<typeof ReZEventSchema> {
    const result = ReZEventSchema.safeParse(event);

    if (!result.success) {
      throw new ValidationError(
        'Invalid event',
        result.error.issues.map((issue) => ({
          code: issue.code,
          expected: String((issue as { expected?: unknown }).expected || ''),
          received: String((issue as { received?: unknown }).received || ''),
          path: issue.path.map(String),
          message: issue.message,
        }))
      );
    }

    return result.data;
  }

  /**
   * Validate payload against event type schema
   */
  static validatePayloadByType(eventType: EventTypeValue, payload: unknown): boolean {
    const validation = validateEventPayload(eventType, payload);
    return validation.valid;
  }

  /**
   * Validate subscription payload
   */
  static validateSubscriptionPayload(payload: unknown): SubscriptionCreatePayload {
    const schema = z.object({
      subscriberId: z.string().min(1, 'subscriberId is required').max(100),
      eventTypes: z.array(z.string().min(1).max(100)).min(1, 'at least one eventType required'),
      url: z.string().url().optional(),
      webhookUrl: z.string().url().optional(),
      callbackUrl: z.string().url().optional(),
      filter: z.record(z.unknown()).optional(),
      deliveryStrategy: z.nativeEnum(DeliveryStrategy).optional(),
      metadata: z.object({
        description: z.string().max(500).optional(),
        owner: z.string().optional(),
        tags: z.array(z.string()).optional(),
        maxRetries: z.number().int().min(0).max(10).optional(),
        retryDelayMs: z.number().int().min(0).max(60000).optional(),
        timeoutMs: z.number().int().min(1000).max(60000).optional(),
      }).optional(),
    });

    const result = schema.safeParse(payload);

    if (!result.success) {
      throw new ValidationError(
        'Invalid subscription payload',
        result.error.issues.map((issue) => ({
          code: issue.code,
          expected: String((issue as { expected?: unknown }).expected || ''),
          received: String((issue as { received?: unknown }).received || ''),
          path: issue.path.map(String),
          message: issue.message,
        }))
      );
    }

    return result.data;
  }

  /**
   * Validate payload size
   */
  static validatePayloadSize(payload: unknown): void {
    const jsonString = JSON.stringify(payload);
    const size = Buffer.byteLength(jsonString, 'utf8');
    const maxSize = config.eventBus.maxPayloadSize;

    if (size > maxSize) {
      throw new ValidationError(
        `Payload size ${size} bytes exceeds maximum allowed ${maxSize} bytes`,
        [{
          code: 'payload_too_large',
          expected: `max:${maxSize}`,
          received: `actual:${size}`,
          path: ['payload'],
          message: `Payload must be less than ${maxSize} bytes`,
        }]
      );
    }
  }

  /**
   * Validate correlation chain (max depth)
   */
  static validateCorrelationChain(
    correlationId: string | undefined,
    causationId: string | undefined
  ): void {
    // Validate UUID format
    if (correlationId) {
      z.string().uuid().parse(correlationId);
    }
    if (causationId) {
      z.string().uuid().parse(causationId);
    }
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string, maxLength: number = 100): string {
    return input
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim()
      .substring(0, maxLength);
  }

  /**
   * Validate batch event payload
   */
  static validateBatchPayload(
    events: unknown[]
  ): { valid: boolean; errors: Array<{ index: number; error: string }> } {
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < events.length; i++) {
      try {
        this.validateEventPayload(events[i]);
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push({ index: i, error: error.message });
        } else {
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
  static parseZodError(error: ZodError): string[] {
    return error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
  }
}

/**
 * Middleware for validating request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (body: unknown): T => {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(
        'Invalid request body',
        result.error.issues.map((issue) => ({
          code: issue.code,
          expected: String((issue as { expected?: unknown }).expected || ''),
          received: String((issue as { received?: unknown }).received || ''),
          path: issue.path.map(String),
          message: issue.message,
        }))
      );
    }
    return result.data;
  };
}

export default EventValidator;

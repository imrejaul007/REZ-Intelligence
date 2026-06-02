/**
 * Schema Validation Utility for API Responses
 *
 * Provides dark-launch schema validation with logging but no throwing.
 * Used to detect schema drift in production without breaking the app.
 */

import { z } from 'zod';
import { isFeatureEnabled } from './flags';

/**
 * Logger interface for redacting sensitive data
 * Expected to be provided by calling app
 */
interface ValidationLogger {
  warn: (message: string, context?: Record<string, any>) => void;
  error: (message: string, context?: Record<string, any>) => void;
}

let globalLogger: ValidationLogger = {
  warn: () => {},
  error: () => {},
};

/**
 * Set the global logger for validation failures
 * Must be called during app initialization
 */
export function setValidationLogger(logger: ValidationLogger): void {
  globalLogger = logger;
}

/**
 * Validate API response against a Zod schema
 * Dark launch: logs failures but does NOT throw
 *
 * @param schema Zod schema to validate against
 * @param data Raw response data
 * @param endpoint Endpoint name for logging (e.g., "/user/auth/me")
 * @returns Original data (always), plus success flag for optional logging
 */
export function validateResponse<T>(
  schema: z.ZodTypeAny,
  data: unknown,
  endpoint: string
): { data: T; valid: boolean; error?: string } {
  // Feature flag gate
  if (!isFeatureEnabled('SCHEMA_VALIDATION_ENABLED')) {
    return {
      data: data as T,
      valid: true,
    };
  }

  const result = schema.safeParse(data);

  if (result.success) {
    return {
      data: result.data as T,
      valid: true,
    };
  }

  // Validation failed - log but do NOT throw
  const errorMessage = result.error.message;
  const context = {
    endpoint,
    schemaDrift: true,
    errorCount: result.error.issues.length,
    issues: result.error.issues.slice(0, 5).map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };

  // Log to global logger (should redact sensitive data)
  globalLogger.warn('[Schema Validation] API response drift detected', context);

  // Return original data anyway (dark launch)
  return {
    data: data as T,
    valid: false,
    error: errorMessage,
  };
}

/**
 * Batch validate multiple responses
 * Useful for list endpoints
 */
export function validateResponseArray<T>(
  schema: z.ZodTypeAny,
  dataArray: unknown[],
  endpoint: string
): { data: T[]; validCount: number; invalidCount: number } {
  if (!isFeatureEnabled('SCHEMA_VALIDATION_ENABLED')) {
    return {
      data: dataArray as T[],
      validCount: dataArray.length,
      invalidCount: 0,
    };
  }

  let validCount = 0;
  let invalidCount = 0;

  const validated = dataArray.map((item, index) => {
    const result = schema.safeParse(item);
    if (result.success) {
      validCount++;
      return result.data;
    } else {
      invalidCount++;
      globalLogger.warn(`[Schema Validation] Item #${index} in ${endpoint} response drift`, {
        endpoint,
        schemaDrift: true,
        itemIndex: index,
        error: result.error.message,
      });
      return item;
    }
  });

  return {
    data: validated as T[],
    validCount,
    invalidCount,
  };
}

/**
 * Create a wrapper for endpoint functions to inject validation
 * Example:
 *   const validatedFetch = withValidation(schema, '/endpoint')(originalFetch);
 */
export function withValidation<T>(
  schema: z.ZodTypeAny,
  endpoint: string
) {
  return (fn: () => Promise<{ success: boolean; data?: T }>) => async () => {
    const result = await fn();
    if (result.success && result.data) {
      const { valid, error } = validateResponse<T>(schema, result.data, endpoint);
      if (!valid && error) {
        // Optionally log full error
        globalLogger.warn(`[Schema Validation] Response failed validation at ${endpoint}`, {
          endpoint,
          schemaDrift: true,
          error,
        });
      }
    }
    return result;
  };
}

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Request validation middleware factory
 * Validates request body, query, and params against Zod schemas
 */
export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      // Validate query
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }

      // Validate params
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });

        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: formattedErrors,
          },
        });
        return;
      }

      // Re-throw non-Zod errors
      next(error);
    }
  };
}

/**
 * Body validation middleware
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Body validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Query validation middleware
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Query validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameter validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Params validation middleware
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Params validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URL parameter validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  // UUID pattern
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // Pagination parameters
  pagination: {
    limit: (min = 1, max = 100) => ({
      type: 'number',
      minimum: min,
      maximum: max,
      default: 20,
    }),
    skip: {
      type: 'number',
      minimum: 0,
      default: 0,
    },
  },

  // Date range
  dateRange: {
    startDate: {
      type: 'string',
      format: 'date-time',
    },
    endDate: {
      type: 'string',
      format: 'date-time',
    },
  },

  // Merchant ID
  merchantId: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
  },

  // Customer ID
  customerId: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
  },

  // Product ID
  productId: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
  },
};

/**
 * Validate required fields presence
 */
export function requireFields(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields = fields.filter(field => {
      const value = req.body?.[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      logger.warn('Missing required fields', {
        path: req.path,
        method: req.method,
        missingFields,
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: `Required fields missing: ${missingFields.join(', ')}`,
          details: missingFields.map(field => ({ field })),
        },
      });
      return;
    }

    next();
  };
}

/**
 * Validate array length
 */
export function validateArrayLength(
  field: string,
  min?: number,
  max?: number
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const array = req.body?.[field];

    if (!Array.isArray(array)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: `${field} must be an array`,
        },
      });
      return;
    }

    if (min !== undefined && array.length < min) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ARRAY_TOO_SHORT',
          message: `${field} must have at least ${min} items`,
        },
      });
      return;
    }

    if (max !== undefined && array.length > max) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ARRAY_TOO_LONG',
          message: `${field} must have at most ${max} items`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Sanitize string input to prevent injection
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate price range
 */
export function validatePriceRange(
  minField: string,
  maxField: string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const minPrice = req.body?.[minField];
    const maxPrice = req.body?.[maxField];

    if (minPrice !== undefined && maxPrice !== undefined) {
      if (minPrice > maxPrice) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRICE_RANGE',
            message: `${minField} must be less than or equal to ${maxField}`,
          },
        });
        return;
      }
    }

    next();
  };
}
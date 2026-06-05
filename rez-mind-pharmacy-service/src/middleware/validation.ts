import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      logger.warn('Request body validation failed', {
        path: req.path,
        errors: result.error.errors,
      });

      throw new ValidationError(
        'Invalid request body',
        result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    req.body = result.data;
    next();
  };
}

/**
 * Validate request query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      logger.warn('Query validation failed', {
        path: req.path,
        errors: result.error.errors,
      });

      throw new ValidationError(
        'Invalid query parameters',
        result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    req.query = result.data as any;
    next();
  };
}

/**
 * Validate request params against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      logger.warn('Params validation failed', {
        path: req.path,
        errors: result.error.errors,
      });

      throw new ValidationError(
        'Invalid path parameters',
        result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    req.params = result.data as any;
    next();
  };
}

/**
 * Validate merchant ID in request
 */
export function validateMerchantId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const merchantId = req.params.merchantId || req.body?.merchantId || req.query?.merchantId;

  if (!merchantId || typeof merchantId !== 'string' || merchantId.trim() === '') {
    throw new ValidationError('Merchant ID is required');
  }

  next();
}

/**
 * Validate UUID format
 */
export function validateUUID(fieldName: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[fieldName] || req.body?.[fieldName];

    if (!value || !uuidRegex.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid UUID`);
    }

    next();
  };
}

/**
 * Validate drug interaction request
 */
export function validateDrugIds(minDrugs: number = 2, maxDrugs: number = 20) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const drugIds = req.body?.drugIds;

    if (!Array.isArray(drugIds)) {
      throw new ValidationError('drugIds must be an array');
    }

    if (drugIds.length < minDrugs) {
      throw new ValidationError(`At least ${minDrugs} drugs required for interaction check`);
    }

    if (drugIds.length > maxDrugs) {
      throw new ValidationError(`Maximum ${maxDrugs} drugs allowed per interaction check`);
    }

    // Validate each drug ID
    const invalidIds = drugIds.filter(
      id => typeof id !== 'string' || id.trim() === ''
    );

    if (invalidIds.length > 0) {
      throw new ValidationError('All drug IDs must be non-empty strings');
    }

    next();
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(defaultLimit: number = 20, maxLimit: number = 100) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { limit, offset } = req.query;

    // Parse and validate limit
    let parsedLimit = defaultLimit;
    if (limit !== undefined) {
      parsedLimit = parseInt(limit as string, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        throw new ValidationError('limit must be a positive integer');
      }
      if (parsedLimit > maxLimit) {
        parsedLimit = maxLimit;
      }
    }

    // Parse and validate offset
    let parsedOffset = 0;
    if (offset !== undefined) {
      parsedOffset = parseInt(offset as string, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        throw new ValidationError('offset must be a non-negative integer');
      }
    }

    req.query = {
      ...req.query,
      limit: parsedLimit.toString(),
      offset: parsedOffset.toString(),
    } as any;

    next();
  };
}

/**
 * Validate date range parameters
 */
export function validateDateRange(
  startDateField: string = 'startDate',
  endDateField: string = 'endDate'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startDate = req.query[startDateField] as string;
    const endDate = req.query[endDateField] as string;

    if (startDate) {
      const parsed = new Date(startDate);
      if (isNaN(parsed.getTime())) {
        throw new ValidationError(`${startDateField} must be a valid date`);
      }
    }

    if (endDate) {
      const parsed = new Date(endDate);
      if (isNaN(parsed.getTime())) {
        throw new ValidationError(`${endDateField} must be a valid date`);
      }
    }

    // Validate that start is before end
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        throw new ValidationError(`${startDateField} must be before ${endDateField}`);
      }
    }

    next();
  };
}

/**
 * Create a combined validation middleware
 */
export function validate(validations: Array<{
  source: 'body' | 'query' | 'params';
  schema: ZodSchema<any>;
}>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    for (const validation of validations) {
      const data = req[validation.source];
      const result = validation.schema.safeParse(data);

      if (!result.success) {
        logger.warn(`${validation.source} validation failed`, {
          path: req.path,
          errors: result.error.errors,
        });

        throw new ValidationError(
          `Invalid ${validation.source}`,
          result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        );
      }

      req[validation.source] = result.data;
    }

    next();
  };
}
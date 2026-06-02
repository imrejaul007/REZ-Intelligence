import { z, ZodSchema, ZodError, ZodObject, ZodTypeAny } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { sanitizeHtml, escapeSql, validateAndSanitize, isSqlInjectionPattern } from './sanitization';

// Field type definitions for schema building
export type FieldType = 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'object' | 'array';

export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  sanitize?: boolean;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
  message?: string;
}

export interface SchemaDefinition {
  body?: Record<string, FieldDefinition>;
  query?: Record<string, FieldDefinition>;
  params?: Record<string, FieldDefinition>;
  headers?: Record<string, FieldDefinition>;
}

export interface ValidationSchema {
  body?: Record<string, FieldDefinition>;
  query?: Record<string, FieldDefinition>;
  params?: Record<string, FieldDefinition>;
  headers?: Record<string, FieldDefinition>;
}

// Convert field definition to Zod schema
function fieldToZod(name: string, field: FieldDefinition): ZodTypeAny {
  let schema: ZodTypeAny;
  let errorMessage = field.message;

  const baseMessage = (msg: string) => errorMessage || msg;

  switch (field.type) {
    case 'string':
    case 'email':
    case 'url':
      schema = z.string({
        required_error: baseMessage(`${name} is required`),
        invalid_type_error: baseMessage(`${name} must be a string`)
      });

      if (field.minLength !== undefined) {
        schema = (schema as z.ZodString).min(field.minLength, baseMessage(`${name} must be at least ${field.minLength} characters`));
      }
      if (field.maxLength !== undefined) {
        schema = (schema as z.ZodString).max(field.maxLength, baseMessage(`${name} must be at most ${field.maxLength} characters`));
      }
      if (field.pattern) {
        schema = (schema as z.ZodString).regex(field.pattern, baseMessage(`${name} format is invalid`));
      }
      if (field.type === 'email') {
        schema = (schema as z.ZodString).email(baseMessage(`${name} must be a valid email`));
      }
      if (field.type === 'url') {
        schema = (schema as z.ZodString).url(baseMessage(`${name} must be a valid URL`));
      }
      break;

    case 'number':
    case 'uuid':
      schema = z.number({
        required_error: baseMessage(`${name} is required`),
        invalid_type_error: baseMessage(`${name} must be a number`)
      });

      if (field.type === 'uuid') {
        // Override for UUID which is a string format
        schema = z.string().uuid(baseMessage(`${name} must be a valid UUID`));
      } else {
        if (field.min !== undefined) {
          schema = (schema as z.ZodNumber).min(field.min, baseMessage(`${name} must be at least ${field.min}`));
        }
        if (field.max !== undefined) {
          schema = (schema as z.ZodNumber).max(field.max, baseMessage(`${name} must be at most ${field.max}`));
        }
      }
      break;

    case 'boolean':
      schema = z.boolean({
        required_error: baseMessage(`${name} is required`),
        invalid_type_error: baseMessage(`${name} must be a boolean`)
      });
      break;

    case 'object':
      schema = z.record(z.unknown(), {
        required_error: baseMessage(`${name} is required`),
        invalid_type_error: baseMessage(`${name} must be an object`)
      });
      break;

    case 'array':
      schema = z.array(z.unknown(), {
        required_error: baseMessage(`${name} is required`),
        invalid_type_error: baseMessage(`${name} must be an array`)
      });
      if (field.minLength !== undefined) {
        schema = (schema as z.ZodArray<z.ZodTypeAny>).min(field.minLength, baseMessage(`${name} must have at least ${field.minLength} items`));
      }
      if (field.maxLength !== undefined) {
        schema = (schema as z.ZodArray<z.ZodTypeAny>).max(field.maxLength, baseMessage(`${name} must have at most ${field.maxLength} items`));
      }
      break;

    default:
      schema = z.unknown();
  }

  if (field.enum && field.enum.length > 0) {
    schema = schema.refine(
      (val) => field.enum!.includes(val),
      { message: baseMessage(`${name} must be one of: ${field.enum!.join(', ')}`) }
    );
  }

  if (field.custom) {
    const customFn = field.custom;
    if (typeof customFn === 'function') {
      schema = schema.refine(
        (val) => {
          const result = customFn(val);
          return typeof result === 'boolean' ? result : true;
        },
        { message: typeof field.custom === 'function' && typeof field.custom('test') === 'string' ? field.custom('test') as string : baseMessage(`${name} validation failed`) }
      );
    }
  }

  return schema;
}

// Convert full schema definition to Zod object schema
function definitionToZod(definition: Record<string, FieldDefinition>): ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};

  for (const [name, field] of Object.entries(definition)) {
    const fieldSchema = fieldToZod(name, field);

    if (!field.required) {
      shape[name] = fieldSchema.optional();
    } else {
      shape[name] = fieldSchema;
    }
  }

  return z.object(shape);
}

// Convert ValidationSchema to Zod schemas
export function buildZodSchemas(schema: ValidationSchema): {
  body?: ZodObject<Record<string, ZodTypeAny>>;
  query?: ZodObject<Record<string, ZodTypeAny>>;
  params?: ZodObject<Record<string, ZodTypeAny>>;
  headers?: ZodObject<Record<string, ZodTypeAny>>;
} {
  const result: ReturnType<typeof buildZodSchemas> = {};

  if (schema.body) {
    result.body = definitionToZod(schema.body);
  }
  if (schema.query) {
    result.query = definitionToZod(schema.query);
  }
  if (schema.params) {
    result.params = definitionToZod(schema.params);
  }
  if (schema.headers) {
    result.headers = definitionToZod(schema.headers);
  }

  return result;
}

// Format Zod error messages
export function formatZodErrors(error: ZodError): { field: string; message: string }[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }));
}

// XSS attack patterns
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /<meta/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /data:/gi,
];

// Detect potential XSS
export function detectXSS(input: unknown): boolean {
  if (typeof input !== 'string') return false;

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) return true;
  }

  // Check for HTML entities encoding evasion
  const htmlEntityPattern = /&#[x]?[0-9]+;/gi;
  if (htmlEntityPattern.test(input)) return true;

  return false;
}

// SQL injection detection
const SQL_KEYWORDS = [
  'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate',
  'exec', 'execute', 'union', 'where', 'from', 'table', 'database', 'schema',
  'grant', 'revoke', 'commit', 'rollback', 'shutdown', 'xp_', 'sp_', 'waitfor',
  'delay', 'benchmark', 'sleep', 'load_file', 'outfile', 'dumpfile'
];

export function detectSQLInjection(input: unknown): boolean {
  if (typeof input !== 'string') return false;

  const lowerInput = input.toLowerCase();

  // Check for SQL keywords with word boundaries
  for (const keyword of SQL_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'gi');
    if (pattern.test(lowerInput)) return true;
  }

  // Check for common SQL injection patterns
  const patterns = [
    /['"']\s*(or|and)\s*['"']?\s*[0-9]/gi,
    /['"']\s*(or|and)\s*['"']?\s*[a-z]/gi,
    /;\s*(drop|insert|update|delete)/gi,
    /--$/gm,
    /\/\*/g,
    /\*\//g,
    /union\s+(all\s+)?select/gi,
    /'\s*=\s*'/g,
    /'\s+or\s+'1'\s*=\s*'1/gi
  ];

  for (const pattern of patterns) {
    if (pattern.test(input)) return true;
  }

  return false;
}

// Main validation middleware
export function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
  schema: ValidationSchema
): void {
  try {
    const zodSchemas = buildZodSchemas(schema);
    const errors: { location: string; field: string; message: string }[] = [];

    // Validate body
    if (zodSchemas.body && req.body) {
      const result = zodSchemas.body.safeParse(req.body);
      if (!result.success) {
        for (const err of formatZodErrors(result.error)) {
          errors.push({ location: 'body', ...err });
        }
      } else {
        req.body = result.data;
      }
    }

    // Validate query
    if (zodSchemas.query && Object.keys(req.query).length > 0) {
      const result = zodSchemas.query.safeParse(req.query);
      if (!result.success) {
        for (const err of formatZodErrors(result.error)) {
          errors.push({ location: 'query', ...err });
        }
      } else {
        req.query = result.data;
      }
    }

    // Validate params
    if (zodSchemas.params && req.params) {
      const result = zodSchemas.params.safeParse(req.params);
      if (!result.success) {
        for (const err of formatZodErrors(result.error)) {
          errors.push({ location: 'params', ...err });
        }
      } else {
        req.params = result.data;
      }
    }

    // Validate headers (excluding standard headers)
    if (zodSchemas.headers && req.headers) {
      const customHeaders: Record<string, string> = {};
      const standardHeaders = ['host', 'user-agent', 'accept', 'content-type', 'content-length', 'authorization', 'cookie', 'origin', 'referer'];

      for (const [key, value] of Object.entries(req.headers)) {
        if (!standardHeaders.includes(key.toLowerCase()) && value) {
          customHeaders[key] = Array.isArray(value) ? value[0] : value;
        }
      }

      if (Object.keys(customHeaders).length > 0) {
        const result = zodSchemas.headers.safeParse(customHeaders);
        if (!result.success) {
          for (const err of formatZodErrors(result.error)) {
            errors.push({ location: 'headers', ...err });
          }
        }
      }
    }

    // Check for security threats
    const securityChecks = checkSecurityThreats(req.body, req.query);

    if (errors.length > 0 || securityChecks.length > 0) {
      const allErrors = [
        ...errors.map(e => `${e.location}.${e.field}: ${e.message}`),
        ...securityChecks
      ];

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: {
          validation: errors,
          security: securityChecks.length > 0 ? securityChecks : undefined
        }
      });
      return;
    }

    // Sanitize if requested
    if (schema.body) {
      req.body = sanitizeInput(req.body, schema);
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation processing error'
    });
  }
}

// Security threat checking
function checkSecurityThreats(
  body: unknown,
  query: unknown
): string[] {
  const threats: string[] = [];

  function checkObject(obj: unknown, path: string): void {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'string') {
      if (detectXSS(obj)) {
        threats.push(`XSS detected in ${path}`);
      }
      if (detectSQLInjection(obj)) {
        threats.push(`SQL injection pattern detected in ${path}`);
      }
      if (isSqlInjectionPattern(obj)) {
        threats.push(`Potential SQL injection in ${path}`);
      }
      return;
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        checkObject(value, `${path}.${key}`);
      }
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        checkObject(item, `${path}[${index}]`);
      });
    }
  }

  if (body) checkObject(body, 'body');
  if (query) checkObject(query, 'query');

  return threats;
}

// Sanitize input based on schema
export function sanitizeInput(data: unknown, schema: ValidationSchema): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Sanitize HTML and escape SQL
    let sanitized = sanitizeHtml(data);
    sanitized = escapeSql(sanitized);
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item, schema));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Determine if this field should be sanitized
      const shouldSanitize =
        (schema.body?.[key]?.sanitize === true) ||
        (schema.query?.[key]?.sanitize === true);

      if (shouldSanitize && typeof value === 'string') {
        result[key] = validateAndSanitize(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeInput(value, schema);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}

// Request size limit middleware
export function RequestSizeLimit(maxBytes: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxBytes) {
      res.status(413).json({
        success: false,
        error: `Request size exceeds limit of ${maxBytes} bytes`
      });
      return;
    }

    next();
  };
}

// API key validation middleware
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  // In production, validate against a database or environment variable
  const validApiKey = process.env.VALIDATION_API_KEY || 'dev-api-key';

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required'
    });
    return;
  }

  if (apiKey !== validApiKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
    return;
  }

  next();
}

// Create endpoint-specific rate limiter
export function createEndpointRateLimiter(maxRequests: number, windowMs: string): RequestHandler {
  const limiter = rateLimit({
    windowMs: parseWindowMs(windowMs),
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests for this endpoint'
    }
  });

  return limiter;
}

// Parse window string to milliseconds
function parseWindowMs(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 60000; // Default 1 minute

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}

// Error handler for validation errors
export function validationErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Validation error handler:', err);

  if (err instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: 'Schema validation failed',
      details: formatZodErrors(err)
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal validation error'
  });
}

// Import rate-limit for the rate limiter function
import rateLimit from 'express-rate-limit';

/**
 * REZ Care Service - Error Handling & Validation
 *
 * Central error handling, validation, and fallback responses
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// ============================================
// ERROR CLASSES
// ============================================

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  errors: Record<string, string>;

  constructor(message: string, errors: Record<string, string> = {}) {
    super(message, 400);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ServiceUnavailableError extends AppError {
  service: string;

  constructor(service: string) {
    super(`${service} is currently unavailable`, 503);
    this.service = service;
  }
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const schemas = {
  createTicket: {
    subject: { type: 'string', required: true, minLength: 3, maxLength: 200 },
    category: { type: 'string', required: true, enum: ['payment', 'order', 'account', 'technical', 'delivery', 'refund', 'other'] },
    message: { type: 'string', required: true, minLength: 10, maxLength: 5000 },
    customerId: { type: 'string', required: false },
    priority: { type: 'string', required: false, enum: ['low', 'medium', 'high', 'urgent'] },
    platform: { type: 'string', required: false },
  },
  createFAQ: {
    question: { type: 'string', required: true, minLength: 10, maxLength: 500 },
    answer: { type: 'string', required: true, minLength: 10, maxLength: 5000 },
    category: { type: 'string', required: true },
    language: { type: 'string', required: false, default: 'en' },
  },
  emailSubmit: {
    from: { type: 'string', required: true, pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    to: { type: 'string', required: true },
    subject: { type: 'string', required: true },
    body: { type: 'string', required: true, minLength: 5 },
  },
  chatMessage: {
    message: { type: 'string', required: true, minLength: 1, maxLength: 2000 },
    context: { type: 'object', required: false },
  },
};

// ============================================
// VALIDATION FUNCTION
// ============================================

export function validate(schema: Record<string, any>, data: any): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required check
    if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[field] = `${field} is required`;
      continue;
    }

    // Skip further validation if not required and not provided
    if (!value && !rules.required) continue;

    // Type check
    if (typeof value !== rules.type && typeof value !== 'undefined') {
      errors[field] = `${field} must be a ${rules.type}`;
      continue;
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors[field] = `${field} must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors[field] = `${field} must be at most ${rules.maxLength} characters`;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors[field] = `${field} has invalid format`;
      }
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors[field] = `${field} must be one of: ${rules.enum.join(', ')}`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error('[Error]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err instanceof ValidationError && { errors: err.errors }),
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: err.message,
    });
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
    });
  }

  // Default server error
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// ============================================
// NOT FOUND HANDLER
// ============================================

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

// ============================================
// ASYNC HANDLER
// ============================================

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// SERVICE FALLBACK HANDLERS
// ============================================

export function withServiceFallback(
  serviceName: string,
  fallback: any,
  operation: () => Promise<any>
): Promise<any> {
  return operation().catch((error) => {
    logger.warn(`[Fallback] ${serviceName} unavailable, using fallback`, error.message);
    return fallback;
  });
}

// Fallback sentiment analysis
export function fallbackSentiment(message: string) {
  const lower = message.toLowerCase();

  let sentiment = 'neutral';
  let score = 0.5;

  if (/terrible|worst|hate|awful/.test(lower)) {
    sentiment = 'critical_negative';
    score = 0.1;
  } else if (/angry|frustrated|unacceptable/.test(lower)) {
    sentiment = 'negative';
    score = 0.3;
  } else if (/thank|great|love|amazing/.test(lower)) {
    sentiment = 'positive';
    score = 0.8;
  } else if (/help|issue|problem|failed/.test(lower)) {
    sentiment = 'negative';
    score = 0.4;
  }

  return {
    sentiment,
    score,
    keywords: [],
    source: 'fallback',
  };
}

// Fallback AI response
export function fallbackAIResponse(message: string) {
  const lower = message.toLowerCase();

  // Simple keyword-based responses
  if (/cancel|refund|money back/.test(lower)) {
    return {
      response: "I understand you'd like a refund. Let me help you with that. Could you provide your order number?",
      suggestions: ["Check refund status", "Contact support"],
      escalate: false,
    };
  }

  if (/track|where is|delivery/.test(lower)) {
    return {
      response: "I can help track your order. Please share your order ID and I'll check the status.",
      suggestions: ["Track order", "Cancel order"],
      escalate: false,
    };
  }

  if (/payment|failed|transaction/.test(lower)) {
    return {
      response: "I see you're having payment issues. Let me help you resolve this.",
      suggestions: ["Retry payment", "Try different method"],
      escalate: false,
    };
  }

  // Default
  return {
    response: "Thank you for contacting us. A support agent will respond shortly. For urgent matters, please call our helpline.",
    suggestions: ["Browse FAQs", "Track order"],
    escalate: false,
  };
}

// Fallback intent detection
export function fallbackIntent(message: string) {
  const lower = message.toLowerCase();

  if (/cancel|stop|terminate/.test(lower)) return { intent: 'cancellation', category: 'order' };
  if (/refund|money back|return/.test(lower)) return { intent: 'refund', category: 'payment' };
  if (/track|delivery|shipping/.test(lower)) return { intent: 'delivery', category: 'delivery' };
  if (/payment|transaction|failed/.test(lower)) return { intent: 'payment_issue', category: 'payment' };
  if (/error|not working|bug/.test(lower)) return { intent: 'technical', category: 'technical' };

  return { intent: 'inquiry', category: 'other' };
}

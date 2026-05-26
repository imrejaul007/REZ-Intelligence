// @ts-nocheck
// Custom Error Classes for Universal User Graph Service

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT');
    this.details = details;
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
  }
}

// Error handler middleware
export function errorHandler(
  err: Error,
  req: import('express').Request,
  res: import('express').Response,
  _next: import('express').NextFunction
): void {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

// Async handler wrapper
export function asyncHandler<T>(
  fn: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<T>
): (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

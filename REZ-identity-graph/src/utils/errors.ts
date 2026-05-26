/**
 * Custom Error Classes for REZ Identity Graph
 */

// ============================================
// ERROR CLASSES
// ============================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string);
  constructor(message: string, id: string);
  constructor(messageOrResource: string, id?: string) {
    let message: string;
    if (id) {
      message = `${messageOrResource} with ID ${id} not found`;
    } else {
      message = messageOrResource;
    }
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'AUTH_REQUIRED', message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, 'ACCESS_DENIED', message);
    this.name = 'AuthorizationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: string) {
    super(503, 'SERVICE_UNAVAILABLE', `${service} is unavailable${details ? `: ${details}` : ''}`);
    this.name = 'ServiceUnavailableError';
  }
}

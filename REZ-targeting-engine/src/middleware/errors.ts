/**
 * Custom error class for 404 Not Found errors
 */
export class NotFoundError extends Error {
  public statusCode = 404;
  public code = 'NOT_FOUND';

  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * Custom error class for 400 Bad Request errors
 */
export class BadRequestError extends Error {
  public statusCode = 400;
  public code = 'BAD_REQUEST';

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/**
 * Custom error class for 401 Unauthorized errors
 */
export class UnauthorizedError extends Error {
  public statusCode = 401;
  public code = 'UNAUTHORIZED';

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Custom error class for 403 Forbidden errors
 */
export class ForbiddenError extends Error {
  public statusCode = 403;
  public code = 'FORBIDDEN';

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

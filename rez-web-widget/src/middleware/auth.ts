import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  serviceName?: string;
  isInternalService?: boolean;
}

/**
 * Parse internal service tokens from environment
 */
function getInternalTokens(): Record<string, string> {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
  try {
    return JSON.parse(tokensJson);
  } catch {
    console.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON, using empty map');
    return {};
  }
}

/**
 * Middleware to validate internal service authentication
 * Used for service-to-service communication
 */
function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const serviceToken = req.headers['x-internal-token'] as string | undefined;
  const serviceName = req.headers['x-service-name'] as string | undefined;

  // If no token provided, check if public endpoint
  if (!serviceToken) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'X-Internal-Token header is missing',
    });
    return;
  }

  // Validate token
  const tokens = getInternalTokens();
  const validToken = tokens[serviceName || ''] || Object.values(tokens)[0];

  if (!validToken || serviceToken !== validToken) {
    res.status(403).json({
      success: false,
      error: 'Invalid token',
      message: 'The provided authentication token is invalid',
    });
    return;
  }

  // Mark request as authenticated internal service
  req.serviceName = serviceName;
  req.isInternalService = true;

  next();
}

/**
 * Optional authentication middleware
 * Allows requests without token but validates if token is provided
 */
function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const serviceToken = req.headers['x-internal-token'] as string | undefined;
  const serviceName = req.headers['x-service-name'] as string | undefined;

  // If no token, continue without authentication
  if (!serviceToken) {
    next();
    return;
  }

  // Validate token if provided
  const tokens = getInternalTokens();
  const validToken = tokens[serviceName || ''] || Object.values(tokens)[0];

  if (!validToken || serviceToken !== validToken) {
    res.status(403).json({
      success: false,
      error: 'Invalid token',
      message: 'The provided authentication token is invalid',
    });
    return;
  }

  // Mark request as authenticated internal service
  req.serviceName = serviceName;
  req.isInternalService = true;

  next();
}

/**
 * CORS configuration helper for widget endpoints
 */
function getCorsOrigins(): string[] {
  const origins = process.env.CORS_ORIGINS;
  if (!origins) {
    return ['*'];
  }
  return origins.split(',').map((o) => o.trim());
}

/**
 * Validate origin for CORS
 */
function validateCorsOrigin(origin: string | null): boolean {
  const allowedOrigins = getCorsOrigins();

  // Allow all origins in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check against allowed list
  if (allowedOrigins.includes('*')) {
    return true;
  }

  if (!origin) {
    return true; // Allow non-CORS requests
  }

  return allowedOrigins.includes(origin);
}

export {
  authMiddleware,
  optionalAuthMiddleware,
  getCorsOrigins,
  validateCorsOrigin,
};

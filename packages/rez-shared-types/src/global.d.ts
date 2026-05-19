/**
 * Global Type Declarations for REZ-Intelligence
 *
 * Add type declarations here for:
 * - Express Request/Response extensions
 * - Environment variables
 * - Global constants
 */

// ============================================
// Express Extensions
// ============================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        sessionId?: string;
        channel?: string;
        role?: string;
      };
      service?: {
        serviceId: string;
        name: string;
      };
      requestId?: string;
    }
  }
}

// ============================================
// Environment Variables
// ============================================

declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    NODE_ENV: 'development' | 'production' | 'test';
    MONGODB_URI: string;
    REDIS_URL: string;
    INTERNAL_SERVICE_TOKEN: string;

    // RABTUL URLs
    RABTUL_AUTH_URL?: string;
    RABTUL_PAYMENT_URL?: string;
    RABTUL_WALLET_URL?: string;
    RABTUL_NOTIFICATIONS_URL?: string;

    // Service-specific
    JWT_SECRET?: string;
    REDIS_PASSWORD?: string;
    SENTRY_DSN?: string;
  }
}

// ============================================
// Common Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptime?: number;
  dependencies?: Record<string, 'up' | 'down'>;
}

// ============================================
// Error Types
// ============================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ============================================
// Database Types
// ============================================

export interface BaseDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ============================================
// Service Types
// ============================================

export interface ServiceConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

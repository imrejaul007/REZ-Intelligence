/**
 * Standardized API error handling for all REZ services.
 *
 * Standard Response Format:
 * - Success: { "success": true, "data": {...} }
 * - Error: { "success": false, "error": { "code": "AUTH_001", "message": "...", "details": {...} } }
 *
 * Error Code Prefixes:
 * - AUTH_: Authentication errors
 * - VAL_: Validation errors
 * - BIZ_: Business logic errors
 * - FIN_: Financial errors
 * - PAY_: Payment errors
 * - SRV_: Server errors
 */

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse['error'] {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

/**
 * Standard error response helper for Express responses.
 */
export function errorResponse(res: import('express').Response, error: AppError | Error): import('express').Response {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.toJSON(),
    });
  }

  // Unknown errors default to server error
  return res.status(500).json({
    success: false,
    error: {
      code: 'SRV_001',
      message: 'Internal server error',
    },
  });
}

/**
 * Create a standardized success response.
 */
export function successResponse<T>(res: import('express').Response, data: T, statusCode = 200): import('express').Response {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

// ============================================================================
// Error Code Constants
// ============================================================================

export const ERROR_CODES = {
  // Auth errors (AUTH_xxx)
  AUTH_TOKEN_MISSING: 'AUTH_001',
  AUTH_TOKEN_INVALID: 'AUTH_002',
  AUTH_TOKEN_EXPIRED: 'AUTH_003',
  AUTH_ACCOUNT_LOCKED: 'AUTH_004',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_005',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_006',
  AUTH_SERVICE_UNAVAILABLE: 'AUTH_007',

  // Validation errors (VAL_xxx)
  VAL_INVALID_INPUT: 'VAL_001',
  VAL_MISSING_FIELD: 'VAL_002',
  VAL_VALIDATION_FAILED: 'VAL_003',

  // Business logic errors (BIZ_xxx)
  BIZ_NOT_FOUND: 'BIZ_001',
  BIZ_ALREADY_EXISTS: 'BIZ_002',
  BIZ_CONFLICT: 'BIZ_003',
  BIZ_FORBIDDEN: 'BIZ_004',

  // Financial errors (FIN_xxx)
  FIN_INSUFFICIENT_BALANCE: 'FIN_001',
  FIN_TRANSACTION_FAILED: 'FIN_002',
  FIN_WITHDRAWAL_LIMIT_EXCEEDED: 'FIN_003',

  // Payment errors (PAY_xxx)
  PAY_FAILED: 'PAY_001',
  PAY_SIGNATURE_INVALID: 'PAY_002',
  PAY_AMOUNT_MISMATCH: 'PAY_003',
  PAY_WALLET_TOPUP_LIMIT: 'PAY_004',
  PAY_BNPL_NOT_ELIGIBLE: 'PAY_005',
  PAY_REFUND_FAILED: 'PAY_006',

  // Server errors (SRV_xxx)
  SRV_INTERNAL_ERROR: 'SRV_001',
  SRV_TIMEOUT: 'SRV_002',
  SRV_SERVICE_UNAVAILABLE: 'SRV_003',
  SRV_MAINTENANCE: 'SRV_004',
  SRV_RATE_LIMITED: 'SRV_005',

  // Rate limiting (RLT_xxx) - distinct from SRV_
  RLT_TOO_MANY_REQUESTS: 'RLT_001',
  RLT_IP_NOT_ALLOWED: 'RLT_002',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Map error codes to default HTTP status codes */
export const ERROR_STATUS_MAP: Record<string, number> = {
  // Auth
  AUTH_001: 401,
  AUTH_002: 401,
  AUTH_003: 401,
  AUTH_004: 423,
  AUTH_005: 403,
  AUTH_006: 403,
  AUTH_007: 503,

  // Validation
  VAL_001: 400,
  VAL_002: 400,
  VAL_003: 400,

  // Business
  BIZ_001: 404,
  BIZ_002: 409,
  BIZ_003: 409,
  BIZ_004: 403,

  // Financial
  FIN_001: 402,
  FIN_002: 500,
  FIN_003: 400,

  // Payment
  PAY_001: 402,
  PAY_002: 400,
  PAY_003: 400,
  PAY_004: 400,
  PAY_005: 400,
  PAY_006: 500,

  // Server
  SRV_001: 500,
  SRV_002: 504,
  SRV_003: 503,
  SRV_004: 503,
  SRV_005: 429,

  // Rate limiting
  RLT_001: 429,
  RLT_002: 403,
};

// ============================================================================
// Factory Functions for Common Errors
// ============================================================================

export const errors = {
  // Auth errors
  authTokenMissing: (details?: unknown) => new AppError(ERROR_CODES.AUTH_TOKEN_MISSING, 'Missing authorization token', 401, details),
  authTokenInvalid: (details?: unknown) => new AppError(ERROR_CODES.AUTH_TOKEN_INVALID, 'Invalid token', 401, details),
  authTokenExpired: (details?: unknown) => new AppError(ERROR_CODES.AUTH_TOKEN_EXPIRED, 'Token has expired', 401, details),
  authAccountLocked: (details?: unknown) => new AppError(ERROR_CODES.AUTH_ACCOUNT_LOCKED, 'Account is locked', 423, details),
  authAccountSuspended: (details?: unknown) => new AppError(ERROR_CODES.AUTH_ACCOUNT_SUSPENDED, 'Account has been suspended', 403, details),
  authInsufficientPermissions: (details?: unknown) => new AppError(ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS, 'Insufficient permissions', 403, details),
  authServiceUnavailable: (details?: unknown) => new AppError(ERROR_CODES.AUTH_SERVICE_UNAVAILABLE, 'Authentication service unavailable', 503, details),

  // Validation errors
  invalidInput: (message: string, details?: unknown) => new AppError(ERROR_CODES.VAL_INVALID_INPUT, message, 400, details),
  missingField: (field: string, details?: unknown) => new AppError(ERROR_CODES.VAL_MISSING_FIELD, `${field} is required`, 400, details),
  validationFailed: (message: string, details?: unknown) => new AppError(ERROR_CODES.VAL_VALIDATION_FAILED, message, 400, details),

  // Business errors
  notFound: (resource: string, details?: unknown) => new AppError(ERROR_CODES.BIZ_NOT_FOUND, `${resource} not found`, 404, details),
  alreadyExists: (resource: string, details?: unknown) => new AppError(ERROR_CODES.BIZ_ALREADY_EXISTS, `${resource} already exists`, 409, details),
  conflict: (message: string, details?: unknown) => new AppError(ERROR_CODES.BIZ_CONFLICT, message, 409, details),
  forbidden: (message: string, details?: unknown) => new AppError(ERROR_CODES.BIZ_FORBIDDEN, message, 403, details),

  // Financial errors
  insufficientBalance: (details?: unknown) => new AppError(ERROR_CODES.FIN_INSUFFICIENT_BALANCE, 'Insufficient balance', 402, details),
  transactionFailed: (message: string, details?: unknown) => new AppError(ERROR_CODES.FIN_TRANSACTION_FAILED, message, 500, details),
  withdrawalLimitExceeded: (details?: unknown) => new AppError(ERROR_CODES.FIN_WITHDRAWAL_LIMIT_EXCEEDED, 'Withdrawal limit exceeded', 400, details),

  // Payment errors
  paymentFailed: (message: string, details?: unknown) => new AppError(ERROR_CODES.PAY_FAILED, message, 402, details),
  paymentSignatureInvalid: (details?: unknown) => new AppError(ERROR_CODES.PAY_SIGNATURE_INVALID, 'Invalid payment signature', 400, details),
  paymentAmountMismatch: (expected: number, actual: number) => new AppError(ERROR_CODES.PAY_AMOUNT_MISMATCH, `Amount mismatch: expected ${expected}, got ${actual}`, 400),
  walletTopupLimit: (max: number) => new AppError(ERROR_CODES.PAY_WALLET_TOPUP_LIMIT, `Wallet topup amount cannot exceed ${max}`, 400),
  bnplNotEligible: (reason?: string, details?: unknown) => new AppError(ERROR_CODES.PAY_BNPL_NOT_ELIGIBLE, reason || 'Not eligible for BNPL', 400, details),
  refundFailed: (message: string, details?: unknown) => new AppError(ERROR_CODES.PAY_REFUND_FAILED, message, 500, details),

  // Server errors
  internalError: (details?: unknown) => new AppError(ERROR_CODES.SRV_INTERNAL_ERROR, 'Internal server error', 500, details),
  timeout: (details?: unknown) => new AppError(ERROR_CODES.SRV_TIMEOUT, 'Request timed out', 504, details),
  serviceUnavailable: (service?: string, details?: unknown) => new AppError(ERROR_CODES.SRV_SERVICE_UNAVAILABLE, service ? `${service} service unavailable` : 'Service unavailable', 503, details),
  maintenance: (details?: unknown) => new AppError(ERROR_CODES.SRV_MAINTENANCE, 'Service under maintenance', 503, details),
  rateLimited: (retryAfter?: number) => new AppError(ERROR_CODES.SRV_RATE_LIMITED, 'Too many requests', 429, retryAfter ? { retryAfter } : undefined),

  // Rate limiting
  tooManyRequests: (message = 'Too many requests') => new AppError(ERROR_CODES.RLT_TOO_MANY_REQUESTS, message, 429),
  ipNotAllowed: (details?: unknown) => new AppError(ERROR_CODES.RLT_IP_NOT_ALLOWED, 'Caller IP not in allowlist', 403, details),
};

export default {
  AppError,
  errorResponse,
  successResponse,
  ERROR_CODES,
  ERROR_STATUS_MAP,
  errors,
};

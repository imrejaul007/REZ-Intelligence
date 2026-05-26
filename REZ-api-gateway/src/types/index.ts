/**
 * REZ Intelligence API Gateway Types
 */

// Re-export tenant types
export { ClientType, TenantContext } from '../middleware/tenantIsolation';
export { AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '../middleware/errorHandler';

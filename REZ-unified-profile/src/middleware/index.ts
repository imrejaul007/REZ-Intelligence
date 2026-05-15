// Middleware barrel export
export {
  internalAuth,
  corsMiddleware,
  requestLogger,
  rateLimitHeaders,
  errorHandler,
  notFoundHandler,
  default as authMiddleware
} from './auth.js';

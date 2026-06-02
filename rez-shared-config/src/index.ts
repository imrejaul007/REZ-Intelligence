/**
 * @rez/shared-config
 *
 * Shared configuration utilities for ReZ platform services.
 *
 * Modules:
 * - mongodb: MongoDB connection with authentication, retry, pooling
 * - redis: Redis connection utilities
 *
 * Usage:
 * ```typescript
 * import { connectMongoDB } from '@rez/shared-config/mongodb';
 * ```
 */

export * from './mongodb';
export { default as mongodb } from './mongodb';

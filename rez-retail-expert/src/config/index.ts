import { z } from 'zod';

// ============================================
// CONFIGURATION SCHEMAS
// ============================================

export const configSchema = z.object({
  port: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  nodeEnv: z.string().optional(),
  corsOrigins: z.string().optional().transform(val =>
    val ? val.split(',').map(s => s.trim()) : undefined
  ),
  rateLimitWindowMs: z.string().optional().transform(val =>
    val ? parseInt(val, 10) : undefined
  ),
  rateLimitMaxRequests: z.string().optional().transform(val =>
    val ? parseInt(val, 10) : undefined
  ),
  logLevel: z.string().optional()
});

export const serviceConfig = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim()),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  serviceName: 'rez-retail-expert',
  version: '1.0.0'
};

// Re-export knowledge for convenience
export * from './knowledge';
export * from './systemPrompt';

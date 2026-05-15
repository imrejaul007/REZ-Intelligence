/**
 * Zod validation schemas for REZ Identity Graph
 */

import { z } from 'zod';

/**
 * Valid app sources
 */
const APP_SOURCES = ['rez', 'wasil', 'habixo', 'karma', 'rtmn_finance', 'merchant_os', 'qr_system'] as const;

/**
 * Valid identity types
 */
const IDENTITY_TYPES = ['phone', 'email', 'device_fingerprint', 'device_id', 'wallet_id', 'user_id', 'bank_account', 'upi'] as const;

/**
 * Schema for identity resolution
 */
export const resolveIdentitySchema = z.object({
  source: z.enum(APP_SOURCES, { message: 'Invalid source' }),
  type: z.enum(IDENTITY_TYPES, { message: 'Invalid type' }),
  value: z.string().min(1, 'Value is required').max(500),
  profile: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional()
  }).optional(),
  confidence: z.number().min(0).max(1).optional()
});

/**
 * Schema for linking identity
 */
export const linkIdentitySchema = z.object({
  source: z.enum(APP_SOURCES, { message: 'Invalid source' }),
  type: z.enum(IDENTITY_TYPES, { message: 'Invalid type' }),
  value: z.string().min(1, 'Value is required').max(500),
  confidence: z.number().min(0).max(1).default(0.8)
});

/**
 * Schema for merging identities
 */
export const mergeIdentitySchema = z.object({
  sourceId: z.string().min(1, 'Source ID is required')
});

/**
 * Schema for updating profile
 */
export const updateProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  kycStatus: z.enum(['none', 'pending', 'verified', 'rejected']).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional()
});

/**
 * Schema for updating stats
 */
export const updateStatsSchema = z.object({
  transactionAmount: z.number().min(0).optional(),
  activity: z.string().optional()
});

/**
 * Validation helper function
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  valid: true;
  data: T;
} | {
  valid: false;
  errors: Array<{ field: string; message: string }>;
} {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
}

// Type exports
export type ResolveIdentityInput = z.infer<typeof resolveIdentitySchema>;
export type LinkIdentityInput = z.infer<typeof linkIdentitySchema>;
export type MergeIdentityInput = z.infer<typeof mergeIdentitySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateStatsInput = z.infer<typeof updateStatsSchema>;

// Re-export constants
export { APP_SOURCES, IDENTITY_TYPES };

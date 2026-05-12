import { z } from 'zod';

// Universal User Schema
export const UniversalUserSchema = z.object({
  id: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  apps: z.array(z.object({
    appId: z.enum(['consumer', 'merchant', 'hotel', 'do-app', 'adbazaar', 'rendez']),
    userId: z.string(),
    linkedAt: z.string().datetime().optional(),
    confidence: z.number().min(0).max(1).optional(),
  })).optional(),
  profile: z.object({
    name: z.object({
      first: z.string().optional(),
      last: z.string().optional(),
      display: z.string().optional(),
    }).optional(),
    avatar: z.string().url().nullable().optional(),
    segments: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    preferences: z.record(z.any()).optional(),
  }).optional(),
  behavioral: z.object({
    frequency: z.object({
      daily: z.number().optional(),
      weekly: z.number().optional(),
      monthly: z.number().optional(),
    }).optional(),
    preferences: z.record(z.any()).optional(),
    patterns: z.object({
      peakHours: z.array(z.number()).optional(),
      preferredCategories: z.array(z.string()).optional(),
      avgSessionDuration: z.number().optional(),
      deviceTypes: z.array(z.string()).optional(),
    }).optional(),
    engagementScore: z.number().min(0).max(100).optional(),
  }).optional(),
  financial: z.object({
    walletBalance: z.number().optional(),
    creditScore: z.number().min(300).max(850).optional(),
    riskTier: z.enum(['low', 'medium', 'high', 'premium']).optional(),
    totalSpent: z.number().optional(),
    totalOrders: z.number().optional(),
  }).optional(),
  lifetime: z.object({
    LTV: z.number().optional(),
    churnRisk: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    engagementScore: z.number().min(0).max(100).optional(),
    firstSeen: z.string().datetime().optional(),
    lastSeen: z.string().datetime().optional(),
    daysActive: z.number().optional(),
  }).optional(),
  connections: z.array(z.object({
    targetUserId: z.string(),
    type: z.enum(['family', 'friend', 'colleague', 'shared-device', 'shared-network']),
    strength: z.number().min(0).max(1),
  })).optional(),
  metadata: z.record(z.any()).optional(),
});

// User Link Schema
export const UserLinkSchema = z.object({
  appId: z.enum(['consumer', 'merchant', 'hotel', 'do-app', 'adbazaar', 'rendez']),
  userId: z.string(),
  identityToken: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Identity Query Schema
export const IdentityQuerySchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  deviceId: z.string().optional(),
  intentUserId: z.string().optional(),
  consumerUserId: z.string().optional(),
  walletUserId: z.string().optional(),
});

// Validation functions
export function validateUniversalUserSchema(data) {
  return UniversalUserSchema.parse(data);
}

export function validateUserLinkSchema(data) {
  return UserLinkSchema.parse(data);
}

export function validateIdentityQuerySchema(data) {
  return IdentityQuerySchema.parse(data);
}

// Custom validation error class
export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

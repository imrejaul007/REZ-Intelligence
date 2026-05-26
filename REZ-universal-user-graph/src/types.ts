// @ts-nocheck
import { z } from 'zod';

// ============================================================
// ENUMS
// ============================================================

export enum AppId {
  CONSUMER = 'consumer',
  MERCHANT = 'merchant',
  HOTEL = 'hotel',
  DO_APP = 'do-app',
  ADBAZAAR = 'adbazaar',
  RENDEZ = 'rendez',
}

export enum ChurnRisk {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskTier {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  PREMIUM = 'premium',
}

export enum ConnectionType {
  FAMILY = 'family',
  FRIEND = 'friend',
  COLLEAGUE = 'colleague',
  SHARED_DEVICE = 'shared-device',
  SHARED_NETWORK = 'shared-network',
}

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const NameSchema = z.object({
  first: z.string().optional(),
  last: z.string().optional(),
  display: z.string().optional(),
});

export const AppLinkSchema = z.object({
  appId: z.nativeEnum(AppId),
  userId: z.string(),
  linkedAt: z.string().datetime().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ProfileSchema = z.object({
  name: NameSchema.optional(),
  avatar: z.string().url().nullable().optional(),
  segments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  preferences: z.record(z.unknown()).optional(),
});

export const FrequencySchema = z.object({
  daily: z.number().optional(),
  weekly: z.number().optional(),
  monthly: z.number().optional(),
});

export const PatternsSchema = z.object({
  peakHours: z.array(z.number()).optional(),
  preferredCategories: z.array(z.string()).optional(),
  avgSessionDuration: z.number().optional(),
  deviceTypes: z.array(z.string()).optional(),
});

export const BehavioralSchema = z.object({
  frequency: FrequencySchema.optional(),
  preferences: z.record(z.unknown()).optional(),
  patterns: PatternsSchema.optional(),
  engagementScore: z.number().min(0).max(100).optional(),
});

export const FinancialSchema = z.object({
  walletBalance: z.number().optional(),
  creditScore: z.number().min(300).max(850).optional(),
  riskTier: z.nativeEnum(RiskTier).optional(),
  totalSpent: z.number().optional(),
  totalOrders: z.number().optional(),
});

export const LifetimeSchema = z.object({
  LTV: z.number().optional(),
  churnRisk: z.nativeEnum(ChurnRisk).optional(),
  engagementScore: z.number().min(0).max(100).optional(),
  firstSeen: z.string().datetime().optional(),
  lastSeen: z.string().datetime().optional(),
  daysActive: z.number().optional(),
});

export const ConnectionSchema = z.object({
  targetUserId: z.string(),
  type: z.nativeEnum(ConnectionType),
  strength: z.number().min(0).max(1),
});

export const UniversalUserSchema = z.object({
  id: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  apps: z.array(AppLinkSchema).optional(),
  profile: ProfileSchema.optional(),
  behavioral: BehavioralSchema.optional(),
  financial: FinancialSchema.optional(),
  lifetime: LifetimeSchema.optional(),
  connections: z.array(ConnectionSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const UserLinkSchema = z.object({
  appId: z.nativeEnum(AppId),
  userId: z.string(),
  identityToken: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const IdentityQuerySchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  deviceId: z.string().optional(),
  intentUserId: z.string().optional(),
  consumerUserId: z.string().optional(),
  walletUserId: z.string().optional(),
});

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type Name = z.infer<typeof NameSchema>;
export type AppLink = z.infer<typeof AppLinkSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Frequency = z.infer<typeof FrequencySchema>;
export type Patterns = z.infer<typeof PatternsSchema>;
export type Behavioral = z.infer<typeof BehavioralSchema>;
export type Financial = z.infer<typeof FinancialSchema>;
export type Lifetime = z.infer<typeof LifetimeSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type UniversalUser = z.infer<typeof UniversalUserSchema>;
export type UserLink = z.infer<typeof UserLinkSchema>;
export type IdentityQuery = z.infer<typeof IdentityQuerySchema>;

// Extended types with enrichment data
export interface EnrichedUser extends UniversalUser {
  intentGraph?: unknown;
  consumerGraph?: unknown;
  wallet?: unknown;
  supportHistory?: unknown;
}

// Identity resolution types
export interface IdentityCandidate {
  userId: string;
  source: string;
  matchType: string;
  confidence: number;
  data?: unknown;
}

export interface IdentityResolutionResult {
  resolved: boolean;
  confidence: number;
  candidates: IdentityCandidate[];
  primary: IdentityCandidate | null;
  suggestedAction?: 'CREATE_NEW';
}

export interface MergeConflict {
  type: string;
  source?: string;
  target?: string;
  resolution?: string;
  apps?: string[];
}

export interface SyncResult {
  source: string;
  synced: boolean;
  userId: string;
  changes: string[];
  newUser?: boolean;
  user?: UniversalUser;
}

// Graph types
export interface GraphStats {
  totalUsers: number;
  usersWithPhone: number;
  usersWithEmail: number;
  appDistribution: Record<string, number>;
  churnDistribution: Record<string, number>;
  segmentStats: Array<{ _id: string; count: number }>;
  timestamp: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface SearchUsersResult {
  data: UniversalUser[];
  pagination: Pagination;
}

export interface UserConnections {
  targetUserId: string;
  type: ConnectionType;
  strength: number;
  user?: {
    id: string;
    phone?: string;
    profile?: Profile;
  };
}

// API Request/Response Types
export interface CreateUserRequest extends UniversalUser {}
export interface UpdateProfileRequest extends Partial<Profile> {}
export interface UpdateBehavioralRequest extends Partial<Behavioral> {}
export interface UpdateLTVRequest extends Partial<Lifetime> {}
export interface MergeUsersRequest {
  sourceUserId: string;
  targetUserId: string;
  reason?: string;
}
export interface SyncFromSourceRequest {
  userId?: string;
  data?: {
    phone?: string;
    email?: string;
    name?: string;
    avatar?: string;
    segments?: string[];
    appId?: string;
    userId?: string;
    behavioral?: Partial<Behavioral>;
    lifetime?: Partial<Lifetime>;
  };
}

// Validation functions
export function validateUniversalUserSchema(data: unknown): UniversalUser {
  return UniversalUserSchema.parse(data);
}

export function validateUserLinkSchema(data: unknown): UserLink {
  return UserLinkSchema.parse(data);
}

export function validateIdentityQuerySchema(data: unknown): IdentityQuery {
  return IdentityQuerySchema.parse(data);
}

// Custom validation error class
export class ValidationError extends Error {
  constructor(public errors: z.ZodError) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

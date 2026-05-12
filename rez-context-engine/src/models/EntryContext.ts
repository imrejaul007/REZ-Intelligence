import { z } from 'zod';

/**
 * Entry point types for user interactions
 */
export enum EntryPointType {
  QR_CODE = 'QR_CODE',
  VOICE = 'VOICE',
  TEXT = 'TEXT',
  APP = 'APP',
  WEB = 'WEB',
  API = 'API',
  DEEP_LINK = 'DEEP_LINK',
  NOTIFICATION = 'NOTIFICATION',
  UNKNOWN = 'UNKNOWN',
}

/**
 * QR code prefixes that indicate specific verticals
 */
export enum QRCodeType {
  HOTEL = 'QR_HOTEL',
  RESTAURANT = 'QR_RESTAURANT',
  GYM = 'QR_GYM',
  CLINIC = 'QR_CLINIC',
  RETAIL = 'QR_RETAIL',
  SALON = 'QR_SALON',
  GENERAL = 'QR_GENERAL',
}

/**
 * ReZ platform entry points
 */
export enum ReZPlatform {
  WEB_MENU = 'REZ_WEB_MENU',
  STAY = 'REZ_STAY',
  FIT = 'REZ_FIT',
  HEALTH = 'REZ_HEALTH',
  GENERAL = 'REZ_GENERAL',
}

/**
 * Merchant category classification
 */
export enum MerchantCategory {
  HOSPITALITY = 'HOSPITALITY',
  CULINARY = 'CULINARY',
  FITNESS = 'FITNESS',
  HEALTH = 'HEALTH',
  RETAIL = 'RETAIL',
  SALON = 'SALON',
  ENTERTAINMENT = 'ENTERTAINMENT',
  TRAVEL = 'TRAVEL',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Schema for entry context input validation
 */
export const EntryContextInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  userId: z.string().optional(),
  entryType: z.nativeEnum(EntryPointType).optional(),
  qrCode: z.string().optional(),
  merchantId: z.string().optional(),
  merchantName: z.string().optional(),
  merchantCategory: z.nativeEnum(MerchantCategory).optional(),
  platform: z.string().optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  location: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type EntryContextInput = z.infer<typeof EntryContextInputSchema>;

/**
 * Entry context structure that captures all information about how a user entered the system
 */
export interface EntryContext {
  id: string;
  sessionId: string;
  userId?: string;
  entryType: EntryPointType;
  qrCodeType?: QRCodeType;
  rePlatform?: ReZPlatform;
  merchantId?: string;
  merchantName?: string;
  merchantCategory: MerchantCategory;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  location?: {
    latitude?: number;
    longitude?: number;
    country?: string;
    city?: string;
  };
  detectedAt: Date;
  confidence: number;
  metadata: Record<string, unknown>;
}

/**
 * Create default entry context
 */
export function createDefaultEntryContext(sessionId: string): EntryContext {
  return {
    id: '',
    sessionId,
    entryType: EntryPointType.UNKNOWN,
    merchantCategory: MerchantCategory.UNKNOWN,
    deviceType: 'unknown',
    detectedAt: new Date(),
    confidence: 0,
    metadata: {},
  };
}

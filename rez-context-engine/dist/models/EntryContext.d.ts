import { z } from 'zod';
/**
 * Entry point types for user interactions
 */
export declare enum EntryPointType {
    QR_CODE = "QR_CODE",
    VOICE = "VOICE",
    TEXT = "TEXT",
    APP = "APP",
    WEB = "WEB",
    API = "API",
    DEEP_LINK = "DEEP_LINK",
    NOTIFICATION = "NOTIFICATION",
    UNKNOWN = "UNKNOWN"
}
/**
 * QR code prefixes that indicate specific verticals
 */
export declare enum QRCodeType {
    HOTEL = "QR_HOTEL",
    RESTAURANT = "QR_RESTAURANT",
    GYM = "QR_GYM",
    CLINIC = "QR_CLINIC",
    RETAIL = "QR_RETAIL",
    SALON = "QR_SALON",
    GENERAL = "QR_GENERAL"
}
/**
 * ReZ platform entry points
 */
export declare enum ReZPlatform {
    WEB_MENU = "REZ_WEB_MENU",
    STAY = "REZ_STAY",
    FIT = "REZ_FIT",
    HEALTH = "REZ_HEALTH",
    GENERAL = "REZ_GENERAL"
}
/**
 * Merchant category classification
 */
export declare enum MerchantCategory {
    HOSPITALITY = "HOSPITALITY",
    CULINARY = "CULINARY",
    FITNESS = "FITNESS",
    HEALTH = "HEALTH",
    RETAIL = "RETAIL",
    SALON = "SALON",
    ENTERTAINMENT = "ENTERTAINMENT",
    TRAVEL = "TRAVEL",
    UNKNOWN = "UNKNOWN"
}
/**
 * Schema for entry context input validation
 */
export declare const EntryContextInputSchema: z.ZodObject<{
    sessionId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    entryType: z.ZodOptional<z.ZodNativeEnum<typeof EntryPointType>>;
    qrCode: z.ZodOptional<z.ZodString>;
    merchantId: z.ZodOptional<z.ZodString>;
    merchantName: z.ZodOptional<z.ZodString>;
    merchantCategory: z.ZodOptional<z.ZodNativeEnum<typeof MerchantCategory>>;
    platform: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodOptional<z.ZodEnum<["mobile", "tablet", "desktop", "unknown"]>>;
    userAgent: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodObject<{
        latitude: z.ZodOptional<z.ZodNumber>;
        longitude: z.ZodOptional<z.ZodNumber>;
        country: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        latitude?: number | undefined;
        longitude?: number | undefined;
        country?: string | undefined;
        city?: string | undefined;
    }, {
        latitude?: number | undefined;
        longitude?: number | undefined;
        country?: string | undefined;
        city?: string | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    sessionId?: string | undefined;
    userId?: string | undefined;
    entryType?: EntryPointType | undefined;
    qrCode?: string | undefined;
    merchantId?: string | undefined;
    merchantName?: string | undefined;
    merchantCategory?: MerchantCategory | undefined;
    platform?: string | undefined;
    deviceType?: "mobile" | "tablet" | "desktop" | "unknown" | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    location?: {
        latitude?: number | undefined;
        longitude?: number | undefined;
        country?: string | undefined;
        city?: string | undefined;
    } | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    sessionId?: string | undefined;
    userId?: string | undefined;
    entryType?: EntryPointType | undefined;
    qrCode?: string | undefined;
    merchantId?: string | undefined;
    merchantName?: string | undefined;
    merchantCategory?: MerchantCategory | undefined;
    platform?: string | undefined;
    deviceType?: "mobile" | "tablet" | "desktop" | "unknown" | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    location?: {
        latitude?: number | undefined;
        longitude?: number | undefined;
        country?: string | undefined;
        city?: string | undefined;
    } | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
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
export declare function createDefaultEntryContext(sessionId: string): EntryContext;
//# sourceMappingURL=EntryContext.d.ts.map
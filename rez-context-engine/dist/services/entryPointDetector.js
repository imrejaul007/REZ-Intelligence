"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entryPointDetector = exports.EntryPointDetector = void 0;
const uuid_1 = require("uuid");
const EntryContext_1 = require("../models/EntryContext");
const logger_1 = require("../utils/logger");
/**
 * QR code prefix patterns for vertical detection
 */
const QR_PREFIX_PATTERNS = {
    HOTEL: {
        type: EntryContext_1.QRCodeType.HOTEL,
        regex: /^(rez|h|hotel|stay|accommodation)/i,
    },
    RESTAURANT: {
        type: EntryContext_1.QRCodeType.RESTAURANT,
        regex: /^(rez|r|restaurant|food|dine|cafe|eat)/i,
    },
    GYM: {
        type: EntryContext_1.QRCodeType.GYM,
        regex: /^(rez|g|gym|fitness|workout|exercise)/i,
    },
    CLINIC: {
        type: EntryContext_1.QRCodeType.CLINIC,
        regex: /^(rez|c|clinic|health|medical|doctor)/i,
    },
    RETAIL: {
        type: EntryContext_1.QRCodeType.RETAIL,
        regex: /^(rez|ret|retail|shop|store)/i,
    },
    SALON: {
        type: EntryContext_1.QRCodeType.SALON,
        regex: /^(rez|s|salon|beauty|spa|hair)/i,
    },
};
/**
 * ReZ platform patterns
 */
const REZ_PLATFORM_PATTERNS = {
    WEB_MENU: {
        platform: EntryContext_1.ReZPlatform.WEB_MENU,
        regex: /rez\.com\/menu|web-menu|menu\.rez/i,
    },
    STAY: {
        platform: EntryContext_1.ReZPlatform.STAY,
        regex: /rez\.com\/stay|rez-stay|stay\.rez|hotel|accommodation/i,
    },
    FIT: {
        platform: EntryContext_1.ReZPlatform.FIT,
        regex: /rez\.com\/fit|rez-fit|fit\.rez|gym|fitness/i,
    },
    HEALTH: {
        platform: EntryContext_1.ReZPlatform.HEALTH,
        regex: /rez\.com\/health|rez-health|health\.rez|clinic|medical/i,
    },
};
/**
 * Device type detection from user agent
 */
const DEVICE_PATTERNS = {
    mobile: /mobile|android|iphone|ipad|ipod|android.*mobile/i,
    tablet: /tablet|ipad|playbook|silk/i,
    desktop: /windows|macintosh|linux|x11/i,
};
/**
 * Service for detecting entry point types from various input sources
 */
class EntryPointDetector {
    /**
     * Detect entry point from input context
     */
    async detect(input, sessionId) {
        const startTime = Date.now();
        try {
            const context = (0, EntryContext_1.createDefaultEntryContext)(sessionId);
            context.id = (0, uuid_1.v4)();
            context.sessionId = sessionId;
            // Apply input values
            if (input.userId)
                context.userId = input.userId;
            if (input.merchantId)
                context.merchantId = input.merchantId;
            if (input.merchantName)
                context.merchantName = input.merchantName;
            if (input.location)
                context.location = input.location;
            // Detect entry type and details
            const detection = await this.detectEntryPoint(input);
            context.entryType = detection.entryType;
            context.qrCodeType = detection.qrCodeType;
            context.rePlatform = detection.rePlatform;
            context.confidence = detection.confidence;
            context.metadata = { ...context.metadata, ...detection.metadata };
            // Detect device type
            context.deviceType = this.detectDeviceType(input.userAgent);
            // Apply merchant category from input if provided
            if (input.merchantCategory) {
                context.merchantCategory = input.merchantCategory;
            }
            context.detectedAt = new Date();
            const processingTime = Date.now() - startTime;
            logger_1.logger.debug('Entry point detection completed', {
                sessionId,
                entryType: context.entryType,
                qrCodeType: context.qrCodeType,
                processingTimeMs: processingTime,
            });
            return context;
        }
        catch (error) {
            logger_1.logger.error('Entry point detection failed', {
                sessionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    /**
     * Detect entry point details from input
     */
    async detectEntryPoint(input) {
        // Check for QR code first (highest priority)
        if (input.qrCode) {
            return this.detectFromQRCode(input.qrCode);
        }
        // Check for ReZ platform
        if (input.platform) {
            return this.detectFromPlatform(input.platform);
        }
        // Check for explicit entry type
        if (input.entryType) {
            return {
                entryType: input.entryType,
                confidence: 1.0,
                metadata: { source: 'explicit' },
            };
        }
        // Default to unknown with low confidence
        return {
            entryType: EntryContext_1.EntryPointType.UNKNOWN,
            confidence: 0.3,
            metadata: { source: 'default' },
        };
    }
    /**
     * Detect entry point from QR code
     */
    detectFromQRCode(qrCode) {
        const qrCodeLower = qrCode.toLowerCase().trim();
        // Check for ReZ-specific QR codes
        for (const [, pattern] of Object.values(QR_PREFIX_PATTERNS)) {
            if (pattern.regex.test(qrCodeLower)) {
                return {
                    entryType: EntryContext_1.EntryPointType.QR_CODE,
                    qrCodeType: pattern.type,
                    confidence: 0.95,
                    metadata: {
                        source: 'qr_code',
                        pattern: pattern.type,
                        raw: qrCode.substring(0, 100),
                    },
                };
            }
        }
        // Generic QR code
        return {
            entryType: EntryContext_1.EntryPointType.QR_CODE,
            qrCodeType: EntryContext_1.QRCodeType.GENERAL,
            confidence: 0.6,
            metadata: {
                source: 'qr_code',
                pattern: 'generic',
                raw: qrCode.substring(0, 100),
            },
        };
    }
    /**
     * Detect entry point from platform identifier
     */
    detectFromPlatform(platform) {
        const platformLower = platform.toLowerCase();
        for (const [, pattern] of Object.values(REZ_PLATFORM_PATTERNS)) {
            if (pattern.regex.test(platformLower)) {
                return {
                    entryType: EntryContext_1.EntryPointType.APP,
                    rePlatform: pattern.platform,
                    confidence: 0.9,
                    metadata: {
                        source: 'platform',
                        pattern: pattern.platform,
                        raw: platform,
                    },
                };
            }
        }
        // Generic app entry
        return {
            entryType: EntryContext_1.EntryPointType.APP,
            confidence: 0.5,
            metadata: {
                source: 'platform',
                pattern: 'unknown',
                raw: platform,
            },
        };
    }
    /**
     * Detect device type from user agent
     */
    detectDeviceType(userAgent) {
        if (!userAgent)
            return 'unknown';
        if (DEVICE_PATTERNS.mobile.test(userAgent)) {
            return 'mobile';
        }
        if (DEVICE_PATTERNS.tablet.test(userAgent)) {
            return 'tablet';
        }
        if (DEVICE_PATTERNS.desktop.test(userAgent)) {
            return 'desktop';
        }
        return 'unknown';
    }
    /**
     * Validate if a QR code is a valid ReZ QR code
     */
    isValidReZQRCode(qrCode) {
        const qrCodeLower = qrCode.toLowerCase();
        // Check if it matches any ReZ pattern
        for (const [, pattern] of Object.values(QR_PREFIX_PATTERNS)) {
            if (pattern.regex.test(qrCodeLower)) {
                return true;
            }
        }
        // Check if it's a ReZ URL
        if (qrCodeLower.includes('rez.') || qrCodeLower.includes('rez-')) {
            return true;
        }
        return false;
    }
}
exports.EntryPointDetector = EntryPointDetector;
// Export singleton instance
exports.entryPointDetector = new EntryPointDetector();
//# sourceMappingURL=entryPointDetector.js.map
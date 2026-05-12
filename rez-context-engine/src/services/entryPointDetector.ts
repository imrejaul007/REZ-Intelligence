import { v4 as uuidv4 } from 'uuid';
import {
  EntryContext,
  EntryContextInput,
  EntryPointType,
  QRCodeType,
  ReZPlatform,
  createDefaultEntryContext,
} from '../models/EntryContext';
import { logger } from '../utils/logger';

/**
 * QR code prefix patterns for vertical detection
 */
const QR_PREFIX_PATTERNS: Record<string, { type: QRCodeType; regex: RegExp }> = {
  HOTEL: {
    type: QRCodeType.HOTEL,
    regex: /^(rez|h|hotel|stay|accommodation)/i,
  },
  RESTAURANT: {
    type: QRCodeType.RESTAURANT,
    regex: /^(rez|r|restaurant|food|dine|cafe|eat)/i,
  },
  GYM: {
    type: QRCodeType.GYM,
    regex: /^(rez|g|gym|fitness|workout|exercise)/i,
  },
  CLINIC: {
    type: QRCodeType.CLINIC,
    regex: /^(rez|c|clinic|health|medical|doctor)/i,
  },
  RETAIL: {
    type: QRCodeType.RETAIL,
    regex: /^(rez|ret|retail|shop|store)/i,
  },
  SALON: {
    type: QRCodeType.SALON,
    regex: /^(rez|s|salon|beauty|spa|hair)/i,
  },
};

/**
 * ReZ platform patterns
 */
const REZ_PLATFORM_PATTERNS: Record<string, { platform: ReZPlatform; regex: RegExp }> = {
  WEB_MENU: {
    platform: ReZPlatform.WEB_MENU,
    regex: /rez\.com\/menu|web-menu|menu\.rez/i,
  },
  STAY: {
    platform: ReZPlatform.STAY,
    regex: /rez\.com\/stay|rez-stay|stay\.rez|hotel|accommodation/i,
  },
  FIT: {
    platform: ReZPlatform.FIT,
    regex: /rez\.com\/fit|rez-fit|fit\.rez|gym|fitness/i,
  },
  HEALTH: {
    platform: ReZPlatform.HEALTH,
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

export interface EntryPointDetectionResult {
  entryType: EntryPointType;
  qrCodeType?: QRCodeType;
  rePlatform?: ReZPlatform;
  confidence: number;
  metadata: Record<string, unknown>;
}

/**
 * Service for detecting entry point types from various input sources
 */
export class EntryPointDetector {
  /**
   * Detect entry point from input context
   */
  async detect(input: EntryContextInput, sessionId: string): Promise<EntryContext> {
    const startTime = Date.now();

    try {
      const context = createDefaultEntryContext(sessionId);
      context.id = uuidv4();
      context.sessionId = sessionId;

      // Apply input values
      if (input.userId) context.userId = input.userId;
      if (input.merchantId) context.merchantId = input.merchantId;
      if (input.merchantName) context.merchantName = input.merchantName;
      if (input.location) context.location = input.location;

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
      logger.debug('Entry point detection completed', {
        sessionId,
        entryType: context.entryType,
        qrCodeType: context.qrCodeType,
        processingTimeMs: processingTime,
      });

      return context;
    } catch (error) {
      logger.error('Entry point detection failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Detect entry point details from input
   */
  private async detectEntryPoint(input: EntryContextInput): Promise<EntryPointDetectionResult> {
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
      entryType: EntryPointType.UNKNOWN,
      confidence: 0.3,
      metadata: { source: 'default' },
    };
  }

  /**
   * Detect entry point from QR code
   */
  private detectFromQRCode(qrCode: string): EntryPointDetectionResult {
    const qrCodeLower = qrCode.toLowerCase().trim();

    // Check for ReZ-specific QR codes
    for (const [, pattern] of Object.values(QR_PREFIX_PATTERNS)) {
      if (pattern.regex.test(qrCodeLower)) {
        return {
          entryType: EntryPointType.QR_CODE,
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
      entryType: EntryPointType.QR_CODE,
      qrCodeType: QRCodeType.GENERAL,
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
  private detectFromPlatform(platform: string): EntryPointDetectionResult {
    const platformLower = platform.toLowerCase();

    for (const [, pattern] of Object.values(REZ_PLATFORM_PATTERNS)) {
      if (pattern.regex.test(platformLower)) {
        return {
          entryType: EntryPointType.APP,
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
      entryType: EntryPointType.APP,
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
  private detectDeviceType(userAgent?: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
    if (!userAgent) return 'unknown';

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
  isValidReZQRCode(qrCode: string): boolean {
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

// Export singleton instance
export const entryPointDetector = new EntryPointDetector();

/**
 * EntryPointDetector Unit Tests
 *
 * Tests for the EntryPointDetector class which detects entry point types
 * from various input sources like QR codes and platforms.
 */

import {
  EntryPointDetector,
  EntryPointDetectionResult,
} from '../src/services/entryPointDetector';
import {
  EntryContextInput,
  EntryPointType,
  QRCodeType,
  ReZPlatform,
  MerchantCategory,
} from '../src/models/EntryContext';

// Mock logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('EntryPointDetector', () => {
  let detector: EntryPointDetector;
  const testSessionId = 'session-test-123';

  beforeEach(() => {
    detector = new EntryPointDetector();
  });

  describe('detect', () => {
    it('should create default context for empty input', async () => {
      const input: EntryContextInput = {};

      const result = await detector.detect(input, testSessionId);

      expect(result.sessionId).toBe(testSessionId);
      expect(result.entryType).toBe(EntryPointType.UNKNOWN);
      expect(result.confidence).toBeLessThan(1);
    });

    it('should apply user-provided values', async () => {
      const input: EntryContextInput = {
        userId: 'user-456',
        merchantId: 'merchant-789',
        merchantName: 'Test Hotel',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.userId).toBe('user-456');
      expect(result.merchantId).toBe('merchant-789');
      expect(result.merchantName).toBe('Test Hotel');
    });

    it('should detect device type from user agent', async () => {
      const input: EntryContextInput = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.deviceType).toBe('mobile');
    });

    it('should detect tablet from user agent', async () => {
      const input: EntryContextInput = {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.deviceType).toBe('tablet');
    });

    it('should detect desktop from user agent', async () => {
      const input: EntryContextInput = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.deviceType).toBe('desktop');
    });

    it('should apply merchant category from input', async () => {
      const input: EntryContextInput = {
        merchantCategory: MerchantCategory.HOSPITALITY,
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.merchantCategory).toBe(MerchantCategory.HOSPITALITY);
    });
  });

  describe('QR code detection', () => {
    it('should detect hotel QR codes', async () => {
      const input: EntryContextInput = {
        qrCode: 'rez-hotel-12345',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.entryType).toBe(EntryPointType.QR_CODE);
      expect(result.qrCodeType).toBe(QRCodeType.HOTEL);
      expect(result.confidence).toBe(0.95);
    });

    it('should detect hotel QR codes with various prefixes', async () => {
      const prefixes = ['h-', 'hotel-', 'stay-', 'accommodation-'];

      for (const prefix of prefixes) {
        const input: EntryContextInput = {
          qrCode: `${prefix}12345`,
        };

        const result = await detector.detect(input, testSessionId);

        expect(result.qrCodeType).toBe(QRCodeType.HOTEL);
      }
    });

    it('should detect restaurant QR codes', async () => {
      const input: EntryContextInput = {
        qrCode: 'rez-r-12345',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.qrCodeType).toBe(QRCodeType.RESTAURANT);
      expect(result.confidence).toBe(0.95);
    });

    it('should detect restaurant QR codes with food-related prefixes', async () => {
      const prefixes = ['restaurant-', 'food-', 'dine-', 'cafe-', 'eat-'];

      for (const prefix of prefixes) {
        const input: EntryContextInput = {
          qrCode: `${prefix}12345`,
        };

        const result = await detector.detect(input, testSessionId);

        expect(result.qrCodeType).toBe(QRCodeType.RESTAURANT);
      }
    });

    it('should detect gym QR codes', async () => {
      const input: EntryContextInput = {
        qrCode: 'gym-member-12345',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.qrCodeType).toBe(QRCodeType.GYM);
    });

    it('should detect clinic QR codes', async () => {
      const input: EntryContextInput = {
        qrCode: 'clinic-room-101',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.qrCodeType).toBe(QRCodeType.CLINIC);
    });

    it('should detect retail QR codes', async () => {
      const input: EntryContextInput = {
        qrCode: 'retail-store-123',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.qrCodeType).toBe(QRCodeType.RETAIL);
    });

    it('should detect salon QR codes', async () => {
      const input: EntryContextInput = {
        qrCode: 'salon-beauty-123',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.qrCodeType).toBe(QRCodeType.SALON);
    });

    it('should default to general QR code for unrecognized patterns', async () => {
      const input: EntryContextInput = {
        qrCode: 'random-unknown-qr-code',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.entryType).toBe(EntryPointType.QR_CODE);
      expect(result.qrCodeType).toBe(QRCodeType.GENERAL);
      expect(result.confidence).toBe(0.6);
    });

    it('should handle case-insensitive QR codes', async () => {
      const input: EntryContextInput = {
        qrCode: 'REZ-HOTEL-12345',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.qrCodeType).toBe(QRCodeType.HOTEL);
    });
  });

  describe('platform detection', () => {
    it('should detect ReZ Web Menu platform', async () => {
      const input: EntryContextInput = {
        platform: 'rez.com/menu',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.entryType).toBe(EntryPointType.APP);
      expect(result.rePlatform).toBe(ReZPlatform.WEB_MENU);
      expect(result.confidence).toBe(0.9);
    });

    it('should detect ReZ Stay platform', async () => {
      const input: EntryContextInput = {
        platform: 'rez-stay',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.rePlatform).toBe(ReZPlatform.STAY);
    });

    it('should detect ReZ Fit platform', async () => {
      const input: EntryContextInput = {
        platform: 'rez.fit',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.rePlatform).toBe(ReZPlatform.FIT);
    });

    it('should detect ReZ Health platform', async () => {
      const input: EntryContextInput = {
        platform: 'rez-health',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.rePlatform).toBe(ReZPlatform.HEALTH);
    });

    it('should handle unknown platform with low confidence', async () => {
      const input: EntryContextInput = {
        platform: 'unknown-platform',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.entryType).toBe(EntryPointType.APP);
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('explicit entry type', () => {
    it('should use explicit entry type with full confidence', async () => {
      const input: EntryContextInput = {
        entryType: EntryPointType.WEB,
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.entryType).toBe(EntryPointType.WEB);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('isValidReZQRCode', () => {
    it('should return true for valid ReZ hotel QR codes', () => {
      expect(detector.isValidReZQRCode('rez-hotel-123')).toBe(true);
      expect(detector.isValidReZQRCode('h-12345')).toBe(true);
      expect(detector.isValidReZQRCode('hotel-room-101')).toBe(true);
    });

    it('should return true for valid ReZ restaurant QR codes', () => {
      expect(detector.isValidReZQRCode('rez-r-123')).toBe(true);
      expect(detector.isValidReZQRCode('restaurant-123')).toBe(true);
      expect(detector.isValidReZQRCode('food-order-456')).toBe(true);
    });

    it('should return true for valid ReZ gym QR codes', () => {
      expect(detector.isValidReZQRCode('gym-member-123')).toBe(true);
      expect(detector.isValidReZQRCode('fitness-123')).toBe(true);
    });

    it('should return true for ReZ URLs', () => {
      expect(detector.isValidReZQRCode('https://rez.com/menu/123')).toBe(true);
      expect(detector.isValidReZQRCode('https://stay.rez.com/room/456')).toBe(true);
      expect(detector.isValidReZQRCode('rez.hotel.789')).toBe(true);
    });

    it('should return false for unknown QR codes', () => {
      expect(detector.isValidReZQRCode('random-qr-code')).toBe(false);
      expect(detector.isValidReZQRCode('other-brand-123')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(detector.isValidReZQRCode('REZ-HOTEL-123')).toBe(true);
      expect(detector.isValidReZQRCode('GYM-MEMBER-456')).toBe(true);
    });
  });

  describe('metadata preservation', () => {
    it('should preserve detection metadata', async () => {
      const input: EntryContextInput = {
        qrCode: 'rez-hotel-12345',
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.source).toBe('qr_code');
    });

    it('should merge input metadata with detection metadata', async () => {
      const input: EntryContextInput = {
        qrCode: 'rez-hotel-12345',
        metadata: { customField: 'customValue' },
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.metadata.customField).toBe('customValue');
      expect(result.metadata.source).toBe('qr_code');
    });
  });

  describe('truncation of raw data', () => {
    it('should truncate long QR codes in metadata', async () => {
      const longQRCode = 'a'.repeat(200);

      const input: EntryContextInput = {
        qrCode: longQRCode,
      };

      const result = await detector.detect(input, testSessionId);

      expect(result.metadata.raw).toBeDefined();
      expect((result.metadata.raw as string).length).toBeLessThanOrEqual(100);
    });
  });
});

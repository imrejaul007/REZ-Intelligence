/**
 * RoutingRulesEngine Unit Tests
 *
 * Tests for the RoutingRulesEngine class which determines which expert
 * should handle a request based on entry context.
 */

import {
  RoutingRulesEngine,
  RoutingResult,
} from '../src/services/routingRules';
import {
  EntryContext,
  EntryPointType,
  QRCodeType,
  ReZPlatform,
  MerchantCategory,
} from '../src/models/EntryContext';
import { ExpertType, RoutingPriority } from '../src/models/RoutingDecision';

// Mock logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RoutingRulesEngine', () => {
  let routingEngine: RoutingRulesEngine;

  const createMockContext = (overrides: Partial<EntryContext> = {}): EntryContext => ({
    id: 'context-123',
    sessionId: 'session-123',
    userId: 'user-123',
    entryType: EntryPointType.UNKNOWN,
    merchantCategory: MerchantCategory.UNKNOWN,
    deviceType: 'mobile',
    detectedAt: new Date(),
    confidence: 0.5,
    metadata: {},
    ...overrides,
  });

  beforeEach(() => {
    routingEngine = new RoutingRulesEngine();
  });

  describe('determineRouting', () => {
    it('should route hotel QR codes to hospitality expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.HOTEL,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.HOSPITALITY);
      expect(result.decision.primaryConfidence).toBe(0.95);
      expect(result.rulesApplied).toContain('qr-hotel');
    });

    it('should route restaurant QR codes to culinary expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.RESTAURANT,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.CULINARY);
      expect(result.decision.primaryConfidence).toBe(0.95);
      expect(result.rulesApplied).toContain('qr-restaurant');
    });

    it('should route gym QR codes to fitness expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.GYM,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.FITNESS);
      expect(result.decision.primaryConfidence).toBe(0.95);
    });

    it('should route clinic QR codes to health expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.CLINIC,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.HEALTH);
      expect(result.decision.primaryConfidence).toBe(0.95);
    });

    it('should route retail QR codes to retail expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.RETAIL,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.RETAIL);
      expect(result.decision.primaryConfidence).toBe(0.95);
    });

    it('should route salon QR codes to salon expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.SALON,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.SALON);
      expect(result.decision.primaryConfidence).toBe(0.95);
    });

    it('should route ReZ Stay platform to hospitality expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.APP,
        rePlatform: ReZPlatform.STAY,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.HOSPITALITY);
      expect(result.decision.primaryConfidence).toBe(0.9);
      expect(result.rulesApplied).toContain('rez-stay');
    });

    it('should route ReZ Web Menu platform to culinary expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.APP,
        rePlatform: ReZPlatform.WEB_MENU,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.CULINARY);
      expect(result.decision.primaryConfidence).toBe(0.9);
      expect(result.rulesApplied).toContain('rez-web-menu');
    });

    it('should route ReZ Fit platform to fitness expert', async () => {
      const context = createMockContext({
        entryType: EntryPointType.APP,
        rePlatform: ReZPlatform.FIT,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.FITNESS);
      expect(result.decision.primaryConfidence).toBe(0.9);
      expect(result.rulesApplied).toContain('rez-fit');
    });

    it('should route merchant category to correct expert', async () => {
      const context = createMockContext({
        merchantCategory: MerchantCategory.HOSPITALITY,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.primaryExpert).toBe(ExpertType.HOSPITALITY);
      expect(result.decision.primaryConfidence).toBe(0.85);
      expect(result.rulesApplied).toContain('cat-hospitality');
    });

    it('should set QR code rules with highest priority', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.HOTEL,
        merchantCategory: MerchantCategory.HOSPITALITY,
        rePlatform: ReZPlatform.STAY,
      });

      const result = await routingEngine.determineRouting(context);

      // QR code rules have priority 100, should be selected first
      expect(result.rulesApplied[0]).toBe('qr-hotel');
    });

    it('should include fallback expert when multiple rules match', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.HOTEL,
        merchantCategory: MerchantCategory.HOSPITALITY,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.fallbackExpert).toBeDefined();
      expect(result.rulesApplied.length).toBeGreaterThan(1);
    });

    it('should use fallback routing when no rules match', async () => {
      const context = createMockContext({
        entryType: EntryPointType.UNKNOWN,
        merchantCategory: MerchantCategory.UNKNOWN,
        qrCodeType: undefined,
        rePlatform: undefined,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.rulesApplied).toContain('fallback');
    });

    it('should set correct routing priority based on entry type', async () => {
      const qrContext = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.HOTEL,
      });

      const voiceContext = createMockContext({
        entryType: EntryPointType.VOICE,
      });

      const qrResult = await routingEngine.determineRouting(qrContext);
      const voiceResult = await routingEngine.determineRouting(voiceContext);

      expect(qrResult.decision.priority).toBe(RoutingPriority.HIGH);
      expect(voiceResult.decision.priority).toBe(RoutingPriority.MEDIUM);
    });

    it('should include context summary in decision', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.RESTAURANT,
        merchantCategory: MerchantCategory.CULINARY,
        rePlatform: ReZPlatform.WEB_MENU,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.contextSummary).toBeDefined();
      expect(result.decision.contextSummary.entryType).toBe(EntryPointType.QR_CODE);
      expect(result.decision.contextSummary.qrCodeType).toBe(QRCodeType.RESTAURANT);
      expect(result.decision.contextSummary.merchantCategory).toBe(MerchantCategory.CULINARY);
      expect(result.decision.contextSummary.rePlatform).toBe(ReZPlatform.WEB_MENU);
    });

    it('should track processing time', async () => {
      const context = createMockContext({
        entryType: EntryPointType.QR_CODE,
        qrCodeType: QRCodeType.HOTEL,
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.decision.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should set decidedAt timestamp', async () => {
      const context = createMockContext();

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.decidedAt).toBeInstanceOf(Date);
    });

    it('should include user ID in decision', async () => {
      const context = createMockContext({
        userId: 'user-123',
      });

      const result = await routingEngine.determineRouting(context);

      expect(result.decision.userId).toBe('user-123');
    });
  });

  describe('addRule', () => {
    it('should add custom routing rule', () => {
      const newRule = {
        name: 'Custom Rule',
        priority: 95,
        condition: (ctx: EntryContext) => ctx.entryType === EntryPointType.API,
        expert: ExpertType.GENERAL,
        confidence: 0.8,
        reason: 'Custom API routing',
      };

      routingEngine.addRule(newRule);

      const rules = routingEngine.getRules();
      const customRule = rules.find(r => r.name === 'Custom Rule');
      expect(customRule).toBeDefined();
      expect(customRule?.priority).toBe(95);
    });
  });

  describe('removeRule', () => {
    it('should remove existing rule by ID', () => {
      const rulesBefore = routingEngine.getRules();
      const initialCount = rulesBefore.length;

      const removed = routingEngine.removeRule('qr-hotel');

      expect(removed).toBe(true);
      expect(routingEngine.getRules().length).toBe(initialCount - 1);
    });

    it('should return false for non-existent rule ID', () => {
      const removed = routingEngine.removeRule('non-existent-rule');

      expect(removed).toBe(false);
    });
  });

  describe('getRules', () => {
    it('should return copy of rules array', () => {
      const rules1 = routingEngine.getRules();
      const rules2 = routingEngine.getRules();

      expect(rules1).toEqual(rules2);
      expect(rules1).not.toBe(rules2);
    });

    it('should return all initialized rules', () => {
      const rules = routingEngine.getRules();

      expect(rules.length).toBeGreaterThan(10);
    });
  });

  describe('getExpertForQRCode', () => {
    it('should return correct expert for each QR code type', () => {
      expect(routingEngine.getExpertForQRCode(QRCodeType.HOTEL)).toBe(ExpertType.HOSPITALITY);
      expect(routingEngine.getExpertForQRCode(QRCodeType.RESTAURANT)).toBe(ExpertType.CULINARY);
      expect(routingEngine.getExpertForQRCode(QRCodeType.GYM)).toBe(ExpertType.FITNESS);
      expect(routingEngine.getExpertForQRCode(QRCodeType.CLINIC)).toBe(ExpertType.HEALTH);
      expect(routingEngine.getExpertForQRCode(QRCodeType.RETAIL)).toBe(ExpertType.RETAIL);
      expect(routingEngine.getExpertForQRCode(QRCodeType.SALON)).toBe(ExpertType.SALON);
    });

    it('should return GENERAL for unknown QR code type', () => {
      expect(routingEngine.getExpertForQRCode(QRCodeType.GENERAL)).toBe(ExpertType.GENERAL);
    });
  });

  describe('getExpertForCategory', () => {
    it('should return correct expert for each merchant category', () => {
      expect(routingEngine.getExpertForCategory(MerchantCategory.HOSPITALITY)).toBe(ExpertType.HOSPITALITY);
      expect(routingEngine.getExpertForCategory(MerchantCategory.CULINARY)).toBe(ExpertType.CULINARY);
      expect(routingEngine.getExpertForCategory(MerchantCategory.FITNESS)).toBe(ExpertType.FITNESS);
      expect(routingEngine.getExpertForCategory(MerchantCategory.HEALTH)).toBe(ExpertType.HEALTH);
      expect(routingEngine.getExpertForCategory(MerchantCategory.RETAIL)).toBe(ExpertType.RETAIL);
      expect(routingEngine.getExpertForCategory(MerchantCategory.SALON)).toBe(ExpertType.SALON);
    });

    it('should return GENERAL for unknown category', () => {
      expect(routingEngine.getExpertForCategory(MerchantCategory.UNKNOWN)).toBe(ExpertType.GENERAL);
    });
  });

  describe('getExpertForPlatform', () => {
    it('should return correct expert for each platform', () => {
      expect(routingEngine.getExpertForPlatform(ReZPlatform.WEB_MENU)).toBe(ExpertType.CULINARY);
      expect(routingEngine.getExpertForPlatform(ReZPlatform.STAY)).toBe(ExpertType.HOSPITALITY);
      expect(routingEngine.getExpertForPlatform(ReZPlatform.FIT)).toBe(ExpertType.FITNESS);
      expect(routingEngine.getExpertForPlatform(ReZPlatform.HEALTH)).toBe(ExpertType.HEALTH);
    });

    it('should return GENERAL for general platform', () => {
      expect(routingEngine.getExpertForPlatform(ReZPlatform.GENERAL)).toBe(ExpertType.GENERAL);
    });
  });
});

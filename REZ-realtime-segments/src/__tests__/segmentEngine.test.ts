import {
  evaluateRule,
  evaluateRules,
  evaluateSegment,
  evaluateAllSegments,
  getQualifyingSegments,
  findSegmentById,
  validateSegment,
  createMockUserData,
  DEFAULT_SEGMENTS
} from '../services/segmentEngine';
import type { UserData, SegmentDefinition, SegmentRule } from '../types';

describe('SegmentEngine', () => {
  describe('evaluateRule', () => {
    const userData: UserData = createMockUserData();

    it('should evaluate eq operator correctly', () => {
      const rule: SegmentRule = {
        field: 'signals.competitor.switchRisk',
        operator: 'eq',
        logic: 'AND',
        value: 'LOW'
      };
      expect(evaluateRule(rule, userData)).toBe(true);

      const falseRule: SegmentRule = { ...rule, value: 'HIGH' };
      expect(evaluateRule(falseRule, userData)).toBe(false);
    });

    it('should evaluate ne operator correctly', () => {
      const rule: SegmentRule = {
        field: 'signals.competitor.switchRisk',
        operator: 'ne',
        logic: 'AND',
        value: 'HIGH'
      };
      expect(evaluateRule(rule, userData)).toBe(true);

      const falseRule: SegmentRule = { ...rule, value: 'LOW' };
      expect(evaluateRule(falseRule, userData)).toBe(false);
    });

    it('should evaluate gt operator correctly', () => {
      const rule: SegmentRule = {
        field: 'lifetime.totalSpend',
        operator: 'gt',
        logic: 'AND',
        value: 10000
      };
      expect(evaluateRule(rule, userData)).toBe(true);

      const falseRule: SegmentRule = { ...rule, value: 20000 };
      expect(evaluateRule(falseRule, userData)).toBe(false);
    });

    it('should evaluate lt operator correctly', () => {
      const rule: SegmentRule = {
        field: 'lifetime.avgOrderValue',
        operator: 'lt',
        logic: 'AND',
        value: 1500
      };
      expect(evaluateRule(rule, userData)).toBe(true);

      const falseRule: SegmentRule = { ...rule, value: 500 };
      expect(evaluateRule(falseRule, userData)).toBe(false);
    });

    it('should evaluate gte operator correctly', () => {
      const rule: SegmentRule = {
        field: 'lifetime.totalOrders',
        operator: 'gte',
        logic: 'AND',
        value: 10
      };
      expect(evaluateRule(rule, userData)).toBe(true);
    });

    it('should evaluate lte operator correctly', () => {
      const rule: SegmentRule = {
        field: 'activity.last30Days.orders',
        operator: 'lte',
        logic: 'AND',
        value: 5
      };
      expect(evaluateRule(rule, userData)).toBe(true);
    });

    it('should evaluate in operator correctly', () => {
      const rule: SegmentRule = {
        field: 'signals.social.influenceTier',
        operator: 'in',
        logic: 'AND',
        value: ['micro', 'mid', 'macro']
      };
      expect(evaluateRule(rule, userData)).toBe(true);

      const falseRule: SegmentRule = { ...rule, value: ['nano', 'mega'] };
      expect(evaluateRule(falseRule, userData)).toBe(false);
    });

    it('should evaluate contains operator with strings', () => {
      const rule: SegmentRule = {
        field: 'signals.location.segments',
        operator: 'contains',
        logic: 'AND',
        value: 'food_enthusiast'
      };
      expect(evaluateRule(rule, userData)).toBe(true);

      const falseRule: SegmentRule = { ...rule, value: 'gamer' };
      expect(evaluateRule(falseRule, userData)).toBe(false);
    });

    it('should return false for undefined field values', () => {
      const rule: SegmentRule = {
        field: 'nonexistent.field',
        operator: 'eq',
        logic: 'AND',
        value: 'test'
      };
      expect(evaluateRule(rule, userData)).toBe(false);
    });
  });

  describe('evaluateRules', () => {
    const userData: UserData = createMockUserData();

    it('should evaluate AND logic correctly', () => {
      const rules: SegmentRule[] = [
        { field: 'lifetime.totalSpend', operator: 'gte', logic: 'AND', value: 10000 },
        { field: 'lifetime.avgOrderValue', operator: 'gte', logic: 'AND', value: 1000 }
      ];

      const result = evaluateRules(rules, userData);
      expect(result.matches).toBe(true);
      expect(result.matchedRules.length).toBe(2);
      expect(result.failedRules.length).toBe(0);
    });

    it('should fail when one AND rule fails', () => {
      const rules: SegmentRule[] = [
        { field: 'lifetime.totalSpend', operator: 'gte', logic: 'AND', value: 10000 },
        { field: 'lifetime.avgOrderValue', operator: 'gte', logic: 'AND', value: 5000 } // This will fail
      ];

      const result = evaluateRules(rules, userData);
      expect(result.matches).toBe(false);
      expect(result.matchedRules.length).toBe(1);
      expect(result.failedRules.length).toBe(1);
    });

    it('should evaluate OR logic correctly', () => {
      const rules: SegmentRule[] = [
        { field: 'lifetime.totalSpend', operator: 'gte', logic: 'AND', value: 100000 }, // Will fail
        { field: 'lifetime.avgOrderValue', operator: 'gte', logic: 'OR', value: 1000 } // Will pass
      ];

      const result = evaluateRules(rules, userData);
      expect(result.matches).toBe(true);
    });
  });

  describe('evaluateSegment', () => {
    const userData: UserData = createMockUserData();

    it('should evaluate high_spender segment correctly', () => {
      const segment = findSegmentById('high_spender');
      if (!segment) {
        throw new Error('high_spender segment not found');
      }

      const result = evaluateSegment(segment, userData);

      expect(result.segmentId).toBe('high_spender');
      expect(result.userId).toBe(userData.userId);
      expect(result.matches).toBe(true);
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should evaluate new_customer segment correctly', () => {
      const newUserData = createMockUserData({
        userId: 'new-user',
        lifetime: { ...userData.lifetime, tenureDays: 15 }
      });

      const segment = findSegmentById('new_customer');
      if (!segment) {
        throw new Error('new_customer segment not found');
      }

      const result = evaluateSegment(segment, newUserData);
      expect(result.matches).toBe(true);
    });

    it('should return correct match status', () => {
      const userData = createMockUserData({
        lifetime: { ...createMockUserData().lifetime, tenureDays: 5 }
      });

      const newCustomerSegment = findSegmentById('new_customer');

      if (!newCustomerSegment) {
        throw new Error('Segment not found');
      }

      const newCustomerResult = evaluateSegment(newCustomerSegment, userData);

      expect(newCustomerResult.matches).toBe(true);
      // Dormant requires no orders in 30 days, so new customer won't match
    });
  });

  describe('evaluateAllSegments', () => {
    const userData: UserData = createMockUserData();

    it('should evaluate all segments', () => {
      const results = evaluateAllSegments(DEFAULT_SEGMENTS, userData);

      expect(results.length).toBe(DEFAULT_SEGMENTS.length);

      // Check that all results have required fields
      for (const result of results) {
        expect(result.segmentId).toBeDefined();
        expect(result.segmentName).toBeDefined();
        expect(result.userId).toBe(userData.userId);
        expect(result.evaluatedAt).toBeDefined();
        expect(typeof result.matches).toBe('boolean');
      }
    });

    it('should identify qualifying segments', () => {
      const results = evaluateAllSegments(DEFAULT_SEGMENTS, userData);
      const qualifying = getQualifyingSegments(results);

      expect(qualifying.length).toBeGreaterThan(0);
      expect(qualifying.every(r => r.matches)).toBe(true);
    });
  });

  describe('validateSegment', () => {
    it('should validate correct segment', () => {
      const segment: Partial<SegmentDefinition> = {
        segmentId: 'test_segment',
        name: 'Test Segment',
        description: 'A test segment',
        rules: [
          { field: 'lifetime.totalSpend', operator: 'gte', logic: 'AND', value: 1000 }
        ]
      };

      const errors = validateSegment(segment);
      expect(errors.length).toBe(0);
    });

    it('should catch missing required fields', () => {
      const segment: Partial<SegmentDefinition> = {
        segmentId: '',
        name: '',
        rules: []
      };

      const errors = validateSegment(segment);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('segmentId is required');
      expect(errors).toContain('name is required');
      expect(errors).toContain('At least one rule is required');
    });

    it('should catch invalid operator', () => {
      const segment: Partial<SegmentDefinition> = {
        segmentId: 'test',
        name: 'Test',
        rules: [
          { field: 'test', operator: 'invalid' as 'eq', logic: 'AND', value: 0 }
        ]
      };

      const errors = validateSegment(segment);
      expect(errors.some(e => e.includes('invalid operator'))).toBe(true);
    });
  });

  describe('createMockUserData', () => {
    it('should create valid mock user data', () => {
      const userData = createMockUserData();

      expect(userData.userId).toBe('test-user-001');
      expect(userData.lifetime.totalSpend).toBe(15000);
      expect(userData.signals.competitor.switchRisk).toBe('LOW');
    });

    it('should allow overrides', () => {
      const userData = createMockUserData({
        userId: 'custom-user',
        lifetime: { totalSpend: 50000, totalOrders: 100, avgOrderValue: 500, tenureDays: 730 }
      });

      expect(userData.userId).toBe('custom-user');
      expect(userData.lifetime.totalSpend).toBe(50000);
      expect(userData.lifetime.totalOrders).toBe(100);
    });
  });

  describe('findSegmentById', () => {
    it('should find existing segment', () => {
      const segment = findSegmentById('high_spender');

      expect(segment).toBeDefined();
      expect(segment?.name).toBe('High Spenders');
    });

    it('should return undefined for non-existent segment', () => {
      const segment = findSegmentById('nonexistent_segment');

      expect(segment).toBeUndefined();
    });
  });
});

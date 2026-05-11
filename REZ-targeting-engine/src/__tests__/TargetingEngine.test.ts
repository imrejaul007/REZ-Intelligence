import { targetingEngine } from '../services/TargetingEngine';
import { UserContext, UserAttributes, TargetingRules } from '../types';

describe('TargetingEngine', () => {
  describe('evaluateTargeting', () => {
    const mockUserContext: UserContext = {
      user_id: 'user_123',
      segments: ['high_value', 'foodies'],
      attributes: {
        ltv: 15000,
        total_orders: 25,
        avg_order_value: 45,
        last_order_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        first_order_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        days_since_last_order: 3,
        browsing_frequency: 8,
        purchase_frequency: 6,
        is_discount_responsive: true,
        preferred_categories: ['italian', 'japanese', 'thai'],
        timezone: 'America/New_York'
      },
      preferences: {
        preferred_send_time: 'evening',
        timezone: 'America/New_York',
        notification_enabled: true,
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true
      }
    };

    it('should match user to high_value segment', async () => {
      const rules: TargetingRules = {
        user_segments: ['high_value'],
        exclusions: [],
        recency_days: 30,
        min_orders: 5
      };

      const result = await targetingEngine.evaluateTargeting(mockUserContext, rules);

      expect(result.eligible).toBe(true);
      expect(result.segments_matched).toContain('high_value');
      expect(result.confidence_score).toBeGreaterThan(0);
    });

    it('should exclude user from churned segment', async () => {
      const rules: TargetingRules = {
        user_segments: [],
        exclusions: ['churned'],
        recency_days: 30,
        min_orders: 1
      };

      const result = await targetingEngine.evaluateTargeting(mockUserContext, rules);

      // User is NOT churned (3 days since last order), so exclusion check passes
      expect(result.eligible).toBe(true);
    });

    it('should fail when user has not made a purchase within recency days', async () => {
      const inactiveUser: UserContext = {
        ...mockUserContext,
        attributes: {
          ...mockUserContext.attributes,
          days_since_last_order: 60
        }
      };

      const rules: TargetingRules = {
        user_segments: ['high_value'],
        exclusions: [],
        recency_days: 30,
        min_orders: 1
      };

      const result = await targetingEngine.evaluateTargeting(inactiveUser, rules);

      expect(result.eligible).toBe(false);
      expect(result.exclusion_reasons.length).toBeGreaterThan(0);
    });

    it('should fail when user has insufficient order count', async () => {
      const newUser: UserContext = {
        ...mockUserContext,
        attributes: {
          ...mockUserContext.attributes,
          total_orders: 1
        }
      };

      const rules: TargetingRules = {
        user_segments: ['high_value'],
        exclusions: [],
        recency_days: 30,
        min_orders: 5
      };

      const result = await targetingEngine.evaluateTargeting(newUser, rules);

      expect(result.eligible).toBe(false);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost with channel multiplier', () => {
      const cost = targetingEngine.calculateCost('push', ['high_value']);

      expect(cost.base_cost).toBeDefined();
      expect(cost.channel_multiplier).toBe(0.5); // Push has 0.5 multiplier
      expect(cost.total_cost).toBeGreaterThan(0);
    });

    it('should apply premium for high-value segments', () => {
      const standardCost = targetingEngine.calculateCost('push', []);
      const highValueCost = targetingEngine.calculateCost('push', ['high_value']);

      expect(highValueCost.segment_adjustment).toBe(1.5);
      expect(highValueCost.total_cost).toBeGreaterThan(standardCost.total_cost);
    });

    it('should apply discount for budget segments', () => {
      const standardCost = targetingEngine.calculateCost('push', []);
      const budgetCost = targetingEngine.calculateCost('push', ['budget_minders']);

      expect(budgetCost.segment_adjustment).toBe(0.8);
      expect(budgetCost.total_cost).toBeLessThan(standardCost.total_cost);
    });
  });

  describe('assignABTestVariant', () => {
    const variants = [
      { id: 'control', name: 'Control', weight: 50, ad_template_id: 'tpl_control' },
      { id: 'variant_a', name: 'Variant A', weight: 30, ad_template_id: 'tpl_a' },
      { id: 'variant_b', name: 'Variant B', weight: 20, ad_template_id: 'tpl_b' }
    ];

    it('should assign variant deterministically based on user ID', () => {
      const assignment1 = targetingEngine.assignABTestVariant('user_1', variants);
      const assignment2 = targetingEngine.assignABTestVariant('user_1', variants);

      // Same user should always get the same variant
      expect(assignment1?.variant_id).toBe(assignment2?.variant_id);
    });

    it('should return null for empty variants', () => {
      const assignment = targetingEngine.assignABTestVariant('user_1', []);

      expect(assignment).toBeNull();
    });

    it('should distribute users according to weights', () => {
      const assignments: Record<string, number> = {};

      // Test 1000 users
      for (let i = 0; i < 1000; i++) {
        const assignment = targetingEngine.assignABTestVariant(`user_${i}`, variants);
        if (assignment) {
          assignments[assignment.variant_id] = (assignments[assignment.variant_id] || 0) + 1;
        }
      }

      // Check approximate distribution (allowing for variance)
      expect(assignments['control']).toBeGreaterThan(400);
      expect(assignments['control']).toBeLessThan(600);
    });
  });

  describe('checkSegmentInclusion', () => {
    const mockUserContext: UserContext = {
      user_id: 'user_123',
      segments: ['high_value'],
      attributes: {
        ltv: 15000,
        total_orders: 25,
        avg_order_value: 45,
        days_since_last_order: 3,
        browsing_frequency: 8,
        purchase_frequency: 6,
        is_discount_responsive: true,
        preferred_categories: ['italian']
      },
      preferences: {
        timezone: 'UTC',
        notification_enabled: true,
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true
      }
    };

    it('should match multiple segments', () => {
      const result = targetingEngine.checkSegmentInclusion(mockUserContext, ['high_value', 'deal_seekers']);

      expect(result.matched).toContain('high_value');
      expect(result.matched).toContain('deal_seekers');
      expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle unknown segments gracefully', () => {
      const result = targetingEngine.checkSegmentInclusion(mockUserContext, ['unknown_segment']);

      expect(result.matched).toHaveLength(0);
    });
  });

  describe('checkExclusions', () => {
    const mockUserContext: UserContext = {
      user_id: 'user_123',
      segments: ['churned', 'recently_purchased'],
      attributes: {
        ltv: 500,
        total_orders: 2,
        avg_order_value: 30,
        days_since_last_order: 5,
        browsing_frequency: 2,
        purchase_frequency: 1,
        is_discount_responsive: false,
        preferred_categories: []
      },
      preferences: {
        timezone: 'UTC',
        notification_enabled: true,
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true
      }
    };

    it('should identify excluded segments', () => {
      const result = targetingEngine.checkExclusions(mockUserContext, ['churned', 'recently_purchased']);

      expect(result.excluded).toContain('churned');
      expect(result.excluded).toContain('recently_purchased');
    });

    it('should return empty array when no exclusions match', () => {
      const result = targetingEngine.checkExclusions(mockUserContext, ['high_value']);

      expect(result.excluded).toHaveLength(0);
    });
  });
});

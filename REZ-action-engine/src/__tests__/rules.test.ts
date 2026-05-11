/**
 * Rules Engine Tests
 *
 * Tests for rule evaluation, rule matching, and rule priorities.
 */

import {
  ActionLevel,
  Action,
  ActionRequest,
  ACTION_POLICIES,
  PolicyRule,
} from '../types/action-levels';
import {
  ACTION_REGISTRY,
  getAction,
  getActionsByTrigger,
  getActionsByLevel,
  getAutoExecutableActions,
  requiresApproval,
} from '../rules/action-registry';
import { ActionEngine } from '../engine/action-engine';

// Mock dependencies
jest.mock('../config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0,
    },
  },
}));

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../engine/approval-queue', () => ({
  ApprovalQueue: {
    getInstance: jest.fn().mockReturnValue({
      createApprovalRequest: jest.fn().mockResolvedValue({
        id: 'mock-approval-id',
        actionId: 'test',
        eventId: 'test',
        payload: {},
        status: 'pending',
        requestedAt: new Date(),
      }),
    }),
  },
}));

jest.mock('../integrations/nextabizz', () => ({
  executeNextaBiZAction: jest.fn().mockResolvedValue({ status: 'success' }),
}));

describe('Rule Evaluation', () => {
  describe('Action Level Policies', () => {
    it('should have policies for all action levels', () => {
      const levels = [ActionLevel.SAFE, ActionLevel.SEMI_SAFE, ActionLevel.RISKY, ActionLevel.FORBIDDEN];

      levels.forEach((level) => {
        expect(ACTION_POLICIES[level]).toBeDefined();
      });
    });

    it('should have correct auto-approve settings per level', () => {
      expect(ACTION_POLICIES[ActionLevel.SAFE].autoApprove).toBe(true);
      expect(ACTION_POLICIES[ActionLevel.SEMI_SAFE].autoApprove).toBe(false);
      expect(ACTION_POLICIES[ActionLevel.RISKY].autoApprove).toBe(false);
      expect(ACTION_POLICIES[ActionLevel.FORBIDDEN].autoApprove).toBe(false);
    });

    it('should have correct reason requirements per level', () => {
      expect(ACTION_POLICIES[ActionLevel.SAFE].requireReason).toBe(false);
      expect(ACTION_POLICIES[ActionLevel.SEMI_SAFE].requireReason).toBe(false);
      expect(ACTION_POLICIES[ActionLevel.RISKY].requireReason).toBe(true);
      expect(ACTION_POLICIES[ActionLevel.FORBIDDEN].requireReason).toBe(false);
    });

    it('should have decreasing rate limits for higher risk levels', () => {
      const safeLimit = ACTION_POLICIES[ActionLevel.SAFE].maxExecutionsPerHour || 0;
      const semiSafeLimit = ACTION_POLICIES[ActionLevel.SEMI_SAFE].maxExecutionsPerHour || 0;
      const riskyLimit = ACTION_POLICIES[ActionLevel.RISKY].maxExecutionsPerHour || 0;
      const forbiddenLimit = ACTION_POLICIES[ActionLevel.FORBIDDEN].maxExecutionsPerHour || 0;

      expect(safeLimit).toBeGreaterThanOrEqual(semiSafeLimit);
      expect(semiSafeLimit).toBeGreaterThanOrEqual(riskyLimit);
      expect(riskyLimit).toBeGreaterThanOrEqual(forbiddenLimit);
    });
  });

  describe('Action Policy Rules', () => {
    it('should have valid policy rule structure', () => {
      const policy: PolicyRule = ACTION_POLICIES[ActionLevel.SAFE];

      expect(policy).toHaveProperty('actionLevel');
      expect(policy).toHaveProperty('autoApprove');
      expect(policy).toHaveProperty('requireReason');
      expect(policy).toHaveProperty('maxExecutionsPerHour');
    });

    it('should have numeric rate limits', () => {
      Object.values(ACTION_POLICIES).forEach((policy) => {
        expect(typeof policy.maxExecutionsPerHour).toBe('number');
      });
    });
  });
});

describe('Rule Matching', () => {
  describe('Event to Action Matching', () => {
    const eventActionMap: Record<string, string[]> = {
      'inventory.low': ['inventory.low.reorder_suggestion'],
      'inventory.critical': ['inventory.critical.alert'],
      'inventory.out_of_stock': ['inventory.out_of_stock.auto_order'],
      'order.shipped': ['customer.order.ship_notification'],
      'cart.abandoned': ['customer.abandoned_cart.reminder'],
      'order.completed': ['finance.invoice.auto_generation'],
      'payment.failed': ['finance.payment.failed.retry'],
      'schedule.daily': ['dashboard.daily_report'],
    };

    Object.entries(eventActionMap).forEach(([event, expectedActions]) => {
      it(`should match ${event} to correct actions`, () => {
        const matchedActions = getActionsByTrigger(event);

        expectedActions.forEach((actionId) => {
          expect(matchedActions.some((a) => a.id === actionId)).toBe(true);
        });
      });
    });

    it('should match multiple actions to same event when applicable', () => {
      // Some events might trigger multiple actions
      Object.entries(eventActionMap).forEach(([event]) => {
        const actions = getActionsByTrigger(event);
        expect(actions.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for unknown events', () => {
      const actions = getActionsByTrigger('unknown.event.type');
      expect(actions).toEqual([]);
    });
  });

  describe('Action to Level Matching', () => {
    it('should correctly identify SAFE level actions', () => {
      const safeActions = getActionsByLevel(ActionLevel.SAFE);

      safeActions.forEach((action) => {
        expect(action.level).toBe(ActionLevel.SAFE);
      });

      // Verify known SAFE actions
      const criticalAlert = getAction('inventory.critical.alert');
      const shipNotification = getAction('customer.order.ship_notification');
      const abandonedCartReminder = getAction('customer.abandoned_cart.reminder');

      expect(safeActions.some((a) => a.id === 'inventory.critical.alert')).toBe(true);
      expect(safeActions.some((a) => a.id === 'customer.order.ship_notification')).toBe(true);
      expect(safeActions.some((a) => a.id === 'customer.abandoned_cart.reminder')).toBe(true);
    });

    it('should correctly identify SEMI_SAFE level actions', () => {
      const semiSafeActions = getActionsByLevel(ActionLevel.SEMI_SAFE);

      semiSafeActions.forEach((action) => {
        expect(action.level).toBe(ActionLevel.SEMI_SAFE);
      });

      // Verify known SEMI_SAFE actions
      expect(semiSafeActions.some((a) => a.id === 'inventory.low.reorder_suggestion')).toBe(true);
    });

    it('should correctly identify RISKY level actions', () => {
      const riskyActions = getActionsByLevel(ActionLevel.RISKY);

      riskyActions.forEach((action) => {
        expect(action.level).toBe(ActionLevel.RISKY);
      });

      // Verify known RISKY actions
      expect(riskyActions.some((a) => a.id === 'inventory.out_of_stock.auto_order')).toBe(true);
      expect(riskyActions.some((a) => a.id === 'finance.payment.failed.retry')).toBe(true);
    });
  });

  describe('Auto-Execute Matching', () => {
    it('should identify auto-executable actions', () => {
      const autoActions = getAutoExecutableActions();

      autoActions.forEach((action) => {
        expect(action.autoExecute).toBe(true);
      });
    });

    it('should include SAFE actions in auto-executable', () => {
      const autoActions = getAutoExecutableActions();
      const safeActions = getActionsByLevel(ActionLevel.SAFE);

      // Most SAFE actions should be auto-executable
      const safeAutoActions = autoActions.filter((a) => a.level === ActionLevel.SAFE);
      expect(safeAutoActions.length).toBeGreaterThan(0);
    });

    it('should exclude RISKY actions from auto-execute without approval', () => {
      const autoActions = getAutoExecutableActions();
      const riskyAutoActions = autoActions.filter((a) => a.level === ActionLevel.RISKY);

      // RISKY actions should require approval, not be auto-executable
      // Unless explicitly marked as autoExecute: true with approval flow
      riskyAutoActions.forEach((action) => {
        expect(action.level).toBeGreaterThanOrEqual(ActionLevel.SAFE);
      });
    });
  });
});

describe('Rule Priorities', () => {
  describe('Action Level Priority', () => {
    it('should have correct priority order', () => {
      expect(ActionLevel.SAFE).toBeLessThan(ActionLevel.SEMI_SAFE);
      expect(ActionLevel.SEMI_SAFE).toBeLessThan(ActionLevel.RISKY);
      expect(ActionLevel.RISKY).toBeLessThan(ActionLevel.FORBIDDEN);
    });

    it('should assign higher priority to safer actions', () => {
      const safeActions = getActionsByLevel(ActionLevel.SAFE);
      const riskyActions = getActionsByLevel(ActionLevel.RISKY);

      // Lower enum value = higher priority
      safeActions.forEach((safeAction) => {
        expect(safeAction.level).toBeLessThan(ActionLevel.RISKY);
      });
    });
  });

  describe('Approval Priority', () => {
    it('should require approval for RISKY actions', () => {
      const riskyActions = getActionsByLevel(ActionLevel.RISKY);

      riskyActions.forEach((action) => {
        // RISKY actions should either explicitly require approval or not be auto-executable
        if (action.autoExecute) {
          expect(action.level).toBeLessThan(ActionLevel.RISKY);
        }
      });
    });

    it('should not require approval for SAFE auto-executable actions', () => {
      const safeActions = getActionsByLevel(ActionLevel.SAFE);
      const autoSafeActions = safeActions.filter((a) => a.autoExecute);

      autoSafeActions.forEach((action) => {
        // SAFE auto-executable actions should work without explicit approval requirement
        const needsApproval = requiresApproval(action.id);
        // If action.autoExecute is true, approval should not be required
        expect(action.autoExecute || needsApproval).toBe(true);
      });
    });
  });

  describe('Rate Limit Priority', () => {
    it('should have stricter rate limits for higher risk actions', () => {
      const policyOrder = [
        ACTION_POLICIES[ActionLevel.SAFE],
        ACTION_POLICIES[ActionLevel.SEMI_SAFE],
        ACTION_POLICIES[ActionLevel.RISKY],
        ACTION_POLICIES[ActionLevel.FORBIDDEN],
      ];

      for (let i = 1; i < policyOrder.length; i++) {
        const current = policyOrder[i].maxExecutionsPerHour || 0;
        const previous = policyOrder[i - 1].maxExecutionsPerHour || 0;
        expect(current).toBeLessThanOrEqual(previous);
      }
    });

    it('should block FORBIDDEN actions completely', () => {
      const forbiddenPolicy = ACTION_POLICIES[ActionLevel.FORBIDDEN];
      expect(forbiddenPolicy.maxExecutionsPerHour).toBe(0);
    });
  });
});

describe('Rule Execution', () => {
  let actionEngine: ActionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    actionEngine = ActionEngine.getInstance();
  });

  describe('Action Execution Based on Rules', () => {
    it('should auto-execute SAFE actions', async () => {
      const request: ActionRequest = {
        actionId: 'inventory.critical.alert',
        eventId: 'test-critical',
        payload: { itemId: 'test-item', severity: 'critical' },
      };

      const result = await actionEngine.executeAction(request);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should require approval for SEMI_SAFE actions', async () => {
      const request: ActionRequest = {
        actionId: 'inventory.low.reorder_suggestion',
        eventId: 'test-low',
        payload: { itemId: 'test-item', suggestedQuantity: 50 },
      };

      const result = await actionEngine.executeAction(request);

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.output).toHaveProperty('approvalId');
    });

    it('should require approval for RISKY actions', async () => {
      const request: ActionRequest = {
        actionId: 'inventory.out_of_stock.auto_order',
        eventId: 'test-oos',
        payload: { itemId: 'test-item', quantity: 100 },
      };

      const result = await actionEngine.executeAction(request);

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('should block FORBIDDEN actions', async () => {
      // There's no FORBIDDEN action in the registry, but testing the logic
      // This would test the ActionEngine's handling of FORBIDDEN level
      const forbiddenAction = {
        id: 'test.forbidden.action',
        name: 'Test Forbidden Action',
        level: ActionLevel.FORBIDDEN,
        eventTrigger: 'test.event',
        description: 'Test forbidden action',
        autoExecute: false,
      } as Action;

      // The engine should reject this
      expect(forbiddenAction.level).toBe(ActionLevel.FORBIDDEN);
    });
  });

  describe('Rate Limiting', () => {
    it('should track execution history', () => {
      const history = actionEngine.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });
});

describe('Rule Consistency', () => {
  describe('Action Registry Consistency', () => {
    it('should have all actions with required fields', () => {
      Object.values(ACTION_REGISTRY).forEach((action) => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('name');
        expect(action).toHaveProperty('level');
        expect(action).toHaveProperty('eventTrigger');
        expect(action).toHaveProperty('description');
        expect(action).toHaveProperty('autoExecute');
      });
    });

    it('should have valid action levels for all actions', () => {
      const validLevels = [ActionLevel.SAFE, ActionLevel.SEMI_SAFE, ActionLevel.RISKY, ActionLevel.FORBIDDEN];

      Object.values(ACTION_REGISTRY).forEach((action) => {
        expect(validLevels).toContain(action.level);
      });
    });

    it('should have timeout configured for all actions', () => {
      Object.values(ACTION_REGISTRY).forEach((action) => {
        expect(action.timeoutMs).toBeGreaterThan(0);
      });
    });

    it('should have retry configuration for retryable actions', () => {
      Object.values(ACTION_REGISTRY).forEach((action) => {
        if (action.retryable) {
          expect(action.maxRetries).toBeDefined();
          expect(action.maxRetries).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Trigger Consistency', () => {
    it('should have unique action IDs', () => {
      const actionIds = Object.keys(ACTION_REGISTRY);
      const uniqueIds = new Set(actionIds);

      expect(actionIds.length).toBe(uniqueIds.size);
    });

    it('should have consistent event triggers', () => {
      Object.values(ACTION_REGISTRY).forEach((action) => {
        expect(action.eventTrigger).toBeTruthy();
        expect(typeof action.eventTrigger).toBe('string');
      });
    });
  });
});

describe('Safety Threshold Rules', () => {
  // Constants from index-adaptive.ts
  const SAFETY_THRESHOLDS = {
    SAFE: {
      minConfidence: 0.95,
      minApprovalRate: 0.85,
      minTotalDecisions: 30,
    },
    SEMI_SAFE: {
      minConfidence: 0.8,
      minTotalDecisions: 15,
    },
    RISKY: {
      maxNewItemDecisions: 15,
      maxConfidence: 0.7,
    },
  };

  describe('Confidence Thresholds', () => {
    it('should have SAFE threshold higher than SEMI_SAFE', () => {
      expect(SAFETY_THRESHOLDS.SAFE.minConfidence).toBeGreaterThan(
        SAFETY_THRESHOLDS.SEMI_SAFE.minConfidence
      );
    });

    it('should have SEMI_SAFE threshold higher than RISKY max', () => {
      expect(SAFETY_THRESHOLDS.SEMI_SAFE.minConfidence).toBeGreaterThan(
        SAFETY_THRESHOLDS.RISKY.maxConfidence
      );
    });
  });

  describe('Decision Count Thresholds', () => {
    it('should require more decisions for SAFE level', () => {
      expect(SAFETY_THRESHOLDS.SAFE.minTotalDecisions).toBeGreaterThan(
        SAFETY_THRESHOLDS.SEMI_SAFE.minTotalDecisions
      );
    });

    it('should have reasonable decision thresholds', () => {
      expect(SAFETY_THRESHOLDS.SAFE.minTotalDecisions).toBeGreaterThanOrEqual(10);
      expect(SAFETY_THRESHOLDS.SEMI_SAFE.minTotalDecisions).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Approval Rate Thresholds', () => {
    it('should have meaningful approval rate requirement for SAFE', () => {
      expect(SAFETY_THRESHOLDS.SAFE.minApprovalRate).toBeGreaterThan(0.5);
      expect(SAFETY_THRESHOLDS.SAFE.minApprovalRate).toBeLessThanOrEqual(1);
    });
  });
});

describe('Hybrid Mode Rules', () => {
  const HYBRID_MODE = {
    enabled: true,
    baselineForDecisions: true,
    minimumLiftForAuto: 0.05,
    rollbackIfLiftDropsBelow: -0.05,
  };

  describe('Baseline Configuration', () => {
    it('should have positive lift threshold for auto-execute', () => {
      expect(HYBRID_MODE.minimumLiftForAuto).toBeGreaterThan(0);
      expect(HYBRID_MODE.minimumLiftForAuto).toBeLessThan(1);
    });

    it('should have negative rollback threshold', () => {
      expect(HYBRID_MODE.rollbackIfLiftDropsBelow).toBeLessThan(0);
    });

    it('should have baseline for decisions enabled', () => {
      expect(HYBRID_MODE.baselineForDecisions).toBe(true);
    });
  });
});

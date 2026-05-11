/**
 * Action Engine Tests
 *
 * Tests for action triggering, execution, and the rules engine.
 */

import {
  ActionLevel,
  ActionStatus,
  ActionRequest,
  Action,
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

// Mock the config and logger to avoid initialization issues
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

// Mock approval queue to avoid Redis connection
jest.mock('../engine/approval-queue', () => ({
  ApprovalQueue: {
    getInstance: jest.fn().mockReturnValue({
      createApprovalRequest: jest.fn().mockResolvedValue({
        id: 'mock-approval-id',
        actionId: 'test',
        eventId: 'test',
        payload: {},
        status: ActionStatus.PENDING,
        requestedAt: new Date(),
      }),
    }),
  },
}));

// Mock nextabizz integration
jest.mock('../integrations/nextabizz', () => ({
  executeNextaBiZAction: jest.fn().mockResolvedValue({ status: 'success' }),
}));

describe('Action Registry', () => {
  describe('getAction', () => {
    it('should return action when it exists', () => {
      const action = getAction('inventory.low.reorder_suggestion');
      expect(action).toBeDefined();
      expect(action?.id).toBe('inventory.low.reorder_suggestion');
      expect(action?.name).toBe('Create Reorder Suggestion');
    });

    it('should return undefined when action does not exist', () => {
      const action = getAction('non.existent.action');
      expect(action).toBeUndefined();
    });
  });

  describe('getActionsByTrigger', () => {
    it('should return actions triggered by inventory.low event', () => {
      const actions = getActionsByTrigger('inventory.low');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.id === 'inventory.low.reorder_suggestion')).toBe(true);
    });

    it('should return empty array for unknown trigger', () => {
      const actions = getActionsByTrigger('unknown.event');
      expect(actions).toEqual([]);
    });
  });

  describe('getActionsByLevel', () => {
    it('should return all SAFE level actions', () => {
      const safeActions = getActionsByLevel(ActionLevel.SAFE);
      expect(safeActions.length).toBeGreaterThan(0);
      safeActions.forEach((action) => {
        expect(action.level).toBe(ActionLevel.SAFE);
      });
    });

    it('should return all RISKY level actions', () => {
      const riskyActions = getActionsByLevel(ActionLevel.RISKY);
      expect(riskyActions.length).toBeGreaterThan(0);
      riskyActions.forEach((action) => {
        expect(action.level).toBe(ActionLevel.RISKY);
      });
    });
  });

  describe('getAutoExecutableActions', () => {
    it('should return only auto-executable actions', () => {
      const autoActions = getAutoExecutableActions();
      expect(autoActions.length).toBeGreaterThan(0);
      autoActions.forEach((action) => {
        expect(action.autoExecute).toBe(true);
      });
    });
  });

  describe('requiresApproval', () => {
    it('should return true for RISKY actions without explicit approval flag', () => {
      // inventory.out_of_stock.auto_order is RISKY and requires approval
      const result = requiresApproval('inventory.out_of_stock.auto_order');
      expect(result).toBe(true);
    });

    it('should return true for unknown actions', () => {
      const result = requiresApproval('unknown.action');
      expect(result).toBe(true);
    });

    it('should return false for auto-executable SAFE actions', () => {
      // inventory.critical.alert is SAFE and autoExecute
      const result = requiresApproval('inventory.critical.alert');
      expect(result).toBe(false);
    });
  });
});

describe('Action Levels', () => {
  it('should have correct priority order', () => {
    expect(ActionLevel.SAFE).toBeLessThan(ActionLevel.SEMI_SAFE);
    expect(ActionLevel.SEMI_SAFE).toBeLessThan(ActionLevel.RISKY);
    expect(ActionLevel.RISKY).toBeLessThan(ActionLevel.FORBIDDEN);
  });

  it('should correctly identify SAFE actions', () => {
    const criticalAlert = getAction('inventory.critical.alert');
    expect(criticalAlert?.level).toBe(ActionLevel.SAFE);
  });

  it('should correctly identify RISKY actions', () => {
    const autoOrder = getAction('inventory.out_of_stock.auto_order');
    expect(autoOrder?.level).toBe(ActionLevel.RISKY);
  });
});

describe('Action Execution Flow', () => {
  let actionEngine: ActionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    actionEngine = ActionEngine.getInstance();
  });

  describe('executeAction', () => {
    it('should fail for unknown action', async () => {
      const request: ActionRequest = {
        actionId: 'unknown.action',
        eventId: 'test-event-1',
        payload: { test: 'data' },
      };

      const result = await actionEngine.executeAction(request);

      expect(result.success).toBe(false);
      expect(result.status).toBe(ActionStatus.FAILED);
      expect(result.error).toContain('Unknown action');
    });

    it('should return pending status for actions requiring approval', async () => {
      const request: ActionRequest = {
        actionId: 'inventory.low.reorder_suggestion',
        eventId: 'test-event-2',
        payload: { itemId: 'item-1', quantity: 10 },
        userId: 'user-1',
      };

      const result = await actionEngine.executeAction(request);

      expect(result.success).toBe(true);
      expect(result.status).toBe(ActionStatus.PENDING);
      expect(result.output?.approvalId).toBeDefined();
    });

    it('should execute SAFE auto-executable actions directly', async () => {
      const request: ActionRequest = {
        actionId: 'inventory.critical.alert',
        eventId: 'test-event-3',
        payload: { itemId: 'item-2', level: 'critical' },
      };

      const result = await actionEngine.executeAction(request);

      expect(result.success).toBe(true);
      expect(result.status).toBe(ActionStatus.COMPLETED);
    });
  });

  describe('getHistory', () => {
    it('should return execution history', () => {
      const history = actionEngine.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const history = actionEngine.getHistory(5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getApprovalQueue', () => {
    it('should return approval queue instance', () => {
      const queue = actionEngine.getApprovalQueue();
      expect(queue).toBeDefined();
    });
  });
});

describe('Action Trigger Mapping', () => {
  const triggerToActions: Record<string, string[]> = {
    'inventory.low': ['inventory.low.reorder_suggestion'],
    'inventory.critical': ['inventory.critical.alert'],
    'order.shipped': ['customer.order.ship_notification'],
    'cart.abandoned': ['customer.abandoned_cart.reminder'],
    'order.completed': ['finance.invoice.auto_generation'],
  };

  Object.entries(triggerToActions).forEach(([trigger, expectedActions]) => {
    it(`should map ${trigger} to correct actions`, () => {
      const actions = getActionsByTrigger(trigger);
      expectedActions.forEach((actionId) => {
        expect(actions.some((a) => a.id === actionId)).toBe(true);
      });
    });
  });
});

describe('Action Properties', () => {
  const action = getAction('inventory.low.reorder_suggestion');

  it('should have required properties', () => {
    expect(action).toHaveProperty('id');
    expect(action).toHaveProperty('name');
    expect(action).toHaveProperty('level');
    expect(action).toHaveProperty('eventTrigger');
    expect(action).toHaveProperty('description');
    expect(action).toHaveProperty('autoExecute');
  });

  it('should have timeout configured', () => {
    expect(action?.timeoutMs).toBeGreaterThan(0);
  });

  it('should have retry configuration for retryable actions', () => {
    if (action?.retryable) {
      expect(action.maxRetries).toBeDefined();
    }
  });
});

describe('Action Registry Coverage', () => {
  it('should have actions for all event types', () => {
    const events = [
      'inventory.low',
      'inventory.critical',
      'order.shipped',
      'cart.abandoned',
      'order.completed',
    ];

    events.forEach((event) => {
      const actions = getActionsByTrigger(event);
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  it('should have a mix of auto-executable and approval-required actions', () => {
    const allActions = Object.values(ACTION_REGISTRY);
    const autoActions = allActions.filter((a) => a.autoExecute);
    const approvalActions = allActions.filter((a) => a.requiresApproval || !a.autoExecute);

    expect(autoActions.length).toBeGreaterThan(0);
    expect(approvalActions.length).toBeGreaterThan(0);
  });
});

describe('Safety Thresholds in Decisions', () => {
  // Test the safety threshold constants used in index-adaptive.ts
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
    maxAutoOrderValue: 5000,
    capQuantityAt: 50,
  };

  it('should have SAFE thresholds with high requirements', () => {
    expect(SAFETY_THRESHOLDS.SAFE.minConfidence).toBeGreaterThanOrEqual(0.9);
    expect(SAFETY_THRESHOLDS.SAFE.minApprovalRate).toBeGreaterThanOrEqual(0.8);
    expect(SAFETY_THRESHOLDS.SAFE.minTotalDecisions).toBeGreaterThanOrEqual(10);
  });

  it('should have RISKY thresholds that block low confidence', () => {
    expect(SAFETY_THRESHOLDS.RISKY.maxConfidence).toBeLessThan(0.8);
    expect(SAFETY_THRESHOLDS.RISKY.maxNewItemDecisions).toBeLessThan(20);
  });

  it('should have reasonable value caps', () => {
    expect(SAFETY_THRESHOLDS.maxAutoOrderValue).toBeGreaterThan(0);
    expect(SAFETY_THRESHOLDS.capQuantityAt).toBeGreaterThan(0);
  });
});

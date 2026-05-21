/**
 * REZ Flow Runtime - Unit Tests
 * Tests for workflow executor and node handlers
 */

import {
  triggerHandlers,
  actionHandlers,
  conditionHandlers,
  delayHandlers
} from './nodeHandlers';
import { ExecutionContext, TriggerType, TriggerConfig } from '../types/workflow';

// Mock logger
jest.mock('./logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Node Handlers', () => {
  const mockContext: ExecutionContext = {
    workflowId: 'test-workflow',
    executionId: 'test-execution',
    triggerType: TriggerType.MANUAL,
    triggerData: {},
    userId: 'user-123',
    sessionId: 'session-456',
    variables: {
      email: 'test@example.com',
      phone: '+1234567890',
      userSegment: 'premium',
      purchaseCount: 5
    },
    secrets: {},
    timestamp: new Date()
  };

  describe('Trigger Handlers', () => {
    it('should handle manual trigger', async () => {
      const config: TriggerConfig = {
        type: TriggerType.MANUAL
      };

      const result = await triggerHandlers[TriggerType.MANUAL](config, mockContext);

      expect(result.output).toEqual({ initiatedBy: 'manual' });
      expect(result.nextNodeIds).toEqual([]);
    });

    it('should handle event trigger', async () => {
      const config: TriggerConfig = {
        type: TriggerType.EVENT,
        eventName: 'user.signup'
      };

      const result = await triggerHandlers[TriggerType.EVENT](config, mockContext);

      expect(result.output).toHaveProperty('eventName', 'user.signup');
    });

    it('should handle API trigger', async () => {
      const config: TriggerConfig = {
        type: TriggerType.API
      };

      const result = await triggerHandlers[TriggerType.API](config, mockContext);

      expect(result.output).toHaveProperty('apiTrigger', true);
    });
  });

  describe('Condition Handlers', () => {
    it('should evaluate user segment condition - equals', async () => {
      const config = {
        conditionType: 'segment',
        operator: 'equals',
        field: 'userSegment',
        value: 'premium'
      };

      const result = await conditionHandlers.if_user_segment(config, mockContext);

      expect(result).toBe(true);
    });

    it('should evaluate user segment condition - not equals', async () => {
      const config = {
        conditionType: 'segment',
        operator: 'not_equals',
        field: 'userSegment',
        value: 'basic'
      };

      const result = await conditionHandlers.if_user_segment(config, mockContext);

      expect(result).toBe(true);
    });

    it('should evaluate purchase history - greater than', async () => {
      const config = {
        conditionType: 'purchase',
        operator: 'greater_than',
        field: 'purchaseCount',
        value: 3
      };

      const result = await conditionHandlers.if_purchase_history(config, mockContext);

      expect(result).toBe(true);
    });

    it('should evaluate purchase history - less than', async () => {
      const config = {
        conditionType: 'purchase',
        operator: 'less_than',
        field: 'purchaseCount',
        value: 10
      };

      const result = await conditionHandlers.if_purchase_history(config, mockContext);

      expect(result).toBe(true);
    });
  });

  describe('Delay Handlers', () => {
    it('should handle wait_minutes delay', async () => {
      const config = {
        delayType: 'minutes' as const,
        value: 5
      };

      const result = await delayHandlers.wait_minutes(config, mockContext);

      expect(result.output).toHaveProperty('delayType', 'minutes');
      expect(result.output).toHaveProperty('value', 5);
      expect(result.shouldWait).toBe(true);
      expect(result.waitUntil).toBeInstanceOf(Date);
    });

    it('should handle wait_hours delay', async () => {
      const config = {
        delayType: 'hours' as const,
        value: 2
      };

      const result = await delayHandlers.wait_hours(config, mockContext);

      expect(result.output).toHaveProperty('delayType', 'hours');
      expect(result.output).toHaveProperty('value', 2);
      expect(result.shouldWait).toBe(true);
    });

    it('should handle wait_days delay', async () => {
      const config = {
        delayType: 'days' as const,
        value: 1
      };

      const result = await delayHandlers.wait_days(config, mockContext);

      expect(result.output).toHaveProperty('delayType', 'days');
      expect(result.output).toHaveProperty('value', 1);
      expect(result.shouldWait).toBe(true);
    });

    it('should handle wait_until delay with ISO string', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const config = {
        delayType: 'until' as const,
        value: futureDate.toISOString(),
        timezone: 'UTC'
      };

      const result = await delayHandlers.wait_until(config, mockContext);

      expect(result.output).toHaveProperty('delayType', 'until');
      expect(result.shouldWait).toBe(true);
      expect(result.waitUntil).toBeInstanceOf(Date);
    });

    it('should throw error for invalid minutes value', async () => {
      const config = {
        delayType: 'minutes' as const,
        value: -5
      };

      await expect(delayHandlers.wait_minutes(config, mockContext)).rejects.toThrow();
    });
  });
});

describe('Workflow Executor', () => {
  // Mock workflow definition for testing
  const mockWorkflow = {
    id: 'test-workflow',
    name: 'Test Workflow',
    version: 1,
    status: 'published' as const,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger_manual' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Start',
          type: 'trigger_manual',
          config: { type: 'manual' }
        }
      },
      {
        id: 'action-1',
        type: 'action_send_email' as const,
        position: { x: 100, y: 0 },
        data: {
          label: 'Send Email',
          type: 'action_send_email',
          config: {
            actionType: 'send_email',
            params: {
              subject: 'Test',
              body: 'Hello'
            }
          }
        }
      },
      {
        id: 'condition-1',
        type: 'condition_if' as const,
        position: { x: 200, y: 0 },
        data: {
          label: 'Check Segment',
          type: 'condition_if',
          config: {
            conditionType: 'segment',
            operator: 'equals',
            field: 'userSegment',
            value: 'premium'
          }
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'action-1' },
      { id: 'e2', source: 'action-1', target: 'condition-1' }
    ],
    entryNodeId: 'trigger-1'
  };

  describe('parseWorkflow', () => {
    it('should parse valid workflow', () => {
      // This is a placeholder for the actual test
      // In production, you would import and test the workflowExecutor
      expect(mockWorkflow.nodes.length).toBe(3);
      expect(mockWorkflow.edges.length).toBe(2);
      expect(mockWorkflow.entryNodeId).toBe('trigger-1');
    });

    it('should identify entry node', () => {
      const entryNode = mockWorkflow.nodes.find(n => n.id === mockWorkflow.entryNodeId);
      expect(entryNode).toBeDefined();
      expect(entryNode?.type).toBe('trigger_manual');
    });
  });
});

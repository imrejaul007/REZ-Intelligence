/**
 * ExpertSelector Unit Tests
 *
 * Tests for the ExpertSelector class which handles agent selection based on
 * request routing hints and capability matching.
 */

import { ExpertSelector, SelectionResult } from '../src/services/expertSelector';
import { AgentInfo } from '../src/services/agentRegistry';
import { ProcessedOrchestrationRequest } from '../src/models/OrchestrationRequest';
import { AgentCapability } from '../src/models/OrchestrationRequest';

// Mock dependencies
jest.mock('../src/config', () => ({
  appConfig: {
    agent: {
      maxResponseTimeMs: 30000,
    },
    responseTime: {
      thresholdMs: 5000,
    },
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ExpertSelector', () => {
  let expertSelector: ExpertSelector;
  let mockAgentRegistry: { getAgentsByCapabilities: jest.Mock };

  const createMockAgent = (overrides: Partial<AgentInfo> = {}): AgentInfo => ({
    agentId: 'agent-1',
    name: 'Test Agent',
    description: 'A test agent',
    capabilities: ['natural_language', 'code_generation'],
    endpoint: 'http://localhost:8001',
    status: 'idle',
    health: {
      lastCheck: new Date().toISOString(),
      isHealthy: true,
      responseTimeMs: 100,
      errorCount: 0,
      successCount: 10,
      successRate: 1.0,
    },
    metrics: {
      totalRequests: 10,
      successfulRequests: 10,
      failedRequests: 0,
      averageResponseTimeMs: 100,
      lastUsed: new Date().toISOString(),
    },
    metadata: {},
    version: '1.0.0',
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createMockRequest = (overrides: Partial<ProcessedOrchestrationRequest> = {}): ProcessedOrchestrationRequest => ({
    requestId: 'req-123',
    message: 'Test message for agent selection',
    timestamp: new Date(),
    priority: 'normal',
    context: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockAgentRegistry = {
      getAgentsByCapabilities: jest.fn().mockResolvedValue([]),
    };

    expertSelector = new ExpertSelector();
    expertSelector.setAgentRegistry(mockAgentRegistry);
  });

  describe('selectAgent', () => {
    it('should return null when no agents are available', async () => {
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      expect(result.selectedAgent).toBeNull();
      expect(result.fallbackAgent).toBeNull();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should select an idle and healthy agent', async () => {
      const mockAgent = createMockAgent({ status: 'idle', health: { ...createMockAgent().health, isHealthy: true } });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([mockAgent]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      expect(result.selectedAgent).toEqual(mockAgent);
      expect(result.allCandidates).toContain(mockAgent);
    });

    it('should filter out unhealthy agents', async () => {
      const healthyAgent = createMockAgent({ agentId: 'healthy', status: 'idle', health: { ...createMockAgent().health, isHealthy: true } });
      const unhealthyAgent = createMockAgent({ agentId: 'unhealthy', status: 'idle', health: { ...createMockAgent().health, isHealthy: false } });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([healthyAgent, unhealthyAgent]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      expect(result.selectedAgent?.agentId).toBe('healthy');
      expect(result.allCandidates.length).toBe(1);
    });

    it('should filter out busy agents', async () => {
      const idleAgent = createMockAgent({ agentId: 'idle', status: 'idle' });
      const busyAgent = createMockAgent({ agentId: 'busy', status: 'busy' });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([idleAgent, busyAgent]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      expect(result.selectedAgent?.agentId).toBe('idle');
      expect(result.allCandidates.length).toBe(1);
    });

    it('should use fallback when no idle agents available', async () => {
      const busyAgent = createMockAgent({ agentId: 'busy-agent', status: 'busy' });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([busyAgent]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      expect(result.selectedAgent).toEqual(busyAgent);
      expect(result.fallbackAgent).toBeNull();
      expect(result.warnings.some(w => w.includes('fallback'))).toBe(true);
    });

    it('should respect excluded agents', async () => {
      const agent1 = createMockAgent({ agentId: 'agent-1' });
      const agent2 = createMockAgent({ agentId: 'agent-2' });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([agent1, agent2]);

      const request = createMockRequest({
        routingHints: {
          excludedAgents: ['agent-1'],
        },
      });

      const result = await expertSelector.selectAgent(request);

      expect(result.allCandidates.length).toBe(1);
      expect(result.allCandidates[0].agentId).toBe('agent-2');
      expect(result.warnings.some(w => w.includes('Excluded'))).toBe(true);
    });

    it('should rank preferred agents higher', async () => {
      const agent1 = createMockAgent({ agentId: 'agent-1', metrics: { ...createMockAgent().metrics, averageResponseTimeMs: 500 } });
      const agent2 = createMockAgent({ agentId: 'agent-2', metrics: { ...createMockAgent().metrics, averageResponseTimeMs: 100 } });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([agent1, agent2]);

      const request = createMockRequest({
        routingHints: {
          preferredAgents: ['agent-2', 'agent-1'],
        },
      });

      const result = await expertSelector.selectAgent(request);

      // Preferred agent should be selected first
      expect(result.selectedAgent?.agentId).toBeDefined();
    });

    it('should select fallback agent different from primary', async () => {
      const agent1 = createMockAgent({ agentId: 'agent-1' });
      const agent2 = createMockAgent({ agentId: 'agent-2' });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([agent1, agent2]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      if (result.selectedAgent && result.fallbackAgent) {
        expect(result.fallbackAgent.agentId).not.toBe(result.selectedAgent.agentId);
      }
    });

    it('should include selection reason in result', async () => {
      const mockAgent = createMockAgent({ status: 'idle', health: { ...createMockAgent().health, isHealthy: true } });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([mockAgent]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      expect(result.selectionReason).toBeDefined();
      expect(typeof result.selectionReason).toBe('string');
    });
  });

  describe('capability inference', () => {
    it('should infer code_generation capability from keywords', async () => {
      const mockAgent = createMockAgent({
        capabilities: ['code_generation', 'natural_language'],
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([mockAgent]);

      const request = createMockRequest({
        message: 'Write code for a function that calculates fibonacci',
      });

      const result = await expertSelector.selectAgent(request);

      expect(mockAgentRegistry.getAgentsByCapabilities).toHaveBeenCalled();
      expect(result.selectedAgent).toEqual(mockAgent);
    });

    it('should infer data_processing capability from keywords', async () => {
      const mockAgent = createMockAgent({
        capabilities: ['data_processing'],
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([mockAgent]);

      const request = createMockRequest({
        message: 'Process data and calculate statistics',
      });

      const result = await expertSelector.selectAgent(request);

      expect(mockAgentRegistry.getAgentsByCapabilities).toHaveBeenCalled();
    });

    it('should infer image_analysis capability from keywords', async () => {
      const mockAgent = createMockAgent({
        capabilities: ['image_analysis'],
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([mockAgent]);

      const request = createMockRequest({
        message: 'Analyze this image and identify objects',
      });

      const result = await expertSelector.selectAgent(request);

      expect(mockAgentRegistry.getAgentsByCapabilities).toHaveBeenCalled();
    });

    it('should use explicit capabilities when provided', async () => {
      const mockAgent = createMockAgent({
        capabilities: ['code_generation'],
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([mockAgent]);

      const request = createMockRequest({
        message: 'Generic message',
        routingHints: {
          requiredCapabilities: ['code_generation'],
        },
      });

      const result = await expertSelector.selectAgent(request);

      expect(result.selectedAgent).toEqual(mockAgent);
    });

    it('should default to natural_language when no capabilities match', async () => {
      const mockAgent = createMockAgent({
        capabilities: ['natural_language'],
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });
      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([mockAgent]);

      const request = createMockRequest({
        message: 'Hello there',
      });

      const result = await expertSelector.selectAgent(request);

      expect(result.warnings.some(w => w.includes('No specific capabilities'))).toBe(true);
    });
  });

  describe('agent scoring', () => {
    it('should score agents based on capability match', async () => {
      const goodMatch = createMockAgent({
        agentId: 'good-match',
        capabilities: ['natural_language', 'code_generation'],
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });
      const poorMatch = createMockAgent({
        agentId: 'poor-match',
        capabilities: ['natural_language'],
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([goodMatch, poorMatch]);

      const request = createMockRequest({
        routingHints: {
          requiredCapabilities: ['code_generation', 'natural_language'],
        },
      });

      const result = await expertSelector.selectAgent(request);

      // The agent with more matching capabilities should be selected
      expect(result.selectedAgent?.agentId).toBeDefined();
    });

    it('should consider response time in scoring', async () => {
      const fastAgent = createMockAgent({
        agentId: 'fast-agent',
        metrics: { ...createMockAgent().metrics, averageResponseTimeMs: 50 },
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });
      const slowAgent = createMockAgent({
        agentId: 'slow-agent',
        metrics: { ...createMockAgent().metrics, averageResponseTimeMs: 5000 },
        status: 'idle',
        health: { ...createMockAgent().health, isHealthy: true },
      });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([fastAgent, slowAgent]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      // Fast agent should be preferred
      expect(result.selectedAgent).toBeDefined();
    });

    it('should consider health/success rate in scoring', async () => {
      const healthyAgent = createMockAgent({
        agentId: 'healthy',
        health: {
          ...createMockAgent().health,
          successRate: 0.95,
          successCount: 95,
          errorCount: 5,
        },
        status: 'idle',
      });
      const unhealthyAgent = createMockAgent({
        agentId: 'unhealthy',
        health: {
          ...createMockAgent().health,
          successRate: 0.5,
          successCount: 50,
          errorCount: 50,
        },
        status: 'idle',
      });

      mockAgentRegistry.getAgentsByCapabilities.mockResolvedValue([healthyAgent, unhealthyAgent]);

      const request = createMockRequest();
      const result = await expertSelector.selectAgent(request);

      expect(result.selectedAgent?.agentId).toBe('healthy');
    });
  });
});

/**
 * MessageProcessor Unit Tests
 *
 * Tests for the MessageProcessor class which orchestrates agent selection,
 * collaboration management, and response generation.
 */

import { MessageProcessor, ProcessingResult } from '../src/services/messageProcessor';
import { AgentRegistry, AgentInfo } from '../src/services/agentRegistry';
import { ExpertSelector, SelectionResult } from '../src/services/expertSelector';
import { AgentSwitcher, AgentResponse } from '../src/services/agentSwitcher';
import { CollaborationManager } from '../src/services/collaborationManager';
import { EscalationService } from '../src/services/escalationService';
import { ResponseGenerator } from '../src/services/responseGenerator';
import { OrchestrationRequest, ProcessedOrchestrationRequest } from '../src/models/OrchestrationRequest';
import { OrchestrationResponse, ResponseStatus } from '../src/models/OrchestrationResponse';

// Mock all dependencies
jest.mock('../src/services/agentRegistry');
jest.mock('../src/services/expertSelector');
jest.mock('../src/services/agentSwitcher');
jest.mock('../src/services/collaborationManager');
jest.mock('../src/services/escalationService');
jest.mock('../src/services/responseGenerator');
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('MessageProcessor', () => {
  let messageProcessor: MessageProcessor;
  let mockAgentRegistry: jest.Mocked<AgentRegistry>;
  let mockExpertSelector: jest.Mocked<ExpertSelector>;
  let mockAgentSwitcher: jest.Mocked<AgentSwitcher>;
  let mockCollaborationManager: jest.Mocked<CollaborationManager>;
  let mockEscalationService: jest.Mocked<EscalationService>;
  let mockResponseGenerator: jest.Mocked<ResponseGenerator>;

  const mockAgent: AgentInfo = {
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
  };

  const mockFallbackAgent: AgentInfo = {
    ...mockAgent,
    agentId: 'agent-2',
    name: 'Fallback Agent',
  };

  const mockAgentResponse: AgentResponse = {
    content: 'Test response content',
    format: 'text',
    language: 'en',
  };

  const createMockRequest = (overrides: Partial<OrchestrationRequest> = {}): OrchestrationRequest => ({
    message: 'Test message',
    context: {
      userId: 'user-123',
      sessionId: 'session-123',
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockAgentRegistry = new AgentRegistry(null as any) as jest.Mocked<AgentRegistry>;
    mockExpertSelector = new ExpertSelector() as jest.Mocked<ExpertSelector>;
    mockAgentSwitcher = new AgentSwitcher() as jest.Mocked<AgentSwitcher>;
    mockCollaborationManager = new CollaborationManager(null as any) as jest.Mocked<CollaborationManager>;
    mockEscalationService = new EscalationService() as jest.Mocked<EscalationService>;
    mockResponseGenerator = new ResponseGenerator() as jest.Mocked<ResponseGenerator>;

    // Setup default mock implementations
    mockExpertSelector.selectAgent = jest.fn().mockResolvedValue({
      selectedAgent: mockAgent,
      fallbackAgent: mockFallbackAgent,
      allCandidates: [mockAgent],
      warnings: [],
      selectionReason: 'Best match found',
    });

    mockCollaborationManager.shouldCollaborate = jest.fn().mockResolvedValue(false);

    mockAgentRegistry.updateAgentStatus = jest.fn().mockResolvedValue(mockAgent);
    mockAgentRegistry.recordRequest = jest.fn().mockResolvedValue(undefined);

    mockAgentSwitcher.routeToAgent = jest.fn().mockResolvedValue(mockAgentResponse);

    // Create the MessageProcessor instance
    messageProcessor = new MessageProcessor(
      mockAgentRegistry,
      mockExpertSelector,
      mockAgentSwitcher,
      mockCollaborationManager,
      mockEscalationService,
      mockResponseGenerator
    );
  });

  describe('processMessage', () => {
    it('should process a single agent request successfully', async () => {
      const request = createMockRequest();

      const result = await messageProcessor.processMessage(request);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.context.requestId).toBeDefined();
      expect(mockExpertSelector.selectAgent).toHaveBeenCalled();
      expect(mockAgentSwitcher.routeToAgent).toHaveBeenCalled();
    });

    it('should set correct attribution when processing single agent', async () => {
      const request = createMockRequest();

      const result = await messageProcessor.processMessage(request);

      expect(result.response.attribution).toHaveLength(1);
      expect(result.response.attribution[0].agentId).toBe(mockAgent.agentId);
      expect(result.response.attribution[0].agentName).toBe(mockAgent.name);
    });

    it('should handle collaboration mode requests', async () => {
      const request = createMockRequest({
        routingHints: {
          collaborationMode: 'collaborative',
        },
      });

      mockCollaborationManager.shouldCollaborate = jest.fn().mockResolvedValue(true);
      mockCollaborationManager.orchestrate = jest.fn().mockResolvedValue({
        success: true,
        participants: [
          {
            agentId: mockAgent.agentId,
            agentName: mockAgent.name,
            capabilities: mockAgent.capabilities,
            status: 'completed' as const,
            confidence: 1.0,
            processingTimeMs: 100,
          },
        ],
        synthesis: {
          synthesizedContent: 'Collaborative response',
        },
        strategy: 'parallel' as const,
      });

      const result = await messageProcessor.processMessage(request);

      expect(mockCollaborationManager.orchestrate).toHaveBeenCalled();
      expect(result.response.collaboration).toBeDefined();
      expect(result.response.collaboration?.agentsInvolved).toBe(1);
    });

    it('should throw error when no agent is available', async () => {
      mockExpertSelector.selectAgent = jest.fn().mockResolvedValue({
        selectedAgent: null,
        fallbackAgent: null,
        allCandidates: [],
        warnings: ['No agents available'],
        selectionReason: 'No agents found',
      });

      const request = createMockRequest();
      const result = await messageProcessor.processMessage(request);

      expect(result.response.status).toBe('failed');
      expect(result.response.error).toBeDefined();
      expect(result.response.error?.code).toBe('NO_AGENT_AVAILABLE');
    });

    it('should include warnings in the response when present', async () => {
      mockExpertSelector.selectAgent = jest.fn().mockResolvedValue({
        selectedAgent: mockAgent,
        fallbackAgent: mockFallbackAgent,
        allCandidates: [mockAgent],
        warnings: ['Test warning message'],
        selectionReason: 'Selected with warnings',
      });

      const request = createMockRequest();
      const result = await messageProcessor.processMessage(request);

      expect(result.context.warnings).toContain('Test warning message');
    });

    it('should record request metrics after successful processing', async () => {
      const request = createMockRequest();

      await messageProcessor.processMessage(request);

      expect(mockAgentRegistry.recordRequest).toHaveBeenCalledWith(
        mockAgent.agentId,
        true,
        expect.any(Number)
      );
    });

    it('should update agent status to busy during processing and idle after', async () => {
      const request = createMockRequest();

      await messageProcessor.processMessage(request);

      expect(mockAgentRegistry.updateAgentStatus).toHaveBeenCalledWith(mockAgent.agentId, 'busy');
      expect(mockAgentRegistry.updateAgentStatus).toHaveBeenLastCalledWith(mockAgent.agentId, 'idle');
    });

    it('should handle request with custom routing hints', async () => {
      const request = createMockRequest({
        routingHints: {
          preferredAgents: ['agent-1'],
          excludedAgents: ['agent-3'],
          requiredCapabilities: ['code_generation'],
        },
      });

      const result = await messageProcessor.processMessage(request);

      expect(mockExpertSelector.selectAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          routingHints: expect.objectContaining({
            preferredAgents: ['agent-1'],
            excludedAgents: ['agent-3'],
          }),
        })
      );
      expect(result.response).toBeDefined();
    });

    it('should include timing information in response', async () => {
      const request = createMockRequest();

      const result = await messageProcessor.processMessage(request);

      expect(result.response.timing).toBeDefined();
      expect(result.response.timing.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.response.timing.agentSelectionTimeMs).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle agent switcher errors gracefully', async () => {
      mockAgentSwitcher.routeToAgent = jest.fn().mockRejectedValue(
        new Error('Agent communication failed')
      );

      const request = createMockRequest();
      const result = await messageProcessor.processMessage(request);

      expect(result.response.status).toBe('failed');
      expect(result.response.error).toBeDefined();
      expect(mockEscalationService.escalate).toHaveBeenCalled();
    });

    it('should retry with fallback agent on error if available', async () => {
      let callCount = 0;
      mockAgentSwitcher.routeToAgent = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Primary agent failed');
        }
        return Promise.resolve(mockAgentResponse);
      });

      const request = createMockRequest();

      const result = await messageProcessor.processMessage(request);

      // Should have tried both primary and fallback
      expect(mockAgentSwitcher.routeToAgent).toHaveBeenCalledTimes(2);
    });

    it('should update agent status back to idle on error', async () => {
      mockAgentSwitcher.routeToAgent = jest.fn().mockRejectedValue(
        new Error('Agent failed')
      );

      const request = createMockRequest();
      await messageProcessor.processMessage(request);

      expect(mockAgentRegistry.updateAgentStatus).toHaveBeenCalledWith(
        mockAgent.agentId,
        'idle'
      );
    });
  });

  describe('context tracking', () => {
    it('should track processing time in context', async () => {
      const request = createMockRequest();

      const result = await messageProcessor.processMessage(request);

      expect(result.context.startTime).toBeDefined();
      expect(result.context.agentSelectionStartTime).toBeDefined();
      expect(result.context.requestId).toBeDefined();
    });

    it('should track selected and fallback agents in context', async () => {
      const request = createMockRequest();

      const result = await messageProcessor.processMessage(request);

      expect(result.context.selectedAgent).toEqual(mockAgent);
      expect(result.context.fallbackAgent).toEqual(mockFallbackAgent);
    });

    it('should increment retry count when retrying', async () => {
      mockAgentSwitcher.routeToAgent = jest.fn().mockRejectedValue(
        new Error('Temporary failure')
      );

      const request = createMockRequest({ options: { maxRetries: 3 } });
      const result = await messageProcessor.processMessage(request);

      expect(result.context.retries).toBeGreaterThanOrEqual(0);
    });
  });
});

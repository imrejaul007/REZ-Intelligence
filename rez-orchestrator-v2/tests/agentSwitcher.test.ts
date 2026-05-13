/**
 * AgentSwitcher Unit Tests
 *
 * Tests for the AgentSwitcher class which handles routing requests to agents
 * and managing fallback behavior.
 */

import { AgentSwitcher, AgentResponse } from '../src/services/agentSwitcher';
import { AgentInfo } from '../src/services/agentRegistry';
import { ProcessedOrchestrationRequest } from '../src/models/OrchestrationRequest';
import { ProcessingContext } from '../src/services/messageProcessor';

// Mock dependencies
jest.mock('axios');
jest.mock('../src/config', () => ({
  appConfig: {
    agent: {
      maxResponseTimeMs: 30000,
      healthCheckTimeoutMs: 5000,
    },
    responseTime: {
      thresholdMs: 5000,
      alertThresholdMs: 10000,
    },
    internalServiceTokens: {
      orchestrator: 'test-token',
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

import axios from 'axios';

describe('AgentSwitcher', () => {
  let agentSwitcher: AgentSwitcher;

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

  const createMockContext = (overrides: Partial<ProcessingContext> = {}): ProcessingContext => ({
    requestId: 'req-123',
    startTime: Date.now(),
    retries: 0,
    warnings: [],
    ...overrides,
  });

  const createMockRequest = (): ProcessedOrchestrationRequest => ({
    requestId: 'req-123',
    message: 'Test message',
    timestamp: new Date(),
    priority: 'normal',
    context: {
      userId: 'user-123',
      sessionId: 'session-123',
    },
    options: {
      timeoutMs: 5000,
      maxRetries: 3,
      fallbackEnabled: true,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    agentSwitcher = new AgentSwitcher();
  });

  describe('routeToAgent', () => {
    it('should successfully route to agent and return response', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext();
      const mockResponse: AgentResponse = {
        content: 'Test response content',
        format: 'text',
        language: 'en',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      });

      const result = await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/process'),
        expect.objectContaining({
          requestId: mockRequest.requestId,
          message: mockRequest.message,
        }),
        expect.any(Object)
      );
    });

    it('should handle JSON response format', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext();

      const jsonData = { content: { result: 'success' }, format: 'json' };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: jsonData,
      });

      const result = await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(result.format).toBe('json');
      expect(result.metadata).toBeDefined();
    });

    it('should handle string response', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext();

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: 'Simple string response',
      });

      const result = await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(result.content).toBe('Simple string response');
      expect(result.format).toBe('text');
    });

    it('should include request metadata in the call', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest({
        metadata: { source: 'test' },
      });
      const mockContext = createMockContext();

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: { content: 'test' },
      });

      await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({
            orchestratedBy: 'rez-orchestrator-v2',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should use custom timeout from request options', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      mockRequest.options!.timeoutMs = 10000;
      const mockContext = createMockContext();

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: { content: 'test' },
      });

      await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });

    it('should throw error on agent failure without fallback', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext({ fallbackAgent: undefined });

      (axios.post as jest.Mock).mockRejectedValueOnce(new Error('Agent unreachable'));

      await expect(
        agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext)
      ).rejects.toThrow('Agent unreachable');
    });

    it('should try fallback agent on primary failure', async () => {
      const primaryAgent = createMockAgent({ agentId: 'primary', name: 'Primary Agent' });
      const fallbackAgent = createMockAgent({ agentId: 'fallback', name: 'Fallback Agent' });
      const mockRequest = createMockRequest();
      const mockContext = createMockContext({ fallbackAgent });

      (axios.post as jest.Mock)
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce({
          status: 200,
          data: { content: 'Fallback response', format: 'text' },
        });

      const result = await agentSwitcher.routeToAgent(primaryAgent, mockRequest, mockContext);

      expect(result.content).toBe('Fallback response');
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('should throw if both primary and fallback fail', async () => {
      const primaryAgent = createMockAgent({ agentId: 'primary' });
      const fallbackAgent = createMockAgent({ agentId: 'fallback' });
      const mockRequest = createMockRequest();
      const mockContext = createMockContext({ fallbackAgent });

      (axios.post as jest.Mock).mockRejectedValue(new Error('Both failed'));

      await expect(
        agentSwitcher.routeToAgent(primaryAgent, mockRequest, mockContext)
      ).rejects.toThrow('Both failed');
    });

    it('should handle timeout errors', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext({ fallbackAgent: undefined });

      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      (axios.post as jest.Mock).mockRejectedValue(timeoutError);

      await expect(
        agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext)
      ).rejects.toThrow(/timed out/);
    });

    it('should handle HTTP error responses', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext({ fallbackAgent: undefined });

      const errorResponse = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
        message: 'Request failed',
      };
      (axios.post as jest.Mock).mockRejectedValue(errorResponse);

      await expect(
        agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext)
      ).rejects.toThrow(/500/);
    });

    it('should not call fallback if fallback is same as primary', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext({ fallbackAgent: mockAgent });

      (axios.post as jest.Mock).mockRejectedValue(new Error('Failed'));

      await expect(
        agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext)
      ).rejects.toThrow();

      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck', () => {
    it('should return true when agent is healthy', async () => {
      const mockAgent = createMockAgent();

      (axios.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
      });

      const result = await agentSwitcher.healthCheck(mockAgent);

      expect(result).toBe(true);
    });

    it('should return false when agent health check fails', async () => {
      const mockAgent = createMockAgent();

      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Health check failed'));

      const result = await agentSwitcher.healthCheck(mockAgent);

      expect(result).toBe(false);
    });

    it('should return false when agent returns non-200 status', async () => {
      const mockAgent = createMockAgent();

      (axios.get as jest.Mock).mockResolvedValueOnce({
        status: 503,
      });

      const result = await agentSwitcher.healthCheck(mockAgent);

      expect(result).toBe(false);
    });
  });

  describe('getAgentStatus', () => {
    it('should return agent status when available', async () => {
      const mockAgent = createMockAgent();

      (axios.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          available: true,
          currentLoad: 5,
          queueLength: 2,
        },
      });

      const result = await agentSwitcher.getAgentStatus(mockAgent);

      expect(result.available).toBe(true);
      expect(result.currentLoad).toBe(5);
      expect(result.queueLength).toBe(2);
    });

    it('should return unavailable status on error', async () => {
      const mockAgent = createMockAgent();

      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

      const result = await agentSwitcher.getAgentStatus(mockAgent);

      expect(result.available).toBe(false);
      expect(result.currentLoad).toBe(0);
      expect(result.queueLength).toBe(0);
    });

    it('should handle missing fields in response with defaults', async () => {
      const mockAgent = createMockAgent();

      (axios.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {},
      });

      const result = await agentSwitcher.getAgentStatus(mockAgent);

      expect(result.available).toBe(true);
      expect(result.currentLoad).toBe(0);
      expect(result.queueLength).toBe(0);
    });
  });

  describe('response parsing', () => {
    it('should parse structured response correctly', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext();

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          content: 'Structured response',
          format: 'markdown',
          language: 'en',
          metadata: { key: 'value' },
        },
      });

      const result = await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(result.content).toBe('Structured response');
      expect(result.format).toBe('markdown');
      expect(result.language).toBe('en');
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should handle object without content property', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext();

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: { result: 'success', status: 'ok' },
      });

      const result = await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(result.format).toBe('json');
      expect(result.metadata).toEqual({ result: 'success', status: 'ok' });
    });

    it('should default to text format for unknown data types', async () => {
      const mockAgent = createMockAgent();
      const mockRequest = createMockRequest();
      const mockContext = createMockContext();

      (axios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: null,
      });

      const result = await agentSwitcher.routeToAgent(mockAgent, mockRequest, mockContext);

      expect(result.format).toBe('text');
      expect(result.content).toBe('null');
    });
  });
});

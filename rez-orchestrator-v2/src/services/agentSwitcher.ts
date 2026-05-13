import axios, { AxiosError } from 'axios';
import { AgentInfo } from './agentRegistry';
import { ProcessedOrchestrationRequest } from '../models/OrchestrationRequest';
import { ProcessingContext } from './messageProcessor';
import { appConfig } from '../config';
import { logger } from '../utils/logger';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  getCircuitBreakerRegistry,
  CircuitState,
} from './circuitBreaker';

export interface AgentResponse {
  content: string;
  format: 'text' | 'json' | 'html' | 'markdown' | 'code';
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface SwitchResult {
  success: boolean;
  response: AgentResponse | null;
  agentUsed: AgentInfo;
  switchReason?: string;
  error?: string;
}

export class AgentSwitcher {
  private maxRetries: number;
  private defaultTimeout: number;
  private circuitRegistry: CircuitBreakerRegistry;

  constructor() {
    this.maxRetries = 2;
    this.defaultTimeout = appConfig.agent.maxResponseTimeMs;
    this.circuitRegistry = getCircuitBreakerRegistry();
  }

  /**
   * Get circuit breaker for an agent
   */
  private getCircuitBreaker(agent: AgentInfo): CircuitBreaker {
    return this.circuitRegistry.getCircuit(agent.agentId);
  }

  async routeToAgent(
    agent: AgentInfo,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const circuit = this.getCircuitBreaker(agent);

    logger.debug('Routing request to agent', {
      requestId: context.requestId,
      agentId: agent.agentId,
      agentName: agent.name,
      endpoint: agent.endpoint,
      circuitState: circuit.getState(),
    });

    // Check circuit breaker
    if (!circuit.canExecute()) {
      logger.warn('Circuit breaker is open, skipping agent', {
        requestId: context.requestId,
        agentId: agent.agentId,
        circuitState: circuit.getState(),
      });

      // Try fallback agent if available
      if (context.fallbackAgent && context.fallbackAgent.agentId !== agent.agentId) {
        const fallbackCircuit = this.getCircuitBreaker(context.fallbackAgent);
        if (fallbackCircuit.canExecute()) {
          logger.info('Using fallback agent due to circuit breaker', {
            requestId: context.requestId,
            primaryAgent: agent.name,
            fallbackAgent: context.fallbackAgent.name,
          });
          return this.routeToAgentWithFallback(agent, context.fallbackAgent, request, context);
        }
      }

      throw new Error(`Circuit breaker is open for agent ${agent.name}`);
    }

    try {
      const response = await this.sendToAgent(agent, request, context);
      const responseTimeMs = Date.now() - startTime;

      // Record success with circuit breaker
      circuit.recordSuccess(responseTimeMs);

      if (responseTimeMs > appConfig.responseTime.alertThresholdMs) {
        logger.warn('Agent response time exceeded alert threshold', {
          requestId: context.requestId,
          agentId: agent.agentId,
          responseTimeMs,
          threshold: appConfig.responseTime.alertThresholdMs,
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failure with circuit breaker
      circuit.recordFailure(errorMessage);

      logger.error('Agent request failed', {
        requestId: context.requestId,
        agentId: agent.agentId,
        agentName: agent.name,
        error: errorMessage,
        circuitState: circuit.getState(),
      });

      // Try fallback agent if configured and circuit is open
      if (context.fallbackAgent && context.fallbackAgent.agentId !== agent.agentId) {
        const fallbackCircuit = this.getCircuitBreaker(context.fallbackAgent);
        if (fallbackCircuit.canExecute()) {
          logger.info('Attempting fallback agent', {
            requestId: context.requestId,
            fallbackAgentId: context.fallbackAgent.agentId,
          });
          return this.routeToAgentWithFallback(agent, context.fallbackAgent, request, context);
        }
      }

      throw error;
    }
  }

  private async routeToAgentWithFallback(
    primaryAgent: AgentInfo,
    fallbackAgent: AgentInfo,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): Promise<AgentResponse> {
    logger.info('Switching to fallback agent', {
      requestId: context.requestId,
      primaryAgent: primaryAgent.name,
      fallbackAgent: fallbackAgent.name,
      switchReason: 'Primary agent failed',
    });

    try {
      const response = await this.sendToAgent(fallbackAgent, request, context);

      logger.info('Fallback agent succeeded', {
        requestId: context.requestId,
        fallbackAgent: fallbackAgent.name,
      });

      return response;
    } catch (fallbackError) {
      logger.error('Fallback agent also failed', {
        requestId: context.requestId,
        fallbackAgent: fallbackAgent.name,
        error: fallbackError instanceof Error ? fallbackError.message : 'Unknown',
      });

      // Both agents failed, throw original error
      throw fallbackError;
    }
  }

  private async sendToAgent(
    agent: AgentInfo,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): Promise<AgentResponse> {
    const timeout = request.options?.timeoutMs || this.defaultTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await axios.post(
        `${agent.endpoint}/process`,
        {
          requestId: request.requestId,
          message: request.message,
          context: request.context,
          options: request.options,
          metadata: {
            ...request.metadata,
            orchestratedBy: 'rez-orchestrator-v2',
            originalTimestamp: request.timestamp,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': this.getServiceToken(),
            'X-Request-Id': context.requestId,
          },
          signal: controller.signal,
          timeout,
        }
      );

      clearTimeout(timeoutId);

      return this.parseAgentResponse(response.data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.code === 'ECONNABORTED') {
          throw new Error(`Agent request timed out after ${timeout}ms`);
        }

        if (axiosError.response) {
          throw new Error(
            `Agent returned error ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`
          );
        }

        throw new Error(`Agent request failed: ${axiosError.message}`);
      }

      throw error;
    }
  }

  private parseAgentResponse(data: any): AgentResponse {
    if (typeof data === 'string') {
      return { content: data, format: 'text' };
    }

    if (data.content !== undefined) {
      return {
        content: data.content,
        format: data.format || 'text',
        language: data.language,
        metadata: data.metadata,
      };
    }

    if (typeof data === 'object') {
      return {
        content: JSON.stringify(data, null, 2),
        format: 'json',
        metadata: data,
      };
    }

    return { content: String(data), format: 'text' };
  }

  private getServiceToken(): string {
    const tokens = appConfig.internalServiceTokens;
    return tokens['orchestrator'] || '';
  }

  async healthCheck(agent: AgentInfo): Promise<boolean> {
    try {
      const response = await axios.get(`${agent.endpoint}/health`, {
        timeout: appConfig.agent.healthCheckTimeoutMs,
        headers: {
          'X-Internal-Token': this.getServiceToken(),
        },
      });

      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getAgentStatus(agent: AgentInfo): Promise<{
    available: boolean;
    currentLoad: number;
    queueLength: number;
  }> {
    try {
      const response = await axios.get(`${agent.endpoint}/status`, {
        timeout: appConfig.agent.healthCheckTimeoutMs,
        headers: {
          'X-Internal-Token': this.getServiceToken(),
        },
      });

      return {
        available: response.data.available ?? true,
        currentLoad: response.data.currentLoad ?? 0,
        queueLength: response.data.queueLength ?? 0,
      };
    } catch {
      return {
        available: false,
        currentLoad: 0,
        queueLength: 0,
      };
    }
  }
}

export const createAgentSwitcher = (): AgentSwitcher => {
  return new AgentSwitcher();
};

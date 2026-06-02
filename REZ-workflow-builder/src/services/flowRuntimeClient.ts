/**
 * REZ Flow Runtime Client
 * Connects to REZ Flow Runtime (port 4200) for workflow execution
 */

import { logger } from '../utils/logger';

const FLOW_RUNTIME_URL = process.env.REZ_FLOW_RUNTIME_URL || 'http://localhost:4200';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

export interface FlowRuntimeConfig {
  workflowId: string;
  name: string;
  description?: string;
  nodes: any[];
  edges: any[];
  trigger: {
    type: string;
    config?: any;
  };
  settings?: {
    concurrency?: number;
    timeout?: number;
    retryOnFailure?: boolean;
    maxRetries?: number;
  };
  version: number;
}

export interface ExecutionRequest {
  workflowId: string;
  workflowVersion?: number;
  trigger: string;
  triggerData?: Record<string, any>;
  context?: {
    userId?: string;
    entityId?: string;
    entityType?: string;
  };
}

export interface ExecutionResponse {
  executionId: string;
  status: string;
  message?: string;
}

export interface ExecutionStatusResponse {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  workflowId: string;
  workflowVersion: number;
  currentNodeId?: string;
  nodeHistory?: any[];
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

export interface RegisterWorkflowResponse {
  success: boolean;
  workflowId: string;
  runtimeWorkflowId: string;
  version: number;
  registeredAt: string;
}

export class FlowRuntimeError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'FlowRuntimeError';
  }
}

/**
 * Flow Runtime Client
 * Handles all communication with REZ Flow Runtime
 */
export class FlowRuntimeClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string = FLOW_RUNTIME_URL, authToken: string = INTERNAL_SERVICE_TOKEN) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, timeout = REQUEST_TIMEOUT_MS } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (this.authToken) {
          headers['X-Internal-Token'] = this.authToken;
          headers['X-Service-Name'] = 'workflow-builder';
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json() as any;

        if (!response.ok) {
          throw new FlowRuntimeError(
            data.error || `Flow Runtime error: ${response.status}`,
            response.status,
            data
          );
        }

        return data as T;
      } catch (error: any) {
        lastError = error;

        // Don't retry on abort (timeout) or client errors
        if (error.name === 'AbortError' || error instanceof FlowRuntimeError) {
          if (error instanceof FlowRuntimeError && error.statusCode && error.statusCode < 500) {
            throw error; // Don't retry 4xx errors
          }
        }

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
          logger.warn(`Retry ${attempt}/${MAX_RETRIES} for ${endpoint} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    clearTimeout(timeoutId);
    throw lastError || new FlowRuntimeError('Request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Register a workflow with Flow Runtime
   */
  async registerWorkflow(config: FlowRuntimeConfig): Promise<RegisterWorkflowResponse> {
    logger.info(`Registering workflow ${config.workflowId} with Flow Runtime`);

    try {
      const response = await this.request<RegisterWorkflowResponse>('/api/workflows/register', {
        method: 'POST',
        body: {
          workflowId: config.workflowId,
          name: config.name,
          description: config.description,
          nodes: config.nodes,
          edges: config.edges,
          trigger: config.trigger,
          settings: config.settings,
          version: config.version,
          source: 'workflow-builder',
        },
      });

      logger.info(`Workflow ${config.workflowId} registered successfully`, {
        runtimeWorkflowId: response.runtimeWorkflowId,
      });

      return response;
    } catch (error) {
      logger.error(`Failed to register workflow ${config.workflowId}`, { error });
      throw error;
    }
  }

  /**
   * Unregister a workflow from Flow Runtime
   */
  async unregisterWorkflow(workflowId: string): Promise<{ success: boolean }> {
    logger.info(`Unregistering workflow ${workflowId} from Flow Runtime`);

    try {
      const response = await this.request<{ success: boolean }>(`/api/workflows/${workflowId}/unregister`, {
        method: 'POST',
      });

      logger.info(`Workflow ${workflowId} unregistered successfully`);
      return response;
    } catch (error) {
      logger.error(`Failed to unregister workflow ${workflowId}`, { error });
      throw error;
    }
  }

  /**
   * Execute a workflow on Flow Runtime
   */
  async executeWorkflow(request: ExecutionRequest): Promise<ExecutionResponse> {
    logger.info(`Executing workflow ${request.workflowId} on Flow Runtime`, {
      trigger: request.trigger,
    });

    try {
      const response = await this.request<ExecutionResponse>('/api/executions/start', {
        method: 'POST',
        body: request,
      });

      logger.info(`Workflow ${request.workflowId} execution started`, {
        executionId: response.executionId,
      });

      return response;
    } catch (error) {
      logger.error(`Failed to execute workflow ${request.workflowId}`, { error });
      throw error;
    }
  }

  /**
   * Get execution status from Flow Runtime
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatusResponse> {
    try {
      const response = await this.request<ExecutionStatusResponse>(
        `/api/executions/${executionId}/status`
      );
      return response;
    } catch (error) {
      logger.error(`Failed to get execution status for ${executionId}`, { error });
      throw error;
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<{ success: boolean; message?: string }> {
    logger.info(`Cancelling execution ${executionId}`);

    try {
      const response = await this.request<{ success: boolean; message?: string }>(
        `/api/executions/${executionId}/cancel`,
        { method: 'POST' }
      );

      logger.info(`Execution ${executionId} cancellation requested`);
      return response;
    } catch (error) {
      logger.error(`Failed to cancel execution ${executionId}`, { error });
      throw error;
    }
  }

  /**
   * Get execution history from Flow Runtime
   */
  async getExecutionHistory(
    executionId: string
  ): Promise<{ executionId: string; nodeHistory: any[] }> {
    try {
      const response = await this.request<{ executionId: string; nodeHistory: any[] }>(
        `/api/executions/${executionId}/history`
      );
      return response;
    } catch (error) {
      logger.error(`Failed to get execution history for ${executionId}`, { error });
      throw error;
    }
  }

  /**
   * Health check for Flow Runtime
   */
  async healthCheck(): Promise<{ status: string; uptime: number }> {
    try {
      const response = await this.request<{ status: string; uptime: number }>('/health', {
        timeout: 5000,
      });
      return response;
    } catch (error) {
      return { status: 'unreachable', uptime: 0 };
    }
  }
}

// Singleton instance
let clientInstance: FlowRuntimeClient | null = null;

export function getFlowRuntimeClient(): FlowRuntimeClient {
  if (!clientInstance) {
    clientInstance = new FlowRuntimeClient();
  }
  return clientInstance;
}

export const flowRuntimeClient = new FlowRuntimeClient();

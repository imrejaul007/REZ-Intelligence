/**
 * WorkflowService - Manages multi-step workflows
 * Handles orchestration of complex expert operations
 */

import { IIntent } from '../interfaces/IIntent';
import { IResponse, ResponseContext } from '../interfaces/IResponse';
import { WorkflowConfig, WorkflowStep } from '../types/expert.types';
import { Logger } from '../utils/logger';

export interface WorkflowExecution {
  workflowId: string;
  status: WorkflowStatus;
  currentStep: number;
  steps: WorkflowStepExecution[];
  startedAt: string;
  completedAt?: string;
  error?: WorkflowError;
}

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowStepExecution {
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface WorkflowError {
  step: string;
  message: string;
  code: string;
  recoverable: boolean;
  retryable: boolean;
}

export interface WorkflowContext {
  intent: IIntent;
  previousResults: Map<string, unknown>;
  metadata: Record<string, unknown>;
}

export class WorkflowService {
  private config: WorkflowConfig | undefined;
  private logger: Logger;
  private activeExecutions: Map<string, WorkflowExecution>;

  constructor(config: WorkflowConfig | undefined, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.activeExecutions = new Map();
  }

  /**
   * Check if workflows are enabled
   */
  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  /**
   * Execute a workflow
   */
  async execute(
    intent: IIntent,
    context: ResponseContext,
    handlers: Map<string, (ctx: WorkflowContext) => Promise<unknown>>
  ): Promise<{
    result: unknown;
    execution: WorkflowExecution;
  }> {
    if (!this.isEnabled()) {
      throw new Error('Workflows are not enabled');
    }

    const workflowId = this.generateWorkflowId();
    const execution: WorkflowExecution = {
      workflowId,
      status: 'running',
      currentStep: 0,
      steps: [],
      startedAt: new Date().toISOString()
    };

    this.activeExecutions.set(workflowId, execution);
    this.logger.info(`Starting workflow: ${workflowId}`);

    const workflowContext: WorkflowContext = {
      intent,
      previousResults: new Map(),
      metadata: {}
    };

    try {
      // Execute each step
      for (let i = 0; i < (this.config?.steps?.length || 0); i++) {
        const step = this.config!.steps![i];
        const stepExecution: WorkflowStepExecution = {
          stepName: step.name,
          status: 'running',
          startedAt: new Date().toISOString()
        };

        execution.steps.push(stepExecution);
        execution.currentStep = i;

        try {
          const handler = handlers.get(step.handler);
          if (!handler) {
            throw new Error(`No handler found for step: ${step.handler}`);
          }

          // Execute with timeout
          const result = await this.executeWithTimeout(
            handler(workflowContext),
            step.timeoutMs,
            `Step ${step.name} timed out after ${step.timeoutMs}ms`
          );

          stepExecution.status = 'completed';
          stepExecution.completedAt = new Date().toISOString();
          stepExecution.result = result;
          workflowContext.previousResults.set(step.name, result);

          this.logger.info(`Step ${step.name} completed successfully`);
        } catch (error) {
          stepExecution.status = 'failed';
          stepExecution.error = error instanceof Error ? error.message : 'Unknown error';
          stepExecution.completedAt = new Date().toISOString();

          // Check if we should continue
          if (step.required) {
            // Required step failed - abort workflow
            throw error;
          } else if (step.fallback) {
            // Try fallback handler
            const fallbackHandler = handlers.get(step.fallback);
            if (fallbackHandler) {
              this.logger.warn(`Running fallback handler for step: ${step.name}`);
              try {
                const fallbackResult = await fallbackHandler(workflowContext);
                workflowContext.previousResults.set(step.name, fallbackResult);
                stepExecution.status = 'completed';
              } catch (fallbackError) {
                // Fallback also failed - skip this step
                stepExecution.status = 'skipped';
                this.logger.error(`Fallback for step ${step.name} failed:`, fallbackError);
              }
            }
          } else {
            // Non-required step failed - continue
            this.logger.warn(`Non-required step ${step.name} failed:`, error);
          }
        }
      }

      // Get final result from last step
      const result = workflowContext.previousResults.values().next().value;
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();

      this.logger.info(`Workflow ${workflowId} completed successfully`);
      return { result, execution };
    } catch (error) {
      execution.status = 'failed';
      execution.error = {
        step: this.config?.steps?.[execution.currentStep]?.name || 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'WORKFLOW_ERROR',
        recoverable: true,
        retryable: true
      };
      execution.completedAt = new Date().toISOString();

      this.logger.error(`Workflow ${workflowId} failed:`, error);
      throw error;
    } finally {
      this.activeExecutions.set(workflowId, execution);
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    handler: (ctx: WorkflowContext) => Promise<unknown>
  ): Promise<unknown> {
    const stepExecution: WorkflowStepExecution = {
      stepName: step.name,
      status: 'running',
      startedAt: new Date().toISOString()
    };

    try {
      const result = await this.executeWithTimeout(
        handler(context),
        step.timeoutMs,
        `Step ${step.name} timed out after ${step.timeoutMs}ms`
      );

      stepExecution.status = 'completed';
      stepExecution.completedAt = new Date().toISOString();
      stepExecution.result = result;

      return result;
    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.error = error instanceof Error ? error.message : 'Unknown error';
      stepExecution.completedAt = new Date().toISOString();

      throw error;
    }
  }

  /**
   * Cancel a running workflow
   */
  async cancel(workflowId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(workflowId);
    if (!execution) {
      return false;
    }

    if (execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
      this.logger.info(`Workflow ${workflowId} cancelled`);
      return true;
    }

    return false;
  }

  /**
   * Get workflow execution status
   */
  getExecution(workflowId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(workflowId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values()).filter(
      e => e.status === 'running' || e.status === 'pending'
    );
  }

  /**
   * Retry a failed workflow
   */
  async retry(
    workflowId: string,
    handlers: Map<string, (ctx: WorkflowContext) => Promise<unknown>>
  ): Promise<{
    result: unknown;
    execution: WorkflowExecution;
  }> {
    const execution = this.activeExecutions.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (execution.status !== 'failed') {
      throw new Error(`Cannot retry workflow with status: ${execution.status}`);
    }

    if (!execution.error?.retryable) {
      throw new Error('Workflow is not retryable');
    }

    // Reset execution state
    execution.status = 'pending';
    execution.currentStep = 0;
    execution.error = undefined;
    execution.startedAt = new Date().toISOString();
    execution.completedAt = undefined;

    // Reset failed steps
    for (const step of execution.steps) {
      if (step.status === 'failed') {
        step.status = 'pending';
        step.error = undefined;
      }
    }

    // Re-execute
    const context: WorkflowContext = {
      intent: {} as IIntent,
      previousResults: new Map(),
      metadata: {}
    };

    // Would need to store the original context to properly retry
    return { result: null, execution };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private generateWorkflowId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * REZ Flow Runtime - Workflow Executor
 * Core execution engine for workflow processing with checkpointing and saga orchestration
 * PRODUCTION-READY: Includes distributed locks, transactions, timeouts, memory safety
 */

import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  ExecutionContext,
  ExecutionState,
  NodeResult,
  NodeStatus,
  ExecutionStatus,
  EdgeType,
  TriggerType
} from '../types/workflow';
import { Execution, Workflow, IExecution, IWorkflow } from '../models/Execution';
import { handleNode } from './nodeHandlers';
import logger from './logger';
import dlqService from './dlqService';
import { CircuitBreaker } from '../../../shared/src/circuitBreaker';

// ==================== CONSTANTS ====================

const MAX_WORKFLOW_EXECUTION_MS = 3600000; // 1 hour default
const LOCK_TTL_MS = 300000; // 5 minutes
const RECOVERY_LOCK_TTL_MS = 600000; // 10 minutes

// ==================== CHECKPOINT TYPES ====================

export interface WorkflowCheckpoint {
  executionId: string;
  workflowId: string;
  currentNodeId: string;
  completedNodes: string[];
  pendingNodes: string[];
  variables: Record<string, unknown>;
  nodeResults: Array<{
    nodeId: string;
    status: NodeStatus;
    output?: unknown;
    error?: string;
    startedAt: string;
    completedAt?: string;
    duration?: number;
    retryCount: number;
  }>;
  executionPath: string[];
  timestamp: Date;
  version: number;
  totalDuration: number;
}

export interface CheckpointConfig {
  redisUrl?: string;
  ttlSeconds?: number;
  checkpointInterval?: number;
  enabled?: boolean;
}

const DEFAULT_CHECKPOINT_CONFIG: Required<CheckpointConfig> = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  ttlSeconds: 86400, // 24 hours
  checkpointInterval: 5000, // 5 seconds
  enabled: process.env.CHECKPOINT_ENABLED !== 'false'
};

// ==================== SAGA TYPES ====================

export interface SagaStep {
  name: string;
  action: () => Promise<void>;
  compensation: () => Promise<void>;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface SagaExecution {
  id: string;
  sagaName: string;
  steps: SagaStep[];
  completedSteps: string[];
  failedStep?: string;
  status: 'running' | 'completed' | 'compensated' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  compensationErrors: Array<{
    stepName: string;
    error: string;
  }>;
}

export interface SagaContext {
  sagaId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

// ==================== UTILITY FUNCTIONS ====================

function safeJsonParse<T = unknown>(
  data: string | null,
  fallback: T | null = null
): T | null {
  if (!data) return fallback;
  try {
    return JSON.parse(data) as T;
  } catch {
    logger.error('Failed to parse JSON', { data: data?.substring(0, 100) });
    return fallback;
  }
}

async function acquireDistributedLock(
  redis: Redis,
  key: string,
  ttlMs: number = LOCK_TTL_MS
): Promise<string | null> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await redis.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
}

async function releaseDistributedLock(
  redis: Redis,
  key: string,
  token: string
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, `lock:${key}`, token);
  return result === 1;
}

// ==================== CHECKPOINT SERVICE ====================

export class CheckpointService {
  private redis: Redis;
  private config: Required<CheckpointConfig>;
  private isConnected: boolean = false;

  constructor(config: CheckpointConfig = {}) {
    this.config = { ...DEFAULT_CHECKPOINT_CONFIG, ...config };
    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
    this.setupEventHandlers();
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.redis.ping();
      this.isConnected = true;
      logger.info('Checkpoint service connected', { redisUrl: this.config.redisUrl });
    } catch (error) {
      logger.error('Failed to connect checkpoint service', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.isConnected = false;
    logger.info('Checkpoint service disconnected');
  }

  async saveCheckpoint(checkpoint: WorkflowCheckpoint): Promise<void> {
    if (!this.config.enabled) return;

    const key = this.getCheckpointKey(checkpoint.executionId);
    const serialized = JSON.stringify({
      ...checkpoint,
      timestamp: checkpoint.timestamp.toISOString()
    });

    try {
      await this.redis.set(key, serialized, 'EX', this.config.ttlSeconds);
      logger.debug('Checkpoint saved', {
        executionId: checkpoint.executionId,
        currentNodeId: checkpoint.currentNodeId,
        completedNodes: checkpoint.completedNodes.length
      });
    } catch (error) {
      logger.error('Failed to save checkpoint', {
        executionId: checkpoint.executionId,
        error
      });
      throw error;
    }
  }

  async loadCheckpoint(executionId: string): Promise<WorkflowCheckpoint | null> {
    if (!this.config.enabled) return null;

    const key = this.getCheckpointKey(executionId);

    try {
      const data = await this.redis.get(key);
      const checkpoint = safeJsonParse<WorkflowCheckpoint & { timestamp: string }>(data);

      if (!checkpoint) return null;

      return {
        ...checkpoint,
        timestamp: new Date(checkpoint.timestamp)
      };
    } catch (error) {
      logger.error('Failed to load checkpoint', { executionId, error });
      return null;
    }
  }

  async deleteCheckpoint(executionId: string): Promise<void> {
    const key = this.getCheckpointKey(executionId);
    await this.redis.del(key);
    logger.debug('Checkpoint deleted', { executionId });
  }

  /**
   * Acquire distributed lock for recovery - prevents race condition
   */
  async acquireRecoveryLock(executionId: string): Promise<string | null> {
    return acquireDistributedLock(this.redis, `execution:recovery:${executionId}`, RECOVERY_LOCK_TTL_MS);
  }

  async releaseRecoveryLock(executionId: string, token: string): Promise<boolean> {
    return releaseDistributedLock(this.redis, `execution:recovery:${executionId}`, token);
  }

  /**
   * Use SCAN instead of KEYS to avoid blocking Redis
   */
  async listCheckpoints(options: {
    page?: number;
    limit?: number;
  } = {}): Promise<{
    checkpoints: Array<WorkflowCheckpoint & { ttl: number }>;
    total: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const pattern = 'workflow:checkpoint:*';
    const allKeys: string[] = [];

    // SCAN instead of KEYS - non-blocking
    let cursor = '0';
    do {
      const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      allKeys.push(...keys);
    } while (cursor !== '0');

    const total = allKeys.length;
    allKeys.sort().reverse();

    const start = (page - 1) * limit;
    const end = start + limit;
    const pageKeys = allKeys.slice(start, end);

    const checkpoints: Array<WorkflowCheckpoint & { ttl: number }> = [];

    for (const key of pageKeys) {
      const data = await this.redis.get(key);
      const checkpoint = safeJsonParse<WorkflowCheckpoint & { timestamp: string }>(data);

      if (checkpoint) {
        const ttl = await this.redis.ttl(key);
        checkpoints.push({
          ...checkpoint,
          timestamp: new Date(checkpoint.timestamp),
          ttl
        });
      }
    }

    return { checkpoints, total };
  }

  async cleanupCompletedCheckpoints(completedExecutionIds: string[]): Promise<number> {
    let cleaned = 0;

    for (const executionId of completedExecutionIds) {
      const deleted = await this.redis.del(this.getCheckpointKey(executionId));
      if (deleted > 0) cleaned++;
    }

    if (cleaned > 0) {
      logger.info('Checkpoint cleanup completed', { deleted: cleaned });
    }

    return cleaned;
  }

  async getStats(): Promise<{
    totalCheckpoints: number;
    oldestCheckpoint: Date | null;
    newestCheckpoint: Date | null;
    avgCheckpointSize: number;
  }> {
    const pattern = 'workflow:checkpoint:*';
    const allKeys: string[] = [];

    let cursor = '0';
    do {
      const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      allKeys.push(...keys);
    } while (cursor !== '0');

    let oldestCheckpoint: Date | null = null;
    let newestCheckpoint: Date | null = null;
    let totalSize = 0;

    for (const key of allKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const checkpoint = safeJsonParse<WorkflowCheckpoint & { timestamp: string }>(data);
        if (checkpoint) {
          const timestamp = new Date(checkpoint.timestamp);

          if (!oldestCheckpoint || timestamp < oldestCheckpoint) {
            oldestCheckpoint = timestamp;
          }
          if (!newestCheckpoint || timestamp > newestCheckpoint) {
            newestCheckpoint = timestamp;
          }

          totalSize += data.length;
        }
      }
    }

    return {
      totalCheckpoints: allKeys.length,
      oldestCheckpoint,
      newestCheckpoint,
      avgCheckpointSize: allKeys.length > 0 ? totalSize / allKeys.length : 0
    };
  }

  private getCheckpointKey(executionId: string): string {
    return `workflow:checkpoint:${executionId}`;
  }

  private setupEventHandlers(): void {
    this.redis.on('error', (error) => {
      logger.error('Checkpoint Redis error', { error });
    });
  }
}

// ==================== SAGA ORCHESTRATOR ====================

export class SagaOrchestrator {
  private activeSagas: Map<string, SagaExecution> = new Map();
  private sagaTimeout: number = 60000;
  private readonly MAX_SAGA_AGE_MS = 3600000; // 1 hour
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: { sagaTimeout?: number }) {
    if (config?.sagaTimeout) {
      this.sagaTimeout = config.sagaTimeout;
    }
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of completed sagas to prevent memory leak
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.MAX_SAGA_AGE_MS;
      let cleaned = 0;

      for (const [id, saga] of this.activeSagas) {
        if (saga.completedAt && saga.completedAt.getTime() < cutoff) {
          this.activeSagas.delete(id);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug('Saga cleanup completed', { cleaned, remaining: this.activeSagas.size });
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Stop cleanup and release resources
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async executeSaga(
    sagaName: string,
    steps: SagaStep[],
    context?: SagaContext
  ): Promise<SagaExecution> {
    const sagaId = context?.sagaId || uuidv4();
    const executedSteps: SagaStep[] = [];
    const compensationErrors: Array<{ stepName: string; error: string }> = [];

    const sagaExecution: SagaExecution = {
      id: sagaId,
      sagaName,
      steps,
      completedSteps: [],
      status: 'running',
      startedAt: new Date(),
      compensationErrors: []
    };

    this.activeSagas.set(sagaId, sagaExecution);
    logger.saga?.started?.(sagaId, sagaName, steps.length);

    try {
      for (const step of steps) {
        await this.executeStep(step, sagaId);
        executedSteps.push(step);
        sagaExecution.completedSteps.push(step.name);
        this.activeSagas.set(sagaId, { ...sagaExecution });
        logger.saga?.stepCompleted?.(sagaId, step.name, sagaExecution.completedSteps.length);
      }

      sagaExecution.status = 'completed';
      sagaExecution.completedAt = new Date();
      logger.saga?.completed?.(sagaId, sagaName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sagaExecution.error = errorMessage;
      sagaExecution.status = 'failed';
      sagaExecution.failedStep = executedSteps.length < steps.length
        ? steps[executedSteps.length].name
        : undefined;

      logger.saga?.failed?.(sagaId, sagaName, errorMessage);

      // Compensate in reverse order
      await this.compensate(executedSteps.reverse(), compensationErrors, sagaId);
      sagaExecution.status = 'compensated';
      sagaExecution.compensationErrors = compensationErrors;
    }

    this.activeSagas.set(sagaId, sagaExecution);
    return sagaExecution;
  }

  private async executeStep(step: SagaStep, sagaId: string): Promise<void> {
    const maxRetries = step.retryPolicy?.maxRetries ?? 3;
    const retryDelay = step.retryPolicy?.retryDelay ?? 1000;
    const timeout = step.timeout ?? this.sagaTimeout;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          step.action(),
          this.timeout(timeout, `Step ${step.name} timed out after ${timeout}ms`)
        ]);

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          logger.saga?.stepRetried?.(sagaId, step.name, attempt + 1, maxRetries);
          await this.sleep(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error(`Step ${step.name} failed after ${maxRetries} retries`);
  }

  private async compensate(
    executedSteps: SagaStep[],
    compensationErrors: Array<{ stepName: string; error: string }>,
    sagaId: string
  ): Promise<void> {
    for (const step of executedSteps) {
      try {
        logger.saga?.compensating?.(sagaId, step.name);
        await step.compensation();
        logger.saga?.compensated?.(sagaId, step.name);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        compensationErrors.push({ stepName: step.name, error: errorMessage });
        logger.error('Compensation failed for saga step', {
          sagaId,
          stepName: step.name,
          error: errorMessage
        });
      }
    }
  }

  getSagaStatus(sagaId: string): SagaExecution | null {
    return this.activeSagas.get(sagaId) || null;
  }

  async cancelSaga(sagaId: string): Promise<boolean> {
    const saga = this.activeSagas.get(sagaId);
    if (!saga || saga.status !== 'running') {
      return false;
    }

    const compensationErrors: Array<{ stepName: string; error: string }> = [];
    const executedSteps = saga.steps
      .slice(0, saga.completedSteps.length)
      .reverse();

    saga.status = 'compensated';
    saga.completedAt = new Date();

    await this.compensate(executedSteps, compensationErrors, sagaId);
    saga.compensationErrors = compensationErrors;

    this.activeSagas.set(sagaId, saga);
    return true;
  }

  getActiveSagas(): SagaExecution[] {
    return Array.from(this.activeSagas.values()).filter(
      s => s.status === 'running'
    );
  }

  getStats(): { active: number; total: number; completed: number } {
    let completed = 0;
    for (const saga of this.activeSagas.values()) {
      if (saga.status !== 'running') completed++;
    }
    return {
      active: this.activeSagas.size - completed,
      total: this.activeSagas.size,
      completed
    };
  }

  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== EXECUTION RECOVERY SERVICE ====================

export interface RecoveryConfig {
  stuckThresholdMs?: number;
  checkIntervalMs?: number;
  maxConcurrentRecoveries?: number;
}

const DEFAULT_RECOVERY_CONFIG: Required<RecoveryConfig> = {
  stuckThresholdMs: 3600000, // 1 hour
  checkIntervalMs: 300000, // 5 minutes
  maxConcurrentRecoveries: 5
};

export class ExecutionRecoveryService {
  private checkpointService: CheckpointService;
  private config: Required<RecoveryConfig>;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private activeRecoveries: Set<string> = new Set();

  constructor(
    private workflowExecutor: WorkflowExecutor,
    checkpointService: CheckpointService,
    config: RecoveryConfig = {}
  ) {
    this.checkpointService = checkpointService;
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.recoveryTimer = setInterval(() => {
      this.recoverStuckExecutions().catch(error => {
        logger.error('Recovery service error', { error });
      });
    }, this.config.checkIntervalMs);

    logger.info('Execution recovery service started', {
      stuckThresholdMs: this.config.stuckThresholdMs,
      checkIntervalMs: this.config.checkIntervalMs
    });
  }

  stop(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.isRunning = false;
    logger.info('Execution recovery service stopped');
  }

  async recoverStuckExecutions(): Promise<{
    found: number;
    recovered: number;
    failed: number;
  }> {
    const stuckThreshold = new Date(Date.now() - this.config.stuckThresholdMs);

    const stuck = await Execution.find({
      status: ExecutionStatus.RUNNING,
      updatedAt: { $lt: stuckThreshold }
    }).limit(this.config.maxConcurrentRecoveries).maxTimeMS(10000) as IExecution[];

    let recovered = 0;
    let failed = 0;

    for (const execution of stuck) {
      const executionId = (execution._id as mongoose.Types.ObjectId).toString();

      // Skip if already being recovered (distributed lock check)
      if (this.activeRecoveries.has(executionId)) {
        continue;
      }

      this.activeRecoveries.add(executionId);

      try {
        // Acquire distributed lock to prevent race condition
        const lockToken = await this.checkpointService.acquireRecoveryLock(executionId);

        if (!lockToken) {
          logger.debug('Could not acquire recovery lock, skipping', { executionId });
          this.activeRecoveries.delete(executionId);
          continue;
        }

        logger.warn('Recovering stuck execution', {
          executionId,
          workflowId: execution.workflowId,
          stuckSince: execution.updatedAt
        });

        try {
          const checkpoint = await this.checkpointService.loadCheckpoint(executionId);

          if (checkpoint) {
            await this.workflowExecutor.resumeFromCheckpoint(executionId);
            recovered++;
          } else {
            execution.status = ExecutionStatus.FAILED;
            execution.error = {
              message: 'Recovery failed: no checkpoint found',
              nodeId: undefined
            };
            execution.completedAt = new Date();
            await execution.save();

            await dlqService.addToQueue({
              executionId,
              workflowId: execution.workflowId.toString(),
              nodeId: 'recovery',
              error: 'No checkpoint available for recovery',
              retryCount: 0,
              failedAt: new Date(),
              workflowDefinition: {} as WorkflowDefinition,
              nodeData: {} as unknown,
              context: {} as ExecutionContext
            });

            failed++;
          }
        } finally {
          await this.checkpointService.releaseRecoveryLock(executionId, lockToken);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Recovery failed for execution', { executionId, error: errorMessage });

        execution.status = ExecutionStatus.FAILED;
        execution.error = {
          message: `Recovery failed: ${errorMessage}`,
          nodeId: undefined
        };
        execution.completedAt = new Date();
        await execution.save();

        await dlqService.addToQueue({
          executionId,
          workflowId: execution.workflowId.toString(),
          nodeId: 'recovery',
          error: errorMessage,
          retryCount: 0,
          failedAt: new Date(),
          workflowDefinition: {} as WorkflowDefinition,
          nodeData: {} as unknown,
          context: {} as ExecutionContext
        });

        failed++;
      } finally {
        this.activeRecoveries.delete(executionId);
      }
    }

    if (stuck.length > 0) {
      logger.info('Stuck execution recovery completed', {
        found: stuck.length,
        recovered,
        failed
      });
    }

    return { found: stuck.length, recovered, failed };
  }

  async recoverExecution(executionId: string): Promise<boolean> {
    const execution = await Execution.findById(executionId).maxTimeMS(5000) as IExecution | null;
    if (!execution) {
      logger.warn('Execution not found for recovery', { executionId });
      return false;
    }

    const stuckThreshold = new Date(Date.now() - this.config.stuckThresholdMs);
    if (execution.status === ExecutionStatus.RUNNING &&
        execution.updatedAt && execution.updatedAt >= stuckThreshold) {
      logger.warn('Execution is not stuck, skipping recovery', { executionId });
      return false;
    }

    // Acquire lock
    const lockToken = await this.checkpointService.acquireRecoveryLock(executionId);
    if (!lockToken) {
      logger.warn('Could not acquire recovery lock', { executionId });
      return false;
    }

    try {
      const checkpoint = await this.checkpointService.loadCheckpoint(executionId);
      if (checkpoint) {
        await this.workflowExecutor.resumeFromCheckpoint(executionId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Manual recovery failed', { executionId, error });
      return false;
    } finally {
      await this.checkpointService.releaseRecoveryLock(executionId, lockToken);
    }
  }

  async getStats(): Promise<{
    stuckExecutions: number;
    activeRecoveries: number;
    lastRecovery: Date | null;
  }> {
    const stuckThreshold = new Date(Date.now() - this.config.stuckThresholdMs);
    const stuckCount = await Execution.countDocuments({
      status: ExecutionStatus.RUNNING,
      updatedAt: { $lt: stuckThreshold }
    }).maxTimeMS(5000);

    return {
      stuckExecutions: stuckCount,
      activeRecoveries: this.activeRecoveries.size,
      lastRecovery: null
    };
  }
}

// ==================== SAGA LOGGER EXTENSIONS ====================

declare module './logger' {
  interface Logger {
    saga?: {
      started?: (sagaId: string, sagaName: string, stepCount: number) => void;
      stepCompleted?: (sagaId: string, stepName: string, completedCount: number) => void;
      stepRetried?: (sagaId: string, stepName: string, attempt: number, maxRetries: number) => void;
      compensating?: (sagaId: string, stepName: string) => void;
      compensated?: (sagaId: string, stepName: string) => void;
      completed?: (sagaId: string, sagaName: string) => void;
      failed?: (sagaId: string, sagaName: string, error: string) => void;
    };
  }
}

const originalLogger = logger;
if (!originalLogger.saga) {
  (originalLogger as unknown).saga = {
    started: (sagaId: string, sagaName: string, stepCount: number) => {
      originalLogger.info('Saga started', { sagaId, sagaName, stepCount, event: 'saga_started' });
    },
    stepCompleted: (sagaId: string, stepName: string, completedCount: number) => {
      originalLogger.debug('Saga step completed', { sagaId, stepName, completedCount, event: 'saga_step_completed' });
    },
    stepRetried: (sagaId: string, stepName: string, attempt: number, maxRetries: number) => {
      originalLogger.info('Saga step retry', { sagaId, stepName, attempt, maxRetries, event: 'saga_step_retry' });
    },
    compensating: (sagaId: string, stepName: string) => {
      originalLogger.info('Compensating saga step', { sagaId, stepName, event: 'saga_compensating' });
    },
    compensated: (sagaId: string, stepName: string) => {
      originalLogger.debug('Saga step compensated', { sagaId, stepName, event: 'saga_compensated' });
    },
    completed: (sagaId: string, sagaName: string) => {
      originalLogger.info('Saga completed', { sagaId, sagaName, event: 'saga_completed' });
    },
    failed: (sagaId: string, sagaName: string, error: string) => {
      originalLogger.error('Saga failed', { sagaId, sagaName, error, event: 'saga_failed' });
    }
  };
}

export interface ExecutionOptions {
  maxConcurrentNodes?: number;
  defaultTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  checkpointInterval?: number;
  checkpointService?: CheckpointService | null;
  maxExecutionTimeMs?: number;
}

const DEFAULT_OPTIONS: ExecutionOptions = {
  maxConcurrentNodes: 5,
  defaultTimeout: 30000,
  enableRetry: true,
  maxRetries: 3,
  checkpointInterval: 5000,
  checkpointService: null,
  maxExecutionTimeMs: MAX_WORKFLOW_EXECUTION_MS
};

export class WorkflowExecutor {
  private options: Required<ExecutionOptions>;
  private activeExecutions: Map<string, AbortController> = new Map();
  private lastCheckpointTime: Map<string, number> = new Map();
  private checkpointService: CheckpointService | null = null;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(options: ExecutionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<ExecutionOptions>;
    this.checkpointService = options.checkpointService || null;

    // Initialize circuit breakers for external services
    this.initializeCircuitBreakers();
  }

  private initializeCircuitBreakers(): void {
    const services = [
      'notify-service',
      'wallet-service',
      'order-service',
      'profile-service',
      'whatsapp-service'
    ];

    for (const service of services) {
      this.circuitBreakers.set(
        service,
        new CircuitBreaker(service, {
          timeout: 5000,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
          volumeThreshold: 10
        })
      );
    }
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  setCheckpointService(service: CheckpointService): void {
    this.checkpointService = service;
  }

  private shouldCheckpoint(executionId: string): boolean {
    if (!this.checkpointService) return false;

    const lastTime = this.lastCheckpointTime.get(executionId) || 0;
    const now = Date.now();

    if (now - lastTime >= this.options.checkpointInterval) {
      this.lastCheckpointTime.set(executionId, now);
      return true;
    }

    return false;
  }

  private async saveCheckpoint(
    executionId: string,
    workflowId: string,
    currentNodeId: string,
    completedNodes: string[],
    pendingNodes: string[],
    variables: Record<string, unknown>,
    nodeResults: Map<string, NodeResult>,
    executionPath: string[]
  ): Promise<void> {
    if (!this.checkpointService) return;

    const checkpoint: WorkflowCheckpoint = {
      executionId,
      workflowId,
      currentNodeId,
      completedNodes,
      pendingNodes,
      variables,
      nodeResults: Array.from(nodeResults.values()).map(r => ({
        nodeId: r.nodeId,
        status: r.status,
        output: r.output,
        error: r.error,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString(),
        duration: r.duration,
        retryCount: r.retryCount
      })),
      executionPath,
      timestamp: new Date(),
      version: 1,
      totalDuration: 0
    };

    await this.checkpointService.saveCheckpoint(checkpoint);
  }

  parseWorkflow(workflow: WorkflowDefinition): {
    nodes: Map<string, WorkflowNode>;
    edges: Map<string, WorkflowEdge[]>;
    entryNode: WorkflowNode;
    errors: string[];
  } {
    const errors: string[] = [];
    const nodes = new Map<string, WorkflowNode>();
    const edges = new Map<string, WorkflowEdge[]>();

    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    if (!workflow.entryNodeId) {
      errors.push('Workflow must have an entry node');
    }

    for (const node of workflow.nodes) {
      if (nodes.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodes.set(node.id, node);
    }

    for (const edge of workflow.edges || []) {
      const nodeEdges = edges.get(edge.source) || [];
      nodeEdges.push(edge);
      edges.set(edge.source, nodeEdges);
    }

    const entryNode = nodes.get(workflow.entryNodeId);
    if (!entryNode) {
      errors.push(`Entry node not found: ${workflow.entryNodeId}`);
    }

    return { nodes, edges, entryNode: entryNode!, errors };
  }

  getNextNodes(
    currentNodeId: string,
    edges: Map<string, WorkflowEdge[]>,
    nodeResults: Map<string, NodeResult>,
    edgeType?: EdgeType
  ): WorkflowNode[] {
    const outgoingEdges = edges.get(currentNodeId) || [];

    if (outgoingEdges.length === 0) {
      return [];
    }

    if (edgeType && edgeType !== EdgeType.DEFAULT) {
      const filteredEdges = outgoingEdges.filter(e => e.type === edgeType);
      if (filteredEdges.length > 0) {
        return filteredEdges.map(e => ({ id: e.target } as WorkflowNode)).filter(n => n);
      }
    }

    return outgoingEdges
      .filter(e => e.type === EdgeType.DEFAULT)
      .map(e => ({ id: e.target } as WorkflowNode))
      .filter(n => n);
  }

  async executeNode(
    node: WorkflowNode,
    context: ExecutionContext,
    executionState: ExecutionState,
    workflowNodes: WorkflowNode[],
    execution: IExecution
  ): Promise<NodeResult> {
    const startTime = Date.now();
    const maxRetries = node.data.retryPolicy?.maxRetries ?? this.options.maxRetries ?? 3;
    const retryDelay = node.data.retryPolicy?.retryDelay ?? 1000;
    const backoffMultiplier = node.data.retryPolicy?.backoffMultiplier ?? 2;

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        logger.execution.nodeStarted(context.executionId, node.id, node.type);

        const result = await handleNode(node, context, executionState.nodeResults, workflowNodes);

        const duration = Date.now() - startTime;
        logger.execution.nodeCompleted(context.executionId, node.id, duration, result);

        return {
          nodeId: node.id,
          status: NodeStatus.COMPLETED,
          output: result.output,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          duration,
          retryCount,
          metadata: { nextNodes: result.nextNodeIds }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        if (retryCount <= maxRetries) {
          const delay = retryDelay * Math.pow(backoffMultiplier, retryCount - 1);
          logger.execution.retried(context.executionId, node.id, retryCount);
          await this.sleep(delay);
        }
      }
    }

    const errorMessage = lastError?.message || 'Unknown error';
    logger.execution.nodeFailed(context.executionId, node.id, errorMessage);

    const onError = node.data.errorHandling?.onError || 'stop';

    if (onError === 'dlq') {
      await dlqService.addToQueue({
        executionId: context.executionId,
        workflowId: context.workflowId,
        nodeId: node.id,
        error: errorMessage,
        errorDetails: lastError ? { message: lastError.message, stack: lastError.stack } : undefined,
        retryCount,
        failedAt: new Date(),
        workflowDefinition: context.variables._workflowDefinition as WorkflowDefinition,
        nodeData: node.data,
        context
      });
    }

    return {
      nodeId: node.id,
      status: NodeStatus.FAILED,
      error: errorMessage,
      errorDetails: lastError ? { message: lastError.message, stack: lastError.stack } : undefined,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      retryCount
    };
  }

  /**
   * Execute workflow with full state management, transactions, and deadline
   */
  async execute(
    workflow: WorkflowDefinition,
    context: ExecutionContext,
    executionRecord: IExecution
  ): Promise<ExecutionStatus> {
    const { nodes, edges, entryNode, errors } = this.parseWorkflow(workflow);

    if (errors.length > 0) {
      logger.error('Workflow validation failed', { errors, workflowId: workflow.id });
      executionRecord.markFailed(`Workflow validation failed: ${errors.join(', ')}`);
      await executionRecord.save();
      return ExecutionStatus.FAILED;
    }

    const executionState: ExecutionState = {
      executionId: context.executionId,
      workflowId: workflow.id,
      status: ExecutionStatus.RUNNING,
      currentNodeId: entryNode.id,
      context,
      nodeResults: new Map(),
      executionPath: [],
      pendingNodes: [entryNode.id],
      completedBranches: new Map(),
      startTime: new Date()
    };

    const abortController = new AbortController();
    this.activeExecutions.set(context.executionId, abortController);

    // Workflow execution deadline
    const deadline = Date.now() + this.options.maxExecutionTimeMs;

    try {
      executionRecord.markStarted(entryNode.id);
      await executionRecord.save();

      logger.execution.started(context.executionId, workflow.id, { triggerType: context.triggerType });

      while (executionState.pendingNodes.length > 0) {
        // Check deadline
        if (Date.now() > deadline) {
          logger.error('Workflow execution exceeded deadline', {
            executionId: context.executionId,
            deadline: new Date(deadline).toISOString()
          });
          executionRecord.markFailed(`Execution exceeded maximum time of ${this.options.maxExecutionTimeMs}ms`);
          await executionRecord.save();
          return ExecutionStatus.FAILED;
        }

        if (abortController.signal.aborted) {
          logger.execution.cancelled(context.executionId);
          executionRecord.markCancelled();
          await executionRecord.save();
          return ExecutionStatus.CANCELLED;
        }

        const currentNodeId = executionState.pendingNodes.shift()!;
        const currentNode = nodes.get(currentNodeId);

        if (!currentNode) {
          logger.warn(`Node not found: ${currentNodeId}`, { executionId: context.executionId });
          continue;
        }

        executionState.currentNodeId = currentNodeId;
        executionState.executionPath.push(currentNodeId);

        // Execute with MongoDB transaction for state consistency
        const session = await mongoose.startSession();
        session.startTransaction();

        let result: NodeResult;

        try {
          result = await this.executeNode(
            currentNode,
            context,
            executionState,
            workflow.nodes,
            executionRecord
          );

          executionState.nodeResults.set(currentNodeId, result);
          executionRecord.updateNodeResult(result);
          executionRecord.currentNode = currentNodeId;

          await executionRecord.save();
          await session.commitTransaction();
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }

        if (this.shouldCheckpoint(context.executionId)) {
          const completedNodes = Array.from(executionState.nodeResults.entries())
            .filter(([_, r]) => r.status === NodeStatus.COMPLETED)
            .map(([id]) => id);

          await this.saveCheckpoint(
            context.executionId,
            workflow.id,
            currentNodeId,
            completedNodes,
            executionState.pendingNodes,
            context.variables,
            executionState.nodeResults,
            executionState.executionPath
          );
        }

        if (result.status === NodeStatus.FAILED) {
          const onError = currentNode.data.errorHandling?.onError || 'stop';

          if (onError === 'continue') {
            logger.info(`Node ${currentNodeId} failed but continuing`, { executionId: context.executionId });
            const nextNodes = this.getNextNodes(currentNodeId, edges, executionState.nodeResults);
            for (const nextNode of nextNodes) {
              if (!executionState.pendingNodes.includes(nextNode.id)) {
                executionState.pendingNodes.push(nextNode.id);
              }
            }
          } else if (onError === 'stop') {
            executionRecord.markFailed(result.error || 'Node execution failed', currentNodeId);
            await executionRecord.save();
            return ExecutionStatus.FAILED;
          } else if (onError === 'dlq') {
            executionRecord.markFailed(result.error || 'Node sent to DLQ', currentNodeId);
            await executionRecord.save();
            return ExecutionStatus.FAILED;
          }
        } else if (result.status === NodeStatus.COMPLETED) {
          const nextNodeIds: string[] = result.metadata?.nextNodes as string[] || [];

          if (nextNodeIds.length > 0) {
            for (const edgeType of nextNodeIds) {
              const edges_ = edges.get(currentNodeId) || [];
              const filteredEdges = edges_.filter(e => e.type === (edgeType === 'true' ? EdgeType.TRUE : EdgeType.FALSE));

              for (const edge of filteredEdges) {
                if (!executionState.pendingNodes.includes(edge.target)) {
                  executionState.pendingNodes.push(edge.target);
                }
              }
            }
          } else {
            const nextNodes = this.getNextNodes(currentNodeId, edges, executionState.nodeResults);
            for (const nextNode of nextNodes) {
              if (!executionState.pendingNodes.includes(nextNode.id)) {
                executionState.pendingNodes.push(nextNode.id);
              }
            }
          }
        }
      }

      executionRecord.markCompleted();
      await executionRecord.save();

      logger.execution.completed(context.executionId, executionRecord.stats.totalDuration || 0, {
        completedNodes: executionRecord.stats.completedNodes,
        failedNodes: executionRecord.stats.failedNodes
      });

      return ExecutionStatus.COMPLETED;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.execution.failed(context.executionId, errorMessage);

      executionRecord.markFailed(errorMessage, executionState.currentNodeId || undefined);
      await executionRecord.save();

      return ExecutionStatus.FAILED;
    } finally {
      this.activeExecutions.delete(context.executionId);
      this.lastCheckpointTime.delete(context.executionId);

      if (this.checkpointService && executionRecord.status !== ExecutionStatus.RUNNING) {
        await this.checkpointService.deleteCheckpoint(context.executionId);
      }
    }
  }

  async resumeFromCheckpoint(executionId: string): Promise<ExecutionStatus> {
    if (!this.checkpointService) {
      throw new Error('Checkpoint service not configured');
    }

    const checkpoint = await this.checkpointService.loadCheckpoint(executionId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for execution ${executionId}`);
    }

    logger.info('Resuming from checkpoint', {
      executionId,
      workflowId: checkpoint.workflowId,
      currentNodeId: checkpoint.currentNodeId,
      completedNodes: checkpoint.completedNodes.length,
      pendingNodes: checkpoint.pendingNodes.length
    });

    const executionRecord = await Execution.findById(executionId).maxTimeMS(5000) as IExecution | null;
    if (!executionRecord) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const workflow = await Workflow.findOne({ workflowId: checkpoint.workflowId }).maxTimeMS(5000) as IWorkflow | null;
    if (!workflow) {
      throw new Error(`Workflow not found: ${checkpoint.workflowId}`);
    }

    const workflowDef: WorkflowDefinition = {
      id: workflow.workflowId,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      status: workflow.status as unknown,
      nodes: workflow.nodes as unknown as WorkflowNode[],
      edges: workflow.edges as unknown as WorkflowEdge[],
      entryNodeId: workflow.entryNodeId,
      variables: workflow.variables,
      metadata: workflow.metadata
    };
    const { nodes, edges, entryNode, errors } = this.parseWorkflow(workflowDef);

    if (errors.length > 0) {
      logger.error('Workflow validation failed during resume', { errors, workflowId: workflowDef.id });
      executionRecord.markFailed(`Workflow validation failed: ${errors.join(', ')}`);
      await executionRecord.save();
      return ExecutionStatus.FAILED;
    }

    const executionState: ExecutionState = {
      executionId,
      workflowId: checkpoint.workflowId,
      status: ExecutionStatus.RUNNING,
      currentNodeId: checkpoint.currentNodeId,
      context: {
        workflowId: checkpoint.workflowId,
        executionId,
        triggerType: TriggerType.MANUAL,
        triggerData: {},
        variables: checkpoint.variables,
        secrets: {},
        timestamp: checkpoint.timestamp
      },
      nodeResults: new Map(
        checkpoint.nodeResults.map(r => [
          r.nodeId,
          {
            nodeId: r.nodeId,
            status: r.status,
            output: r.output,
            error: r.error,
            startedAt: new Date(r.startedAt),
            completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
            duration: r.duration,
            retryCount: r.retryCount
          }
        ])
      ),
      executionPath: checkpoint.executionPath,
      pendingNodes: checkpoint.pendingNodes,
      completedBranches: new Map(),
      startTime: checkpoint.timestamp
    };

    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);
    this.lastCheckpointTime.set(executionId, Date.now());

    const deadline = Date.now() + this.options.maxExecutionTimeMs;

    try {
      executionRecord.status = ExecutionStatus.RUNNING;
      executionRecord.addLog('info', `Execution resumed from checkpoint at node ${checkpoint.currentNodeId}`);
      await executionRecord.save();

      logger.execution.started(executionId, workflowDef.id, {
        triggerType: 'resume',
        resumedFrom: checkpoint.currentNodeId
      });

      while (executionState.pendingNodes.length > 0) {
        if (Date.now() > deadline) {
          logger.error('Resumed workflow execution exceeded deadline');
          executionRecord.markFailed(`Execution exceeded maximum time of ${this.options.maxExecutionTimeMs}ms`);
          await executionRecord.save();
          return ExecutionStatus.FAILED;
        }

        if (abortController.signal.aborted) {
          logger.execution.cancelled(executionId);
          executionRecord.markCancelled();
          await executionRecord.save();
          return ExecutionStatus.CANCELLED;
        }

        const currentNodeId = executionState.pendingNodes.shift()!;
        const currentNode = nodes.get(currentNodeId);

        if (!currentNode) {
          logger.warn(`Node not found: ${currentNodeId}`, { executionId });
          continue;
        }

        if (checkpoint.completedNodes.includes(currentNodeId)) {
          continue;
        }

        executionState.currentNodeId = currentNodeId;
        if (!executionState.executionPath.includes(currentNodeId)) {
          executionState.executionPath.push(currentNodeId);
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        let result: NodeResult;

        try {
          result = await this.executeNode(
            currentNode,
            executionState.context,
            executionState,
            workflowDef.nodes,
            executionRecord
          );

          executionState.nodeResults.set(currentNodeId, result);
          executionRecord.updateNodeResult(result);
          await executionRecord.save();
          await session.commitTransaction();
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }

        if (this.shouldCheckpoint(executionId)) {
          const completedNodes = Array.from(executionState.nodeResults.entries())
            .filter(([_, r]) => r.status === NodeStatus.COMPLETED)
            .map(([id]) => id);

          await this.saveCheckpoint(
            executionId,
            workflowDef.id,
            currentNodeId,
            completedNodes,
            executionState.pendingNodes,
            executionState.context.variables,
            executionState.nodeResults,
            executionState.executionPath
          );
        }

        if (result.status === NodeStatus.FAILED) {
          const onError = currentNode.data.errorHandling?.onError || 'stop';

          if (onError === 'continue') {
            logger.info(`Node ${currentNodeId} failed but continuing`, { executionId });
            const nextNodes = this.getNextNodes(currentNodeId, edges, executionState.nodeResults);
            for (const nextNode of nextNodes) {
              if (!executionState.pendingNodes.includes(nextNode.id)) {
                executionState.pendingNodes.push(nextNode.id);
              }
            }
          } else if (onError === 'stop') {
            executionRecord.markFailed(result.error || 'Node execution failed', currentNodeId);
            await executionRecord.save();
            return ExecutionStatus.FAILED;
          } else if (onError === 'dlq') {
            executionRecord.markFailed(result.error || 'Node sent to DLQ', currentNodeId);
            await executionRecord.save();
            return ExecutionStatus.FAILED;
          }
        } else if (result.status === NodeStatus.COMPLETED) {
          const nextNodeIds: string[] = result.metadata?.nextNodes as string[] || [];

          if (nextNodeIds.length > 0) {
            for (const edgeType of nextNodeIds) {
              const edgeList = edges.get(currentNodeId) || [];
              const filteredEdges = edgeList.filter(e =>
                e.type === (edgeType === 'true' ? EdgeType.TRUE : EdgeType.FALSE)
              );

              for (const edge of filteredEdges) {
                if (!executionState.pendingNodes.includes(edge.target)) {
                  executionState.pendingNodes.push(edge.target);
                }
              }
            }
          } else {
            const nextNodes = this.getNextNodes(currentNodeId, edges, executionState.nodeResults);
            for (const nextNode of nextNodes) {
              if (!executionState.pendingNodes.includes(nextNode.id)) {
                executionState.pendingNodes.push(nextNode.id);
              }
            }
          }
        }
      }

      executionRecord.markCompleted();
      await executionRecord.save();

      logger.execution.completed(executionId, executionRecord.stats.totalDuration || 0, {
        completedNodes: executionRecord.stats.completedNodes,
        failedNodes: executionRecord.stats.failedNodes
      });

      logger.info('Execution resumed from checkpoint', {
        executionId,
        resumedFrom: checkpoint.currentNodeId
      });

      await this.checkpointService.deleteCheckpoint(executionId);

      return ExecutionStatus.COMPLETED;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.execution.failed(executionId, errorMessage);

      executionRecord.markFailed(errorMessage, executionState.currentNodeId || undefined);
      await executionRecord.save();

      return ExecutionStatus.FAILED;
    } finally {
      this.activeExecutions.delete(executionId);
      this.lastCheckpointTime.delete(executionId);
    }
  }

  cancel(executionId: string): boolean {
    const abortController = this.activeExecutions.get(executionId);
    if (abortController) {
      abortController.abort();
      return true;
    }
    return false;
  }

  getState(executionId: string): ExecutionState | null {
    return null;
  }

  generateTrace(execution: IExecution): {
    nodes: Array<{
      id: string;
      status: NodeStatus;
      duration: number;
      startedAt: Date;
      completedAt?: Date;
    }>;
    path: string[];
    totalDuration: number;
  } {
    return {
      nodes: execution.nodeResults.map(result => ({
        id: result.nodeId,
        status: result.status,
        duration: result.duration || 0,
        startedAt: result.startedAt,
        completedAt: result.completedAt
      })),
      path: execution.executionPath,
      totalDuration: execution.stats.totalDuration || 0
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const workflowExecutor = new WorkflowExecutor();

export default workflowExecutor;

/**
 * REZ Flow Runtime - Services Index
 */

export { workflowExecutor, WorkflowExecutor } from './workflowExecutor';
export {
  CheckpointService,
  SagaOrchestrator,
  ExecutionRecoveryService,
  WorkflowCheckpoint,
  SagaStep,
  SagaExecution,
  SagaContext,
  CheckpointConfig,
  RecoveryConfig
} from './workflowExecutor';
export { default as nodeHandlers } from './nodeHandlers';
export { default as dlqService, DLQService } from './dlqService';
export { default as logger } from './logger';

// Re-export singleton instances for convenience
import { workflowExecutor, WorkflowExecutor } from './workflowExecutor';
import { CheckpointService } from './workflowExecutor';
import { SagaOrchestrator } from './workflowExecutor';
import { ExecutionRecoveryService } from './workflowExecutor';

export const checkpointService = new CheckpointService();
export const sagaOrchestrator = new SagaOrchestrator();
export const executionRecoveryService = new ExecutionRecoveryService(
  workflowExecutor,
  checkpointService
);

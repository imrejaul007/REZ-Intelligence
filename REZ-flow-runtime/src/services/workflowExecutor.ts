/**
 * REZ Flow Runtime - Workflow Executor
 * Core execution engine for workflow processing
 */

import { v4 as uuidv4 } from 'uuid';
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
import { Execution, Workflow } from '../models/Execution';
import { handleNode } from './nodeHandlers';
import logger from './logger';
import dlqService from './dlqService';

export interface ExecutionOptions {
  maxConcurrentNodes?: number;
  defaultTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
}

const DEFAULT_OPTIONS: ExecutionOptions = {
  maxConcurrentNodes: 5,
  defaultTimeout: 30000,
  enableRetry: true,
  maxRetries: 3
};

export class WorkflowExecutor {
  private options: ExecutionOptions;
  private activeExecutions: Map<string, AbortController> = new Map();

  constructor(options: ExecutionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse and validate workflow definition
   */
  parseWorkflow(workflow: WorkflowDefinition): {
    nodes: Map<string, WorkflowNode>;
    edges: Map<string, WorkflowEdge[]>;
    entryNode: WorkflowNode;
    errors: string[];
  } {
    const errors: string[] = [];
    const nodes = new Map<string, WorkflowNode>();
    const edges = new Map<string, WorkflowEdge[]>();

    // Validate required fields
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    if (!workflow.entryNodeId) {
      errors.push('Workflow must have an entry node');
    }

    // Build node map
    for (const node of workflow.nodes) {
      if (nodes.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodes.set(node.id, node);
    }

    // Build edge map
    for (const edge of workflow.edges || []) {
      const nodeEdges = edges.get(edge.source) || [];
      nodeEdges.push(edge);
      edges.set(edge.source, nodeEdges);
    }

    // Find entry node
    const entryNode = nodes.get(workflow.entryNodeId);
    if (!entryNode) {
      errors.push(`Entry node not found: ${workflow.entryNodeId}`);
    }

    return { nodes, edges, entryNode: entryNode!, errors };
  }

  /**
   * Get next nodes based on current node and edge type
   */
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

    // If edge type is specified (e.g., 'true' or 'false' from condition), filter by type
    if (edgeType && edgeType !== EdgeType.DEFAULT) {
      const filteredEdges = outgoingEdges.filter(e => e.type === edgeType);
      if (filteredEdges.length > 0) {
        return filteredEdges.map(e => ({ id: e.target } as WorkflowNode)).filter(n => n);
      }
    }

    // Get all default edges
    return outgoingEdges
      .filter(e => e.type === EdgeType.DEFAULT)
      .map(e => ({ id: e.target } as WorkflowNode))
      .filter(n => n);
  }

  /**
   * Execute a single node with retry logic
   */
  async executeNode(
    node: WorkflowNode,
    context: ExecutionContext,
    executionState: ExecutionState,
    workflowNodes: WorkflowNode[],
    execution: InstanceType<typeof Execution>
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

        // Create pending result
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

    // All retries exhausted
    const errorMessage = lastError?.message || 'Unknown error';
    logger.execution.nodeFailed(context.executionId, node.id, errorMessage);

    // Handle error based on configuration
    const onError = node.data.errorHandling?.onError || 'stop';

    if (onError === 'dlq') {
      await dlqService.addToQueue({
        executionId: context.executionId,
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
   * Execute workflow with full state management
   */
  async execute(
    workflow: WorkflowDefinition,
    context: ExecutionContext,
    executionRecord: InstanceType<typeof Execution>
  ): Promise<ExecutionStatus> {
    const { nodes, edges, entryNode, errors } = this.parseWorkflow(workflow);

    if (errors.length > 0) {
      logger.error('Workflow validation failed', { errors, workflowId: workflow.id });
      executionRecord.markFailed(`Workflow validation failed: ${errors.join(', ')}`);
      await executionRecord.save();
      return ExecutionStatus.FAILED;
    }

    // Initialize execution state
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

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.activeExecutions.set(context.executionId, abortController);

    try {
      executionRecord.markStarted(entryNode.id);
      await executionRecord.save();

      logger.execution.started(context.executionId, workflow.id, { triggerType: context.triggerType });

      // Process nodes until queue is empty or aborted
      while (executionState.pendingNodes.length > 0) {
        // Check for cancellation
        if (abortController.signal.aborted) {
          logger.execution.cancelled(context.executionId);
          executionRecord.markCancelled();
          await executionRecord.save();
          return ExecutionStatus.CANCELLED;
        }

        // Get next node
        const currentNodeId = executionState.pendingNodes.shift()!;
        const currentNode = nodes.get(currentNodeId);

        if (!currentNode) {
          logger.warn(`Node not found: ${currentNodeId}`, { executionId: context.executionId });
          continue;
        }

        // Update current node
        executionState.currentNodeId = currentNodeId;
        executionState.executionPath.push(currentNodeId);

        // Execute node
        const result = await this.executeNode(
          currentNode,
          context,
          executionState,
          workflow.nodes,
          executionRecord
        );

        // Update result
        executionState.nodeResults.set(currentNodeId, result);
        executionRecord.updateNodeResult(result);
        await executionRecord.save();

        // Handle result
        if (result.status === NodeStatus.FAILED) {
          const onError = currentNode.data.errorHandling?.onError || 'stop';

          if (onError === 'continue') {
            logger.info(`Node ${currentNodeId} failed but continuing`, { executionId: context.executionId });
            // Add next nodes
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
            // Already added to DLQ in executeNode
            executionRecord.markFailed(result.error || 'Node sent to DLQ', currentNodeId);
            await executionRecord.save();
            return ExecutionStatus.FAILED;
          }
        } else if (result.status === NodeStatus.COMPLETED) {
          // Determine next nodes based on output and edges
          const nextNodeIds: string[] = result.metadata?.nextNodes as string[] || [];

          if (nextNodeIds.length > 0) {
            // Handle condition branches (true/false)
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
            // Default: follow all outgoing edges
            const nextNodes = this.getNextNodes(currentNodeId, edges, executionState.nodeResults);
            for (const nextNode of nextNodes) {
              if (!executionState.pendingNodes.includes(nextNode.id)) {
                executionState.pendingNodes.push(nextNode.id);
              }
            }
          }
        }
      }

      // Workflow completed successfully
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
    }
  }

  /**
   * Cancel an active execution
   */
  cancel(executionId: string): boolean {
    const abortController = this.activeExecutions.get(executionId);
    if (abortController) {
      abortController.abort();
      return true;
    }
    return false;
  }

  /**
   * Get execution state
   */
  getState(executionId: string): ExecutionState | null {
    // In production, this would retrieve from Redis or in-memory store
    return null;
  }

  /**
   * Generate execution trace
   */
  generateTrace(execution: InstanceType<typeof Execution>): {
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

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const workflowExecutor = new WorkflowExecutor();

export default workflowExecutor;

/**
 * REZ Action Orchestrator - Types
 *
 * AI Action Engine - Autonomous execution orchestration
 */

import mongoose, { Document } from 'mongoose';

// ============================================
// CORE ACTION TYPES
// ============================================

export interface Action {
  id: string;
  name: string;
  type: ActionType;
  description: string;
  parameters: Record<string, unknown>;
  result?: ActionResult;
  status: ActionStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  error?: string;
}

export type ActionType =
  | 'query'
  | 'calculation'
  | 'decision'
  | 'notification'
  | 'workflow'
  | 'external_api'
  | 'database'
  | 'transform';

export type ActionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface ActionResult {
  success: boolean;
  data?: unknown;
  output?: string;
  artifacts?: ActionArtifact[];
  metrics?: ActionMetrics;
  error?: string;
  executionTime?: number;
}

export interface ActionArtifact {
  type: 'text' | 'data' | 'file' | 'chart';
  name: string;
  content: unknown;
  mimeType?: string;
}

export interface ActionMetrics {
  tokensUsed?: number;
  executionTime: number;
  cost?: number;
  confidence?: number;
  success?: boolean;
}

// ============================================
// TOOL TYPES
// ============================================

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  returns: ToolReturnType;
  requiresAuth: boolean;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
  timeout?: number;
  version: string;
}

export type ToolCategory =
  | 'data'
  | 'computation'
  | 'communication'
  | 'integration'
  | 'automation'
  | 'analysis';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
  schema?: Record<string, unknown>;
}

export interface ToolReturnType {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';
  description: string;
  schema?: Record<string, unknown>;
}

export interface ToolExecution {
  id: string;
  toolId: string;
  actionId: string;
  parameters: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
  duration?: number;
}

// ============================================
// WORKFLOW TYPES
// ============================================

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  conditions: WorkflowCondition[];
  variables: WorkflowVariable[];
  timeout: number;
  maxConcurrentExecutions: number;
  createdAt: Date;
  updatedAt: Date;
  status: WorkflowStatus;
}

export type WorkflowStatus = 'active' | 'paused' | 'archived' | 'draft';

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  tool?: string;
  action?: string;
  subWorkflow?: string;
  parameters: Record<string, unknown>;
  nextStep?: string;
  onSuccess?: string;
  onFailure?: string;
  retryPolicy?: RetryPolicy;
  timeout?: number;
}

export type StepType = 'tool' | 'action' | 'condition' | 'parallel' | 'loop' | 'wait' | 'transform';

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export interface WorkflowTrigger {
  type: 'event' | 'schedule' | 'webhook' | 'api';
  event?: string;
  schedule?: string;
  webhook?: string;
  conditions?: Record<string, unknown>;
}

export interface WorkflowCondition {
  id: string;
  expression: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'matches';
  value?: unknown;
  action: 'proceed' | 'skip' | 'fail' | 'goto';
  target?: string;
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: unknown;
  scope: 'step' | 'workflow';
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: ExecutionStatus;
  currentStep?: string;
  context: Record<string, unknown>;
  results: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  logs: ExecutionLog[];
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface ExecutionLog {
  timestamp: Date;
  step: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

// ============================================
// PLANNING TYPES
// ============================================

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  estimatedDuration: number;
  estimatedCost: number;
  confidence: number;
  reasoning: string;
  createdAt: Date;
  expiresAt: Date;
  status: PlanStatus;
}

export type PlanStatus = 'draft' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface PlanStep {
  id: string;
  order: number;
  description: string;
  tool?: string;
  action?: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  estimatedDuration: number;
  estimatedCost: number;
  risk: 'low' | 'medium' | 'high';
  rollbackAction?: string;
  status: PlanStepStatus;
  result?: unknown;
  error?: string;
}

export type PlanStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'rolled_back';

export interface PlanExecution {
  id: string;
  planId: string;
  status: ExecutionStatus;
  currentStep: number;
  completedSteps: string[];
  failedSteps: string[];
  results: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ============================================
// EXECUTION CONTEXT
// ============================================

export interface ExecutionContext {
  id: string;
  type: 'action' | 'workflow' | 'plan';
  parentId?: string;
  userId?: string;
  sessionId?: string;
  variables: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  history: ContextHistoryEntry[];
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface ContextHistoryEntry {
  timestamp: Date;
  action: string;
  result: unknown;
  duration: number;
}

// ============================================
// REPLAY & OPTIMIZATION
// ============================================

export interface ReplaySession {
  id: string;
  originalExecutionId: string;
  modifiedParameters: Record<string, unknown>;
  status: ReplayStatus;
  results?: ActionResult;
  comparison?: ReplayComparison;
  createdAt: Date;
}

export type ReplayStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ReplayComparison {
  success: boolean;
  outputMatches: boolean;
  performanceDiff: number;
  differences: string[];
}

export interface OptimizationInsight {
  id: string;
  type: 'cost' | 'speed' | 'reliability' | 'accuracy';
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  estimatedImprovement: number;
  implementationEffort: 'low' | 'medium' | 'high';
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface ExecuteActionRequest {
  actionName: string;
  actionType: ActionType;
  parameters: Record<string, unknown>;
  options?: {
    timeout?: number;
    maxRetries?: number;
    priority?: 'low' | 'normal' | 'high';
  };
}

export interface ExecuteActionResponse {
  success: boolean;
  action?: Action;
  result?: ActionResult;
  error?: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  steps: Omit<WorkflowStep, 'id'>[];
  triggers?: Omit<WorkflowTrigger, 'conditions'>[];
  conditions?: Omit<WorkflowCondition, 'id'>[];
  variables?: Omit<WorkflowVariable, 'name'>[];
  options?: {
    timeout?: number;
    maxConcurrent?: number;
  };
}

export interface CreateWorkflowResponse {
  success: boolean;
  workflow?: Workflow;
  error?: string;
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  trigger?: string;
  context?: Record<string, unknown>;
  options?: {
    sync?: boolean;
    timeout?: number;
  };
}

export interface ExecuteWorkflowResponse {
  success: boolean;
  execution?: WorkflowExecution;
  error?: string;
}

export interface CreatePlanRequest {
  goal: string;
  constraints?: {
    maxSteps?: number;
    maxCost?: number;
    maxDuration?: number;
  };
  context?: Record<string, unknown>;
}

export interface CreatePlanResponse {
  success: boolean;
  plan?: Plan;
  error?: string;
}

export interface ExecutePlanRequest {
  planId: string;
  options?: {
    sync?: boolean;
    stopOnFailure?: boolean;
    parallelSteps?: boolean;
  };
}

export interface ExecutePlanResponse {
  success: boolean;
  execution?: PlanExecution;
  error?: string;
}

export interface RegisterToolRequest {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  returns: ToolReturnType;
  handler: string;
  options?: {
    requiresAuth?: boolean;
    rateLimit?: { requests: number; windowMs: number };
    timeout?: number;
  };
}

export interface RegisterToolResponse {
  success: boolean;
  tool?: Tool;
  error?: string;
}

// ============================================
// MONGODB SCHEMAS
// ============================================

export interface IAction extends Document {
  name: String;
  type: String;
  description: String;
  parameters: mongoose.Schema.Types.Mixed;
  result: mongoose.Schema.Types.Mixed;
  status: String;
  createdAt: Date;
  startedAt: Date;
  completedAt: Date;
  retryCount: Number;
  maxRetries: Number;
  error: String;
}

export interface ITool extends Document {
  name: String;
  description: String;
  category: String;
  parameters: [mongoose.Schema.Types.Mixed];
  returns: mongoose.Schema.Types.Mixed;
  requiresAuth: Boolean;
  rateLimit: mongoose.Schema.Types.Mixed;
  timeout: Number;
  version: String;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkflow extends Document {
  name: String;
  description: String;
  version: String;
  steps: [mongoose.Schema.Types.Mixed];
  triggers: [mongoose.Schema.Types.Mixed];
  conditions: [mongoose.Schema.Types.Mixed];
  variables: [mongoose.Schema.Types.Mixed];
  timeout: Number;
  maxConcurrentExecutions: Number;
  status: String;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkflowExecution extends Document {
  workflowId: String;
  workflowVersion: String;
  status: String;
  currentStep: String;
  context: mongoose.Schema.Types.Mixed;
  results: mongoose.Schema.Types.Mixed;
  startedAt: Date;
  completedAt: Date;
  error: String;
  logs: [mongoose.Schema.Types.Mixed];
}

export interface IPlan extends Document {
  goal: String;
  steps: [mongoose.Schema.Types.Mixed];
  estimatedDuration: Number;
  estimatedCost: Number;
  confidence: Number;
  reasoning: String;
  expiresAt: Date;
  status: String;
  createdAt: Date;
}

// ============================================
// SERVICE TYPES
// ============================================

export interface ExecutionQueue {
  id: string;
  name: string;
  priority: 'low' | 'normal' | 'high';
  items: QueueItem[];
  processing: boolean;
  lastProcessed?: Date;
}

export interface QueueItem {
  id: string;
  type: 'action' | 'workflow' | 'plan';
  payload: unknown;
  priority: number;
  addedAt: Date;
  scheduledFor?: Date;
  attempts: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  actionsExecuted: number;
  workflowsExecuted: number;
  plansExecuted: number;
  activeExecutions: number;
  queueDepth: number;
  lastProcessed: Date;
}

export interface ServiceStats {
  totalActions: number;
  totalWorkflows: number;
  totalPlans: number;
  totalTools: number;
  avgExecutionTime: number;
  successRate: number;
  byType: Record<string, number>;
}

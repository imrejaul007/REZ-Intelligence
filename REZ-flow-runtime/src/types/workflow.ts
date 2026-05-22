/**
 * REZ Flow Runtime - Type Definitions
 * Workflow execution engine types
 */

import { z } from 'zod';

// ==================== ENUMS ====================

export enum WorkflowStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

export enum NodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  WAITING = 'waiting'
}

export enum NodeType {
  // Trigger types
  TRIGGER = 'trigger',
  TRIGGER_EVENT = 'trigger_event',
  TRIGGER_SCHEDULE = 'trigger_schedule',
  TRIGGER_MANUAL = 'trigger_manual',
  TRIGGER_WEBHOOK = 'trigger_webhook',
  TRIGGER_API = 'trigger_api',

  // Action types
  ACTION = 'action',
  ACTION_SEND_EMAIL = 'action_send_email',
  ACTION_SEND_SMS = 'action_send_sms',
  ACTION_SEND_WHATSAPP = 'action_send_whatsapp',
  ACTION_SEND_PUSH = 'action_send_push',
  ACTION_UPDATE_USER = 'action_update_user',
  ACTION_CREATE_ORDER = 'action_create_order',
  ACTION_WEBHOOK_CALL = 'action_webhook_call',

  // Condition types
  CONDITION = 'condition',
  CONDITION_IF = 'condition_if',
  CONDITION_IF_USER_SEGMENT = 'condition_if_user_segment',
  CONDITION_IF_TIME = 'condition_if_time',
  CONDITION_IF_PURCHASE_HISTORY = 'condition_if_purchase_history',
  CONDITION_IF_LOCATION = 'condition_if_location',

  // Delay types
  DELAY = 'delay',
  DELAY_MINUTES = 'delay_minutes',
  DELAY_HOURS = 'delay_hours',
  DELAY_DAYS = 'delay_days',
  DELAY_UNTIL = 'delay_until',

  // Flow control types
  SPLIT = 'split',
  SPLIT_FAN_OUT = 'split_fan_out',
  MERGE = 'merge',
  MERGE_WAIT_ALL = 'merge_wait_all',
  MERGE_WAIT_ONE = 'merge_wait_one',

  // Utility types
  LOG = 'log',
  TRANSFORM = 'transform',
  FILTER = 'filter'
}

export enum TriggerType {
  EVENT = 'event',
  SCHEDULE = 'schedule',
  MANUAL = 'manual',
  WEBHOOK = 'webhook',
  API = 'api'
}

export enum EdgeType {
  DEFAULT = 'default',
  TRUE = 'true',
  FALSE = 'false',
  ERROR = 'error'
}

// ==================== ZOD SCHEMAS ====================

export const TriggerConfigSchema = z.object({
  type: z.nativeEnum(TriggerType),
  eventName: z.string().optional(),
  schedule: z.object({
    cron: z.string().optional(),
    interval: z.number().optional(),
    timezone: z.string().optional()
  }).optional(),
  webhookPath: z.string().optional(),
  authentication: z.object({
    type: z.enum(['none', 'api_key', 'bearer', 'basic']),
    key: z.string().optional()
  }).optional()
});

export const ActionConfigSchema = z.object({
  actionType: z.string(),
  params: z.record(z.unknown()),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(10).default(3),
    retryDelay: z.number().min(0).default(1000),
    backoffMultiplier: z.number().min(1).max(10).default(2)
  }).optional()
});

export const ConditionConfigSchema = z.object({
  conditionType: z.string(),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in', 'not_in']),
  field: z.string(),
  value: z.unknown(),
  timeout: z.number().optional()
});

export const DelayConfigSchema = z.object({
  delayType: z.enum(['minutes', 'hours', 'days', 'until']),
  value: z.number().or(z.string()),
  timezone: z.string().optional()
});

export const SplitConfigSchema = z.object({
  splitType: z.enum(['fan_out', 'fan_out_parallel']),
  parallelLimit: z.number().min(1).max(100).default(10)
});

export const MergeConfigSchema = z.object({
  mergeType: z.enum(['wait_all', 'wait_one', 'race']),
  timeout: z.number().optional()
});

// ==================== NODE DEFINITIONS ====================

export interface Position {
  x: number;
  y: number;
}

export interface NodeData {
  label: string;
  description?: string;
  type: NodeType;
  config: TriggerConfig | ActionConfig | ConditionConfig | DelayConfig | SplitConfig | MergeConfig | Record<string, unknown>;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  errorHandling?: {
    onError: 'continue' | 'stop' | 'retry' | 'dlq';
    errorNode?: string;
  };
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: NodeData;
  width?: number;
  height?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: EdgeType;
  label?: string;
  animated?: boolean;
  style?: Record<string, string>;
  data?: {
    condition?: string;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryNodeId: string;
  variables?: Record<string, unknown>;
  metadata?: {
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
    tags?: string[];
    category?: string;
  };
}

// ==================== EXECUTION TYPES ====================

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  triggerType: TriggerType;
  triggerData: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  variables: Record<string, unknown>;
  secrets: Record<string, string>;
  timestamp: Date;
}

export interface NodeResult {
  nodeId: string;
  status: NodeStatus;
  output?: unknown;
  error?: string;
  errorDetails?: {
    message: string;
    stack?: string;
    code?: string;
  };
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionLog {
  id: string;
  executionId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  nodeId?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ExecutionState {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  currentNodeId: string | null;
  context: ExecutionContext;
  nodeResults: Map<string, NodeResult>;
  executionPath: string[];
  pendingNodes: string[];
  completedBranches: Map<string, string[]>;
  startTime: Date;
  endTime?: Date;
  error?: string;
  totalDuration?: number;
}

export interface Execution {
  _id: string;
  workflowId: string;
  workflowVersion: number;
  status: ExecutionStatus;
  triggerType: TriggerType;
  triggerData: Record<string, unknown>;
  context: {
    userId?: string;
    sessionId?: string;
    variables: Record<string, unknown>;
  };
  nodeResults: NodeResult[];
  executionPath: string[];
  logs: ExecutionLog[];
  error?: {
    message: string;
    nodeId?: string;
    stack?: string;
  };
  stats: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    skippedNodes: number;
    totalRetries: number;
    totalDuration?: number;
  };
  startedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== API TYPES ====================

export interface CreateExecutionRequest {
  workflowId: string;
  triggerType: TriggerType;
  triggerData?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  variables?: Record<string, unknown>;
}

export interface CreateExecutionResponse {
  executionId: string;
  status: ExecutionStatus;
  createdAt: Date;
}

export interface ListExecutionsQuery {
  workflowId?: string;
  status?: ExecutionStatus;
  userId?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'status' | 'startedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListExecutionsResponse {
  executions: Execution[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RegisterWorkflowRequest {
  workflow: WorkflowDefinition;
  apiKey?: string;
}

export interface PublishWorkflowRequest {
  version?: number;
}

// ==================== WORKER TYPES ====================

export interface ExecutionJob {
  executionId: string;
  workflowId: string;
  workflowDefinition: WorkflowDefinition;
  context: ExecutionContext;
}

export interface DLQMessage {
  executionId: string;
  workflowId: string;
  nodeId: string;
  error: string;
  errorDetails?: Record<string, unknown>;
  retryCount: number;
  failedAt: Date;
  workflowDefinition: WorkflowDefinition;
  nodeData: NodeData;
  context: ExecutionContext;
}

// ==================== TYPE ALIASES ====================

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;
export type ActionConfig = z.infer<typeof ActionConfigSchema>;
export type ConditionConfig = z.infer<typeof ConditionConfigSchema>;
export type DelayConfig = z.infer<typeof DelayConfigSchema>;
export type SplitConfig = z.infer<typeof SplitConfigSchema>;
export type MergeConfig = z.infer<typeof MergeConfigSchema>;

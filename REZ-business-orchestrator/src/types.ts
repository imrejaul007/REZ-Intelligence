/**
 * REZ Business Orchestrator - Types
 *
 * Business Intelligence Orchestrator - Cross-domain workflow automation
 */

import mongoose, { Document } from 'mongoose';

// ============================================
// WORKFLOW TYPES
// ============================================

export interface BusinessWorkflow {
  id: string;
  name: string;
  type: WorkflowType;
  domain: BusinessDomain;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  conditions: WorkflowCondition[];
  variables: WorkflowVariable[];
  timeout: number;
  maxConcurrentExecutions: number;
  createdAt: Date;
  updatedAt: Date;
  status: WorkflowStatus;
  version: string;
}

export type WorkflowType =
  | 'onboarding'
  | 'retention'
  | 'conversion'
  | 'reactivation'
  | 'escalation'
  | 'fulfillment'
  | 'analytics'
  | 'custom';

export type BusinessDomain =
  | 'commerce'
  | 'loyalty'
  | 'support'
  | 'marketing'
  | 'operations'
  | 'finance'
  | 'analytics';

export type WorkflowStatus = 'active' | 'paused' | 'archived' | 'draft';

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  service: string;
  action: string;
  parameters: Record<string, unknown>;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  onSuccess?: string;
  onFailure?: string;
}

export type StepType =
  | 'service_call'
  | 'decision'
  | 'condition'
  | 'parallel'
  | 'loop'
  | 'wait'
  | 'transform'
  | 'notification';

export interface WorkflowTrigger {
  type: 'event' | 'schedule' | 'webhook' | 'manual' | 'api';
  event?: string;
  schedule?: string;
  conditions?: Record<string, unknown>;
}

export interface WorkflowCondition {
  field?: string;
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'in';
  value?: unknown;
  action: 'proceed' | 'skip' | 'fail';
}

export interface WorkflowVariable {
  name?: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: unknown;
  scope?: 'step' | 'workflow';
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

// ============================================
// EXECUTION TYPES
// ============================================

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
  metrics?: ExecutionMetrics;
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

export interface ExecutionMetrics {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  totalDuration: number;
  stepDurations: Record<string, number>;
  serviceCalls: Record<string, number>;
}

// ============================================
// CROSS-DOMAIN TYPES
// ============================================

export interface CrossDomainContext {
  userId?: string;
  merchantId?: string;
  orderId?: string;
  sessionId?: string;
  variables: Record<string, unknown>;
  domainData?: Record<BusinessDomain, unknown>;
  createdAt: Date;
}

export interface DomainIntegration {
  sourceDomain: BusinessDomain;
  targetDomain: BusinessDomain;
  mapping: FieldMapping[];
  transformation?: DataTransformation[];
  syncStrategy: 'sync' | 'async' | 'event';
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
}

export interface DataTransformation {
  field: string;
  type: 'map' | 'filter' | 'aggregate' | 'compute';
  operation: string;
  params?: Record<string, unknown>;
}

// ============================================
// BUSINESS RULES
// ============================================

export interface BusinessRule {
  id: string;
  name: string;
  domain: BusinessDomain;
  condition: RuleCondition;
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleCondition {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'in' | 'between';
  value: unknown;
  value2?: unknown; // For 'between' operator
  logicalOperator?: 'AND' | 'OR';
  conditions?: RuleCondition[];
}

export interface RuleAction {
  type: 'service_call' | 'notification' | 'workflow' | 'webhook' | 'update_field';
  service?: string;
  action?: string;
  parameters?: Record<string, unknown>;
}

// ============================================
// TEMPLATES
// ============================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  type: WorkflowType;
  domain: BusinessDomain;
  description: string;
  steps: Omit<WorkflowStep, 'id'>[];
  requiredVariables: string[];
  optionalVariables: string[];
  estimatedDuration: number;
  successRate: number;
}

export interface BusinessScenario {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  workflows: string[];
  metrics: ScenarioMetrics;
}

export interface ScenarioMetrics {
  executions: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
}

// ============================================
// ANALYTICS
// ============================================

export interface WorkflowAnalytics {
  workflowId: string;
  period: { start: Date; end: Date };
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgDuration: number;
  avgSteps: number;
  successRate: number;
  byStatus: Record<ExecutionStatus, number>;
  byDomain: Record<BusinessDomain, number>;
  bottlenecks: BottleneckAnalysis[];
}

export interface BottleneckAnalysis {
  stepId: string;
  stepName: string;
  avgDuration: number;
  failureRate: number;
  recommendations: string[];
}

export interface ServiceDependency {
  service: string;
  dependsOn: string[];
  avgLatency: number;
  failureRate: number;
}

// ============================================
// REQUEST/RESPONSE
// ============================================

export interface CreateWorkflowRequest {
  name: string;
  type: WorkflowType;
  domain: BusinessDomain;
  steps: Omit<WorkflowStep, 'id'>[];
  triggers?: Omit<WorkflowTrigger, 'conditions'>[];
  conditions?: WorkflowCondition[];
  variables?: WorkflowVariable[];
  options?: {
    timeout?: number;
    maxConcurrent?: number;
  };
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  context?: Record<string, unknown>;
  trigger?: string;
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

export interface EvaluateRulesRequest {
  domain: BusinessDomain;
  entityId: string;
  entityType: string;
  data: Record<string, unknown>;
}

export interface EvaluateRulesResponse {
  success: boolean;
  triggeredRules: {
    rule: BusinessRule;
    actions: RuleAction[];
  }[];
  error?: string;
}

// ============================================
// MONGODB SCHEMAS
// ============================================

export interface IWorkflow extends Document {
  name: String;
  type: String;
  domain: String;
  steps: [mongoose.Schema.Types.Mixed];
  triggers: [mongoose.Schema.Types.Mixed];
  conditions: [mongoose.Schema.Types.Mixed];
  variables: [mongoose.Schema.Types.Mixed];
  timeout: Number;
  maxConcurrentExecutions: Number;
  status: String;
  version: String;
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

export interface IBusinessRule extends Document {
  name: String;
  domain: String;
  condition: mongoose.Schema.Types.Mixed;
  actions: [mongoose.Schema.Types.Mixed];
  priority: Number;
  enabled: Boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SERVICE TYPES
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  activeWorkflows: number;
  runningExecutions: number;
  totalExecutions: number;
  successRate: number;
  lastProcessed: Date;
}

export interface ServiceStats {
  totalWorkflows: number;
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  byDomain: Record<BusinessDomain, number>;
  byType: Record<WorkflowType, number>;
}

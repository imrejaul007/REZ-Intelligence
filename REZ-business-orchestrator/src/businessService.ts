/**
 * REZ Business Orchestrator - Core Service
 *
 * Business Intelligence Orchestrator - Cross-domain workflow automation
 */

import { v4 as uuidv4 } from 'uuid';
import logger from './utils/logger.js';
import type {
  BusinessWorkflow,
  WorkflowExecution,
  BusinessRule,
  WorkflowTemplate,
  CrossDomainContext,
  CreateWorkflowRequest,
  ExecuteWorkflowRequest,
  EvaluateRulesRequest,
  EvaluateRulesResponse,
} from './types';

// In-memory stores
const workflows = new Map<string, BusinessWorkflow>();
const executions = new Map<string, WorkflowExecution>();
const rules = new Map<string, BusinessRule>();
const templates: WorkflowTemplate[] = [];

// ============================================
// WORKFLOW MANAGEMENT
// ============================================

export async function createWorkflow(request: CreateWorkflowRequest): Promise<{ success: boolean; workflow?: BusinessWorkflow; error?: string }> {
  try {
    const workflow: BusinessWorkflow = {
      id: uuidv4(),
      name: request.name,
      type: request.type,
      domain: request.domain,
      steps: request.steps.map(s => ({ ...s, id: uuidv4() })),
      triggers: request.triggers || [],
      conditions: request.conditions || [],
      variables: (request.variables || []).map(v => ({ ...v, name: v.name || uuidv4() })),
      timeout: request.options?.timeout || 3600000,
      maxConcurrentExecutions: request.options?.maxConcurrent || 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      version: '1.0.0',
    };

    workflows.set(workflow.id, workflow);
    logger.info('Workflow created', { workflowId: workflow.id, name: workflow.name });

    return { success: true, workflow };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function getWorkflow(workflowId: string): Promise<BusinessWorkflow | null> {
  return workflows.get(workflowId) || null;
}

export async function listWorkflows(options?: {
  domain?: string;
  type?: string;
  status?: string;
}): Promise<BusinessWorkflow[]> {
  let result = Array.from(workflows.values());

  if (options?.domain) {
    result = result.filter(w => w.domain === options.domain);
  }
  if (options?.type) {
    result = result.filter(w => w.type === options.type);
  }
  if (options?.status) {
    result = result.filter(w => w.status === options.status);
  }

  return result;
}

export async function updateWorkflow(
  workflowId: string,
  updates: Partial<BusinessWorkflow>
): Promise<BusinessWorkflow | null> {
  const workflow = workflows.get(workflowId);
  if (!workflow) return null;

  const updated = { ...workflow, ...updates, updatedAt: new Date() };
  workflows.set(workflowId, updated);
  return updated;
}

// ============================================
// WORKFLOW EXECUTION
// ============================================

export async function executeWorkflow(
  request: ExecuteWorkflowRequest
): Promise<{ success: boolean; execution?: WorkflowExecution; error?: string }> {
  try {
    const workflow = workflows.get(request.workflowId);
    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }

    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: 'pending',
      context: request.context || {},
      results: {},
      startedAt: new Date(),
      logs: [],
    };

    executions.set(execution.id, execution);

    // Start execution asynchronously
    setImmediate(() => processWorkflowExecution(execution, workflow));

    return { success: true, execution };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

async function processWorkflowExecution(
  execution: WorkflowExecution,
  workflow: BusinessWorkflow
): Promise<void> {
  const startTime = Date.now();

  try {
    execution.status = 'running';

    for (const step of workflow.steps) {
      execution.currentStep = step.id;
      execution.logs.push({
        timestamp: new Date(),
        step: step.id,
        level: 'info',
        message: `Starting step: ${step.name}`,
      });

      // Evaluate conditions
      if (!evaluateConditions(step, execution.context)) {
        execution.logs.push({
          timestamp: new Date(),
          step: step.id,
          level: 'warn',
          message: 'Conditions not met, skipping step',
        });
        continue;
      }

      // Execute step
      const result = await executeStep(step, execution.context);
      execution.results[step.id] = result;

      execution.logs.push({
        timestamp: new Date(),
        step: step.id,
        level: 'info',
        message: `Step completed: ${step.name}`,
        data: result,
      });

      execution.context[`step_${step.id}`] = result;
    }

    execution.status = 'completed';
    execution.completedAt = new Date();
    execution.metrics = {
      totalSteps: workflow.steps.length,
      completedSteps: workflow.steps.length,
      failedSteps: 0,
      skippedSteps: 0,
      totalDuration: Date.now() - startTime,
      stepDurations: {},
      serviceCalls: {},
    };

    logger.info('Workflow execution completed', {
      executionId: execution.id,
      duration: execution.metrics.totalDuration,
    });
  } catch (error) {
    execution.status = 'failed';
    execution.error = error instanceof Error ? error.message : 'Unknown error';
    execution.completedAt = new Date();

    logger.error('Workflow execution failed', { executionId: execution.id, error: execution.error });
  }
}

function evaluateConditions(step: BusinessWorkflow['steps'][0], context: Record<string, unknown>): boolean {
  // Simple condition evaluation
  return true;
}

async function executeStep(
  step: BusinessWorkflow['steps'][0],
  context: Record<string, unknown>
): Promise<unknown> {
  // Simulate step execution
  return {
    stepId: step.id,
    stepName: step.name,
    service: step.service,
    action: step.action,
    result: 'completed',
    timestamp: new Date(),
  };
}

export async function getExecution(executionId: string): Promise<WorkflowExecution | null> {
  return executions.get(executionId) || null;
}

export async function cancelExecution(executionId: string): Promise<boolean> {
  const execution = executions.get(executionId);
  if (!execution || execution.status !== 'running') return false;

  execution.status = 'cancelled';
  execution.completedAt = new Date();
  executions.set(executionId, execution);
  return true;
}

// ============================================
// BUSINESS RULES
// ============================================

export async function createRule(
  rule: Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt'>
): Promise<BusinessRule> {
  const newRule: BusinessRule = {
    ...rule,
    id: uuidv4(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  rules.set(newRule.id, newRule);
  return newRule;
}

export async function evaluateRules(request: EvaluateRulesRequest): Promise<EvaluateRulesResponse> {
  try {
    const applicableRules = Array.from(rules.values()).filter(
      r => r.domain === request.domain && r.enabled
    );

    const triggeredRules: EvaluateRulesResponse['triggeredRules'] = [];

    for (const rule of applicableRules) {
      if (evaluateRuleCondition(rule.condition, request.data)) {
        triggeredRules.push({
          rule,
          actions: rule.actions,
        });
      }
    }

    // Sort by priority
    triggeredRules.sort((a, b) => b.rule.priority - a.rule.priority);

    return { success: true, triggeredRules };
  } catch (error) {
    return { success: false, triggeredRules: [], error: 'Evaluation failed' };
  }
}

function evaluateRuleCondition(
  condition: BusinessRule['condition'],
  data: Record<string, unknown>
): boolean {
  const value = data[condition.field];
  const targetValue = condition.value;

  switch (condition.operator) {
    case '==': return value === targetValue;
    case '!=': return value !== targetValue;
    case '>': return (value as number) > (targetValue as number);
    case '<': return (value as number) < (targetValue as number);
    case '>=': return (value as number) >= (targetValue as number);
    case '<=': return (value as number) <= (targetValue as number);
    case 'contains': return String(value).includes(String(targetValue));
    case 'in': return Array.isArray(targetValue) && targetValue.includes(value);
    case 'between': return (
      (value as number) >= (targetValue as number) &&
      (value as number) <= (condition.value2 as number)
    );
    default: return false;
  }
}

// ============================================
// TEMPLATES
// ============================================

export function getTemplates(): WorkflowTemplate[] {
  return templates.length > 0 ? templates : [
    {
      id: 'user-onboarding',
      name: 'User Onboarding',
      type: 'onboarding',
      domain: 'commerce',
      description: 'Complete onboarding flow for new users',
      steps: [
        { name: 'Send Welcome', type: 'service_call', service: 'notification', action: 'send', parameters: {} },
        { name: 'Show Tutorial', type: 'notification', service: 'ui', action: 'show', parameters: {} },
        { name: 'First Purchase Offer', type: 'service_call', service: 'offer', action: 'create', parameters: {} },
      ],
      requiredVariables: ['userId'],
      optionalVariables: ['email', 'phone'],
      estimatedDuration: 300,
      successRate: 0.85,
    },
    {
      id: 'churn-prevention',
      name: 'Churn Prevention',
      type: 'retention',
      domain: 'marketing',
      description: 'Re-engage at-risk users',
      steps: [
        { name: 'Identify Risk', type: 'service_call', service: 'predictive', action: 'check_risk', parameters: {} },
        { name: 'Send Offer', type: 'service_call', service: 'offer', action: 'create_personalized', parameters: {} },
        { name: 'Track Response', type: 'condition', service: 'analytics', action: 'track', parameters: {} },
      ],
      requiredVariables: ['userId', 'riskScore'],
      optionalVariables: ['preferredChannel'],
      estimatedDuration: 86400,
      successRate: 0.45,
    },
    {
      id: 'order-fulfillment',
      name: 'Order Fulfillment',
      type: 'fulfillment',
      domain: 'commerce',
      description: 'Process and fulfill order',
      steps: [
        { name: 'Validate Order', type: 'service_call', service: 'order', action: 'validate', parameters: {} },
        { name: 'Process Payment', type: 'service_call', service: 'payment', action: 'charge', parameters: {} },
        { name: 'Notify Merchant', type: 'service_call', service: 'notification', action: 'send', parameters: {} },
        { name: 'Schedule Delivery', type: 'service_call', service: 'delivery', action: 'schedule', parameters: {} },
      ],
      requiredVariables: ['orderId', 'userId', 'merchantId'],
      optionalVariables: ['deliveryAddress', 'specialInstructions'],
      estimatedDuration: 300,
      successRate: 0.95,
    },
  ];
}

// ============================================
// CROSS-DOMAIN CONTEXT
// ============================================

export function createCrossDomainContext(
  userId?: string,
  merchantId?: string,
  orderId?: string
): CrossDomainContext {
  return {
    userId,
    merchantId,
    orderId,
    sessionId: uuidv4(),
    variables: {},
    createdAt: new Date(),
  };
}

// ============================================
// ANALYTICS
// ============================================

export function getWorkflowAnalytics(
  workflowId: string,
  period: { start: Date; end: Date }
): {
  workflowId: string;
  period: { start: Date; end: Date };
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
} | null {
  const workflow = workflows.get(workflowId);
  if (!workflow) return null;

  const workflowExecutions = Array.from(executions.values()).filter(
    e => e.workflowId === workflowId
  );

  const completed = workflowExecutions.filter(e => e.status === 'completed').length;
  const total = workflowExecutions.length;

  return {
    workflowId,
    period,
    totalExecutions: total,
    successRate: total > 0 ? completed / total : 0,
    avgDuration: 1000,
  };
}

// ============================================
// HEALTH & STATS
// ============================================

export function getHealthStatus() {
  return {
    status: 'healthy' as const,
    uptime: Date.now(),
    activeWorkflows: Array.from(workflows.values()).filter(w => w.status === 'active').length,
    runningExecutions: Array.from(executions.values()).filter(e => e.status === 'running').length,
    totalExecutions: executions.size,
    successRate: 0.95,
    lastProcessed: new Date(),
  };
}

export function getStats() {
  const byDomain: Record<string, number> = {};
  const byType: Record<string, number> = {};

  workflows.forEach(w => {
    byDomain[w.domain] = (byDomain[w.domain] || 0) + 1;
    byType[w.type] = (byType[w.type] || 0) + 1;
  });

  return {
    totalWorkflows: workflows.size,
    totalExecutions: executions.size,
    successRate: 0.95,
    avgDuration: 1000,
    byDomain,
    byType,
  };
}

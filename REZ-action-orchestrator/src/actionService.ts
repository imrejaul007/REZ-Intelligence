/**
 * REZ Action Orchestrator - Core Service
 *
 * AI Action Engine - Autonomous execution orchestration
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from './utils/logger.js';

// Crypto-based random number generator for secure randomness
function secureRandom(): number {
  return parseInt(crypto.randomBytes(4).toString('hex'), 16) / 0xFFFFFFFF;
}
import type {
  Action,
  ActionType,
  ActionResult,
  Tool,
  ToolExecution,
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  Plan,
  PlanStep,
  PlanExecution,
  ExecutionContext,
  ExecutionQueue,
  QueueItem,
  ExecuteActionRequest,
  ExecuteActionResponse,
  CreateWorkflowRequest,
  CreateWorkflowResponse,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  CreatePlanRequest,
  CreatePlanResponse,
  ExecutePlanRequest,
  ExecutePlanResponse,
  RegisterToolRequest,
  RegisterToolResponse,
  HealthStatus,
  ServiceStats,
} from './types';

// In-memory stores
const actions = new Map<string, Action>();
const tools = new Map<string, Tool>();
const workflows = new Map<string, Workflow>();
const workflowExecutions = new Map<string, WorkflowExecution>();
const plans = new Map<string, Plan>();
const planExecutions = new Map<string, PlanExecution>();
const contexts = new Map<string, ExecutionContext>();
const executionQueue: ExecutionQueue = {
  id: uuidv4(),
  name: 'main-execution-queue',
  priority: 'normal',
  items: [],
  processing: false,
};

// ============================================
// TOOL MANAGEMENT
// ============================================

export async function registerTool(request: RegisterToolRequest): Promise<RegisterToolResponse> {
  try {
    const tool: Tool = {
      id: uuidv4(),
      name: request.name,
      description: request.description,
      category: request.category,
      parameters: request.parameters,
      returns: request.returns,
      requiresAuth: request.options?.requiresAuth ?? false,
      rateLimit: request.options?.rateLimit,
      timeout: request.options?.timeout ?? 30000,
      version: '1.0.0',
    };

    tools.set(tool.id, tool);
    logger.info('Tool registered', { toolId: tool.id, name: tool.name });

    return { success: true, tool };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Tool registration failed', { error: message });
    return { success: false, error: message };
  }
}

export async function getTool(toolId: string): Promise<Tool | null> {
  return tools.get(toolId) || null;
}

export async function listTools(category?: string): Promise<Tool[]> {
  const allTools = Array.from(tools.values());
  if (category) {
    return allTools.filter(t => t.category === category);
  }
  return allTools;
}

export async function executeTool(
  toolId: string,
  parameters: Record<string, unknown>,
  actionId?: string
): Promise<ToolExecution> {
  const tool = tools.get(toolId);
  if (!tool) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  const execution: ToolExecution = {
    id: uuidv4(),
    toolId,
    actionId: actionId || '',
    parameters,
    startedAt: new Date(),
  };

  try {
    // Simulate tool execution (in production, this would call the actual tool)
    const startTime = Date.now();

    // Validate parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
    }

    // Execute based on tool category
    let result: unknown;
    switch (tool.category) {
      case 'data':
        result = await executeDataTool(tool, parameters);
        break;
      case 'computation':
        result = await executeComputationTool(tool, parameters);
        break;
      case 'communication':
        result = await executeCommunicationTool(tool, parameters);
        break;
      case 'integration':
        result = await executeIntegrationTool(tool, parameters);
        break;
      case 'automation':
        result = await executeAutomationTool(tool, parameters);
        break;
      case 'analysis':
        result = await executeAnalysisTool(tool, parameters);
        break;
      default:
        result = { executed: true, parameters };
    }

    execution.completedAt = new Date();
    execution.duration = Date.now() - startTime;
    execution.result = result;

    logger.info('Tool executed', { toolId, duration: execution.duration });
  } catch (error) {
    execution.error = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Tool execution failed', { toolId, error: execution.error });
  }

  return execution;
}

async function executeDataTool(tool: Tool, params: Record<string, unknown>): Promise<unknown> {
  // Simulate data operations
  return { data: params, operation: 'data_query', timestamp: new Date() };
}

async function executeComputationTool(tool: Tool, params: Record<string, unknown>): Promise<unknown> {
  // Simulate computation
  const a = (params.a as number) || 0;
  const b = (params.b as number) || 0;
  const operation = (params.operation as string) || 'add';

  let result: number;
  switch (operation) {
    case 'add': result = a + b; break;
    case 'subtract': result = a - b; break;
    case 'multiply': result = a * b; break;
    case 'divide': result = b !== 0 ? a / b : 0; break;
    default: result = a + b;
  }

  return { result, operation, operands: [a, b] };
}

async function executeCommunicationTool(tool: Tool, params: Record<string, unknown>): Promise<unknown> {
  // Simulate communication (notification, message, etc.)
  return {
    sent: true,
    recipient: params.recipient,
    message: params.message,
    channel: params.channel || 'system',
  };
}

async function executeIntegrationTool(tool: Tool, params: Record<string, unknown>): Promise<unknown> {
  // Simulate external API call
  return {
    integrated: true,
    endpoint: params.endpoint,
    response: { status: 'success', data: params },
  };
}

async function executeAutomationTool(tool: Tool, params: Record<string, unknown>): Promise<unknown> {
  // Simulate automation
  return {
    automated: true,
    action: params.action,
    target: params.target,
  };
}

async function executeAnalysisTool(tool: Tool, params: Record<string, unknown>): Promise<unknown> {
  // Simulate analysis
  return {
    analyzed: true,
    input: params.input,
    insights: ['Pattern detected', 'Trend identified'],
  };
}

// ============================================
// ACTION EXECUTION
// ============================================

export async function executeAction(request: ExecuteActionRequest): Promise<ExecuteActionResponse> {
  try {
    const action: Action = {
      id: uuidv4(),
      name: request.actionName,
      type: request.actionType,
      description: `Execute ${request.actionName}`,
      parameters: request.parameters,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: request.options?.maxRetries ?? 3,
    };

    actions.set(action.id, action);

    // Start execution asynchronously
    setImmediate(() => processAction(action, request.options?.timeout ?? 60000));

    // Create execution context
    const context = createExecutionContext('action', action.id);
    contexts.set(context.id, context);

    return { success: true, action };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Action execution failed', { error: message });
    return { success: false, error: message };
  }
}

async function processAction(action: Action, timeout: number): Promise<void> {
  const startTime = Date.now();

  try {
    action.status = 'running';
    action.startedAt = new Date();

    // Execute based on action type
    let result: ActionResult;
    switch (action.type) {
      case 'query':
        result = await executeQueryAction(action);
        break;
      case 'calculation':
        result = await executeCalculationAction(action);
        break;
      case 'decision':
        result = await executeDecisionAction(action);
        break;
      case 'notification':
        result = await executeNotificationAction(action);
        break;
      case 'workflow':
        result = await executeWorkflowAction(action);
        break;
      case 'external_api':
        result = await executeExternalApiAction(action);
        break;
      case 'database':
        result = await executeDatabaseAction(action);
        break;
      case 'transform':
        result = await executeTransformAction(action);
        break;
      default:
        result = { success: true, output: 'Action completed' };
    }

    action.result = result;
    action.status = 'completed';
    action.completedAt = new Date();

    logger.info('Action completed', {
      actionId: action.id,
      duration: Date.now() - startTime,
      success: result.success,
    });
  } catch (error) {
    action.status = 'failed';
    action.error = error instanceof Error ? error.message : 'Unknown error';
    action.completedAt = new Date();

    logger.error('Action failed', { actionId: action.id, error: action.error });

    // Retry logic
    if (action.retryCount < action.maxRetries) {
      action.retryCount++;
      action.status = 'pending';
      setTimeout(() => processAction(action, timeout), 1000 * action.retryCount);
    }
  }
}

async function executeQueryAction(action: Action): Promise<ActionResult> {
  const { query, collection } = action.parameters as { query?: string; collection?: string };
  return {
    success: true,
    data: { query, collection, results: [] },
    output: `Query executed on ${collection || 'unknown collection'}`,
    executionTime: secureRandom() * 100,
  };
}

async function executeCalculationAction(action: Action): Promise<ActionResult> {
  const { operation, operands } = action.parameters as {
    operation?: string;
    operands?: number[];
  };

  let result: number;
  const nums = operands || [0, 0];
  switch (operation) {
    case 'add': result = nums[0] + nums[1]; break;
    case 'subtract': result = nums[0] - nums[1]; break;
    case 'multiply': result = nums[0] * nums[1]; break;
    case 'divide': result = nums[1] !== 0 ? nums[0] / nums[1] : 0; break;
    case 'power': result = Math.pow(nums[0], nums[1] || 2); break;
    case 'sqrt': result = Math.sqrt(nums[0]); break;
    default: result = nums[0] + nums[1];
  }

  return {
    success: true,
    data: { operation, operands: nums, result },
    output: `Calculation result: ${result}`,
    executionTime: secureRandom() * 50,
  };
}

async function executeDecisionAction(action: Action): Promise<ActionResult> {
  const { condition, options } = action.parameters as {
    condition?: string;
    options?: { ifTrue?: unknown; ifFalse?: unknown };
  };

  // Simple decision logic (in production, this would evaluate complex conditions)
  const decision = secureRandom() > 0.5;
  const outcome = decision ? options?.ifTrue : options?.ifFalse;

  return {
    success: true,
    data: { condition, decision, outcome },
    output: `Decision made: ${decision ? 'true' : 'false'}`,
    executionTime: secureRandom() * 30,
  };
}

async function executeNotificationAction(action: Action): Promise<ActionResult> {
  const { recipient, message, channel } = action.parameters as {
    recipient?: string;
    message?: string;
    channel?: string;
  };

  return {
    success: true,
    data: { recipient, message, channel, sent: true },
    output: `Notification sent to ${recipient} via ${channel || 'default'}`,
    executionTime: secureRandom() * 200,
  };
}

async function executeWorkflowAction(action: Action): Promise<ActionResult> {
  const { workflowId, context } = action.parameters as {
    workflowId?: string;
    context?: Record<string, unknown>;
  };

  if (!workflowId) {
    return { success: false, error: 'No workflow ID provided' };
  }

  const execution = await executeWorkflowInternal(workflowId, context || {});
  return {
    success: execution.status === 'completed',
    data: { workflowId, executionId: execution.id },
    output: `Workflow ${workflowId} executed`,
    executionTime: secureRandom() * 500,
  };
}

async function executeExternalApiAction(action: Action): Promise<ActionResult> {
  const { endpoint, method, headers, body } = action.parameters as {
    endpoint?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };

  // Simulate API call
  return {
    success: true,
    data: {
      endpoint,
      method: method || 'GET',
      statusCode: 200,
      response: { success: true },
    },
    output: `API call to ${endpoint} completed`,
    executionTime: secureRandom() * 300,
  };
}

async function executeDatabaseAction(action: Action): Promise<ActionResult> {
  const { operation, collection, document } = action.parameters as {
    operation?: string;
    collection?: string;
    document?: unknown;
  };

  return {
    success: true,
    data: {
      operation: operation || 'read',
      collection,
      documentId: uuidv4(),
      document,
    },
    output: `Database ${operation} on ${collection} completed`,
    executionTime: secureRandom() * 100,
  };
}

async function executeTransformAction(action: Action): Promise<ActionResult> {
  const { input, transform } = action.parameters as {
    input?: unknown;
    transform?: string;
  };

  return {
    success: true,
    data: { input, transform, output: input },
    output: `Transform ${transform} applied`,
    executionTime: secureRandom() * 50,
  };
}

// ============================================
// WORKFLOW MANAGEMENT
// ============================================

export async function createWorkflow(request: CreateWorkflowRequest): Promise<CreateWorkflowResponse> {
  try {
    const workflow: Workflow = {
      id: uuidv4(),
      name: request.name,
      description: request.description,
      version: '1.0.0',
      steps: request.steps.map((s, i) => ({
        ...s,
        id: (s as { id?: string }).id || uuidv4(),
      })),
      triggers: request.triggers || [],
      conditions: (request.conditions || []).map((c, i) => ({
        ...c,
        id: (c as { id?: string }).id || `cond_${i}`,
      })),
      variables: (request.variables || []).map((v, i) => ({
        ...v,
        name: (v as { name?: string }).name || `var_${i}`,
      })),
      timeout: request.options?.timeout ?? 3600000,
      maxConcurrentExecutions: request.options?.maxConcurrent ?? 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    };

    workflows.set(workflow.id, workflow);
    logger.info('Workflow created', { workflowId: workflow.id, name: workflow.name });

    return { success: true, workflow };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Workflow creation failed', { error: message });
    return { success: false, error: message };
  }
}

export async function getWorkflow(workflowId: string): Promise<Workflow | null> {
  return workflows.get(workflowId) || null;
}

export async function listWorkflows(): Promise<Workflow[]> {
  return Array.from(workflows.values());
}

export async function executeWorkflow(request: ExecuteWorkflowRequest): Promise<ExecuteWorkflowResponse> {
  try {
    const workflow = workflows.get(request.workflowId);
    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }

    const execution = await executeWorkflowInternal(
      workflow.id,
      request.context || {},
      request.options?.sync
    );

    if (request.options?.sync) {
      await waitForExecution(execution.id, request.options.timeout || workflow.timeout);
    }

    return { success: true, execution };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Workflow execution failed', { error: message });
    return { success: false, error: message };
  }
}

async function executeWorkflowInternal(
  workflowId: string,
  initialContext: Record<string, unknown>,
  sync = false
): Promise<WorkflowExecution> {
  const workflow = workflows.get(workflowId)!;

  const execution: WorkflowExecution = {
    id: uuidv4(),
    workflowId,
    workflowVersion: workflow.version,
    status: 'pending',
    context: initialContext,
    results: {},
    startedAt: new Date(),
    logs: [],
  };

  workflowExecutions.set(execution.id, execution);

  if (!sync) {
    setImmediate(() => processWorkflowExecution(execution, workflow));
  } else {
    await processWorkflowExecution(execution, workflow);
  }

  return execution;
}

async function processWorkflowExecution(
  execution: WorkflowExecution,
  workflow: Workflow
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

      // Execute step
      const stepResult = await executeWorkflowStep(step, execution.context);
      execution.results[step.id] = stepResult;

      execution.logs.push({
        timestamp: new Date(),
        step: step.id,
        level: 'info',
        message: `Step completed: ${step.name}`,
        data: stepResult,
      });

      // Update context with results
      execution.context[`step_${step.id}_result`] = stepResult;
    }

    execution.status = 'completed';
    execution.completedAt = new Date();

    logger.info('Workflow execution completed', {
      executionId: execution.id,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    execution.status = 'failed';
    execution.error = error instanceof Error ? error.message : 'Unknown error';
    execution.completedAt = new Date();

    execution.logs.push({
      timestamp: new Date(),
      step: execution.currentStep || 'unknown',
      level: 'error',
      message: `Workflow failed: ${execution.error}`,
    });

    logger.error('Workflow execution failed', { executionId: execution.id, error: execution.error });
  }
}

function evaluateConditions(
  conditions: Workflow['conditions'],
  context: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true;

  for (const condition of conditions) {
    const value = context[condition.expression];
    let matches = false;

    switch (condition.operator) {
      case '==': matches = value === condition.value; break;
      case '!=': matches = value !== condition.value; break;
      case '>': matches = (value as number) > (condition.value as number); break;
      case '<': matches = (value as number) < (condition.value as number); break;
      case '>=': matches = (value as number) >= (condition.value as number); break;
      case '<=': matches = (value as number) <= (condition.value as number); break;
      case 'contains': matches = String(value).includes(String(condition.value)); break;
      case 'matches': matches = new RegExp(String(condition.value)).test(String(value)); break;
    }

    if (!matches) return false;
  }

  return true;
}

async function executeWorkflowStep(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<unknown> {
  // Merge step parameters with context
  const params = { ...step.parameters, ...context };

  switch (step.type) {
    case 'tool':
      if (step.tool) {
        const execution = await executeTool(step.tool, params);
        return execution.result || execution.error;
      }
      break;
    case 'action':
      if (step.action) {
        const result = await executeActionInternal(step.action, params);
        return result;
      }
      break;
    case 'condition':
      return evaluateConditions(step.parameters.conditions as Workflow['conditions'] || [], context);
    case 'transform':
      return transformData(params, step.parameters.transform as string);
    case 'wait':
      await sleep(step.parameters.duration as number || 1000);
      return { waited: true, duration: step.parameters.duration };
    default:
      return { step: step.name, executed: true };
  }

  return { step: step.name, executed: true };
}

async function executeActionInternal(actionName: string, params: Record<string, unknown>): Promise<unknown> {
  const request: ExecuteActionRequest = {
    actionName,
    actionType: 'query',
    parameters: params,
  };

  const response = await executeAction(request);
  return response.result || response.error;
}

function transformData(data: unknown, transform: string): unknown {
  // Simple transform implementations
  switch (transform) {
    case 'flatten':
      return flattenObject(data as Record<string, unknown>);
    case 'group':
      return groupByField(data as unknown[], 'type');
    case 'sort':
      return sortByField(data as unknown[], 'value');
    default:
      return data;
  }
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

function groupByField(items: unknown[], field: string): Record<string, unknown[]> {
  return items.reduce((acc: Record<string, unknown[]>, item) => {
    const value = (item as Record<string, unknown>)[field] || 'unknown';
    if (!acc[String(value)]) acc[String(value)] = [];
    acc[String(value)].push(item);
    return acc;
  }, {});
}

function sortByField(items: unknown[], field: string): unknown[] {
  return [...items].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[field];
    const bVal = (b as Record<string, unknown>)[field];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }
    return String(aVal).localeCompare(String(bVal));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForExecution(
  executionId: string,
  timeout: number
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const execution = workflowExecutions.get(executionId);
    if (execution?.status === 'completed' || execution?.status === 'failed') {
      return;
    }
    await sleep(100);
  }

  throw new Error('Execution timed out');
}

// ============================================
// PLAN MANAGEMENT
// ============================================

export async function createPlan(request: CreatePlanRequest): Promise<CreatePlanResponse> {
  try {
    const plan = await generatePlan(request.goal, request.constraints, request.context);

    if (!plan) {
      return { success: false, error: 'Failed to generate plan' };
    }

    return { success: true, plan };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plan creation failed', { error: message });
    return { success: false, error: message };
  }
}

async function generatePlan(
  goal: string,
  constraints?: { maxSteps?: number; maxCost?: number; maxDuration?: number },
  context?: Record<string, unknown>
): Promise<Plan | null> {
  // Generate plan steps based on goal
  const steps: PlanStep[] = [];

  // Parse goal and create steps
  const goalKeywords = goal.toLowerCase().split(' ');

  // Determine required steps based on goal
  if (goalKeywords.some(k => ['search', 'find', 'get', 'fetch'].includes(k))) {
    steps.push({
      id: uuidv4(),
      order: 1,
      description: 'Query data source',
      tool: 'data_query',
      parameters: { query: goal },
      dependencies: [],
      estimatedDuration: 1000,
      estimatedCost: 0.01,
      risk: 'low',
      status: 'pending',
    });
  }

  if (goalKeywords.some(k => ['analyze', 'calculate', 'compute', 'process'].includes(k))) {
    steps.push({
      id: uuidv4(),
      order: steps.length + 1,
      description: 'Process and analyze data',
      tool: 'data_processing',
      parameters: { operation: 'analyze' },
      dependencies: steps.length > 0 ? [steps[steps.length - 1].id] : [],
      estimatedDuration: 2000,
      estimatedCost: 0.02,
      risk: 'low',
      status: 'pending',
    });
  }

  if (goalKeywords.some(k => ['notify', 'send', 'alert', 'message'].includes(k))) {
    steps.push({
      id: uuidv4(),
      order: steps.length + 1,
      description: 'Send notification',
      tool: 'notification',
      parameters: { channel: 'system' },
      dependencies: steps.length > 0 ? [steps[steps.length - 1].id] : [],
      estimatedDuration: 500,
      estimatedCost: 0.005,
      risk: 'medium',
      status: 'pending',
    });
  }

  if (goalKeywords.some(k => ['save', 'store', 'persist', 'update'].includes(k))) {
    steps.push({
      id: uuidv4(),
      order: steps.length + 1,
      description: 'Store results',
      tool: 'database',
      parameters: { operation: 'write' },
      dependencies: steps.length > 0 ? [steps[steps.length - 1].id] : [],
      estimatedDuration: 500,
      estimatedCost: 0.005,
      risk: 'low',
      status: 'pending',
    });
  }

  if (steps.length === 0) {
    // Default step
    steps.push({
      id: uuidv4(),
      order: 1,
      description: 'Execute goal',
      action: 'generic_execution',
      parameters: { goal },
      dependencies: [],
      estimatedDuration: 1000,
      estimatedCost: 0.01,
      risk: 'medium',
      status: 'pending',
    });
  }

  // Apply constraints
  const maxSteps = constraints?.maxSteps || 10;
  const limitedSteps = steps.slice(0, maxSteps);

  const plan: Plan = {
    id: uuidv4(),
    goal,
    steps: limitedSteps,
    estimatedDuration: limitedSteps.reduce((sum, s) => sum + s.estimatedDuration, 0),
    estimatedCost: limitedSteps.reduce((sum, s) => sum + s.estimatedCost, 0),
    confidence: 0.85,
    reasoning: `Generated ${limitedSteps.length} steps to achieve: ${goal}`,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
    status: 'draft',
  };

  plans.set(plan.id, plan);
  return plan;
}

export async function executePlan(request: ExecutePlanRequest): Promise<ExecutePlanResponse> {
  try {
    const plan = plans.get(request.planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    const execution = await executePlanInternal(plan, request.options);

    return { success: true, execution };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plan execution failed', { error: message });
    return { success: false, error: message };
  }
}

async function executePlanInternal(
  plan: Plan,
  options?: { stopOnFailure?: boolean; parallelSteps?: boolean }
): Promise<PlanExecution> {
  plan.status = 'active';

  const execution: PlanExecution = {
    id: uuidv4(),
    planId: plan.id,
    status: 'running',
    currentStep: 0,
    completedSteps: [],
    failedSteps: [],
    results: {},
    startedAt: new Date(),
  };

  planExecutions.set(execution.id, execution);

  setImmediate(async () => {
    try {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        execution.currentStep = i;

        // Check dependencies
        const depsMet = step.dependencies.every(dep => execution.completedSteps.includes(dep));
        if (!depsMet) {
          step.status = 'skipped';
          continue;
        }

        step.status = 'running';

        try {
          // Execute step
          if (step.tool) {
            const toolExec = await executeTool(step.tool, step.parameters);
            step.result = toolExec.result;
            if (toolExec.error) {
              step.status = 'failed';
              step.error = toolExec.error;
              execution.failedSteps.push(step.id);
            } else {
              step.status = 'completed';
              execution.completedSteps.push(step.id);
            }
          } else if (step.action) {
            // Execute action
            step.result = { action: step.action, params: step.parameters };
            step.status = 'completed';
            execution.completedSteps.push(step.id);
          }

          execution.results[step.id] = step.result;
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Unknown error';
          execution.failedSteps.push(step.id);

          if (options?.stopOnFailure) {
            break;
          }
        }
      }

      execution.status = execution.failedSteps.length > 0 ? 'failed' : 'completed';
      execution.completedAt = new Date();
      plan.status = execution.status === 'completed' ? 'completed' : 'failed';

      logger.info('Plan execution completed', {
        executionId: execution.id,
        completed: execution.completedSteps.length,
        failed: execution.failedSteps.length,
      });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
    }
  });

  return execution;
}

// ============================================
// CONTEXT MANAGEMENT
// ============================================

function createExecutionContext(
  type: ExecutionContext['type'],
  parentId?: string
): ExecutionContext {
  return {
    id: uuidv4(),
    type,
    parentId,
    variables: {},
    artifacts: {},
    history: [],
    createdAt: new Date(),
    metadata: {},
  };
}

// ============================================
// HEALTH & STATS
// ============================================

export function getHealthStatus(): HealthStatus {
  const now = Date.now();
  const runningActions = Array.from(actions.values()).filter(a => a.status === 'running');
  const runningWorkflows = Array.from(workflowExecutions.values()).filter(e => e.status === 'running');
  const runningPlans = Array.from(planExecutions.values()).filter(e => e.status === 'running');

  return {
    status: 'healthy',
    uptime: now,
    actionsExecuted: actions.size,
    workflowsExecuted: workflowExecutions.size,
    plansExecuted: planExecutions.size,
    activeExecutions: runningActions.length + runningWorkflows.length + runningPlans.length,
    queueDepth: executionQueue.items.length,
    lastProcessed: new Date(),
  };
}

export function getStats(): ServiceStats {
  const actionTypes: Record<string, number> = {};
  actions.forEach(a => {
    actionTypes[a.type] = (actionTypes[a.type] || 0) + 1;
  });

  const completedActions = Array.from(actions.values()).filter(a => a.status === 'completed');
  const totalActions = actions.size;
  const successRate = totalActions > 0 ? completedActions.length / totalActions : 0;

  return {
    totalActions: actions.size,
    totalWorkflows: workflows.size,
    totalPlans: plans.size,
    totalTools: tools.size,
    avgExecutionTime: 100, // Simplified
    successRate,
    byType: actionTypes,
  };
}

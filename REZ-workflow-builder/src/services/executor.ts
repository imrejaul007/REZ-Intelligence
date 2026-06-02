/**
 * Workflow Builder - Execution Engine
 * Runs workflows based on visual definitions
 */

import { Workflow, Execution, Segment } from '../models';
import { v4 as uuid } from 'uuid';
import { AppError, NotFoundError, ValidationError, BusinessRuleError } from '../../../../shared/rez-errors/src';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/workflow-builder';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

interface NodeResult {
  nodeId: string;
  status: 'success' | 'failed' | 'skipped';
  output: any;
  error?: string;
}

interface ExecutionContext {
  executionId: string;
  workflowId: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  triggerData: any;
  variables: Record<string, any>;
}

class WorkflowExecutor {
  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    trigger: string,
    triggerData: any,
    context: {
      userId?: string;
      entityId?: string;
      entityType?: string;
    }
  ): Promise<{ executionId: string; status: string }> {
    const workflow = await Workflow.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError('Workflow', workflowId);
    }

    if (workflow.status !== 'active') {
      throw new BusinessRuleError('Workflow is not active');
    }

    const executionId = `exec_${uuid()}`;
    const startTime = Date.now();

    // Create execution record
    const execution = await Execution.create({
      workflowId,
      workflowVersion: workflow.version,
      executionId,
      trigger,
      triggerData,
      userId: context.userId,
      entityId: context.entityId,
      entityType: context.entityType,
      status: 'pending',
    });

    // Update workflow stats
    await Workflow.updateOne(
      { _id: workflowId },
      { $inc: { 'stats.runs': 1 } }
    );

    try {
      // Execute workflow
      const result = await this.runWorkflow(workflow, executionId, triggerData, context);

      // Update execution
      await Execution.updateOne(
        { executionId },
        {
          status: result.status,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          nodeHistory: result.history,
          error: result.error,
        }
      );

      // Update workflow stats
      if (result.status === 'completed') {
        await Workflow.updateOne(
          { _id: workflowId },
          { $inc: { 'stats.success': 1 }, $set: { 'stats.lastRun': new Date() } }
        );
      } else {
        await Workflow.updateOne(
          { _id: workflowId },
          { $inc: { 'stats.failed': 1 } }
        );
      }

      return { executionId, status: result.status };
    } catch (error: any) {
      await Execution.updateOne(
        { executionId },
        {
          status: 'failed',
          completedAt: new Date(),
          duration: Date.now() - startTime,
          error: error.message,
        }
      );

      await Workflow.updateOne(
        { _id: workflowId },
        { $inc: { 'stats.failed': 1 } }
      );

      return { executionId, status: 'failed' };
    }
  }

  /**
   * Run workflow nodes
   */
  private async runWorkflow(
    workflow: any,
    executionId: string,
    triggerData: any,
    context: any
  ): Promise<{ status: string; history: any[]; error?: string }> {
    const history: any[] = [];
    const variables: Record<string, any> = { ...triggerData };

    // Find trigger node
    const triggerNode = workflow.nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) {
      return { status: 'failed', history, error: 'No trigger node found' };
    }

    // Find start node (connected to trigger)
    const startEdges = workflow.edges.filter((e: any) => e.source === triggerNode.id);
    if (startEdges.length === 0) {
      return { status: 'failed', history, error: 'Trigger not connected' };
    }

    let currentNodeId = startEdges[0].target;
    const visited = new Set<string>();

    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);

      const node = workflow.nodes.find((n: any) => n.id === currentNodeId);
      if (!node) break;

      // Skip trigger node (already fired)
      if (node.type === 'trigger') {
        const edges = workflow.edges.filter((e: any) => e.source === node.id);
        if (edges.length > 0) {
          currentNodeId = edges[0].target;
        } else {
          break;
        }
        continue;
      }

      // Execute node
      const startTime = Date.now();
      let result: NodeResult;

      try {
        result = await this.executeNode(node, variables, context);
      } catch (error: any) {
        result = { nodeId: node.id, status: 'failed', output: null, error: error.message };
      }

      const nodeResult = {
        nodeId: node.id,
        nodeType: node.type,
        status: result.status,
        input: variables,
        output: result.output,
        error: result.error,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      };

      history.push(nodeResult);

      if (result.status === 'failed') {
        // Check if should retry
        if (workflow.settings.retryOnFailure && node.config?.retry !== false) {
          const maxRetries = workflow.settings.maxRetries || 3;
          // Retry logic would go here
        }
        return { status: 'failed', history, error: result.error };
      }

      // Find next node(s)
      if (node.type === 'end') {
        return { status: 'completed', history };
      }

      if (node.type === 'condition') {
        // Follow condition edge
        const conditionResult = result.output;
        const trueEdge = workflow.edges.find(
          (e: any) => e.source === node.id && e.label === 'true'
        );
        const falseEdge = workflow.edges.find(
          (e: any) => e.source === node.id && e.label === 'false'
        );

        if (conditionResult) {
          currentNodeId = trueEdge?.target || falseEdge?.target;
        } else {
          currentNodeId = falseEdge?.target;
        }
      } else {
        // Follow first outgoing edge
        const edges = workflow.edges.filter((e: any) => e.source === node.id);
        currentNodeId = edges[0]?.target;
      }
    }

    return { status: 'completed', history };
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: any, variables: any, context: any): Promise<NodeResult> {
    switch (node.type) {
      case 'action':
        return await this.executeAction(node, variables, context);
      case 'condition':
        return await this.executeCondition(node, variables, context);
      case 'delay':
        return await this.executeDelay(node, variables);
      case 'filter':
        return await this.executeFilter(node, variables);
      case 'webhook':
        return await this.executeWebhook(node, variables);
      case 'ai_agent':
        return await this.executeAIAgent(node, variables, context);
      case 'end':
        return { nodeId: node.id, status: 'success', output: variables };
      default:
        return { nodeId: node.id, status: 'success', output: variables };
    }
  }

  /**
   * Execute action node
   */
  private async executeAction(node: any, variables: any, context: any): Promise<NodeResult> {
    const { action } = node.data || {};

    switch (action) {
      case 'send_email':
        return this.sendEmail(node, variables);
      case 'send_sms':
        return this.sendSMS(node, variables);
      case 'send_whatsapp':
        return this.sendWhatsApp(node, variables);
      case 'send_push':
        return this.sendPush(node, variables);
      case 'update_user':
        return this.updateUser(node, variables);
      case 'create_order':
        return this.createOrder(node, variables);
      case 'add_tag':
        return this.addTag(node, variables);
      case 'http_request':
        return this.httpRequest(node, variables);
      case 'set_variable':
        return this.setVariable(node, variables);
      default:
        return { nodeId: node.id, status: 'success', output: variables };
    }
  }

  /**
   * Execute condition node
   */
  private async executeCondition(node: any, variables: any, context: any): Promise<NodeResult> {
    const { field, operator, value } = node.data || {};

    if (!field) {
      return { nodeId: node.id, status: 'success', output: true };
    }

    const fieldValue = this.getNestedValue(variables, field);
    let result = false;

    switch (operator) {
      case 'eq': result = fieldValue === value; break;
      case 'ne': result = fieldValue !== value; break;
      case 'gt': result = fieldValue > value; break;
      case 'gte': result = fieldValue >= value; break;
      case 'lt': result = fieldValue < value; break;
      case 'lte': result = fieldValue <= value; break;
      case 'contains': result = String(fieldValue).includes(value); break;
      case 'not_contains': result = !String(fieldValue).includes(value); break;
      case 'in': result = Array.isArray(value) && value.includes(fieldValue); break;
      case 'exists': result = fieldValue !== undefined && fieldValue !== null; break;
    }

    return { nodeId: node.id, status: 'success', output: result };
  }

  /**
   * Execute delay node
   */
  private async executeDelay(node: any, variables: any): Promise<NodeResult> {
    const { duration, unit } = node.data || {};

    if (!duration) {
      return { nodeId: node.id, status: 'success', output: variables };
    }

    // In production, this would schedule a delayed job
    // For now, just continue
    return { nodeId: node.id, status: 'success', output: variables };
  }

  /**
   * Execute filter node
   */
  private async executeFilter(node: any, variables: any): Promise<NodeResult> {
    const { criteria } = node.data || {};

    if (!criteria || !criteria.rules) {
      return { nodeId: node.id, status: 'success', output: variables };
    }

    let result = true;
    const logic = criteria.logic || 'and';

    for (const rule of criteria.rules) {
      const value = this.getNestedValue(variables, rule.field);
      let ruleResult = false;

      switch (rule.operator) {
        case 'eq': ruleResult = value === rule.value; break;
        case 'gt': ruleResult = value > rule.value; break;
        case 'lt': ruleResult = value < rule.value; break;
        case 'exists': ruleResult = value !== undefined; break;
      }

      if (logic === 'and') {
        result = result && ruleResult;
      } else {
        result = result || ruleResult;
      }
    }

    return { nodeId: node.id, status: 'success', output: result };
  }

  /**
   * Execute webhook node
   */
  private async executeWebhook(node: any, variables: any): Promise<NodeResult> {
    const { url, method, headers, body } = node.data || {};

    if (!url) {
      return { nodeId: node.id, status: 'success', output: variables };
    }

    try {
      // Render template variables in body
      const renderedBody = this.renderTemplate(body || '{}', variables);

      const response = await fetch(url, {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: renderedBody,
      });

      const output = await response.json();
      return { nodeId: node.id, status: 'success', output: { ...variables, webhookResponse: output } };
    } catch (error: any) {
      return { nodeId: node.id, status: 'failed', output: null, error: error.message };
    }
  }

  /**
   * Execute AI Agent node
   */
  private async executeAIAgent(node: any, variables: any, context: any): Promise<NodeResult> {
    const { prompt, model, action } = node.data || {};

    if (!prompt) {
      return { nodeId: node.id, status: 'success', output: variables };
    }

    try {
      // Render prompt with variables
      const renderedPrompt = this.renderTemplate(prompt, variables);

      // Call AI service (placeholder)
      const response = await this.callAI(renderedPrompt, model, action);

      return {
        nodeId: node.id,
        status: 'success',
        output: { ...variables, aiResponse: response }
      };
    } catch (error: any) {
      return { nodeId: node.id, status: 'failed', output: null, error: error.message };
    }
  }

  // ============================================
  // ACTION IMPLEMENTATIONS
  // ============================================

  private async sendEmail(node: any, variables: any): Promise<NodeResult> {
    // Integrate with notification service
    console.log('Sending email:', node.data);
    return { nodeId: node.id, status: 'success', output: variables };
  }

  private async sendSMS(node: any, variables: any): Promise<NodeResult> {
    console.log('Sending SMS:', node.data);
    return { nodeId: node.id, status: 'success', output: variables };
  }

  private async sendWhatsApp(node: any, variables: any): Promise<NodeResult> {
    console.log('Sending WhatsApp:', node.data);
    return { nodeId: node.id, status: 'success', output: variables };
  }

  private async sendPush(node: any, variables: any): Promise<NodeResult> {
    console.log('Sending push:', node.data);
    return { nodeId: node.id, status: 'success', output: variables };
  }

  private async updateUser(node: any, variables: any): Promise<NodeResult> {
    console.log('Updating user:', node.data);
    return { nodeId: node.id, status: 'success', output: variables };
  }

  private async createOrder(node: any, variables: any): Promise<NodeResult> {
    console.log('Creating order:', node.data);
    return { nodeId: node.id, status: 'success', output: variables };
  }

  private async addTag(node: any, variables: any): Promise<NodeResult> {
    const { tag } = node.data || {};
    variables.tags = variables.tags || [];
    variables.tags.push(tag);
    return { nodeId: node.id, status: 'success', output: variables };
  }

  private async httpRequest(node: any, variables: any): Promise<NodeResult> {
    return this.executeWebhook(node, variables);
  }

  private async setVariable(node: any, variables: any): Promise<NodeResult> {
    const { name, value } = node.data || {};
    if (name) {
      variables[name] = this.renderTemplate(value, variables);
    }
    return { nodeId: node.id, status: 'success', output: variables };
  }

  // ============================================
  // HELPERS
  // ============================================

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  private renderTemplate(template: string, variables: any): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
      const value = this.getNestedValue(variables, key);
      return value !== undefined ? String(value) : '';
    });
  }

  private async callAI(prompt: string, model: string, action: string): Promise<any> {
    // Placeholder - integrate with AI service
    return { success: true, action };
  }
}

export const workflowExecutor = new WorkflowExecutor();

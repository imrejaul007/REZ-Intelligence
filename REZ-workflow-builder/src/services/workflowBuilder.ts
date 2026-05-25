import crypto from 'crypto';
import { Workflow, WorkflowExecution, WorkflowExecutionResult, GeneratedWorkflow } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class WorkflowBuilder {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecutionResult> = new Map();

  async generateFromNaturalLanguage(description: string, context?: Record<string, any>): Promise<GeneratedWorkflow> {
    logger.info(`Generating workflow from: ${description}`);

    const workflowId = crypto.randomUUID();
    const nodes: Workflow['nodes'] = [];
    const edges: Workflow['edges'] = [];

    // Generate trigger
    const triggerId = 'trigger_1';
    nodes.push({
      id: triggerId,
      type: 'trigger',
      name: 'Event Trigger',
      config: { event: this.detectTriggerEvent(description) }
    });

    // Generate action nodes based on description
    const actions = this.extractActions(description);
    let prevNodeId = triggerId;

    actions.forEach((action, index) => {
      const nodeId = `action_${index + 1}`;
      nodes.push({
        id: nodeId,
        type: 'action',
        name: action.name,
        config: action.config
      });

      edges.push({
        id: `edge_${index}`,
        source: prevNodeId,
        target: nodeId
      });

      prevNodeId = nodeId;
    });

    // Add AI agent if needed
    if (description.toLowerCase().includes('analyze') || description.toLowerCase().includes('predict')) {
      const agentId = 'ai_agent_1';
      nodes.push({
        id: agentId,
        type: 'ai_agent',
        name: 'AI Analysis',
        config: { agent: 'analytics', task: description }
      });

      edges.push({
        id: 'edge_ai',
        source: prevNodeId,
        target: agentId
      });
    }

    const workflow: Workflow = {
      id: workflowId,
      name: this.generateWorkflowName(description),
      description,
      nodes,
      edges,
      isActive: true
    };

    this.workflows.set(workflowId, workflow);

    return {
      workflow,
      explanation: `Generated workflow with ${nodes.length} nodes: trigger → ${actions.map(a => a.name).join(' → ')}`,
      confidence: 0.85
    };
  }

  private detectTriggerEvent(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('order')) return 'order.created';
    if (desc.includes('payment')) return 'payment.completed';
    if (desc.includes('user') || desc.includes('signup')) return 'user.registered';
    if (desc.includes('schedule') || desc.includes('cron')) return 'schedule.cron';
    return 'event.manual';
  }

  private extractActions(description: string): Array<{ name: string; config: Record<string, any> }> {
    const desc = description.toLowerCase();
    const actions: Array<{ name: string; config: Record<string, any> }> = [];

    if (desc.includes('notify') || desc.includes('send')) {
      actions.push({ name: 'Send Notification', config: { channel: 'push', template: 'default' } });
    }
    if (desc.includes('save') || desc.includes('store')) {
      actions.push({ name: 'Store Data', config: { collection: 'workflow_data' } });
    }
    if (desc.includes('update') || desc.includes('modify')) {
      actions.push({ name: 'Update Record', config: { operation: 'upsert' } });
    }
    if (desc.includes('check') || desc.includes('verify')) {
      actions.push({ name: 'Validation Check', config: { strict: true } });
    }
    if (actions.length === 0) {
      actions.push({ name: 'Process Data', config: { operation: 'transform' } });
    }

    return actions;
  }

  private generateWorkflowName(description: string): string {
    const words = description.split(' ').slice(0, 5);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Workflow';
  }

  async execute(workflowId: string, execution: WorkflowExecution): Promise<WorkflowExecutionResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info(`Executing workflow ${workflowId} as ${executionId}`);

    const result: WorkflowExecutionResult = {
      executionId,
      workflowId,
      status: 'running',
      startedAt: new Date(),
      nodeResults: {},
      output: null,
      errors: []
    };

    // Execute nodes in order
    const sortedNodes = this.topologicalSort(workflow);
    for (const node of sortedNodes) {
      try {
        result.nodeResults[node.id] = await this.executeNode(node, execution.triggerData, result.nodeResults);
      } catch (error: any) {
        result.errors.push(`Node ${node.id}: ${error.message}`);
        result.status = 'failed';
        break;
      }
    }

    result.status = result.errors.length === 0 ? 'completed' : 'failed';
    result.completedAt = new Date();
    result.durationMs = Date.now() - startTime;
    result.output = result.nodeResults[sortedNodes[sortedNodes.length - 1]?.id];

    this.executions.set(executionId, result);
    return result;
  }

  private async executeNode(node: Workflow['nodes'][0], triggerData: any, previousResults: Record<string, any>): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 10));

    switch (node.type) {
      case 'trigger':
        return triggerData;
      case 'action':
        return { action: node.name, result: 'success', data: triggerData };
      case 'ai_agent':
        return { agent: node.config.agent, analysis: 'completed', insights: [] };
      case 'condition':
        return { condition: node.config.expression || 'true', evaluated: true };
      case 'delay':
        return { delayed: node.config.duration || 1000 };
      default:
        return { processed: true };
    }
  }

  private topologicalSort(workflow: Workflow): Workflow['nodes'] {
    const visited = new Set<string>();
    const sorted: Workflow['nodes'] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = workflow.nodes.find(n => n.id === nodeId);
      if (node) sorted.push(node);

      const outgoingEdges = workflow.edges.filter(e => e.source === nodeId);
      outgoingEdges.forEach(edge => visit(edge.target));
    };

    workflow.nodes.forEach(node => visit(node.id));
    return sorted;
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  getExecution(id: string): WorkflowExecutionResult | undefined {
    return this.executions.get(id);
  }
}

export const workflowBuilder = new WorkflowBuilder();

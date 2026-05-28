import { v4 as uuidv4 } from 'uuid';
import { Task, Plan, PlanRequest, PlanResponse, ExecutionContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface TaskTemplate {
  pattern: RegExp;
  createTask: (match: RegExpMatchArray, context: Record<string, unknown>) => Partial<Task>;
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    pattern: /order|buy|purchase/i,
    createTask: () => ({
      title: 'Process Order',
      description: 'Handle order processing workflow',
      priority: 'high',
      tags: ['commerce'],
    }),
  },
  {
    pattern: /payment|transaction|invoice/i,
    createTask: () => ({
      title: 'Process Payment',
      description: 'Handle payment transaction',
      priority: 'critical',
      tags: ['finance'],
    }),
  },
  {
    pattern: /ship|delivery|logistics/i,
    createTask: () => ({
      title: 'Handle Delivery',
      description: 'Coordinate shipment and delivery',
      priority: 'high',
      tags: ['logistics'],
    }),
  },
  {
    pattern: /notify|message|alert/i,
    createTask: () => ({
      title: 'Send Notification',
      description: 'Send user notification',
      priority: 'medium',
      tags: ['communication'],
    }),
  },
  {
    pattern: /report|analytics|insight/i,
    createTask: () => ({
      title: 'Generate Report',
      description: 'Create analytics report',
      priority: 'low',
      tags: ['analytics'],
    }),
  },
  {
    pattern: /verify|check|validate/i,
    createTask: () => ({
      title: 'Validation Check',
      description: 'Verify and validate data',
      priority: 'high',
      tags: ['validation'],
    }),
  },
];

export class PlanningEngine {
  private plans: Map<string, Plan> = new Map();
  private executions: Map<string, ExecutionContext> = new Map();

  async createPlan(request: PlanRequest): Promise<PlanResponse> {
    logger.info('Creating plan for goal', { goal: request.goal });

    const planId = uuidv4();
    const tasks = this.decomposeGoal(request.goal, request.context);
    const strategy = this.selectStrategy(tasks, request.constraints);

    const plan: Plan = {
      id: planId,
      goal: request.goal,
      tasks,
      strategy,
      createdAt: new Date(),
      updatedAt: new Date(),
      milestones: this.createMilestones(tasks),
      estimatedTotalDuration: this.estimateDuration(tasks, strategy),
    };

    this.plans.set(planId, plan);

    const reasoning = this.generateReasoning(plan, strategy);
    const confidence = this.calculateConfidence(plan);
    const alternatives = this.generateAlternatives(plan, request.constraints);

    return {
      plan,
      reasoning,
      confidence,
      alternativeStrategies: alternatives,
    };
  }

  private decomposeGoal(goal: string, context: Record<string, unknown>): Task[] {
    const tasks: Task[] = [];
    const goalLower = goal.toLowerCase();

    // Check against templates
    for (const template of TASK_TEMPLATES) {
      if (template.pattern.test(goalLower)) {
        const match = goalLower.match(template.pattern);
        if (match) {
          const partialTask = template.createTask(match, context);
          tasks.push(this.createTask(partialTask));
        }
      }
    }

    // Add common tasks based on goal keywords
    if (goalLower.includes('auto') || goalLower.includes('automate')) {
      tasks.push(this.createTask({
        title: 'Setup Automation',
        description: 'Configure automated workflow',
        priority: 'medium',
        tags: ['automation'],
      }));
    }

    if (goalLower.includes('track') || goalLower.includes('monitor')) {
      tasks.push(this.createTask({
        title: 'Setup Tracking',
        description: 'Configure monitoring and tracking',
        priority: 'medium',
        tags: ['monitoring'],
      }));
    }

    if (goalLower.includes('optimize') || goalLower.includes('improve')) {
      tasks.push(this.createTask({
        title: 'Analyze Performance',
        description: 'Analyze current performance metrics',
        priority: 'high',
        tags: ['optimization'],
      }));
    }

    // Add default validation task
    if (tasks.length > 0) {
      tasks.push(this.createTask({
        title: 'Final Validation',
        description: 'Validate overall completion',
        priority: 'high',
        tags: ['validation'],
        dependencies: tasks.map(t => t.id),
      }));
    }

    // Ensure we have at least one task
    if (tasks.length === 0) {
      tasks.push(this.createTask({
        title: 'Execute Goal',
        description: goal,
        priority: 'medium',
        tags: ['general'],
      }));
    }

    return tasks;
  }

  private createTask(partial: Partial<Task>): Task {
    return {
      id: uuidv4(),
      title: partial.title || 'Untitled Task',
      description: partial.description || '',
      status: 'pending',
      priority: partial.priority || 'medium',
      dependencies: partial.dependencies || [],
      estimatedDuration: partial.estimatedDuration,
      assignedTo: partial.assignedTo,
      tags: partial.tags || [],
      metadata: partial.metadata || {},
    };
  }

  private selectStrategy(tasks: Task[], constraints?: PlanRequest['constraints']): Plan['strategy'] {
    const taskCount = tasks.length;
    const hasDependencies = tasks.some(t => t.dependencies.length > 0);
    const maxParallel = constraints?.parallelTasks || 3;

    if (!hasDependencies && taskCount > 2) {
      return maxParallel > 1 ? 'parallel' : 'sequential';
    }

    if (hasDependencies && maxParallel > 1) {
      return 'hybrid';
    }

    if (taskCount <= 2) {
      return 'sequential';
    }

    return 'adaptive';
  }

  private createMilestones(tasks: Task[]): Plan['milestones'] {
    const phases = [
      { name: 'Initialization', keywords: ['setup', 'init', 'prepare', 'config'] },
      { name: 'Core Execution', keywords: ['process', 'handle', 'execute', 'create'] },
      { name: 'Validation', keywords: ['validate', 'verify', 'check'] },
    ];

    const milestones: Plan['milestones'] = [];

    for (const phase of phases) {
      const phaseTasks = tasks.filter(t =>
        phase.keywords.some(k => t.title.toLowerCase().includes(k))
      );
      if (phaseTasks.length > 0) {
        milestones.push({
          id: uuidv4(),
          name: phase.name,
          taskIds: phaseTasks.map(t => t.id),
        });
      }
    }

    return milestones;
  }

  private estimateDuration(tasks: Task[], strategy: Plan['strategy']): number {
    const avgTaskDuration = 15; // minutes
    const totalSequential = tasks.length * avgTaskDuration;

    switch (strategy) {
      case 'parallel':
        return Math.ceil(totalSequential / 3);
      case 'hybrid':
        return Math.ceil(totalSequential / 2);
      default:
        return totalSequential;
    }
  }

  private generateReasoning(plan: Plan, strategy: Plan['strategy']): string {
    const taskCount = plan.tasks.length;
    const hasBlocked = plan.tasks.some(t => t.dependencies.length > 0);

    let reasoning = `Decomposed "${plan.goal}" into ${taskCount} tasks. `;

    switch (strategy) {
      case 'parallel':
        reasoning += 'Selected parallel execution strategy for independent tasks. ';
        break;
      case 'sequential':
        reasoning += 'Selected sequential strategy due to dependencies. ';
        break;
      case 'hybrid':
        reasoning += 'Selected hybrid strategy combining parallel and sequential. ';
        break;
      default:
        reasoning += 'Selected adaptive strategy for flexible execution. ';
    }

    if (plan.estimatedTotalDuration) {
      reasoning += `Estimated completion time: ~${plan.estimatedTotalDuration} minutes.`;
    }

    return reasoning;
  }

  private calculateConfidence(plan: Plan): number {
    let confidence = 0.8;

    // Decrease confidence for more tasks
    if (plan.tasks.length > 10) confidence -= 0.1;

    // Increase for well-defined milestones
    if (plan.milestones.length >= 3) confidence += 0.1;

    // Decrease for complex dependencies
    const maxDeps = Math.max(...plan.tasks.map(t => t.dependencies.length));
    if (maxDeps > 2) confidence -= 0.1;

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  private generateAlternatives(plan: Plan, _constraints?: PlanRequest['constraints']): Array<{
    strategy: string;
    estimatedDuration: number;
    pros: string[];
    cons: string[];
  }> {
    const alternatives: Array<{
    strategy: string;
    estimatedDuration: number;
    pros: string[];
    cons: string[];
  }> = [];

    if (plan.strategy !== 'parallel') {
      alternatives.push({
        strategy: 'parallel',
        estimatedDuration: Math.ceil((plan.estimatedTotalDuration || 30) / 3),
        pros: ['Faster execution', 'Better resource utilization'],
        cons: ['Higher complexity', 'More coordination overhead'],
      });
    }

    if (plan.strategy !== 'sequential') {
      alternatives.push({
        strategy: 'sequential',
        estimatedDuration: (plan.estimatedTotalDuration || 30) * 2,
        pros: ['Simpler execution', 'Easier debugging'],
        cons: ['Slower completion', 'Lower efficiency'],
      });
    }

    return alternatives;
  }

  getPlan(planId: string): Plan | null {
    return this.plans.get(planId) || null;
  }

  getExecutionContext(planId: string): ExecutionContext | null {
    return this.executions.get(planId) || null;
  }

  startExecution(planId: string): ExecutionContext | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    const context: ExecutionContext = {
      planId,
      currentTaskId: plan.tasks.find(t => t.status === 'pending' && t.dependencies.every(d =>
        plan.tasks.find(pt => pt.id === d)?.status === 'completed'
      ))?.id || null,
      completedTasks: [],
      blockedTasks: [],
      metrics: {
        startTime: new Date(),
        tasksCompleted: 0,
        tasksBlocked: 0,
        estimatedRemaining: plan.estimatedTotalDuration || 30,
      },
    };

    this.executions.set(planId, context);
    return context;
  }

  updateTaskStatus(planId: string, taskId: string, status: Task['status']): boolean {
    const plan = this.plans.get(planId);
    const context = this.executions.get(planId);
    if (!plan || !context) return false;

    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.status = status;
    plan.updatedAt = new Date();

    if (status === 'completed') {
      context.completedTasks.push(taskId);
      context.metrics.tasksCompleted++;
    } else if (status === 'blocked') {
      context.blockedTasks.push(taskId);
      context.metrics.tasksBlocked++;
    }

    return true;
  }

  getNextTask(planId: string): Task | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    return plan.tasks.find(t =>
      t.status === 'pending' &&
      t.dependencies.every(depId => {
        const dep = plan.tasks.find(pt => pt.id === depId);
        return dep?.status === 'completed';
      })
    ) || null;
  }

  getExecutionProgress(planId: string): { completed: number; total: number; percentage: number } {
    const plan = this.plans.get(planId);
    if (!plan) return { completed: 0, total: 0, percentage: 0 };

    const completed = plan.tasks.filter(t => t.status === 'completed').length;
    const total = plan.tasks.length;

    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}

export const planningEngine = new PlanningEngine();

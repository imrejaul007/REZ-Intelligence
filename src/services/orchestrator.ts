/**
 * REZ Agent Orchestrator - Core Engine
 *
 * Central intelligence layer that coordinates all agents
 */

import {
  Agent,
  Task,
  TaskContext,
  TaskResult,
  AgentMessage,
  OrchestrationGoal,
  RecommendedAction,
  ConflictResolution,
  AgentHealth,
  AgentCapability,
} from '../types';

// Agent Registry
interface AgentRegistry {
  [agentId: string]: {
    agent: Agent;
    health: AgentHealth;
    queue: Task[];
  };
}

export class AgentOrchestrator {
  private agents: AgentRegistry = {};
  private taskQueue: Task[] = [];
  private goals: Map<string, OrchestrationGoal> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeDefaultAgents();
  }

  /**
   * Initialize default agent registry
   */
  private initializeDefaultAgents() {
    // Commerce Agents
    this.registerAgent({
      id: 'demand-signal-agent',
      name: 'Demand Signal Agent',
      type: 'commerce',
      capabilities: ['demand_signal', 'trend_detector'],
      status: 'active',
      priority: 10,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'churn-risk-agent',
      name: 'Churn Risk Agent',
      type: 'user',
      capabilities: ['churn_risk', 'ltv_predictor'],
      status: 'active',
      priority: 9,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'price-optimizer-agent',
      name: 'Price Optimizer Agent',
      type: 'commerce',
      capabilities: ['price_optimizer'],
      status: 'active',
      priority: 8,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'inventory-agent',
      name: 'Inventory Agent',
      type: 'commerce',
      capabilities: ['inventory_alert'],
      status: 'active',
      priority: 9,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'personalization-agent',
      name: 'Personalization Agent',
      type: 'user',
      capabilities: ['personalization', 'recommendation'],
      status: 'active',
      priority: 8,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'retention-agent',
      name: 'Retention Agent',
      type: 'marketing',
      capabilities: ['retention', 'winback'],
      status: 'active',
      priority: 9,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'competitor-agent',
      name: 'Competitor Monitor Agent',
      type: 'commerce',
      capabilities: ['competitor_monitor', 'trend_detector'],
      status: 'active',
      priority: 7,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'campaign-agent',
      name: 'Campaign Optimizer Agent',
      type: 'marketing',
      capabilities: ['campaign_optimize'],
      status: 'active',
      priority: 8,
      lastActive: new Date(),
      config: {},
    });

    this.registerAgent({
      id: 'attribution-agent',
      name: 'Attribution Agent',
      type: 'attribution',
      capabilities: ['attribution'],
      status: 'active',
      priority: 7,
      lastActive: new Date(),
      config: {},
    });
  }

  /**
   * Register a new agent
   */
  registerAgent(agent: Agent): void {
    this.agents[agent.id] = {
      agent,
      health: {
        agentId: agent.id,
        status: 'healthy',
        lastHeartbeat: new Date(),
        tasksProcessed: 0,
        successRate: 1.0,
        avgResponseTime: 0,
        errors: [],
      },
      queue: [],
    };
  }

  /**
   * Create and queue a task
   */
  createTask(
    description: string,
    context: TaskContext,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'medium',
    dependencies?: string[]
  ): Task {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.classifyTask(description),
      priority,
      status: 'pending',
      description,
      context,
      dependencies,
      createdAt: new Date(),
    };

    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => this.comparePriority(a, b));

    this.emitEvent('task_created', { task });

    return task;
  }

  /**
   * Classify task type based on description
   */
  private classifyTask(description: string): 'analysis' | 'action' | 'prediction' | 'optimization' {
    const lower = description.toLowerCase();
    if (lower.includes('predict') || lower.includes('forecast')) return 'prediction';
    if (lower.includes('optimize') || lower.includes('improve')) return 'optimization';
    if (lower.includes('execute') || lower.includes('send') || lower.includes('create')) return 'action';
    return 'analysis';
  }

  /**
   * Assign task to best available agent
   */
  assignTask(taskId: string): Task | null {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (!task) return null;

    // Check dependencies
    if (task.dependencies) {
      const incompleteDeps = task.dependencies.filter((depId) => {
        const dep = this.taskQueue.find((t) => t.id === depId);
        return dep && dep.status !== 'completed';
      });
      if (incompleteDeps.length > 0) return null;
    }

    // Find best available agent
    const bestAgent = this.findBestAgent(task);
    if (!bestAgent) return null;

    task.status = 'assigned';
    task.assignedAgent = bestAgent.id;

    this.agents[bestAgent.id].queue.push(task);
    this.emitEvent('task_assigned', { task, agent: bestAgent });

    return task;
  }

  /**
   * Find best agent for task based on capabilities and availability
   */
  private findBestAgent(task: Task): Agent | null {
    const requiredCapabilities = this.inferCapabilities(task.description);

    let bestAgent: Agent | null = null;
    let bestScore = -1;

    for (const [agentId, { agent, health, queue }] of Object.entries(this.agents)) {
      // Skip unhealthy agents
      if (health.status === 'unhealthy') continue;

      // Skip busy agents
      if (health.status === 'busy') continue;

      // Check capabilities
      const hasCapability = requiredCapabilities.every((cap) =>
        agent.capabilities.includes(cap)
      );
      if (!hasCapability && requiredCapabilities.length > 0) continue;

      // Calculate score
      const queuePenalty = queue.length * 0.1;
      const score = agent.priority / (1 + queuePenalty);

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * Infer required capabilities from task description
   */
  private inferCapabilities(description: string): AgentCapability[] {
    const lower = description.toLowerCase();
    const capabilities: AgentCapability[] = [];

    if (lower.includes('demand') || lower.includes('trend')) {
      capabilities.push('demand_signal', 'trend_detector');
    }
    if (lower.includes('churn') || lower.includes('retain')) {
      capabilities.push('churn_risk', 'retention', 'winback');
    }
    if (lower.includes('price') || lower.includes('pricing')) {
      capabilities.push('price_optimizer');
    }
    if (lower.includes('inventory') || lower.includes('stock')) {
      capabilities.push('inventory_alert');
    }
    if (lower.includes('personalize') || lower.includes('recommend')) {
      capabilities.push('personalization', 'recommendation');
    }
    if (lower.includes('competitor') || lower.includes('market')) {
      capabilities.push('competitor_monitor');
    }
    if (lower.includes('campaign') || lower.includes('marketing')) {
      capabilities.push('campaign_optimize');
    }
    if (lower.includes('attribution') || lower.includes('attribution')) {
      capabilities.push('attribution');
    }
    if (lower.includes('ltv') || lower.includes('value')) {
      capabilities.push('ltv_predictor');
    }

    return capabilities;
  }

  /**
   * Execute assigned task
   */
  async executeTask(taskId: string, executor: (task: Task) => Promise<TaskResult>): Promise<TaskResult | null> {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (!task || !task.assignedAgent) return null;

    const agentEntry = this.agents[task.assignedAgent];
    if (!agentEntry) return null;

    // Mark agent as busy
    agentEntry.health.status = 'busy';
    task.status = 'in_progress';

    try {
      const result = await executor(task);
      task.result = result;
      task.status = 'completed';
      task.completedAt = new Date();

      // Update agent health
      agentEntry.health.tasksProcessed++;
      agentEntry.health.lastActive = new Date();
      agentEntry.health.status = 'active';

      // Remove from queue
      agentEntry.queue = agentEntry.queue.filter((t) => t.id !== taskId);

      this.emitEvent('task_completed', { task, result });

      return result;
    } catch (error) {
      task.status = 'failed';
      agentEntry.health.errors.push((error as Error).message);
      agentEntry.health.status = 'active';

      this.emitEvent('task_completed', { task, error });

      return null;
    }
  }

  /**
   * Process task queue automatically
   */
  async processQueue(): Promise<void> {
    for (const task of this.taskQueue) {
      if (task.status === 'pending') {
        this.assignTask(task.id);
      }
    }
  }

  /**
   * Handle conflicts between tasks
   */
  detectAndResolveConflicts(): ConflictResolution[] {
    const conflicts: ConflictResolution[] = [];

    // Find tasks that might conflict
    for (let i = 0; i < this.taskQueue.length; i++) {
      for (let j = i + 1; j < this.taskQueue.length; j++) {
        const task1 = this.taskQueue[i];
        const task2 = this.taskQueue[j];

        // Check for same merchant/context conflicts
        if (
          task1.context.merchantId === task2.context.merchantId &&
          task1.context.merchantId
        ) {
          const conflict = this.checkConflict(task1, task2);
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two tasks conflict
   */
  private checkConflict(task1: Task, task2: Task): ConflictResolution | null {
    // Budget conflicts
    const budget1 = task1.context.metadata?.budget;
    const budget2 = task2.context.metadata?.budget;
    if (budget1 && budget2) {
      return {
        taskId1: task1.id,
        taskId2: task2.id,
        type: 'budget',
        resolution: this.resolveBudgetConflict(task1, task2),
        reasoning: 'Budget allocation conflict detected',
      };
    }

    // Priority conflicts
    if (
      this.comparePriority(task1, task2) !== 0 &&
      task1.assignedAgent === task2.assignedAgent
    ) {
      return {
        taskId1: task1.id,
        taskId2: task2.id,
        type: 'priority',
        resolution: 'priority_based',
        reasoning: 'Same agent assigned to conflicting priorities',
      };
    }

    return null;
  }

  /**
   * Resolve budget conflicts
   */
  private resolveBudgetConflict(task1: Task, task2: Task): 'priority_based' | 'cost_based' | 'manual' | 'defer' {
    const budget1 = (task1.context.metadata?.budget as number) || 0;
    const budget2 = (task2.context.metadata?.budget as number) || 0;
    const total = budget1 + budget2;

    // Check if within constraints
    const goal = this.getActiveGoal('revenue');
    if (goal) {
      const maxSpend = goal.constraints.find((c) => c.type === 'max_spend');
      if (maxSpend && total > maxSpend.value) {
        return 'cost_based';
      }
    }

    return 'defer';
  }

  /**
   * Get active goal by type
   */
  getActiveGoal(type: string): OrchestrationGoal | undefined {
    for (const goal of this.goals.values()) {
      if (goal.type === type) return goal;
    }
    return undefined;
  }

  /**
   * Set orchestration goal
   */
  setGoal(goal: OrchestrationGoal): void {
    this.goals.set(goal.id, goal);
  }

  /**
   * Update goal progress
   */
  updateGoalProgress(goalId: string, current: number): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.current = current;
      if (current >= goal.target) {
        this.emitEvent('goal_achieved', { goal });
      }
    }
  }

  /**
   * Get agent health status
   */
  getAgentHealth(agentId?: string): AgentHealth | AgentHealth[] {
    if (agentId) {
      return this.agents[agentId]?.health;
    }
    return Object.values(this.agents).map((e) => e.health);
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit event
   */
  private emitEvent(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  /**
   * Get task queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    failed: number;
  } {
    const status = {
      total: this.taskQueue.length,
      pending: 0,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.taskQueue) {
      switch (task.status) {
        case 'pending':
          status.pending++;
          break;
        case 'assigned':
          status.assigned++;
          break;
        case 'in_progress':
          status.inProgress++;
          break;
        case 'completed':
          status.completed++;
          break;
        case 'failed':
          status.failed++;
          break;
      }
    }

    return status;
  }

  /**
   * Compare task priority
   */
  private comparePriority(a: Task, b: Task): number {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Same priority - compare creation time
    return b.createdAt.getTime() - a.createdAt.getTime();
  }

  /**
   * Combine results from multiple agents
   */
  combineResults(results: TaskResult[]): {
    output: unknown;
    confidence: number;
    recommendations: RecommendedAction[];
  } {
    // Weight by confidence
    const totalWeight = results.reduce((sum, r) => sum + r.confidence, 0);

    const combinedOutput = results.map((r) => r.output);
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    const allRecommendations = results.flatMap((r) => r.recommendations || []);
    const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);

    return {
      output: combinedOutput,
      confidence: avgConfidence,
      recommendations: uniqueRecommendations.slice(0, 10), // Top 10
    };
  }

  /**
   * Deduplicate recommendations
   */
  private deduplicateRecommendations(recs: RecommendedAction[]): RecommendedAction[] {
    const seen = new Set<string>();
    return recs.filter((rec) => {
      const key = `${rec.type}-${JSON.stringify(rec.params)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const orchestrator = new AgentOrchestrator();

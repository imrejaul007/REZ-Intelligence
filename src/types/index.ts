/**
 * REZ Agent Orchestrator - Types
 *
 * Central intelligence layer for coordinating all agents
 */

export type AgentType =
  | 'commerce'
  | 'user'
  | 'autonomous'
  | 'merchant'
  | 'consumer'
  | 'marketing'
  | 'attribution';

export type AgentCapability =
  | 'demand_signal'
  | 'churn_risk'
  | 'ltv_predictor'
  | 'price_optimizer'
  | 'inventory_alert'
  | 'personalization'
  | 'recommendation'
  | 'engagement'
  | 'retention'
  | 'winback'
  | 'attribution'
  | 'campaign_optimize'
  | 'competitor_monitor'
  | 'trend_detector';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  capabilities: AgentCapability[];
  status: 'active' | 'inactive' | 'busy' | 'error';
  priority: number;
  lastActive: Date;
  config: Record<string, unknown>;
}

export interface Task {
  id: string;
  type: 'analysis' | 'action' | 'prediction' | 'optimization';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  description: string;
  context: TaskContext;
  assignedAgent?: string;
  result?: TaskResult;
  dependencies?: string[];
  createdAt: Date;
  completedAt?: Date;
}

export interface TaskContext {
  merchantId?: string;
  userId?: string;
  businessType?: string;
  location?: { lat: number; lng: number };
  industry?: string;
  metadata: Record<string, unknown>;
}

export interface TaskResult {
  agentId: string;
  output: unknown;
  confidence: number;
  recommendations?: RecommendedAction[];
  actions?: RecommendedAction[];
  metadata: Record<string, unknown>;
}

export interface RecommendedAction {
  type: string;
  params: Record<string, unknown>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: { revenue?: number; customers?: number; conversionRate?: number };
  requiresApproval: boolean;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'result' | 'query' | 'response' | 'event';
  payload: unknown;
  timestamp: Date;
}

export interface OrchestrationGoal {
  id: string;
  type: 'revenue' | 'customers' | 'retention' | 'engagement' | 'efficiency';
  target: number;
  current: number;
  timeline: 'daily' | 'weekly' | 'monthly';
  priority: number;
  agents: string[];
  constraints: GoalConstraint[];
}

export interface GoalConstraint {
  type: 'max_spend' | 'min_margin' | 'max_discount' | 'approval_required';
  value: number;
  reason: string;
}

export interface ConflictResolution {
  taskId1: string;
  taskId2: string;
  type: 'resource' | 'strategy' | 'priority' | 'budget';
  resolution: 'priority_based' | 'cost_based' | 'manual' | 'defer';
  reasoning: string;
}

export interface AgentHealth {
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'active' | 'busy';
  lastHeartbeat: Date;
  lastActive?: Date;
  tasksProcessed: number;
  successRate: number;
  avgResponseTime: number;
  errors: string[];
}

export interface OrchestrationEvent {
  type: 'task_created' | 'task_assigned' | 'task_completed' | 'agent_busy' | 'conflict_detected' | 'goal_achieved' | 'anomaly_detected';
  data: unknown;
  timestamp: Date;
}

/**
 * AI Agent Orchestrator - MULTI-AGENT COORDINATION
 * Coordinates AI agents across the entire ecosystem
 */

export interface AgentTask {
  task_id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';

  // Decomposition
  subtasks: SubTask[];

  // Agent assignment
  assigned_agents: string[];

  // Tools required
  required_tools: string[];

  // Approval workflow
  requires_approval: boolean;
  approval_threshold?: number; // monetary threshold
  approver_role?: string;

  // Execution
  status: 'pending' | 'decomposing' | 'running' | 'waiting_approval' | 'completed' | 'failed';

  // Memory coordination
  shared_memory_keys: string[];

  // Results
  results: AgentResult[];
  consensus_reached: boolean;

  // Context
  context: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

export interface SubTask {
  subtask_id: string;
  description: string;
  agent_type: AgentType;
  depends_on: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export interface AgentResult {
  agent_id: string;
  agent_type: AgentType;
  output: any;
  confidence: number;
  reasoning: string;
  tools_used: string[];
  execution_time_ms: number;
}

export type AgentType =
  | 'merchant_agent'
  | 'consumer_agent'
  | 'payment_agent'
  | 'marketing_agent'
  | 'support_agent'
  | 'inventory_agent'
  | 'fraud_agent'
  | 'analytics_agent';

// Tool definitions
export interface Tool {
  tool_id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns: string;
  requires_approval: boolean;
}

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
}

// Human approval workflow
export interface ApprovalRequest {
  request_id: string;
  task_id: string;
  description: string;
  requested_by: string;
  amount?: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  responded_by?: string;
  responded_at?: string;
  comments?: string;
}

// Agent types
export const AGENT_TYPES = {
  MERCHANT: 'merchant_agent',
  CONSUMER: 'consumer_agent',
  PAYMENT: 'payment_agent',
  MARKETING: 'marketing_agent',
  SUPPORT: 'support_agent',
  INVENTORY: 'inventory_agent',
  FRAUD: 'fraud_agent',
  ANALYTICS: 'analytics_agent',
} as const;

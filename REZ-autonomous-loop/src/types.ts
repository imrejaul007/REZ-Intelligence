/**
 * REZ Autonomous Loop Service - Type Definitions
 * Implements: Observe → Think → Decide → Act → Learn → Repeat
 */
import { z } from 'zod';

// ============================================================================
// Loop Types
// ============================================================================

export type LoopStatus = 'active' | 'paused' | 'stopped' | 'error';
export type LoopPhase = 'observe' | 'think' | 'decide' | 'act' | 'learn';
export type ActionStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

// ============================================================================
// Autonomous Loop
// ============================================================================

export interface AutonomousLoop {
  id: string;
  name: string;
  description: string;
  entity_type: 'company' | 'merchant' | 'restaurant' | 'hotel' | 'healthcare' | 'realestate' | 'user';
  entity_id: string;
  status: LoopStatus;
  phase: LoopPhase;
  interval_seconds: number;
  config: LoopConfig;
  last_run?: Date;
  next_run?: Date;
  run_count: number;
  success_count: number;
  failure_count: number;
  created_at: Date;
  updated_at?: Date;
}

export interface LoopConfig {
  observe_enabled: boolean;
  think_enabled: boolean;
  decide_enabled: boolean;
  act_enabled: boolean;
  learn_enabled: boolean;
  auto_execute: boolean;
  require_approval: boolean;
  max_actions_per_run: number;
  confidence_threshold: number; // 0-1
  alert_on_failure: boolean;
}

// ============================================================================
// Observation
// ============================================================================

export interface Observation {
  id: string;
  loop_id: string;
  timestamp: Date;
  source: string; // service/event source
  type: string; // 'metric' | 'event' | 'anomaly' | 'trend'
  data: Record<string, unknown>;
  summary: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  processed: boolean;
  created_at: Date;
}

// ============================================================================
// Thought (Analysis)
// ============================================================================

export interface Thought {
  id: string;
  loop_id: string;
  observation_ids: string[];
  timestamp: Date;
  reasoning: string;
  context_used: string[]; // services/models used
  confidence: number; // 0-1
  alternative_thoughts?: string[];
  conclusion: string;
  created_at: Date;
}

// ============================================================================
// Decision
// ============================================================================

export interface Decision {
  id: string;
  loop_id: string;
  thought_id: string;
  timestamp: Date;
  decision_type: 'optimization' | 'intervention' | 'alert' | 'automation' | 'rollback';
  action_type?: string; // 'send_notification' | 'adjust_pricing' | 'create_campaign' | etc.
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  risk_level: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  created_at: Date;
}

// ============================================================================
// Action
// ============================================================================

export interface AutonomousAction {
  id: string;
  loop_id: string;
  decision_id: string;
  action_type: string;
  parameters: Record<string, unknown>;
  target_service?: string;
  target_endpoint?: string;
  status: ActionStatus;
  execution_start?: Date;
  execution_end?: Date;
  result?: Record<string, unknown>;
  error?: string;
  rollback_action_id?: string;
  tenant_id: string;
  created_at: Date;
  updated_at?: Date;
}

// ============================================================================
// Learning
// ============================================================================

export interface Learning {
  id: string;
  loop_id: string;
  action_id: string;
  timestamp: Date;
  outcome: 'success' | 'partial' | 'failure';
  metrics: {
    improvement?: number;
    accuracy?: number;
    cost_saved?: number;
    revenue_impact?: number;
    time_saved_minutes?: number;
  };
  feedback: string;
  pattern_identified?: string;
  confidence_adjustment?: number;
  created_at: Date;
}

// ============================================================================
// Company State (for memory)
// ============================================================================

export interface CompanyState {
  id: string;
  entity_type: string;
  entity_id: string;
  current_health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  active_goals: Array<{ id: string; description: string; progress: number; deadline?: Date }>;
  recent_decisions: Array<{ id: string; type: string; outcome: string; date: Date }>;
  pending_actions: number;
  completed_actions_24h: number;
  failed_actions_24h: number;
  last_updated: Date;
  tenant_id: string;
}

// ============================================================================
// Activity Feed Item
// ============================================================================

export interface ActivityFeedItem {
  id: string;
  loop_id: string;
  entity_type: string;
  entity_id: string;
  phase: LoopPhase;
  action: string;
  description: string;
  status: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
  timestamp: Date;
  tenant_id: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const LoopConfigSchema = z.object({
  observe_enabled: z.boolean().default(true),
  think_enabled: z.boolean().default(true),
  decide_enabled: z.boolean().default(true),
  act_enabled: z.boolean().default(true),
  learn_enabled: z.boolean().default(true),
  auto_execute: z.boolean().default(true),
  require_approval: z.boolean().default(false),
  max_actions_per_run: z.number().min(1).max(100).default(10),
  confidence_threshold: z.number().min(0).max(1).default(0.7),
  alert_on_failure: z.boolean().default(true),
});

export const CreateLoopSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  entity_type: z.enum(['company', 'merchant', 'restaurant', 'hotel', 'healthcare', 'realestate', 'user']),
  entity_id: z.string().min(1),
  interval_seconds: z.number().min(60).max(86400).default(300),
  config: LoopConfigSchema.optional(),
});

export const CreateDecisionSchema = z.object({
  loop_id: z.string().min(1),
  action_type: z.string().min(1),
  parameters: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  risk_level: z.enum(['low', 'medium', 'high']).default('low'),
  require_approval: z.boolean().default(false),
});

// ============================================================================
// API Response
// ============================================================================

export interface APIResponse<T> { success: boolean; data?: T; error?: { code: string; message: string }; meta: { timestamp: string } }
export interface TenantContext { tenant_id: string; user_id?: string }
declare global { namespace Express { interface Request { tenantContext?: TenantContext; userId?: string } } }

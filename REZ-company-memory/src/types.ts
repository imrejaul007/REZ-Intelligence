/**
 * REZ Company Memory Service - Type Definitions
 * Stores business entity state for autonomous operations
 */
import { z } from 'zod';

// ============================================================================
// Company State
// ============================================================================

export interface CompanyMemory {
  id: string;
  entity_type: 'company' | 'merchant' | 'restaurant' | 'hotel' | 'healthcare' | 'realestate' | 'retail';
  entity_id: string;
  name: string;
  health_score: number; // 0-100
  health_trend: 'improving' | 'stable' | 'declining';
  active_goals: Goal[];
  recent_decisions: Decision[];
  metrics: BusinessMetrics;
  preferences: BusinessPreferences;
  last_updated: Date;
  tenant_id: string;
  created_at: Date;
}

export interface Goal {
  id: string;
  description: string;
  target_metric?: string;
  target_value?: number;
  current_value?: number;
  progress: number; // 0-100
  deadline?: Date;
  status: 'active' | 'completed' | 'paused' | 'failed';
  created_at: Date;
  updated_at?: Date;
}

export interface Decision {
  id: string;
  type: string;
  description: string;
  outcome: 'success' | 'partial' | 'failure';
  impact_score: number;
  date: Date;
}

export interface BusinessMetrics {
  revenue?: MetricSnapshot;
  customers?: MetricSnapshot;
  orders?: MetricSnapshot;
  conversion_rate?: MetricSnapshot;
  avg_order_value?: MetricSnapshot;
  retention_rate?: MetricSnapshot;
  custom_metrics: Record<string, MetricSnapshot>;
}

export interface MetricSnapshot {
  value: number;
  previous_value?: number;
  change_percent?: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

export interface BusinessPreferences {
  operating_hours?: { start: string; end: string; timezone: string };
  notification_channels: ('whatsapp' | 'email' | 'sms' | 'push')[];
  autonomy_level: 'full' | 'high' | 'medium' | 'low';
  risk_tolerance: 'aggressive' | 'moderate' | 'conservative';
  decision_approval_required: boolean;
  auto_actions_enabled: string[];
}

// ============================================================================
// Memory Events
// ============================================================================

export interface MemoryEvent {
  id: string;
  entity_id: string;
  event_type: 'metric_change' | 'decision_made' | 'goal_updated' | 'action_taken' | 'anomaly_detected' | 'opportunity_identified';
  description: string;
  data: Record<string, unknown>;
  source: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  tenant_id: string;
}

// ============================================================================
// Knowledge
// ============================================================================

export interface BusinessKnowledge {
  id: string;
  entity_id: string;
  category: 'strategy' | 'operations' | 'customers' | 'products' | 'competitors' | 'processes';
  topic: string;
  content: string;
  source: 'manual' | 'ai_generated' | 'extracted';
  confidence: number;
  last_verified?: Date;
  tenant_id: string;
  created_at: Date;
  updated_at?: Date;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const CreateCompanyMemorySchema = z.object({
  entity_type: z.enum(['company', 'merchant', 'restaurant', 'hotel', 'healthcare', 'realestate', 'retail']),
  entity_id: z.string().min(1),
  name: z.string().min(1).max(200),
  preferences: z.object({
    operating_hours: z.object({ start: z.string(), end: z.string(), timezone: z.string() }).optional(),
    notification_channels: z.array(z.enum(['whatsapp', 'email', 'sms', 'push'])).default(['whatsapp']),
    autonomy_level: z.enum(['full', 'high', 'medium', 'low']).default('medium'),
    risk_tolerance: z.enum(['aggressive', 'moderate', 'conservative']).default('moderate'),
    decision_approval_required: z.boolean().default(false),
    auto_actions_enabled: z.array(z.string()).default([]),
  }).optional(),
});

export const UpdateMetricsSchema = z.object({
  revenue: z.number().optional(),
  customers: z.number().optional(),
  orders: z.number().optional(),
  conversion_rate: z.number().optional(),
  avg_order_value: z.number().optional(),
  retention_rate: z.number().optional(),
});

export interface APIResponse<T> { success: boolean; data?: T; error?: { code: string; message: string }; meta: { timestamp: string } }
export interface TenantContext { tenant_id: string; user_id?: string }
declare global { namespace Express { interface Request { tenantContext?: TenantContext; userId?: string } } }

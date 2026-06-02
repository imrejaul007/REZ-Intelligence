/**
 * REZ Live Action Feed - Types
 * Real-time feed of autonomous actions
 */
import { z } from 'zod';

export interface ActionFeedItem {
  id: string;
  entity_type: 'company' | 'merchant' | 'restaurant' | 'hotel' | 'healthcare' | 'realestate' | 'user';
  entity_id: string;
  agent_id: string;
  agent_name: string;
  action_type: 'observe' | 'think' | 'decide' | 'act' | 'learn';
  action: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  tenant_id: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'error';
  current_action?: string;
  actions_today: number;
  actions_success: number;
  actions_failed: number;
  last_action?: Date;
  tenant_id: string;
}

export const CreateFeedItemSchema = z.object({
  entity_type: z.enum(['company', 'merchant', 'restaurant', 'hotel', 'healthcare', 'realestate', 'user']),
  entity_id: z.string().min(1),
  agent_id: z.string().min(1),
  agent_name: z.string().min(1),
  action_type: z.enum(['observe', 'think', 'decide', 'act', 'learn']),
  action: z.string().min(1),
  description: z.string().max(500),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('running'),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  duration_ms: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export interface APIResponse<T> { success: boolean; data?: T; error?: { code: string; message: string }; meta: { timestamp: string } }
export interface TenantContext { tenant_id: string; user_id?: string }
declare global { namespace Express { interface Request { tenantContext?: TenantContext; userId?: string } } }

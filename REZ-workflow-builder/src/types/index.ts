import { z } from 'zod';

export const NodeType = z.enum(['trigger', 'action', 'condition', 'transform', 'iterator', 'aggregator', 'ai_agent', 'http', 'delay']);
export type NodeType = z.infer<typeof NodeType>;

export const WorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: NodeType,
    name: z.string(),
    config: z.record(z.any()),
    position: z.object({ x: z.number(), y: z.number() }).optional()
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    condition: z.string().optional()
  })),
  isActive: z.boolean().default(true),
  createdBy: z.string().optional()
});
export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowExecutionSchema = z.object({
  workflowId: z.string(),
  triggerData: z.record(z.any()).optional(),
  mode: z.enum(['sync', 'async']).default('async')
});
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  nodeResults: Record<string, any>;
  output: any;
  errors: string[];
}

export interface GeneratedWorkflow {
  workflow: Workflow;
  explanation: string;
  confidence: number;
}

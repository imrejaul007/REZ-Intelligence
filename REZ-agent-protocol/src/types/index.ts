import { z } from 'zod';

export const AgentCapabilitySchema = z.object({
  id: z.string(),
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['analysis', 'action', 'retrieval', 'generation', 'coordination', 'monitoring']),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  costEstimate: z.number().optional(),
  latencyEstimate: z.number().optional()
});
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  capabilities: z.array(AgentCapabilitySchema),
  status: z.enum(['available', 'busy', 'offline', 'error']),
  endpoint: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type Agent = z.infer<typeof AgentSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  type: z.string(),
  fromAgent: z.string(),
  toAgent: z.string(),
  payload: z.record(z.string(), z.unknown()),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  timeout: z.number().default(30000)
});
export type Task = z.infer<typeof TaskSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  type: z.enum(['request', 'response', 'error', 'notification']),
  from: z.string(),
  to: z.string(),
  taskId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string()
});
export type Message = z.infer<typeof MessageSchema>;

import { z } from 'zod';

// Agent Capability Schema
export const AgentCapabilitySchema = z.enum([
  'natural_language',
  'code_generation',
  'code_analysis',
  'data_processing',
  'image_analysis',
  'speech_synthesis',
  'intent_classification',
  'entity_extraction',
  'sentiment_analysis',
  'translation',
  'recommendation',
  'prediction',
  'optimization',
  'planning',
  'reasoning',
  'memory',
  'tool_use',
  'web_search',
  'api_integration',
  'database_query',
  'file_processing',
]);

export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

// Agent Status Schema
export const AgentStatusSchema = z.enum([
  'idle',
  'busy',
  'unavailable',
  'error',
  'maintenance',
]);

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// Priority Schema
export const PrioritySchema = z.enum(['low', 'normal', 'high', 'critical']).default('normal');

export type Priority = z.infer<typeof PrioritySchema>;

// Context Schema
export const ContextSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Context = z.infer<typeof ContextSchema>;

// Routing Hints Schema
export const RoutingHintsSchema = z.object({
  preferredAgents: z.array(z.string()).optional(),
  excludedAgents: z.array(z.string()).optional(),
  requiredCapabilities: z.array(AgentCapabilitySchema).optional(),
  maxAgents: z.number().optional(),
  collaborationMode: z.enum(['single', 'collaborative']).optional(),
  priority: PrioritySchema.optional(),
});

export type RoutingHints = z.infer<typeof RoutingHintsSchema>;

// Orchestration Request Schema
export const OrchestrationRequestSchema = z.object({
  requestId: z.string().uuid().optional(),
  message: z.string().min(1, 'Message cannot be empty'),
  context: ContextSchema.optional(),
  routingHints: RoutingHintsSchema.optional(),
  options: z.object({
    timeoutMs: z.number().optional(),
    maxRetries: z.number().min(0).max(5).default(3),
    fallbackEnabled: z.boolean().default(true),
    streamResponse: z.boolean().default(false),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type OrchestrationRequest = z.infer<typeof OrchestrationRequestSchema>;

// Request with generated ID
export interface ProcessedOrchestrationRequest extends OrchestrationRequest {
  requestId: string;
  timestamp: Date;
  priority: Priority;
}

export function processOrchestrationRequest(
  request: OrchestrationRequest
): ProcessedOrchestrationRequest {
  const { v4: uuidv4 } = require('uuid');

  return {
    ...request,
    requestId: request.requestId || uuidv4(),
    timestamp: new Date(),
    priority: request.routingHints?.priority || 'normal',
  };
}

export default OrchestrationRequestSchema;

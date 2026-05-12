import { z } from 'zod';
import { AgentCapabilitySchema, AgentStatusSchema, PrioritySchema } from './OrchestrationRequest';

// Response Status Schema
export const ResponseStatusSchema = z.enum([
  'success',
  'partial',
  'failed',
  'timeout',
  'escalated',
]);

export type ResponseStatus = z.infer<typeof ResponseStatusSchema>;

// Agent Attribution Schema
export const AgentAttributionSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  capabilities: z.array(AgentCapabilitySchema),
  confidence: z.number().min(0).max(1),
  processingTimeMs: z.number(),
  isFallback: z.boolean().default(false),
});

export type AgentAttribution = z.infer<typeof AgentAttributionSchema>;

// Error Details Schema
export const ErrorDetailsSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  recoverable: z.boolean().default(true),
  agentsAttempted: z.array(z.string()).optional(),
});

export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;

// Response Part Schema (for streaming/chunked responses)
export const ResponsePartSchema = z.object({
  partId: z.string(),
  content: z.string(),
  partType: z.enum(['text', 'code', 'data', 'action', 'metadata']),
  agentId: z.string().optional(),
  timestamp: z.string().datetime(),
  isFinal: z.boolean().default(false),
});

export type ResponsePart = z.infer<typeof ResponsePartSchema>;

// Orchestration Response Schema
export const OrchestrationResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: ResponseStatusSchema,
  primaryResponse: z.object({
    content: z.string(),
    format: z.enum(['text', 'json', 'html', 'markdown', 'code']).default('text'),
    language: z.string().optional(),
  }),
  attribution: z.array(AgentAttributionSchema),
  collaboration: z.object({
    agentsInvolved: z.number(),
    strategy: z.enum(['single', 'sequential', 'parallel', 'hierarchical']),
    coordinationOverheadMs: z.number().optional(),
  }).optional(),
  timing: z.object({
    totalProcessingTimeMs: z.number(),
    agentSelectionTimeMs: z.number().optional(),
    collaborationTimeMs: z.number().optional(),
    responseGenerationTimeMs: z.number().optional(),
  }),
  error: ErrorDetailsSchema.optional(),
  warnings: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  streamAvailable: z.boolean().default(false),
  retryCount: z.number().default(0),
});

export type OrchestrationResponse = z.infer<typeof OrchestrationResponseSchema>;

// Streaming Response Event Schema
export const StreamingEventSchema = z.object({
  eventId: z.string(),
  requestId: z.string().uuid(),
  eventType: z.enum([
    'agent_selected',
    'agent_started',
    'agent_progress',
    'agent_completed',
    'collaboration_started',
    'collaboration_update',
    'collaboration_completed',
    'response_chunk',
    'response_complete',
    'error',
    'escalation',
  ]),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

export type StreamingEvent = z.infer<typeof StreamingEventSchema>;

// Response Builder Class
export class OrchestrationResponseBuilder {
  private response: Partial<OrchestrationResponse>;
  private startTime: number;

  constructor(requestId: string) {
    this.startTime = Date.now();
    this.response = {
      requestId,
      status: 'success',
      attribution: [],
      timing: {
        totalProcessingTimeMs: 0,
      },
      retryCount: 0,
    };
  }

  setStatus(status: ResponseStatus): this {
    this.response.status = status;
    return this;
  }

  setPrimaryResponse(
    content: string,
    format: OrchestrationResponse['primaryResponse']['format'] = 'text'
  ): this {
    this.response.primaryResponse = { content, format };
    return this;
  }

  addAttribution(attribution: AgentAttribution): this {
    this.response.attribution = [...(this.response.attribution || []), attribution];
    return this;
  }

  setCollaboration(
    agentsInvolved: number,
    strategy: OrchestrationResponse['collaboration']['strategy']
  ): this {
    this.response.collaboration = { agentsInvolved, strategy };
    return this;
  }

  setTiming(timing: Partial<OrchestrationResponse['timing']>): this {
    this.response.timing = { ...this.response.timing, ...timing };
    return this;
  }

  setError(error: ErrorDetails): this {
    this.response.error = error;
    this.response.status = 'failed';
    return this;
  }

  setWarnings(warnings: string[]): this {
    this.response.warnings = warnings;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.response.metadata = metadata;
    return this;
  }

  setRetryCount(count: number): this {
    this.response.retryCount = count;
    return this;
  }

  setStreamAvailable(available: boolean): this {
    this.response.streamAvailable = available;
    return this;
  }

  build(): OrchestrationResponse {
    const finalResponse: OrchestrationResponse = {
      requestId: this.response.requestId!,
      status: this.response.status || 'success',
      primaryResponse: this.response.primaryResponse || {
        content: '',
        format: 'text',
      },
      attribution: this.response.attribution || [],
      timing: {
        ...this.response.timing!,
        totalProcessingTimeMs: Date.now() - this.startTime,
      },
      retryCount: this.response.retryCount || 0,
      streamAvailable: this.response.streamAvailable || false,
    };

    return finalResponse;
  }
}

export default OrchestrationResponseSchema;

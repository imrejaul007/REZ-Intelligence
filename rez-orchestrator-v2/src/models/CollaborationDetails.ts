import { z } from 'zod';
import { AgentCapabilitySchema } from './OrchestrationRequest';

// Collaboration Strategy Schema
export const CollaborationStrategySchema = z.enum([
  'sequential',
  'parallel',
  'hierarchical',
  'debate',
  'voting',
]);

export type CollaborationStrategy = z.infer<typeof CollaborationStrategySchema>;

// Collaboration Phase Schema
export const CollaborationPhaseSchema = z.enum([
  'initiation',
  'planning',
  'execution',
  'synthesis',
  'review',
  'completion',
  'failed',
]);

export type CollaborationPhase = z.infer<typeof CollaborationPhaseSchema>;

// Agent Participation Schema
export const AgentParticipationSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  role: z.enum(['coordinator', 'contributor', 'reviewer', 'specialist']),
  assignedTask: z.string().optional(),
  capabilities: z.array(AgentCapabilitySchema),
  status: z.enum(['invited', 'accepted', 'rejected', 'active', 'completed', 'failed']),
  contribution: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  processingTimeMs: z.number().optional(),
});

export type AgentParticipation = z.infer<typeof AgentParticipationSchema>;

// Task Schema
export const TaskSchema = z.object({
  taskId: z.string(),
  description: z.string(),
  requiredCapabilities: z.array(AgentCapabilitySchema),
  assignedAgentId: z.string().optional(),
  priority: z.number().min(1).max(10).default(5),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']),
  result: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  processingTimeMs: z.number().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

// Message Schema (for inter-agent communication)
export const CollaborationMessageSchema = z.object({
  messageId: z.string(),
  collaborationId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  recipientId: z.string().optional(),
  broadcast: z.boolean().default(false),
  content: z.record(z.unknown()),
  messageType: z.enum([
    'task_assignment',
    'progress_update',
    'result_submission',
    'request_for_input',
    'feedback',
    'conflict_resolution',
    'completion_notification',
  ]),
  timestamp: z.string().datetime(),
});

export type CollaborationMessage = z.infer<typeof CollaborationMessageSchema>;

// Synthesis Result Schema
export const SynthesisResultSchema = z.object({
  synthesizedContent: z.string(),
  synthesisMethod: z.enum(['concatenation', 'merge', 'debate', 'voting', 'ai_summary']),
  agentContributions: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    contributionWeight: z.number().min(0).max(1),
    keyPoints: z.array(z.string()),
  })),
  conflicts: z.array(z.object({
    agents: z.array(z.string()),
    resolution: z.string(),
    method: z.string(),
  })).optional(),
  confidence: z.number().min(0).max(1),
  processingTimeMs: z.number(),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

// Collaboration Details Schema
export const CollaborationDetailsSchema = z.object({
  collaborationId: z.string(),
  strategy: CollaborationStrategySchema,
  goal: z.string(),
  participants: z.array(AgentParticipationSchema),
  tasks: z.array(TaskSchema),
  messages: z.array(CollaborationMessageSchema).optional(),
  synthesis: SynthesisResultSchema.optional(),
  phase: CollaborationPhaseSchema,
  maxAgents: z.number(),
  timeoutMs: z.number(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  totalProcessingTimeMs: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CollaborationDetails = z.infer<typeof CollaborationDetailsSchema>;

// Collaboration Configuration Schema
export const CollaborationConfigSchema = z.object({
  maxAgents: z.number().min(2).max(10).default(5),
  strategy: CollaborationStrategySchema.default('sequential'),
  timeoutMs: z.number().min(10000).max(300000).default(60000),
  allowDynamicParticipantAddition: z.boolean().default(true),
  conflictResolutionStrategy: z.enum(['first_wins', 'last_wins', 'debate', 'voting', 'coordinator_decides']).default('coordinator_decides'),
  synthesisMethod: z.enum(['concatenation', 'merge', 'debate', 'voting', 'ai_summary']).default('merge'),
  requireConsensus: z.boolean().default(false),
  consensusThreshold: z.number().min(0.5).max(1).default(0.75),
});

export type CollaborationConfig = z.infer<typeof CollaborationConfigSchema>;

// Collaboration Result Schema
export const CollaborationResultSchema = z.object({
  collaborationId: z.string(),
  success: z.boolean(),
  strategy: CollaborationStrategySchema,
  participants: z.array(AgentParticipationSchema),
  synthesis: SynthesisResultSchema.optional(),
  totalProcessingTimeMs: z.number(),
  taskCompletionRate: z.number().min(0).max(1),
  conflictsResolved: z.number().default(0),
  warnings: z.array(z.string()).optional(),
});

export type CollaborationResult = z.infer<typeof CollaborationResultSchema>;

export default CollaborationDetailsSchema;

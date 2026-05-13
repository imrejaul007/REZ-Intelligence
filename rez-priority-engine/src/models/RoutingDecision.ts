import mongoose, { Document, Schema } from 'mongoose';
import { z } from 'zod';
import { PriorityTierValue, PriorityTierNames } from './PriorityRule';

export const DecisionStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const;

export type DecisionStatusValue = typeof DecisionStatus[keyof typeof DecisionStatus];

export const RoutingStrategy = {
  ROUND_ROBIN: 'round_robin',
  LEAST_LOADED: 'least_loaded',
  SKILL_MATCHED: 'skill_matched',
  AFFINITY: 'affinity',
  RANDOM: 'random',
  PRIORITY: 'priority',
} as const;

export type RoutingStrategyValue = typeof RoutingStrategy[keyof typeof RoutingStrategy];

export const RoutingDecisionSchemaZod = z.object({
  requestId: z.string().uuid(),
  intent: z.string().min(1),
  intentType: z.enum(['emergency', 'payment', 'fraud', 'support', 'domain', 'sales', 'loyalty', 'analytics', 'general']),
  priorityTier: z.number().int().min(1).max(7),
  priorityScore: z.number().min(0).max(100),
  routingStrategy: z.enum(['round_robin', 'least_loaded', 'skill_matched', 'affinity', 'random', 'priority']),
  targetAgent: z.string().optional(),
  targetQueue: z.string().optional(),
  slaDeadline: z.date().optional(),
  confidence: z.number().min(0).max(1),
  factors: z.array(z.object({
    name: z.string(),
    weight: z.number(),
    score: z.number(),
  })),
  metadata: z.record(z.unknown()).optional(),
});

export type RoutingDecisionInput = z.infer<typeof RoutingDecisionSchemaZod>;

export interface IRoutingDecision extends Document {
  requestId: string;
  intent: string;
  intentType: string;
  priorityTier: PriorityTierValue;
  priorityScore: number;
  routingStrategy: RoutingStrategyValue;
  targetAgent?: string;
  targetQueue?: string;
  slaDeadline?: Date;
  confidence: number;
  factors: Array<{
    name: string;
    weight: number;
    score: number;
  }>;
  status: DecisionStatusValue;
  processingTimeMs?: number;
  metadata?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoutingDecisionSchema = new Schema<IRoutingDecision>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    intent: {
      type: String,
      required: true,
      index: true,
    },
    intentType: {
      type: String,
      required: true,
      enum: ['emergency', 'payment', 'fraud', 'support', 'domain', 'sales', 'loyalty', 'analytics', 'general'],
      index: true,
    },
    priorityTier: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
      index: true,
    },
    priorityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    routingStrategy: {
      type: String,
      required: true,
      enum: Object.values(RoutingStrategy),
      default: RoutingStrategy.PRIORITY,
    },
    targetAgent: {
      type: String,
      index: true,
    },
    targetQueue: {
      type: String,
      index: true,
    },
    slaDeadline: {
      type: Date,
      index: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    factors: {
      type: [
        {
          name: { type: String, required: true },
          weight: { type: Number, required: true },
          score: { type: Number, required: true },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(DecisionStatus),
      default: DecisionStatus.PENDING,
      index: true,
    },
    processingTimeMs: {
      type: Number,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'routing_decisions',
  }
);

RoutingDecisionSchema.index({ status: 1, createdAt: -1 });
RoutingDecisionSchema.index({ intentType: 1, priorityTier: 1 });
RoutingDecisionSchema.index({ targetAgent: 1, status: 1 });
RoutingDecisionSchema.index({ slaDeadline: 1, status: 1 });

RoutingDecisionSchema.virtual('priorityTierName').get(function () {
  return PriorityTierNames[this.priorityTier as PriorityTierValue] || 'UNKNOWN';
});

RoutingDecisionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const RoutingDecision = mongoose.model<IRoutingDecision>('RoutingDecision', RoutingDecisionSchema);

export default RoutingDecision;

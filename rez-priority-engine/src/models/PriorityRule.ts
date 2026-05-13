import mongoose, { Document, Schema } from 'mongoose';
import { z } from 'zod';

export const PriorityTier = {
  EMERGENCY: 1,
  PAYMENT_FRAUD: 2,
  SUPPORT: 3,
  DOMAIN_EXPERT: 4,
  SALES: 5,
  LOYALTY: 6,
  ANALYTICS: 7,
} as const;

export type PriorityTierValue = typeof PriorityTier[keyof typeof PriorityTier];

export const PriorityTierNames: Record<PriorityTierValue, string> = {
  [PriorityTier.EMERGENCY]: 'EMERGENCY',
  [PriorityTier.PAYMENT_FRAUD]: 'PAYMENT/FRAUD',
  [PriorityTier.SUPPORT]: 'SUPPORT',
  [PriorityTier.DOMAIN_EXPERT]: 'DOMAIN EXPERT',
  [PriorityTier.SALES]: 'SALES',
  [PriorityTier.LOYALTY]: 'LOYALTY',
  [PriorityTier.ANALYTICS]: 'ANALYTICS',
};

export const RuleType = {
  EMERGENCY: 'emergency',
  PAYMENT: 'payment',
  FRAUD: 'fraud',
  SUPPORT: 'support',
  DOMAIN: 'domain',
  SALES: 'sales',
  LOYALTY: 'loyalty',
  ANALYTICS: 'analytics',
  CUSTOM: 'custom',
} as const;

export type RuleTypeValue = typeof RuleType[keyof typeof RuleType];

export const PriorityRuleSchemaZod = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  ruleType: z.enum([
    'emergency',
    'payment',
    'fraud',
    'support',
    'domain',
    'sales',
    'loyalty',
    'analytics',
    'custom',
  ]),
  priorityTier: z.number().int().min(1).max(7),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'in', 'nin', 'regex']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  })),
  actions: z.object({
    routeTo: z.string().optional(),
    escalate: z.boolean().optional(),
    notify: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    slaMinutes: z.number().int().positive().optional(),
  }),
  enabled: z.boolean().default(true),
  domain: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PriorityRuleInput = z.infer<typeof PriorityRuleSchemaZod>;

export interface IPriorityRule extends Document {
  name: string;
  description?: string;
  ruleType: RuleTypeValue;
  priorityTier: PriorityTierValue;
  conditions: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'nin' | 'regex';
    value: string | number | boolean | string[];
  }>;
  actions: {
    routeTo?: string;
    escalate?: boolean;
    notify?: string[];
    tags?: string[];
    slaMinutes?: number;
  };
  enabled: boolean;
  domain?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PriorityRuleSchema = new Schema<IPriorityRule>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    ruleType: {
      type: String,
      required: true,
      enum: Object.values(RuleType),
      index: true,
    },
    priorityTier: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
      index: true,
    },
    conditions: {
      type: [
        {
          field: { type: String, required: true },
          operator: {
            type: String,
            required: true,
            enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'in', 'nin', 'regex'],
          },
          value: { type: Schema.Types.Mixed, required: true },
        },
      ],
      default: [],
    },
    actions: {
      type: {
        routeTo: { type: String },
        escalate: { type: Boolean },
        notify: [{ type: String }],
        tags: [{ type: String }],
        slaMinutes: { type: Number },
      },
      default: {},
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    domain: {
      type: String,
      index: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: 'priority_rules',
  }
);

PriorityRuleSchema.index({ enabled: 1, priorityTier: 1 });
PriorityRuleSchema.index({ domain: 1, enabled: 1 });

export const PriorityRule = mongoose.model<IPriorityRule>('PriorityRule', PriorityRuleSchema);

export default PriorityRule;

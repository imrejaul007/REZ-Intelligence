import { z } from 'zod';

export const ReasoningMethod = z.enum([
  'chain_of_thought',
  'tree_of_thought',
  'deductive',
  'inductive',
  'abductive',
  'constraint_solving'
]);
export type ReasoningMethod = z.infer<typeof ReasoningMethod>;

export const ReasoningRequestSchema = z.object({
  problem: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
  method: ReasoningMethod.default('chain_of_thought'),
  maxSteps: z.number().min(1).max(20).default(10),
  constraints: z.array(z.string()).optional()
});
export type ReasoningRequest = z.infer<typeof ReasoningRequestSchema>;

export interface ReasoningStep {
  step: number;
  thought: string;
  action: string;
  intermediateResult?: unknown;
  confidence: number;
}

export interface ReasoningResult {
  reasoningId: string;
  method: ReasoningMethod;
  steps: ReasoningStep[];
  conclusion: string;
  confidence: number;
  alternativePaths: string[];
  causalChain: string[];
  recommendations?: string[];
  executionTimeMs: number;
}

export interface DeductionResult {
  premise: string;
  rule: string;
  conclusion: string;
  valid: boolean;
  certainty: number;
}

export interface ConstraintSatisfactionResult {
  solution: Record<string, unknown>;
  constraintsSatisfied: number;
  constraintsViolated: string[];
  searchSteps: number;
  optimal: boolean;
}

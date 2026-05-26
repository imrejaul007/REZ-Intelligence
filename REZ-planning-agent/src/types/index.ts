import { z } from 'zod';

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dependencies: z.array(z.string()).default([]),
  estimatedDuration: z.number().optional(),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type Task = z.infer<typeof TaskSchema>;

export const PlanSchema = z.object({
  id: z.string(),
  goal: z.string(),
  tasks: z.array(TaskSchema),
  strategy: z.enum(['sequential', 'parallel', 'adaptive', 'hybrid']),
  estimatedTotalDuration: z.number().optional(),
  milestones: z.array(z.object({
    id: z.string(),
    name: z.string(),
    taskIds: z.array(z.string()),
  })).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Plan = z.infer<typeof PlanSchema>;

export const PlanRequestSchema = z.object({
  goal: z.string().describe('The high-level goal or objective'),
  constraints: z.object({
    maxDuration: z.number().optional().describe('Maximum time in minutes'),
    maxCost: z.number().optional().describe('Maximum cost in units'),
    requiredSkills: z.array(z.string()).optional(),
    parallelTasks: z.number().optional().default(3),
  }).optional().default({}),
  context: z.record(z.unknown()).optional().default({}),
});

export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export const PlanResponseSchema = z.object({
  plan: z.any(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  alternativeStrategies: z.array(z.object({
    strategy: z.string(),
    estimatedDuration: z.number(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  })).default([]),
});

export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export interface ExecutionContext {
  planId: string;
  currentTaskId: string | null;
  completedTasks: string[];
  blockedTasks: string[];
  metrics: {
    startTime: Date;
    tasksCompleted: number;
    tasksBlocked: number;
    estimatedRemaining: number;
  };
}

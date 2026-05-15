import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum FitnessLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export enum WorkoutType {
  STRENGTH = 'strength',
  CARDIO = 'cardio',
  HIIT = 'hiit',
  FLEXIBILITY = 'flexibility',
  FUNCTIONAL = 'functional',
  YOGA = 'yoga',
  CROSSFIT = 'crossfit'
}

export enum MuscleGroup {
  CHEST = 'chest',
  BACK = 'back',
  SHOULDERS = 'shoulders',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  CORE = 'core',
  LEGS = 'legs',
  FULL_BODY = 'full_body'
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const UserProfileSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  age: z.number().int().min(13).max(100),
  fitnessLevel: z.nativeEnum(FitnessLevel),
  goals: z.array(z.string()).min(1, 'At least one goal is required'),
  preferredWorkouts: z.array(z.nativeEnum(WorkoutType)).min(1),
  availableEquipment: z.array(z.string()),
  daysPerWeek: z.number().int().min(1).max(7),
  timePerWorkout: z.number().int().min(15).max(180),
  injuries: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional()
});

export const WorkoutPlanRequestSchema = z.object({
  userProfile: UserProfileSchema,
  duration: z.enum(['short', 'medium', 'long']).optional(),
  focusArea: z.nativeEnum(MuscleGroup).optional()
});

export const ProgressUpdateSchema = z.object({
  workoutId: z.string(),
  completedExercises: z.array(z.object({
    exerciseId: z.string(),
    setsCompleted: z.number().int().min(0),
    repsCompleted: z.number().int().min(0),
    weightUsed: z.number().optional(),
    duration: z.number().optional()
  })),
  notes: z.string().max(500).optional(),
  rating: z.number().int().min(1).max(5).optional()
});

export const ChatMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  userId: z.string().optional(),
  context: z.object({
    currentPlan: z.string().optional(),
    workoutHistory: z.array(z.string()).optional(),
    preferences: z.record(z.unknown()).optional()
  }).optional()
});

// ============================================
// TYPES
// ============================================

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type WorkoutPlanRequest = z.infer<typeof WorkoutPlanRequestSchema>;
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  videoUrl?: string;
  imageUrl?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  difficulty: FitnessLevel;
  duration: number;
  frequency: string;
  exercises: PlannedExercise[];
  warmUp: string[];
  coolDown: string[];
  tips: string[];
  createdAt: Date;
  userId?: string;
}

export interface FitnessResponse {
  success: boolean;
  message?: string;
  data?: WorkoutPlan | PlannedExercise[] | ProgressUpdate | Record<string, unknown>;
  error?: string;
  sessionId?: string;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface ServiceConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  logLevel: string;
  serviceName: string;
  version: string;
}

// ============================================
// ERROR TYPES
// ============================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError['errors'] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

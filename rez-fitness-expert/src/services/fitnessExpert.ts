import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { EXERCISE_DATABASE } from '../config/knowledge.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (metadata.stack) {
    msg += `\n${metadata.stack}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
    }),
    new winston.transports.File({
      filename: 'logs/fitness-expert-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/fitness-expert.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export enum WorkoutType {
  STRENGTH = 'strength',
  CARDIO = 'cardio',
  HIIT = 'hiit',
  FLEXIBILITY = 'flexibility',
  ENDURANCE = 'endurance',
  FUNCTIONAL = 'functional',
  SPORT_SPECIFIC = 'sport_specific',
  CROSSFIT = 'crossfit',
  YOGA = 'yoga',
  PILATES = 'pilates',
  CIRCUIT = 'circuit',
  COMPOUND = 'compound'
}

export enum FitnessLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export enum MuscleGroup {
  CHEST = 'chest',
  BACK = 'back',
  SHOULDERS = 'shoulders',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  FOREARMS = 'forearms',
  CORE = 'core',
  QUADRICEPS = 'quadriceps',
  HAMSTRINGS = 'hamstrings',
  GLUTES = 'glutes',
  CALVES = 'calves',
  FULL_BODY = 'full_body'
}

export enum Equipment {
  NONE = 'none',
  DUMBBELLS = 'dumbbells',
  BARBELL = 'barbell',
  CABLE_MACHINE = 'cable_machine',
  KETTLEBELL = 'kettlebell',
  RESISTANCE_BANDS = 'resistance_bands',
  PULL_UP_BAR = 'pull_up_bar',
  BENCH = 'bench',
  ROWING_MACHINE = 'rowing_machine',
  TREADMILL = 'treadmill',
  BICYCLE = 'bicycle',
  SQUAT_RACK = 'squat_rack'
}

export interface UserProfile {
  id: string;
  fitnessLevel: FitnessLevel;
  goals: string[];
  preferredWorkouts: WorkoutType[];
  availableEquipment: Equipment[];
  daysPerWeek: number;
  injuries?: string[];
  timePerWorkout: number;
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
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

export interface FitnessResponse {
  success: boolean;
  message: string;
  workoutPlan?: WorkoutPlan;
  exercises?: Exercise[];
  progress?: ProgressUpdate;
  recommendations?: Recommendation[];
  data?: Record<string, unknown>;
  processingTime?: number;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscleGroups: MuscleGroup[];
  workoutType: WorkoutType;
  equipment: Equipment[];
  difficulty: FitnessLevel;
  instructions: string[];
  tips: string[];
  variations: string[];
  benefits: string[];
  caloriesPerMinute?: number;
}

export interface ProgressUpdate {
  date: Date;
  completedWorkouts: number;
  totalMinutes: number;
  caloriesBurned: number;
  achievements: string[];
}

export interface Recommendation {
  type: 'workout' | 'exercise' | 'tip' | 'goal';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

class FitnessExpertAgent {
  private readonly agentId: string;
  private readonly agentName: string;
  private sessionHistory: Map<string, FitnessSession>;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Fitness Expert';
    this.sessionHistory = new Map();
    logger.info('Fitness Expert Agent initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  async processQuery(
    query: string,
    userProfile: UserProfile,
    sessionId: string
  ): Promise<FitnessResponse> {
    const startTime = Date.now();
    logger.info('Processing fitness query', { sessionId, queryLength: query.length });

    try {
      const intent = this.identifyIntent(query);
      let response: FitnessResponse;

      switch (intent) {
        case 'workout_plan':
          response = await this.handleWorkoutPlanRequest(query, userProfile);
          break;
        case 'exercise':
          response = await this.handleExerciseQuery(query, userProfile);
          break;
        case 'progress':
          response = await this.handleProgressQuery(query, userProfile, sessionId);
          break;
        case 'recommendation':
          response = await this.handleRecommendationRequest(query, userProfile);
          break;
        case 'terminology':
          response = await this.handleTerminologyQuery(query);
          break;
        default:
          response = await this.handleGeneralFitnessQuery(query, userProfile);
      }

      this.recordSession(sessionId, intent, query);
      response.processingTime = Date.now() - startTime;

      return response;

    } catch (error) {
      logger.error('Error processing fitness query', { error, sessionId });
      throw error;
    }
  }

  private identifyIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (this.matches(lowerQuery, ['workout plan', 'create workout', 'design workout', 'build workout', 'routine'])) {
      return 'workout_plan';
    }
    if (this.matches(lowerQuery, ['exercise', 'how to', 'show me', 'demonstrate', 'form', 'technique'])) {
      return 'exercise';
    }
    if (this.matches(lowerQuery, ['progress', 'tracking', 'milestone', 'achievement', 'improve'])) {
      return 'progress';
    }
    if (this.matches(lowerQuery, ['recommend', 'suggest', 'advice', 'tip', 'should i'])) {
      return 'recommendation';
    }
    if (this.matches(lowerQuery, ['what is', 'definition', 'mean', 'term', 'glossary'])) {
      return 'terminology';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private async handleWorkoutPlanRequest(
    query: string,
    userProfile: UserProfile
  ): Promise<FitnessResponse> {
    const { createWorkoutPlan } = await import('./expertise.js');

    const workoutPlan = createWorkoutPlan(userProfile);

    const exercises = this.getExercisesForPlan(workoutPlan);

    return {
      success: true,
      message: this.formatWorkoutPlanMessage(workoutPlan),
      workoutPlan,
      exercises
    };
  }

  private async handleExerciseQuery(
    query: string,
    userProfile: UserProfile
  ): Promise<FitnessResponse> {
    const { getExercisesByType, getExercisesByMuscle } = await import('./expertise.js');

    const exercises = this.findExercisesInQuery(query);

    if (exercises.length === 0) {
      return {
        success: true,
        message: `I couldn't find specific exercises for "${query}". Could you clarify what you're looking for? For example:\n\n` +
          `• "Show me chest exercises"\n• "What are the best cardio workouts?"\n• "Exercises for beginners"`
      };
    }

    return {
      success: true,
      message: this.formatExerciseList(exercises),
      exercises
    };
  }

  private async handleProgressQuery(
    query: string,
    userProfile: UserProfile,
    sessionId: string
  ): Promise<FitnessResponse> {
    const { calculateProgress } = await import('./expertise.js');

    const progress = calculateProgress(userProfile);

    return {
      success: true,
      message: this.formatProgressMessage(progress),
      progress
    };
  }

  private async handleRecommendationRequest(
    query: string,
    userProfile: UserProfile
  ): Promise<FitnessResponse> {
    const { getRecommendations } = await import('./recommendations.js');

    const recommendations = getRecommendations(userProfile);

    return {
      success: true,
      message: this.formatRecommendations(recommendations),
      recommendations
    };
  }

  private async handleTerminologyQuery(query: string): Promise<FitnessResponse> {
    const { getFitnessTerm } = await import('./expertise.js');

    const terms = this.extractTermsFromQuery(query);

    if (terms.length === 0) {
      return {
        success: true,
        message: `Here's a quick fitness terminology guide!\n\n` +
          `**Rep**: One complete movement of an exercise\n` +
          `**Set**: A group of reps performed together\n` +
          `**HIIT**: High-Intensity Interval Training\n` +
          `**Compound**: Multi-joint exercises\n` +
          `**RM**: Your maximum weight for one rep\n\n` +
          `What term would you like to know more about?`
      };
    }

    const definitions = terms.map(term => getFitnessTerm(term)).filter(Boolean);

    return {
      success: true,
      message: definitions.map(d => `**${d?.term}**: ${d?.definition}`).join('\n\n')
    };
  }

  private async handleGeneralFitnessQuery(
    query: string,
    userProfile: UserProfile
  ): Promise<FitnessResponse> {
    return {
      success: true,
      message: `Hey fitness champion! Let's crush some goals together!\n\n` +
        `I'm here to help you with:\n\n` +
        `**Workout Planning** - "Create a workout plan for me"\n` +
        `**Exercise Guidance** - "Show me proper squat form"\n` +
        `**Progress Tracking** - "How am I doing with my fitness goals?"\n` +
        `**Recommendations** - "What should I focus on next?"\n` +
        `**Fitness Education** - "What does HIIT mean?"\n\n` +
        `What's your fitness focus today? Let's make it happen!`
    };
  }

  private findExercisesInQuery(query: string): Exercise[] {
    const lowerQuery = query.toLowerCase();

    let exercises = [...EXERCISE_DATABASE];

    if (lowerQuery.includes('chest')) {
      exercises = exercises.filter((e) => e.muscleGroups.includes(MuscleGroup.CHEST));
    }
    if (lowerQuery.includes('back')) {
      exercises = exercises.filter((e) => e.muscleGroups.includes(MuscleGroup.BACK));
    }
    if (lowerQuery.includes('leg') || lowerQuery.includes('quadriceps') || lowerQuery.includes('glute')) {
      exercises = exercises.filter((e) =>
        e.muscleGroups.some((g) => [MuscleGroup.QUADRICEPS, MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS].includes(g))
      );
    }
    if (lowerQuery.includes('core') || lowerQuery.includes('abs')) {
      exercises = exercises.filter((e) => e.muscleGroups.includes(MuscleGroup.CORE));
    }
    if (lowerQuery.includes('arm') || lowerQuery.includes('bicep') || lowerQuery.includes('tricep')) {
      exercises = exercises.filter((e) =>
        e.muscleGroups.some((g) => [MuscleGroup.BICEPS, MuscleGroup.TRICEPS].includes(g))
      );
    }
    if (lowerQuery.includes('cardio')) {
      exercises = exercises.filter((e) => e.workoutType === WorkoutType.CARDIO || e.workoutType === WorkoutType.HIIT);
    }
    if (lowerQuery.includes('hiit')) {
      exercises = exercises.filter((e) => e.workoutType === WorkoutType.HIIT);
    }

    return exercises.slice(0, 5);
  }

  private getExercisesForPlan(plan: WorkoutPlan): Exercise[] {
    return EXERCISE_DATABASE.filter((e) =>
      plan.exercises.some(p => p.exerciseId === e.id)
    );
  }

  private formatWorkoutPlanMessage(plan: WorkoutPlan): string {
    let message = `## ${plan.name}\n\n`;
    message += `${plan.description}\n\n`;
    message += `**Difficulty**: ${plan.difficulty}\n`;
    message += `**Duration**: ${plan.duration} minutes\n`;
    message += `**Frequency**: ${plan.frequency}\n\n`;

    message += `### Warm Up\n`;
    plan.warmUp.forEach(ex => message += `• ${ex}\n`);
    message += '\n';

    message += `### Main Workout\n`;
    plan.exercises.forEach((ex, i) => {
      message += `\n**${i + 1}. ${ex.name}**\n`;
      message += `   Sets: ${ex.sets} | Reps: ${ex.reps} | Rest: ${ex.rest}\n`;
      if (ex.notes) message += `   Note: ${ex.notes}\n`;
    });
    message += '\n';

    message += `### Cool Down\n`;
    plan.coolDown.forEach(ex => message += `• ${ex}\n`);
    message += '\n';

    message += `### Pro Tips\n`;
    plan.tips.forEach(tip => message += `• ${tip}\n`);

    return message;
  }

  private formatExerciseList(exercises: Exercise[]): string {
    let message = `Here are some exercises for you!\n\n`;

    exercises.forEach((ex, i) => {
      message += `### ${i + 1}. ${ex.name}\n`;
      message += `${ex.description}\n\n`;
      message += `**Muscles**: ${ex.muscleGroups.join(', ')}\n`;
      message += `**Equipment**: ${ex.equipment.join(', ')}\n`;
      message += `**Difficulty**: ${ex.difficulty}\n\n`;
      message += `**How to do it**:\n`;
      ex.instructions.forEach((inst, idx) => {
        message += `${idx + 1}. ${inst}\n`;
      });
      message += '\n';
      message += `**Pro Tips**: ${ex.tips.join(', ')}\n`;
      message += '\n---\n\n';
    });

    return message;
  }

  private formatProgressMessage(progress: ProgressUpdate): string {
    let message = `## Your Fitness Progress\n\n`;
    message += `**Date**: ${progress.date.toLocaleDateString()}\n\n`;
    message += `**Workouts Completed**: ${progress.completedWorkouts}\n`;
    message += `**Total Time**: ${progress.totalMinutes} minutes\n`;
    message += `**Calories Burned**: ${progress.caloriesBurned}\n\n`;

    if (progress.achievements.length > 0) {
      message += `### Achievements Unlocked\n`;
      progress.achievements.forEach(ach => message += `• ${ach}\n`);
    }

    return message;
  }

  private formatRecommendations(recommendations: Recommendation[]): string {
    let message = `Based on your fitness profile, here are my recommendations!\n\n`;

    recommendations.forEach(rec => {
      const priorityEmoji = rec.priority === 'high' ? '🔥' : rec.priority === 'medium' ? '💪' : '💡';
      message += `${priorityEmoji} **${rec.title}**\n${rec.description}\n\n`;
    });

    return message;
  }

  private extractTermsFromQuery(query: string): string[] {
    const terms: string[] = [];
    const lowerQuery = query.toLowerCase();

    const fitnessTerms = ['rep', 'set', 'rm', 'hiit', 'supersets', 'circuits', 'plyometrics', 'domes', 'tut'];
    fitnessTerms.forEach(term => {
      if (lowerQuery.includes(term)) {
        terms.push(term);
      }
    });

    return terms;
  }

  private recordSession(sessionId: string, intent: string, query: string): void {
    const session: FitnessSession = {
      id: sessionId,
      intent,
      query,
      timestamp: new Date()
    };

    this.sessionHistory.set(sessionId, session);

    if (this.sessionHistory.size > 100) {
      const firstKey = this.sessionHistory.keys().next().value;
      if (firstKey) {
        this.sessionHistory.delete(firstKey);
      }
    }
  }
}

interface FitnessSession {
  id: string;
  intent: string;
  query: string;
  timestamp: Date;
}

export const fitnessExpert = new FitnessExpertAgent();

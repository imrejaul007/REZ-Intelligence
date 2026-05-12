import winston from 'winston';
export declare const logger: winston.Logger;
export declare enum WorkoutType {
    STRENGTH = "strength",
    CARDIO = "cardio",
    HIIT = "hiit",
    FLEXIBILITY = "flexibility",
    ENDURANCE = "endurance",
    FUNCTIONAL = "functional",
    SPORT_SPECIFIC = "sport_specific",
    CROSSFIT = "crossfit",
    YOGA = "yoga",
    PILATES = "pilates",
    CIRCUIT = "circuit",
    COMPOUND = "compound"
}
export declare enum FitnessLevel {
    BEGINNER = "beginner",
    INTERMEDIATE = "intermediate",
    ADVANCED = "advanced"
}
export declare enum MuscleGroup {
    CHEST = "chest",
    BACK = "back",
    SHOULDERS = "shoulders",
    BICEPS = "biceps",
    TRICEPS = "triceps",
    FOREARMS = "forearms",
    CORE = "core",
    QUADRICEPS = "quadriceps",
    HAMSTRINGS = "hamstrings",
    GLUTES = "glutes",
    CALVES = "calves",
    FULL_BODY = "full_body"
}
export declare enum Equipment {
    NONE = "none",
    DUMBBELLS = "dumbbells",
    BARBELL = "barbell",
    CABLE_MACHINE = "cable_machine",
    KETTLEBELL = "kettlebell",
    RESISTANCE_BANDS = "resistance_bands",
    PULL_UP_BAR = "pull_up_bar",
    BENCH = "bench",
    ROWING_MACHINE = "rowing_machine",
    TREADMILL = "treadmill",
    BICYCLE = "bicycle",
    SQUAT_RACK = "squat_rack"
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
declare class FitnessExpertAgent {
    private readonly agentId;
    private readonly agentName;
    private sessionHistory;
    constructor(agentId?: string, agentName?: string);
    processQuery(query: string, userProfile: UserProfile, sessionId: string): Promise<FitnessResponse>;
    private identifyIntent;
    private matches;
    private handleWorkoutPlanRequest;
    private handleExerciseQuery;
    private handleProgressQuery;
    private handleRecommendationRequest;
    private handleTerminologyQuery;
    private handleGeneralFitnessQuery;
    private findExercisesInQuery;
    private getExercisesForPlan;
    private formatWorkoutPlanMessage;
    private formatExerciseList;
    private formatProgressMessage;
    private formatRecommendations;
    private extractTermsFromQuery;
    private recordSession;
}
export declare const fitnessExpert: FitnessExpertAgent;
export {};
//# sourceMappingURL=fitnessExpert.d.ts.map
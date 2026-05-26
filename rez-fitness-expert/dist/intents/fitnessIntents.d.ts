import { WorkoutType, FitnessLevel, Equipment } from '../services/fitnessExpert.js';
export declare enum FitnessIntent {
    WORKOUT_PLAN = "workout_plan",
    EXERCISE_INFO = "exercise_info",
    PROGRESS_TRACK = "progress_track",
    GOAL_SETTING = "goal_setting",
    NUTRITION_TIP = "nutrition_tip",
    RECOVERY_ADVICE = "recovery_advice",
    WARM_UP = "warm_up",
    COOL_DOWN = "cool_down",
    EQUIPMENT_QUESTION = "equipment_question",
    FORM_CORRECTION = "form_correction",
    MOTIVATION = "motivation",
    SCHEDULE_WORKOUT = "schedule_workout",
    WORKOUT_COMPLETION = "workout_completion",
    PERSONAL_BEST = "personal_best",
    BEGINNER_QUESTION = "beginner_question",
    MODIFICATION_REQUEST = "modification_request"
}
export interface IntentPattern {
    intent: FitnessIntent;
    patterns: string[];
    keywords: string[];
    requiresContext: boolean;
    responseTemplate?: string;
}
export declare const FITNESS_INTENT_PATTERNS: IntentPattern[];
export declare function detectFitnessIntent(query: string): FitnessIntent | null;
export declare function getResponseForIntent(intent: FitnessIntent, context?: Record<string, unknown>): string;
export interface FitnessContext {
    currentWorkout?: string;
    currentExercise?: string;
    lastIntent?: FitnessIntent;
    userPreferences?: {
        preferredWorkoutTypes?: WorkoutType[];
        fitnessLevel?: FitnessLevel;
        availableEquipment?: Equipment[];
    };
}
export declare function buildContextFromQuery(query: string, context: FitnessContext): FitnessContext;
//# sourceMappingURL=fitnessIntents.d.ts.map
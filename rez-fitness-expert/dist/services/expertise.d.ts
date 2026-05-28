import { WorkoutPlan, UserProfile, WorkoutType, ProgressUpdate } from './fitnessExpert';
import { EXERCISE_DATABASE } from '../config/knowledge';
export declare function validateEnv(): void;
export declare function createWorkoutPlan(userProfile: UserProfile): WorkoutPlan;
export declare function getExercisesByType(type: WorkoutType): typeof EXERCISE_DATABASE;
export declare function getExercisesByMuscle(muscleGroup: string): typeof EXERCISE_DATABASE;
export declare function calculateProgress(profile: UserProfile): ProgressUpdate;
export declare function getFitnessTerm(term: string): {
    term: string;
    definition: string;
} | null;
//# sourceMappingURL=expertise.d.ts.map
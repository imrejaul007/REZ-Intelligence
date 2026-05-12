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
export interface FitnessTerm {
    term: string;
    definition: string;
    category: string;
}
export declare const EXERCISE_DATABASE: Exercise[];
export declare const FITNESS_GLOSSARY: FitnessTerm[];
export declare const WARM_UP_EXERCISES: {
    name: string;
    duration: string;
    purpose: string;
}[];
export declare const COOL_DOWN_EXERCISES: {
    name: string;
    duration: string;
    purpose: string;
}[];
export declare const RECOVERY_RECOMMENDATIONS: string[];
//# sourceMappingURL=knowledge.d.ts.map
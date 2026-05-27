import logger from './utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { FitnessLevel, WorkoutType } from './fitnessExpert.js';
import { WARM_UP_EXERCISES, COOL_DOWN_EXERCISES, EXERCISE_DATABASE } from '../config/knowledge.js';
export function validateEnv() {
    const required = ['NODE_ENV'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        logger.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    }
}
export function createWorkoutPlan(userProfile) {
    const planId = uuidv4();
    const planName = generatePlanName(userProfile);
    const exercises = generateExercisesForProfile(userProfile);
    const warmUp = WARM_UP_EXERCISES.map(w => `${w.name} - ${w.duration}`);
    const coolDown = COOL_DOWN_EXERCISES.map(c => `${c.name} - ${c.duration}`);
    const tips = generateWorkoutTips(userProfile);
    return {
        id: planId,
        name: planName,
        description: generatePlanDescription(userProfile),
        difficulty: userProfile.fitnessLevel,
        duration: userProfile.timePerWorkout,
        frequency: `${userProfile.daysPerWeek} days per week`,
        exercises,
        warmUp,
        coolDown,
        tips
    };
}
function generatePlanName(profile) {
    const prefixes = {
        [FitnessLevel.BEGINNER]: 'Starter',
        [FitnessLevel.INTERMEDIATE]: 'Progressive',
        [FitnessLevel.ADVANCED]: 'Elite'
    };
    const mainGoal = profile.goals[0] || 'General Fitness';
    const goalSuffix = mainGoal.split(' ')[0];
    return `${prefixes[profile.fitnessLevel]} ${goalSuffix} Program`;
}
function generatePlanDescription(profile) {
    return `A ${profile.daysPerWeek}-day per week workout program designed for ` +
        `${profile.fitnessLevel} fitness levels. This program focuses on ` +
        `${profile.goals.join(', ')} using ` +
        `${profile.availableEquipment.includes('none') ? 'bodyweight' : 'equipment-based'} exercises. ` +
        `Each workout is designed to maximize results while maintaining proper form and safety!`;
}
function generateExercisesForProfile(profile) {
    const exercises = [];
    if (profile.preferredWorkouts.includes(WorkoutType.STRENGTH)) {
        exercises.push({
            exerciseId: 'push-up',
            name: 'Push-Ups',
            sets: getSetsForLevel(profile.fitnessLevel),
            reps: getRepsForLevel(profile.fitnessLevel, 'strength'),
            rest: '60 seconds',
            notes: 'Keep core engaged, chest to floor'
        }, {
            exerciseId: 'squat',
            name: 'Bodyweight Squats',
            sets: getSetsForLevel(profile.fitnessLevel),
            reps: getRepsForLevel(profile.fitnessLevel, 'strength'),
            rest: '60 seconds',
            notes: 'Full depth, knees track over toes'
        }, {
            exerciseId: 'plank',
            name: 'Plank Hold',
            sets: 3,
            reps: getPlankTimeForLevel(profile.fitnessLevel),
            rest: '45 seconds',
            notes: 'Maintain straight line from head to heels'
        });
    }
    if (profile.preferredWorkouts.includes(WorkoutType.CARDIO) || profile.preferredWorkouts.includes(WorkoutType.HIIT)) {
        exercises.push({
            exerciseId: 'jumping-jacks',
            name: 'Jumping Jacks',
            sets: 3,
            reps: '60 seconds',
            rest: '30 seconds',
            notes: 'Steady rhythm, land softly'
        }, {
            exerciseId: 'mountain-climbers',
            name: 'Mountain Climbers',
            sets: 3,
            reps: '45 seconds',
            rest: '30 seconds',
            notes: 'Quick leg switches, hips level'
        }, {
            exerciseId: 'burpee',
            name: 'Burpees',
            sets: getSetsForLevel(profile.fitnessLevel),
            reps: getRepsForLevel(profile.fitnessLevel, 'cardio'),
            rest: '90 seconds',
            notes: 'Modify by stepping back if needed'
        });
    }
    if (profile.preferredWorkouts.includes(WorkoutType.FUNCTIONAL)) {
        exercises.push({
            exerciseId: 'lunges',
            name: 'Walking Lunges',
            sets: 3,
            reps: '12 each leg',
            rest: '60 seconds',
            notes: 'Keep torso upright, controlled steps'
        });
    }
    if (exercises.length === 0) {
        exercises.push({
            exerciseId: 'push-up',
            name: 'Push-Ups',
            sets: 3,
            reps: '10-12',
            rest: '60 seconds'
        }, {
            exerciseId: 'squat',
            name: 'Bodyweight Squats',
            sets: 3,
            reps: '15-20',
            rest: '60 seconds'
        }, {
            exerciseId: 'plank',
            name: 'Plank Hold',
            sets: 3,
            reps: '30 seconds',
            rest: '45 seconds'
        });
    }
    return exercises;
}
function getSetsForLevel(level) {
    switch (level) {
        case FitnessLevel.BEGINNER:
            return 2;
        case FitnessLevel.INTERMEDIATE:
            return 3;
        case FitnessLevel.ADVANCED:
            return 4;
        default:
            return 3;
    }
}
function getRepsForLevel(level, type) {
    switch (level) {
        case FitnessLevel.BEGINNER:
            return type === 'strength' ? '8-10' : '8-10';
        case FitnessLevel.INTERMEDIATE:
            return type === 'strength' ? '10-12' : '10-12';
        case FitnessLevel.ADVANCED:
            return type === 'strength' ? '12-15' : '12-15';
        default:
            return '10-12';
    }
}
function getPlankTimeForLevel(level) {
    switch (level) {
        case FitnessLevel.BEGINNER:
            return '20-30 seconds';
        case FitnessLevel.INTERMEDIATE:
            return '30-45 seconds';
        case FitnessLevel.ADVANCED:
            return '45-60 seconds';
        default:
            return '30 seconds';
    }
}
function generateWorkoutTips(profile) {
    const tips = [
        'Always warm up for 5-10 minutes before starting',
        'Focus on proper form before increasing intensity',
        'Stay hydrated throughout your workout',
        'Listen to your body and rest when needed'
    ];
    if (profile.fitnessLevel === FitnessLevel.BEGINNER) {
        tips.push('Start slow and gradually increase intensity over weeks');
        tips.push('Consider working with a trainer to learn proper form');
    }
    if (profile.goals.includes('weight loss')) {
        tips.push('Combine strength training with cardio for best fat loss results');
        tips.push('High-intensity intervals can boost your metabolism');
    }
    if (profile.goals.includes('muscle gain')) {
        tips.push('Focus on progressive overload - gradually increase weight or reps');
        tips.push('Ensure adequate protein intake for muscle recovery');
    }
    tips.push('Cool down and stretch after each workout');
    tips.push('Get enough sleep for optimal recovery');
    return tips.slice(0, 6);
}
export function getExercisesByType(type) {
    return EXERCISE_DATABASE.filter(ex => ex.workoutType === type);
}
export function getExercisesByMuscle(muscleGroup) {
    const muscleMap = {
        'chest': ['chest'],
        'back': ['back'],
        'shoulders': ['shoulders'],
        'biceps': ['biceps'],
        'triceps': ['triceps'],
        'core': ['core'],
        'legs': ['quadriceps', 'hamstrings', 'glutes', 'calves'],
        'quadriceps': ['quadriceps'],
        'hamstrings': ['hamstrings'],
        'glutes': ['glutes'],
        'calves': ['calves']
    };
    const targetMuscles = muscleMap[muscleGroup.toLowerCase()] || [];
    return EXERCISE_DATABASE.filter(ex => ex.muscleGroups.some(mg => targetMuscles.includes(mg)));
}
export function calculateProgress(profile) {
    const baseWorkouts = profile.daysPerWeek * 4;
    const baseMinutes = baseWorkouts * profile.timePerWorkout;
    const baseCalories = baseMinutes * 5;
    const achievements = [];
    if (profile.fitnessLevel === FitnessLevel.BEGINNER) {
        achievements.push('First Steps Award - Started your fitness journey!');
    }
    if (profile.goals.length >= 2) {
        achievements.push('Goal Setter - Multiple goals, one focused mind!');
    }
    if (profile.daysPerWeek >= 4) {
        achievements.push('Consistency King - Training 4+ days per week!');
    }
    return {
        date: new Date(),
        completedWorkouts: Math.floor(baseWorkouts * 0.7),
        totalMinutes: Math.floor(baseMinutes * 0.7),
        caloriesBurned: Math.floor(baseCalories * 0.7),
        achievements
    };
}
export function getFitnessTerm(term) {
    const terms = {
        'rep': 'One complete movement of an exercise (repetition)',
        'repetition': 'One complete movement of an exercise',
        'set': 'A group of consecutive reps performed without rest',
        'rm': 'Rep Max - the maximum weight you can lift for one rep',
        'hiit': 'High-Intensity Interval Training - alternating between intense bursts and rest periods',
        'supersets': 'Performing two exercises back-to-back without rest',
        'circuits': 'A series of exercises performed in rotation with minimal rest',
        'plyometrics': 'Explosive jumping exercises that build power',
        'domes': 'Delayed Onset Muscle Soreness - muscle pain appearing 24-72 hours after exercise',
        'tut': 'Time Under Tension - the total time a muscle is under strain during a set',
        'compound': 'Multi-joint movements that work multiple muscle groups',
        'isolation': 'Single-joint movements targeting one muscle group'
    };
    const normalizedTerm = term.toLowerCase().replace(/[^a-z]/g, '');
    for (const [key, definition] of Object.entries(terms)) {
        const normalizedKey = key.replace(/[^a-z]/g, '');
        if (normalizedKey.includes(normalizedTerm) || normalizedTerm.includes(normalizedKey)) {
            return { term: key.toUpperCase(), definition };
        }
    }
    return null;
}
//# sourceMappingURL=expertise.js.map
import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { fitnessExpert, FitnessLevel, WorkoutType, Equipment } from '../services/fitnessExpert.js';
import { detectFitnessIntent, getResponseForIntent } from '../intents/fitnessIntents.js';
import { createWorkoutPlan, getExercisesByType, getExercisesByMuscle, calculateProgress } from '../services/expertise.js';
import { getRecommendations, getRecoveryTips } from '../services/recommendations.js';
import { logger } from '../services/fitnessExpert.js';
import { EXERCISE_DATABASE } from '../config/knowledge.js';
const router = Router();
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors.map(e => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    }
                });
            }
            else {
                next(error);
            }
        }
    };
};
const userProfileSchema = z.object({
    id: z.string().optional(),
    fitnessLevel: z.nativeEnum(FitnessLevel),
    goals: z.array(z.string()),
    preferredWorkouts: z.array(z.nativeEnum(WorkoutType)),
    availableEquipment: z.array(z.nativeEnum(Equipment)),
    daysPerWeek: z.number().int().min(1).max(7),
    injuries: z.array(z.string()).optional(),
    timePerWorkout: z.number().int().min(15).max(180).optional().default(45)
});
const fitnessQuerySchema = z.object({
    sessionId: z.string().optional(),
    query: z.string().min(1).max(2000),
    userProfile: userProfileSchema.optional()
});
const workoutPlanSchema = z.object({
    sessionId: z.string().optional(),
    userProfile: userProfileSchema
});
const exerciseQuerySchema = z.object({
    type: z.nativeEnum(WorkoutType).optional(),
    muscleGroup: z.string().optional(),
    difficulty: z.nativeEnum(FitnessLevel).optional(),
    limit: z.number().int().min(1).max(20).optional().default(10)
});
const progressQuerySchema = z.object({
    userProfile: userProfileSchema
});
const recommendationQuerySchema = z.object({
    userProfile: userProfileSchema
});
router.post('/query', validateRequest(fitnessQuerySchema), async (req, res, next) => {
    try {
        const { sessionId: providedSessionId, query, userProfile } = req.body;
        const sessionId = providedSessionId || uuidv4();
        logger.info('Fitness query request received', { sessionId, queryLength: query.length });
        const profile = userProfile || {
            id: uuidv4(),
            fitnessLevel: FitnessLevel.INTERMEDIATE,
            goals: ['general fitness'],
            preferredWorkouts: [WorkoutType.STRENGTH],
            availableEquipment: [Equipment.NONE],
            daysPerWeek: 3,
            timePerWorkout: 45
        };
        const detectedIntent = detectFitnessIntent(query);
        if (detectedIntent) {
            const intentResponse = getResponseForIntent(detectedIntent);
            logger.info('Fitness intent detected', { sessionId, intent: detectedIntent });
            return res.json({
                success: true,
                data: {
                    response: intentResponse,
                    detectedIntent,
                    requiresContext: true
                },
                meta: {
                    sessionId,
                    timestamp: new Date().toISOString()
                }
            });
        }
        const response = await fitnessExpert.processQuery(query, profile, sessionId);
        res.json({
            success: true,
            data: {
                response: response.message,
                workoutPlan: response.workoutPlan,
                exercises: response.exercises,
                progress: response.progress,
                recommendations: response.recommendations,
                data: response.data
            },
            meta: {
                sessionId,
                processingTimeMs: response.processingTime,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger.error('Fitness query endpoint error', { error });
        next(error);
    }
});
router.post('/workout-plan', validateRequest(workoutPlanSchema), async (req, res, next) => {
    try {
        const { sessionId: providedSessionId, userProfile } = req.body;
        const sessionId = providedSessionId || uuidv4();
        logger.info('Workout plan request received', { sessionId, fitnessLevel: userProfile.fitnessLevel });
        const workoutPlan = createWorkoutPlan(userProfile);
        res.json({
            success: true,
            data: {
                workoutPlan,
                message: `Here is your personalized ${workoutPlan.name}! This ${workoutPlan.frequency} program is designed for ${userProfile.fitnessLevel} fitness levels with ${userProfile.daysPerWeek} days of training.`
            },
            meta: {
                sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger.error('Workout plan endpoint error', { error });
        next(error);
    }
});
router.post('/exercises', validateRequest(exerciseQuerySchema), async (req, res, next) => {
    try {
        const { type, muscleGroup, difficulty, limit } = req.body;
        let exercises;
        if (type) {
            exercises = getExercisesByType(type);
        }
        else if (muscleGroup) {
            exercises = getExercisesByMuscle(muscleGroup);
        }
        else {
            exercises = EXERCISE_DATABASE;
        }
        if (difficulty) {
            exercises = exercises.filter((e) => e.difficulty === difficulty);
        }
        const finalExercises = exercises.slice(0, limit);
        res.json({
            success: true,
            data: {
                exercises: finalExercises,
                count: finalExercises.length,
                filters: { type, muscleGroup, difficulty }
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger.error('Exercises endpoint error', { error });
        next(error);
    }
});
router.post('/progress', validateRequest(progressQuerySchema), async (req, res, next) => {
    try {
        const { userProfile } = req.body;
        logger.info('Progress request received', { userId: userProfile.id });
        const progress = calculateProgress(userProfile);
        res.json({
            success: true,
            data: {
                progress,
                message: `Great job staying consistent with your training! Here is your progress summary.`
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger.error('Progress endpoint error', { error });
        next(error);
    }
});
router.post('/recommendations', validateRequest(recommendationQuerySchema), async (req, res, next) => {
    try {
        const { userProfile } = req.body;
        logger.info('Recommendations request received', { userId: userProfile.id });
        const recommendations = getRecommendations(userProfile);
        const recoveryTips = getRecoveryTips();
        res.json({
            success: true,
            data: {
                recommendations,
                recoveryTips,
                message: 'Here are personalized recommendations based on your fitness profile!'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger.error('Recommendations endpoint error', { error });
        next(error);
    }
});
router.get('/intent/:query', async (req, res) => {
    const { query } = req.params;
    const intent = detectFitnessIntent(decodeURIComponent(query));
    const response = intent ? getResponseForIntent(intent) : 'No specific fitness intent detected. Feel free to ask about workouts, exercises, or fitness in general!';
    res.json({
        success: true,
        data: {
            query: decodeURIComponent(query),
            detectedIntent: intent,
            suggestedResponse: response
        }
    });
});
router.get('/workout-types', async (req, res) => {
    const types = Object.values(WorkoutType).map(type => ({
        value: type,
        label: formatLabel(type),
        description: getWorkoutTypeDescription(type)
    }));
    res.json({
        success: true,
        data: { workoutTypes: types }
    });
});
router.get('/fitness-levels', async (req, res) => {
    const levels = Object.values(FitnessLevel).map(level => ({
        value: level,
        label: formatLabel(level),
        description: getFitnessLevelDescription(level)
    }));
    res.json({
        success: true,
        data: { fitnessLevels: levels }
    });
});
router.get('/equipment', async (req, res) => {
    const equipment = Object.values(Equipment).map(eq => ({
        value: eq,
        label: formatLabel(eq),
        description: getEquipmentDescription(eq)
    }));
    res.json({
        success: true,
        data: { equipment }
    });
});
function formatLabel(value) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
function getWorkoutTypeDescription(type) {
    const descriptions = {
        [WorkoutType.STRENGTH]: 'Build muscle and increase power through resistance training',
        [WorkoutType.CARDIO]: 'Improve heart health and endurance with aerobic exercises',
        [WorkoutType.HIIT]: 'Burn calories fast with alternating high and low intensity intervals',
        [WorkoutType.FLEXIBILITY]: 'Improve range of motion and prevent injury through stretching',
        [WorkoutType.ENDURANCE]: 'Build stamina for prolonged physical activity',
        [WorkoutType.FUNCTIONAL]: 'Train movements that help in everyday life',
        [WorkoutType.SPORT_SPECIFIC]: 'Target skills and conditioning for a particular sport',
        [WorkoutType.CROSSFIT]: 'High-intensity functional training with varied workouts',
        [WorkoutType.YOGA]: 'Mind-body practice combining poses, breathing, and meditation',
        [WorkoutType.PILATES]: 'Core-focused conditioning with controlled movements',
        [WorkoutType.CIRCUIT]: 'Fast-paced workout with stations and minimal rest',
        [WorkoutType.COMPOUND]: 'Multi-joint exercises working multiple muscle groups'
    };
    return descriptions[type];
}
function getFitnessLevelDescription(level) {
    const descriptions = {
        [FitnessLevel.BEGINNER]: 'New to exercise or returning after a long break. Focus on learning proper form and building consistency.',
        [FitnessLevel.INTERMEDIATE]: 'Have been training regularly for 6+ months. Ready to increase intensity and try new exercises.',
        [FitnessLevel.ADVANCED]: 'Experienced with years of training. Ready for complex programs and advanced techniques.'
    };
    return descriptions[level];
}
function getEquipmentDescription(eq) {
    const descriptions = {
        [Equipment.NONE]: 'Bodyweight only - no equipment needed',
        [Equipment.DUMBBELLS]: 'Versatile weights for strength training',
        [Equipment.BARBELL]: 'Long bar for compound strength exercises',
        [Equipment.CABLE_MACHINE]: 'Machine with adjustable resistance via cables',
        [Equipment.KETTLEBELL]: 'Cast iron weights with handles for dynamic movements',
        [Equipment.RESISTANCE_BANDS]: 'Elastic bands for variable resistance training',
        [Equipment.PULL_UP_BAR]: 'Horizontal bar for hanging exercises',
        [Equipment.BENCH]: 'Flat or adjustable surface for seated and prone exercises',
        [Equipment.ROWING_MACHINE]: 'Cardio equipment simulating rowing motion',
        [Equipment.TREADMILL]: 'Running/walking cardio machine',
        [Equipment.BICYCLE]: 'Stationary bike for cardio training',
        [Equipment.SQUAT_RACK]: 'Rack for barbell squats and related exercises'
    };
    return descriptions[eq];
}
export { router as fitnessRouter };
//# sourceMappingURL=fitness.routes.js.map
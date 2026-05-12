"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fitnessRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const fitnessExpert_1 = require("../services/fitnessExpert");
const fitnessIntents_1 = require("../intents/fitnessIntents");
const expertise_1 = require("../services/expertise");
const recommendations_1 = require("../services/recommendations");
const fitnessExpert_2 = require("../services/fitnessExpert");
const router = (0, express_1.Router)();
exports.fitnessRouter = router;
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({
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
            next(error);
        }
    };
};
const userProfileSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    fitnessLevel: zod_1.z.nativeEnum(fitnessExpert_1.FitnessLevel),
    goals: zod_1.z.array(zod_1.z.string()),
    preferredWorkouts: zod_1.z.array(zod_1.z.nativeEnum(fitnessExpert_1.WorkoutType)),
    availableEquipment: zod_1.z.array(zod_1.z.nativeEnum(fitnessExpert_1.Equipment)),
    daysPerWeek: zod_1.z.number().int().min(1).max(7),
    injuries: zod_1.z.array(zod_1.z.string()).optional(),
    timePerWorkout: zod_1.z.number().int().min(15).max(180).optional().default(45)
});
const fitnessQuerySchema = zod_1.z.object({
    sessionId: zod_1.z.string().optional(),
    query: zod_1.z.string().min(1).max(2000),
    userProfile: userProfileSchema.optional()
});
const workoutPlanSchema = zod_1.z.object({
    sessionId: zod_1.z.string().optional(),
    userProfile: userProfileSchema
});
const exerciseQuerySchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(fitnessExpert_1.WorkoutType).optional(),
    muscleGroup: zod_1.z.string().optional(),
    difficulty: zod_1.z.nativeEnum(fitnessExpert_1.FitnessLevel).optional(),
    limit: zod_1.z.number().int().min(1).max(20).optional().default(10)
});
const progressQuerySchema = zod_1.z.object({
    userProfile: userProfileSchema
});
const recommendationQuerySchema = zod_1.z.object({
    userProfile: userProfileSchema
});
router.post('/query', validateRequest(fitnessQuerySchema), async (req, res, next) => {
    try {
        const { sessionId: providedSessionId, query, userProfile } = req.body;
        const sessionId = providedSessionId || (0, uuid_1.v4)();
        fitnessExpert_2.logger.info('Fitness query request received', { sessionId, queryLength: query.length });
        const profile = userProfile || {
            id: (0, uuid_1.v4)(),
            fitnessLevel: fitnessExpert_1.FitnessLevel.INTERMEDIATE,
            goals: ['general fitness'],
            preferredWorkouts: [fitnessExpert_1.WorkoutType.STRENGTH],
            availableEquipment: [fitnessExpert_1.Equipment.NONE],
            daysPerWeek: 3,
            timePerWorkout: 45
        };
        const detectedIntent = (0, fitnessIntents_1.detectFitnessIntent)(query);
        if (detectedIntent) {
            const intentResponse = (0, fitnessIntents_1.getResponseForIntent)(detectedIntent);
            fitnessExpert_2.logger.info('Fitness intent detected', { sessionId, intent: detectedIntent });
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
        const response = await fitnessExpert_1.fitnessExpert.processQuery(query, profile, sessionId);
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
        fitnessExpert_2.logger.error('Fitness query endpoint error', { error });
        next(error);
    }
});
router.post('/workout-plan', validateRequest(workoutPlanSchema), async (req, res, next) => {
    try {
        const { sessionId: providedSessionId, userProfile } = req.body;
        const sessionId = providedSessionId || (0, uuid_1.v4)();
        fitnessExpert_2.logger.info('Workout plan request received', { sessionId, fitnessLevel: userProfile.fitnessLevel });
        const workoutPlan = (0, expertise_1.createWorkoutPlan)(userProfile);
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
        fitnessExpert_2.logger.error('Workout plan endpoint error', { error });
        next(error);
    }
});
router.post('/exercises', validateRequest(exerciseQuerySchema), async (req, res, next) => {
    try {
        const { type, muscleGroup, difficulty, limit } = req.body;
        let exercises;
        if (type) {
            exercises = (0, expertise_1.getExercisesByType)(type);
        }
        else if (muscleGroup) {
            exercises = (0, expertise_1.getExercisesByMuscle)(muscleGroup);
        }
        else {
            const { EXERCISE_DATABASE } = require('../config/knowledge');
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
        fitnessExpert_2.logger.error('Exercises endpoint error', { error });
        next(error);
    }
});
router.post('/progress', validateRequest(progressQuerySchema), async (req, res, next) => {
    try {
        const { userProfile } = req.body;
        fitnessExpert_2.logger.info('Progress request received', { userId: userProfile.id });
        const progress = (0, expertise_1.calculateProgress)(userProfile);
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
        fitnessExpert_2.logger.error('Progress endpoint error', { error });
        next(error);
    }
});
router.post('/recommendations', validateRequest(recommendationQuerySchema), async (req, res, next) => {
    try {
        const { userProfile } = req.body;
        fitnessExpert_2.logger.info('Recommendations request received', { userId: userProfile.id });
        const recommendations = (0, recommendations_1.getRecommendations)(userProfile);
        const recoveryTips = (0, recommendations_1.getRecoveryTips)();
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
        fitnessExpert_2.logger.error('Recommendations endpoint error', { error });
        next(error);
    }
});
router.get('/intent/:query', async (req, res) => {
    const { query } = req.params;
    const intent = (0, fitnessIntents_1.detectFitnessIntent)(decodeURIComponent(query));
    const response = intent ? (0, fitnessIntents_1.getResponseForIntent)(intent) : 'No specific fitness intent detected. Feel free to ask about workouts, exercises, or fitness in general!';
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
    const types = Object.values(fitnessExpert_1.WorkoutType).map(type => ({
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
    const levels = Object.values(fitnessExpert_1.FitnessLevel).map(level => ({
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
    const equipment = Object.values(fitnessExpert_1.Equipment).map(eq => ({
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
        [fitnessExpert_1.WorkoutType.STRENGTH]: 'Build muscle and increase power through resistance training',
        [fitnessExpert_1.WorkoutType.CARDIO]: 'Improve heart health and endurance with aerobic exercises',
        [fitnessExpert_1.WorkoutType.HIIT]: 'Burn calories fast with alternating high and low intensity intervals',
        [fitnessExpert_1.WorkoutType.FLEXIBILITY]: 'Improve range of motion and prevent injury through stretching',
        [fitnessExpert_1.WorkoutType.ENDURANCE]: 'Build stamina for prolonged physical activity',
        [fitnessExpert_1.WorkoutType.FUNCTIONAL]: 'Train movements that help in everyday life',
        [fitnessExpert_1.WorkoutType.SPORT_SPECIFIC]: 'Target skills and conditioning for a particular sport',
        [fitnessExpert_1.WorkoutType.CROSSFIT]: 'High-intensity functional training with varied workouts',
        [fitnessExpert_1.WorkoutType.YOGA]: 'Mind-body practice combining poses, breathing, and meditation',
        [fitnessExpert_1.WorkoutType.PILATES]: 'Core-focused conditioning with controlled movements',
        [fitnessExpert_1.WorkoutType.CIRCUIT]: 'Fast-paced workout with stations and minimal rest',
        [fitnessExpert_1.WorkoutType.COMPOUND]: 'Multi-joint exercises working multiple muscle groups'
    };
    return descriptions[type];
}
function getFitnessLevelDescription(level) {
    const descriptions = {
        [fitnessExpert_1.FitnessLevel.BEGINNER]: 'New to exercise or returning after a long break. Focus on learning proper form and building consistency.',
        [fitnessExpert_1.FitnessLevel.INTERMEDIATE]: 'Have been training regularly for 6+ months. Ready to increase intensity and try new exercises.',
        [fitnessExpert_1.FitnessLevel.ADVANCED]: 'Experienced with years of training. Ready for complex programs and advanced techniques.'
    };
    return descriptions[level];
}
function getEquipmentDescription(eq) {
    const descriptions = {
        [fitnessExpert_1.Equipment.NONE]: 'Bodyweight only - no equipment needed',
        [fitnessExpert_1.Equipment.DUMBBELLS]: 'Versatile weights for strength training',
        [fitnessExpert_1.Equipment.BARBELL]: 'Long bar for compound strength exercises',
        [fitnessExpert_1.Equipment.CABLE_MACHINE]: 'Machine with adjustable resistance via cables',
        [fitnessExpert_1.Equipment.KETTLEBELL]: 'Cast iron weights with handles for dynamic movements',
        [fitnessExpert_1.Equipment.RESISTANCE_BANDS]: 'Elastic bands for variable resistance training',
        [fitnessExpert_1.Equipment.PULL_UP_BAR]: 'Horizontal bar for hanging exercises',
        [fitnessExpert_1.Equipment.BENCH]: 'Flat or adjustable surface for seated and prone exercises',
        [fitnessExpert_1.Equipment.ROWING_MACHINE]: 'Cardio equipment simulating rowing motion',
        [fitnessExpert_1.Equipment.TREADMILL]: 'Running/walking cardio machine',
        [fitnessExpert_1.Equipment.BICYCLE]: 'Stationary bike for cardio training',
        [fitnessExpert_1.Equipment.SQUAT_RACK]: 'Rack for barbell squats and related exercises'
    };
    return descriptions[eq];
}
//# sourceMappingURL=fitness.routes.js.map
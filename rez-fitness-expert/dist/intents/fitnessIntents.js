"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FITNESS_INTENT_PATTERNS = exports.FitnessIntent = void 0;
exports.detectFitnessIntent = detectFitnessIntent;
exports.getResponseForIntent = getResponseForIntent;
exports.buildContextFromQuery = buildContextFromQuery;
const fitnessExpert_1 = require("../services/fitnessExpert");
var FitnessIntent;
(function (FitnessIntent) {
    FitnessIntent["WORKOUT_PLAN"] = "workout_plan";
    FitnessIntent["EXERCISE_INFO"] = "exercise_info";
    FitnessIntent["PROGRESS_TRACK"] = "progress_track";
    FitnessIntent["GOAL_SETTING"] = "goal_setting";
    FitnessIntent["NUTRITION_TIP"] = "nutrition_tip";
    FitnessIntent["RECOVERY_ADVICE"] = "recovery_advice";
    FitnessIntent["WARM_UP"] = "warm_up";
    FitnessIntent["COOL_DOWN"] = "cool_down";
    FitnessIntent["EQUIPMENT_QUESTION"] = "equipment_question";
    FitnessIntent["FORM_CORRECTION"] = "form_correction";
    FitnessIntent["MOTIVATION"] = "motivation";
    FitnessIntent["SCHEDULE_WORKOUT"] = "schedule_workout";
    FitnessIntent["WORKOUT_COMPLETION"] = "workout_completion";
    FitnessIntent["PERSONAL_BEST"] = "personal_best";
    FitnessIntent["BEGINNER_QUESTION"] = "beginner_question";
    FitnessIntent["MODIFICATION_REQUEST"] = "modification_request";
})(FitnessIntent || (exports.FitnessIntent = FitnessIntent = {}));
exports.FITNESS_INTENT_PATTERNS = [
    {
        intent: FitnessIntent.WORKOUT_PLAN,
        patterns: [
            'create a workout plan',
            'make me a workout',
            'design a routine',
            'build a program',
            'help me plan',
            'schedule my workouts',
            'what should i do today',
            'generate workout'
        ],
        keywords: ['workout plan', 'routine', 'program', 'schedule', 'design', 'create'],
        requiresContext: true
    },
    {
        intent: FitnessIntent.EXERCISE_INFO,
        patterns: [
            'how to do',
            'show me how',
            'demonstrate',
            'what is proper form',
            'explain exercise',
            'teach me',
            'instructions for'
        ],
        keywords: ['how to', 'show me', 'demonstrate', 'form', 'technique', 'perform', 'do'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.PROGRESS_TRACK,
        patterns: [
            'track my progress',
            'how am i doing',
            'my stats',
            'workout history',
            'progress update',
            'achievements',
            'milestones'
        ],
        keywords: ['progress', 'track', 'stats', 'history', 'achievement', 'milestone'],
        requiresContext: true
    },
    {
        intent: FitnessIntent.GOAL_SETTING,
        patterns: [
            'set a goal',
            'help me reach',
            'achieve my',
            'my fitness goal',
            'what should i focus on',
            'recommend goals'
        ],
        keywords: ['goal', 'achieve', 'focus', 'target', 'aim', 'reach'],
        requiresContext: true
    },
    {
        intent: FitnessIntent.RECOVERY_ADVICE,
        patterns: [
            'how to recover',
            'rest day',
            'soreness',
            'muscle recovery',
            'when to rest',
            'recovery tips'
        ],
        keywords: ['recovery', 'rest', 'soreness', 'heal', 'repair', 'recover'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.WARM_UP,
        patterns: [
            'warm up routine',
            'how to warm up',
            'prepare for workout',
            'warmup exercises',
            'pre workout'
        ],
        keywords: ['warm up', 'warmup', 'prepare', 'pre workout', 'get ready'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.COOL_DOWN,
        patterns: [
            'cool down routine',
            'post workout',
            'after workout',
            'stretch after',
            'end of workout'
        ],
        keywords: ['cool down', 'post workout', 'after', 'stretch', 'finish'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.EQUIPMENT_QUESTION,
        patterns: [
            'what equipment do i need',
            'can i do this without',
            'alternatives for',
            'substitute equipment',
            'home equipment'
        ],
        keywords: ['equipment', 'need', 'alternative', 'substitute', 'without', 'home'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.FORM_CORRECTION,
        patterns: [
            'am i doing this right',
            'fix my form',
            'common mistakes',
            'proper form for',
            'correct technique'
        ],
        keywords: ['form', 'correct', 'right', 'mistake', 'technique', 'proper'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.MOTIVATION,
        patterns: [
            'keep me motivated',
            'i feel tired',
            'i want to quit',
            'lose motivation',
            'encourage me',
            'inspire me'
        ],
        keywords: ['motivate', 'tired', 'quit', 'discourage', 'encourage', 'inspire', 'give up'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.BEGINNER_QUESTION,
        patterns: [
            'i am new',
            'just started',
            'first time',
            'never exercised',
            'beginner tip'
        ],
        keywords: ['new', 'beginner', 'first time', 'started', 'never', 'just started'],
        requiresContext: false
    },
    {
        intent: FitnessIntent.MODIFICATION_REQUEST,
        patterns: [
            'modify this',
            'make it easier',
            'make it harder',
            'adjust for',
            'scale this',
            'variation'
        ],
        keywords: ['modify', 'easier', 'harder', 'adjust', 'scale', 'variation', 'alternative'],
        requiresContext: true
    },
    {
        intent: FitnessIntent.PERSONAL_BEST,
        patterns: [
            'i hit a pr',
            'new record',
            'personal best',
            'beat my record',
            'achievement unlocked'
        ],
        keywords: ['pr', 'personal best', 'record', 'achievement', 'unlocked', 'hit'],
        requiresContext: true
    },
    {
        intent: FitnessIntent.WORKOUT_COMPLETION,
        patterns: [
            'finished workout',
            'completed my workout',
            'just worked out',
            'done training',
            'finished training'
        ],
        keywords: ['finished', 'completed', 'done', 'just worked out', 'just finished'],
        requiresContext: false
    }
];
function detectFitnessIntent(query) {
    const lowerQuery = query.toLowerCase();
    for (const pattern of exports.FITNESS_INTENT_PATTERNS) {
        for (const keyword of pattern.keywords) {
            if (lowerQuery.includes(keyword)) {
                return pattern.intent;
            }
        }
    }
    return null;
}
function getResponseForIntent(intent, context) {
    switch (intent) {
        case FitnessIntent.WORKOUT_PLAN:
            return 'I would love to create a personalized workout plan for you! To make it perfect, tell me about your fitness level, available equipment, and how many days per week you can train.';
        case FitnessIntent.EXERCISE_INFO:
            return 'Let me help you with that exercise! Could you tell me which specific exercise you need guidance on?';
        case FitnessIntent.PROGRESS_TRACK:
            return 'Tracking your progress is key to success! Let me pull up your workout history and see how far you have come!';
        case FitnessIntent.GOAL_SETTING:
            return 'Goals give us direction! What would you like to achieve? Build muscle, lose weight, improve endurance, or something else?';
        case FitnessIntent.RECOVERY_ADVICE:
            return 'Recovery is just as important as training! Here are some key recovery strategies:\n\n1. **Sleep** - Aim for 7-9 hours\n2. **Hydration** - Drink plenty of water\n3. **Nutrition** - Fuel your recovery with protein and carbs\n4. **Active Recovery** - Light movement helps blood flow';
        case FitnessIntent.WARM_UP:
            return 'Great question! A proper warm-up is essential:\n\n1. **Light cardio** - 5 minutes of jumping jacks or light jogging\n2. **Dynamic stretches** - Arm circles, leg swings, hip circles\n3. **Specific warm-up** - Do 1-2 easy sets of your first exercise';
        case FitnessIntent.COOL_DOWN:
            return 'Cool down properly to maximize recovery:\n\n1. **Light walking** - 3-5 minutes to lower heart rate\n2. **Static stretching** - Hold each stretch for 30-60 seconds\n3. **Deep breathing** - Helps activate the parasympathetic system';
        case FitnessIntent.EQUIPMENT_QUESTION:
            return 'Good news - most exercises can be modified! Bodyweight exercises are incredibly effective. Let me suggest alternatives based on what you have available.';
        case FitnessIntent.FORM_CORRECTION:
            return 'Proper form is crucial for results and injury prevention! Here are the most common form mistakes:\n\n- Rounded back during deadlifts\n- Knees caving in on squats\n- Flaring elbows on bench press\n\nWhat exercise would you like form tips for?';
        case FitnessIntent.MOTIVATION:
            return 'I understand - we all have those days! But remember:\n\nYou showed up today, and that is what matters!\nProgress is not always visible, but it is happening.\nEvery workout makes you stronger than before.\nYou are closer to your goal than yesterday!\n\nWhat is your goal again? Let us remind ourselves why we started!';
        case FitnessIntent.BEGINNER_QUESTION:
            return 'Welcome to the fitness journey! My top tips for beginners:\n\n1. Start slow and focus on form\n2. Consistency beats intensity\n3. Rest is part of training\n4. Track your progress\n5. Celebrate small wins\n\nYou have got this!';
        case FitnessIntent.MODIFICATION_REQUEST:
            return 'I love that you want to adjust your workout! I can make exercises easier (beginner modifications) or harder (advanced variations). What is your current fitness level?';
        case FitnessIntent.PERSONAL_BEST:
            return 'AMAZING! Congratulations on hitting a personal best! That is incredible progress!\n\nThis is exactly why we train - to get stronger, faster, better!\nYour dedication is paying off!\n\nCelebrate this win! What PR did you achieve?';
        case FitnessIntent.WORKOUT_COMPLETION:
            return 'GREAT JOB completing your workout! You crushed it today!\n\nRemember to:\n- Cool down and stretch\n- Hydrate well\n- Get protein within 30-60 minutes\n- Celebrate your effort!\n\nSee you at the next workout!';
        default:
            return 'I am here to help with all your fitness needs! Ask me about workouts, exercises, form, motivation, or anything fitness-related!';
    }
}
function buildContextFromQuery(query, context) {
    const lowerQuery = query.toLowerCase();
    const workoutTypes = [];
    if (lowerQuery.includes('strength') || lowerQuery.includes('weight')) {
        workoutTypes.push(fitnessExpert_1.WorkoutType.STRENGTH);
    }
    if (lowerQuery.includes('cardio') || lowerQuery.includes('running') || lowerQuery.includes('jogging')) {
        workoutTypes.push(fitnessExpert_1.WorkoutType.CARDIO);
    }
    if (lowerQuery.includes('hiit')) {
        workoutTypes.push(fitnessExpert_1.WorkoutType.HIIT);
    }
    if (lowerQuery.includes('yoga') || lowerQuery.includes('stretch')) {
        workoutTypes.push(fitnessExpert_1.WorkoutType.FLEXIBILITY);
    }
    return {
        ...context,
        userPreferences: context.userPreferences ? {
            ...context.userPreferences,
            preferredWorkoutTypes: workoutTypes.length > 0 ? workoutTypes : context.userPreferences.preferredWorkoutTypes
        } : undefined
    };
}
//# sourceMappingURL=fitnessIntents.js.map
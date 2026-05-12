"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECOVERY_RECOMMENDATIONS = exports.COOL_DOWN_EXERCISES = exports.WARM_UP_EXERCISES = exports.FITNESS_GLOSSARY = exports.EXERCISE_DATABASE = exports.Equipment = exports.MuscleGroup = exports.FitnessLevel = exports.WorkoutType = void 0;
var WorkoutType;
(function (WorkoutType) {
    WorkoutType["STRENGTH"] = "strength";
    WorkoutType["CARDIO"] = "cardio";
    WorkoutType["HIIT"] = "hiit";
    WorkoutType["FLEXIBILITY"] = "flexibility";
    WorkoutType["ENDURANCE"] = "endurance";
    WorkoutType["FUNCTIONAL"] = "functional";
    WorkoutType["SPORT_SPECIFIC"] = "sport_specific";
    WorkoutType["CROSSFIT"] = "crossfit";
    WorkoutType["YOGA"] = "yoga";
    WorkoutType["PILATES"] = "pilates";
    WorkoutType["CIRCUIT"] = "circuit";
    WorkoutType["COMPOUND"] = "compound";
})(WorkoutType || (exports.WorkoutType = WorkoutType = {}));
var FitnessLevel;
(function (FitnessLevel) {
    FitnessLevel["BEGINNER"] = "beginner";
    FitnessLevel["INTERMEDIATE"] = "intermediate";
    FitnessLevel["ADVANCED"] = "advanced";
})(FitnessLevel || (exports.FitnessLevel = FitnessLevel = {}));
var MuscleGroup;
(function (MuscleGroup) {
    MuscleGroup["CHEST"] = "chest";
    MuscleGroup["BACK"] = "back";
    MuscleGroup["SHOULDERS"] = "shoulders";
    MuscleGroup["BICEPS"] = "biceps";
    MuscleGroup["TRICEPS"] = "triceps";
    MuscleGroup["FOREARMS"] = "forearms";
    MuscleGroup["CORE"] = "core";
    MuscleGroup["QUADRICEPS"] = "quadriceps";
    MuscleGroup["HAMSTRINGS"] = "hamstrings";
    MuscleGroup["GLUTES"] = "glutes";
    MuscleGroup["CALVES"] = "calves";
    MuscleGroup["FULL_BODY"] = "full_body";
})(MuscleGroup || (exports.MuscleGroup = MuscleGroup = {}));
var Equipment;
(function (Equipment) {
    Equipment["NONE"] = "none";
    Equipment["DUMBBELLS"] = "dumbbells";
    Equipment["BARBELL"] = "barbell";
    Equipment["CABLE_MACHINE"] = "cable_machine";
    Equipment["KETTLEBELL"] = "kettlebell";
    Equipment["RESISTANCE_BANDS"] = "resistance_bands";
    Equipment["PULL_UP_BAR"] = "pull_up_bar";
    Equipment["BENCH"] = "bench";
    Equipment["ROWING_MACHINE"] = "rowing_machine";
    Equipment["TREADMILL"] = "treadmill";
    Equipment["BICYCLE"] = "bicycle";
    Equipment["SQUAT_RACK"] = "squat_rack";
})(Equipment || (exports.Equipment = Equipment = {}));
exports.EXERCISE_DATABASE = [
    {
        id: 'push-up',
        name: 'Push-Up',
        description: 'A classic bodyweight exercise that targets chest, shoulders, and triceps.',
        muscleGroups: [MuscleGroup.CHEST, MuscleGroup.SHOULDERS, MuscleGroup.TRICEPS],
        workoutType: WorkoutType.STRENGTH,
        equipment: [Equipment.NONE],
        difficulty: FitnessLevel.BEGINNER,
        instructions: [
            'Start in a plank position with hands shoulder-width apart',
            'Keep your body in a straight line from head to heels',
            'Lower your chest toward the floor by bending your elbows',
            'Push back up to the starting position',
            'Repeat for desired reps'
        ],
        tips: [
            'Keep your core engaged throughout',
            'Don\'t let your hips sag or pike up',
            'Breathe in as you lower, out as you push up'
        ],
        variations: ['Knee push-ups', 'Incline push-ups', 'Diamond push-ups', 'Decline push-ups'],
        benefits: ['Builds upper body strength', 'No equipment needed', 'Improves core stability']
    },
    {
        id: 'squat',
        name: 'Bodyweight Squat',
        description: 'Fundamental lower body exercise targeting quads, glutes, and hamstrings.',
        muscleGroups: [MuscleGroup.QUADRICEPS, MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS],
        workoutType: WorkoutType.STRENGTH,
        equipment: [Equipment.NONE],
        difficulty: FitnessLevel.BEGINNER,
        instructions: [
            'Stand with feet shoulder-width apart, toes slightly turned out',
            'Keep your chest up and core engaged',
            'Lower your hips back and down as if sitting in a chair',
            'Keep your knees tracking over your toes',
            'Lower until thighs are parallel to the ground',
            'Push through your heels to return to standing'
        ],
        tips: [
            'Keep weight in your heels',
            'Imagine spreading the floor apart with your feet',
            'Maintain a neutral spine throughout'
        ],
        variations: ['Goblet squat', 'Sumo squat', 'Split squat', 'Jump squat'],
        benefits: ['Strengthens legs and glutes', 'Improves mobility', 'Functional movement']
    },
    {
        id: 'plank',
        name: 'Plank',
        description: 'Isometric core exercise that builds stability and strength.',
        muscleGroups: [MuscleGroup.CORE],
        workoutType: WorkoutType.STRENGTH,
        equipment: [Equipment.NONE],
        difficulty: FitnessLevel.BEGINNER,
        instructions: [
            'Start in a push-up position on your forearms',
            'Keep elbows directly under shoulders',
            'Maintain a straight line from head to heels',
            'Engage your core and squeeze your glutes',
            'Hold for the prescribed duration'
        ],
        tips: [
            'Don\'t let your lower back sag',
            'Keep your neck in neutral position',
            'Breathe steadily throughout'
        ],
        variations: ['Side plank', 'Plank with shoulder taps', 'Plank with leg lifts'],
        benefits: ['Core strengthening', 'Back protection', 'Improved posture']
    },
    {
        id: 'burpee',
        name: 'Burpee',
        description: 'Full-body explosive movement that combines squat, plank, and jump.',
        muscleGroups: [MuscleGroup.FULL_BODY],
        workoutType: WorkoutType.HIIT,
        equipment: [Equipment.NONE],
        difficulty: FitnessLevel.INTERMEDIATE,
        instructions: [
            'Start standing with feet shoulder-width apart',
            'Drop into a squat and place hands on the floor',
            'Jump feet back into a plank position',
            'Perform a push-up (optional)',
            'Jump feet back to squat position',
            'Explode up with a jump, reaching arms overhead'
        ],
        tips: [
            'Keep the movement controlled at first',
            'Land softly on your feet',
            'Modify by stepping back instead of jumping'
        ],
        variations: ['No push-up burpee', 'Burpee with tuck jump', 'Single-leg burpee'],
        benefits: ['High calorie burn', 'Full-body workout', 'Builds endurance']
    },
    {
        id: 'deadlift',
        name: 'Barbell Deadlift',
        description: 'Compound movement targeting posterior chain - back, glutes, and hamstrings.',
        muscleGroups: [MuscleGroup.BACK, MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS],
        workoutType: WorkoutType.STRENGTH,
        equipment: [Equipment.BARBELL],
        difficulty: FitnessLevel.INTERMEDIATE,
        instructions: [
            'Stand with feet hip-width apart, barbell over mid-foot',
            'Hinge at hips and grip bar just outside shoulder width',
            'Keep chest up and back flat',
            'Drive through heels, extending hips and knees simultaneously',
            'Stand tall with shoulders back',
            'Lower bar by hinging at hips, maintaining control'
        ],
        tips: [
            'Keep the bar close to your body',
            'Engage your lats before lifting',
            'Never round your lower back'
        ],
        variations: ['Romanian deadlift', 'Sumo deadlift', 'Trap bar deadlift'],
        benefits: ['Builds total body strength', 'Improves posture', 'Functional power']
    },
    {
        id: 'lunges',
        name: 'Walking Lunges',
        description: 'Unilateral leg exercise that improves balance and strength.',
        muscleGroups: [MuscleGroup.QUADRICEPS, MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS],
        workoutType: WorkoutType.STRENGTH,
        equipment: [Equipment.NONE],
        difficulty: FitnessLevel.BEGINNER,
        instructions: [
            'Stand with feet hip-width apart',
            'Step forward with one leg',
            'Lower your body until both knees are at 90 degrees',
            'Front knee should be over ankle, back knee hovering above ground',
            'Push through front heel to step forward',
            'Continue alternating legs while walking'
        ],
        tips: [
            'Keep torso upright',
            'Take controlled, even steps',
            'Don\'t let front knee cave inward'
        ],
        variations: ['Reverse lunges', 'Side lunges', 'Jump lunges', 'Weighted lunges'],
        benefits: ['Balances muscle development', 'Improves coordination', 'Strengthens legs']
    },
    {
        id: 'mountain-climbers',
        name: 'Mountain Climbers',
        description: 'Dynamic cardio exercise that also strengthens core and shoulders.',
        muscleGroups: [MuscleGroup.CORE, MuscleGroup.SHOULDERS],
        workoutType: WorkoutType.CARDIO,
        equipment: [Equipment.NONE],
        difficulty: FitnessLevel.BEGINNER,
        instructions: [
            'Start in a high plank position',
            'Drive one knee toward your chest',
            'Quickly switch legs, extending the first leg back',
            'Continue alternating at a rapid pace',
            'Keep hips level and core engaged'
        ],
        tips: [
            'Maintain a steady breathing pattern',
            'Keep movements controlled despite speed',
            'Focus on quick leg switches'
        ],
        variations: ['Slow mountain climbers', 'Cross-body mountain climbers', 'Double-time mountain climbers'],
        benefits: ['Cardio conditioning', 'Core engagement', 'Full-body movement']
    },
    {
        id: 'jumping-jacks',
        name: 'Jumping Jacks',
        description: 'Classic cardio exercise that elevates heart rate and works multiple muscle groups.',
        muscleGroups: [MuscleGroup.FULL_BODY],
        workoutType: WorkoutType.CARDIO,
        equipment: [Equipment.NONE],
        difficulty: FitnessLevel.BEGINNER,
        instructions: [
            'Stand with feet together, arms at sides',
            'Jump while spreading legs shoulder-width',
            'Simultaneously raise arms overhead',
            'Jump back to starting position',
            'Repeat at a steady pace'
        ],
        tips: [
            'Land softly on the balls of your feet',
            'Keep a consistent rhythm',
            'Inhale on the opening, exhale on the closing'
        ],
        variations: ['Power jacks', 'Squat jacks', 'High-knee jacks'],
        benefits: ['Warms up the body', 'Improves coordination', 'Increases heart rate']
    }
];
exports.FITNESS_GLOSSARY = [
    { term: 'Rep (Repetition)', definition: 'One complete movement of an exercise', category: 'basics' },
    { term: 'Set', definition: 'A group of consecutive reps performed without rest', category: 'basics' },
    { term: 'RM (Rep Max)', definition: 'The maximum weight you can lift for one rep', category: 'strength' },
    { term: 'Superset', definition: 'Performing two exercises back-to-back without rest', category: 'techniques' },
    { term: 'Circuit', definition: 'A series of exercises performed in rotation with minimal rest', category: 'techniques' },
    { term: 'Progressive Overload', definition: 'Gradually increasing weight, reps, or intensity over time', category: 'principles' },
    { term: 'Time Under Tension (TUT)', definition: 'The total time a muscle is under strain during a set', category: 'techniques' },
    { term: 'HIIT', definition: 'High-Intensity Interval Training - alternating between intense bursts and rest', category: 'cardio' },
    { term: 'Active Recovery', definition: 'Low-intensity exercise between intense efforts', category: 'recovery' },
    { term: 'DOMS', definition: 'Delayed Onset Muscle Soreness - muscle pain appearing 24-72 hours after exercise', category: 'recovery' },
    { term: 'Compound Exercise', definition: 'Multi-joint movements that work multiple muscle groups', category: 'strength' },
    { term: 'Isolation Exercise', definition: 'Single-joint movements targeting one muscle group', category: 'strength' },
    { term: 'Plyometrics', definition: 'Explosive jumping exercises that build power', category: 'cardio' },
    { term: 'Periodization', definition: 'Systematic planning of training phases over time', category: 'principles' },
    { term: 'RPE (Rate of Perceived Exertion)', definition: 'A subjective scale from 1-10 measuring exercise intensity', category: 'metrics' },
    { term: 'Macros', definition: 'Macronutrients - protein, carbs, and fats in your diet', category: 'nutrition' },
    { term: 'Rest Period', definition: 'Time allocated between sets or exercises', category: 'recovery' },
    { term: 'Cool Down', definition: 'Post-workout activity to gradually reduce heart rate', category: 'recovery' },
    { term: 'Warming Up', definition: 'Pre-workout activity to prepare body for exercise', category: 'recovery' },
    { term: 'Muscle Hypertrophy', definition: 'Muscle growth resulting from resistance training', category: 'principles' }
];
exports.WARM_UP_EXERCISES = [
    { name: 'Light jogging', duration: '3-5 minutes', purpose: 'Increase heart rate and body temperature' },
    { name: 'Jumping jacks', duration: '30 seconds', purpose: 'Full body activation' },
    { name: 'Arm circles', duration: '30 seconds each direction', purpose: 'Shoulder mobility' },
    { name: 'Leg swings', duration: '30 seconds each leg', purpose: 'Hip mobility' },
    { name: 'Bodyweight squats', duration: '10-15 reps', purpose: 'Lower body activation' },
    { name: 'Hip circles', duration: '30 seconds each direction', purpose: 'Hip mobility' },
    { name: 'Torso twists', duration: '30 seconds', purpose: 'Spinal mobility' }
];
exports.COOL_DOWN_EXERCISES = [
    { name: 'Light walking', duration: '3-5 minutes', purpose: 'Gradually lower heart rate' },
    { name: 'Static stretching', duration: '30-60 seconds per stretch', purpose: 'Improve flexibility and reduce tension' },
    { name: 'Foam rolling', duration: '5-10 minutes', purpose: 'Myofascial release and recovery' },
    { name: 'Deep breathing', duration: '2-3 minutes', purpose: 'Activate parasympathetic nervous system' }
];
exports.RECOVERY_RECOMMENDATIONS = [
    'Adequate sleep (7-9 hours for adults)',
    'Proper hydration (at least 8 glasses of water daily)',
    'Balanced nutrition with sufficient protein',
    'Rest days between intense workouts',
    'Active recovery (light walking, swimming)',
    'Stretching and mobility work',
    'Managing stress levels',
    'Listening to your body'
];
//# sourceMappingURL=knowledge.js.map
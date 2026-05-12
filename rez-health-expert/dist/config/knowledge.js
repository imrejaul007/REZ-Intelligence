"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RED_FLAG_CHECKLIST = exports.HEALTH_GLOSSARY = exports.WELLNESS_TIPS = exports.SYMPTOM_DATABASE = exports.SpecialtyType = exports.AppointmentType = exports.UrgencyLevel = exports.SeverityLevel = exports.SymptomCategory = void 0;
var SymptomCategory;
(function (SymptomCategory) {
    SymptomCategory["RESPIRATORY"] = "respiratory";
    SymptomCategory["DIGESTIVE"] = "digestive";
    SymptomCategory["CARDIOVASCULAR"] = "cardiovascular";
    SymptomCategory["MUSCULOSKELETAL"] = "musculoskeletal";
    SymptomCategory["NEUROLOGICAL"] = "neurological";
    SymptomCategory["DERMATOLOGICAL"] = "dermatological";
    SymptomCategory["MENTAL_HEALTH"] = "mental_health";
    SymptomCategory["PAIN"] = "pain";
    SymptomCategory["FATIGUE"] = "fatigue";
    SymptomCategory["GENERAL"] = "general";
})(SymptomCategory || (exports.SymptomCategory = SymptomCategory = {}));
var SeverityLevel;
(function (SeverityLevel) {
    SeverityLevel["MINOR"] = "minor";
    SeverityLevel["MODERATE"] = "moderate";
    SeverityLevel["SEVERE"] = "severe";
    SeverityLevel["URGENT"] = "urgent";
})(SeverityLevel || (exports.SeverityLevel = SeverityLevel = {}));
var UrgencyLevel;
(function (UrgencyLevel) {
    UrgencyLevel["SELF_CARE"] = "self_care";
    UrgencyLevel["SCHEDULE_VISIT"] = "schedule_visit";
    UrgencyLevel["SAME_DAY_APPOINTMENT"] = "same_day_appointment";
    UrgencyLevel["URGENT_CARE"] = "urgent_care";
    UrgencyLevel["EMERGENCY"] = "emergency";
})(UrgencyLevel || (exports.UrgencyLevel = UrgencyLevel = {}));
var AppointmentType;
(function (AppointmentType) {
    AppointmentType["PRIMARY_CARE"] = "primary_care";
    AppointmentType["SPECIALIST"] = "specialist";
    AppointmentType["URGENT_CARE"] = "urgent_care";
    AppointmentType["EMERGENCY"] = "emergency";
    AppointmentType["TELEMEDICINE"] = "telemedicine";
    AppointmentType["WELLNESS_CHECK"] = "wellness_check";
    AppointmentType["FOLLOW_UP"] = "follow_up";
})(AppointmentType || (exports.AppointmentType = AppointmentType = {}));
var SpecialtyType;
(function (SpecialtyType) {
    SpecialtyType["GENERAL_MEDICINE"] = "general_medicine";
    SpecialtyType["INTERNAL_MEDICINE"] = "internal_medicine";
    SpecialtyType["FAMILY_MEDICINE"] = "family_medicine";
    SpecialtyType["PEDIATRICS"] = "pediatrics";
    SpecialtyType["CARDIOLOGY"] = "cardiology";
    SpecialtyType["DERMATOLOGY"] = "dermatology";
    SpecialtyType["ORTHOPEDICS"] = "orthopedics";
    SpecialtyType["NEUROLOGY"] = "neurology";
    SpecialtyType["GASTROENTEROLOGY"] = "gastroenterology";
    SpecialtyType["PULMONOLOGY"] = "pulmonology";
    SpecialtyType["MENTAL_HEALTH"] = "mental_health";
    SpecialtyType["GYNECOLOGY"] = "gynecology";
    SpecialtyType["UROLOGY"] = "urology";
    SpecialtyType["ENDOCRINOLOGY"] = "endocrinology";
    SpecialtyType["RHEUMATOLOGY"] = "rheumatology";
    SpecialtyType["ALLERGY_IMMUNOLOGY"] = "allergy_immunology";
})(SpecialtyType || (exports.SpecialtyType = SpecialtyType = {}));
exports.SYMPTOM_DATABASE = [
    {
        name: 'Headache',
        description: 'Pain or discomfort in the head, scalp, or neck region',
        category: SymptomCategory.NEUROLOGICAL,
        possibleCauses: ['Tension', 'Dehydration', 'Lack of sleep', 'Stress', 'Sinus issues', 'Migraine', 'Eye strain'],
        selfCareTips: [
            'Rest in a quiet, dark room',
            'Stay hydrated with water',
            'Try over-the-counter pain relievers as directed',
            'Apply a cold or warm compress',
            'Practice deep breathing and relaxation',
            'Ensure adequate sleep (7-9 hours)'
        ],
        whenToSeekCare: 'If headaches are severe, frequent, or accompanied by fever, stiff neck, confusion, or vision changes',
        urgencyLevel: UrgencyLevel.SCHEDULE_VISIT,
        associatedSymptoms: ['Sensitivity to light', 'Nausea', 'Fatigue'],
        redFlags: ['Sudden severe headache', 'Headache with fever and stiff neck', 'Headache with confusion', 'Headache after head injury', 'Vision changes with headache']
    },
    {
        name: 'Cough',
        description: 'A reflex action that clears the airway of irritants',
        category: SymptomCategory.RESPIRATORY,
        possibleCauses: ['Common cold', 'Flu', 'Allergies', 'Asthma', 'GERD', 'Smoking', 'Infection', 'Postnasal drip'],
        selfCareTips: [
            'Stay hydrated with warm fluids',
            'Use honey (for adults and children over 1 year)',
            'Try a humidifier',
            'Avoid irritants like smoke',
            'Rest your voice',
            'Use OTC cough suppressants if needed'
        ],
        whenToSeekCare: 'If cough lasts more than 3 weeks, produces blood, or is accompanied by fever or difficulty breathing',
        urgencyLevel: UrgencyLevel.SCHEDULE_VISIT,
        associatedSymptoms: ['Sore throat', 'Runny nose', 'Fatigue', 'Chest congestion'],
        redFlags: ['Coughing up blood', 'Difficulty breathing', 'Wheezing', 'Fever lasting more than 3 days', 'Cough with unexplained weight loss']
    },
    {
        name: 'Fatigue',
        description: 'Persistent tiredness and lack of energy that does not improve with rest',
        category: SymptomCategory.FATIGUE,
        possibleCauses: ['Poor sleep', 'Stress', 'Anemia', 'Thyroid issues', 'Depression', 'Chronic fatigue syndrome', 'Medications', 'Poor diet'],
        selfCareTips: [
            'Ensure 7-9 hours of quality sleep',
            'Maintain a consistent sleep schedule',
            'Eat a balanced diet rich in nutrients',
            'Exercise regularly (even light walking helps)',
            'Manage stress through relaxation techniques',
            'Limit caffeine and alcohol',
            'Stay hydrated'
        ],
        whenToSeekCare: 'If fatigue is persistent for more than 2 weeks despite adequate rest, or is accompanied by other concerning symptoms',
        urgencyLevel: UrgencyLevel.SCHEDULE_VISIT,
        associatedSymptoms: ['Muscle weakness', 'Difficulty concentrating', 'Mood changes', 'Unexplained weight changes'],
        redFlags: ['Severe fatigue after minimal exertion', 'Fatigue with shortness of breath', 'Fatigue with unexplained bleeding', 'Mental confusion']
    },
    {
        name: 'Back Pain',
        description: 'Discomfort in the back, ranging from dull ache to sharp pain',
        category: SymptomCategory.MUSCULOSKELETAL,
        possibleCauses: ['Muscle strain', 'Poor posture', 'Herniated disc', 'Arthritis', 'Osteoporosis', 'Sedentary lifestyle', 'Improper lifting'],
        selfCareTips: [
            'Apply ice or heat to affected area',
            'Stay active with gentle movement',
            'Practice good posture',
            'Use proper lifting techniques',
            'Stretch regularly',
            'Consider ergonomic adjustments',
            'Over-the-counter pain relievers as directed'
        ],
        whenToSeekCare: 'If pain is severe, persists more than 2 weeks, or is accompanied by numbness, tingling, or weakness in legs',
        urgencyLevel: UrgencyLevel.SCHEDULE_VISIT,
        associatedSymptoms: ['Stiffness', 'Limited mobility', 'Muscle spasms'],
        redFlags: ['Back pain with bowel or bladder problems', 'Back pain with fever', 'Back pain after injury', 'Numbness in saddle area', 'Unexplained weight loss with back pain']
    },
    {
        name: 'Stomach Ache',
        description: 'Pain or discomfort in the abdominal area',
        category: SymptomCategory.DIGESTIVE,
        possibleCauses: ['Indigestion', 'Gas', 'Food poisoning', 'Stomach flu', 'IBS', 'Acid reflux', 'Ulcer', 'Stress'],
        selfCareTips: [
            'Rest and avoid strenuous activity',
            'Sip clear fluids',
            'Eat bland foods (BRAT diet)',
            'Avoid spicy, fatty, or dairy foods',
            'Apply a warm compress to abdomen',
            'Over-the-counter antacids if appropriate'
        ],
        whenToSeekCare: 'If pain is severe, localized, or accompanied by fever, vomiting, or changes in bowel habits',
        urgencyLevel: UrgencyLevel.SCHEDULE_VISIT,
        associatedSymptoms: ['Nausea', 'Vomiting', 'Diarrhea', 'Bloating', 'Loss of appetite'],
        redFlags: ['Severe abdominal pain', 'Vomiting blood', 'Black or bloody stools', 'High fever with abdominal pain', 'Signs of dehydration']
    },
    {
        name: 'Fever',
        description: 'Body temperature above normal (generally above 100.4°F or 38°C)',
        category: SymptomCategory.GENERAL,
        possibleCauses: ['Infection', 'Virus', 'Inflammation', 'Heat exhaustion', 'Immunizations', 'Certain medications'],
        selfCareTips: [
            'Stay hydrated',
            'Rest adequately',
            'Take fever-reducing medication as directed',
            'Wear light clothing',
            'Take a lukewarm bath',
            'Monitor temperature regularly'
        ],
        whenToSeekCare: 'If fever exceeds 103°F (39.4°C), lasts more than 3 days, or is accompanied by severe symptoms',
        urgencyLevel: UrgencyLevel.SAME_DAY_APPOINTMENT,
        associatedSymptoms: ['Sweating', 'Chills', 'Headache', 'Muscle aches', 'Dehydration'],
        redFlags: ['Fever over 104°F (40°C)', 'Fever with stiff neck', 'Fever with severe headache', 'Fever with rash', 'Seizures']
    },
    {
        name: 'Anxiety',
        description: 'Feelings of worry, nervousness, or unease about something with an uncertain outcome',
        category: SymptomCategory.MENTAL_HEALTH,
        possibleCauses: ['Stress', 'Genetics', 'Brain chemistry', 'Trauma', 'Health conditions', 'Substance use', 'Caffeine'],
        selfCareTips: [
            'Practice deep breathing exercises',
            'Engage in regular physical activity',
            'Limit caffeine and alcohol',
            'Get adequate sleep',
            'Try mindfulness and meditation',
            'Talk to someone you trust',
            'Challenge negative thoughts'
        ],
        whenToSeekCare: 'If anxiety interferes with daily life, causes panic attacks, or leads to avoidance behaviors',
        urgencyLevel: UrgencyLevel.SCHEDULE_VISIT,
        associatedSymptoms: ['Racing thoughts', 'Restlessness', 'Difficulty concentrating', 'Sleep problems', 'Muscle tension'],
        redFlags: ['Thoughts of self-harm', 'Panic attacks', 'Anxiety preventing daily activities', 'Physical symptoms without medical cause']
    },
    {
        name: 'Skin Rash',
        description: 'A change in skin color or texture, often with irritation or itching',
        category: SymptomCategory.DERMATOLOGICAL,
        possibleCauses: ['Allergic reaction', 'Infection', 'Heat', 'Eczema', 'Psoriasis', 'Contact dermatitis', 'Hives', 'Fungal infection'],
        selfCareTips: [
            'Avoid scratching',
            'Apply cool compresses',
            'Use mild, fragrance-free soap',
            'Apply moisturizer regularly',
            'Wear loose, cotton clothing',
            'Over-the-counter hydrocortisone cream',
            'Identify and avoid triggers'
        ],
        whenToSeekCare: 'If rash is widespread, accompanied by fever, or does not improve with self-care',
        urgencyLevel: UrgencyLevel.SCHEDULE_VISIT,
        associatedSymptoms: ['Itching', 'Redness', 'Swelling', 'Blisters', 'Dryness'],
        redFlags: ['Rash with breathing difficulty', 'Rash with fever', 'Rash that spreads rapidly', 'Rash with joint pain', 'Bullseye rash after tick bite']
    }
];
exports.WELLNESS_TIPS = [
    {
        id: 'sleep-1',
        category: 'Sleep',
        title: 'Sleep Hygiene Essentials',
        description: 'Quality sleep is fundamental to overall health and wellbeing.',
        tips: [
            'Maintain a consistent sleep schedule (same bedtime and wake time daily)',
            'Create a relaxing bedtime routine',
            'Keep your bedroom cool, dark, and quiet',
            'Avoid screens 1-2 hours before bed',
            'Limit caffeine after 2 PM',
            'Exercise regularly, but not too close to bedtime',
            'Avoid large meals and alcohol before bed'
        ]
    },
    {
        id: 'nutrition-1',
        category: 'Nutrition',
        title: 'Balanced Eating',
        description: 'A healthy diet supports energy, immunity, and overall wellbeing.',
        tips: [
            'Eat a variety of colorful fruits and vegetables',
            'Choose whole grains over refined grains',
            'Include lean proteins in each meal',
            'Limit processed foods and added sugars',
            'Stay hydrated with water throughout the day',
            'Practice mindful eating',
            'Don\'t skip breakfast'
        ]
    },
    {
        id: 'stress-1',
        category: 'Stress Management',
        title: 'Managing Daily Stress',
        description: 'Chronic stress can impact both physical and mental health.',
        tips: [
            'Practice deep breathing exercises daily',
            'Engage in regular physical activity',
            'Set boundaries and learn to say no',
            'Take regular breaks throughout the day',
            'Connect with supportive friends and family',
            'Try relaxation techniques like meditation or yoga',
            'Seek professional help when needed'
        ]
    },
    {
        id: 'exercise-1',
        category: 'Physical Activity',
        title: 'Staying Active',
        description: 'Regular physical activity is essential for maintaining health.',
        tips: [
            'Aim for at least 150 minutes of moderate activity per week',
            'Include both aerobic and strength training exercises',
            'Take short walking breaks throughout the day',
            'Find activities you enjoy',
            'Start slowly and gradually increase intensity',
            'Listen to your body and rest when needed',
            'Stay hydrated before, during, and after exercise'
        ]
    }
];
exports.HEALTH_GLOSSARY = [
    { term: 'Hypertension', definition: 'High blood pressure, typically defined as readings above 130/80 mmHg' },
    { term: 'Hypotension', definition: 'Low blood pressure, which may cause dizziness or fainting' },
    { term: 'BMI', definition: 'Body Mass Index - a measure of body fat based on height and weight' },
    { term: 'Cholesterol', definition: 'A waxy substance found in blood; high levels can lead to heart disease' },
    { term: 'Glucose', definition: 'Blood sugar - the main source of energy for the body' },
    { term: 'Inflammation', definition: 'The body\'s response to injury or infection, causing redness and swelling' },
    { term: 'Pathogen', definition: 'A microorganism that can cause disease, such as bacteria or viruses' },
    { term: 'Antigen', definition: 'A substance that triggers an immune response in the body' },
    { term: 'Probiotic', definition: 'Live bacteria that support digestive health' },
    { term: 'Antioxidant', definition: 'Substances that protect cells from damage caused by free radicals' },
    { term: 'Metabolism', definition: 'The chemical processes that convert food into energy' },
    { term: 'Cardiovascular', definition: 'Relating to the heart and blood vessels' }
];
exports.RED_FLAG_CHECKLIST = [
    'Chest pain or pressure',
    'Difficulty breathing or shortness of breath',
    'Sudden severe headache',
    'Confusion or disorientation',
    'Fainting or loss of consciousness',
    'Severe bleeding',
    'High fever with stiff neck',
    'Signs of stroke (face drooping, arm weakness, speech difficulty)',
    'Severe allergic reaction (anaphylaxis)',
    'Severe abdominal pain',
    'Coughing up blood',
    'Sudden vision changes'
];
//# sourceMappingURL=knowledge.js.map
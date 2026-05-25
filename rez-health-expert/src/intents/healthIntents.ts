export enum HealthIntent {
  SYMPTOM_INQUIRY = 'symptom_inquiry',
  APPOINTMENT_BOOKING = 'appointment_booking',
  APPOINTMENT_CANCELLATION = 'appointment_cancellation',
  APPOINTMENT_RESCHEDULE = 'appointment_reschedule',
  WELLNESS_INFO = 'wellness_info',
  HEALTH_EDUCATION = 'health_education',
  MEDICATION_INFO = 'medication_info',
  URGENT_CARE = 'urgent_care',
  EMERGENCY_ASSESSMENT = 'emergency_assessment',
  SYMPTOM_TRACKING = 'symptom_tracking',
  FOLLOW_UP = 'follow_up',
  REFERRAL_INFO = 'referral_info',
  INSURANCE_INFO = 'insurance_info',
  TELEMEDICINE = 'telemedicine'
}

export interface IntentPattern {
  intent: HealthIntent;
  patterns: string[];
  keywords: string[];
  requiresContext: boolean;
  urgencyLevel?: 'emergency' | 'urgent' | 'routine';
}

export const HEALTH_INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: HealthIntent.SYMPTOM_INQUIRY,
    patterns: [
      'i have a headache',
      'my stomach hurts',
      'feeling nauseous',
      'i feel dizzy',
      'i have a fever',
      'my back hurts',
      'i\'m experiencing',
      'i\'ve been feeling',
      'what could this mean',
      'should i be worried'
    ],
    keywords: ['symptom', 'feel', 'hurt', 'ache', 'pain', 'sick', 'unwell', 'dizzy', 'nauseous', 'tired', 'fever', 'cough', 'rash'],
    requiresContext: true
  },
  {
    intent: HealthIntent.APPOINTMENT_BOOKING,
    patterns: [
      'book an appointment',
      'schedule a visit',
      'i need to see a doctor',
      'make an appointment',
      'schedule an appointment',
      'can i get an appointment',
      'book me in',
      'set up a visit'
    ],
    keywords: ['appointment', 'schedule', 'book', 'visit', 'doctor', 'see a', 'see the'],
    requiresContext: true
  },
  {
    intent: HealthIntent.APPOINTMENT_CANCELLATION,
    patterns: [
      'cancel my appointment',
      'i need to cancel',
      'cannot make it',
      'reschedule instead',
      'unable to attend',
      'need to cancel'
    ],
    keywords: ['cancel', 'cancelled', 'cannot make', 'unable to attend'],
    requiresContext: true
  },
  {
    intent: HealthIntent.APPOINTMENT_RESCHEDULE,
    patterns: [
      'reschedule my appointment',
      'change the date',
      'move my appointment',
      'different time',
      'another day'
    ],
    keywords: ['reschedule', 'change date', 'move', 'different time', 'another day'],
    requiresContext: true
  },
  {
    intent: HealthIntent.WELLNESS_INFO,
    patterns: [
      'how to stay healthy',
      'wellness tips',
      'health advice',
      'prevent illness',
      'boost immunity',
      'healthy lifestyle',
      'nutrition advice',
      'sleep tips'
    ],
    keywords: ['wellness', 'healthy', 'prevent', 'tips', 'advice', 'lifestyle', 'nutrition', 'sleep', 'exercise', 'immune'],
    requiresContext: false
  },
  {
    intent: HealthIntent.HEALTH_EDUCATION,
    patterns: [
      'what is',
      'tell me about',
      'explain',
      'learn about',
      'information about',
      'what does it mean',
      'health education'
    ],
    keywords: ['what is', 'tell me about', 'explain', 'learn', 'information', 'mean'],
    requiresContext: false
  },
  {
    intent: HealthIntent.MEDICATION_INFO,
    patterns: [
      'is my medication safe',
      'side effects',
      'drug interactions',
      'how to take',
      'when to take',
      'medication question',
      'prescription info'
    ],
    keywords: ['medication', 'medicine', 'drug', 'prescription', 'pill', 'dose', 'side effect'],
    requiresContext: true
  },
  {
    intent: HealthIntent.URGENT_CARE,
    patterns: [
      'i need urgent care',
      'same day appointment',
      'as soon as possible',
      'can\'t wait',
      'need to be seen today'
    ],
    keywords: ['urgent', 'asap', 'today', 'same day', 'can\'t wait', 'emergency but not'],
    requiresContext: true,
    urgencyLevel: 'urgent'
  },
  {
    intent: HealthIntent.EMERGENCY_ASSESSMENT,
    patterns: [
      'chest pain',
      'can\'t breathe',
      'severe bleeding',
      'i think i\'m having a heart attack',
      'i think i\'m having a stroke',
      'i can\'t feel my',
      'i\'m going to die',
      'please help',
      'call an ambulance'
    ],
    keywords: ['chest pain', 'can\'t breathe', 'emergency', 'ambulance', 'dying', 'severe', 'bleeding', 'unconscious', 'stroke'],
    requiresContext: false,
    urgencyLevel: 'emergency'
  },
  {
    intent: HealthIntent.SYMPTOM_TRACKING,
    patterns: [
      'track my symptoms',
      'log my symptoms',
      'symptom diary',
      'monitor my health',
      'how have i been feeling'
    ],
    keywords: ['track', 'log', 'diary', 'monitor', 'record'],
    requiresContext: true
  },
  {
    intent: HealthIntent.FOLLOW_UP,
    patterns: [
      'follow up',
      'check up',
      'routine check',
      'annual physical',
      'yearly exam',
      'wellness visit'
    ],
    keywords: ['follow up', 'check up', 'routine', 'annual', 'physical', 'wellness visit'],
    requiresContext: false
  },
  {
    intent: HealthIntent.REFERRAL_INFO,
    patterns: [
      'i need a referral',
      'see a specialist',
      'refer me to',
      'recommend a specialist',
      'need a second opinion'
    ],
    keywords: ['referral', 'specialist', 'second opinion'],
    requiresContext: true
  },
  {
    intent: HealthIntent.TELEMEDICINE,
    patterns: [
      'video appointment',
      'virtual visit',
      'telehealth',
      'telemedicine',
      'online doctor',
      'video call with doctor'
    ],
    keywords: ['video', 'virtual', 'tele', 'online', 'remote'],
    requiresContext: true
  }
];

export function detectHealthIntent(query: string): HealthIntent | null {
  const lowerQuery = query.toLowerCase();

  for (const pattern of HEALTH_INTENT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (lowerQuery.includes(keyword)) {
        return pattern.intent;
      }
    }
  }

  return null;
}

export function getIntentUrgency(intent: HealthIntent): 'emergency' | 'urgent' | 'routine' | null {
  const pattern = HEALTH_INTENT_PATTERNS.find(p => p.intent === intent);
  return pattern?.urgencyLevel || null;
}

export function getResponseForIntent(intent: HealthIntent): string {
  switch (intent) {
    case HealthIntent.SYMPTOM_INQUIRY:
      return 'I understand you\'re experiencing some symptoms. To help you better, could you describe:\n\n' +
        '• What symptoms are you experiencing?\n' +
        '• How long have you had these symptoms?\n' +
        '• How would you rate the severity (mild, moderate, severe)?\n' +
        '• Are there unknown other symptoms accompanying them?\n\n' +
        'This information will help me provide you with more helpful guidance.';

    case HealthIntent.APPOINTMENT_BOOKING:
      return 'I\'d be happy to help you schedule an appointment! To get started, I\'ll need:\n\n' +
        '• Your name and contact information\n' +
        '• Type of care you need (primary care, specialist, etc.)\n' +
        '• Reason for your visit\n' +
        '• Preferred dates and times\n' +
        '• Insurance information\n\n' +
        'What type of appointment would you like to schedule?';

    case HealthIntent.APPOINTMENT_CANCELLATION:
      return 'I\'m sorry to hear you need to cancel. To proceed, please provide:\n\n' +
        '• Your appointment date/time or confirmation number\n' +
        '• Reason for cancellation (optional)\n\n' +
        'Would you like to reschedule for a different time?';

    case HealthIntent.WELLNESS_INFO:
      return 'Great question! Here are some general wellness tips:\n\n' +
        '**Sleep**: Aim for 7-9 hours of quality sleep nightly\n' +
        '**Nutrition**: Eat a balanced diet with fruits, vegetables, and whole grains\n' +
        '**Exercise**: Stay active with at least 150 minutes of moderate activity weekly\n' +
        '**Stress Management**: Practice relaxation techniques like deep breathing or meditation\n' +
        '**Hydration**: Drink plenty of water throughout the day\n\n' +
        'Would you like more specific wellness information?';

    case HealthIntent.HEALTH_EDUCATION:
      return 'I\'m happy to help explain health topics! What would you like to learn about?\n\n' +
        '• Common symptoms and conditions\n' +
        '• Health terminology\n' +
        '• Preventive care recommendations\n' +
        '• When to seek medical attention\n\n' +
        'Just let me know what topic interests you!';

    case HealthIntent.MEDICATION_INFO:
      return 'For medication-related questions, I recommend:\n\n' +
        '1. **Consult Your Healthcare Provider** - They can provide personalized medication advice\n' +
        '2. **Ask Your Pharmacist** - They\'re excellent resources for medication information\n' +
        '3. **Check Reputable Sources** - Like the FDA or official health websites\n\n' +
        'I cannot provide specific medication recommendations, dosages, or prescriptions. Please consult a healthcare professional.';

    case HealthIntent.URGENT_CARE:
      return 'I understand you need to be seen soon. Let me help you find an urgent care option.\n\n' +
        'Could you provide:\n' +
        '• Your location or ZIP code\n' +
        '• The symptoms you\'re experiencing\n' +
        '• Whether you have insurance\n\n' +
        'If your symptoms are severe or life-threatening, please call 911 or go to the nearest emergency room.';

    case HealthIntent.EMERGENCY_ASSESSMENT:
      return '⚠️ **IMPORTANT**: If you are experiencing a medical emergency, please:\n\n' +
        '• Call 911 (US) or your local emergency number immediately\n' +
        '• Go to the nearest emergency room\n\n' +
        'Do not delay seeking emergency care.\n\n' +
        'If you are not in immediate danger but need urgent attention, please tell me more about your situation so I can help you find appropriate care.';

    case HealthIntent.FOLLOW_UP:
      return 'I can help you schedule a follow-up appointment. Do you have:\n\n' +
        '• Your previous appointment date or doctor\'s name?\n' +
        '• The reason for your follow-up?\n\n' +
        'Regular check-ups are important for maintaining your health!';

    case HealthIntent.TELEMEDICINE:
      return 'I can help you schedule a telemedicine (video) appointment! This is a great option for:\n\n' +
        '• Follow-up visits\n' +
        '• Minor illnesses\n' +
        '• Medication questions\n' +
        '• Mental health consultations\n\n' +
        'To book a telemedicine visit, I\'ll need your information and preferred appointment time. What type of care do you need?';

    default:
      return 'I\'m here to help with your health-related questions! I can assist with:\n\n' +
        '• Understanding symptoms\n' +
        '• Scheduling appointments\n' +
        '• Wellness information\n' +
        '• Health education\n\n' +
        'How can I help you today?';
  }
}

export function getEmergencyMessage(): string {
  return '⚠️ **MEDICAL EMERGENCY**\n\n' +
    'If you are experiencing unknown of the following, please call 911 or go to the nearest emergency room immediately:\n\n' +
    '• Chest pain or pressure\n' +
    '• Difficulty breathing\n' +
    '• Severe bleeding\n' +
    '• Loss of consciousness\n' +
    '• Signs of stroke (face drooping, arm weakness, speech difficulty)\n' +
    '• Severe allergic reaction\n\n' +
    'Do not delay seeking emergency care. Your safety is the top priority.';
}

export function extractSymptomsFromQuery(query: string): string[] {
  const commonSymptoms = [
    'headache', 'fever', 'cough', 'fatigue', 'nausea', 'dizziness',
    'stomach ache', 'back pain', 'chest pain', 'shortness of breath',
    'sore throat', 'runny nose', 'congestion', 'rash', 'joint pain',
    'muscle ache', 'anxiety', 'insomnia', 'diarrhea', 'vomiting'
  ];

  const lowerQuery = query.toLowerCase();
  const foundSymptoms: string[] = [];

  for (const symptom of commonSymptoms) {
    if (lowerQuery.includes(symptom)) {
      foundSymptoms.push(symptom);
    }
  }

  return foundSymptoms;
}

export function isEmergencyQuery(query: string): boolean {
  const emergencyKeywords = [
    'chest pain',
    'can\'t breathe',
    'cannot breathe',
    'difficulty breathing',
    'severe bleeding',
    'unconscious',
    'stroke',
    'heart attack',
    ' anaphylaxis',
    'dying',
    '911',
    'ambulance'
  ];

  const lowerQuery = query.toLowerCase();
  return emergencyKeywords.some(keyword => lowerQuery.includes(keyword));
}

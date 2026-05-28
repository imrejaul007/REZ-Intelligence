import { UrgencyLevel, SymptomInfo, AppointmentType, SpecialtyType } from './healthExpert';

export interface HealthRecommendation {
  type: 'appointment' | 'self_care' | 'urgent' | 'information' | 'lifestyle';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  urgency?: UrgencyLevel;
  actionRequired?: string;
}

export function getRecommendationsForSymptom(symptoms: SymptomInfo[]): HealthRecommendation[] {
  const recommendations: HealthRecommendation[] = [];

  const hasRedFlags = checkForRedFlags(symptoms);
  if (hasRedFlags) {
    recommendations.push({
      type: 'urgent',
      title: 'Seek Emergency Care Immediately',
      description: 'Your symptoms may indicate a serious condition requiring immediate medical attention. Please call 911 or go to the nearest emergency room.',
      priority: 'high',
      urgency: UrgencyLevel.EMERGENCY,
      actionRequired: 'Call 911 or go to emergency room'
    });
    return recommendations;
  }

  const hasUrgentSymptoms = checkForUrgentSymptoms(symptoms);
  if (hasUrgentSymptoms) {
    recommendations.push({
      type: 'urgent',
      title: 'Visit Urgent Care Today',
      description: 'Your symptoms warrant same-day medical evaluation. Please visit an urgent care center or your healthcare provider today.',
      priority: 'high',
      urgency: UrgencyLevel.URGENT_CARE,
      actionRequired: 'Visit urgent care or seek same-day appointment'
    });
  } else {
    recommendations.push({
      type: 'appointment',
      title: 'Schedule a Doctor Visit',
      description: 'Consider making an appointment with your healthcare provider to discuss your symptoms further.',
      priority: 'medium',
      urgency: UrgencyLevel.SCHEDULE_VISIT,
      actionRequired: 'Schedule appointment within next few days'
    });
  }

  recommendations.push({
    type: 'self_care',
    title: 'Self-Care While Monitoring',
    description: 'Take care of yourself while you monitor your symptoms. Rest, stay hydrated, and avoid strenuous activities.',
    priority: 'low'
  });

  recommendations.push({
    type: 'lifestyle',
    title: 'Track Your Symptoms',
    description: 'Keep a log of your symptoms including when they started, their severity, and unknown patterns or triggers you notice.',
    priority: 'low'
  });

  return recommendations;
}

function checkForRedFlags(symptoms: SymptomInfo[]): boolean {
  const redFlagKeywords = [
    'chest pain',
    'difficulty breathing',
    'can\'t breathe',
    'severe bleeding',
    'loss of consciousness',
    'sudden severe headache',
    'confusion',
    'numbness',
    'slurred speech',
    'face drooping',
    'arm weakness',
    'high fever',
    'stiff neck'
  ];

  for (const symptom of symptoms) {
    const symptomLower = symptom.name.toLowerCase();
    const combinedSymptoms = [symptomLower, ...(symptom.additionalSymptoms || []).map(s => s.toLowerCase())];

    if (redFlagKeywords.some(flag => combinedSymptoms.some(s => s.includes(flag)))) {
      return true;
    }

    if (symptom.severity === 'severe' && symptom.duration === 'sudden') {
      return true;
    }
  }

  return false;
}

function checkForUrgentSymptoms(symptoms: SymptomInfo[]): boolean {
  const urgentKeywords = [
    'persistent fever',
    'severe pain',
    'vomiting blood',
    'blood in stool',
    'dehydration',
    'worsening symptoms'
  ];

  for (const symptom of symptoms) {
    if (symptom.severity === 'severe') {
      return true;
    }

    const symptomLower = symptom.name.toLowerCase();
    if (urgentKeywords.some(keyword => symptomLower.includes(keyword))) {
      return true;
    }
  }

  return false;
}

export function getLifestyleRecommendations(): HealthRecommendation[] {
  return [
    {
      type: 'lifestyle',
      title: 'Stay Hydrated',
      description: 'Drink at least 8 glasses of water daily. Hydration supports overall health and helps your body function optimally.',
      priority: 'medium'
    },
    {
      type: 'lifestyle',
      title: 'Prioritize Sleep',
      description: 'Aim for 7-9 hours of quality sleep each night. Good sleep supports immune function and recovery.',
      priority: 'high'
    },
    {
      type: 'lifestyle',
      title: 'Move Daily',
      description: 'Even light physical activity like walking can improve mood, energy levels, and overall health.',
      priority: 'medium'
    },
    {
      type: 'lifestyle',
      title: 'Manage Stress',
      description: 'Practice stress management techniques like deep breathing, meditation, or yoga to support both mental and physical health.',
      priority: 'medium'
    },
    {
      type: 'lifestyle',
      title: 'Eat a Balanced Diet',
      description: 'Include plenty of fruits, vegetables, whole grains, and lean proteins in your diet for optimal nutrition.',
      priority: 'medium'
    }
  ];
}

export function getFollowUpRecommendations(
  appointmentType: AppointmentType,
  symptoms: SymptomInfo[]
): HealthRecommendation[] {
  const recommendations: HealthRecommendation[] = [];

  if (appointmentType === AppointmentType.FOLLOW_UP) {
    recommendations.push({
      type: 'information',
      title: 'Before Your Follow-Up',
      description: 'Prepare a list of unknown new symptoms, questions for your doctor, and note unknown changes in your condition since the last visit.',
      priority: 'high'
    });
  }

  recommendations.push({
    type: 'lifestyle',
    title: 'Monitor Your Progress',
    description: 'Keep track of unknown changes in your symptoms, including improvements or new developments.',
    priority: 'medium'
  });

  recommendations.push({
    type: 'self_care',
    title: 'Continue Self-Care',
    description: 'Continue following unknown self-care recommendations provided by your healthcare provider.',
    priority: 'medium'
  });

  return recommendations;
}

export function getSpecialistRecommendation(symptoms: SymptomInfo[]): {
  specialty: SpecialtyType;
  reason: string;
} | null {
  if (symptoms.length === 0) return null;

  const symptomSpecialtyMap: Array<{
    keywords: string[];
    specialty: SpecialtyType;
    reason: string;
  }> = [
    {
      keywords: ['chest pain', 'heart', 'palpitation', 'shortness of breath'],
      specialty: SpecialtyType.CARDIOLOGY,
      reason: 'Your symptoms may be related to heart health'
    },
    {
      keywords: ['skin', 'rash', 'acne', 'eczema', 'mole'],
      specialty: SpecialtyType.DERMATOLOGY,
      reason: 'Your symptoms may require dermatological evaluation'
    },
    {
      keywords: ['back pain', 'joint', 'bone', 'muscle', 'fracture'],
      specialty: SpecialtyType.ORTHOPEDICS,
      reason: 'Your symptoms may be related to musculoskeletal health'
    },
    {
      keywords: ['headache', 'dizziness', 'numbness', 'tingling', 'seizure'],
      specialty: SpecialtyType.NEUROLOGY,
      reason: 'Your symptoms may require neurological evaluation'
    },
    {
      keywords: ['stomach', 'nausea', 'vomiting', 'diarrhea', 'constipation'],
      specialty: SpecialtyType.GASTROENTEROLOGY,
      reason: 'Your symptoms may be related to digestive health'
    },
    {
      keywords: ['cough', 'breathing', 'lung', 'asthma', 'shortness of breath'],
      specialty: SpecialtyType.PULMONOLOGY,
      reason: 'Your symptoms may require pulmonary evaluation'
    },
    {
      keywords: ['anxiety', 'depression', 'mood', 'stress', 'mental health'],
      specialty: SpecialtyType.MENTAL_HEALTH,
      reason: 'Your symptoms may benefit from mental health support'
    },
    {
      keywords: ['allergy', 'sneezing', 'itching', 'hives'],
      specialty: SpecialtyType.ALLERGY_IMMUNOLOGY,
      reason: 'Your symptoms may be allergy-related'
    }
  ];

  const primarySymptom = symptoms[0]?.name.toLowerCase() || '';

  for (const mapping of symptomSpecialtyMap) {
    if (mapping.keywords.some(keyword => primarySymptom.includes(keyword))) {
      return {
        specialty: mapping.specialty,
        reason: mapping.reason
      };
    }
  }

  return {
    specialty: SpecialtyType.GENERAL_MEDICINE,
    reason: 'Your symptoms require general medical evaluation'
  };
}

export function getPreAppointmentChecklist(symptoms: SymptomInfo[]): string[] {
  const checklist: string[] = [
    'List of current medications',
    'Known allergies',
    'Insurance card and ID',
    'Previous medical records (if relevant)',
    'Emergency contact information'
  ];

  checklist.push(
    'Prepare to describe:',
    `• Primary symptom: ${symptoms[0]?.name || 'N/A'}`,
    '• When symptoms started',
    '• Symptom severity (1-10)',
    '• Any triggering or relieving factors',
    '• Any additional symptoms'
  );

  if (symptoms.some(s => s.category === 'mental_health')) {
    checklist.push(
      'For mental health appointments:',
      '• Thoughts and feelings you want to discuss',
      '• Recent life changes or stressors',
      '• Sleep and appetite changes'
    );
  }

  return checklist;
}

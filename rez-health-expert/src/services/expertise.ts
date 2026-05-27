import logger from './utils/logger.js';

import { v4 as uuidv4 } from 'uuid';
import {
  AppointmentRequest,
  Appointment,
  PatientProfile,
  AppointmentType,
  SpecialtyType,
  SymptomInfo,
  UrgencyLevel
} from './healthExpert.js';

export function validateEnv(): void {
  const required = ['NODE_ENV'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  }
}

export function createAppointmentRequest(
  patient: PatientProfile,
  appointmentType: AppointmentType,
  options?: {
    specialty?: SpecialtyType;
    preferredDate?: Date;
    preferredTime?: string;
    symptoms?: SymptomInfo[];
    reasonForVisit?: string;
    isNewPatient?: boolean;
    insuranceProvider?: string;
  }
): AppointmentRequest {
  return {
    patient,
    appointmentType,
    specialty: options?.specialty,
    preferredDate: options?.preferredDate,
    preferredTime: options?.preferredTime,
    symptoms: options?.symptoms,
    reasonForVisit: options?.reasonForVisit,
    isNewPatient: options?.isNewPatient ?? true,
    insuranceProvider: options?.insuranceProvider
  };
}

export function validateAppointmentRequest(request: AppointmentRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!request.patient || !request.patient.name) {
    errors.push('Patient name is required');
  }

  if (!request.appointmentType) {
    errors.push('Appointment type is required');
  }

  if (request.appointmentType === AppointmentType.SPECIALIST && !request.specialty) {
    errors.push('Specialty is required for specialist appointments');
  }

  if (request.preferredDate && request.preferredDate < new Date()) {
    errors.push('Preferred date cannot be in the past');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function getRecommendedSpecialty(symptoms: SymptomInfo[]): SpecialtyType | null {
  if (symptoms.length === 0) return null;

  const symptomCategories: Record<string, SpecialtyType> = {
    'chest pain': SpecialtyType.CARDIOLOGY,
    'shortness of breath': SpecialtyType.PULMONOLOGY,
    'cough': SpecialtyType.PULMONOLOGY,
    'headache': SpecialtyType.NEUROLOGY,
    'skin rash': SpecialtyType.DERMATOLOGY,
    'back pain': SpecialtyType.ORTHOPEDICS,
    'joint pain': SpecialtyType.RHEUMATOLOGY,
    'anxiety': SpecialtyType.MENTAL_HEALTH,
    'depression': SpecialtyType.MENTAL_HEALTH,
    'stomach ache': SpecialtyType.GASTROENTEROLOGY,
    'nausea': SpecialtyType.GASTROENTEROLOGY,
    'allergy': SpecialtyType.ALLERGY_IMMUNOLOGY
  };

  const primarySymptom = symptoms[0]?.name.toLowerCase() || '';

  for (const [keyword, specialty] of Object.entries(symptomCategories)) {
    if (primarySymptom.includes(keyword)) {
      return specialty;
    }
  }

  return SpecialtyType.GENERAL_MEDICINE;
}

export function determineUrgencyFromSymptoms(symptoms: SymptomInfo[]): UrgencyLevel {
  const redFlagSymptoms = [
    'chest pain',
    'difficulty breathing',
    'severe bleeding',
    'loss of consciousness',
    'sudden severe headache',
    'numbness',
    'slurred speech'
  ];

  for (const symptom of symptoms) {
    const symptomLower = symptom.name.toLowerCase();

    if (redFlagSymptoms.some(flag => symptomLower.includes(flag))) {
      return UrgencyLevel.EMERGENCY;
    }

    if (symptom.severity === 'severe') {
      return UrgencyLevel.URGENT_CARE;
    }
  }

  return UrgencyLevel.SCHEDULE_VISIT;
}

export function formatAppointmentDetails(appointment: Appointment): string {
  let details = `**Appointment Details**\n\n`;
  details += `• **Date**: ${appointment.scheduledDate.toLocaleDateString()}\n`;
  details += `• **Time**: ${appointment.scheduledTime}\n`;
  details += `• **Type**: ${formatEnumValue(appointment.appointmentType)}\n`;

  if (appointment.specialty) {
    details += `• **Specialty**: ${formatEnumValue(appointment.specialty)}\n`;
  }

  details += `• **Reason**: ${appointment.reasonForVisit}\n`;
  details += `• **Status**: ${appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}\n`;

  if (appointment.provider) {
    details += `• **Provider**: ${appointment.provider}\n`;
  }

  if (appointment.location) {
    details += `• **Location**: ${appointment.location}\n`;
  }

  return details;
}

export function formatEnumValue(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function generateAppointmentId(): string {
  return `APT-${uuidv4().substring(0, 8).toUpperCase()}`;
}

export function getAppointmentPreparationInstructions(appointmentType: AppointmentType): string {
  const instructions: Record<AppointmentType, string[]> = {
    [AppointmentType.PRIMARY_CARE]: [
      'Bring your ID and insurance card',
      'List of current medications',
      'List of symptoms and their duration',
      'Any relevant medical records',
      'Questions you want to ask the doctor'
    ],
    [AppointmentType.SPECIALIST]: [
      'Referral letter from your primary care doctor (if required)',
      'Insurance card and ID',
      'Complete list of medications',
      'Previous test results or imaging',
      'Detailed symptom history'
    ],
    [AppointmentType.URGENT_CARE]: [
      'ID and insurance card',
      'List of medications',
      'Known allergies',
      'Emergency contact information',
      'Payment for copay (if applicable)'
    ],
    [AppointmentType.EMERGENCY]: [
      'ID and insurance card',
      'Emergency contact',
      'Current medications list',
      'Known allergies',
      'Any relevant medical history'
    ],
    [AppointmentType.TELEMEDICINE]: [
      'Stable internet connection',
      'Camera-enabled device',
      'List of symptoms prepared',
      'Medications list',
      'Quiet, private space for the consultation'
    ],
    [AppointmentType.WELLNESS_CHECK]: [
      'Fasting if blood work is scheduled (12 hours)',
      'ID and insurance card',
      'List of questions for your doctor',
      'Updates on unknown changes since your last visit',
      'Comfortable clothing for examination'
    ],
    [AppointmentType.FOLLOW_UP]: [
      'Previous test results or imaging',
      'List of unknown new symptoms',
      'Medication list with unknown changes',
      'Questions about your treatment plan',
      'ID and insurance card'
    ]
  };

  return instructions[appointmentType].map((item, i) => `${i + 1}. ${item}`).join('\n');
}

export function createPatientProfile(data: {
  name: string;
  dateOfBirth?: string;
  gender?: string;
  existingConditions?: string[];
  medications?: string[];
  allergies?: string[];
}): PatientProfile {
  return {
    id: uuidv4(),
    name: data.name,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    gender: data.gender,
    existingConditions: data.existingConditions || [],
    medications: data.medications || [],
    allergies: data.allergies || [],
    emergencyContact: undefined
  };
}

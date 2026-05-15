import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum SymptomCategory {
  RESPIRATORY = 'respiratory',
  DIGESTIVE = 'digestive',
  CARDIOVASCULAR = 'cardiovascular',
  MUSCULOSKELETAL = 'musculoskeletal',
  NEUROLOGICAL = 'neurological',
  DERMATOLOGICAL = 'dermatological',
  MENTAL_HEALTH = 'mental_health',
  PAIN = 'pain',
  FATIGUE = 'fatigue',
  GENERAL = 'general'
}

export enum SeverityLevel {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  URGENT = 'urgent'
}

export enum UrgencyLevel {
  SELF_CARE = 'self_care',
  SCHEDULE_VISIT = 'schedule_visit',
  SAME_DAY_APPOINTMENT = 'same_day_appointment',
  URGENT_CARE = 'urgent_care',
  EMERGENCY = 'emergency'
}

export enum AppointmentType {
  PRIMARY_CARE = 'primary_care',
  SPECIALIST = 'specialist',
  URGENT_CARE = 'urgent_care',
  EMERGENCY = 'emergency',
  TELEMEDICINE = 'telemedicine',
  WELLNESS_CHECK = 'wellness_check',
  FOLLOW_UP = 'follow_up'
}

export enum SpecialtyType {
  GENERAL_MEDICINE = 'general_medicine',
  INTERNAL_MEDICINE = 'internal_medicine',
  FAMILY_MEDICINE = 'family_medicine',
  PEDIATRICS = 'pediatrics',
  CARDIOLOGY = 'cardiology',
  DERMATOLOGY = 'dermatology',
  ORTHOPEDICS = 'orthopedics',
  NEUROLOGY = 'neurology',
  GASTROENTEROLOGY = 'gastroenterology',
  PULMONOLOGY = 'pulmonology',
  MENTAL_HEALTH = 'mental_health',
  GYNECOLOGY = 'gynecology',
  UROLOGY = 'urology',
  ENDOCRINOLOGY = 'endocrinology',
  RHEUMATOLOGY = 'rheumatology',
  ALLERGY_IMMUNOLOGY = 'allergy_immunology'
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const PatientProfileSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  dateOfBirth: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  gender: z.string().optional(),
  existingConditions: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  emergencyContact: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    relationship: z.string().min(1)
  }).optional()
});

export const SymptomInfoSchema = z.object({
  name: z.string().min(1),
  duration: z.string().optional(),
  severity: z.nativeEnum(SeverityLevel).optional(),
  additionalSymptoms: z.array(z.string()).optional(),
  triggeringFactors: z.array(z.string()).optional()
});

export const AppointmentRequestSchema = z.object({
  patient: PatientProfileSchema,
  appointmentType: z.nativeEnum(AppointmentType),
  specialty: z.nativeEnum(SpecialtyType).optional(),
  preferredDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  preferredTime: z.string().optional(),
  symptoms: z.array(SymptomInfoSchema).optional(),
  reasonForVisit: z.string().max(500).optional(),
  isNewPatient: z.boolean().optional(),
  insuranceProvider: z.string().optional()
});

export const ChatMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  userId: z.string().optional(),
  context: z.object({
    appointmentRequest: AppointmentRequestSchema.optional(),
    patientProfile: PatientProfileSchema.optional()
  }).optional()
});

// ============================================
// TYPES
// ============================================

export type PatientProfile = z.infer<typeof PatientProfileSchema>;
export type SymptomInfo = z.infer<typeof SymptomInfoSchema>;
export type AppointmentRequest = z.infer<typeof AppointmentRequestSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export interface Appointment {
  id: string;
  patientId: string;
  appointmentType: AppointmentType;
  specialty?: SpecialtyType;
  scheduledDate: Date;
  scheduledTime: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  reasonForVisit: string;
  provider?: string;
  location?: string;
  notes?: string;
  createdAt: Date;
}

export interface HealthResponse {
  success: boolean;
  message: string;
  selfCareTips?: string[];
  urgencyLevel?: UrgencyLevel;
  recommendations?: Recommendation[];
  appointment?: Appointment;
  wellnessTips?: WellnessTip[];
  disclaimer?: string;
  processingTime?: number;
}

export interface Recommendation {
  type: 'appointment' | 'self_care' | 'urgent' | 'information' | 'lifestyle';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionRequired?: string;
}

export interface WellnessTip {
  id: string;
  category: string;
  title: string;
  description: string;
  tips: string[];
}

export interface Symptom {
  name: string;
  description: string;
  category: SymptomCategory;
  possibleCauses: string[];
  selfCareTips: string[];
  whenToSeekCare: string;
  urgencyLevel: UrgencyLevel;
  associatedSymptoms?: string[];
  redFlags: string[];
}

// ============================================
// CONFIG TYPES
// ============================================

export interface ServiceConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  logLevel: string;
  serviceName: string;
  version: string;
}

// ============================================
// ERROR TYPES
// ============================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError['errors'] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

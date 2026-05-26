import { Symptom } from '../config/knowledge.js';
export declare const logger: any;
export declare enum SymptomCategory {
    RESPIRATORY = "respiratory",
    DIGESTIVE = "digestive",
    CARDIOVASCULAR = "cardiovascular",
    MUSCULOSKELETAL = "musculoskeletal",
    NEUROLOGICAL = "neurological",
    DERMATOLOGICAL = "dermatological",
    MENTAL_HEALTH = "mental_health",
    PAIN = "pain",
    FATIGUE = "fatigue",
    GENERAL = "general"
}
export declare enum SeverityLevel {
    MINOR = "minor",
    MODERATE = "moderate",
    SEVERE = "severe",
    URGENT = "urgent"
}
export declare enum UrgencyLevel {
    SELF_CARE = "self_care",
    SCHEDULE_VISIT = "schedule_visit",
    SAME_DAY_APPOINTMENT = "same_day_appointment",
    URGENT_CARE = "urgent_care",
    EMERGENCY = "emergency"
}
export declare enum AppointmentType {
    PRIMARY_CARE = "primary_care",
    SPECIALIST = "specialist",
    URGENT_CARE = "urgent_care",
    EMERGENCY = "emergency",
    TELEMEDICINE = "telemedicine",
    WELLNESS_CHECK = "wellness_check",
    FOLLOW_UP = "follow_up"
}
export declare enum SpecialtyType {
    GENERAL_MEDICINE = "general_medicine",
    INTERNAL_MEDICINE = "internal_medicine",
    FAMILY_MEDICINE = "family_medicine",
    PEDIATRICS = "pediatrics",
    CARDIOLOGY = "cardiology",
    DERMATOLOGY = "dermatology",
    ORTHOPEDICS = "orthopedics",
    NEUROLOGY = "neurology",
    GASTROENTEROLOGY = "gastroenterology",
    PULMONOLOGY = "pulmonology",
    MENTAL_HEALTH = "mental_health",
    GYNECOLOGY = "gynecology",
    UROLOGY = "urology",
    ENDOCRINOLOGY = "endocrinology",
    RHEUMATOLOGY = "rheumatology",
    ALLERGY_IMMUNOLOGY = "allergy_immunology"
}
export interface PatientProfile {
    id: string;
    name: string;
    dateOfBirth?: Date;
    gender?: string;
    existingConditions?: string[];
    medications?: string[];
    allergies?: string[];
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    };
}
export interface SymptomInfo {
    name: string;
    duration?: string;
    severity?: SeverityLevel;
    additionalSymptoms?: string[];
    triggeringFactors?: string[];
}
export interface AppointmentRequest {
    patient: PatientProfile;
    appointmentType: AppointmentType;
    specialty?: SpecialtyType;
    preferredDate?: Date;
    preferredTime?: string;
    symptoms?: SymptomInfo[];
    reasonForVisit?: string;
    isNewPatient?: boolean;
    insuranceProvider?: string;
}
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
    symptomInfo?: Symptom;
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
declare class HealthExpertAgent {
    private readonly agentId;
    private readonly agentName;
    private sessionHistory;
    private appointments;
    constructor(agentId?: string, agentName?: string);
    processQuery(query: string, sessionId: string, context?: HealthContext): Promise<HealthResponse>;
    private identifyIntent;
    private matches;
    private handleSymptomInquiry;
    private findMatchingSymptom;
    private checkForRedFlags;
    private formatSymptomResponse;
    private generateRecommendations;
    private getGeneralSymptomGuidance;
    private handleAppointmentBooking;
    private getAppointmentUrgencyMessage;
    private handleWellnessRequest;
    private handleHealthInformation;
    private handleMedicationInfo;
    private handleGeneralHealthQuery;
    private formatEnumValue;
    private recordSession;
    getAppointmentById(appointmentId: string): Promise<Appointment | null>;
    cancelAppointment(appointmentId: string): Promise<boolean>;
}
interface HealthContext {
    appointmentRequest?: AppointmentRequest;
}
export interface SymptomInfo {
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
export declare const healthExpert: HealthExpertAgent;
export {};
//# sourceMappingURL=healthExpert.d.ts.map
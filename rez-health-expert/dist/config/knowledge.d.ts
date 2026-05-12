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
export interface HealthResource {
    id: string;
    title: string;
    summary: string;
    content: string;
    category: string;
    tags: string[];
    lastUpdated: Date;
}
export interface WellnessTip {
    id: string;
    category: string;
    title: string;
    description: string;
    tips: string[];
}
export declare const SYMPTOM_DATABASE: Symptom[];
export declare const WELLNESS_TIPS: WellnessTip[];
export declare const HEALTH_GLOSSARY: Array<{
    term: string;
    definition: string;
}>;
export declare const RED_FLAG_CHECKLIST: string[];
//# sourceMappingURL=knowledge.d.ts.map
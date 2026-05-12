export declare enum HealthIntent {
    SYMPTOM_INQUIRY = "symptom_inquiry",
    APPOINTMENT_BOOKING = "appointment_booking",
    APPOINTMENT_CANCELLATION = "appointment_cancellation",
    APPOINTMENT_RESCHEDULE = "appointment_reschedule",
    WELLNESS_INFO = "wellness_info",
    HEALTH_EDUCATION = "health_education",
    MEDICATION_INFO = "medication_info",
    URGENT_CARE = "urgent_care",
    EMERGENCY_ASSESSMENT = "emergency_assessment",
    SYMPTOM_TRACKING = "symptom_tracking",
    FOLLOW_UP = "follow_up",
    REFERRAL_INFO = "referral_info",
    INSURANCE_INFO = "insurance_info",
    TELEMEDICINE = "telemedicine"
}
export interface IntentPattern {
    intent: HealthIntent;
    patterns: string[];
    keywords: string[];
    requiresContext: boolean;
    urgencyLevel?: 'emergency' | 'urgent' | 'routine';
}
export declare const HEALTH_INTENT_PATTERNS: IntentPattern[];
export declare function detectHealthIntent(query: string): HealthIntent | null;
export declare function getIntentUrgency(intent: HealthIntent): 'emergency' | 'urgent' | 'routine' | null;
export declare function getResponseForIntent(intent: HealthIntent): string;
export declare function getEmergencyMessage(): string;
export declare function extractSymptomsFromQuery(query: string): string[];
export declare function isEmergencyQuery(query: string): boolean;
//# sourceMappingURL=healthIntents.d.ts.map
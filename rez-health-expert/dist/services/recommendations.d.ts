import { UrgencyLevel, SymptomInfo, AppointmentType, SpecialtyType } from './healthExpert';
export interface HealthRecommendation {
    type: 'appointment' | 'self_care' | 'urgent' | 'information' | 'lifestyle';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    urgency?: UrgencyLevel;
    actionRequired?: string;
}
export declare function getRecommendationsForSymptom(symptoms: SymptomInfo[]): HealthRecommendation[];
export declare function getLifestyleRecommendations(): HealthRecommendation[];
export declare function getFollowUpRecommendations(appointmentType: AppointmentType, symptoms: SymptomInfo[]): HealthRecommendation[];
export declare function getSpecialistRecommendation(symptoms: SymptomInfo[]): {
    specialty: SpecialtyType;
    reason: string;
} | null;
export declare function getPreAppointmentChecklist(symptoms: SymptomInfo[]): string[];
//# sourceMappingURL=recommendations.d.ts.map
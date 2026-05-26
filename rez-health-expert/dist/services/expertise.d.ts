import { AppointmentRequest, Appointment, PatientProfile, AppointmentType, SpecialtyType, SymptomInfo, UrgencyLevel } from './healthExpert.js';
export declare function validateEnv(): void;
export declare function createAppointmentRequest(patient: PatientProfile, appointmentType: AppointmentType, options?: {
    specialty?: SpecialtyType;
    preferredDate?: Date;
    preferredTime?: string;
    symptoms?: SymptomInfo[];
    reasonForVisit?: string;
    isNewPatient?: boolean;
    insuranceProvider?: string;
}): AppointmentRequest;
export declare function validateAppointmentRequest(request: AppointmentRequest): {
    valid: boolean;
    errors: string[];
};
export declare function getRecommendedSpecialty(symptoms: SymptomInfo[]): SpecialtyType | null;
export declare function determineUrgencyFromSymptoms(symptoms: SymptomInfo[]): UrgencyLevel;
export declare function formatAppointmentDetails(appointment: Appointment): string;
export declare function formatEnumValue(value: string): string;
export declare function generateAppointmentId(): string;
export declare function getAppointmentPreparationInstructions(appointmentType: AppointmentType): string;
export declare function createPatientProfile(data: {
    name: string;
    dateOfBirth?: string;
    gender?: string;
    existingConditions?: string[];
    medications?: string[];
    allergies?: string[];
}): PatientProfile;
//# sourceMappingURL=expertise.d.ts.map
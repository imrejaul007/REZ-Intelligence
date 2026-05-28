"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
exports.createAppointmentRequest = createAppointmentRequest;
exports.validateAppointmentRequest = validateAppointmentRequest;
exports.getRecommendedSpecialty = getRecommendedSpecialty;
exports.determineUrgencyFromSymptoms = determineUrgencyFromSymptoms;
exports.formatAppointmentDetails = formatAppointmentDetails;
exports.formatEnumValue = formatEnumValue;
exports.generateAppointmentId = generateAppointmentId;
exports.getAppointmentPreparationInstructions = getAppointmentPreparationInstructions;
exports.createPatientProfile = createPatientProfile;
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
const healthExpert_1 = require("./healthExpert");
function validateEnv() {
    const required = ['NODE_ENV'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        logger_1.logger.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    }
}
function createAppointmentRequest(patient, appointmentType, options) {
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
function validateAppointmentRequest(request) {
    const errors = [];
    if (!request.patient || !request.patient.name) {
        errors.push('Patient name is required');
    }
    if (!request.appointmentType) {
        errors.push('Appointment type is required');
    }
    if (request.appointmentType === healthExpert_1.AppointmentType.SPECIALIST && !request.specialty) {
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
function getRecommendedSpecialty(symptoms) {
    if (symptoms.length === 0)
        return null;
    const symptomCategories = {
        'chest pain': healthExpert_1.SpecialtyType.CARDIOLOGY,
        'shortness of breath': healthExpert_1.SpecialtyType.PULMONOLOGY,
        'cough': healthExpert_1.SpecialtyType.PULMONOLOGY,
        'headache': healthExpert_1.SpecialtyType.NEUROLOGY,
        'skin rash': healthExpert_1.SpecialtyType.DERMATOLOGY,
        'back pain': healthExpert_1.SpecialtyType.ORTHOPEDICS,
        'joint pain': healthExpert_1.SpecialtyType.RHEUMATOLOGY,
        'anxiety': healthExpert_1.SpecialtyType.MENTAL_HEALTH,
        'depression': healthExpert_1.SpecialtyType.MENTAL_HEALTH,
        'stomach ache': healthExpert_1.SpecialtyType.GASTROENTEROLOGY,
        'nausea': healthExpert_1.SpecialtyType.GASTROENTEROLOGY,
        'allergy': healthExpert_1.SpecialtyType.ALLERGY_IMMUNOLOGY
    };
    const primarySymptom = symptoms[0]?.name.toLowerCase() || '';
    for (const [keyword, specialty] of Object.entries(symptomCategories)) {
        if (primarySymptom.includes(keyword)) {
            return specialty;
        }
    }
    return healthExpert_1.SpecialtyType.GENERAL_MEDICINE;
}
function determineUrgencyFromSymptoms(symptoms) {
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
            return healthExpert_1.UrgencyLevel.EMERGENCY;
        }
        if (symptom.severity === 'severe') {
            return healthExpert_1.UrgencyLevel.URGENT_CARE;
        }
    }
    return healthExpert_1.UrgencyLevel.SCHEDULE_VISIT;
}
function formatAppointmentDetails(appointment) {
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
function formatEnumValue(value) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
function generateAppointmentId() {
    return `APT-${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`;
}
function getAppointmentPreparationInstructions(appointmentType) {
    const instructions = {
        [healthExpert_1.AppointmentType.PRIMARY_CARE]: [
            'Bring your ID and insurance card',
            'List of current medications',
            'List of symptoms and their duration',
            'Any relevant medical records',
            'Questions you want to ask the doctor'
        ],
        [healthExpert_1.AppointmentType.SPECIALIST]: [
            'Referral letter from your primary care doctor (if required)',
            'Insurance card and ID',
            'Complete list of medications',
            'Previous test results or imaging',
            'Detailed symptom history'
        ],
        [healthExpert_1.AppointmentType.URGENT_CARE]: [
            'ID and insurance card',
            'List of medications',
            'Known allergies',
            'Emergency contact information',
            'Payment for copay (if applicable)'
        ],
        [healthExpert_1.AppointmentType.EMERGENCY]: [
            'ID and insurance card',
            'Emergency contact',
            'Current medications list',
            'Known allergies',
            'Any relevant medical history'
        ],
        [healthExpert_1.AppointmentType.TELEMEDICINE]: [
            'Stable internet connection',
            'Camera-enabled device',
            'List of symptoms prepared',
            'Medications list',
            'Quiet, private space for the consultation'
        ],
        [healthExpert_1.AppointmentType.WELLNESS_CHECK]: [
            'Fasting if blood work is scheduled (12 hours)',
            'ID and insurance card',
            'List of questions for your doctor',
            'Updates on unknown changes since your last visit',
            'Comfortable clothing for examination'
        ],
        [healthExpert_1.AppointmentType.FOLLOW_UP]: [
            'Previous test results or imaging',
            'List of unknown new symptoms',
            'Medication list with unknown changes',
            'Questions about your treatment plan',
            'ID and insurance card'
        ]
    };
    return instructions[appointmentType].map((item, i) => `${i + 1}. ${item}`).join('\n');
}
function createPatientProfile(data) {
    return {
        id: (0, uuid_1.v4)(),
        name: data.name,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        gender: data.gender,
        existingConditions: data.existingConditions || [],
        medications: data.medications || [],
        allergies: data.allergies || [],
        emergencyContact: undefined
    };
}
//# sourceMappingURL=expertise.js.map
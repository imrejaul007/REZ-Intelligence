"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendationsForSymptom = getRecommendationsForSymptom;
exports.getLifestyleRecommendations = getLifestyleRecommendations;
exports.getFollowUpRecommendations = getFollowUpRecommendations;
exports.getSpecialistRecommendation = getSpecialistRecommendation;
exports.getPreAppointmentChecklist = getPreAppointmentChecklist;
const healthExpert_1 = require("./healthExpert");
function getRecommendationsForSymptom(symptoms) {
    const recommendations = [];
    const hasRedFlags = checkForRedFlags(symptoms);
    if (hasRedFlags) {
        recommendations.push({
            type: 'urgent',
            title: 'Seek Emergency Care Immediately',
            description: 'Your symptoms may indicate a serious condition requiring immediate medical attention. Please call 911 or go to the nearest emergency room.',
            priority: 'high',
            urgency: healthExpert_1.UrgencyLevel.EMERGENCY,
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
            urgency: healthExpert_1.UrgencyLevel.URGENT_CARE,
            actionRequired: 'Visit urgent care or seek same-day appointment'
        });
    }
    else {
        recommendations.push({
            type: 'appointment',
            title: 'Schedule a Doctor Visit',
            description: 'Consider making an appointment with your healthcare provider to discuss your symptoms further.',
            priority: 'medium',
            urgency: healthExpert_1.UrgencyLevel.SCHEDULE_VISIT,
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
        description: 'Keep a log of your symptoms including when they started, their severity, and any patterns or triggers you notice.',
        priority: 'low'
    });
    return recommendations;
}
function checkForRedFlags(symptoms) {
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
function checkForUrgentSymptoms(symptoms) {
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
function getLifestyleRecommendations() {
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
function getFollowUpRecommendations(appointmentType, symptoms) {
    const recommendations = [];
    if (appointmentType === healthExpert_1.AppointmentType.FOLLOW_UP) {
        recommendations.push({
            type: 'information',
            title: 'Before Your Follow-Up',
            description: 'Prepare a list of any new symptoms, questions for your doctor, and note any changes in your condition since the last visit.',
            priority: 'high'
        });
    }
    recommendations.push({
        type: 'lifestyle',
        title: 'Monitor Your Progress',
        description: 'Keep track of any changes in your symptoms, including improvements or new developments.',
        priority: 'medium'
    });
    recommendations.push({
        type: 'self_care',
        title: 'Continue Self-Care',
        description: 'Continue following any self-care recommendations provided by your healthcare provider.',
        priority: 'medium'
    });
    return recommendations;
}
function getSpecialistRecommendation(symptoms) {
    if (symptoms.length === 0)
        return null;
    const symptomSpecialtyMap = [
        {
            keywords: ['chest pain', 'heart', 'palpitation', 'shortness of breath'],
            specialty: healthExpert_1.SpecialtyType.CARDIOLOGY,
            reason: 'Your symptoms may be related to heart health'
        },
        {
            keywords: ['skin', 'rash', 'acne', 'eczema', 'mole'],
            specialty: healthExpert_1.SpecialtyType.DERMATOLOGY,
            reason: 'Your symptoms may require dermatological evaluation'
        },
        {
            keywords: ['back pain', 'joint', 'bone', 'muscle', 'fracture'],
            specialty: healthExpert_1.SpecialtyType.ORTHOPEDICS,
            reason: 'Your symptoms may be related to musculoskeletal health'
        },
        {
            keywords: ['headache', 'dizziness', 'numbness', 'tingling', 'seizure'],
            specialty: healthExpert_1.SpecialtyType.NEUROLOGY,
            reason: 'Your symptoms may require neurological evaluation'
        },
        {
            keywords: ['stomach', 'nausea', 'vomiting', 'diarrhea', 'constipation'],
            specialty: healthExpert_1.SpecialtyType.GASTROENTEROLOGY,
            reason: 'Your symptoms may be related to digestive health'
        },
        {
            keywords: ['cough', 'breathing', 'lung', 'asthma', 'shortness of breath'],
            specialty: healthExpert_1.SpecialtyType.PULMONOLOGY,
            reason: 'Your symptoms may require pulmonary evaluation'
        },
        {
            keywords: ['anxiety', 'depression', 'mood', 'stress', 'mental health'],
            specialty: healthExpert_1.SpecialtyType.MENTAL_HEALTH,
            reason: 'Your symptoms may benefit from mental health support'
        },
        {
            keywords: ['allergy', 'sneezing', 'itching', 'hives'],
            specialty: healthExpert_1.SpecialtyType.ALLERGY_IMMUNOLOGY,
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
        specialty: healthExpert_1.SpecialtyType.GENERAL_MEDICINE,
        reason: 'Your symptoms require general medical evaluation'
    };
}
function getPreAppointmentChecklist(symptoms) {
    const checklist = [
        'List of current medications',
        'Known allergies',
        'Insurance card and ID',
        'Previous medical records (if relevant)',
        'Emergency contact information'
    ];
    checklist.push('Prepare to describe:', `• Primary symptom: ${symptoms[0]?.name || 'N/A'}`, '• When symptoms started', '• Symptom severity (1-10)', '• Any triggering or relieving factors', '• Any additional symptoms');
    if (symptoms.some(s => s.category === 'mental_health')) {
        checklist.push('For mental health appointments:', '• Thoughts and feelings you want to discuss', '• Recent life changes or stressors', '• Sleep and appetite changes');
    }
    return checklist;
}
//# sourceMappingURL=recommendations.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const healthExpert_1 = require("../services/healthExpert");
const healthIntents_1 = require("../intents/healthIntents");
const expertise_1 = require("../services/expertise");
const recommendations_1 = require("../services/recommendations");
const healthExpert_2 = require("../services/healthExpert");
const knowledge_1 = require("../config/knowledge");
const router = (0, express_1.Router)();
exports.healthRouter = router;
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors.map(e => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    }
                });
            }
            else {
                next(error);
            }
        }
    };
};
const symptomSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    duration: zod_1.z.string().optional(),
    severity: zod_1.z.enum(['minor', 'moderate', 'severe']).optional(),
    additionalSymptoms: zod_1.z.array(zod_1.z.string()).optional(),
    triggeringFactors: zod_1.z.array(zod_1.z.string()).optional()
});
const patientSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1),
    dateOfBirth: zod_1.z.string().optional(),
    gender: zod_1.z.string().optional(),
    existingConditions: zod_1.z.array(zod_1.z.string()).optional(),
    medications: zod_1.z.array(zod_1.z.string()).optional(),
    allergies: zod_1.z.array(zod_1.z.string()).optional(),
    emergencyContact: zod_1.z.object({
        name: zod_1.z.string(),
        phone: zod_1.z.string(),
        relationship: zod_1.z.string()
    }).optional()
});
const healthQuerySchema = zod_1.z.object({
    sessionId: zod_1.z.string().optional(),
    query: zod_1.z.string().min(1).max(2000),
    symptoms: zod_1.z.array(symptomSchema).optional(),
    patient: patientSchema.optional()
});
const appointmentRequestSchema = zod_1.z.object({
    sessionId: zod_1.z.string().optional(),
    patient: patientSchema,
    appointmentType: zod_1.z.nativeEnum(healthExpert_1.AppointmentType),
    specialty: zod_1.z.nativeEnum(healthExpert_1.SpecialtyType).optional(),
    preferredDate: zod_1.z.string().optional(),
    preferredTime: zod_1.z.string().optional(),
    symptoms: zod_1.z.array(symptomSchema).optional(),
    reasonForVisit: zod_1.z.string().optional(),
    isNewPatient: zod_1.z.boolean().optional().default(true),
    insuranceProvider: zod_1.z.string().optional()
});
const symptomQuerySchema = zod_1.z.object({
    symptoms: zod_1.z.array(symptomSchema).min(1)
});
const wellnessQuerySchema = zod_1.z.object({
    category: zod_1.z.enum(['sleep', 'nutrition', 'stress', 'exercise', 'general']).optional(),
    limit: zod_1.z.number().int().min(1).max(20).optional().default(5)
});
router.post('/query', validateRequest(healthQuerySchema), async (req, res, next) => {
    try {
        const { sessionId: providedSessionId, query, symptoms, patient } = req.body;
        const sessionId = providedSessionId || (0, uuid_1.v4)();
        healthExpert_2.logger.info('Health query request received', { sessionId, queryLength: query.length });
        if ((0, healthIntents_1.isEmergencyQuery)(query)) {
            return res.json({
                success: true,
                data: {
                    response: (0, healthIntents_1.getEmergencyMessage)(),
                    isEmergency: true,
                    urgent: true
                },
                meta: {
                    sessionId,
                    timestamp: new Date().toISOString()
                }
            });
        }
        const detectedIntent = (0, healthIntents_1.detectHealthIntent)(query);
        if (detectedIntent) {
            const intentResponse = (0, healthIntents_1.getResponseForIntent)(detectedIntent);
            const symptomInfos = symptoms?.map((s) => ({ ...s, category: 'general' })) || [];
            healthExpert_2.logger.info('Health intent detected', { sessionId, intent: detectedIntent });
            const recommendations = symptomInfos.length > 0
                ? (0, recommendations_1.getRecommendationsForSymptom)(symptomInfos)
                : undefined;
            return res.json({
                success: true,
                data: {
                    response: intentResponse,
                    detectedIntent,
                    recommendations,
                    requiresContext: true
                },
                meta: {
                    sessionId,
                    timestamp: new Date().toISOString()
                }
            });
        }
        let symptomInfos = [];
        if (symptoms && symptoms.length > 0) {
            symptomInfos = symptoms.map((s) => ({
                name: s.name,
                duration: s.duration,
                severity: s.severity,
                additionalSymptoms: s.additionalSymptoms
            }));
        }
        const response = await healthExpert_1.healthExpert.processQuery(query, sessionId, {
            appointmentRequest: patient ? {
                patient,
                appointmentType: healthExpert_1.AppointmentType.PRIMARY_CARE,
                symptoms: symptomInfos
            } : undefined
        });
        if (symptomInfos.length > 0) {
            const _response = response;
            _response.recommendations = (0, recommendations_1.getRecommendationsForSymptom)(symptomInfos);
        }
        return res.json({
            success: true,
            data: {
                response: response.message,
                symptomInfo: response.symptomInfo,
                selfCareTips: response.selfCareTips,
                urgencyLevel: response.urgencyLevel,
                recommendations: response.recommendations,
                wellnessTips: response.wellnessTips,
                disclaimer: response.disclaimer
            },
            meta: {
                sessionId,
                processingTimeMs: response.processingTime,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        healthExpert_2.logger.error('Health query endpoint error', { error });
        return next(error);
    }
});
router.post('/symptoms', validateRequest(symptomQuerySchema), async (req, res, next) => {
    try {
        const { symptoms } = req.body;
        const symptomInfos = symptoms.map((s) => ({
            name: s.name,
            duration: s.duration,
            severity: s.severity,
            additionalSymptoms: s.additionalSymptoms
        }));
        healthExpert_2.logger.info('Symptom analysis request received', { symptomCount: symptoms.length });
        const recommendations = (0, recommendations_1.getRecommendationsForSymptom)(symptomInfos);
        const checklist = (0, recommendations_1.getPreAppointmentChecklist)(symptomInfos);
        const hasRedFlags = recommendations.some(r => r.urgency === healthExpert_1.UrgencyLevel.EMERGENCY || r.urgency === healthExpert_1.UrgencyLevel.URGENT_CARE);
        return res.json({
            success: true,
            data: {
                symptoms: symptomInfos,
                recommendations,
                preAppointmentChecklist: checklist,
                urgencyLevel: hasRedFlags ? 'urgent' : 'routine',
                disclaimer: 'This analysis is for informational purposes only and is not a medical diagnosis. Please consult a healthcare provider.'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        healthExpert_2.logger.error('Symptom endpoint error', { error });
        return next(error);
    }
});
router.post('/appointment', validateRequest(appointmentRequestSchema), async (req, res, next) => {
    try {
        const { sessionId: providedSessionId, patient, appointmentType, specialty, preferredDate, preferredTime, symptoms, reasonForVisit, isNewPatient, insuranceProvider } = req.body;
        const sessionId = providedSessionId || (0, uuid_1.v4)();
        healthExpert_2.logger.info('Appointment booking request received', { sessionId, appointmentType });
        const patientProfile = {
            id: patient.id || (0, uuid_1.v4)(),
            name: patient.name,
            dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth) : undefined,
            gender: patient.gender,
            existingConditions: patient.existingConditions,
            medications: patient.medications,
            allergies: patient.allergies,
            emergencyContact: patient.emergencyContact
        };
        let symptomInfos = [];
        if (symptoms && symptoms.length > 0) {
            symptomInfos = symptoms.map((s) => ({
                name: s.name,
                duration: s.duration,
                severity: s.severity,
                additionalSymptoms: s.additionalSymptoms
            }));
        }
        const recommendedSpecialty = !specialty && symptomInfos.length > 0
            ? (0, expertise_1.getRecommendedSpecialty)(symptomInfos)
            : specialty;
        const urgency = symptomInfos.length > 0
            ? (0, expertise_1.determineUrgencyFromSymptoms)(symptomInfos)
            : healthExpert_1.UrgencyLevel.SCHEDULE_VISIT;
        const appointmentRequest = (0, expertise_1.createAppointmentRequest)(patientProfile, appointmentType, {
            specialty: recommendedSpecialty || specialty,
            preferredDate: preferredDate ? new Date(preferredDate) : undefined,
            preferredTime,
            symptoms: symptomInfos,
            reasonForVisit: reasonForVisit || symptomInfos.map(s => s.name).join(', '),
            isNewPatient,
            insuranceProvider
        });
        const validation = (0, expertise_1.validateAppointmentRequest)(appointmentRequest);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid appointment request',
                    details: validation.errors
                }
            });
        }
        const response = await healthExpert_1.healthExpert.processQuery('book appointment', sessionId, { appointmentRequest });
        const preparationInstructions = (0, expertise_1.getAppointmentPreparationInstructions)(appointmentType);
        res.json({
            success: true,
            data: {
                response: response.message,
                appointment: response.appointment,
                preparationInstructions,
                recommendedSpecialty: recommendedSpecialty,
                urgencyLevel: urgency,
                disclaimer: 'This is an appointment booking service, not medical advice. For emergencies, call 911.'
            },
            meta: {
                sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        healthExpert_2.logger.error('Appointment endpoint error', { error });
        return next(error);
    }
});
router.get('/appointment/:appointmentId', async (req, res, next) => {
    const { appointmentId } = req.params;
    const appointment = await healthExpert_1.healthExpert.getAppointmentById(appointmentId);
    if (!appointment) {
        return res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Appointment with ID ${appointmentId} not found`
            }
        });
    }
    res.json({
        success: true,
        data: {
            appointment,
            details: (0, expertise_1.formatAppointmentDetails)(appointment),
            preparationInstructions: (0, expertise_1.getAppointmentPreparationInstructions)(appointment.appointmentType)
        }
    });
});
router.delete('/appointment/:appointmentId', async (req, res, next) => {
    const { appointmentId } = req.params;
    healthExpert_2.logger.info('Appointment cancellation request received', { appointmentId });
    const success = await healthExpert_1.healthExpert.cancelAppointment(appointmentId);
    if (!success) {
        return res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Appointment with ID ${appointmentId} not found`
            }
        });
    }
    res.json({
        success: true,
        data: {
            message: 'Your appointment has been successfully cancelled.',
            appointmentId
        }
    });
});
router.post('/wellness', validateRequest(wellnessQuerySchema), async (req, res, next) => {
    try {
        const { category, limit } = req.body;
        healthExpert_2.logger.info('Wellness tips request received', { category });
        let tips = knowledge_1.WELLNESS_TIPS;
        if (category) {
            tips = knowledge_1.WELLNESS_TIPS.filter((t) => t.category.toLowerCase() === category.toLowerCase());
        }
        tips = tips.slice(0, limit);
        res.json({
            success: true,
            data: {
                tips,
                count: tips.length,
                disclaimer: 'These wellness tips are general recommendations. Please consult a healthcare provider for personalized advice.'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/intent/:query', async (req, res) => {
    const { query } = req.params;
    const decodedQuery = decodeURIComponent(query);
    const intent = (0, healthIntents_1.detectHealthIntent)(decodedQuery);
    const isEmergency = (0, healthIntents_1.isEmergencyQuery)(decodedQuery);
    const response = intent
        ? (0, healthIntents_1.getResponseForIntent)(intent)
        : 'No specific health intent detected. Feel free to ask about symptoms, appointments, or wellness information.';
    res.json({
        success: true,
        data: {
            query: decodedQuery,
            detectedIntent: intent,
            isEmergency,
            suggestedResponse: isEmergency ? (0, healthIntents_1.getEmergencyMessage)() : response
        }
    });
});
router.get('/appointment-types', async (req, res) => {
    const types = Object.values(healthExpert_1.AppointmentType).map(type => ({
        value: type,
        label: formatLabel(type),
        description: getAppointmentTypeDescription(type)
    }));
    res.json({
        success: true,
        data: { appointmentTypes: types }
    });
});
router.get('/specialties', async (req, res) => {
    const specialties = Object.values(healthExpert_1.SpecialtyType).map(spec => ({
        value: spec,
        label: formatLabel(spec),
        description: getSpecialtyDescription(spec)
    }));
    res.json({
        success: true,
        data: { specialties }
    });
});
router.get('/urgency-levels', async (req, res) => {
    const levels = Object.values(healthExpert_1.UrgencyLevel).map(level => ({
        value: level,
        label: formatLabel(level),
        description: getUrgencyDescription(level),
        actionRequired: getUrgencyAction(level)
    }));
    res.json({
        success: true,
        data: { urgencyLevels: levels }
    });
});
// POST /health/interpret - RisaCare report interpretation endpoint
const reportInterpretationSchema = zod_1.z.object({
    recordType: zod_1.z.string(),
    reportDate: zod_1.z.string(),
    rawText: zod_1.z.string(),
    extractedBiomarkers: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        value: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
        unit: zod_1.z.string().optional(),
        referenceRange: zod_1.z.object({
            min: zod_1.z.number().optional(),
            max: zod_1.z.number().optional()
        }).optional(),
        status: zod_1.z.enum(['normal', 'low', 'high', 'borderline', 'critical']).optional()
    })),
    userContext: zod_1.z.object({
        allergies: zod_1.z.array(zod_1.z.string()).optional(),
        chronicConditions: zod_1.z.array(zod_1.z.string()).optional(),
        currentMedications: zod_1.z.array(zod_1.z.string()).optional(),
        recentSymptoms: zod_1.z.array(zod_1.z.string()).optional(),
        lastCheckup: zod_1.z.string().optional(),
        familyHistory: zod_1.z.array(zod_1.z.string()).optional(),
        age: zod_1.z.number().optional(),
        gender: zod_1.z.string().optional()
    }).optional(),
    sessionId: zod_1.z.string().optional()
});
router.post('/health/interpret', validateRequest(reportInterpretationSchema), async (req, res, next) => {
    try {
        const { recordType, rawText, extractedBiomarkers, userContext } = req.body;
        const sessionId = req.body.sessionId || (0, uuid_1.v4)();
        healthExpert_2.logger.info(`Report interpretation request for ${recordType}`, { sessionId });
        // Transform biomarkers to symptoms for Health Expert
        const symptoms = extractedBiomarkers.map((b) => ({
            name: b.name,
            severity: b.status === 'critical' ? 'severe' : b.status === 'high' || b.status === 'low' ? 'moderate' : 'minor'
        }));
        // Build context for query
        const patientContext = userContext ? {
            name: 'Patient',
            existingConditions: userContext.chronicConditions,
            medications: userContext.currentMedications,
            allergies: userContext.allergies
        } : undefined;
        // Call the main query endpoint
        const queryResponse = await healthExpert_1.healthExpert.processQuery(`Interpret health report: ${rawText || `${extractedBiomarkers.length} biomarkers`}`, sessionId, {
            appointmentRequest: patientContext ? {
                patient: patientContext,
                appointmentType: healthExpert_1.AppointmentType.PRIMARY_CARE,
                symptoms: symptoms
            } : undefined
        });
        // Transform to RisaCare format
        const interpretations = extractedBiomarkers.map((b) => ({
            biomarker: b.name,
            value: String(b.value),
            unit: b.unit,
            referenceRange: b.referenceRange ? `${b.referenceRange.min || 0}-${b.referenceRange.max || 100}` : 'N/A',
            status: b.status || 'normal',
            explanation: `${b.name} level is ${b.status || 'normal'}. ${b.status === 'normal' ? 'This is within expected range.' : 'Please consult your doctor for personalized advice.'}`,
            confidence: 85,
            needsAttention: b.status !== 'normal'
        }));
        // Determine overall assessment
        const abnormalCount = interpretations.filter((i) => i.needsAttention).length;
        const hasCritical = interpretations.some((i) => i.status === 'critical');
        res.json({
            success: true,
            data: {
                interpretations,
                overallAssessment: {
                    summary: queryResponse.message || `Analyzed ${extractedBiomarkers.length} biomarkers from ${recordType}`,
                    needsDoctorConsult: abnormalCount > 0,
                    urgency: hasCritical ? 'high' : abnormalCount > 2 ? 'medium' : 'low'
                },
                riskSignals: interpretations.filter((i) => i.needsAttention).map((i) => ({
                    indicator: `${i.biomarker} is ${i.status}`,
                    action: 'Consult your doctor for personalized advice'
                })),
                confidence: 85
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/emergency-info', async (req, res) => {
    res.json({
        success: true,
        data: {
            emergencyMessage: (0, healthIntents_1.getEmergencyMessage)(),
            redFlagSymptoms: [
                'Chest pain or pressure',
                'Difficulty breathing',
                'Severe bleeding',
                'Loss of consciousness',
                'Signs of stroke (F.A.S.T.)',
                'Severe allergic reactions',
                'High fever with stiff neck',
                'Sudden severe headache'
            ],
            disclaimer: 'If you or someone else is experiencing a medical emergency, call 911 immediately.'
        }
    });
});
function formatLabel(value) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
function getAppointmentTypeDescription(type) {
    const descriptions = {
        [healthExpert_1.AppointmentType.PRIMARY_CARE]: 'General healthcare visits for common illnesses, preventive care, and routine check-ups',
        [healthExpert_1.AppointmentType.SPECIALIST]: 'Appointments with medical specialists for specific health conditions',
        [healthExpert_1.AppointmentType.URGENT_CARE]: 'Same-day care for non-life-threatening conditions that need prompt attention',
        [healthExpert_1.AppointmentType.EMERGENCY]: 'Immediate care for serious, life-threatening conditions (call 911)',
        [healthExpert_1.AppointmentType.TELEMEDICINE]: 'Video or phone consultations with healthcare providers from home',
        [healthExpert_1.AppointmentType.WELLNESS_CHECK]: 'Routine preventive care visits and health screenings',
        [healthExpert_1.AppointmentType.FOLLOW_UP]: 'Return visits to continue treatment or monitor progress'
    };
    return descriptions[type];
}
function getSpecialtyDescription(spec) {
    const descriptions = {
        [healthExpert_1.SpecialtyType.GENERAL_MEDICINE]: 'General medical care for various health concerns',
        [healthExpert_1.SpecialtyType.INTERNAL_MEDICINE]: 'Prevention, diagnosis, and treatment of adult diseases',
        [healthExpert_1.SpecialtyType.FAMILY_MEDICINE]: 'Comprehensive healthcare for patients of all ages',
        [healthExpert_1.SpecialtyType.PEDIATRICS]: 'Medical care for infants, children, and adolescents',
        [healthExpert_1.SpecialtyType.CARDIOLOGY]: 'Heart and cardiovascular system conditions',
        [healthExpert_1.SpecialtyType.DERMATOLOGY]: 'Skin, hair, and nail conditions',
        [healthExpert_1.SpecialtyType.ORTHOPEDICS]: 'Bone, joint, and muscle conditions',
        [healthExpert_1.SpecialtyType.NEUROLOGY]: 'Brain, spine, and nervous system conditions',
        [healthExpert_1.SpecialtyType.GASTROENTEROLOGY]: 'Digestive system conditions',
        [healthExpert_1.SpecialtyType.PULMONOLOGY]: 'Lung and respiratory conditions',
        [healthExpert_1.SpecialtyType.MENTAL_HEALTH]: 'Psychological and emotional well-being',
        [healthExpert_1.SpecialtyType.GYNECOLOGY]: 'Women\'s reproductive health',
        [healthExpert_1.SpecialtyType.UROLOGY]: 'Urinary tract and male reproductive health',
        [healthExpert_1.SpecialtyType.ENDOCRINOLOGY]: 'Hormone and metabolic conditions',
        [healthExpert_1.SpecialtyType.RHEUMATOLOGY]: 'Autoimmune and inflammatory conditions',
        [healthExpert_1.SpecialtyType.ALLERGY_IMMUNOLOGY]: 'Allergies and immune system disorders'
    };
    return descriptions[spec];
}
function getUrgencyDescription(level) {
    const descriptions = {
        [healthExpert_1.UrgencyLevel.SELF_CARE]: 'Manageable at home with rest and self-care',
        [healthExpert_1.UrgencyLevel.SCHEDULE_VISIT]: 'Should be evaluated within a few days to a week',
        [healthExpert_1.UrgencyLevel.SAME_DAY_APPOINTMENT]: 'Should be seen today or tomorrow',
        [healthExpert_1.UrgencyLevel.URGENT_CARE]: 'Requires prompt medical attention today',
        [healthExpert_1.UrgencyLevel.EMERGENCY]: 'Immediate life-saving care needed - call 911'
    };
    return descriptions[level];
}
function getUrgencyAction(level) {
    const actions = {
        [healthExpert_1.UrgencyLevel.SELF_CARE]: 'Rest, monitor symptoms, use self-care measures',
        [healthExpert_1.UrgencyLevel.SCHEDULE_VISIT]: 'Schedule appointment with your healthcare provider',
        [healthExpert_1.UrgencyLevel.SAME_DAY_APPOINTMENT]: 'Contact your provider for same-day availability',
        [healthExpert_1.UrgencyLevel.URGENT_CARE]: 'Visit urgent care center or emergency room',
        [healthExpert_1.UrgencyLevel.EMERGENCY]: 'Call 911 or go to nearest emergency room immediately'
    };
    return actions[level];
}
//# sourceMappingURL=health.routes.js.map
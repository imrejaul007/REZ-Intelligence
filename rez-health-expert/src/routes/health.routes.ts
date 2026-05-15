import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  healthExpert,
  PatientProfile,
  AppointmentType,
  SpecialtyType,
  UrgencyLevel,
  SymptomInfo,
  HealthResponse
} from '../services/healthExpert.js';
import {
  detectHealthIntent,
  getResponseForIntent,
  isEmergencyQuery,
  getEmergencyMessage,
  HealthIntent
} from '../intents/healthIntents.js';
import {
  createAppointmentRequest,
  validateAppointmentRequest,
  getRecommendedSpecialty,
  determineUrgencyFromSymptoms,
  formatAppointmentDetails,
  getAppointmentPreparationInstructions
} from '../services/expertise.js';
import { getRecommendationsForSymptom, getPreAppointmentChecklist } from '../services/recommendations.js';
import { logger } from '../services/healthExpert.js';
import { WELLNESS_TIPS } from '../config/knowledge.js';

const router = Router();

const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
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
      } else {
        next(error);
      }
    }
  };
};

const symptomSchema = z.object({
  name: z.string().min(1),
  duration: z.string().optional(),
  severity: z.enum(['minor', 'moderate', 'severe']).optional(),
  additionalSymptoms: z.array(z.string()).optional(),
  triggeringFactors: z.array(z.string()).optional()
});

const patientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  existingConditions: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string()
  }).optional()
});

const healthQuerySchema = z.object({
  sessionId: z.string().optional(),
  query: z.string().min(1).max(2000),
  symptoms: z.array(symptomSchema).optional(),
  patient: patientSchema.optional()
});

const appointmentRequestSchema = z.object({
  sessionId: z.string().optional(),
  patient: patientSchema,
  appointmentType: z.nativeEnum(AppointmentType),
  specialty: z.nativeEnum(SpecialtyType).optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  symptoms: z.array(symptomSchema).optional(),
  reasonForVisit: z.string().optional(),
  isNewPatient: z.boolean().optional().default(true),
  insuranceProvider: z.string().optional()
});

const symptomQuerySchema = z.object({
  symptoms: z.array(symptomSchema).min(1)
});

const wellnessQuerySchema = z.object({
  category: z.enum(['sleep', 'nutrition', 'stress', 'exercise', 'general']).optional(),
  limit: z.number().int().min(1).max(20).optional().default(5)
});

router.post('/query', validateRequest(healthQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, query, symptoms, patient } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Health query request received', { sessionId, queryLength: query.length });

    if (isEmergencyQuery(query)) {
      return res.json({
        success: true,
        data: {
          response: getEmergencyMessage(),
          isEmergency: true,
          urgent: true
        },
        meta: {
          sessionId,
          timestamp: new Date().toISOString()
        }
      });
    }

    const detectedIntent = detectHealthIntent(query);

    if (detectedIntent) {
      const intentResponse = getResponseForIntent(detectedIntent);
      const symptomInfos = symptoms?.map((s: any) => ({ ...s, category: 'general' as const })) || [];

      logger.info('Health intent detected', { sessionId, intent: detectedIntent });

      const recommendations = symptomInfos.length > 0
        ? getRecommendationsForSymptom(symptomInfos)
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

    let symptomInfos: SymptomInfo[] = [];
    if (symptoms && symptoms.length > 0) {
      symptomInfos = symptoms.map((s: any) => ({
        name: s.name,
        duration: s.duration,
        severity: s.severity as any,
        additionalSymptoms: s.additionalSymptoms
      }));
    }

    const response: HealthResponse = await healthExpert.processQuery(query, sessionId, {
      appointmentRequest: patient ? {
        patient,
        appointmentType: AppointmentType.PRIMARY_CARE,
        symptoms: symptomInfos
      } : undefined
    });

    if (symptomInfos.length > 0) {
      response.recommendations = getRecommendationsForSymptom(symptomInfos) as any;
    }

    res.json({
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

  } catch (error) {
    logger.error('Health query endpoint error', { error });
    next(error);
  }
});

router.post('/symptoms', validateRequest(symptomQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { symptoms } = req.body;

    const symptomInfos: SymptomInfo[] = symptoms.map((s: any) => ({
      name: s.name,
      duration: s.duration,
      severity: s.severity as any,
      additionalSymptoms: s.additionalSymptoms
    }));

    logger.info('Symptom analysis request received', { symptomCount: symptoms.length });

    const recommendations = getRecommendationsForSymptom(symptomInfos);
    const checklist = getPreAppointmentChecklist(symptomInfos);

    const hasRedFlags = recommendations.some(r => r.urgency === UrgencyLevel.EMERGENCY || r.urgency === UrgencyLevel.URGENT_CARE);

    res.json({
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

  } catch (error) {
    logger.error('Symptom endpoint error', { error });
    next(error);
  }
});

router.post('/appointment', validateRequest(appointmentRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      sessionId: providedSessionId,
      patient,
      appointmentType,
      specialty,
      preferredDate,
      preferredTime,
      symptoms,
      reasonForVisit,
      isNewPatient,
      insuranceProvider
    } = req.body;

    const sessionId = providedSessionId || uuidv4();

    logger.info('Appointment booking request received', { sessionId, appointmentType });

    const patientProfile: PatientProfile = {
      id: patient.id || uuidv4(),
      name: patient.name,
      dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth) : undefined,
      gender: patient.gender,
      existingConditions: patient.existingConditions,
      medications: patient.medications,
      allergies: patient.allergies,
      emergencyContact: patient.emergencyContact
    };

    let symptomInfos: SymptomInfo[] = [];
    if (symptoms && symptoms.length > 0) {
      symptomInfos = symptoms.map((s: any) => ({
        name: s.name,
        duration: s.duration,
        severity: s.severity as any,
        additionalSymptoms: s.additionalSymptoms
      }));
    }

    const recommendedSpecialty = !specialty && symptomInfos.length > 0
      ? getRecommendedSpecialty(symptomInfos)
      : specialty;

    const urgency = symptomInfos.length > 0
      ? determineUrgencyFromSymptoms(symptomInfos)
      : UrgencyLevel.SCHEDULE_VISIT;

    const appointmentRequest = createAppointmentRequest(patientProfile, appointmentType, {
      specialty: recommendedSpecialty || specialty,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      preferredTime,
      symptoms: symptomInfos,
      reasonForVisit: reasonForVisit || symptomInfos.map(s => s.name).join(', '),
      isNewPatient,
      insuranceProvider
    });

    const validation = validateAppointmentRequest(appointmentRequest);
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

    const response = await healthExpert.processQuery('book appointment', sessionId, { appointmentRequest });

    const preparationInstructions = getAppointmentPreparationInstructions(appointmentType);

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

  } catch (error) {
    logger.error('Appointment endpoint error', { error });
    next(error);
  }
});

router.get('/appointment/:appointmentId', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;

  const appointment = await healthExpert.getAppointmentById(appointmentId);

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
      details: formatAppointmentDetails(appointment),
      preparationInstructions: getAppointmentPreparationInstructions(appointment.appointmentType)
    }
  });
});

router.delete('/appointment/:appointmentId', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;

  logger.info('Appointment cancellation request received', { appointmentId });

  const success = await healthExpert.cancelAppointment(appointmentId);

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

router.post('/wellness', validateRequest(wellnessQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, limit } = req.body;

    logger.info('Wellness tips request received', { category });

    let tips = WELLNESS_TIPS;

    if (category) {
      tips = WELLNESS_TIPS.filter((t) => t.category.toLowerCase() === category.toLowerCase());
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

  } catch (error) {
    next(error);
  }
});

router.get('/intent/:query', async (req: Request, res: Response) => {
  const { query } = req.params;
  const decodedQuery = decodeURIComponent(query);

  const intent = detectHealthIntent(decodedQuery);
  const isEmergency = isEmergencyQuery(decodedQuery);
  const response = intent
    ? getResponseForIntent(intent)
    : 'No specific health intent detected. Feel free to ask about symptoms, appointments, or wellness information.';

  res.json({
    success: true,
    data: {
      query: decodedQuery,
      detectedIntent: intent,
      isEmergency,
      suggestedResponse: isEmergency ? getEmergencyMessage() : response
    }
  });
});

router.get('/appointment-types', async (req: Request, res: Response) => {
  const types = Object.values(AppointmentType).map(type => ({
    value: type,
    label: formatLabel(type),
    description: getAppointmentTypeDescription(type)
  }));

  res.json({
    success: true,
    data: { appointmentTypes: types }
  });
});

router.get('/specialties', async (req: Request, res: Response) => {
  const specialties = Object.values(SpecialtyType).map(spec => ({
    value: spec,
    label: formatLabel(spec),
    description: getSpecialtyDescription(spec)
  }));

  res.json({
    success: true,
    data: { specialties }
  });
});

router.get('/urgency-levels', async (req: Request, res: Response) => {
  const levels = Object.values(UrgencyLevel).map(level => ({
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

router.get('/emergency-info', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      emergencyMessage: getEmergencyMessage(),
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

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getAppointmentTypeDescription(type: AppointmentType): string {
  const descriptions: Record<AppointmentType, string> = {
    [AppointmentType.PRIMARY_CARE]: 'General healthcare visits for common illnesses, preventive care, and routine check-ups',
    [AppointmentType.SPECIALIST]: 'Appointments with medical specialists for specific health conditions',
    [AppointmentType.URGENT_CARE]: 'Same-day care for non-life-threatening conditions that need prompt attention',
    [AppointmentType.EMERGENCY]: 'Immediate care for serious, life-threatening conditions (call 911)',
    [AppointmentType.TELEMEDICINE]: 'Video or phone consultations with healthcare providers from home',
    [AppointmentType.WELLNESS_CHECK]: 'Routine preventive care visits and health screenings',
    [AppointmentType.FOLLOW_UP]: 'Return visits to continue treatment or monitor progress'
  };
  return descriptions[type];
}

function getSpecialtyDescription(spec: SpecialtyType): string {
  const descriptions: Record<SpecialtyType, string> = {
    [SpecialtyType.GENERAL_MEDICINE]: 'General medical care for various health concerns',
    [SpecialtyType.INTERNAL_MEDICINE]: 'Prevention, diagnosis, and treatment of adult diseases',
    [SpecialtyType.FAMILY_MEDICINE]: 'Comprehensive healthcare for patients of all ages',
    [SpecialtyType.PEDIATRICS]: 'Medical care for infants, children, and adolescents',
    [SpecialtyType.CARDIOLOGY]: 'Heart and cardiovascular system conditions',
    [SpecialtyType.DERMATOLOGY]: 'Skin, hair, and nail conditions',
    [SpecialtyType.ORTHOPEDICS]: 'Bone, joint, and muscle conditions',
    [SpecialtyType.NEUROLOGY]: 'Brain, spine, and nervous system conditions',
    [SpecialtyType.GASTROENTEROLOGY]: 'Digestive system conditions',
    [SpecialtyType.PULMONOLOGY]: 'Lung and respiratory conditions',
    [SpecialtyType.MENTAL_HEALTH]: 'Psychological and emotional well-being',
    [SpecialtyType.GYNECOLOGY]: 'Women\'s reproductive health',
    [SpecialtyType.UROLOGY]: 'Urinary tract and male reproductive health',
    [SpecialtyType.ENDOCRINOLOGY]: 'Hormone and metabolic conditions',
    [SpecialtyType.RHEUMATOLOGY]: 'Autoimmune and inflammatory conditions',
    [SpecialtyType.ALLERGY_IMMUNOLOGY]: 'Allergies and immune system disorders'
  };
  return descriptions[spec];
}

function getUrgencyDescription(level: UrgencyLevel): string {
  const descriptions: Record<UrgencyLevel, string> = {
    [UrgencyLevel.SELF_CARE]: 'Manageable at home with rest and self-care',
    [UrgencyLevel.SCHEDULE_VISIT]: 'Should be evaluated within a few days to a week',
    [UrgencyLevel.SAME_DAY_APPOINTMENT]: 'Should be seen today or tomorrow',
    [UrgencyLevel.URGENT_CARE]: 'Requires prompt medical attention today',
    [UrgencyLevel.EMERGENCY]: 'Immediate life-saving care needed - call 911'
  };
  return descriptions[level];
}

function getUrgencyAction(level: UrgencyLevel): string {
  const actions: Record<UrgencyLevel, string> = {
    [UrgencyLevel.SELF_CARE]: 'Rest, monitor symptoms, use self-care measures',
    [UrgencyLevel.SCHEDULE_VISIT]: 'Schedule appointment with your healthcare provider',
    [UrgencyLevel.SAME_DAY_APPOINTMENT]: 'Contact your provider for same-day availability',
    [UrgencyLevel.URGENT_CARE]: 'Visit urgent care center or emergency room',
    [UrgencyLevel.EMERGENCY]: 'Call 911 or go to nearest emergency room immediately'
  };
  return actions[level];
}

export { router as healthRouter };

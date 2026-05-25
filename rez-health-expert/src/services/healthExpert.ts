import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { Symptom, SYMPTOM_DATABASE, WELLNESS_TIPS, HEALTH_GLOSSARY } from '../config/knowledge.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (metadata.stack) {
    msg += `\n${metadata.stack}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
    }),
    new winston.transports.File({
      filename: 'logs/health-expert-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/health-expert.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

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

class HealthExpertAgent {
  private readonly agentId: string;
  private readonly agentName: string;
  private sessionHistory: Map<string, HealthSession>;
  private appointments: Map<string, Appointment>;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Health Expert';
    this.sessionHistory = new Map();
    this.appointments = new Map();
    logger.info('Health Expert Agent initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  async processQuery(
    query: string,
    sessionId: string,
    context?: HealthContext
  ): Promise<HealthResponse> {
    const startTime = Date.now();
    logger.info('Processing health query', { sessionId, queryLength: query.length });

    try {
      const intent = this.identifyIntent(query);
      let response: HealthResponse;

      switch (intent) {
        case 'symptom_inquiry':
          response = await this.handleSymptomInquiry(query);
          break;
        case 'appointment_booking':
          response = await this.handleAppointmentBooking(context?.appointmentRequest);
          break;
        case 'wellness_info':
          response = await this.handleWellnessRequest(query);
          break;
        case 'health_information':
          response = await this.handleHealthInformation(query);
          break;
        case 'medication_info':
          response = await this.handleMedicationInfo(query);
          break;
        default:
          response = await this.handleGeneralHealthQuery(query);
      }

      this.recordSession(sessionId, intent, query);
      response.processingTime = Date.now() - startTime;

      return response;

    } catch (error) {
      logger.error('Error processing health query', { error, sessionId });
      throw error;
    }
  }

  private identifyIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (this.matches(lowerQuery, ['symptom', 'feel', 'hurt', 'pain', 'ache', 'feeling', 'sick', 'unwell'])) {
      return 'symptom_inquiry';
    }
    if (this.matches(lowerQuery, ['appointment', 'schedule', 'booking', 'see a doctor', 'visit', 'book'])) {
      return 'appointment_booking';
    }
    if (this.matches(lowerQuery, ['wellness', 'healthy', 'prevent', 'tips', 'advice', 'lifestyle'])) {
      return 'wellness_info';
    }
    if (this.matches(lowerQuery, ['information', 'explain', 'what is', 'tell me about', 'learn'])) {
      return 'health_information';
    }
    if (this.matches(lowerQuery, ['medication', 'medicine', 'drug', 'prescription', 'dosage'])) {
      return 'medication_info';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private async handleSymptomInquiry(query: string): Promise<HealthResponse> {
    const symptom = this.findMatchingSymptom(query);

    if (!symptom) {
      return {
        success: true,
        message: this.getGeneralSymptomGuidance(query),
        disclaimer: 'This information is for educational purposes only and is not a substitute for professional medical advice.'
      };
    }

    const hasRedFlags = this.checkForRedFlags(symptom, query);
    const urgencyLevel = hasRedFlags ? UrgencyLevel.EMERGENCY : symptom.urgencyLevel;

    const response: HealthResponse = {
      success: true,
      message: this.formatSymptomResponse(symptom, query),
      symptomInfo: symptom,
      selfCareTips: symptom.selfCareTips,
      urgencyLevel,
      recommendations: this.generateRecommendations(symptom, urgencyLevel),
      disclaimer: 'This information is for educational purposes only. Please consult a healthcare provider for proper diagnosis and treatment.'
    };

    return response;
  }

  private findMatchingSymptom(query: string): SymptomInfo | null {
    const lowerQuery = query.toLowerCase();

    for (const symptom of SYMPTOM_DATABASE) {
      if (lowerQuery.includes(symptom.name.toLowerCase())) {
        return symptom;
      }

      for (const keyword of symptom.name.toLowerCase().split(' ')) {
        if (lowerQuery.includes(keyword) && keyword.length > 3) {
          return symptom;
        }
      }
    }

    return null;
  }

  private checkForRedFlags(symptom: SymptomInfo, query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const redFlagKeywords = [
      'chest pain', 'difficulty breathing', 'can\'t breathe', 'severe',
      'emergency', 'urgent', '911', 'worse', 'getting worse'
    ];

    if (redFlagKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return true;
    }

    return false;
  }

  private formatSymptomResponse(symptom: SymptomInfo, query: string): string {
    let response = `## Understanding ${symptom.name}\n\n`;
    response += `${symptom.description}\n\n`;

    response += `### Possible Causes\n`;
    symptom.possibleCauses.forEach(cause => {
      response += `• ${cause}\n`;
    });
    response += '\n';

    response += `### Self-Care Recommendations\n`;
    symptom.selfCareTips.forEach((tip, index) => {
      response += `${index + 1}. ${tip}\n`;
    });
    response += '\n';

    if (symptom.associatedSymptoms && symptom.associatedSymptoms.length > 0) {
      response += `### Associated Symptoms to Watch For\n`;
      symptom.associatedSymptoms.forEach(s => {
        response += `• ${s}\n`;
      });
      response += '\n';
    }

    response += `### When to Seek Medical Care\n`;
    response += `${symptom.whenToSeekCare}\n\n`;

    if (symptom.redFlags && symptom.redFlags.length > 0) {
      response += `### Red Flag Symptoms (Seek Immediate Care)\n`;
      symptom.redFlags.forEach(flag => {
        response += `⚠️ ${flag}\n`;
      });
    }

    return response;
  }

  private generateRecommendations(symptom: SymptomInfo, urgency: UrgencyLevel): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (urgency === UrgencyLevel.EMERGENCY) {
      recommendations.push({
        type: 'urgent',
        title: 'Seek Immediate Medical Attention',
        description: 'Your symptoms may require emergency care. Please call 911 or go to the nearest emergency room immediately.',
        priority: 'high',
        actionRequired: 'Call 911 or go to emergency room'
      });
    } else if (urgency === UrgencyLevel.URGENT_CARE) {
      recommendations.push({
        type: 'appointment',
        title: 'Visit Urgent Care Today',
        description: 'Consider visiting an urgent care center or seeking same-day medical attention.',
        priority: 'high',
        actionRequired: 'Visit urgent care center'
      });
    } else if (urgency === UrgencyLevel.SAME_DAY_APPOINTMENT) {
      recommendations.push({
        type: 'appointment',
        title: 'Schedule a Same-Day Appointment',
        description: 'Consider seeing a healthcare provider today for evaluation.',
        priority: 'high',
        actionRequired: 'Contact your healthcare provider'
      });
    } else if (urgency === UrgencyLevel.SCHEDULE_VISIT) {
      recommendations.push({
        type: 'appointment',
        title: 'Schedule a Doctor Visit',
        description: 'Make an appointment with your healthcare provider within the next few days if symptoms persist.',
        priority: 'medium',
        actionRequired: 'Schedule appointment'
      });
    } else {
      recommendations.push({
        type: 'self_care',
        title: 'Self-Care at Home',
        description: 'Try the self-care tips provided. If symptoms worsen or persist, consult a healthcare provider.',
        priority: 'low',
        actionRequired: 'Monitor symptoms'
      });
    }

    recommendations.push({
      type: 'information',
      title: 'Track Your Symptoms',
      description: 'Keep a log of your symptoms, including when they started, their severity, and unknown patterns you notice.',
      priority: 'low'
    });

    return recommendations;
  }

  private getGeneralSymptomGuidance(query: string): string {
    return `Thank you for sharing your concern. I understand you're experiencing some health symptoms.\n\n` +
      `To help you better, could you provide more details about:\n\n` +
      `• What specific symptoms are you experiencing?\n` +
      `• How long have you had these symptoms?\n` +
      `• How severe are they (mild, moderate, severe)?\n` +
      `• Are there unknown other symptoms accompanying them?\n\n` +
      `Based on your description, I can provide more specific guidance and help determine if you need to see a healthcare provider.\n\n` +
      `**Remember**: If you're experiencing unknown emergency symptoms like chest pain, difficulty breathing, or sudden severe symptoms, please seek immediate medical attention by calling 911 or going to the nearest emergency room.`;
  }

  private async handleAppointmentBooking(request?: AppointmentRequest): Promise<HealthResponse> {
    if (!request) {
      return {
        success: true,
        message: `I'd be happy to help you schedule a medical appointment! To get started, I'll need some information:\n\n` +
          `1. **Patient Information**: Your name and contact details\n` +
          `2. **Type of Care**: Primary care, specialist, or urgent care?\n` +
          `3. **Reason for Visit**: What brings you in today?\n` +
          `4. **Preferred Dates/Times**: When would you like to be seen?\n` +
          `5. **Insurance Information**: Who is your insurance provider?\n\n` +
          `Please provide these details, and I'll help find the right appointment for you!`,
        disclaimer: 'This is an appointment request service, not a substitute for medical advice.'
      };
    }

    const appointment: Appointment = {
      id: uuidv4(),
      patientId: request.patient.id,
      appointmentType: request.appointmentType,
      specialty: request.specialty,
      scheduledDate: request.preferredDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledTime: request.preferredTime || '10:00 AM',
      status: 'scheduled',
      reasonForVisit: request.reasonForVisit || 'General consultation',
      createdAt: new Date()
    };

    this.appointments.set(appointment.id, appointment);

    const urgencyMessage = this.getAppointmentUrgencyMessage(request.appointmentType);

    return {
      success: true,
      message: `I've successfully scheduled your appointment!\n\n` +
        `**Appointment Details**\n` +
        `• Date: ${appointment.scheduledDate.toLocaleDateString()}\n` +
        `• Time: ${appointment.scheduledTime}\n` +
        `• Type: ${this.formatEnumValue(request.appointmentType)}\n` +
        `• Reason: ${appointment.reasonForVisit}\n\n` +
        `${urgencyMessage}\n\n` +
        `You'll receive a confirmation shortly. If you need to reschedule or have unknown questions, please let me know!\n\n` +
        `**Reminder**: Please bring your insurance card and a list of unknown medications you're currently taking.`,
      appointment,
      disclaimer: 'This appointment confirmation is for planning purposes. For medical emergencies, always call 911.'
    };
  }

  private getAppointmentUrgencyMessage(type: AppointmentType): string {
    switch (type) {
      case AppointmentType.EMERGENCY:
        return '⚠️ **URGENT**: Please proceed to the nearest emergency room immediately.';
      case AppointmentType.URGENT_CARE:
        return 'Please try to arrive 15-30 minutes before your appointment time.';
      case AppointmentType.PRIMARY_CARE:
        return 'Please arrive 10-15 minutes early to complete unknown necessary paperwork.';
      default:
        return 'Please arrive on time for your appointment.';
    }
  }

  private async handleWellnessRequest(query: string): Promise<HealthResponse> {
    const lowerQuery = query.toLowerCase();

    interface WellnessTipItem {
      id: string;
      category: string;
      title: string;
      description: string;
      tips: string[];
    }

    let matchingTips: WellnessTipItem[] = [...WELLNESS_TIPS];

    if (lowerQuery.includes('sleep')) {
      matchingTips = matchingTips.filter((t) => t.category.toLowerCase() === 'sleep');
    } else if (lowerQuery.includes('nutrition') || lowerQuery.includes('diet') || lowerQuery.includes('eat')) {
      matchingTips = matchingTips.filter((t) => t.category.toLowerCase() === 'nutrition');
    } else if (lowerQuery.includes('stress') || lowerQuery.includes('anxiety')) {
      matchingTips = matchingTips.filter((t) => t.category.toLowerCase() === 'stress management');
    } else if (lowerQuery.includes('exercise') || lowerQuery.includes('activity') || lowerQuery.includes('fitness')) {
      matchingTips = matchingTips.filter((t) => t.category.toLowerCase() === 'physical activity');
    }

    if (matchingTips.length === 0) {
      matchingTips = [...WELLNESS_TIPS];
    }

    let message = `Here are some wellness tips for you!\n\n`;

    matchingTips.forEach((tip: WellnessTipItem) => {
      message += `### ${tip.title}\n`;
      message += `${tip.description}\n\n`;
      message += `**Tips**:\n`;
      tip.tips.forEach((t: string, index: number) => {
        message += `${index + 1}. ${t}\n`;
      });
      message += '\n---\n\n';
    });

    return {
      success: true,
      message,
      wellnessTips: matchingTips,
      disclaimer: 'These wellness tips are general recommendations. Please consult a healthcare provider for personalized advice.'
    };
  }

  private async handleHealthInformation(query: string): Promise<HealthResponse> {
    const lowerQuery = query.toLowerCase();

    const matchingTerms = HEALTH_GLOSSARY.filter((term: { term: string; definition: string }) => {
      return lowerQuery.includes(term.term.toLowerCase());
    });

    if (matchingTerms.length > 0) {
      let message = `Here's information on health terms you asked about:\n\n`;

      matchingTerms.forEach((term: { term: string; definition: string }) => {
        message += `**${term.term}**: ${term.definition}\n\n`;
      });

      return {
        success: true,
        message,
        disclaimer: 'This information is for educational purposes only and should not replace professional medical advice.'
      };
    }

    return {
      success: true,
      message: `I can help explain various health topics! Here are some areas I can provide information about:\n\n` +
        `• Common symptoms and what they might mean\n` +
        `• General wellness and preventive care tips\n` +
        `• Health terminology and definitions\n` +
        `• When to seek medical attention\n\n` +
        `What would you like to learn more about?`,
      disclaimer: 'This information is for educational purposes only and should not replace professional medical advice.'
    };
  }

  private async handleMedicationInfo(query: string): Promise<HealthResponse> {
    return {
      success: true,
      message: `For medication-related questions, I recommend the following:\n\n` +
        `**Important**: I cannot provide specific medication recommendations, dosages, or prescriptions. For medication information:\n\n` +
        `1. **Consult Your Healthcare Provider**: They can recommend appropriate medications based on your specific situation.\n\n` +
        `2. **Ask Your Pharmacist**: Pharmacists are excellent resources for medication information, side effects, and interactions.\n\n` +
        `3. **Use Reputable Sources**: Visit the FDA website or other official health resources for general medication information.\n\n` +
        `**If You Have Questions About a Specific Medication**:\n` +
        `• What is this medication for?\n` +
        `• How should I take it?\n` +
        `• What are the side effects?\n` +
        `• Does it interact with other medications?\n\n` +
        `Please consult your healthcare provider or pharmacist for personalized medication guidance.`,
      disclaimer: 'I cannot provide medical diagnoses, prescriptions, or specific medication recommendations. Always consult a healthcare professional.'
    };
  }

  private async handleGeneralHealthQuery(query: string): Promise<HealthResponse> {
    return {
      success: true,
      message: `Hello! I'm your REZ Health Expert, here to help you with your health questions and concerns.\n\n` +
        `I can assist you with:\n\n` +
        `**Symptom Information**: Describe your symptoms, and I'll provide general guidance about what they might indicate and when to seek care.\n\n` +
        `**Appointment Scheduling**: I can help you book appointments with healthcare providers for various types of care.\n\n` +
        `**Wellness Tips**: Get general advice on sleep, nutrition, stress management, and staying healthy.\n\n` +
        `**Health Education**: Learn about common health topics, symptoms, and medical terminology.\n\n` +
        `**Important Reminder**: While I can provide helpful information, I'm not a substitute for professional medical care. Always consult a healthcare provider for diagnosis, treatment, and personalized medical advice.\n\n` +
        `**Emergency Situations**: If you're experiencing a medical emergency (chest pain, difficulty breathing, severe bleeding, signs of stroke), please call 911 or go to the nearest emergency room immediately.\n\n` +
        `How can I help you today?`,
      disclaimer: 'This service provides general health information and appointment scheduling assistance. It is not a substitute for professional medical advice, diagnosis, or treatment.'
    };
  }

  private formatEnumValue(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private recordSession(sessionId: string, intent: string, query: string): void {
    const session: HealthSession = {
      id: sessionId,
      intent,
      query,
      timestamp: new Date()
    };

    this.sessionHistory.set(sessionId, session);

    if (this.sessionHistory.size > 100) {
      const firstKey = this.sessionHistory.keys().next().value;
      if (firstKey) {
        this.sessionHistory.delete(firstKey);
      }
    }
  }

  async getAppointmentById(appointmentId: string): Promise<Appointment | null> {
    return this.appointments.get(appointmentId) || null;
  }

  async cancelAppointment(appointmentId: string): Promise<boolean> {
    const appointment = this.appointments.get(appointmentId);
    if (appointment) {
      appointment.status = 'cancelled';
      this.appointments.set(appointmentId, appointment);
      return true;
    }
    return false;
  }
}

interface HealthSession {
  id: string;
  intent: string;
  query: string;
  timestamp: Date;
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

export const healthExpert = new HealthExpertAgent();

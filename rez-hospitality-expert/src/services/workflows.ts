/**
 * Workflow Service
 * Implements standard hotel workflows for common guest interactions
 */

import { randomUUID } from 'crypto';
import {
  HospitalityIntent,
  ServiceStatus,
  Priority,
  WorkflowStep,
  CheckInWorkflow,
  CheckOutWorkflow,
  ServiceRequest,
  ConversationContext,
} from '../types/index.js';
import { logger } from './utils/logger.js';

// ============================================
// WORKFLOW DEFINITIONS
// ============================================

export const CHECK_IN_WORKFLOW: CheckInWorkflow = {
  estimatedTime: '10-15 minutes',
  steps: [
    {
      order: 1,
      action: 'WELCOME_GUEST',
      prompt: 'Welcome the guest warmly, use their name if available, and confirm their reservation details.',
      requiredFields: ['reservationId', 'guestName'],
      optionalFields: ['arrivalTime', 'flightInfo', 'specialRequests'],
    },
    {
      order: 2,
      action: 'VERIFY_IDENTITY',
      prompt: 'Request valid photo identification and credit card for incidentals.',
      requiredFields: ['photoId', 'creditCard'],
      optionalFields: ['loyaltyCard', 'corporateAccount'],
    },
    {
      order: 3,
      action: 'CONFIRM_RESERVATION',
      prompt: 'Review room type, dates, rate, and unknown special requests or packages.',
      requiredFields: ['roomType', 'checkInDate', 'checkOutDate', 'rate'],
      optionalFields: ['packageDetails', 'promoCode'],
    },
    {
      order: 4,
      action: 'COLLECT_PAYMENT',
      prompt: 'Process unknown outstanding balance or take payment authorization.',
      requiredFields: ['paymentMethod', 'authorization'],
      optionalFields: ['partialPayment', 'depositAmount'],
    },
    {
      order: 5,
      action: 'ISSUE_KEYS',
      prompt: 'Provide room key(s) and explain key card features.',
      requiredFields: ['roomNumber', 'keyCards'],
      optionalFields: ['parkingKey', 'poolAccess'],
    },
    {
      order: 6,
      action: 'ORIENTATION',
      prompt: 'Provide brief orientation: elevator location, breakfast hours, WiFi password, amenities.',
      requiredFields: [],
      optionalFields: ['map', 'restaurantMenu', 'spaBrochure'],
    },
    {
      order: 7,
      action: 'ESCORT_TO_ROOM',
      prompt: 'Offer bellman assistance or provide directions to room.',
      requiredFields: [],
      optionalFields: ['bellmanRequested', 'selfService'],
    },
    {
      order: 8,
      action: 'FOLLOW_UP',
      prompt: 'Schedule follow-up call or message to ensure satisfaction.',
      requiredFields: ['followUpTime'],
      optionalFields: ['specialAttention'],
    },
  ],
  requiredDocuments: [
    'Valid government-issued photo ID',
    'Credit card for incidentals',
    'Confirmation number (if not already provided)',
  ],
  specialRequests: [
    'Early check-in (subject to availability)',
    'Late arrival arrangements',
    'Airport transfer coordination',
    'Special occasion acknowledgment',
  ],
};

export const CHECK_OUT_WORKFLOW: CheckOutWorkflow = {
  estimatedTime: '5-10 minutes',
  steps: [
    {
      order: 1,
      action: 'VERIFY_GUEST',
      prompt: 'Welcome guest and verify identity using room number or name.',
      requiredFields: ['roomNumber', 'guestName'],
      optionalFields: ['loyaltyNumber'],
    },
    {
      order: 2,
      action: 'REVIEW_CHARGES',
      prompt: 'Review all charges: room, taxes, incidentals, and unknown additional services.',
      requiredFields: ['folio'],
      optionalFields: ['itemizedBill'],
    },
    {
      order: 3,
      action: 'HANDLE_INCIDENTS',
      prompt: 'Address unknown billing questions or disputes.',
      requiredFields: [],
      optionalFields: ['disputeReason', 'adjustmentRequest'],
    },
    {
      order: 4,
      action: 'PROCESS_PAYMENT',
      prompt: 'Process final payment using pre-authorized card or alternative method.',
      requiredFields: ['paymentMethod'],
      optionalFields: ['tipProcessing', 'currencyConversion'],
    },
    {
      order: 5,
      action: 'COLLECT_KEYS',
      prompt: 'Collect all keys and key cards.',
      requiredFields: ['keyCards'],
      optionalFields: ['parkingKey', 'safeKey'],
    },
    {
      order: 6,
      action: 'BAGGAGE_ASSISTANCE',
      prompt: 'Offer luggage storage or bellman assistance.',
      requiredFields: [],
      optionalFields: ['luggageCount', 'storageRequested'],
    },
    {
      order: 7,
      action: 'TRANSPORTATION',
      prompt: 'Offer and arrange transportation for departure.',
      requiredFields: [],
      optionalFields: ['airportTransfer', 'taxiRequest', 'carRetrieval'],
    },
    {
      order: 8,
      action: 'FAREWELL',
      prompt: 'Thank guest, express hope for return, and provide departure information.',
      requiredFields: [],
      optionalFields: ['surveyLink', 'loyaltyPoints'],
    },
  ],
  billingItems: [
    'Room charge',
    'Taxes and fees',
    'Food and beverage',
    'Spa and wellness',
    'Parking and valet',
    'Minibar charges',
    'Phone charges',
    'Laundry services',
    'Business center',
    'Gift shop purchases',
    'Transportation',
    'Other charges',
  ],
  feedback: [
    'Rate your overall stay',
    'Rate cleanliness',
    'Rate service quality',
    'Rate amenities',
    'Likelihood to return',
  ],
};

// ============================================
// ROOM SERVICE WORKFLOW
// ============================================

export interface RoomServiceOrder {
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;
  deliveryTime?: Date;
  guestName: string;
  roomNumber: string;
  orderType: 'breakfast' | 'lunch' | 'dinner' | 'late_night' | 'beverage';
}

export const ROOM_SERVICE_WORKFLOW = {
  steps: [
    {
      order: 1,
      action: 'GREET_AND_TAKE_ORDER',
      prompt: 'Greet guest, present menu options, and take order.',
      requiredFields: ['guestName', 'roomNumber'],
      optionalFields: [],
    },
    {
      order: 2,
      action: 'CONFIRM_ORDER',
      prompt: 'Repeat order back for confirmation, note unknown special requests.',
      requiredFields: ['items'],
      optionalFields: ['specialInstructions'],
    },
    {
      order: 3,
      action: 'ESTIMATE_TIME',
      prompt: 'Provide estimated delivery time based on order complexity.',
      requiredFields: ['estimatedTime'],
      optionalFields: [],
    },
    {
      order: 4,
      action: 'PROCESS_PAYMENT',
      prompt: 'Confirm payment method (room charge or pay on delivery).',
      requiredFields: ['paymentMethod'],
      optionalFields: [],
    },
    {
      order: 5,
      action: 'PREPARE_ORDER',
      prompt: 'Kitchen prepares order with attention to special requirements.',
      requiredFields: [],
      optionalFields: ['allergies', 'preferences'],
    },
    {
      order: 6,
      action: 'DELIVER_ORDER',
      prompt: 'Deliver to room, set up if requested, present bill.',
      requiredFields: ['deliveryTime'],
      optionalFields: ['setUpRequested'],
    },
    {
      order: 7,
      action: 'FOLLOW_UP',
      prompt: 'Call back 10 minutes after delivery to ensure satisfaction.',
      requiredFields: ['followUpTime'],
      optionalFields: [],
    },
  ],
  orderTypes: ['breakfast', 'lunch', 'dinner', 'late_night', 'beverage', 'dessert'],
  estimatedDeliveryTimes: {
    breakfast: '20-30 minutes',
    lunch: '25-35 minutes',
    dinner: '30-45 minutes',
    late_night: '15-25 minutes',
    beverage: '10-15 minutes',
    dessert: '15-20 minutes',
  },
};

// ============================================
// HOUSEKEEPING WORKFLOW
// ============================================

export interface HousekeepingRequest {
  requestType: 'cleaning' | 'turndown' | 'amenities' | 'maintenance' | 'special_setup';
  roomNumber: string;
  priority: Priority;
  details?: string;
  scheduledTime?: Date;
  guestPreferences?: Record<string, unknown>;
}

export const HOUSEKEEPING_WORKFLOW = {
  requestTypes: {
    cleaning: {
      name: 'Room Cleaning',
      description: 'Full cleaning of guest room',
      estimatedTime: '30-45 minutes',
      commonRequests: ['Daily housekeeping', 'Deep cleaning', 'Mid-stay cleaning'],
    },
    turndown: {
      name: 'Turndown Service',
      description: 'Evening room preparation for sleep',
      estimatedTime: '15-20 minutes',
      commonRequests: ['Evening turndown', 'Bed preparation', 'Chocolate/treats'],
    },
    amenities: {
      name: 'Extra Amenities',
      description: 'Additional items for guest comfort',
      estimatedTime: '10-15 minutes',
      commonRequests: ['Extra towels', 'Extra pillows', 'Extra toiletries', 'Bedding'],
    },
    maintenance: {
      name: 'Maintenance',
      description: 'Fix issues in guest room',
      estimatedTime: 'Varies by issue',
      commonRequests: ['Light bulb replacement', 'AC issues', 'TV/internet issues'],
    },
    special_setup: {
      name: 'Special Setup',
      description: 'Custom room arrangement',
      estimatedTime: '45-60 minutes',
      commonRequests: ['Romantic setup', 'Business setup', 'Celebration setup'],
    },
  },
  steps: [
    {
      order: 1,
      action: 'RECEIVE_REQUEST',
      prompt: 'Receive and log housekeeping request with guest details.',
      requiredFields: ['roomNumber', 'requestType'],
      optionalFields: ['scheduledTime', 'details'],
    },
    {
      order: 2,
      action: 'ASSESS_PRIORITY',
      prompt: 'Determine priority based on request type and guest status.',
      requiredFields: ['priority'],
      optionalFields: ['vipStatus', 'loyaltyTier'],
    },
    {
      order: 3,
      action: 'DISPATCH_HOUSEKEEPER',
      prompt: 'Assign to appropriate housekeeping staff.',
      requiredFields: ['assignedTo'],
      optionalFields: ['notes'],
    },
    {
      order: 4,
      action: 'EXECUTE_SERVICE',
      prompt: 'Perform requested service.',
      requiredFields: [],
      optionalFields: ['guestPreferences'],
    },
    {
      order: 5,
      action: 'VERIFY_COMPLETION',
      prompt: 'Supervisor or self-check service quality.',
      requiredFields: ['completedAt'],
      optionalFields: ['qualityCheck'],
    },
    {
      order: 6,
      action: 'NOTIFY_GUEST',
      prompt: 'Inform guest service is complete.',
      requiredFields: ['notificationSent'],
      optionalFields: [],
    },
  ],
};

// ============================================
// WORKFLOW SERVICE
// ============================================

export class WorkflowService {
  /**
   * Get check-in workflow
   */
  getCheckInWorkflow(): CheckInWorkflow {
    return CHECK_IN_WORKFLOW;
  }

  /**
   * Get check-out workflow
   */
  getCheckOutWorkflow(): CheckOutWorkflow {
    return CHECK_OUT_WORKFLOW;
  }

  /**
   * Get room service workflow
   */
  getRoomServiceWorkflow(): typeof ROOM_SERVICE_WORKFLOW {
    return ROOM_SERVICE_WORKFLOW;
  }

  /**
   * Get housekeeping workflow
   */
  getHousekeepingWorkflow(): typeof HOUSEKEEPING_WORKFLOW {
    return HOUSEKEEPING_WORKFLOW;
  }

  /**
   * Start check-in workflow
   */
  async startCheckIn(context: ConversationContext): Promise<{
    workflow: CheckInWorkflow;
    currentStep: number;
    message: string;
    actions: string[];
  }> {
    logger.info('Starting check-in workflow', { guestId: context.guest?.id, sessionId: context.sessionId });

    const currentStep = 1;
    const step = CHECK_IN_WORKFLOW.steps[0];

    return {
      workflow: CHECK_IN_WORKFLOW,
      currentStep,
      message: `Welcome! I'm delighted to assist with your check-in. ${step.prompt}`,
      actions: ['Verify reservation', 'Continue'],
    };
  }

  /**
   * Process check-in step
   */
  async processCheckInStep(
    context: ConversationContext,
    stepNumber: number,
    data: Record<string, unknown>
  ): Promise<{
    completed: boolean;
    nextStep: number | null;
    message: string;
    actions: string[];
  }> {
    const step = CHECK_IN_WORKFLOW.steps[stepNumber - 1];

    // Validate required fields
    const missingFields = step.requiredFields.filter(f => !data[f]);
    if (missingFields.length > 0) {
      return {
        completed: false,
        nextStep: stepNumber,
        message: `I need the following information: ${missingFields.join(', ')}. Please provide these details.`,
        actions: missingFields,
      };
    }

    // Check if this is the last step
    if (stepNumber >= CHECK_IN_WORKFLOW.steps.length) {
      return {
        completed: true,
        nextStep: null,
        message: 'Your check-in is complete! Your room is ready and waiting. Is there anything else I can help you with?',
        actions: ['Request bellman', 'Go to room', 'Other assistance'],
      };
    }

    // Return next step
    const nextStepData = CHECK_IN_WORKFLOW.steps[stepNumber];
    return {
      completed: false,
      nextStep: stepNumber + 1,
      message: nextStepData.prompt,
      actions: this.getStepActions(nextStepData.action),
    };
  }

  /**
   * Start check-out workflow
   */
  async startCheckOut(context: ConversationContext): Promise<{
    workflow: CheckOutWorkflow;
    currentStep: number;
    message: string;
    actions: string[];
  }> {
    logger.info('Starting check-out workflow', { guestId: context.guest?.id, sessionId: context.sessionId });

    const currentStep = 1;
    const step = CHECK_OUT_WORKFLOW.steps[0];

    return {
      workflow: CHECK_OUT_WORKFLOW,
      currentStep,
      message: `Thank you for staying with us! I'm ready to assist with your check-out. ${step.prompt}`,
      actions: ['Review charges', 'Express checkout', 'Continue'],
    };
  }

  /**
   * Process check-out step
   */
  async processCheckOutStep(
    _context: ConversationContext,
    stepNumber: number,
    data: Record<string, unknown>
  ): Promise<{
    completed: boolean;
    nextStep: number | null;
    message: string;
    actions: string[];
  }> {
    const step = CHECK_OUT_WORKFLOW.steps[stepNumber - 1];

    // Validate required fields
    const missingFields = step.requiredFields.filter(f => !data[f]);
    if (missingFields.length > 0) {
      return {
        completed: false,
        nextStep: stepNumber,
        message: `I need the following information: ${missingFields.join(', ')}. Please provide these details.`,
        actions: missingFields,
      };
    }

    // Check if this is the last step
    if (stepNumber >= CHECK_OUT_WORKFLOW.steps.length) {
      return {
        completed: true,
        nextStep: null,
        message: 'Your check-out is complete. We hope to welcome you back soon! Safe travels!',
        actions: ['Need luggage help', 'Arrange transportation', 'Return visit'],
      };
    }

    // Return next step
    const nextStepData = CHECK_OUT_WORKFLOW.steps[stepNumber];
    return {
      completed: false,
      nextStep: stepNumber + 1,
      message: nextStepData.prompt,
      actions: this.getStepActions(nextStepData.action),
    };
  }

  /**
   * Get actions for a step
   */
  private getStepActions(action: string): string[] {
    const actionMap: Record<string, string[]> = {
      WELCOME_GUEST: ['Verify reservation', 'Continue'],
      VERIFY_IDENTITY: ['Show ID', 'Skip'],
      CONFIRM_RESERVATION: ['Confirm details', 'Make changes'],
      COLLECT_PAYMENT: ['Credit card', 'Other method'],
      ISSUE_KEYS: ['One key card', 'Two key cards'],
      ORIENTATION: ['Show me around', 'Self-guide'],
      ESCORT_TO_ROOM: ['Bellman help', 'Self directions'],
      FOLLOW_UP: ['Confirm follow-up', 'Skip'],
      VERIFY_GUEST: ['Confirm identity', 'Continue'],
      REVIEW_CHARGES: ['Review full bill', 'Summary only'],
      HANDLE_INCIDENTS: ['No issues', 'Have questions'],
      PROCESS_PAYMENT: ['Use card on file', 'Pay differently'],
      COLLECT_KEYS: ['Return all keys', 'Keep parking key'],
      BAGGAGE_ASSISTANCE: ['Store luggage', 'No thanks'],
      TRANSPORTATION: ['Arrange taxi', 'Self transport'],
      FAREWELL: ['Take survey', 'Skip'],
    };

    return actionMap[action] || ['Continue', 'Back'];
  }

  /**
   * Create service request from workflow
   */
  createServiceRequest(
    intent: HospitalityIntent,
    context: ConversationContext,
    details: Record<string, unknown>
  ): ServiceRequest {
    return {
      id: `SR-${Date.now()}-${randomUUID().replace(/-/g, '').substring(0, 9)}`,
      guestId: context.guest?.id || 'unknown',
      reservationId: context.reservation?.id,
      intent,
      request: details.message as string || 'Service request',
      priority: (details.priority as Priority) || Priority.NORMAL,
      status: ServiceStatus.PENDING,
      roomNumber: context.reservation?.roomNumber || (details.roomNumber as string),
      notes: details.notes as string,
      createdAt: new Date().toISOString(),
    };
  }
}

// Export singleton
export const workflowService = new WorkflowService();

/**
 * Check-In/Check-Out Flows
 * Detailed workflow implementations for arrival and departure
 */

import {
  ConversationContext,
  ServiceRequest,
  ServiceStatus,
  Priority,
  HospitalityIntent,
  CheckInWorkflow,
  CheckOutWorkflow,
} from '../types/index';
import { workflowService } from '../services/workflows';
import { logger } from '../utils/logger';

// ============================================
// CHECK-IN FLOW STATES
// ============================================

export enum CheckInState {
  INITIAL = 'INITIAL',
  WELCOME = 'WELCOME',
  VERIFY_RESERVATION = 'VERIFY_RESERVATION',
  VERIFY_IDENTITY = 'VERIFY_IDENTITY',
  REVIEW_RESERVATION = 'REVIEW_RESERVATION',
  COLLECT_PAYMENT = 'COLLECT_PAYMENT',
  ISSUING_KEYS = 'ISSUING_KEYS',
  ORIENTATION = 'ORIENTATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface CheckInSession {
  state: CheckInState;
  guestId?: string;
  reservationId?: string;
  confirmationNumber?: string;
  guestName?: string;
  roomNumber?: string;
  roomType?: string;
  checkInDate?: string;
  checkOutDate?: string;
  rate?: number;
  paymentCollected?: boolean;
  keysIssued?: boolean;
  orientationComplete?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CHECK-OUT FLOW STATES
// ============================================

export enum CheckOutState {
  INITIAL = 'INITIAL',
  VERIFY_GUEST = 'VERIFY_GUEST',
  REVIEW_CHARGES = 'REVIEW_CHARGES',
  HANDLE_INCIDENTS = 'HANDLE_INCIDENTS',
  PROCESS_PAYMENT = 'PROCESS_PAYMENT',
  COLLECT_KEYS = 'COLLECT_KEYS',
  BAGGAGE_ASSISTANCE = 'BAGGAGE_ASSISTANCE',
  TRANSPORTATION = 'TRANSPORTATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface CheckOutSession {
  state: CheckOutState;
  guestId?: string;
  reservationId?: string;
  roomNumber?: string;
  guestName?: string;
  folio?: {
    room: number;
    taxes: number;
    incidentals: number;
    total: number;
  };
  paymentProcessed?: boolean;
  keysCollected?: boolean;
  luggageAssistance?: 'store' | 'carry' | 'none';
  transportationArranged?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CHECK-IN/CHECK-OUT SERVICE
// ============================================

export class CheckInOutService {
  /**
   * Start a new check-in session
   */
  async startCheckIn(context: ConversationContext): Promise<{
    session: CheckInSession;
    message: string;
    nextStep: CheckInState;
  }> {
    logger.info('Starting check-in session', { guestId: context.guest?.id });

    const session: CheckInSession = {
      state: CheckInState.INITIAL,
      guestId: context.guest?.id,
      reservationId: context.reservation?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      session,
      message: `Welcome to ${process.env.PROPERTY_NAME || 'our property'}! I'm delighted to assist with your check-in. Do you have your confirmation number handy, or would you prefer I look up your reservation by name?`,
      nextStep: CheckInState.VERIFY_RESERVATION,
    };
  }

  /**
   * Process check-in step
   */
  async processCheckInStep(
    session: CheckInSession,
    input: Record<string, unknown>
  ): Promise<{
    session: CheckInSession;
    message: string;
    nextStep: CheckInState | null;
    completed: boolean;
  }> {
    const workflow = workflowService.getCheckInWorkflow();
    const currentStep = this.getStepForState(session.state);

    // Validate input for current step
    if (currentStep && currentStep.requiredFields.length > 0) {
      const missingFields = currentStep.requiredFields.filter((f: string) => !input[f]);
      if (missingFields.length > 0) {
        return {
          session,
          message: `I need the following information to proceed: ${missingFields.join(', ')}. Could you please provide these?`,
          nextStep: session.state,
          completed: false,
        };
      }
    }

    // Update session based on current state
    const updatedSession = this.updateSessionFromState(session, input);

    // Check if completed
    if (session.state === CheckInState.ORIENTATION && input.confirmed === true) {
      updatedSession.state = CheckInState.COMPLETED;
      updatedSession.updatedAt = new Date().toISOString();

      return {
        session: updatedSession,
        message: this.getCompletionMessage('check-in', session),
        nextStep: null,
        completed: true,
      };
    }

    // Get next state
    const nextState = this.getNextState(session.state);
    updatedSession.state = nextState;
    updatedSession.updatedAt = new Date().toISOString();

    const nextStep = workflow.steps.find(s => s.order === this.getStateOrder(nextState));

    return {
      session: updatedSession,
      message: nextStep?.prompt || 'Please provide the required information.',
      nextStep: nextState,
      completed: false,
    };
  }

  /**
   * Start a new check-out session
   */
  async startCheckOut(context: ConversationContext): Promise<{
    session: CheckOutSession;
    message: string;
    nextStep: CheckOutState;
  }> {
    logger.info('Starting check-out session', { guestId: context.guest?.id });

    const session: CheckOutSession = {
      state: CheckOutState.INITIAL,
      guestId: context.guest?.id,
      reservationId: context.reservation?.id,
      roomNumber: context.reservation?.roomNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      session,
      message: `Thank you for staying with us! I'm ready to assist with your check-out. Shall I pull up your account for room ${context.reservation?.roomNumber || 'your room'}, or would you prefer to verify your identity another way?`,
      nextStep: CheckOutState.VERIFY_GUEST,
    };
  }

  /**
   * Process check-out step
   */
  async processCheckOutStep(
    session: CheckOutSession,
    input: Record<string, unknown>
  ): Promise<{
    session: CheckOutSession;
    message: string;
    nextStep: CheckOutState | null;
    completed: boolean;
  }> {
    const workflow = workflowService.getCheckOutWorkflow();
    const currentStep = this.getCheckOutStepForState(session.state);

    // Validate input for current step
    if (currentStep && currentStep.requiredFields.length > 0) {
      const missingFields = currentStep.requiredFields.filter((f: string) => !input[f]);
      if (missingFields.length > 0) {
        return {
          session,
          message: `I need the following information: ${missingFields.join(', ')}. Please provide these details.`,
          nextStep: session.state,
          completed: false,
        };
      }
    }

    // Update session based on current state
    const updatedSession = this.updateCheckOutSession(session, input);

    // Check if completed
    if (session.state === CheckOutState.TRANSPORTATION && input.confirmed === true) {
      updatedSession.state = CheckOutState.COMPLETED;
      updatedSession.updatedAt = new Date().toISOString();

      return {
        session: updatedSession,
        message: this.getCompletionMessage('check-out', session),
        nextStep: null,
        completed: true,
      };
    }

    // Get next state
    const nextState = this.getNextCheckOutState(session.state);
    updatedSession.state = nextState;
    updatedSession.updatedAt = new Date().toISOString();

    const nextStep = workflow.steps.find(s => s.order === this.getCheckOutStateOrder(nextState));

    return {
      session: updatedSession,
      message: nextStep?.prompt || 'Please provide the required information.',
      nextStep: nextState,
      completed: false,
    };
  }

  /**
   * Generate check-in summary for display
   */
  generateCheckInSummary(session: CheckInSession): string {
    const lines: string[] = [
      '=== CHECK-IN SUMMARY ===',
      `Guest: ${session.guestName || 'N/A'}`,
      `Room: ${session.roomNumber || 'TBD'}`,
      `Type: ${session.roomType || 'Standard'}`,
      `Check-in: ${session.checkInDate || 'Today'}`,
      `Check-out: ${session.checkOutDate || 'TBD'}`,
      `Rate: $${session.rate || 0}/night`,
      `Payment: ${session.paymentCollected ? 'Collected' : 'Pending'}`,
      `Keys: ${session.keysIssued ? 'Issued' : 'Pending'}`,
    ];

    return lines.join('\n');
  }

  /**
   * Generate check-out summary for display
   */
  generateCheckOutSummary(session: CheckOutSession): string {
    if (!session.folio) {
      return 'Folio not available.';
    }

    const lines: string[] = [
      '=== CHECK-OUT SUMMARY ===',
      `Guest: ${session.guestName || 'N/A'}`,
      `Room: ${session.roomNumber || 'N/A'}`,
      '',
      'CHARGES:',
      `Room: $${session.folio.room.toFixed(2)}`,
      `Taxes: $${session.folio.taxes.toFixed(2)}`,
      `Incidentals: $${session.folio.incidentals.toFixed(2)}`,
      '---',
      `TOTAL: $${session.folio.total.toFixed(2)}`,
      '',
      `Payment: ${session.paymentProcessed ? 'Processed' : 'Pending'}`,
      `Keys: ${session.keysCollected ? 'Collected' : 'Pending'}`,
    ];

    return lines.join('\n');
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private getStepForState(state: CheckInState): CheckInWorkflow['steps'][0] | undefined {
    const workflow = workflowService.getCheckInWorkflow();
    const order = this.getStateOrder(state);
    return workflow.steps.find(s => s.order === order);
  }

  private getCheckOutStepForState(state: CheckOutState): CheckOutWorkflow['steps'][0] | undefined {
    const workflow = workflowService.getCheckOutWorkflow();
    const order = this.getCheckOutStateOrder(state);
    return workflow.steps.find(s => s.order === order);
  }

  private getStateOrder(state: CheckInState): number {
    const orderMap: Record<CheckInState, number> = {
      [CheckInState.INITIAL]: 0,
      [CheckInState.WELCOME]: 1,
      [CheckInState.VERIFY_RESERVATION]: 1,
      [CheckInState.VERIFY_IDENTITY]: 2,
      [CheckInState.REVIEW_RESERVATION]: 3,
      [CheckInState.COLLECT_PAYMENT]: 4,
      [CheckInState.ISSUING_KEYS]: 5,
      [CheckInState.ORIENTATION]: 6,
      [CheckInState.COMPLETED]: 7,
      [CheckInState.FAILED]: -1,
    };
    return orderMap[state] || 0;
  }

  private getCheckOutStateOrder(state: CheckOutState): number {
    const orderMap: Record<CheckOutState, number> = {
      [CheckOutState.INITIAL]: 0,
      [CheckOutState.VERIFY_GUEST]: 1,
      [CheckOutState.REVIEW_CHARGES]: 2,
      [CheckOutState.HANDLE_INCIDENTS]: 3,
      [CheckOutState.PROCESS_PAYMENT]: 4,
      [CheckOutState.COLLECT_KEYS]: 5,
      [CheckOutState.BAGGAGE_ASSISTANCE]: 6,
      [CheckOutState.TRANSPORTATION]: 7,
      [CheckOutState.COMPLETED]: 8,
      [CheckOutState.FAILED]: -1,
    };
    return orderMap[state] || 0;
  }

  private getNextState(currentState: CheckInState): CheckInState {
    const nextMap: Partial<Record<CheckInState, CheckInState>> = {
      [CheckInState.INITIAL]: CheckInState.VERIFY_RESERVATION,
      [CheckInState.VERIFY_RESERVATION]: CheckInState.VERIFY_IDENTITY,
      [CheckInState.VERIFY_IDENTITY]: CheckInState.REVIEW_RESERVATION,
      [CheckInState.REVIEW_RESERVATION]: CheckInState.COLLECT_PAYMENT,
      [CheckInState.COLLECT_PAYMENT]: CheckInState.ISSUING_KEYS,
      [CheckInState.ISSUING_KEYS]: CheckInState.ORIENTATION,
      [CheckInState.ORIENTATION]: CheckInState.COMPLETED,
    };
    return nextMap[currentState] || currentState;
  }

  private getNextCheckOutState(currentState: CheckOutState): CheckOutState {
    const nextMap: Partial<Record<CheckOutState, CheckOutState>> = {
      [CheckOutState.INITIAL]: CheckOutState.VERIFY_GUEST,
      [CheckOutState.VERIFY_GUEST]: CheckOutState.REVIEW_CHARGES,
      [CheckOutState.REVIEW_CHARGES]: CheckOutState.HANDLE_INCIDENTS,
      [CheckOutState.HANDLE_INCIDENTS]: CheckOutState.PROCESS_PAYMENT,
      [CheckOutState.PROCESS_PAYMENT]: CheckOutState.COLLECT_KEYS,
      [CheckOutState.COLLECT_KEYS]: CheckOutState.BAGGAGE_ASSISTANCE,
      [CheckOutState.BAGGAGE_ASSISTANCE]: CheckOutState.TRANSPORTATION,
      [CheckOutState.TRANSPORTATION]: CheckOutState.COMPLETED,
    };
    return nextMap[currentState] || currentState;
  }

  private updateSessionFromState(session: CheckInSession, input: Record<string, unknown>): CheckInSession {
    const updated = { ...session };

    switch (session.state) {
      case CheckInState.VERIFY_RESERVATION:
        if (input.confirmationNumber) updated.confirmationNumber = input.confirmationNumber as string;
        if (input.guestName) updated.guestName = input.guestName as string;
        break;
      case CheckInState.VERIFY_IDENTITY:
        // Identity verification would happen here
        break;
      case CheckInState.REVIEW_RESERVATION:
        if (input.roomNumber) updated.roomNumber = input.roomNumber as string;
        if (input.roomType) updated.roomType = input.roomType as string;
        if (input.checkInDate) updated.checkInDate = input.checkInDate as string;
        if (input.checkOutDate) updated.checkOutDate = input.checkOutDate as string;
        if (input.rate) updated.rate = input.rate as number;
        break;
      case CheckInState.COLLECT_PAYMENT:
        updated.paymentCollected = true;
        break;
      case CheckInState.ISSUING_KEYS:
        updated.keysIssued = true;
        break;
      case CheckInState.ORIENTATION:
        updated.orientationComplete = true;
        break;
    }

    return updated;
  }

  private updateCheckOutSession(session: CheckOutSession, input: Record<string, unknown>): CheckOutSession {
    const updated = { ...session };

    switch (session.state) {
      case CheckOutState.VERIFY_GUEST:
        if (input.guestName) updated.guestName = input.guestName as string;
        if (input.roomNumber) updated.roomNumber = input.roomNumber as string;
        break;
      case CheckOutState.REVIEW_CHARGES:
        // Folio would be populated from system
        if (!updated.folio) {
          updated.folio = {
            room: (input.roomCharge as number) || 0,
            taxes: (input.taxes as number) || 0,
            incidentals: (input.incidentals as number) || 0,
            total: (input.total as number) || 0,
          };
        }
        break;
      case CheckOutState.PROCESS_PAYMENT:
        updated.paymentProcessed = true;
        break;
      case CheckOutState.COLLECT_KEYS:
        updated.keysCollected = true;
        break;
      case CheckOutState.BAGGAGE_ASSISTANCE:
        updated.luggageAssistance = input.luggageOption as 'store' | 'carry' | 'none';
        break;
      case CheckOutState.TRANSPORTATION:
        updated.transportationArranged = input.arranged as boolean;
        break;
    }

    return updated;
  }

  private getCompletionMessage(type: 'check-in' | 'check-out', session: CheckInSession | CheckOutSession): string {
    if (type === 'check-in') {
      const checkInSession = session as CheckInSession;
      return `Your check-in is complete! Welcome to your room ${checkInSession.roomNumber}. Bellman service is available if you need assistance with luggage. Enjoy your stay, and please don't hesitate to reach out if you need anything.`;
    } else {
      return `Your check-out is complete. We hope you enjoyed your stay with us. Safe travels, and we look forward to welcoming you back soon!`;
    }
  }
}

// ============================================
// EXPORT
// ============================================

export const checkInOutService = new CheckInOutService();

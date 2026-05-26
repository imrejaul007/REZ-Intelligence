import { randomUUID } from 'crypto';
import axios from 'axios';
import { ProcessedOrchestrationRequest } from '../models/OrchestrationRequest';
import { ErrorDetails } from '../models/OrchestrationResponse';
import { appConfig } from '../config';
import { logger } from '../utils/logger';

export interface EscalationTicket {
  ticketId: string;
  requestId: string;
  originalRequest: ProcessedOrchestrationRequest;
  error: ErrorDetails;
  attempts: number;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolution?: string;
}

export interface EscalationResult {
  ticket: EscalationTicket;
  notificationSent: boolean;
  webhookCalled: boolean;
}

export class EscalationService {
  private tickets: Map<string, EscalationTicket> = new Map();
  private webhookUrl?: string;

  constructor() {
    this.webhookUrl = appConfig.escalation.webhookUrl;
  }

  async escalate(
    request: ProcessedOrchestrationRequest,
    error: ErrorDetails
  ): Promise<EscalationResult | null> {
    if (!appConfig.escalation.enabled) {
      logger.info('Escalation disabled, skipping', {
        requestId: request.requestId,
      });
      return null;
    }

    const ticketId = `ESC-${Date.now()}-${randomUUID().replace(/-/g, '').substring(0, 9)}`;

    const ticket: EscalationTicket = {
      ticketId,
      requestId: request.requestId,
      originalRequest: request,
      error,
      attempts: 1,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tickets.set(ticketId, ticket);

    logger.warn('Escalation created', {
      ticketId,
      requestId: request.requestId,
      errorCode: error.code,
    });

    let webhookCalled = false;
    if (this.webhookUrl) {
      try {
        await this.notifyWebhook(ticket);
        webhookCalled = true;
      } catch (webhookError) {
        logger.error('Failed to call escalation webhook', {
          ticketId,
          error: webhookError instanceof Error ? webhookError.message : 'Unknown',
        });
      }
    }

    return {
      ticket,
      notificationSent: true,
      webhookCalled,
    };
  }

  async getTicket(ticketId: string): Promise<EscalationTicket | null> {
    return this.tickets.get(ticketId) || null;
  }

  async getTicketsByStatus(status: EscalationTicket['status']): Promise<EscalationTicket[]> {
    return Array.from(this.tickets.values()).filter(t => t.status === status);
  }

  async updateTicketStatus(
    ticketId: string,
    status: EscalationTicket['status'],
    resolution?: string
  ): Promise<EscalationTicket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return null;
    }

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();

    if (resolution) {
      ticket.resolution = resolution;
    }

    if (status === 'in_progress' && !ticket.assignedTo) {
      ticket.assignedTo = 'human_agent';
    }

    this.tickets.set(ticketId, ticket);

    logger.info('Escalation ticket updated', {
      ticketId,
      status,
    });

    return ticket;
  }

  async assignTicket(ticketId: string, assignedTo: string): Promise<EscalationTicket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return null;
    }

    ticket.assignedTo = assignedTo;
    ticket.status = 'in_progress';
    ticket.updatedAt = new Date().toISOString();

    this.tickets.set(ticketId, ticket);

    logger.info('Escalation ticket assigned', {
      ticketId,
      assignedTo,
    });

    return ticket;
  }

  async resolveTicket(
    ticketId: string,
    resolution: string
  ): Promise<EscalationTicket | null> {
    return this.updateTicketStatus(ticketId, 'resolved', resolution);
  }

  private async notifyWebhook(ticket: EscalationTicket): Promise<void> {
    if (!this.webhookUrl) {
      return;
    }

    const payload = {
      event: 'escalation.created',
      timestamp: new Date().toISOString(),
      ticket: {
        ticketId: ticket.ticketId,
        requestId: ticket.requestId,
        error: ticket.error,
        attempts: ticket.attempts,
        createdAt: ticket.createdAt,
        originalMessage: ticket.originalRequest.message,
        context: ticket.originalRequest.context,
      },
    };

    await axios.post(this.webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Escalation-Event': 'escalation.created',
      },
      timeout: 10000,
    });

    logger.debug('Escalation webhook called successfully', {
      ticketId: ticket.ticketId,
      webhookUrl: this.webhookUrl,
    });
  }

  shouldEscalate(error: ErrorDetails, attempts: number): boolean {
    // Escalate if max attempts reached
    if (attempts >= appConfig.escalation.thresholdAttempts) {
      return true;
    }

    // Escalate if error is not recoverable
    if (!error.recoverable) {
      return true;
    }

    // Escalate certain error codes
    const escalationErrorCodes = [
      'NO_AGENT_AVAILABLE',
      'AGENT_TIMEOUT',
      'INVALID_RESPONSE',
      'SERVICE_UNAVAILABLE',
    ];

    if (escalationErrorCodes.includes(error.code)) {
      return true;
    }

    return false;
  }

  getMetrics(): {
    totalTickets: number;
    pendingTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
  } {
    const tickets = Array.from(this.tickets.values());

    return {
      totalTickets: tickets.length,
      pendingTickets: tickets.filter(t => t.status === 'pending').length,
      inProgressTickets: tickets.filter(t => t.status === 'in_progress').length,
      resolvedTickets: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    };
  }

  async shutdown(): Promise<void> {
    // Close any pending tickets
    const pendingTickets = await this.getTicketsByStatus('pending');
    for (const ticket of pendingTickets) {
      await this.updateTicketStatus(ticket.ticketId, 'closed', 'Service shutdown');
    }

    logger.info('Escalation service shutdown complete', {
      ticketsClosed: pendingTickets.length,
    });
  }
}

export const createEscalationService = (): EscalationService => {
  return new EscalationService();
};

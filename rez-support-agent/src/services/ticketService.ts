import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketMessage,
  TicketResolution
} from './supportAgent';

interface TicketFilter {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  customerId?: string;
  assignedTo?: string;
  assignedTeam?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  searchQuery?: string;
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  pending: number;
  resolved: number;
  closed: number;
  escalated: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  slaCompliance: number;
  byPriority: Record<TicketPriority, number>;
  byCategory: Record<TicketCategory, number>;
}

interface TicketAssignment {
  ticketId: string;
  assignedTo: string;
  assignedTeam: string;
  assignedAt: Date;
  assignedBy: string;
}

class TicketService {
  private tickets: Map<string, Ticket> = new Map();
  private assignments: Map<string, TicketAssignment> = new Map();

  async createTicket(ticketData: Partial<Ticket>): Promise<Ticket> {
    const ticket: Ticket = {
      id: uuidv4(),
      displayId: this.generateDisplayId(),
      subject: ticketData.subject || 'Untitled Ticket',
      description: ticketData.description || '',
      status: ticketData.status || TicketStatus.OPEN,
      priority: ticketData.priority || TicketPriority.MEDIUM,
      category: ticketData.category || TicketCategory.GENERAL,
      source: ticketData.source || 'chat' as any,
      customerId: ticketData.customerId || 'anonymous',
      customerName: ticketData.customerName || 'Anonymous',
      customerEmail: ticketData.customerEmail || 'unknown@example.com',
      assignedTo: null,
      assignedTeam: ticketData.assignedTeam || this.assignTeam(ticketData.category),
      tags: ticketData.tags || [],
      orderId: ticketData.orderId || null,
      relatedTickets: [],
      messages: [],
      resolution: null,
      metadata: ticketData.metadata || {},
      slaDeadline: this.calculateSlaDeadline(ticketData.priority || TicketPriority.MEDIUM),
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const systemMessage: TicketMessage = {
      id: uuidv4(),
      ticketId: ticket.id,
      authorId: 'system',
      authorName: 'System',
      authorType: 'system',
      content: `Ticket created with ${ticket.category} priority`,
      attachments: [],
      isInternal: false,
      createdAt: new Date()
    };

    ticket.messages.push(systemMessage);
    this.tickets.set(ticket.id, ticket);

    return ticket;
  }

  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    const previousStatus = ticket.status;

    Object.assign(ticket, {
      ...updates,
      updatedAt: new Date()
    });

    if (updates.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    if (updates.status === TicketStatus.CLOSED && !ticket.closedAt) {
      ticket.closedAt = new Date();
    }

    if (previousStatus === TicketStatus.OPEN && updates.status !== TicketStatus.OPEN) {
      ticket.firstResponseAt = new Date();
    }

    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  async addMessage(ticketId: string, messageData: Partial<TicketMessage>): Promise<TicketMessage | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    const message: TicketMessage = {
      id: uuidv4(),
      ticketId,
      authorId: messageData.authorId || 'unknown',
      authorName: messageData.authorName || 'Unknown',
      authorType: messageData.authorType || 'customer',
      content: messageData.content || '',
      attachments: messageData.attachments || [],
      isInternal: messageData.isInternal || false,
      createdAt: new Date()
    };

    ticket.messages.push(message);
    ticket.updatedAt = new Date();

    if (ticket.firstResponseAt === null && ticket.status === TicketStatus.OPEN) {
      ticket.firstResponseAt = new Date();
    }

    this.tickets.set(ticket.id, ticket);
    return message;
  }

  async resolveTicket(ticketId: string, resolution: Partial<TicketResolution>): Promise<Ticket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    const ticketResolution: TicketResolution = {
      type: resolution.type || 'resolved',
      summary: resolution.summary || 'Ticket resolved',
      resolvedBy: resolution.resolvedBy || 'system',
      customerSatisfied: resolution.customerSatisfied || null,
      resolvedAt: new Date()
    };

    ticket.resolution = ticketResolution;
    ticket.status = TicketStatus.RESOLVED;
    ticket.resolvedAt = new Date();
    ticket.updatedAt = new Date();

    const resolutionMessage: TicketMessage = {
      id: uuidv4(),
      ticketId,
      authorId: 'system',
      authorName: 'System',
      authorType: 'system',
      content: `Ticket resolved: ${resolution.summary}`,
      attachments: [],
      isInternal: false,
      createdAt: new Date()
    };

    ticket.messages.push(resolutionMessage);
    this.tickets.set(ticket.id, ticket);

    return ticket;
  }

  async closeTicket(ticketId: string, resolution?: Partial<TicketResolution>): Promise<Ticket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    if (resolution) {
      ticket.resolution = {
        type: resolution.type || 'resolved',
        summary: resolution.summary || 'Ticket closed',
        resolvedBy: resolution.resolvedBy || 'system',
        customerSatisfied: resolution.customerSatisfied || null,
        resolvedAt: new Date()
      };
    }

    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    ticket.updatedAt = new Date();

    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  async escalateTicket(ticketId: string, escalationReason: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    ticket.status = TicketStatus.ESCALATED;
    ticket.priority = this.elevatePriority(ticket.priority);
    ticket.assignedTeam = 'Escalation Team';
    ticket.updatedAt = new Date();

    const escalationMessage: TicketMessage = {
      id: uuidv4(),
      ticketId,
      authorId: 'system',
      authorName: 'System',
      authorType: 'system',
      content: `Ticket escalated: ${escalationReason}`,
      attachments: [],
      isInternal: true,
      createdAt: new Date()
    };

    ticket.messages.push(escalationMessage);
    this.tickets.set(ticket.id, ticket);

    return ticket;
  }

  async assignTicket(ticketId: string, agentId: string, agentName: string, team?: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    ticket.assignedTo = agentName;
    ticket.assignedTeam = team || ticket.assignedTeam;
    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.updatedAt = new Date();

    if (ticket.firstResponseAt === null) {
      ticket.firstResponseAt = new Date();
    }

    const assignment: TicketAssignment = {
      ticketId,
      assignedTo: agentName,
      assignedTeam: team || ticket.assignedTeam || 'Unknown',
      assignedAt: new Date(),
      assignedBy: 'system'
    };

    this.assignments.set(ticketId, assignment);

    const assignmentMessage: TicketMessage = {
      id: uuidv4(),
      ticketId,
      authorId: 'system',
      authorName: 'System',
      authorType: 'system',
      content: `Ticket assigned to ${agentName}${team ? ` (${team})` : ''}`,
      attachments: [],
      isInternal: true,
      createdAt: new Date()
    };

    ticket.messages.push(assignmentMessage);
    this.tickets.set(ticket.id, ticket);

    return ticket;
  }

  async linkTickets(ticketId1: string, ticketId2: string): Promise<boolean> {
    const ticket1 = this.tickets.get(ticketId1);
    const ticket2 = this.tickets.get(ticketId2);

    if (!ticket1 || !ticket2) return false;

    if (!ticket1.relatedTickets.includes(ticketId2)) {
      ticket1.relatedTickets.push(ticketId2);
    }

    if (!ticket2.relatedTickets.includes(ticketId1)) {
      ticket2.relatedTickets.push(ticketId1);
    }

    this.tickets.set(ticketId1, ticket1);
    this.tickets.set(ticketId2, ticket2);

    return true;
  }

  async addTag(ticketId: string, tag: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    if (!ticket.tags.includes(tag)) {
      ticket.tags.push(tag);
      ticket.updatedAt = new Date();
      this.tickets.set(ticketId, ticket);
    }

    return ticket;
  }

  async removeTag(ticketId: string, tag: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    ticket.tags = ticket.tags.filter(t => t !== tag);
    ticket.updatedAt = new Date();
    this.tickets.set(ticketId, ticket);

    return ticket;
  }

  getTicket(ticketId: string): Ticket | undefined {
    return this.tickets.get(ticketId);
  }

  getTicketByDisplayId(displayId: string): Ticket | undefined {
    for (const ticket of this.tickets.values()) {
      if (ticket.displayId === displayId) {
        return ticket;
      }
    }
    return undefined;
  }

  getTickets(filter?: TicketFilter): Ticket[] {
    let tickets = Array.from(this.tickets.values());

    if (!filter) return tickets;

    if (filter.status && filter.status.length > 0) {
      tickets = tickets.filter(t => filter.status!.includes(t.status));
    }

    if (filter.priority && filter.priority.length > 0) {
      tickets = tickets.filter(t => filter.priority!.includes(t.priority));
    }

    if (filter.category && filter.category.length > 0) {
      tickets = tickets.filter(t => filter.category!.includes(t.category));
    }

    if (filter.customerId) {
      tickets = tickets.filter(t => t.customerId === filter.customerId);
    }

    if (filter.assignedTo) {
      tickets = tickets.filter(t => t.assignedTo === filter.assignedTo);
    }

    if (filter.assignedTeam) {
      tickets = tickets.filter(t => t.assignedTeam === filter.assignedTeam);
    }

    if (filter.dateFrom) {
      tickets = tickets.filter(t => t.createdAt >= filter.dateFrom!);
    }

    if (filter.dateTo) {
      tickets = tickets.filter(t => t.createdAt <= filter.dateTo!);
    }

    if (filter.tags && filter.tags.length > 0) {
      tickets = tickets.filter(t => filter.tags!.some(tag => t.tags.includes(tag)));
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      tickets = tickets.filter(t =>
        t.subject.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.customerName.toLowerCase().includes(query) ||
        t.displayId.toLowerCase().includes(query)
      );
    }

    return tickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getTicketsByCustomer(customerId: string): Ticket[] {
    return this.getTickets({ customerId });
  }

  getTicketsByAgent(agentName: string): Ticket[] {
    return this.getTickets({ assignedTo: agentName });
  }

  getStats(filter?: TicketFilter): TicketStats {
    const tickets = this.getTickets(filter);

    const stats: TicketStats = {
      total: tickets.length,
      open: 0,
      inProgress: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
      escalated: 0,
      avgResponseTime: 0,
      avgResolutionTime: 0,
      slaCompliance: 0,
      byPriority: {
        [TicketPriority.LOW]: 0,
        [TicketPriority.MEDIUM]: 0,
        [TicketPriority.HIGH]: 0,
        [TicketPriority.URGENT]: 0,
        [TicketPriority.CRITICAL]: 0
      },
      byCategory: {
        [TicketCategory.BILLING]: 0,
        [TicketCategory.TECHNICAL]: 0,
        [TicketCategory.BOOKING]: 0,
        [TicketCategory.REFUND]: 0,
        [TicketCategory.GENERAL]: 0,
        [TicketCategory.COMPLAINT]: 0,
        [TicketCategory.FEATURE_REQUEST]: 0
      }
    };

    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseCount = 0;
    let resolutionCount = 0;
    let slaMet = 0;

    for (const ticket of tickets) {
      switch (ticket.status) {
        case TicketStatus.OPEN:
          stats.open++;
          break;
        case TicketStatus.IN_PROGRESS:
          stats.inProgress++;
          break;
        case TicketStatus.PENDING_CUSTOMER:
        case TicketStatus.PENDING_INTERNAL:
          stats.pending++;
          break;
        case TicketStatus.RESOLVED:
          stats.resolved++;
          break;
        case TicketStatus.CLOSED:
          stats.closed++;
          break;
        case TicketStatus.ESCALATED:
          stats.escalated++;
          break;
      }

      stats.byPriority[ticket.priority]++;
      stats.byCategory[ticket.category]++;

      if (ticket.firstResponseAt) {
        totalResponseTime += ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
        responseCount++;
      }

      if (ticket.resolvedAt) {
        totalResolutionTime += ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
        resolutionCount++;
      }

      if (ticket.slaDeadline && (ticket.firstResponseAt || ticket.resolvedAt)) {
        const deadline = ticket.resolvedAt || ticket.firstResponseAt;
        if (deadline && deadline <= ticket.slaDeadline) {
          slaMet++;
        }
      }
    }

    if (responseCount > 0) {
      stats.avgResponseTime = totalResponseTime / responseCount / 1000 / 60;
    }

    if (resolutionCount > 0) {
      stats.avgResolutionTime = totalResolutionTime / resolutionCount / 1000 / 60 / 60;
    }

    if (tickets.length > 0) {
      stats.slaCompliance = (slaMet / tickets.length) * 100;
    }

    return stats;
  }

  getOverdueTickets(): Ticket[] {
    const now = new Date();
    return Array.from(this.tickets.values())
      .filter(ticket =>
        ticket.slaDeadline &&
        ticket.slaDeadline < now &&
        ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status)
      )
      .sort((a, b) => (a.slaDeadline?.getTime() || 0) - (b.slaDeadline?.getTime() || 0));
  }

  getUpcomingSlaDeadlines(hoursAhead: number = 4): Ticket[] {
    const now = new Date();
    const deadline = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return Array.from(this.tickets.values())
      .filter(ticket =>
        ticket.slaDeadline &&
        ticket.slaDeadline >= now &&
        ticket.slaDeadline <= deadline &&
        ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status)
      )
      .sort((a, b) => (a.slaDeadline?.getTime() || 0) - (b.slaDeadline?.getTime() || 0));
  }

  private generateDisplayId(): string {
    const num = Math.floor(Math.random() * 90000) + 10000;
    return `TKT-${num}`;
  }

  private calculateSlaDeadline(priority: TicketPriority): Date {
    const slaHours: Record<TicketPriority, number> = {
      [TicketPriority.CRITICAL]: 1,
      [TicketPriority.URGENT]: 4,
      [TicketPriority.HIGH]: 8,
      [TicketPriority.MEDIUM]: 24,
      [TicketPriority.LOW]: 48
    };

    return new Date(Date.now() + slaHours[priority] * 60 * 60 * 1000);
  }

  private assignTeam(category?: TicketCategory): string {
    const teams: Record<TicketCategory, string> = {
      [TicketCategory.BILLING]: 'Billing Team',
      [TicketCategory.TECHNICAL]: 'Technical Support',
      [TicketCategory.BOOKING]: 'Reservations Team',
      [TicketCategory.REFUND]: 'Refunds Team',
      [TicketCategory.GENERAL]: 'General Support',
      [TicketCategory.COMPLAINT]: 'Customer Experience',
      [TicketCategory.FEATURE_REQUEST]: 'Product Team'
    };

    return teams[category || TicketCategory.GENERAL];
  }

  private elevatePriority(priority: TicketPriority): TicketPriority {
    const elevated: Record<TicketPriority, TicketPriority> = {
      [TicketPriority.LOW]: TicketPriority.MEDIUM,
      [TicketPriority.MEDIUM]: TicketPriority.HIGH,
      [TicketPriority.HIGH]: TicketPriority.URGENT,
      [TicketPriority.URGENT]: TicketPriority.CRITICAL,
      [TicketPriority.CRITICAL]: TicketPriority.CRITICAL
    };

    return elevated[priority];
  }
}

export const ticketService = new TicketService();
export { TicketService, TicketFilter, TicketStats };

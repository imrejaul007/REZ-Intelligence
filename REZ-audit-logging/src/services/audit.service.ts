import { v4 as uuidv4 } from 'uuid';
import { AuditEvent, AuditEventType, AuditFilter, AuditReport } from '../types/audit.types';

export class AuditService {
  private events: AuditEvent[] = [];
  private readonly maxEvents = 100000;

  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent> {
    const auditEvent: AuditEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
    };

    this.events.push(auditEvent);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    return auditEvent;
  }

  async getEventById(id: string): Promise<AuditEvent | null> {
    return this.events.find(event => event.id === id) || null;
  }

  async getEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
    let filtered = [...this.events];

    if (filter.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
    }

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      filtered = filtered.filter(e => filter.eventTypes!.includes(e.eventType));
    }

    if (filter.userId) {
      filtered = filtered.filter(e => e.userId === filter.userId);
    }

    if (filter.resource) {
      filtered = filtered.filter(e => e.resource === filter.resource);
    }

    if (filter.status) {
      filtered = filtered.filter(e => e.status === filter.status);
    }

    if (filter.correlationId) {
      filtered = filtered.filter(e => e.correlationId === filter.correlationId);
    }

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const offset = filter.offset || 0;
    const limit = filter.limit || 100;

    return filtered.slice(offset, offset + limit);
  }

  async getEventCount(filter: AuditFilter = {}): Promise<number> {
    const filtered = await this.getEvents({ ...filter, limit: undefined, offset: undefined });
    return filtered.length;
  }

  async getEventsByUser(userId: string, limit: number = 100): Promise<AuditEvent[]> {
    return this.getEvents({ userId, limit });
  }

  async getEventsByResource(resource: string, limit: number = 100): Promise<AuditEvent[]> {
    return this.getEvents({ resource, limit });
  }

  async getEventsByType(eventType: AuditEventType, limit: number = 100): Promise<AuditEvent[]> {
    return this.getEvents({ eventTypes: [eventType], limit });
  }

  async getRecentEvents(limit: number = 50): Promise<AuditEvent[]> {
    return this.getEvents({ limit });
  }

  async getEventsSummary(filter: AuditFilter = {}): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byResource: Record<string, number>;
  }> {
    const events = await this.getEvents({ ...filter, limit: undefined, offset: undefined });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byResource: Record<string, number> = {};

    for (const event of events) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;
      byResource[event.resource] = (byResource[event.resource] || 0) + 1;
    }

    return {
      total: events.length,
      byType,
      byStatus,
      byResource,
    };
  }

  async generateReport(filter: AuditFilter): Promise<AuditReport> {
    const events = await this.getEvents({
      ...filter,
      limit: filter.limit || 1000,
    });

    const summary = {
      totalEvents: events.length,
      successCount: 0,
      failureCount: 0,
      warningCount: 0,
      eventsByType: {} as Record<string, number>,
    };

    for (const event of events) {
      if (event.status === 'success') summary.successCount++;
      else if (event.status === 'failure') summary.failureCount++;
      else if (event.status === 'warning') summary.warningCount++;

      summary.eventsByType[event.eventType] = (summary.eventsByType[event.eventType] || 0) + 1;
    }

    return {
      id: uuidv4(),
      generatedAt: new Date(),
      period: {
        start: filter.startDate || new Date(0),
        end: filter.endDate || new Date(),
      },
      summary,
      events,
    };
  }

  async deleteEventsOlderThan(date: Date): Promise<number> {
    const initialCount = this.events.length;
    this.events = this.events.filter(e => e.timestamp > date);
    return initialCount - this.events.length;
  }

  clearAllEvents(): void {
    this.events = [];
  }
}

export const auditService = new AuditService();

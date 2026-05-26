import { v4 as uuidv4 } from 'uuid';
import { Event, EventType } from '../types.js';

// In-memory event store
const events: Event[] = [];

export class EventPlatform {
  async record(eventData: Omit<Event, 'id' | 'timestamp'>): Promise<{ success: boolean; eventId: string }> {
    const event: Event = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...eventData,
    };
    events.push(event);
    return { success: true, eventId: event.id };
  }

  getEvents(): Event[] {
    return events;
  }

  getEventsByUser(userId: string): Event[] {
    return events.filter((e) => e.userId === userId);
  }

  getEventsByType(type: EventType): Event[] {
    return events.filter((e) => e.type === type);
  }

  clearEvents(): void {
    events.length = 0;
  }
}

export const eventPlatform = new EventPlatform();

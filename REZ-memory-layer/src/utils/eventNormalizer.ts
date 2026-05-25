/**
 * REZ Memory Layer - Event Normalizer
 * Normalize events from different sources to a common schema
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

export interface NormalizedEvent {
  eventId: string;
  userId: string;
  type: string;
  category: string;
  source: string;
  timestamp: Date;
  data;
  metadata;
}

export function normalizeEvent(event): NormalizedEvent {
  const eventId = event.eventId || event.id || uuidv4();
  const userId = event.userId || event.user_id || event.phone || 'unknown';
  const type = event.eventType || event.messageType || event.type || 'unknown';
  const category = event.category || 'engagement';
  const source = event.source || 'unknown';
  const timestamp = event.timestamp || event.createdAt || new Date();
  const data = event.data || event.extraData || {};
  const metadata = extractMetadata(event);

  return { eventId, userId, type, category, source, timestamp, data, metadata };
}

export function toTimelineEvent(event: NormalizedEvent) {
  return {
    eventId: event.eventId,
    userId: event.userId,
    type: event.type,
    category: event.category,
    source: event.source,
    timestamp: new Date(event.timestamp),
    data: event.data,
    metadata: event.metadata
  };
}

function extractMetadata(event): unknown {
  return {
    sessionId: event.sessionId,
    deviceId: event.deviceId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    correlationId: event.correlationId,
    parentEventId: event.parentEventId
  };
}

export function validateEvent(event): boolean {
  if (!event || typeof event !== 'object') return false;
  if (!event.userId && !event.user_id && !event.phone) return false;
  return true;
}

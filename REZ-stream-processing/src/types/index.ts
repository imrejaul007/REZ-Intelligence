/**
 * REZ Stream Processing - Types
 * Type definitions for stream processing
 */

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  source: string;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    [key: string]: unknown;
  };
}

export type StreamEventType =
  | 'commerce.order'
  | 'commerce.payment'
  | 'commerce.refund'
  | 'identity.login'
  | 'identity.register'
  | 'engagement.view'
  | 'engagement.click'
  | 'engagement.search'
  | 'intelligence.intent'
  | 'intelligence.prediction'
  | 'geo.location'
  | 'geo.checkin'
  | 'notification.sent'
  | 'notification.opened';

export interface StreamConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  topics: string[];
}

export interface ProcessorConfig {
  name: string;
  transformation: 'identity' | 'filter' | 'map' | 'aggregate' | 'window';
  outputTopic?: string;
  outputCollection?: string;
}

export interface AggregationWindow {
  type: 'tumbling' | 'sliding' | 'session';
  sizeMs: number;
  slideMs?: number;
}

export interface AggregationResult {
  windowId: string;
  startTime: Date;
  endTime: Date;
  metrics: Record<string, number | string>;
  count: number;
}

export interface KafkaMessage {
  key: string | null;
  value: Buffer | string;
  timestamp: string;
  headers?: Record<string, Buffer | string>;
}

export interface ConsumerRecord {
  topic: string;
  partition: number;
  offset: number;
  key: string | null;
  value: string | Buffer;
  timestamp: string;
  headers: Record<string, Buffer | string>;
}

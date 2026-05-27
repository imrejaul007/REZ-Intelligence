import { logger } from './utils/logger.js';

/**
 * REZ Mind Client - Bidirectional Integration
 *
 * Features:
 * - Send events TO ReZ Mind
 * - Receive insights FROM ReZ Mind
 * - WebSocket for real-time communication
 *
 * Usage:
 *   import { createReZMindClient } from './ReZMindClient';
 *
 *   const client = createReZMindClient({ service: 'kitchen-ai' });
 *
 *   // Send events
 *   await client.emit('ORDER_COMPLETED', { orderId: '123', prepTime: 720 });
 *
 *   // Receive insights
 *   client.on('INSIGHT', (insight) => {
 *     console.log('Got insight:', insight);
 *   });
 */

import axios, { AxiosInstance } from 'axios';
import EventEmitter from 'eventemitter3';
import { randomUUID } from 'crypto';

// ============================================
// Configuration
// ============================================

interface ReZMindConfig {
  service: string;
  url?: string;
  apiKey?: string;
  enableWebSocket?: boolean;
}

interface MindEvent {
  id: string;
  type: string;
  source: string;
  target: string | '*';
  payload: unknown;
  timestamp: Date;
  metadata?: {
    merchantId?: string;
    userId?: string;
    correlationId?: string;
    orderId?: string;
  };
}

interface Insight {
  type: 'RECOMMENDATION' | 'PREDICTION' | 'ANOMALY' | 'COMMAND' | 'ALERT';
  source: string;
  targetService?: string;
  confidence: number;
  reasoning: string;
  payload;
  timestamp: Date;
}

// ============================================
// Event Constants
// ============================================

export const KITCHEN_EVENTS = {
  ORDER_RECEIVED: 'kitchen:order:received',
  ORDER_STARTED: 'kitchen:order:started',
  ORDER_COMPLETED: 'kitchen:order:completed',
  ORDER_DELAYED: 'kitchen:order:delayed',
  STATION_CONGESTED: 'kitchen:station:congested',
  PREP_TIME_ACTUAL: 'kitchen:prep:actual',
} as const;

export const MERCHANT_EVENTS = {
  INVENTORY_LOW: 'merchant:inventory:low',
  INVENTORY_RECEIVED: 'merchant:inventory:received',
  ORDER_PLACED: 'merchant:order:placed',
  ORDER_COMPLETED: 'merchant:order:completed',
  PAYMENT_SUCCESS: 'merchant:payment:success',
  PAYMENT_FAILED: 'merchant:payment:failed',
  FRAUD_DETECTED: 'merchant:fraud:detected',
} as const;

export const CONSUMER_EVENTS = {
  SEARCH: 'consumer:search',
  ITEM_VIEWED: 'consumer:item:viewed',
  CART_ADDED: 'consumer:cart:added',
  CART_ABANDONED: 'consumer:cart:abandoned',
  ORDER_PLACED: 'consumer:order:placed',
} as const;

export const MIND_EVENTS = {
  INSIGHT: 'mind:insight',
  RECOMMENDATION: 'mind:recommendation',
  PREDICTION: 'mind:prediction',
  ANOMALY: 'mind:anomaly',
  COMMAND: 'mind:command',
  ALERT: 'mind:alert',
} as const;

// ============================================
// Client Implementation
// ============================================

class ReZMindClient {
  private serviceName: string;
  private http: AxiosInstance;
  private emitter: EventEmitter;
  private ws: WebSocket | null = null;
  private connected = false;
  private eventQueue: MindEvent[] = [];

  constructor(config: ReZMindConfig) {
    this.serviceName = config.service;
    this.emitter = new EventEmitter();

    // HTTP client for REST API
    this.http = axios.create({
      baseURL: config.url || process.env.REZ_MIND_URL || 'https://rez-mind.onrender.com',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': this.serviceName,
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
      },
    });

    // Auto-connect WebSocket if enabled
    if (config.enableWebSocket !== false) {
      this.connectWebSocket();
    }
  }

  // ============================================
  // SEND Events TO ReZ Mind
  // ============================================

  /**
   * Emit an event to ReZ Mind
   */
  async emit<T>(type: string, payload: T, metadata?: MindEvent['metadata']): Promise<string> {
    const event: MindEvent = {
      id: this.generateId(),
      type,
      source: this.serviceName,
      target: 'mind',
      payload,
      timestamp: new Date(),
      metadata,
    };

    try {
      const response = await this.http.post('/api/events', event);

      // Emit locally for monitoring
      this.emitter.emit(type, event);

      return response.data.eventId || event.id;
    } catch (error) {
      console.error(`[ReZ Mind] Failed to emit ${type}:`, error.message);

      // Queue for retry
      this.eventQueue.push(event);

      throw error;
    }
  }

  // Convenience methods
  async emitOrderCompleted(order: {
    orderId: string;
    merchantId: string;
    prepTime: number;
    stationTimes?: Record<string, number>;
  }) {
    return this.emit(KITCHEN_EVENTS.ORDER_COMPLETED, order, {
      orderId: order.orderId,
      merchantId: order.merchantId,
    });
  }

  async emitOrderDelayed(order: {
    orderId: string;
    merchantId: string;
    delaySeconds: number;
    reason: string;
  }) {
    return this.emit(KITCHEN_EVENTS.ORDER_DELAYED, order, {
      orderId: order.orderId,
      merchantId: order.merchantId,
    });
  }

  async emitInventoryLow(data: {
    merchantId: string;
    itemId: string;
    itemName: string;
    currentStock: number;
    threshold: number;
  }) {
    return this.emit(MERCHANT_EVENTS.INVENTORY_LOW, data, {
      merchantId: data.merchantId,
    });
  }

  async emitFraudDetected(data: {
    merchantId: string;
    orderId: string;
    riskScore: number;
    indicators: string[];
  }) {
    return this.emit(MERCHANT_EVENTS.FRAUD_DETECTED, data, {
      orderId: data.orderId,
      merchantId: data.merchantId,
    });
  }

  async emitSearch(query: { userId: string; query: string; resultsCount: number }) {
    return this.emit(CONSUMER_EVENTS.SEARCH, query, {
      userId: query.userId,
    });
  }

  async emitItemViewed(data: { userId: string; itemId: string; merchantId: string }) {
    return this.emit(CONSUMER_EVENTS.ITEM_VIEWED, data, {
      userId: data.userId,
      merchantId: data.merchantId,
    });
  }

  // ============================================
  // RECEIVE Events FROM ReZ Mind
  // ============================================

  on(eventType: string, handler: (event: MindEvent) => void): void;
  on(eventType: string, handler: (insight: Insight) => void): void;
  on(eventType: string, handler: (data) => void): void {
    this.emitter.on(eventType, handler);
  }

  once(eventType: string, handler: (data) => void): void {
    this.emitter.once(eventType, handler);
  }

  off(eventType: string, handler?: (data) => void): void {
    if (handler) {
      this.emitter.off(eventType, handler);
    } else {
      this.emitter.removeAllListeners(eventType);
    }
  }

  // ============================================
  // WebSocket Connection
  // ============================================

  private connectWebSocket(): void {
    const wsUrl = this.http.defaults.baseURL!
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')
      .concat('/ws');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        logger.info(`[ReZ Mind] WebSocket connected to ${wsUrl}`);
        this.connected = true;

        // Authenticate with service name
        this.ws?.send(JSON.stringify({
          type: 'auth',
          service: this.serviceName,
        }));

        // Flush queued events
        this.flushQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (e) {
          console.error('[ReZ Mind] Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        logger.info('[ReZ Mind] WebSocket disconnected, reconnecting...');
        this.connected = false;
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = (error) => {
        console.error('[ReZ Mind] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[ReZ Mind] Failed to connect:', error);
      setTimeout(() => this.connectWebSocket(), 5000);
    }
  }

  private handleMessage(message): void {
    if (message.type === 'event' || message.type === 'insight') {
      const event = message as MindEvent;
      this.emitter.emit(event.type, event);
      this.emitter.emit('*', event);
    } else if (message.type === 'command') {
      this.emitter.emit('command', message);
      this.emitter.emit('mind:command', message);
    }
  }

  private flushQueue(): void {
    if (!this.connected || this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of events) {
      this.http.post('/api/events', event)
        .then(() => this.emitter.emit(event.type, event))
        .catch(() => {
          event.metadata && (event.metadata.correlationId = 'retry');
          this.eventQueue.push(event);
        });
    }
  }

  // ============================================
  // Utilities
  // ============================================

  private generateId(): string {
    return `${this.serviceName}-${Date.now()}-${randomUUID().replace(/-/g, '')}`;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.emitter.removeAllListeners();
  }
}

// ============================================
// Factory
// ============================================

let globalClient: ReZMindClient | null = null;

export function createReZMindClient(config: ReZMindConfig): ReZMindClient {
  return new ReZMindClient(config);
}

export function getGlobalReZMindClient(): ReZMindClient {
  if (!globalClient) {
    globalClient = new ReZMindClient({
      service: process.env.SERVICE_NAME || 'unknown',
      enableWebSocket: true,
    });
  }
  return globalClient;
}

// Backward compatibility
export const rezMindMerchant = {
  sendOrderCompleted: async (data) => {
    const client = getGlobalReZMindClient();
    return client.emitOrderCompleted(data);
  },
  sendInventoryLow: async (data) => {
    const client = getGlobalReZMindClient();
    return client.emitInventoryLow(data);
  },
  sendPaymentSuccess: async (data) => {
    const client = getGlobalReZMindClient();
    return client.emit('merchant:payment:success', data);
  },
};

export const rezMindConsumer = {
  sendSearch: async (data) => {
    const client = getGlobalReZMindClient();
    return client.emitSearch(data);
  },
  sendItemViewed: async (data) => {
    const client = getGlobalReZMindClient();
    return client.emitItemViewed(data);
  },
  sendOrder: async (data) => {
    const client = getGlobalReZMindClient();
    return client.emit(CONSUMER_EVENTS.ORDER_PLACED, data);
  },
};

export default ReZMindClient;

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '../config/logger';
import { config } from '../config';
import { ActionEngine } from '../engine/action-engine';
import { getActionsByTrigger } from '../rules/action-registry';
import { ActionRequest } from '../types/action-levels';
import { handleDormantFinanceUser, handleEMIDueReminder } from '../handlers/financeHandler';

// Crypto-based random number generator for secure randomness
function secureRandom(): number {
  return parseInt(crypto.randomBytes(4).toString('hex'), 16) / 0xFFFFFFFF;
}

type EventHandler = (data) => Promise<void>;

interface Subscription {
  eventType: string;
  handler: EventHandler;
}

// Event subscription registry
const subscriptions: Subscription[] = [];

/**
 * Event from REZ Event Platform
 */
export interface RezEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Event Consumer for REZ Event Platform
 *
 * Subscribes to events and triggers appropriate actions
 */
export class EventConsumer extends EventEmitter {
  private apiClient: AxiosInstance;
  private isConnected: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastEventId: string | null = null;
  private actionEngine: ActionEngine;

  constructor() {
    super();
    this.actionEngine = ActionEngine.getInstance();

    this.apiClient = axios.create({
      baseURL: `http://${config.eventPlatform.host}:${config.eventPlatform.port}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.eventPlatform.apiKey && {
          'X-API-Key': config.eventPlatform.apiKey,
        }),
      },
    });
  }

  /**
   * Start consuming events
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Event consumer already connected');
      return;
    }

    logger.info('Starting event consumer...');

    try {
      // Check connection to event platform
      await this.checkConnection();

      // Start polling for events
      this.startPolling();

      this.isConnected = true;
      logger.info('Event consumer started successfully');
    } catch (error) {
      logger.error('Failed to start event consumer', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    logger.info('Stopping event consumer...');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isConnected = false;
    logger.info('Event consumer stopped');
  }

  /**
   * Check connection to event platform
   */
  private async checkConnection(): Promise<void> {
    try {
      const response = await this.apiClient.get('/health');
      logger.info('Connected to event platform', {
        status: response.data.status,
      });
    } catch (error) {
      logger.warn('Could not connect to event platform health endpoint', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - continue anyway for development
    }
  }

  /**
   * Start polling for events
   */
  private startPolling(): void {
    const pollIntervalMs = 5000; // Poll every 5 seconds

    this.pollInterval = setInterval(async () => {
      try {
        await this.pollEvents();
      } catch (error) {
        logger.error('Error polling events', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, pollIntervalMs);

    // Initial poll
    this.pollEvents();
  }

  /**
   * Poll for new events
   */
  private async pollEvents(): Promise<void> {
    try {
      const params: Record<string, string> = {
        limit: '50',
      };

      if (this.lastEventId) {
        params.since = this.lastEventId;
      }

      const response = await this.apiClient.get('/events', { params });

      if (response.data.events && Array.isArray(response.data.events)) {
        for (const event of response.data.events) {
          await this.processEvent(event);
          this.lastEventId = event.id;
        }
      }
    } catch (error) {
      // Don't log error for 404 (endpoint might not exist in dev)
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Development mode - simulate events
        this.simulateEvents();
      }
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: RezEvent): Promise<void> {
    logger.info('Processing event', {
      eventId: event.id,
      eventType: event.type,
      source: event.source,
    });

    // Call registered subscribers for this event type
    const eventSubscriptions = subscriptions.filter(sub => sub.eventType === event.type);
    for (const sub of eventSubscriptions) {
      try {
        await sub.handler(event.data);
        logger.info('Subscription handler executed', {
          eventType: event.type,
          handler: sub.handler.name,
        });
      } catch (error) {
        logger.error('Subscription handler failed', {
          eventType: event.type,
          handler: sub.handler.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Find matching actions for this event type
    const actions = getActionsByTrigger(event.type);

    if (actions.length === 0) {
      logger.debug('No actions registered for event type', {
        eventType: event.type,
      });
      return;
    }

    logger.info(`Found ${actions.length} action(s) for event`, {
      eventId: event.id,
      eventType: event.type,
      actions: actions.map((a) => a.id),
    });

    // Execute each action
    for (const action of actions) {
      try {
        const request: ActionRequest = {
          actionId: action.id,
          eventId: event.id,
          payload: {
            ...event.data,
            eventType: event.type,
            eventSource: event.source,
          },
          metadata: event.metadata,
        };

        const result = await this.actionEngine.executeAction(request);

        logger.info('Action executed', {
          actionId: action.id,
          executionId: result.executionId,
          success: result.success,
          status: result.status,
        });

        // Emit event for monitoring
        this.emit('actionExecuted', {
          event,
          action,
          result,
        });
      } catch (error) {
        logger.error('Failed to execute action', {
          actionId: action.id,
          eventId: event.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        this.emit('actionError', {
          event,
          action,
          error,
        });
      }
    }

    // Emit general event processed
    this.emit('eventProcessed', event);
  }

  /**
   * Simulate events for development/testing
   */
  private simulateEvents(): void {
    const simulatedEvents: RezEvent[] = [
      {
        id: `sim-inventory-low-${Date.now()}`,
        type: 'inventory.low',
        source: 'inventory-service',
        timestamp: new Date().toISOString(),
        data: {
          itemId: 'ITEM-001',
          itemName: 'Sample Product',
          currentStock: 5,
          reorderPoint: 10,
          supplierId: 'SUP-001',
        },
      },
      {
        id: `sim-order-shipped-${Date.now()}`,
        type: 'order.shipped',
        source: 'order-service',
        timestamp: new Date().toISOString(),
        data: {
          orderId: 'ORD-12345',
          customerId: 'CUST-001',
          trackingNumber: 'TRACK123',
          carrier: 'FedEx',
        },
      },
      {
        id: `sim-cart-abandoned-${Date.now()}`,
        type: 'cart.abandoned',
        source: 'cart-service',
        timestamp: new Date().toISOString(),
        data: {
          cartId: 'CART-789',
          customerId: 'CUST-002',
          totalValue: 149.99,
          itemsCount: 3,
        },
      },
    ];

    // Pick a random event to simulate
    const event = simulatedEvents[Math.floor(secureRandom() * simulatedEvents.length)];

    logger.info('Simulating event (dev mode)', {
      eventId: event.id,
      eventType: event.type,
    });

    this.processEvent(event);
  }

  /**
   * Manually submit an event (for testing/webhooks)
   */
  async submitEvent(event: RezEvent): Promise<void> {
    await this.processEvent(event);
  }

  /**
   * Get connection status
   */
  isActive(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let eventConsumer: EventConsumer | null = null;

export function getEventConsumer(): EventConsumer {
  if (!eventConsumer) {
    eventConsumer = new EventConsumer();
  }
  return eventConsumer;
}

/**
 * Subscribe to an event type with a handler
 */
export function subscribe(eventType: string, handler: EventHandler): void {
  subscriptions.push({ eventType, handler });
  logger.info('Event subscription registered', { eventType });
}

// Note: Finance handlers are registered in index.ts via subscribe() calls

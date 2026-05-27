import logger from './utils/logger.js';

/**
 * ReZ AI Plugin Registry
 * Modular AI services that can be plugged into unknown vertical
 */

import { EventEmitter } from 'events';

// Plugin Interface
export interface AIPlugin {
  name: string;
  version: string;
  description: string;

  // Lifecycle
  init(config: AIPluginConfig): Promise<void>;
  shutdown(): Promise<void>;

  // Events to subscribe to
  events: string[];

  // API handlers
  api: AIPluginAPI;

  // ML models this plugin provides
  models: string[];
}

// Plugin Configuration
export interface AIPluginConfig {
  redis: RedisConfig;
  mongodb: MongoConfig;
  eventBus: EventEmitter;
  config: Record<string, unknown>;
}

// Redis Config
export interface RedisConfig {
  url: string;
  password?: string;
}

// MongoDB Config
export interface MongoConfig {
  uri: string;
  db: string;
}

// Plugin API Interface
export interface AIPluginAPI {
  [endpoint: string]: AIRequestHandler;
}

export type AIRequestHandler = (
  req: AIRequest,
  res: AIResponse
) => Promise<void>;

// AI Request/Response
export interface AIRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body;
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface AIResponse {
  status(code: number): AIResponse;
  json(data): void;
  send(data: string): void;
}

// Predictions
export interface Prediction {
  model: string;
  prediction;
  confidence: number;
  metadata?: Record<string, unknown>;
}

// Recommendations
export interface Recommendation {
  id: string;
  type: string;
  score: number;
  data;
  reason: string;
}

// Plugin Registry
export class AIPluginRegistry {
  private plugins: Map<string, AIPlugin> = new Map();
  private eventBus: EventEmitter;

  constructor() {
    this.eventBus = new EventEmitter();
  }

  // Register a plugin
  async register(plugin: AIPlugin): Promise<void> {
    logger.info(`[AI Registry] Registering plugin: ${plugin.name} v${plugin.version}`);

    // Initialize plugin
    await plugin.init({
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        db: 'rez_ai'
      },
      eventBus: this.eventBus,
      config: {}
    });

    // Subscribe to events
    for (const event of plugin.events) {
      this.eventBus.on(event, async (data) => {
        try {
          await this.handleEvent(plugin, event, data);
        } catch (error) {
          console.error(`[AI Registry] Error handling event ${event}:`, error);
        }
      });
    }

    // Store plugin
    this.plugins.set(plugin.name, plugin);

    logger.info(`[AI Registry] Plugin registered: ${plugin.name}`);
  }

  // Handle an event for a plugin
  private async handleEvent(plugin: AIPlugin, event: string, data): Promise<void> {
    logger.info(`[AI Registry] ${plugin.name} handling event: ${event}`);
    // Events are handled internally by plugins
  }

  // Get plugin by name
  getPlugin(name: string): AIPlugin | undefined {
    return this.plugins.get(name);
  }

  // Get all plugins
  getAllPlugins(): AIPlugin[] {
    return Array.from(this.plugins.values());
  }

  // Get plugins by model
  getPluginsByModel(model: string): AIPlugin[] {
    return this.getAllPlugins().filter(p => p.models.includes(model));
  }

  // Get prediction from any plugin
  async predict(plugin: string, model: string, input): Promise<Prediction | null> {
    const p = this.getPlugin(plugin);
    if (!p) return null;

    const handler = p.api[`/predict/${model}`];
    if (!handler) return null;

    // Create mock request/response
    const req: AIRequest = {
      method: 'POST',
      path: `/predict/${model}`,
      headers: {},
      body: input,
      params: { model },
      query: {}
    };

    let result: unknown = null;
    const res: AIResponse = {
      status: () => res,
      json: (data) => { result = data; }
    };

    await handler(req, res);
    return result;
  }

  // Get recommendations from any plugin
  async recommend(plugin: string, userId: string, context): Promise<Recommendation[]> {
    const p = this.getPlugin(plugin);
    if (!p) return [];

    const handler = p.api['/recommend'];
    if (!handler) return [];

    let result: unknown = [];
    const res: AIResponse = {
      status: () => res,
      json: (data) => { result = data; }
    };

    await handler(
      {
        method: 'GET',
        path: '/recommend',
        headers: {},
        body: {},
        params: {},
        query: { userId, ...context }
      },
      res
    );

    return result;
  }

  // Emit event to all plugins
  emitEvent(event: string, data): void {
    this.eventBus.emit(event, data);
  }

  // Shutdown all plugins
  async shutdown(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.shutdown();
    }
    this.plugins.clear();
  }
}

// Singleton instance
export const aiRegistry = new AIPluginRegistry();

// Decorator for plugin registration
export function registerPlugin(name: string, version: string, events: string[], models: string[]) {
  return function <T extends { new (...args: unknown[]): AIPlugin }>(constructor: T) {
    return class extends constructor {
      name = name;
      version = version;
      events = events;
      models = models;
    };
  };
}

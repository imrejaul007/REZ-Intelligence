/**
 * KnowledgeBase - Interface for knowledge retrieval and caching
 * Provides caching, semantic search, and knowledge management
 */

import { randomUUID } from 'crypto';
import { IResponse } from '../interfaces/IResponse';
import { KnowledgeBaseConfig } from '../types/expert.types';
import { Logger } from '../utils/logger';

export interface KnowledgeEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeQuery {
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
  threshold?: number;
}

export interface KnowledgeResult {
  entries: KnowledgeEntry[];
  scores: number[];
  total: number;
}

export interface CacheEntry {
  response: IResponse;
  expiresAt: number;
}

export class KnowledgeBase {
  private config: KnowledgeBaseConfig;
  private logger: Logger;
  private cache: Map<string, CacheEntry>;
  private redis?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode?: string, ttl?: number) => Promise<void>;
    del: (key: string) => Promise<number>;
    keys: (pattern: string) => Promise<string[]>;
  };

  constructor(config: KnowledgeBaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.cache = new Map();
  }

  /**
   * Connect to the knowledge base backend
   */
  async connect(redisClient?: typeof this.redis): Promise<void> {
    this.logger.info(`Connecting to knowledge base: ${this.config.provider}`);
    this.redis = redisClient;

    if (this.config.enabled) {
      this.logger.info('Knowledge base enabled and ready');
    }
  }

  /**
   * Disconnect from the knowledge base
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from knowledge base');
    this.cache.clear();
  }

  /**
   * Get cached response
   */
  async getCachedResponse(intentId: string): Promise<IResponse | null> {
    const cacheKey = this.getCacheKey(intentId);

    // Check in-memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Cache hit for intent: ${intentId}`);
      return cached.response;
    }

    // Check Redis if configured
    if (this.redis) {
      try {
        const cachedData = await this.redis.get(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData) as CacheEntry;
          if (parsed.expiresAt > Date.now()) {
            this.logger.debug(`Redis cache hit for intent: ${intentId}`);
            // Restore to memory cache
            this.cache.set(cacheKey, parsed);
            return parsed.response;
          }
        }
      } catch (error) {
        this.logger.warn(`Redis cache read error: ${error}`);
      }
    }

    // Remove expired entry
    this.cache.delete(cacheKey);
    return null;
  }

  /**
   * Cache a response
   */
  async cacheResponse(intentId: string, response: IResponse, ttlSeconds?: number): Promise<void> {
    const cacheKey = this.getCacheKey(intentId);
    const ttl = ttlSeconds || this.config.cacheTtlSeconds;
    const expiresAt = Date.now() + ttl * 1000;

    const cacheEntry: CacheEntry = { response, expiresAt };

    // Store in memory
    this.cache.set(cacheKey, cacheEntry);

    // Store in Redis if configured
    if (this.redis) {
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(cacheEntry),
          'EX',
          ttl
        );
        this.logger.debug(`Cached response for intent: ${intentId}`);
      } catch (error) {
        this.logger.warn(`Redis cache write error: ${error}`);
      }
    }
  }

  /**
   * Invalidate cached response
   */
  async invalidateCache(intentId: string): Promise<void> {
    const cacheKey = this.getCacheKey(intentId);
    this.cache.delete(cacheKey);

    if (this.redis) {
      try {
        await this.redis.del(cacheKey);
      } catch (error) {
        this.logger.warn(`Redis cache invalidate error: ${error}`);
      }
    }
  }

  /**
   * Search knowledge base
   */
  async search(query: KnowledgeQuery): Promise<KnowledgeResult> {
    const limit = query.limit || this.config.maxResults;
    const threshold = query.threshold || this.config.similarityThreshold;

    this.logger.debug(`Searching knowledge base: ${query.query}`);

    // In a real implementation, this would:
    // 1. Generate embedding for the query
    // 2. Search vector database for similar entries
    // 3. Apply filters
    // 4. Return ranked results

    // Placeholder implementation
    return {
      entries: [],
      scores: [],
      total: 0
    };
  }

  /**
   * Add a knowledge entry
   */
  async addEntry(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeEntry> {
    const now = new Date().toISOString();
    const fullEntry: KnowledgeEntry = {
      ...entry,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    this.logger.info(`Adding knowledge entry: ${fullEntry.id}`);
    return fullEntry;
  }

  /**
   * Update a knowledge entry
   */
  async updateEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry | null> {
    // In a real implementation, this would update the database
    this.logger.info(`Updating knowledge entry: ${id}`);
    return null;
  }

  /**
   * Delete a knowledge entry
   */
  async deleteEntry(id: string): Promise<boolean> {
    this.logger.info(`Deleting knowledge entry: ${id}`);
    return true;
  }

  /**
   * Get a knowledge entry by ID
   */
  async getEntry(id: string): Promise<KnowledgeEntry | null> {
    // In a real implementation, this would fetch from the database
    return null;
  }

  /**
   * Health check for the knowledge base
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();

    try {
      // Check Redis connection
      if (this.redis) {
        await this.redis.keys(this.config.namespace + ':*');
      }
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      this.logger.error('Knowledge base health check failed:', error);
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.logger.info('Knowledge base cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry?: number;
  } {
    const now = Date.now();
    let expiredCount = 0;
    let oldestEntry: number | undefined;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt < now) {
        expiredCount++;
      }
      if (!oldestEntry || entry.expiresAt < oldestEntry) {
        oldestEntry = entry.expiresAt;
      }
    }

    return {
      size: this.cache.size - expiredCount,
      hitRate: 0, // Would need to track this separately
      oldestEntry
    };
  }

  private getCacheKey(intentId: string): string {
    return `${this.config.namespace}:response:${intentId}`;
  }

  private generateId(): string {
    return `${Date.now()}-${randomUUID().replace(/-/g, '').substring(0, 9)}`;
  }
}

/**
 * Mock knowledge base for testing
 */
export class MockKnowledgeBase extends KnowledgeBase {
  private entries: Map<string, KnowledgeEntry> = new Map();

  async search(query: KnowledgeQuery): Promise<KnowledgeResult> {
    const entries = Array.from(this.entries.values()).filter(entry => {
      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          if (entry.metadata[key] !== value) return false;
        }
      }
      return entry.content.toLowerCase().includes(query.query.toLowerCase());
    });

    return {
      entries: entries.slice(0, query.limit || this.config.maxResults),
      scores: entries.map(() => 1),
      total: entries.length
    };
  }

  async addEntry(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeEntry> {
    const fullEntry = await super.addEntry(entry);
    this.entries.set(fullEntry.id, fullEntry);
    return fullEntry;
  }
}

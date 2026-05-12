import { v4 as uuidv4 } from 'uuid';
import { Memory, IMemoryDocument, MemoryType } from '../models/UserMemory';
import { config } from '../config';
import { IMemoryEntry } from '../types';
import { logger } from '../utils/logger';

export interface CreateMemoryInput {
  userId: string;
  type?: MemoryType;
  content: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: string;
  ttlSeconds?: number;
}

export interface SearchMemoriesInput {
  userId: string;
  type?: MemoryType;
  tags?: string[];
  query?: string;
  limit?: number;
  skip?: number;
  minImportance?: number;
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export class MemoryService {
  /**
   * Create a new memory entry
   */
  async createMemory(input: CreateMemoryInput): Promise<IMemoryDocument> {
    const {
      userId,
      type = MemoryType.SHORT_TERM,
      content,
      importance = 5,
      metadata,
      tags = [],
      source,
      ttlSeconds,
    } = input;

    // Calculate expiration for short-term memories
    let expiresAt: Date | undefined;
    if (type === MemoryType.SHORT_TERM) {
      const ttl = ttlSeconds || config.SHORT_TERM_MEMORY_TTL;
      expiresAt = new Date(Date.now() + ttl * 1000);
    }

    // Check max memories limit for short-term
    if (type === MemoryType.SHORT_TERM) {
      const currentCount = await Memory.countDocuments({
        userId,
        type: MemoryType.SHORT_TERM,
      });
      if (currentCount >= config.MAX_SHORT_TERM_MEMORIES) {
        // Evict least important/accessed memory
        await this.evictLeastImportant(userId);
      }
    }

    const memoryId = `mem_${uuidv4()}`;

    const memory = await Memory.create({
      id: memoryId,
      userId,
      type,
      content,
      importance,
      metadata,
      tags,
      source,
      expiresAt,
      accessCount: 0,
    });

    logger.info(`Memory created: ${memoryId}`, { userId, type });

    return memory;
  }

  /**
   * Get a memory by ID
   */
  async getMemory(memoryId: string, userId: string): Promise<IMemoryDocument | null> {
    const memory = await Memory.findOne({ id: memoryId, userId });
    if (memory) {
      await memory.incrementAccess();
    }
    return memory;
  }

  /**
   * Get all memories for a user
   */
  async getUserMemories(input: SearchMemoriesInput): Promise<IMemoryDocument[]> {
    const {
      userId,
      type,
      tags,
      query,
      limit = 50,
      skip = 0,
      minImportance,
    } = input;

    const filter: Record<string, unknown> = { userId };

    if (type) {
      filter.type = type;
    }

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (minImportance !== undefined) {
      filter.importance = { $gte: minImportance };
    }

    let memories = await Memory.find(filter)
      .sort({ importance: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Simple text search if query is provided
    if (query) {
      const queryLower = query.toLowerCase();
      memories = memories.filter((m) =>
        m.content.toLowerCase().includes(queryLower)
      );
    }

    return memories;
  }

  /**
   * Update a memory entry
   */
  async updateMemory(
    memoryId: string,
    userId: string,
    input: UpdateMemoryInput
  ): Promise<IMemoryDocument | null> {
    const memory = await Memory.findOne({ id: memoryId, userId });
    if (!memory) {
      return null;
    }

    const { content, importance, metadata, tags } = input;

    if (content !== undefined) {
      memory.content = content;
    }
    if (importance !== undefined) {
      memory.importance = importance;
    }
    if (metadata !== undefined) {
      memory.metadata = metadata;
    }
    if (tags !== undefined) {
      memory.tags = tags;
    }

    await memory.save();
    logger.info(`Memory updated: ${memoryId}`);

    return memory;
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(memoryId: string, userId: string): Promise<boolean> {
    const result = await Memory.deleteOne({ id: memoryId, userId });
    if (result.deletedCount > 0) {
      logger.info(`Memory deleted: ${memoryId}`);
      return true;
    }
    return false;
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllUserMemories(userId: string, type?: MemoryType): Promise<number> {
    const filter: Record<string, unknown> = { userId };
    if (type) {
      filter.type = type;
    }

    const result = await Memory.deleteMany(filter);
    logger.info(`Deleted ${result.deletedCount} memories for user: ${userId}`);
    return result.deletedCount || 0;
  }

  /**
   * Consolidate memories - move important short-term to long-term
   */
  async consolidateMemories(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find memories that should be consolidated
    const memoriesToConsolidate = await Memory.find({
      userId,
      type: MemoryType.SHORT_TERM,
      importance: { $gte: 7 },
      createdAt: { $lt: thirtyDaysAgo },
    });

    let consolidatedCount = 0;
    for (const memory of memoriesToConsolidate) {
      memory.type = MemoryType.LONG_TERM;
      memory.expiresAt = undefined; // Long-term doesn't expire
      await memory.save();
      consolidatedCount++;
    }

    logger.info(`Consolidated ${consolidatedCount} memories for user: ${userId}`);
    return consolidatedCount;
  }

  /**
   * Search memories by semantic similarity (simplified version)
   * In production, this would use vector embeddings
   */
  async semanticSearch(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<IMemoryDocument[]> {
    // Simple keyword-based search for now
    // Production would use vector embeddings with MongoDB Atlas Search or external service
    const queryWords = query.toLowerCase().split(/\s+/);

    const memories = await Memory.find({
      userId,
      type: { $in: [MemoryType.LONG_TERM, MemoryType.SEMANTIC] },
    });

    // Score memories based on keyword matches
    const scored = memories.map((memory) => {
      const content = memory.content.toLowerCase();
      let score = 0;

      for (const word of queryWords) {
        if (content.includes(word)) {
          score++;
        }
      }

      // Boost by importance and recency
      const importanceBoost = memory.importance / 10;
      const recencyBoost = memory.createdAt.getTime() / Date.now();
      score += importanceBoost + recencyBoost;

      return { memory, score };
    });

    // Sort by score and return top results
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.memory);
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    averageImportance: number;
    totalAccessCount: number;
  }> {
    const memories = await Memory.find({ userId });

    const byType: Record<string, number> = {};
    let totalImportance = 0;
    let totalAccessCount = 0;

    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      totalImportance += memory.importance;
      totalAccessCount += memory.accessCount;
    }

    return {
      total: memories.length,
      byType,
      averageImportance: memories.length > 0 ? totalImportance / memories.length : 0,
      totalAccessCount,
    };
  }

  /**
   * Evict the least important memory for a user
   */
  private async evictLeastImportant(userId: string): Promise<void> {
    const oldest = await Memory.findOne({
      userId,
      type: MemoryType.SHORT_TERM,
    }).sort({ importance: 1, lastAccessed: 1 });

    if (oldest) {
      await oldest.deleteOne();
      logger.info(`Evicted memory: ${oldest.id} due to capacity limit`);
    }
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpired(): Promise<number> {
    const deletedCount = await Memory.deleteExpired();
    logger.info(`Cleaned up ${deletedCount} expired memories`);
    return deletedCount;
  }

  /**
   * Access a memory (increment access count)
   */
  async accessMemory(memoryId: string, userId: string): Promise<IMemoryDocument | null> {
    const memory = await Memory.findOne({ id: memoryId, userId });
    if (memory) {
      await memory.incrementAccess();
    }
    return memory;
  }

  /**
   * Batch create memories
   */
  async batchCreateMemories(
    memories: CreateMemoryInput[]
  ): Promise<IMemoryDocument[]> {
    const created = await Promise.all(
      memories.map((m) => this.createMemory(m))
    );
    logger.info(`Batch created ${created.length} memories`);
    return created;
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
export default memoryService;

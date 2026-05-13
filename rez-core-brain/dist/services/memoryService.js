"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = void 0;
const uuid_1 = require("uuid");
const UserMemory_1 = require("../models/UserMemory");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class MemoryService {
    /**
     * Create a new memory entry
     */
    async createMemory(input) {
        const { userId, type = UserMemory_1.MemoryType.SHORT_TERM, content, importance = 5, metadata, tags = [], source, ttlSeconds, } = input;
        // Calculate expiration for short-term memories
        let expiresAt;
        if (type === UserMemory_1.MemoryType.SHORT_TERM) {
            const ttl = ttlSeconds || config_1.config.SHORT_TERM_MEMORY_TTL;
            expiresAt = new Date(Date.now() + ttl * 1000);
        }
        // Check max memories limit for short-term
        if (type === UserMemory_1.MemoryType.SHORT_TERM) {
            const currentCount = await UserMemory_1.Memory.countDocuments({
                userId,
                type: UserMemory_1.MemoryType.SHORT_TERM,
            });
            if (currentCount >= config_1.config.MAX_SHORT_TERM_MEMORIES) {
                // Evict least important/accessed memory
                await this.evictLeastImportant(userId);
            }
        }
        const memoryId = `mem_${(0, uuid_1.v4)()}`;
        const memory = await UserMemory_1.Memory.create({
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
        logger_1.logger.info(`Memory created: ${memoryId}`, { userId, type });
        return memory;
    }
    /**
     * Get a memory by ID
     */
    async getMemory(memoryId, userId) {
        const memory = await UserMemory_1.Memory.findOne({ id: memoryId, userId });
        if (memory) {
            await memory.incrementAccess();
        }
        return memory;
    }
    /**
     * Get all memories for a user
     */
    async getUserMemories(input) {
        const { userId, type, tags, query, limit = 50, skip = 0, minImportance, } = input;
        const filter = { userId };
        if (type) {
            filter.type = type;
        }
        if (tags && tags.length > 0) {
            filter.tags = { $in: tags };
        }
        if (minImportance !== undefined) {
            filter.importance = { $gte: minImportance };
        }
        let memories = await UserMemory_1.Memory.find(filter)
            .sort({ importance: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit);
        // Simple text search if query is provided
        if (query) {
            const queryLower = query.toLowerCase();
            memories = memories.filter((m) => m.content.toLowerCase().includes(queryLower));
        }
        return memories;
    }
    /**
     * Update a memory entry
     */
    async updateMemory(memoryId, userId, input) {
        const memory = await UserMemory_1.Memory.findOne({ id: memoryId, userId });
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
        logger_1.logger.info(`Memory updated: ${memoryId}`);
        return memory;
    }
    /**
     * Delete a memory entry
     */
    async deleteMemory(memoryId, userId) {
        const result = await UserMemory_1.Memory.deleteOne({ id: memoryId, userId });
        if (result.deletedCount > 0) {
            logger_1.logger.info(`Memory deleted: ${memoryId}`);
            return true;
        }
        return false;
    }
    /**
     * Delete all memories for a user
     */
    async deleteAllUserMemories(userId, type) {
        const filter = { userId };
        if (type) {
            filter.type = type;
        }
        const result = await UserMemory_1.Memory.deleteMany(filter);
        logger_1.logger.info(`Deleted ${result.deletedCount} memories for user: ${userId}`);
        return result.deletedCount || 0;
    }
    /**
     * Consolidate memories - move important short-term to long-term
     */
    async consolidateMemories(userId) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Find memories that should be consolidated
        const memoriesToConsolidate = await UserMemory_1.Memory.find({
            userId,
            type: UserMemory_1.MemoryType.SHORT_TERM,
            importance: { $gte: 7 },
            createdAt: { $lt: thirtyDaysAgo },
        });
        let consolidatedCount = 0;
        for (const memory of memoriesToConsolidate) {
            memory.type = UserMemory_1.MemoryType.LONG_TERM;
            memory.expiresAt = undefined; // Long-term doesn't expire
            await memory.save();
            consolidatedCount++;
        }
        logger_1.logger.info(`Consolidated ${consolidatedCount} memories for user: ${userId}`);
        return consolidatedCount;
    }
    /**
     * Search memories by semantic similarity (simplified version)
     * In production, this would use vector embeddings
     */
    async semanticSearch(userId, query, limit = 10) {
        // Simple keyword-based search for now
        // Production would use vector embeddings with MongoDB Atlas Search or external service
        const queryWords = query.toLowerCase().split(/\s+/);
        const memories = await UserMemory_1.Memory.find({
            userId,
            type: { $in: [UserMemory_1.MemoryType.LONG_TERM, UserMemory_1.MemoryType.SEMANTIC] },
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
    async getMemoryStats(userId) {
        const memories = await UserMemory_1.Memory.find({ userId });
        const byType = {};
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
    async evictLeastImportant(userId) {
        const oldest = await UserMemory_1.Memory.findOne({
            userId,
            type: UserMemory_1.MemoryType.SHORT_TERM,
        }).sort({ importance: 1, lastAccessed: 1 });
        if (oldest) {
            await oldest.deleteOne();
            logger_1.logger.info(`Evicted memory: ${oldest.id} due to capacity limit`);
        }
    }
    /**
     * Clean up expired memories
     */
    async cleanupExpired() {
        const deletedCount = await UserMemory_1.Memory.deleteExpired();
        logger_1.logger.info(`Cleaned up ${deletedCount} expired memories`);
        return deletedCount;
    }
    /**
     * Access a memory (increment access count)
     */
    async accessMemory(memoryId, userId) {
        const memory = await UserMemory_1.Memory.findOne({ id: memoryId, userId });
        if (memory) {
            await memory.incrementAccess();
        }
        return memory;
    }
    /**
     * Batch create memories
     */
    async batchCreateMemories(memories) {
        const created = await Promise.all(memories.map((m) => this.createMemory(m)));
        logger_1.logger.info(`Batch created ${created.length} memories`);
        return created;
    }
}
exports.MemoryService = MemoryService;
// Export singleton instance
exports.memoryService = new MemoryService();
exports.default = exports.memoryService;
//# sourceMappingURL=memoryService.js.map
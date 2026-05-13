import { IMemoryDocument, MemoryType } from '../models/UserMemory';
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
export declare class MemoryService {
    /**
     * Create a new memory entry
     */
    createMemory(input: CreateMemoryInput): Promise<IMemoryDocument>;
    /**
     * Get a memory by ID
     */
    getMemory(memoryId: string, userId: string): Promise<IMemoryDocument | null>;
    /**
     * Get all memories for a user
     */
    getUserMemories(input: SearchMemoriesInput): Promise<IMemoryDocument[]>;
    /**
     * Update a memory entry
     */
    updateMemory(memoryId: string, userId: string, input: UpdateMemoryInput): Promise<IMemoryDocument | null>;
    /**
     * Delete a memory entry
     */
    deleteMemory(memoryId: string, userId: string): Promise<boolean>;
    /**
     * Delete all memories for a user
     */
    deleteAllUserMemories(userId: string, type?: MemoryType): Promise<number>;
    /**
     * Consolidate memories - move important short-term to long-term
     */
    consolidateMemories(userId: string): Promise<number>;
    /**
     * Search memories by semantic similarity (simplified version)
     * In production, this would use vector embeddings
     */
    semanticSearch(userId: string, query: string, limit?: number): Promise<IMemoryDocument[]>;
    /**
     * Get memory statistics for a user
     */
    getMemoryStats(userId: string): Promise<{
        total: number;
        byType: Record<string, number>;
        averageImportance: number;
        totalAccessCount: number;
    }>;
    /**
     * Evict the least important memory for a user
     */
    private evictLeastImportant;
    /**
     * Clean up expired memories
     */
    cleanupExpired(): Promise<number>;
    /**
     * Access a memory (increment access count)
     */
    accessMemory(memoryId: string, userId: string): Promise<IMemoryDocument | null>;
    /**
     * Batch create memories
     */
    batchCreateMemories(memories: CreateMemoryInput[]): Promise<IMemoryDocument[]>;
}
export declare const memoryService: MemoryService;
export default memoryService;
//# sourceMappingURL=memoryService.d.ts.map
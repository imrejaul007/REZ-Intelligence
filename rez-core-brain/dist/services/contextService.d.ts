import { IContextualDataDocument } from '../models/GlobalPersonalization';
export interface SharedContext {
    userId: string;
    agentId?: string;
    sessionId?: string;
    data: Record<string, unknown>;
    expiresIn?: number;
}
export interface ContextUpdate {
    location?: string;
    device?: string;
    browser?: string;
    os?: string;
    appVersion?: string;
    sessionId?: string;
}
export declare class ContextService {
    private redis;
    private contextKeyPrefix;
    private sharedKeyPrefix;
    private defaultTTL;
    constructor();
    private initRedis;
    /**
     * Get contextual data for a user
     */
    getContextualData(userId: string): Promise<IContextualDataDocument | null>;
    /**
     * Get or create contextual data for a user
     */
    getOrCreateContextualData(userId: string): Promise<IContextualDataDocument>;
    /**
     * Update contextual data for a user
     */
    updateContextualData(userId: string, update: ContextUpdate): Promise<IContextualDataDocument | null>;
    /**
     * Update recent activity
     */
    updateRecentActivity(userId: string, action: string, agent?: string, topic?: string, search?: string): Promise<void>;
    /**
     * Add an active agent for a user
     */
    addActiveAgent(userId: string, agentId: string): Promise<void>;
    /**
     * Remove an active agent for a user
     */
    removeActiveAgent(userId: string, agentId: string): Promise<void>;
    /**
     * Add a pending task for a user
     */
    addPendingTask(userId: string, taskId: string): Promise<void>;
    /**
     * Remove a pending task for a user
     */
    removePendingTask(userId: string, taskId: string): Promise<void>;
    /**
     * Store shared context (accessible by multiple agents)
     */
    setSharedContext(input: SharedContext): Promise<void>;
    /**
     * Get shared context
     */
    getSharedContext(userId: string, sessionId?: string, agentId?: string): Promise<Record<string, unknown> | null>;
    /**
     * Update shared context (merge with existing)
     */
    updateSharedContext(userId: string, updates: Record<string, unknown>, sessionId?: string, agentId?: string): Promise<Record<string, unknown> | null>;
    /**
     * Delete shared context
     */
    deleteSharedContext(userId: string, sessionId?: string, agentId?: string): Promise<void>;
    /**
     * Get all shared contexts for a user
     */
    getAllUserContexts(userId: string): Promise<Record<string, unknown>[]>;
    /**
     * Share context between agents
     */
    shareBetweenAgents(fromAgentId: string, toAgentId: string, userId: string, data: Record<string, unknown>): Promise<void>;
    /**
     * Get context transferred between agents
     */
    getAgentTransfer(fromAgentId: string, toAgentId: string, userId: string): Promise<Record<string, unknown> | null>;
    /**
     * Update temporal context (called periodically or on request)
     */
    updateTemporalContext(userId: string): Promise<void>;
    /**
     * Build shared context key
     */
    private buildSharedKey;
    /**
     * Close Redis connection
     */
    close(): Promise<void>;
}
export declare const contextService: ContextService;
export default contextService;
//# sourceMappingURL=contextService.d.ts.map
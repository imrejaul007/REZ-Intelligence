import { ISessionDocument, SessionState } from '../models/SessionContext';
export interface CreateSessionInput {
    userId: string;
    agentId?: string;
    context?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
export interface UpdateSessionInput {
    context?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
export declare class SessionService {
    private redis;
    private redisKeyPrefix;
    constructor();
    private initRedis;
    /**
     * Create a new session
     */
    createSession(input: CreateSessionInput): Promise<ISessionDocument>;
    /**
     * Get a session by ID
     */
    getSession(sessionId: string, userId?: string): Promise<ISessionDocument | null>;
    /**
     * Get or create a session for a user
     */
    getOrCreateSession(userId: string, agentId?: string): Promise<ISessionDocument>;
    /**
     * Get all sessions for a user
     */
    getUserSessions(userId: string, options?: {
        state?: SessionState;
        limit?: number;
        skip?: number;
    }): Promise<ISessionDocument[]>;
    /**
     * Update session context
     */
    updateSession(sessionId: string, userId: string, input: UpdateSessionInput): Promise<ISessionDocument | null>;
    /**
     * Add context to a session
     */
    addContext(sessionId: string, userId: string, key: string, value: unknown): Promise<ISessionDocument | null>;
    /**
     * Remove context from a session
     */
    removeContext(sessionId: string, userId: string, key: string): Promise<ISessionDocument | null>;
    /**
     * Pause a session
     */
    pauseSession(sessionId: string, userId: string): Promise<ISessionDocument | null>;
    /**
     * Resume a session
     */
    resumeSession(sessionId: string, userId: string): Promise<ISessionDocument | null>;
    /**
     * End a session
     */
    endSession(sessionId: string, userId: string): Promise<ISessionDocument | null>;
    /**
     * End all active sessions for a user
     */
    endAllUserSessions(userId: string): Promise<number>;
    /**
     * Get active session count for a user
     */
    getActiveSessionCount(userId: string): Promise<number>;
    /**
     * Cleanup stale sessions
     */
    cleanupStaleSessions(): Promise<number>;
    /**
     * Get session statistics
     */
    getSessionStats(userId: string): Promise<{
        total: number;
        active: number;
        paused: number;
        averageDuration: number;
    }>;
    private cacheSession;
    private getCachedSession;
    private invalidateCache;
    /**
     * Close Redis connection
     */
    close(): Promise<void>;
}
export declare const sessionService: SessionService;
export default sessionService;
//# sourceMappingURL=sessionService.d.ts.map
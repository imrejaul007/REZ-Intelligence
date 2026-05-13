/**
 * Core Brain Integration Service for Fitness Expert
 * Provides integration with the central Core Brain service for context, memory, and personalization
 */
export interface CoreBrainConfig {
    baseUrl: string;
    internalToken: string;
    serviceName: string;
    timeout: number;
    retryAttempts: number;
}
export interface UserContext {
    userId: string;
    sessionId: string;
    preferences?: UserPreferences;
    loyaltyProfile?: LoyaltyProfile;
    fitnessProfile?: FitnessProfile;
    recentActivity?: ActivityRecord[];
    contextData?: Record<string, unknown>;
}
export interface UserPreferences {
    tone?: 'formal' | 'casual' | 'friendly' | 'professional';
    language?: string;
    timezone?: string;
    notificationPreferences?: {
        email?: boolean;
        push?: boolean;
        sms?: boolean;
    };
    privacyLevel?: 'strict' | 'balanced' | 'open';
    accessibilityNeeds?: string[];
    preferredContentTypes?: string[];
}
export interface LoyaltyProfile {
    points: number;
    tier: string;
    benefits: string[];
    favoriteCategories?: string[];
    totalPurchases?: number;
    totalSpent?: number;
}
export interface FitnessProfile {
    fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
    goals: string[];
    preferredWorkouts: string[];
    availableEquipment: string[];
    daysPerWeek: number;
    injuries?: string[];
    timePerWorkout: number;
    workoutHistory?: WorkoutRecord[];
}
export interface WorkoutRecord {
    date: string;
    workoutType: string;
    duration: number;
    exercises: string[];
    caloriesBurned?: number;
    completed: boolean;
}
export interface ActivityRecord {
    action: string;
    agent?: string;
    topic?: string;
    timestamp: string;
}
export interface SessionContext {
    id: string;
    userId: string;
    agentId?: string;
    state: 'active' | 'paused' | 'ended';
    context: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    lastActivity: string;
}
export interface MemoryEntry {
    id: string;
    type: 'short_term' | 'long_term' | 'episodic' | 'semantic';
    content: string;
    importance?: number;
    metadata?: Record<string, unknown>;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}
export interface IntelligenceData {
    preferences?: UserPreferences;
    loyaltyProfile?: LoyaltyProfile;
    recentMemories?: MemoryEntry[];
    recentActivity?: ActivityRecord[];
    engagementScore?: number;
    contextData?: Record<string, unknown>;
}
export declare class CoreBrainClient {
    private config;
    private healthCheckCache;
    constructor(config: CoreBrainConfig);
    /**
     * Create default config from environment variables
     */
    static fromEnv(): CoreBrainClient;
    /**
     * Make authenticated request to Core Brain
     */
    private request;
    /**
     * Health check for Core Brain connection
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get or create a session
     */
    getOrCreateSession(userId: string, agentId?: string): Promise<SessionContext>;
    /**
     * Get session by ID
     */
    getSession(sessionId: string, userId: string): Promise<SessionContext | null>;
    /**
     * Update session context
     */
    updateSession(sessionId: string, context: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<SessionContext>;
    /**
     * Add context to session
     */
    addSessionContext(sessionId: string, userId: string, key: string, value: unknown): Promise<SessionContext>;
    /**
     * End a session
     */
    endSession(sessionId: string, userId: string): Promise<SessionContext>;
    /**
     * Get user memories
     */
    getMemories(userId: string, options?: {
        type?: 'short_term' | 'long_term' | 'episodic' | 'semantic';
        tags?: string[];
        limit?: number;
    }): Promise<MemoryEntry[]>;
    /**
     * Get recent memories for context
     */
    getRecentMemories(userId: string, limit?: number): Promise<MemoryEntry[]>;
    /**
     * Search memories
     */
    searchMemories(userId: string, query: string, limit?: number): Promise<MemoryEntry[]>;
    /**
     * Create a memory
     */
    createMemory(memory: {
        userId: string;
        type?: 'short_term' | 'long_term' | 'episodic' | 'semantic';
        content: string;
        importance?: number;
        metadata?: Record<string, unknown>;
        tags?: string[];
    }): Promise<MemoryEntry>;
    /**
     * Store workout completion memory
     */
    storeWorkoutCompletion(userId: string, workout: {
        type: string;
        duration: number;
        exercises: string[];
        caloriesBurned?: number;
    }, metadata?: Record<string, unknown>): Promise<MemoryEntry>;
    /**
     * Store fitness goal achievement
     */
    storeGoalAchievement(userId: string, goal: string, achievement: {
        milestone: string;
        previousValue?: number;
        newValue?: number;
    }, metadata?: Record<string, unknown>): Promise<MemoryEntry>;
    /**
     * Get user preferences
     */
    getPreferences(userId: string): Promise<UserPreferences>;
    /**
     * Update user preferences
     */
    updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
    /**
     * Get loyalty profile
     */
    getLoyaltyProfile(userId: string): Promise<LoyaltyProfile>;
    /**
     * Get contextual data
     */
    getContextualData(userId: string): Promise<Record<string, unknown>>;
    /**
     * Update contextual data
     */
    updateContextualData(userId: string, context: Record<string, unknown>): Promise<Record<string, unknown>>;
    /**
     * Record user activity
     */
    recordActivity(userId: string, activity: {
        action: string;
        agent?: string;
        topic?: string;
    }): Promise<void>;
    /**
     * Record fitness activity
     */
    recordFitnessActivity(userId: string, activity: {
        action: 'workout_view' | 'workout_complete' | 'exercise_query' | 'goal_set' | 'progress_check';
        workoutType?: string;
        topic?: string;
    }): Promise<void>;
    /**
     * Get comprehensive intelligence data
     */
    getIntelligence(userId: string, options?: {
        includeMetrics?: boolean;
        includeContext?: boolean;
        includePreferences?: boolean;
        includeRecentMemories?: boolean;
    }): Promise<IntelligenceData>;
    /**
     * Get personalized greeting
     */
    getGreeting(userId: string, defaultGreeting?: string): Promise<{
        greeting: string;
    }>;
    /**
     * Load complete user context for fitness expert
     */
    loadUserContext(userId: string, sessionId: string): Promise<{
        session: SessionContext | null;
        preferences: UserPreferences | null;
        loyalty: LoyaltyProfile | null;
        memories: MemoryEntry[];
        context: Record<string, unknown>;
        workoutHistory: MemoryEntry[];
    }>;
    /**
     * Build fitness context for workout recommendations
     */
    buildFitnessContext(context: {
        session: SessionContext | null;
        preferences: UserPreferences | null;
        loyalty: LoyaltyProfile | null;
        memories: MemoryEntry[];
        workoutHistory: MemoryEntry[];
    }): {
        userTone: string;
        recentWorkouts: WorkoutRecord[];
        fitnessAchievements: string[];
        preferredWorkoutTypes: string[];
        engagementLevel: 'low' | 'medium' | 'high';
    };
    /**
     * Attach context to response
     */
    attachContext<T extends Record<string, unknown>>(response: T, context: {
        preferences?: UserPreferences | null;
        loyalty?: LoyaltyProfile | null;
        session?: SessionContext | null;
    }): T & {
        context: {
            preferences?: UserPreferences;
            loyalty?: LoyaltyProfile;
            tone?: string;
        };
    };
}
export declare class CoreBrainError extends Error {
    statusCode: number;
    error?: unknown | undefined;
    constructor(message: string, statusCode: number, error?: unknown | undefined);
}
export declare function getCoreBrainClient(): CoreBrainClient;
export declare function initializeCoreBrainClient(config?: Partial<CoreBrainConfig>): CoreBrainClient;
export default CoreBrainClient;
//# sourceMappingURL=coreBrainIntegration.d.ts.map
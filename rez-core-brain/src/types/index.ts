// Shared TypeScript types for REZ Core Brain Service

export interface IAgentContext {
  agentId: string;
  agentType: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IInteraction {
  id: string;
  userId: string;
  agentId: string;
  agentType: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence?: number;
  timestamp: Date;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface IMemoryEntry {
  userId: string;
  type: 'short_term' | 'long_term' | 'episodic' | 'semantic';
  content: string;
  embedding?: number[];
  importance: number;
  accessCount: number;
  lastAccessed?: Date;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: string;
}

export interface ISession {
  userId: string;
  agentId?: string;
  startTime: Date;
  endTime?: Date;
  context: Record<string, unknown>;
  state: 'active' | 'paused' | 'ended';
  metadata?: Record<string, unknown>;
}

export interface IUserPreferences {
  userId: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  language: string;
  timezone: string;
  notificationPreferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacyLevel: 'strict' | 'balanced' | 'open';
  accessibilityNeeds?: string[];
  preferredContentTypes?: string[];
  metadata?: Record<string, unknown>;
}

export interface ILoyaltyProfile {
  userId: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  points: number;
  lifetimeValue: number;
  memberSince: Date;
  benefits: string[];
  preferences: {
    favoriteCategories?: string[];
    preferredBrands?: string[];
    communicationStyle?: string;
  };
  history: {
    totalPurchases: number;
    totalSpent: number;
    averageOrderValue: number;
    lastPurchaseDate?: Date;
    favoriteStore?: string;
  };
}

export interface IContextualData {
  userId: string;
  currentContext: {
    location?: string;
    device?: string;
    browser?: string;
    os?: string;
    appVersion?: string;
    sessionId?: string;
  };
  recentActivity: {
    lastAction?: string;
    lastAgent?: string;
    lastTopic?: string;
    lastSearch?: string;
  };
  temporalContext: {
    dayOfWeek?: number;
    timeOfDay?: string;
    isHoliday?: boolean;
    season?: string;
  };
  relationships: {
    activeAgents: string[];
    recentIntents: string[];
    pendingTasks: string[];
  };
}

export interface IIntelligenceMetrics {
  userId: string;
  engagement: {
    dailyActiveDays: number;
    averageSessionLength: number;
    interactionFrequency: number;
  };
  preferences: {
    consistencyScore: number;
    adaptationRate: number;
    satisfactionScore?: number;
  };
  behavior: {
    predictabilityScore: number;
    explorationVsExploitation: number;
    preferredAgents: string[];
    peakActivityHours: number[];
  };
  calculatedAt: Date;
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
  meta: {
    timestamp: Date;
    requestId: string;
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

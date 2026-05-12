/**
 * IExpert.ts - Expert Agent Interface
 *
 * Defines the contract for all REZ industry expert agents.
 * Industry-specific experts extend ExpertAgent and implement this interface.
 */

import { IIntent, IntentPriority, IntentCategory } from './IIntent';
import { IResponse, ResponseFormat, ResponseType, ResponseAction, SuggestedFollowUp } from './IResponse';
import { ConversationContext } from '../types';

/**
 * Expert agent types available in the platform
 */
export type ExpertType =
  | 'hotel'          // Hotel/OTA industry expert
  | 'travel'         // Travel industry expert
  | 'retail'         // Retail commerce expert
  | 'food'           // Food/dining expert
  | 'healthcare'     // Healthcare services expert
  | 'finance'        // Financial services expert
  | 'education'      // Educational services expert
  | 'custom';        // Custom industry expert

/**
 * Expertise level indicators
 */
export type ExpertiseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Expert tone presets
 */
export type ExpertTone = 'professional' | 'friendly' | 'formal' | 'casual' | 'empathetic';

/**
 * Configuration for expert agent initialization
 */
export interface ExpertConfig {
  /** Unique identifier for this expert instance */
  expertId: string;
  /** Display name of the expert */
  name: string;
  /** Industry type this expert specializes in */
  industry: ExpertType;
  /** Expertise level */
  expertiseLevel: ExpertiseLevel;
  /** Communication tone preset */
  tone: ExpertTone;
  /** Supported intent categories */
  supportedIntents: IntentCategory[];
  /** Supported response types */
  supportedResponseTypes: ResponseType[];
  /** Maximum context window size in tokens */
  contextWindow?: number;
  /** Custom system prompt additions */
  customSystemPrompt?: string;
  /** API configuration */
  apiConfig?: {
    provider: 'anthropic' | 'openai';
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  /** Rate limiting configuration */
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Session state for an expert conversation
 */
export interface ExpertSession {
  sessionId: string;
  expertId: string;
  userId: string;
  context: ConversationContext;
  intents: IIntent[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Expert capabilities
 */
export interface ExpertCapabilities {
  /** Industries this expert can handle */
  industries: ExpertType[];
  /** Intent categories supported */
  intents: IntentCategory[];
  /** Response types available */
  responseTypes: ResponseType[];
  /** Languages supported */
  languages: string[];
  /** Custom features */
  features: string[];
}

/**
 * Main interface for expert agent implementations
 */
export interface IExpert {
  /** Unique identifier */
  readonly expertId: string;
  /** Display name */
  readonly name: string;
  /** Industry type */
  readonly industry: ExpertType;
  /** Current expertise level */
  readonly expertiseLevel: ExpertiseLevel;

  /**
   * Process a user message and return a response
   * @param message - The user's input message
   * @param context - Current conversation context
   * @returns Generated response with metadata
   */
  processMessage(
    message: string,
    context: ConversationContext
  ): Promise<IResponse>;

  /**
   * Classify user intent from message
   * @param message - The user's input message
   * @param context - Current conversation context
   * @returns Classified intent with priority
   */
  classifyIntent(
    message: string,
    context: ConversationContext
  ): Promise<IIntent>;

  /**
   * Generate a response for a specific intent
   * @param intent - The classified intent
   * @param context - Current conversation context
   * @returns Generated response
   */
  respondToIntent(
    intent: IIntent,
    context: ConversationContext
  ): Promise<IResponse>;

  /**
   * Handle a structured workflow for the expert's industry
   * @param workflowId - Identifier for the workflow
   * @param params - Workflow parameters
   * @param context - Current conversation context
   * @returns Workflow result
   */
  executeWorkflow(
    workflowId: string,
    params: Record<string, unknown>,
    context: ConversationContext
  ): Promise<IResponse>;

  /**
   * Get recommended follow-up actions based on context
   * @param context - Current conversation context
   * @returns Array of recommended actions
   */
  getRecommendations(context: ConversationContext): Promise<SuggestedFollowUp[]>;

  /**
   * Validate if a transition/action is allowed for current context
   * @param action - The action to validate
   * @param context - Current conversation context
   * @returns Whether the action is valid
   */
  validateAction(
    action: string,
    context: ConversationContext
  ): Promise<boolean>;

  /**
   * Get expert session by ID
   * @param sessionId - Session identifier
   * @returns Session data or null
   */
  getSession(sessionId: string): Promise<ExpertSession | null>;

  /**
   * Create a new expert session
   * @param userId - User identifier
   * @param metadata - Optional session metadata
   * @returns New session data
   */
  createSession(
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<ExpertSession>;

  /**
   * Update session context
   * @param sessionId - Session identifier
   * @param updates - Context updates to apply
   */
  updateSession(
    sessionId: string,
    updates: Partial<ConversationContext>
  ): Promise<void>;

  /**
   * Get the expert's system prompt for LLM initialization
   * @returns Complete system prompt string
   */
  getSystemPrompt(): string;

  /**
   * Get health/status of the expert agent
   * @returns Health status object
   */
  getHealth(): Promise<ExpertHealthStatus>;

  /**
   * Get expert capabilities
   * @returns Expert capabilities object
   */
  getCapabilities(): ExpertCapabilities;
}

/**
 * Health status for expert agent monitoring
 */
export interface ExpertHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  expertId: string;
  uptime: number;
  activeSessions: number;
  avgResponseTime: number;
  errorRate: number;
  lastError?: string;
  checks: {
    model: boolean;
    redis: boolean;
    mongodb?: boolean;
  };
}

/**
 * Expert metrics for monitoring
 */
export interface ExpertMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  tokensUsed: number;
  sessionsCreated: number;
}

/**
 * Expert event types for logging/analytics
 */
export type ExpertEventType =
  | 'session_created'
  | 'session_ended'
  | 'message_received'
  | 'intent_classified'
  | 'response_generated'
  | 'workflow_executed'
  | 'error_occurred'
  | 'recommendation_generated';

/**
 * Expert event payload
 */
export interface ExpertEvent {
  type: ExpertEventType;
  expertId: string;
  sessionId?: string;
  userId?: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  metadata?: {
    intent?: string;
    priority?: IntentPriority;
    latencyMs?: number;
    error?: string;
  };
}

/**
 * Factory interface for creating expert instances
 */
export interface IExpertFactory {
  /**
   * Create an expert instance from configuration
   */
  createExpert(config: ExpertConfig): IExpert;

  /**
   * Register an expert type
   */
  registerExpert(type: ExpertType, factory: (config: ExpertConfig) => IExpert): void;

  /**
   * Get all registered expert types
   */
  getRegisteredTypes(): ExpertType[];
}

/**
 * Registry interface for managing expert instances
 */
export interface IExpertRegistry {
  /**
   * Register an expert instance
   */
  register(expert: IExpert): Promise<void>;

  /**
   * Unregister an expert
   */
  unregister(expertId: string): Promise<void>;

  /**
   * Get an expert by ID
   */
  getExpert(expertId: string): IExpert | undefined;

  /**
   * Get experts by industry
   */
  getExpertsByIndustry(industry: ExpertType): IExpert[];

  /**
   * Find the best expert for a given intent
   */
  findBestExpert(intent: IIntent): IExpert | undefined;

  /**
   * Get all registered experts
   */
  getAllExperts(): IExpert[];

  /**
   * Get experts by capabilities
   */
  getExpertsByCapabilities(requiredCapabilities: Partial<ExpertCapabilities>): IExpert[];
}

export {
  IIntent,
  IntentPriority,
  IntentCategory,
  IResponse,
  ResponseFormat,
  ResponseType,
  ResponseAction,
  SuggestedFollowUp,
  ConversationContext,
};

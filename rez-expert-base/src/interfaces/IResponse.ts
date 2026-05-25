/**
 * IResponse.ts - Response Interface
 *
 * Defines the structure for expert agent responses
 * within the REZ Expert system.
 */

/**
 * Response format types
 */
export enum ResponseFormat {
  /** Plain text response */
  TEXT = 'text',
  /** Structured JSON response */
  JSON = 'json',
  /** Markdown formatted response */
  MARKDOWN = 'markdown',
  /** HTML formatted response */
  HTML = 'html',
  /** Action card with buttons */
  ACTION_CARD = 'action_card',
  /** Multi-part response */
  MULTI_PART = 'multi_part',
}

/**
 * Response type classification
 */
export enum ResponseType {
  /** Informational response */
  TEXT = 'text',
  /** Structured data response */
  STRUCTURED = 'structured',
  /** Response with actions */
  ACTION = 'action',
  /** Escalation to human/other expert */
  ESCALATION = 'escalation',
  /** Error response */
  ERROR = 'error',
}

/**
 * Response status types
 */
export enum ResponseStatus {
  /** Response generated successfully */
  SUCCESS = 'success',
  /** Response partially successful */
  PARTIAL = 'partial',
  /** Response generation failed */
  FAILED = 'failed',
  /** Response pending (async generation) */
  PENDING = 'pending',
  /** Response was filtered/blocked */
  FILTERED = 'filtered',
}

/**
 * Response confidence levels
 */
export enum ResponseConfidence {
  HIGH = 'high',       // >0.9 confidence
  MEDIUM = 'medium',   // 0.7-0.9 confidence
  LOW = 'low',         // 0.5-0.7 confidence
  UNCERTAIN = 'uncertain', // <0.5 confidence
}

/**
 * Response action types
 */
export interface ResponseAction {
  /** Action type identifier */
  type: 'button' | 'link' | 'form' | 'callback' | 'quick_reply';
  /** Display label */
  label: string;
  /** Action payload/value */
  value: string;
  /** Whether action is primary */
  primary?: boolean;
  /** Icon for the action */
  icon?: string;
  /** Action metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response suggestion types
 */
export interface SuggestedFollowUp {
  /** Suggestion text */
  text: string;
  /** Associated intent category */
  intent?: string;
  /** Suggestion priority */
  priority?: 'high' | 'normal' | 'low';
  /** Confidence in suggestion */
  confidence?: number;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Tokens used for generation */
  tokensUsed?: number;
  /** Model used for generation */
  model?: string;
  /** Generation latency in milliseconds */
  latencyMs?: number;
  /** Conversation turns in response */
  turns?: number;
  /** Whether response was cached */
  cached?: boolean;
  /** Content safety flags */
  safetyFlags?: string[];
  /** Processing details */
  processingDetails?: {
    intentClassificationMs?: number;
    knowledgeRetrievalMs?: number;
    responseGenerationMs?: number;
  };
}

/**
 * Response error information
 */
export interface ResponseError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Error category */
  category?: 'validation' | 'processing' | 'external' | 'internal';
}

/**
 * Response context
 */
export interface ResponseContext {
  /** Expert ID that generated this response */
  expertId: string;
  /** Expert name */
  expertName: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Model used for generation */
  modelUsed?: string;
  /** Whether this was a cache hit */
  cacheHit?: boolean;
}

/**
 * Core response interface
 */
export interface IResponse {
  /** Unique identifier for this response */
  readonly responseId: string;
  /** Associated intent ID */
  readonly intentId: string;
  /** Session identifier */
  readonly sessionId: string;
  /** Response content */
  readonly content: string;
  /** Response format */
  readonly format: ResponseFormat;
  /** Response type */
  readonly type: ResponseType;
  /** Response status */
  readonly status: ResponseStatus;
  /** Response confidence */
  readonly confidence: ResponseConfidence;
  /** Response context */
  readonly context: ResponseContext;
  /** Associated actions */
  readonly actions: ResponseAction[];
  /** Follow-up suggestions */
  readonly suggestedFollowUps: SuggestedFollowUp[];
  /** Response metadata */
  readonly metadata: ResponseMetadata;
  /** Generated timestamp */
  readonly generatedAt: Date;
  /** Error information (if type is 'error') */
  readonly error?: ResponseError;

  /**
   * Add an action to the response
   */
  addAction(action: ResponseAction): void;

  /**
   * Add a follow-up suggestion
   */
  addFollowUp(suggestion: SuggestedFollowUp): void;

  /**
   * Set metadata
   */
  setMetadata(key: string, value: unknown): void;

  /**
   * Get metadata value
   */
  getMetadata<T = unknown>(key: string): T | undefined;

  /**
   * Convert to JSON-serializable format
   */
  toJSON(): Record<string, unknown>;

  /**
   * Check if response is an error
   */
  isError(): boolean;

  /**
   * Check if response requires action
   */
  requiresAction(): boolean;
}

/**
 * Builder for constructing responses
 */
export interface IResponseBuilder {
  /** Set response content */
  setContent(content: string): IResponseBuilder;
  /** Set response format */
  setFormat(format: ResponseFormat): IResponseBuilder;
  /** Set response type */
  setType(type: ResponseType): IResponseBuilder;
  /** Set response status */
  setStatus(status: ResponseStatus): IResponseBuilder;
  /** Set confidence */
  setConfidence(confidence: ResponseConfidence): IResponseBuilder;
  /** Set context */
  setContext(context: ResponseContext): IResponseBuilder;
  /** Set intent ID */
  setIntentId(intentId: string): IResponseBuilder;
  /** Set session ID */
  setSessionId(sessionId: string): IResponseBuilder;
  /** Add an action */
  addAction(action: ResponseAction): IResponseBuilder;
  /** Add multiple actions */
  addActions(actions: ResponseAction[]): IResponseBuilder;
  /** Add a suggestion */
  addSuggestion(suggestion: SuggestedFollowUp): IResponseBuilder;
  /** Add multiple suggestions */
  addSuggestions(suggestions: SuggestedFollowUp[]): IResponseBuilder;
  /** Set metadata */
  setMetadata(metadata: Partial<ResponseMetadata>): IResponseBuilder;
  /** Set error message */
  setError(error: ResponseError): IResponseBuilder;
  /** Build the final response */
  build(): IResponse;
}

/**
 * Multi-part response component
 */
export interface ResponsePart {
  /** Part type */
  type: 'text' | 'image' | 'card' | 'list' | 'table' | 'divider';
  /** Part content */
  content: string | Record<string, unknown>;
  /** Part order index */
  order: number;
  /** Part title if applicable */
  title?: string;
  /** Part metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extended response for multi-part responses
 */
export interface MultiPartResponse extends IResponse {
  /** Response parts */
  parts: ResponsePart[];
}

/**
 * Response generation options
 */
export interface ResponseGenerationOptions {
  /** Tone for the response */
  tone?: 'professional' | 'friendly' | 'formal' | 'casual' | 'empathetic';
  /** Maximum length in characters */
  maxLength?: number;
  /** Include suggestions */
  includeSuggestions?: boolean;
  /** Include actions */
  includeActions?: boolean;
  /** Language for response */
  language?: string;
  /** Custom system instructions */
  systemInstructions?: string;
  /** Response format preference */
  preferredFormat?: ResponseFormat;
}

/**
 * Response validation result
 */
export interface ResponseValidation {
  /** Whether the response is valid */
  valid: boolean;
  /** Validation errors */
  errors?: string[];
  /** Warnings */
  warnings?: string[];
  /** Content appropriateness issues */
  appropriatenessIssues?: string[];
}

/**
 * Response context for generation
 */
export interface ResponseContext {
  /** Conversation history */
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  /** Current intent */
  intent: {
    category: string;
    parameters: Record<string, unknown>;
  };
  /** User profile */
  userProfile?: {
    language?: string;
    preferences?: Record<string, unknown>;
  };
  /** Expert configuration */
  expertConfig: {
    name: string;
    tone: string;
    industry: string;
  };
}

/**
 * Response analytics event
 */
export interface ResponseAnalytics {
  /** Response ID */
  responseId: string;
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Intent ID */
  intentId: string;
  /** Generated at */
  generatedAt: Date;
  /** User feedback if unknown */
  feedback?: {
    rating?: number;
    helpful?: boolean;
    actionTaken?: string;
  };
  /** Engagement metrics */
  metrics?: {
    readTimeMs?: number;
    actionClicked?: string;
    followUpRequested?: boolean;
  };
}

/**
 * Cached response for similar queries
 */
export interface CachedResponse {
  /** Cache key */
  key: string;
  /** Response content */
  response: IResponse;
  /** When response was cached */
  cachedAt: Date;
  /** When cache expires */
  expiresAt: Date;
  /** Cache hit count */
  hitCount: number;
  /** Similarity score */
  similarity: number;
}

/**
 * Response formatter interface
 */
export interface IResponseFormatter {
  /**
   * Format response for specific output channel
   */
  format(response: IResponse, format: ResponseFormat): string | Record<string, unknown>;

  /**
   * Format for voice output
   */
  formatForVoice(response: IResponse): {
    speech: string;
    hints?: string[];
  };

  /**
   * Format for API response
   */
  formatForAPI(response: IResponse): Record<string, unknown>;

  /**
   * Format for chat UI
   */
  formatForChat(response: IResponse): {
    message: string;
    components?: unknown[];
  };
}

/**
 * Response cache interface
 */
export interface IResponseCache {
  /**
   * Get cached response
   */
  get(intentId: string): Promise<IResponse | null>;

  /**
   * Cache a response
   */
  set(intentId: string, response: IResponse, ttlSeconds?: number): Promise<void>;

  /**
   * Invalidate cache entry
   */
  invalidate(intentId: string): Promise<void>;

  /**
   * Clear all cache
   */
  clear(): Promise<void>;
}

/**
 * Static factory methods for response creation
 */
export interface IResponseFactory {
  /**
   * Create a success response
   */
  createSuccess(
    intentId: string,
    sessionId: string,
    content: string,
    context: ResponseContext
  ): IResponse;

  /**
   * Create an error response
   */
  createError(
    intentId: string,
    sessionId: string,
    error: ResponseError,
    context: ResponseContext
  ): IResponse;

  /**
   * Create an escalation response
   */
  createEscalation(
    intentId: string,
    sessionId: string,
    reason: string,
    context: ResponseContext,
    escalatedTo?: string
  ): IResponse;

  /**
   * Create an action response
   */
  createActionResponse(
    intentId: string,
    sessionId: string,
    content: string,
    actions: ResponseAction[],
    context: ResponseContext
  ): IResponse;
}

export {
  ResponseAction,
  SuggestedFollowUp,
  ResponseMetadata,
  ResponseError,
  ResponseContext,
  ResponseValidation,
  ResponsePart,
  MultiPartResponse,
  ResponseGenerationOptions,
  ResponseAnalytics,
  CachedResponse,
  IResponseFormatter,
  IResponseCache,
  IResponseFactory,
};

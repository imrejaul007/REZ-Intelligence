/**
 * IIntent.ts - Intent Interface
 *
 * Defines the structure for user intent classification
 * within the REZ Expert system.
 */

/**
 * Intent priority levels for response timing
 */
export enum IntentPriority {
  CRITICAL = 'critical',   // Immediate response required (payment issues, errors)
  HIGH = 'high',           // Quick response expected
  NORMAL = 'normal',       // Standard response time
  LOW = 'low',            // Can be batched/delayed
}

/**
 * Confidence levels for intent classification
 */
export enum IntentConfidence {
  HIGH = 'high',           // >0.9 confidence
  MEDIUM = 'medium',      // 0.7-0.9 confidence
  LOW = 'low',            // 0.5-0.7 confidence
  UNCERTAIN = 'uncertain' // <0.5 confidence, needs clarification
}

/**
 * Intent categories within the REZ platform
 */
export enum IntentCategory {
  // Commerce intents
  PRODUCT_INQUIRY = 'product_inquiry',
  PURCHASE_INTENT = 'purchase_intent',
  BOOKING_REQUEST = 'booking_request',
  BOOKING_MODIFICATION = 'booking_modification',
  BOOKING_CANCELLATION = 'booking_cancellation',
  REFUND_REQUEST = 'refund_request',

  // Support intents
  COMPLAINT = 'complaint',
  SUPPORT_REQUEST = 'support_request',
  TRACKING_REQUEST = 'tracking_request',
  RETURN_REQUEST = 'return_request',

  // Information intents
  INFORMATION_REQUEST = 'information_request',
  COMPARISON_REQUEST = 'comparison_request',
  RECOMMENDATION_REQUEST = 'recommendation_request',

  // Account intents
  ACCOUNT_INQUIRY = 'account_inquiry',
  PROFILE_UPDATE = 'profile_update',
  PASSWORD_RESET = 'password_reset',

  // Payment intents
  PAYMENT_ISSUE = 'payment_issue',
  PAYMENT_METHOD_UPDATE = 'payment_method_update',

  // Feedback intents
  FEEDBACK = 'feedback',
  REVIEW_REQUEST = 'review_request',

  // General intents
  GREETING = 'greeting',
  FAREWELL = 'farewell',
  GENERAL_QUESTION = 'general_question',
  SMALL_TALK = 'small_talk',

  // Ambiguous/unclear
  UNCLEAR = 'unclear',
  ESCALATION = 'escalation',
}

/**
 * Intent status during processing
 */
export enum IntentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ESCALATED = 'escalated',
}

/**
 * Intent source channels
 */
export enum IntentSource {
  CHAT = 'chat',
  API = 'api',
  WEBHOOK = 'webhook',
  VOICE = 'voice',
  AUTOMATION = 'automation',
}

/**
 * Structured parameters extracted from user message
 */
export interface IntentParameters {
  /** Product/service identifiers mentioned */
  productIds?: string[];
  /** Order/booking identifiers */
  orderIds?: string[];
  /** User identifiers */
  userIds?: string[];
  /** Date/time references */
  dates?: string[];
  /** Location references */
  locations?: string[];
  /** Numeric values (quantities, prices) */
  numbers?: Record<string, number>;
  /** Text parameters */
  strings?: Record<string, string>;
  /** Boolean flags */
  flags?: Record<string, boolean>;
  /** Raw extracted entities */
  entities?: Record<string, unknown>;
}

/**
 * Extracted entity from user input
 */
export interface IntentEntity {
  /** Entity type (e.g., 'date', 'location', 'product') */
  type: string;
  /** Entity value */
  value: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Start position in original text */
  startIndex: number;
  /** End position in original text */
  endIndex: number;
  /** Normalized value if applicable */
  normalizedValue?: string;
}

/**
 * Intent classification result
 */
export interface IntentClassification {
  /** Primary domain */
  domain: string;
  /** Subdomain if applicable */
  subdomain?: string;
  /** Action to perform */
  action: string;
  /** Extracted entities */
  entities: IntentEntity[];
  /** Classification confidence score (0-1) */
  confidence: number;
  /** Reasoning for classification */
  reasoning?: string;
}

/**
 * Core intent interface
 */
export interface IIntent {
  /** Unique identifier for this intent */
  readonly intentId: string;
  /** Session identifier this intent belongs to */
  readonly sessionId: string;
  /** Intent category */
  readonly category: IntentCategory;
  /** Structured classification */
  readonly classification: IntentClassification;
  /** Human-readable intent description */
  readonly description: string;
  /** Classification confidence score (0-1) */
  readonly confidence: number;
  /** Confidence level enum */
  readonly confidenceLevel: IntentConfidence;
  /** Processing priority */
  readonly priority: IntentPriority;
  /** Extracted parameters from user message */
  readonly parameters: IntentParameters;
  /** Original user message */
  readonly originalMessage: string;
  /** Detected language (ISO 639-1) */
  readonly language: string;
  /** Source channel */
  readonly source: IntentSource;
  /** Whether this intent requires confirmation before action */
  readonly requiresConfirmation: boolean;
  /** Related intents from conversation history */
  readonly relatedIntents?: string[];
  /** Timestamp of classification */
  readonly classifiedAt: Date;
  /** Status of intent processing */
  status: IntentStatus;
  /** Metadata from classification model */
  readonly metadata?: Record<string, unknown>;

  /**
   * Add context to the intent
   */
  addContext(key: string, value: unknown): void;

  /**
   * Get context value
   */
  getContext<T = unknown>(key: string): T | undefined;

  /**
   * Update status
   */
  updateStatus(status: IntentStatus): void;

  /**
   * Check if intent is expired
   */
  isExpired(ttlSeconds: number): boolean;
}

/**
 * Intent classification request
 */
export interface IntentClassificationRequest {
  /** User's message */
  message: string;
  /** Current session ID */
  sessionId: string;
  /** Conversation history for context */
  history?: IntentHistoryItem[];
  /** User profile for personalization */
  userProfile?: UserProfile;
  /** Custom parameters for classification */
  context?: Record<string, unknown>;
}

/**
 * Single item in conversation history
 */
export interface IntentHistoryItem {
  /** Role in conversation */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Associated intent ID if unknown */
  intentId?: string;
}

/**
 * User profile for intent classification
 */
export interface UserProfile {
  /** User ID */
  userId: string;
  /** User's preferred language */
  language?: string;
  /** User's industry interests */
  industries?: string[];
  /** Past interaction patterns */
  interactionPatterns?: string[];
  /** Known preferences */
  preferences?: Record<string, unknown>;
}

/**
 * Intent classification response
 */
export interface IntentClassificationResponse {
  /** Primary classified intent */
  primary: IIntent;
  /** Alternative intents with lower confidence */
  alternatives?: Array<{
    intent: IIntent;
    confidence: number;
    reasoning: string;
  }>;
  /** Whether clarification was requested */
  clarificationRequested?: boolean;
  /** Clarification question if needed */
  clarificationQuestion?: string;
  /** Classification metadata */
  metadata?: {
    model: string;
    latencyMs: number;
    tokensUsed?: number;
  };
}

/**
 * Intent validation result
 */
export interface IntentValidation {
  /** Whether the intent is valid */
  valid: boolean;
  /** Validation errors */
  errors?: string[];
  /** Warnings about the intent */
  warnings?: string[];
  /** Required parameters that are missing */
  missingParameters?: string[];
}

/**
 * Intent transition for state machines
 */
export interface IntentTransition {
  /** From state */
  from: IntentCategory;
  /** To state */
  to: IntentCategory;
  /** Transition is allowed */
  allowed: boolean;
  /** Conditions for transition */
  conditions?: string[];
  /** Required context for transition */
  requiredContext?: string[];
}

/**
 * Intent parser interface
 */
export interface IIntentParser {
  /**
   * Parse raw input into structured intent
   */
  parse(input: string, context?: Partial<IntentContext>): Promise<IIntent>;

  /**
   * Extract entities from input
   */
  extractEntities(input: string, domain?: string): Promise<IntentEntity[]>;

  /**
   * Classify intent domain and action
   */
  classify(input: string, context?: Partial<IntentContext>): Promise<IntentClassification>;
}

/**
 * Intent validator interface
 */
export interface IIntentValidator {
  /**
   * Validate intent structure
   */
  validate(intent: Partial<IIntent>): IntentValidation;

  /**
   * Check if intent meets requirements
   */
  meetsRequirements(intent: IIntent, requirements: IntentRequirements): boolean;
}

/**
 * Requirements for intent validation
 */
export interface IntentRequirements {
  /** Minimum confidence score */
  minConfidence?: number;
  /** Allowed source channels */
  allowedSources?: IntentSource[];
  /** Allowed priorities */
  allowedPriorities?: IntentPriority[];
  /** Maximum age in seconds */
  maxAgeSeconds?: number;
  /** Required tags */
  requiredTags?: string[];
}

/**
 * Intent context for parsing
 */
export interface IntentContext {
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  history?: IntentHistoryItem[];
}

/**
 * Create intent options
 */
export interface CreateIntentOptions {
  /** Override default priority */
  priority?: IntentPriority;
  /** Override default confidence */
  confidence?: number;
  /** Additional parameters to merge */
  parameters?: Partial<IntentParameters>;
  /** Skip validation */
  skipValidation?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

export {
  IntentContext,
  IntentHistoryItem,
  IntentEntity,
  IntentClassification,
  IntentValidation,
  IntentRequirements,
};

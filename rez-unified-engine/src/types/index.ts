/**
 * Shared Types for REZ Unified Engine
 */

// Channel types
export type ChannelType = 'whatsapp' | 'voice' | 'copilot' | 'web';

// Message roles
export enum MessageRole {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system',
  BOT = 'bot',
}

// Message status
export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

// Intent confidence levels
export enum IntentConfidence {
  HIGH = 'high',      // > 0.8
  MEDIUM = 'medium',  // 0.5 - 0.8
  LOW = 'low',        // < 0.5
}

// Intent data structure
export interface IntentData {
  intentId: string;
  name: string;
  confidence: number;
  entities: Record<string, unknown>;
  provider: 'intent-graph' | 'agent-os' | 'llm' | 'rule-based';
  context?: Record<string, unknown>;
}

// Agent information
export interface AgentInfo {
  agentId: string;
  name: string;
  type: 'bot' | 'human' | 'ai-assist';
  teamId?: string;
  skills?: string[];
}

// User profile from CDP
export interface UserProfile {
  userId: string;
  email?: string;
  phone?: string;
  name?: string;
  avatar?: string;
  attributes: Record<string, unknown>;
  segments: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Context for conversation processing
export interface ConversationContext {
  user: UserProfile | null;
  conversation: {
    conversationId: string;
    sessionId: string;
    channel: ChannelType;
    currentIntent: IntentData | null;
    recentIntents: IntentData[];
    variables: Record<string, unknown>;
  };
  session: {
    messageCount: number;
    averageResponseTimeMs: number;
    lastIntent: IntentData | null;
    lastAgent: AgentInfo | null;
  };
  history: {
    messages: MessageSummary[];
    intents: IntentSummary[];
  };
}

// Message summary for context
export interface MessageSummary {
  messageId: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

// Intent summary for context
export interface IntentSummary {
  intentId: string;
  name: string;
  confidence: number;
  timestamp: Date;
}

// Incoming message payload
export interface IncomingMessage {
  sessionId?: string;
  conversationId?: string;
  message: string;
  userId?: string;
  channel: ChannelType;
  channelMessageId?: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[];
  timestamp?: Date;
}

// Outgoing message payload
export interface OutgoingMessage {
  messageId: string;
  conversationId: string;
  sessionId: string;
  channel: ChannelType;
  content: {
    text?: string;
    html?: string;
    markdown?: string;
    attachments?: Attachment[];
    quickReplies?: QuickReply[];
    interactive?: InteractivePayload;
  };
  sender: {
    role: MessageRole;
    agent?: AgentInfo;
  };
  metadata?: Record<string, unknown>;
}

// Attachment
export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  filename?: string;
  caption?: string;
}

// Quick reply button
export interface QuickReply {
  id: string;
  text: string;
  payload?: string;
}

// Interactive message payload
export interface InteractivePayload {
  type: 'button' | 'list' | 'product';
  header?: {
    type: 'text' | 'image' | 'video';
    text?: string;
    url?: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    buttons?: Array<{
      id: string;
      title: string;
      type: 'reply' | 'url';
      url?: string;
    }>;
    sections?: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
}

// Webhook payload
export interface WebhookPayload {
  channel: ChannelType;
  event: string;
  data: Record<string, unknown>;
  signature?: string;
  timestamp: Date;
}

// Routing decision
export interface RoutingDecision {
  agentId?: string;
  agentType: 'bot' | 'human' | 'ai-assist';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  skills?: string[];
  reason: string;
  queue?: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    durationMs?: number;
  };
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Session data for caching
export interface CachedSession {
  sessionId: string;
  conversationId: string;
  userId: string;
  channel: ChannelType;
  status: string;
  context: Record<string, unknown>;
  metrics: {
    messageCount: number;
    averageResponseTimeMs: number;
  };
  expiresAt: string;
  lastActivityAt: string;
}

// Channel adapter interface
export interface ChannelAdapter {
  readonly channel: ChannelType;

  processMessage(payload: IncomingMessage): Promise<OutgoingMessage>;
  sendMessage(message: OutgoingMessage): Promise<string>;
  handleWebhook(req: unknown, res: unknown): Promise<void>;
  formatForChannel(message: OutgoingMessage): unknown;
}

// Service interfaces
export interface IIntentProcessor {
  detectIntent(
    message: string,
    context: ConversationContext
  ): Promise<IntentData>;
}

export interface IAgentRouter {
  route(
    intent: IntentData,
    context: ConversationContext
  ): Promise<RoutingDecision>;
}

export interface IResponseGenerator {
  generate(
    message: IncomingMessage,
    context: ConversationContext,
    intent: IntentData,
    routing: RoutingDecision
  ): Promise<OutgoingMessage>;
}

export interface IContextManager {
  loadContext(sessionId: string): Promise<ConversationContext>;
  updateContext(
    sessionId: string,
    updates: Partial<ConversationContext>
  ): Promise<void>;
  clearContext(sessionId: string): Promise<void>;
}

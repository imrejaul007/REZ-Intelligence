import { z } from 'zod';

// Conversation Schemas
export const MessageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().min(1),
  senderType: z.enum(['user', 'agent', 'bot', 'system']),
  content: z.string().min(1).max(10000),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const ConversationCreateSchema = z.object({
  sessionId: z.string().min(1),
  channel: z.enum(['web', 'mobile', 'api', 'phone', 'email', 'chat']),
  participants: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['user', 'agent', 'bot']),
    role: z.string().optional(),
  })).min(1),
  messages: z.array(MessageSchema).optional(),
  context: z.object({
    userId: z.string().optional(),
    appId: z.string().optional(),
    sessionType: z.enum(['support', 'sales', 'onboarding', 'general']).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ConversationUpdateSchema = z.object({
  status: z.enum(['active', 'closed', 'archived']).optional(),
  outcome: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Message Schemas
export const MessageCreateSchema = z.object({
  senderId: z.string().min(1),
  senderType: z.enum(['user', 'agent', 'bot', 'system']),
  content: z.string().min(1).max(10000),
  metadata: z.record(z.unknown()).optional(),
});

// Feedback Schemas
export const FeedbackCreateSchema = z.object({
  conversationId: z.string().uuid(),
  type: z.enum(['rating', 'correction', 'suggestion', 'escalation']),
  rating: z.number().int().min(1).max(5).optional(),
  corrections: z.array(z.object({
    messageId: z.string().uuid().optional(),
    originalIntent: z.string(),
    correctedIntent: z.string(),
    explanation: z.string().optional(),
  })).optional(),
  suggestions: z.array(z.string()).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  feedback: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Intent Schema
export const IntentSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
  })).optional(),
});

// Export Request Schema
export const ExportRequestSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  filters: z.object({
    channels: z.array(z.enum(['web', 'mobile', 'api', 'phone', 'email', 'chat'])).optional(),
    intents: z.array(z.string()).optional(),
    sentiment: z.array(z.enum(['positive', 'neutral', 'negative'])).optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    hasOutcome: z.boolean().optional(),
  }).optional(),
  format: z.enum(['json', 'jsonl', 'csv']).default('jsonl'),
  includeMetadata: z.boolean().default(true),
});

// Analytics Query Schema
export const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  interval: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  groupBy: z.enum(['intent', 'channel', 'sentiment', 'outcome']).optional(),
  filters: z.object({
    channels: z.array(z.enum(['web', 'mobile', 'api', 'phone', 'email', 'chat'])).optional(),
    appId: z.string().optional(),
  }).optional(),
});

export type Message = z.infer<typeof MessageSchema>;
export type ConversationCreate = z.infer<typeof ConversationCreateSchema>;
export type ConversationUpdate = z.infer<typeof ConversationUpdateSchema>;
export type MessageCreate = z.infer<typeof MessageCreateSchema>;
export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

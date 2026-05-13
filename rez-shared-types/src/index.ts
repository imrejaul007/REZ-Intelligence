// Shared types for REZ Intelligence Platform

export interface AgentMessage {
  id: string;
  agentId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  sessionId: string;
  userId?: string;
  industry?: string;
  preferences?: Record<string, unknown>;
  history?: AgentMessage[];
}

export interface AgentRequest {
  message: string;
  context: AgentContext;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AgentResponse {
  message: string;
  agentId: string;
  confidence?: number;
  suggestions?: string[];
  metadata?: Record<string, unknown>;
}

export interface ExpertConfig {
  name: string;
  industry: string;
  model?: string;
  systemPrompt?: string;
  capabilities?: string[];
  enabled?: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUsage?: number;
  lastHeartbeat?: Date;
  services?: Record<string, 'up' | 'down'>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: Date;
}

export enum Industry {
  HOSPITALITY = 'hospitality',
  CULINARY = 'culinary',
  FITNESS = 'fitness',
  HEALTH = 'health',
  TRAVEL = 'travel',
  RETAIL = 'retail',
  SALON = 'salon',
  EDUCATION = 'education'
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document'
}

export enum IntentType {
  BOOKING = 'booking',
  QUERY = 'query',
  COMPLAINT = 'complaint',
  FEEDBACK = 'feedback',
  RECOMMENDATION = 'recommendation',
  TRACKING = 'tracking'
}

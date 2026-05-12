/**
 * Core types for the REZ AI Voice Agent Service
 */

export enum VoiceAgentType {
  SALES = 'sales',
  SUPPORT = 'support',
  INFO = 'info'
}

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BUSY = 'busy',
  FAILED = 'failed',
  NO_ANSWER = 'no_answer'
}

export enum ConversationState {
  GREETING = 'greeting',
  IVR_MENU = 'ivr_menu',
  COLLECTING_INFO = 'collecting_info',
  IN_CONVERSATION = 'in_conversation',
  TRANSFER = 'transfer',
  VOICEMAIL = 'voicemail',
  COMPLETED = 'completed'
}

export enum IvrOption {
  SALES = '1',
  SUPPORT = '2',
  INFO = '3',
  OPERATOR = '0',
  REPEAT = '*'
}

export interface CallContext {
  callSid: string;
  callerNumber: string;
  calledNumber: string;
  agentType: VoiceAgentType;
  conversationState: ConversationState;
  sessionId: string;
  startTime: Date;
  ivrPath: string[];
  metadata: Record<string, unknown>;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

export interface SynthesisResult {
  audioUrl: string;
  durationMs: number;
  voiceId: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  transcription?: TranscriptionResult;
}

export interface VoiceAgentResponse {
  text: string;
  audioUrl?: string;
  action?: 'continue' | 'transfer' | 'voicemail' | 'hangup';
  transferNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface IvrMenuItem {
  key: IvrOption;
  prompt: string;
  description: string;
  agentType?: VoiceAgentType;
  action?: () => VoiceAgentResponse;
}

export interface IvrMenu {
  id: string;
  name: string;
  prompt: string;
  items: IvrMenuItem[];
  timeoutSeconds: number;
  maxRetries: number;
}

export interface CallRecord {
  id: string;
  callSid: string;
  callerNumber: string;
  calledNumber: string;
  agentType: VoiceAgentType;
  status: CallStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  conversationHistory: ConversationTurn[];
  ivrPath: string[];
  finalTranscript?: string;
  metadata: Record<string, unknown>;
}

export interface UsageMetrics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  totalDurationSeconds: number;
  totalTranscriptions: number;
  totalSyntheses: number;
  averageSentiment: number;
  byAgentType: Record<VoiceAgentType, {
    count: number;
    avgDuration: number;
  }>;
}

export interface TwilioVoiceWebhookRequest {
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: string;
  Digits?: string;
  RecordingUrl?: string;
  TranscriptionText?: string;
  SpeechResult?: string;
  Confidence?: string;
  CallDuration?: string;
}

export interface OutboundCallRequest {
  to: string;
  from?: string;
  agentType?: VoiceAgentType;
  greetingMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface OutboundCallResponse {
  callSid: string;
  status: string;
  direction: 'outbound';
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  services: {
    twilio: boolean;
    openai: boolean;
    elevenlabs: boolean;
  };
  uptime: number;
}

/**
 * Conversation Service
 * Manages multi-turn conversations with AI agents
 */

import { v4 as uuidv4 } from 'uuid';
import { Anthropic } from '@anthropic-ai/sdk';
import { getAnthropicClient, getVoiceSettings } from '../config/ai.config';
import { getTTSService } from './ttsService';
import { logger, logAIService, logMetric } from '../utils/logger';
import {
  ConversationTurn,
  ConversationState,
  VoiceAgentType,
  VoiceAgentResponse,
  CallContext
} from '../types';

export interface ConversationContext {
  id: string;
  callSid: string;
  callerNumber: string;
  agentType: VoiceAgentType;
  state: ConversationState;
  turns: ConversationTurn[];
  startTime: Date;
  lastActivity: Date;
  metadata: Record<string, unknown>;
  isActive: boolean;
}

export class ConversationService {
  private client: Anthropic;
  private conversations: Map<string, ConversationContext> = new Map();
  private callContexts: Map<string, CallContext> = new Map();
  private maxTurnsPerConversation = 50;
  private conversationTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.client = getAnthropicClient();
    this.startCleanupInterval();
  }

  /**
   * Create a new conversation
   */
  createConversation(params: {
    callSid: string;
    callerNumber: string;
    agentType: VoiceAgentType;
    initialMessage?: string;
    metadata?: Record<string, unknown>;
  }): ConversationContext {
    const id = uuidv4();

    const context: ConversationContext = {
      id,
      callSid: params.callSid,
      callerNumber: params.callerNumber,
      agentType: params.agentType,
      state: ConversationState.GREETING,
      turns: [],
      startTime: new Date(),
      lastActivity: new Date(),
      metadata: params.metadata || {},
      isActive: true
    };

    // Also create call context
    const callContext: CallContext = {
      callSid: params.callSid,
      callerNumber: params.callerNumber,
      calledNumber: '', // Will be set later
      agentType: params.agentType,
      conversationState: ConversationState.GREETING,
      sessionId: id,
      startTime: new Date(),
      ivrPath: [],
      metadata: params.metadata || {}
    };

    this.conversations.set(id, context);
    this.callContexts.set(params.callSid, callContext);

    // Add initial greeting if provided
    if (params.initialMessage) {
      this.addTurn(id, {
        role: 'assistant',
        content: params.initialMessage,
        timestamp: new Date()
      });
    }

    logger.info('Conversation created', {
      conversationId: id,
      callSid: params.callSid,
      agentType: params.agentType
    });

    return context;
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): ConversationContext | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Get conversation by call SID
   */
  getConversationByCallSid(callSid: string): ConversationContext | null {
    for (const context of this.conversations.values()) {
      if (context.callSid === callSid) {
        return context;
      }
    }
    return null;
  }

  /**
   * Get call context
   */
  getCallContext(callSid: string): CallContext | null {
    return this.callContexts.get(callSid) || null;
  }

  /**
   * Update call context
   */
  updateCallContext(callSid: string, updates: Partial<CallContext>): void {
    const context = this.callContexts.get(callSid);
    if (context) {
      Object.assign(context, updates);
    }
  }

  /**
   * Add a turn to the conversation
   */
  addTurn(conversationId: string, turn: ConversationTurn): void {
    const context = this.conversations.get(conversationId);
    if (context) {
      context.turns.push(turn);
      context.lastActivity = new Date();

      // Trim if too many turns
      if (context.turns.length > this.maxTurnsPerConversation) {
        context.turns = context.turns.slice(-this.maxTurnsPerConversation);
      }
    }
  }

  /**
   * Process user message and generate response
   */
  async processMessage(
    conversationId: string,
    userMessage: string,
    options?: {
      transcription?: {
        text: string;
        confidence: number;
      };
      sessionContext?: Record<string, unknown>;
    }
  ): Promise<VoiceAgentResponse> {
    const context = this.conversations.get(conversationId);

    if (!context) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (!context.isActive) {
      throw new Error(`Conversation ${conversationId} is no longer active`);
    }

    // Add user turn
    const userTurn: ConversationTurn = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      transcription: options?.transcription
    };
    this.addTurn(conversationId, userTurn);

    // Update state
    context.state = ConversationState.IN_CONVERSATION;
    context.lastActivity = new Date();

    try {
      // Build messages for API
      const messages = this.buildMessages(context, options?.sessionContext);

      // Get voice settings for this agent type
      const voiceSettings = getVoiceSettings(context.agentType);

      // Call AI
      const response = await this.callAI(messages, voiceSettings);

      // Add assistant turn
      const assistantTurn: ConversationTurn = {
        role: 'assistant',
        content: response.text,
        timestamp: new Date()
      };
      this.addTurn(conversationId, assistantTurn);

      // Generate audio if needed
      if (response.audioUrl) {
        assistantTurn.audioUrl = response.audioUrl;
      }

      return response;
    } catch (error) {
      logger.error('Failed to process message', {
        conversationId,
        error,
        userMessage: userMessage.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Generate AI response for greeting
   */
  async generateGreeting(conversationId: string): Promise<VoiceAgentResponse> {
    const context = this.conversations.get(conversationId);

    if (!context) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const greetings: Record<VoiceAgentType, string> = {
      [VoiceAgentType.SALES]: 'Hello! Welcome to ReZ sales. I\'m here to help you find the perfect product or service. How can I assist you today?',
      [VoiceAgentType.SUPPORT]: 'Hello! Thank you for calling ReZ support. I\'m here to help. What can I assist you with today?',
      [VoiceAgentType.INFO]: 'Hello! Welcome to ReZ information line. I can help you with business hours, locations, and general information. What would you like to know?'
    };

    const greeting = greetings[context.agentType] || greetings[VoiceAgentType.INFO];

    const response = await this.generateResponse(conversationId, greeting);

    return response;
  }

  /**
   * Generate response from provided text
   */
  async generateResponse(conversationId: string, text: string): Promise<VoiceAgentResponse> {
    try {
      // Generate audio
      const ttsService = getTTSService();
      const synthesis = await ttsService.synthesize(text);

      const response: VoiceAgentResponse = {
        text,
        audioUrl: synthesis.audioUrl,
        action: 'continue'
      };

      // Add to conversation
      const assistantTurn: ConversationTurn = {
        role: 'assistant',
        content: text,
        timestamp: new Date(),
        audioUrl: synthesis.audioUrl
      };
      this.addTurn(conversationId, assistantTurn);

      return response;
    } catch (error) {
      logger.error('Failed to generate response', { conversationId, error });
      return {
        text,
        action: 'continue'
      };
    }
  }

  /**
   * Build messages array for AI API
   */
  private buildMessages(
    context: ConversationContext,
    sessionContext?: Record<string, unknown>
  ): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    // Add system prompt based on agent type
    const voiceSettings = getVoiceSettings(context.agentType);

    // Add previous turns (limited for context window)
    const recentTurns = context.turns.slice(-20);
    for (const turn of recentTurns) {
      messages.push({
        role: turn.role as 'user' | 'assistant',
        content: turn.content
      });
    }

    // Add session context if provided
    if (sessionContext && Object.keys(sessionContext).length > 0) {
      const contextStr = `Current context: ${JSON.stringify(sessionContext)}`;
      messages.push({
        role: 'user',
        content: contextStr
      });
    }

    return messages;
  }

  /**
   * Call AI API
   */
  private async callAI(
    messages: Anthropic.MessageParam[],
    voiceSettings: ReturnType<typeof getVoiceSettings>
  ): Promise<VoiceAgentResponse> {
    const startTime = Date.now();

    try {
      logAIService('Anthropic', 'generate_response', {
        messageCount: messages.length,
        model: voiceSettings.llm.model
      });

      const response = await this.client.messages.create({
        model: voiceSettings.llm.model,
        max_tokens: voiceSettings.llm.maxTokens,
        temperature: voiceSettings.llm.temperature,
        system: voiceSettings.llm.systemPrompt,
        messages: messages as Anthropic.MessageParam[]
      });

      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      // Log metrics
      const duration = Date.now() - startTime;
      logMetric('llm_response_duration_ms', duration, {
        messageCount: messages.length,
        responseLength: responseText.length
      });

      // Generate audio
      const ttsService = getTTSService();
      let audioUrl: string | undefined;

      try {
        const synthesis = await ttsService.synthesize(responseText);
        audioUrl = synthesis.audioUrl;
      } catch (ttsError) {
        logger.warn('TTS failed, returning text-only response', { error: ttsError });
      }

      // Determine action based on response
      const action = this.determineAction(responseText);

      return {
        text: responseText,
        audioUrl,
        action
      };
    } catch (error) {
      logger.error('AI call failed', { error, messageCount: messages.length });
      throw error;
    }
  }

  /**
   * Determine action from response text
   */
  private determineAction(text: string): VoiceAgentResponse['action'] {
    const lowerText = text.toLowerCase();

    // Check for transfer keywords
    if (lowerText.includes('transferring') ||
        lowerText.includes('transfer you') ||
        lowerText.includes('connect you to')) {
      return 'transfer';
    }

    // Check for voicemail keywords
    if (lowerText.includes('leave a message') ||
        lowerText.includes('voicemail') ||
        lowerText.includes('after the tone')) {
      return 'voicemail';
    }

    // Check for hangup/bye keywords
    if (lowerText.includes('goodbye') ||
        lowerText.includes('thank you for calling') ||
        lowerText.includes('have a great day')) {
      return 'hangup';
    }

    return 'continue';
  }

  /**
   * Update conversation state
   */
  updateState(conversationId: string, state: ConversationState): void {
    const context = this.conversations.get(conversationId);
    if (context) {
      context.state = state;
      context.lastActivity = new Date();
    }
  }

  /**
   * End conversation
   */
  endConversation(conversationId: string, reason?: string): void {
    const context = this.conversations.get(conversationId);

    if (context) {
      context.isActive = false;
      context.state = ConversationState.COMPLETED;

      logger.info('Conversation ended', {
        conversationId,
        turnCount: context.turns.length,
        duration: Date.now() - context.startTime.getTime(),
        reason
      });

      // Update call context if exists
      const callContext = this.callContexts.get(context.callSid);
      if (callContext) {
        callContext.conversationState = ConversationState.COMPLETED;
      }
    }
  }

  /**
   * Get conversation history for analytics
   */
  getConversationHistory(conversationId: string): ConversationTurn[] {
    const context = this.conversations.get(conversationId);
    return context?.turns || [];
  }

  /**
   * Get conversation transcript
   */
  getTranscript(conversationId: string): string {
    const context = this.conversations.get(conversationId);
    if (!context) return '';

    return context.turns
      .map(t => `${t.role.toUpperCase()}: ${t.content}`)
      .join('\n\n');
  }

  /**
   * Start cleanup interval for inactive conversations
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [id, context] of this.conversations.entries()) {
        if (!context.isActive) {
          // Clean up ended conversations after a delay
          if (now - context.lastActivity.getTime() > 5 * 60 * 1000) {
            this.conversations.delete(id);
            cleaned++;
          }
        } else if (now - context.lastActivity.getTime() > this.conversationTimeout) {
          // End timed out conversations
          this.endConversation(id, 'timeout');
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info('Cleaned up conversations', { count: cleaned });
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Get active conversation count
   */
  getActiveCount(): number {
    let count = 0;
    for (const context of this.conversations.values()) {
      if (context.isActive) count++;
    }
    return count;
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    total: number;
    active: number;
    byAgentType: Record<VoiceAgentType, number>;
    averageTurns: number;
  } {
    let total = 0;
    let active = 0;
    let totalTurns = 0;
    const byAgentType: Record<VoiceAgentType, number> = {
      [VoiceAgentType.SALES]: 0,
      [VoiceAgentType.SUPPORT]: 0,
      [VoiceAgentType.INFO]: 0
    };

    for (const context of this.conversations.values()) {
      total++;
      totalTurns += context.turns.length;
      byAgentType[context.agentType]++;

      if (context.isActive) {
        active++;
      }
    }

    return {
      total,
      active,
      byAgentType,
      averageTurns: total > 0 ? totalTurns / total : 0
    };
  }
}

// Singleton instance
let conversationServiceInstance: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!conversationServiceInstance) {
    conversationServiceInstance = new ConversationService();
  }
  return conversationServiceInstance;
}

export default ConversationService;

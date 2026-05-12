/**
 * Intent Processor Service
 * Detects and processes user intent using REZ Intent Graph and fallback mechanisms
 */

import axios from 'axios';
import { IntentData, ConversationContext, IntentConfidence } from '../types';
import { config } from '../config';
import { logger } from '../config/logger';

const intentProcessorLogger = logger.child({ component: 'IntentProcessor' });

interface IntentGraphResponse {
  intentId: string;
  name: string;
  confidence: number;
  entities: Record<string, unknown>;
  processingTimeMs: number;
}

interface LLMFallbackResponse {
  intent: {
    name: string;
    confidence: number;
    entities: Record<string, unknown>;
  };
}

export class IntentProcessor {
  private intentGraphUrl: string;
  private timeout: number;
  private fallbackEnabled: boolean;

  constructor() {
    this.intentGraphUrl = config.services.intentGraph.url;
    this.timeout = 2000;
    this.fallbackEnabled = true;
  }

  /**
   * Detect intent from user message
   */
  async detectIntent(
    message: string,
    context: ConversationContext
  ): Promise<IntentData> {
    const startTime = Date.now();

    intentProcessorLogger.debug('Detecting intent', {
      messageLength: message.length,
      channel: context.conversation.channel,
      hasHistory: context.history.messages.length > 0,
    });

    try {
      // Build intent detection request
      const requestPayload = {
        text: message,
        channel: context.conversation.channel,
        context: {
          conversationId: context.conversation.conversationId,
          recentIntents: context.conversation.recentIntents.slice(0, 3),
          userPreferences: context.user?.attributes || {},
          sessionVariables: context.conversation.variables,
        },
        history: context.history.messages.slice(-5).map(m => ({
          role: m.role,
          content: m.content,
        })),
      };

      // Try Intent Graph first
      const intent = await this.detectWithIntentGraph(requestPayload);

      if (intent) {
        const processingTime = Date.now() - startTime;
        intentProcessorLogger.info('Intent detected via Intent Graph', {
          intentId: intent.intentId,
          name: intent.name,
          confidence: intent.confidence,
          processingTimeMs: processingTime,
        });

        return {
          ...intent,
          provider: 'intent-graph',
        };
      }

      // Fallback to LLM-based detection
      if (this.fallbackEnabled) {
        const fallbackIntent = await this.detectWithLLMFallback(message, context);

        if (fallbackIntent) {
          const processingTime = Date.now() - startTime;
          intentProcessorLogger.info('Intent detected via LLM fallback', {
            name: fallbackIntent.name,
            confidence: fallbackIntent.confidence,
            processingTimeMs: processingTime,
          });

          return {
            intentId: `intent_llm_${Date.now()}`,
            name: fallbackIntent.name,
            confidence: fallbackIntent.confidence,
            entities: fallbackIntent.entities,
            provider: 'llm',
          };
        }
      }

      // Final fallback to rule-based
      const ruleBasedIntent = this.detectWithRules(message, context);

      intentProcessorLogger.info('Intent detected via rules', {
        name: ruleBasedIntent.name,
        confidence: ruleBasedIntent.confidence,
      });

      return {
        ...ruleBasedIntent,
        provider: 'rule-based',
      };
    } catch (error) {
      intentProcessorLogger.error('Intent detection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return a fallback intent
      return {
        intentId: `intent_fallback_${Date.now()}`,
        name: 'general_inquiry',
        confidence: 0.1,
        entities: {},
        provider: 'rule-based',
      };
    }
  }

  /**
   * Detect intent using REZ Intent Graph
   */
  private async detectWithIntentGraph(
    payload: Record<string, unknown>
  ): Promise<IntentGraphResponse | null> {
    try {
      const response = await axios.post(
        `${this.intentGraphUrl}/api/intent/detect`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': config.internalServiceTokens['rez-intent-graph'] || '',
          },
        }
      );

      if (response.data?.intent) {
        return response.data.intent as IntentGraphResponse;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          intentProcessorLogger.debug('Intent not found in graph');
          return null;
        }

        intentProcessorLogger.warn('Intent Graph request failed', {
          status: error.response?.status,
          message: error.message,
        });
      }
      return null;
    }
  }

  /**
   * Detect intent using LLM fallback
   */
  private async detectWithLLMFallback(
    message: string,
    context: ConversationContext
  ): Promise<{ name: string; confidence: number; entities: Record<string, unknown> } | null> {
    try {
      // Simple keyword-based fallback
      const lowerMessage = message.toLowerCase();

      // Common intent patterns
      const intentPatterns: Array<{
        name: string;
        keywords: string[];
        confidence: number;
      }> = [
        {
          name: 'greeting',
          keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
          confidence: 0.9,
        },
        {
          name: 'goodbye',
          keywords: ['bye', 'goodbye', 'see you', 'talk later'],
          confidence: 0.9,
        },
        {
          name: 'order_status',
          keywords: ['where is my order', 'order status', 'track order', 'delivery status', 'shipped', 'delivered'],
          confidence: 0.85,
        },
        {
          name: 'cancel_order',
          keywords: ['cancel', 'cancel order', 'cancel my order', 'stop order'],
          confidence: 0.8,
        },
        {
          name: 'refund',
          keywords: ['refund', 'money back', 'return', 'return order'],
          confidence: 0.8,
        },
        {
          name: 'product_inquiry',
          keywords: ['do you have', 'available', 'in stock', 'price of', 'how much', 'cost'],
          confidence: 0.75,
        },
        {
          name: 'payment_issue',
          keywords: ['payment', 'pay', 'transaction', 'charged', 'billing'],
          confidence: 0.8,
        },
        {
          name: 'complaint',
          keywords: ['frustrated', 'angry', 'terrible', 'worst', 'problem', 'issue', 'not happy'],
          confidence: 0.7,
        },
        {
          name: 'help',
          keywords: ['help', 'assist', 'support', 'need help', 'can you help'],
          confidence: 0.8,
        },
        {
          name: 'feedback',
          keywords: ['feedback', 'suggestion', 'recommend', 'rating', 'review'],
          confidence: 0.75,
        },
      ];

      // Match against patterns
      let bestMatch: { name: string; confidence: number; entities: Record<string, unknown> } | null = null;

      for (const pattern of intentPatterns) {
        const matches = pattern.keywords.filter(keyword => lowerMessage.includes(keyword));
        if (matches.length > 0) {
          const matchConfidence = pattern.confidence * (matches.length / pattern.keywords.length);

          if (!bestMatch || matchConfidence > bestMatch.confidence) {
            bestMatch = {
              name: pattern.name,
              confidence: matchConfidence,
              entities: { matchedKeywords: matches },
            };
          }
        }
      }

      return bestMatch;
    } catch (error) {
      intentProcessorLogger.error('LLM fallback detection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Detect intent using simple rules (final fallback)
   */
  private detectWithRules(
    message: string,
    context: ConversationContext
  ): { intentId: string; name: string; confidence: number; entities: Record<string, unknown> } {
    const lowerMessage = message.toLowerCase().trim();

    // Check for empty message
    if (!lowerMessage) {
      return {
        intentId: 'intent_empty',
        name: 'empty_message',
        confidence: 1.0,
        entities: {},
      };
    }

    // Check for questions
    if (lowerMessage.includes('?')) {
      return {
        intentId: 'intent_question',
        name: 'question',
        confidence: 0.6,
        entities: { hasQuestionMark: true },
      };
    }

    // Check for long messages
    if (message.length > 200) {
      return {
        intentId: 'intent_detailed',
        name: 'detailed_message',
        confidence: 0.5,
        entities: { messageLength: message.length },
      };
    }

    // Default to general inquiry
    return {
      intentId: 'intent_general',
      name: 'general_inquiry',
      confidence: 0.3,
      entities: {},
    };
  }

  /**
   * Get intent confidence level
   */
  getConfidenceLevel(confidence: number): IntentConfidence {
    if (confidence >= 0.8) return IntentConfidence.HIGH;
    if (confidence >= 0.5) return IntentConfidence.MEDIUM;
    return IntentConfidence.LOW;
  }

  /**
   * Check if intent requires human handoff
   */
  requiresHumanHandoff(intent: IntentData): boolean {
    const highPriorityIntents = [
      'complaint',
      'refund',
      'escalation',
      'cancellation',
      'payment_issue',
    ];

    if (this.getConfidenceLevel(intent.confidence) === IntentConfidence.LOW) {
      return true;
    }

    return highPriorityIntents.includes(intent.name);
  }

  /**
   * Classify intent complexity
   */
  classifyComplexity(intent: IntentData): 'simple' | 'moderate' | 'complex' {
    const simpleIntents = [
      'greeting',
      'goodbye',
      'order_status',
      'product_inquiry',
      'help',
    ];

    const complexIntents = [
      'refund',
      'cancel_order',
      'payment_issue',
      'complaint',
      'complex_order',
    ];

    if (simpleIntents.includes(intent.name)) {
      return 'simple';
    }

    if (complexIntents.includes(intent.name)) {
      return 'complex';
    }

    return 'moderate';
  }

  /**
   * Extract entities from message based on intent
   */
  extractEntities(
    message: string,
    intentName: string
  ): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    // Extract order IDs
    const orderIdMatch = message.match(/(?:order|ord|#)\s*[A-Z0-9]{6,}/i);
    if (orderIdMatch) {
      entities.orderId = orderIdMatch[0].replace(/\s+/g, '');
    }

    // Extract phone numbers
    const phoneMatch = message.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
    if (phoneMatch) {
      entities.phone = phoneMatch[0];
    }

    // Extract email addresses
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      entities.email = emailMatch[0];
    }

    // Extract amounts
    const amountMatch = message.match(/(?:rs\.?|inr|amount|price|cost)\s*[:\-]?\s*[\d,]+(?:\.\d{2})?/i);
    if (amountMatch) {
      entities.amount = amountMatch[0];
    }

    return entities;
  }
}

// Singleton instance
let intentProcessorInstance: IntentProcessor | null = null;

export function getIntentProcessor(): IntentProcessor {
  if (!intentProcessorInstance) {
    intentProcessorInstance = new IntentProcessor();
  }
  return intentProcessorInstance;
}

export function resetIntentProcessor(): void {
  intentProcessorInstance = null;
}

export { IntentProcessor };

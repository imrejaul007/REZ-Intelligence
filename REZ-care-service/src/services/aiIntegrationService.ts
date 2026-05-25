/**
 * REZ Care Service - AI Integration
 *
 * Connects REZ-care to REZ-support-copilot for AI capabilities.
 * This is the bridge between orchestration and AI.
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

const SUPPORT_COPILOT_URL = process.env.SUPPORT_COPILOT_URL || 'http://localhost:4033';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

export interface AIAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'critical_negative';
  sentimentScore: number;
  intent?: string;
  confidence: number;
  suggestions: string[];
}

export interface UserHistory {
  userId: string;
  totalTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number;
  csatScores: number[];
  lastContact: string;
  issues: Array<{
    category: string;
    count: number;
    lastOccurrence: string;
  }>;
}

export interface TicketSuggestion {
  type: 'refund' | 'compensation' | 'escalate' | 'info' | 'action';
  action: string;
  confidence: number;
  reasoning: string;
}

class AIIntegrationService {
  private client: AxiosInstance;
  private connected: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: SUPPORT_COPILOT_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN
      }
    });
  }

  /**
   * Check if REZ-support-copilot is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 3000 });
      this.connected = response.data?.status === 'healthy';
      return this.connected;
    } catch (error) {
      logger.warn('[AI Integration] REZ-support-copilot not available');
      this.connected = false;
      return false;
    }
  }

  /**
   * Analyze message sentiment
   */
  async analyzeSentiment(message: string): Promise<AIAnalysis | null> {
    try {
      const response = await this.client.post('/analyze/sentiment', {
        message
      });

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      logger.error('[AI Integration] Sentiment analysis failed', error.message);
      return this.getFallbackSentiment(message);
    }
  }

  /**
   * Get AI suggestions for a ticket
   */
  async getTicketSuggestions(ticketId: string, customerId: string): Promise<TicketSuggestion[]> {
    try {
      const response = await this.client.get(`/ticket/${ticketId}/suggestions`, {
        params: { userId: customerId }
      });

      if (response.data?.suggestions) {
        return response.data.suggestions;
      }
      return [];
    } catch (error) {
      logger.error('[AI Integration] Ticket suggestions failed', error.message);
      return [];
    }
  }

  /**
   * Get customer support history from AI brain
   */
  async getUserHistory(userId: string): Promise<UserHistory | null> {
    try {
      const response = await this.client.get(`/user/${userId}/history`);

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      logger.error('[AI Integration] User history failed', error.message);
      return null;
    }
  }

  /**
   * Detect intent from message
   */
  async detectIntent(message: string, context?): Promise<{
    intent: string;
    entities: Record<string, unknown>;
    confidence: number;
  } | null> {
    try {
      const response = await this.client.post('/detect/intent', {
        message,
        context
      });

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      logger.error('[AI Integration] Intent detection failed', error.message);
      return null;
    }
  }

  /**
   * Search knowledge base for answers
   */
  async searchKnowledge(query: string, limit: number = 5): Promise<Array<{
    id: string;
    question: string;
    answer: string;
    confidence: number;
  }>> {
    try {
      const response = await this.client.post('/search/knowledge', {
        query,
        limit
      });

      if (response.data?.results) {
        return response.data.results;
      }
      return [];
    } catch (error) {
      logger.error('[AI Integration] Knowledge search failed', error.message);
      return [];
    }
  }

  /**
   * Get dashboard analytics from AI
   */
  async getAnalytics(days: number = 7): Promise<unknown> {
    try {
      const response = await this.client.get('/analytics', {
        params: { days }
      });

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      logger.error('[AI Integration] Analytics failed', error.message);
      return null;
    }
  }

  /**
   * Get AI-powered response for customer message
   */
  async getChatResponse(message: string, context: {
    customerId?: string;
    sessionId?: string;
    platform?: string;
    category?: string;
  }): Promise<{
    response: string;
    suggestions?: string[];
    actions?: string[];
    escalate?: boolean;
  } | null> {
    try {
      const response = await this.client.post('/chat', {
        message,
        context
      });

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      logger.error('[AI Integration] Chat response failed', error.message);
      return null;
    }
  }

  /**
   * Get unified customer view from AI
   */
  async getUnifiedCustomerView(customerId: string): Promise<unknown> {
    try {
      // Try to get from AI brain
      const history = await this.getUserHistory(customerId);
      const sentiment = history ? await this.analyzeSentiment(`Customer ID: ${customerId}`) : null;

      return {
        customerId,
        history,
        sentiment,
        aiPowered: true,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('[AI Integration] Unified view failed', error.message);
      return {
        customerId,
        aiPowered: false,
        error: 'AI service unavailable'
      };
    }
  }

  // ============================================
  // FALLBACK METHODS (When AI unavailable)
  // ============================================

  private getFallbackSentiment(message: string): AIAnalysis {
    const lower = message.toLowerCase();

    let sentiment: AIAnalysis['sentiment'] = 'neutral';
    let score = 0.5;

    // Simple keyword-based fallback
    if (lower.includes('terrible') || lower.includes('worst') || lower.includes('hate')) {
      sentiment = 'critical_negative';
      score = 0.1;
    } else if (lower.includes('angry') || lower.includes('frustrated') || lower.includes('unacceptable')) {
      sentiment = 'negative';
      score = 0.3;
    } else if (lower.includes('thank') || lower.includes('great') || lower.includes('love')) {
      sentiment = 'positive';
      score = 0.8;
    } else if (lower.includes('help') || lower.includes('issue') || lower.includes('problem')) {
      sentiment = 'negative';
      score = 0.4;
    }

    return {
      sentiment,
      sentimentScore: score,
      confidence: 0.5, // Low confidence for fallback
      suggestions: this.getFallbackSuggestions(sentiment)
    };
  }

  private getFallbackSuggestions(sentiment: AIAnalysis['sentiment']): string[] {
    switch (sentiment) {
      case 'critical_negative':
        return [
          'Escalate immediately to senior agent',
          'Offer compensation to retain customer',
          'Contact customer directly via phone'
        ];
      case 'negative':
        return [
          'Respond within 30 minutes',
          'Acknowledge the issue',
          'Offer resolution options'
        ];
      case 'positive':
        return [
          'Thank customer for feedback',
          'Ask for review if resolved',
          'Share with team for learnings'
        ];
      default:
        return [
          'Gather more information',
          'Provide helpful resources'
        ];
    }
  }
}

// Singleton instance
let aiIntegrationInstance: AIIntegrationService | null = null;

export function getAIIntegration(): AIIntegrationService {
  if (!aiIntegrationInstance) {
    aiIntegrationInstance = new AIIntegrationService();
  }
  return aiIntegrationInstance;
}

export { AIIntegrationService };

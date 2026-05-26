import axios from 'axios';
import { logger } from './utils/logger.js';

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'mock';
  apiKey?: string;
  model?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletion {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export class LLMService {
  private config: LLMConfig;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(
    messages: ChatMessage[],
    context?: {
      customerName?: string;
      businessName?: string;
      customerHistory?: string[];
      knowledgeItems?: string[];
    }
  ): Promise<ChatCompletion> {
    const systemPrompt = this.buildSystemPrompt(context);
    const allMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    if (this.config.provider === 'mock') {
      return this.mockResponse(messages, context);
    }

    if (this.config.provider === 'openai') {
      return this.callOpenAI(allMessages);
    }

    if (this.config.provider === 'anthropic') {
      return this.callAnthropic(allMessages);
    }

    return this.mockResponse(messages, context);
  }

  private buildSystemPrompt(context?: {
    customerName?: string;
    businessName?: string;
    customerHistory?: string[];
    knowledgeItems?: string[];
  }): string {
    let prompt = `You are an AI assistant for ${context?.businessName || 'a business'}, helping customers via WhatsApp. `;
    prompt += 'Keep responses concise (under 200 characters), friendly, and helpful. ';

    if (context?.customerName) {
      prompt += `The customer's name is ${context.customerName}. `;
    }

    if (context?.customerHistory && context.customerHistory.length > 0) {
      prompt += `\n\nCustomer history:\n${context.customerHistory.join('\n')}`;
    }

    if (context?.knowledgeItems && context.knowledgeItems.length > 0) {
      prompt += `\n\nKnowledge base:\n${context.knowledgeItems.join('\n')}`;
    }

    prompt += '\n\nIf you cannot help, politely suggest contacting the business directly.';
    return prompt;
  }

  private async callOpenAI(messages: ChatMessage[]): Promise<ChatCompletion> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.config.model || 'gpt-4',
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: 500,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const choice = response.data.choices[0];
      return {
        content: choice.message.content,
        usage: response.data.usage,
        model: response.data.model,
      };
    } catch (error) {
      logger.error('OpenAI API error', { error });
      return this.mockResponse([], {});
    }
  }

  private async callAnthropic(messages: ChatMessage[]): Promise<ChatCompletion> {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: this.config.model || 'claude-3-sonnet-20240229',
          max_tokens: 500,
          messages: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content,
          })),
          system: messages.find(m => m.role === 'system')?.content,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'x-api-key': this.config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
        }
      );

      return {
        content: response.data.content[0].text,
        model: response.data.model,
      };
    } catch (error) {
      logger.error('Anthropic API error', { error });
      return this.mockResponse([], {});
    }
  }

  private mockResponse(messages: ChatMessage[], context?: { customerName?: string; businessName?: string }): ChatCompletion {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const greeting = context?.customerName ? `Hi ${context.customerName}! ` : 'Hi! ';

    if (/book|appointment|slot/i.test(lastMessage)) {
      return {
        content: `${greeting}I'd be happy to help you book. What service would you like and when are you available?`,
        model: 'mock-gpt-4',
      };
    }

    if (/price|cost/i.test(lastMessage)) {
      return {
        content: `${greeting}Our services start from ₹299. Would you like a detailed price list?`,
        model: 'mock-gpt-4',
      };
    }

    if (/hours|open|close/i.test(lastMessage)) {
      return {
        content: `${greeting}We're open Monday to Saturday, 9 AM to 8 PM.`,
        model: 'mock-gpt-4',
      };
    }

    return {
      content: `${greeting}Thanks for messaging us! How can I help you today?`,
      model: 'mock-gpt-4',
    };
  }

  getHistory(sessionId: string): ChatMessage[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  addToHistory(sessionId: string, messages: ChatMessage[]): void {
    const existing = this.conversationHistory.get(sessionId) || [];
    const updated = [...existing, ...messages].slice(-10);
    this.conversationHistory.set(sessionId, updated);
  }

  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }
}

export const llmService = new LLMService({
  provider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'mock') || 'mock',
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  model: process.env.LLM_MODEL,
});

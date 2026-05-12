/**
 * Agent Router Service
 * Routes conversations to appropriate agents based on intent, skills, and availability
 */

import axios from 'axios';
import {
  IntentData,
  ConversationContext,
  RoutingDecision,
  AgentInfo,
  IntentConfidence,
} from '../types';
import { config } from '../config';
import { logger } from '../config/logger';
import { IntentProcessor } from './intentProcessor';

const agentRouterLogger = logger.child({ component: 'AgentRouter' });

interface AgentCapabilities {
  skills: string[];
  languages: string[];
  channels: string[];
  maxConcurrentChats: number;
  currentLoad: number;
}

interface Agent {
  agentId: string;
  name: string;
  type: 'bot' | 'human' | 'ai-assist';
  teamId?: string;
  capabilities: AgentCapabilities;
  isOnline: boolean;
  priority: number;
}

interface RoutingRequest {
  intent: IntentData;
  context: ConversationContext;
  conversationId: string;
  sessionId: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

interface RoutingResponse {
  agentId: string;
  agentType: 'bot' | 'human' | 'ai-assist';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  skills?: string[];
  reason: string;
  queue?: string;
}

export class AgentRouter {
  private intentProcessor: IntentProcessor;
  private agentOSUrl: string;
  private agentCache: Map<string, Agent>;
  private skillMapping: Map<string, string[]>;

  constructor() {
    this.intentProcessor = new IntentProcessor();
    this.agentOSUrl = config.services.agentOs.url;
    this.agentCache = new Map();
    this.skillMapping = new Map();

    this.initializeSkillMapping();
  }

  /**
   * Initialize intent to skill mapping
   */
  private initializeSkillMapping(): void {
    this.skillMapping.set('order_status', ['order-tracking', 'general']);
    this.skillMapping.set('cancel_order', ['order-management', 'refunds']);
    this.skillMapping.set('refund', ['refunds', 'order-management']);
    this.skillMapping.set('product_inquiry', ['products', 'general']);
    this.skillMapping.set('payment_issue', ['payments', 'billing']);
    this.skillMapping.set('complaint', ['escalations', 'customer-care']);
    this.skillMapping.set('greeting', ['general']);
    this.skillMapping.set('goodbye', ['general']);
    this.skillMapping.set('help', ['general']);
    this.skillMapping.set('feedback', ['general', 'marketing']);
  }

  /**
   * Route intent to appropriate agent
   */
  async route(
    intent: IntentData,
    context: ConversationContext
  ): Promise<RoutingDecision> {
    const startTime = Date.now();

    agentRouterLogger.debug('Routing conversation', {
      intentName: intent.name,
      confidence: intent.confidence,
      channel: context.conversation.channel,
    });

    try {
      // Determine if human handoff is needed
      const needsHumanHandoff = await this.shouldHandoffToHuman(intent, context);

      if (needsHumanHandoff) {
        return this.routeToHumanAgent(intent, context);
      }

      // Route to bot
      return this.routeToBot(intent, context);
    } catch (error) {
      agentRouterLogger.error('Routing failed, defaulting to bot', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Default to bot on error
      return {
        agentType: 'bot',
        priority: 'normal',
        reason: 'Default routing due to error',
      };
    }
  }

  /**
   * Determine if conversation should be handed off to human
   */
  private async shouldHandoffToHuman(
    intent: IntentData,
    context: ConversationContext
  ): Promise<boolean> {
    // Low confidence intent
    if (intent.confidence < 0.5) {
      return true;
    }

    // Explicit escalation intent
    const escalationIntents = ['complaint', 'escalation', 'speak_to_human'];
    if (escalationIntents.includes(intent.name)) {
      return true;
    }

    // Negative sentiment detected
    if (context.conversation.recentIntents.some(i => i.name === 'complaint')) {
      return true;
    }

    // High value or complex intents
    const complexIntents = ['refund', 'cancel_order', 'complex_order'];
    if (complexIntents.includes(intent.name) && intent.confidence > 0.7) {
      // Only handoff if we have human availability
      const humanAvailable = await this.checkHumanAvailability();
      if (humanAvailable) {
        return true;
      }
    }

    // User explicitly requests human
    if (context.conversation.variables['human_requested'] === true) {
      return true;
    }

    // Sentiment analysis indicates frustration
    const messageHistory = context.history.messages.slice(-3);
    const frustratedKeywords = ['frustrated', 'angry', 'worst', 'terrible', 'unacceptable'];
    const recentText = messageHistory.map(m => m.content.toLowerCase()).join(' ');
    if (frustratedKeywords.some(keyword => recentText.includes(keyword))) {
      return true;
    }

    return false;
  }

  /**
   * Check if human agents are available
   */
  private async checkHumanAvailability(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.agentOSUrl}/api/agents/availability`,
        {
          timeout: 1000,
          headers: {
            'X-Internal-Token': config.internalServiceTokens['rez-agent-os'] || '',
          },
        }
      );

      return response.data?.available === true;
    } catch (error) {
      agentRouterLogger.warn('Could not check human availability', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Route to human agent
   */
  private async routeToHumanAgent(
    intent: IntentData,
    context: ConversationContext
  ): Promise<RoutingDecision> {
    const skills = this.skillMapping.get(intent.name) || ['general'];
    const priority = this.determinePriority(intent, context);

    agentRouterLogger.info('Routing to human agent', {
      intentName: intent.name,
      skills,
      priority,
    });

    // Try to get agent from Agent OS
    try {
      const agent = await this.findAvailableAgent(skills, priority);

      if (agent) {
        return {
          agentId: agent.agentId,
          agentType: 'human',
          priority,
          skills,
          reason: `Human handoff for ${intent.name} with ${intent.confidence.toFixed(2)} confidence`,
          queue: agent.teamId,
        };
      }
    } catch (error) {
      agentRouterLogger.warn('Could not find available agent', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Add to queue if no agent available
    return {
      agentType: 'human',
      priority,
      skills,
      reason: `Queued for ${intent.name} - no agents available`,
      queue: 'default',
    };
  }

  /**
   * Route to bot agent
   */
  private routeToBot(
    intent: IntentData,
    context: ConversationContext
  ): RoutingDecision {
    const skills = this.skillMapping.get(intent.name) || ['general'];

    agentRouterLogger.debug('Routing to bot', {
      intentName: intent.name,
      skills,
    });

    return {
      agentType: 'bot',
      priority: 'normal',
      skills,
      reason: `Bot routing for ${intent.name} with ${intent.confidence.toFixed(2)} confidence`,
    };
  }

  /**
   * Determine priority based on intent and context
   */
  private determinePriority(
    intent: IntentData,
    context: ConversationContext
  ): 'low' | 'normal' | 'high' | 'urgent' {
    // Urgent priority for complaints and escalations
    if (['complaint', 'escalation'].includes(intent.name)) {
      return 'urgent';
    }

    // High priority for refunds and cancellations
    if (['refund', 'cancel_order'].includes(intent.name)) {
      return 'high';
    }

    // Check for frustrated keywords
    const recentMessages = context.history.messages.slice(-3).map(m => m.content.toLowerCase());
    if (recentMessages.some(msg => msg.includes('urgent') || msg.includes('asap'))) {
      return 'high';
    }

    return 'normal';
  }

  /**
   * Find an available agent with required skills
   */
  private async findAvailableAgent(
    skills: string[],
    priority: 'low' | 'normal' | 'high' | 'urgent'
  ): Promise<Agent | null> {
    try {
      const response = await axios.post(
        `${this.agentOSUrl}/api/agents/find`,
        {
          skills,
          priority,
          channel: 'chat',
        },
        {
          timeout: 2000,
          headers: {
            'X-Internal-Token': config.internalServiceTokens['rez-agent-os'] || '',
          },
        }
      );

      if (response.data?.agent) {
        return response.data.agent as Agent;
      }

      return null;
    } catch (error) {
      agentRouterLogger.debug('Agent OS find request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get routing statistics
   */
  async getRoutingStats(): Promise<{
    totalRoutes: number;
    botRoutes: number;
    humanRoutes: number;
    averageRoutingTimeMs: number;
    queueLength: number;
  }> {
    try {
      const response = await axios.get(
        `${this.agentOSUrl}/api/routing/stats`,
        {
          timeout: 1000,
          headers: {
            'X-Internal-Token': config.internalServiceTokens['rez-agent-os'] || '',
          },
        }
      );

      return response.data;
    } catch (error) {
      // Return default values on error
      return {
        totalRoutes: 0,
        botRoutes: 0,
        humanRoutes: 0,
        averageRoutingTimeMs: 0,
        queueLength: 0,
      };
    }
  }

  /**
   * Get agent information
   */
  async getAgentInfo(agentId: string): Promise<AgentInfo | null> {
    try {
      const response = await axios.get(
        `${this.agentOSUrl}/api/agents/${agentId}`,
        {
          timeout: 1000,
          headers: {
            'X-Internal-Token': config.internalServiceTokens['rez-agent-os'] || '',
          },
        }
      );

      if (response.data) {
        return response.data as AgentInfo;
      }

      return null;
    } catch (error) {
      agentRouterLogger.debug('Could not get agent info', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get available queues
   */
  async getQueues(): Promise<Array<{
    queueId: string;
    name: string;
    size: number;
    averageWaitTime: number;
  }>> {
    try {
      const response = await axios.get(
        `${this.agentOSUrl}/api/queues`,
        {
          timeout: 1000,
          headers: {
            'X-Internal-Token': config.internalServiceTokens['rez-agent-os'] || '',
          },
        }
      );

      return response.data?.queues || [];
    } catch (error) {
      return [];
    }
  }
}

// Singleton instance
let agentRouterInstance: AgentRouter | null = null;

export function getAgentRouter(): AgentRouter {
  if (!agentRouterInstance) {
    agentRouterInstance = new AgentRouter();
  }
  return agentRouterInstance;
}

export function resetAgentRouter(): void {
  agentRouterInstance = null;
}

export { AgentRouter };

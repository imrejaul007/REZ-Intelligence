import { RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { z } from 'zod';

// Types
export interface Session {
  sessionId: string;
  userId?: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
}

export interface WidgetResponse {
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface OrchestratorRequest {
  intent: string;
  context: {
    sessionId: string;
    userId?: string;
    messageHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
  };
}

interface OrchestratorResponse {
  response: string;
  intent?: string;
  entities?: Record<string, unknown>;
  confidence?: number;
  actions?: Array<{
    type: string;
    params?: Record<string, unknown>;
  }>;
}

// Validation schemas
const messageSchema = z.object({
  message: z.string().min(1).max(5000),
  sessionId: z.string().uuid().optional(),
  userId: z.string().optional(),
});

export class WidgetService {
  private redisClient: RedisClientType;
  private logger: winston.Logger;
  private readonly SESSION_PREFIX = 'widget:session:';
  private readonly MESSAGE_PREFIX = 'widget:messages:';
  private readonly SESSION_TIMEOUT: number;

  constructor(redisClient: RedisClientType, logger: winston.Logger) {
    this.redisClient = redisClient;
    this.logger = logger;
    this.SESSION_TIMEOUT = parseInt(process.env.WIDGET_SESSION_TIMEOUT || '3600000', 10); // 1 hour
  }

  async initialize(): Promise<void> {
    this.logger.info('Widget service initialized');
  }

  /**
   * Handle a message from the widget
   */
  async handleMessage(sessionId: string, message: string): Promise<WidgetResponse> {
    // Validate input
    const validated = messageSchema.parse({ message, sessionId });

    // Get or create session
    let session = await this.getSession(sessionId);
    if (!session) {
      session = await this.createSession();
    }

    // Store user message
    await this.addMessage(session.sessionId, {
      role: 'user',
      content: validated.message,
      timestamp: new Date().toISOString(),
    });

    // Update session activity
    await this.updateSessionActivity(session.sessionId);

    // Get message history for context
    const messageHistory = await this.getMessageHistory(session.sessionId);

    try {
      // Call orchestrator service
      const orchestratorResponse = await this.callOrchestrator({
        intent: 'chat',
        context: {
          sessionId: session.sessionId,
          userId: session.userId,
          messageHistory,
        },
      });

      // Store assistant response
      await this.addMessage(session.sessionId, {
        role: 'assistant',
        content: orchestratorResponse.response,
        timestamp: new Date().toISOString(),
      });

      return {
        message: orchestratorResponse.response,
        timestamp: new Date().toISOString(),
        metadata: {
          intent: orchestratorResponse.intent,
          entities: orchestratorResponse.entities,
          confidence: orchestratorResponse.confidence,
        },
      };
    } catch (error) {
      this.logger.error('Orchestrator call failed:', {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return fallback response
      return {
        message: 'I apologize, but I\'m having trouble connecting to my knowledge base right now. Please try again in a moment.',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(userId?: string): Promise<Session> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session: Session = {
      sessionId,
      userId,
      createdAt: now,
      lastActivityAt: now,
      messageCount: 0,
    };

    // Store session in Redis
    await this.redisClient.setEx(
      `${this.SESSION_PREFIX}${sessionId}`,
      Math.floor(this.SESSION_TIMEOUT / 1000),
      JSON.stringify(session)
    );

    this.logger.info('Session created', {
      sessionId,
      userId,
    });

    return session;
  }

  /**
   * Get an existing session
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const data = await this.redisClient.get(`${this.SESSION_PREFIX}${sessionId}`);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as Session;
  }

  /**
   * End a session
   */
  endSession(sessionId: string): void {
    // Clean up Redis keys
    this.redisClient.del(`${this.SESSION_PREFIX}${sessionId}`);
    this.redisClient.del(`${this.MESSAGE_PREFIX}${sessionId}`);

    this.logger.info('Session ended', {
      sessionId,
    });
  }

  /**
   * Add a message to the session history
   */
  private async addMessage(
    sessionId: string,
    message: { role: 'user' | 'assistant'; content: string; timestamp: string }
  ): Promise<void> {
    const key = `${this.MESSAGE_PREFIX}${sessionId}`;

    // Get existing messages
    const existing = await this.redisClient.lRange(key, 0, -1);
    const messages = existing.map((m) => JSON.parse(m) as typeof message);

    // Add new message
    messages.push(message);

    // Keep only last 50 messages
    const trimmedMessages = messages.slice(-50);

    // Store messages
    await this.redisClient.del(key);
    for (const msg of trimmedMessages) {
      await this.redisClient.rPush(key, JSON.stringify(msg));
    }

    // Set expiry on message history
    await this.redisClient.expire(key, Math.floor(this.SESSION_TIMEOUT / 1000));
  }

  /**
   * Get message history for a session
   */
  private async getMessageHistory(sessionId: string): Promise<
    Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>
  > {
    const key = `${this.MESSAGE_PREFIX}${sessionId}`;
    const messages = await this.redisClient.lRange(key, 0, -1);
    return messages.map((m) => JSON.parse(m));
  }

  /**
   * Update session last activity timestamp
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (session) {
      session.lastActivityAt = new Date().toISOString();
      session.messageCount += 1;

      await this.redisClient.setEx(
        `${this.SESSION_PREFIX}${sessionId}`,
        Math.floor(this.SESSION_TIMEOUT / 1000),
        JSON.stringify(session)
      );
    }
  }

  /**
   * Call the orchestrator service for AI response
   */
  private async callOrchestrator(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:4006';

    // Get internal service token
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    const tokens = JSON.parse(tokensJson);
    const serviceToken = tokens['rez-web-widget'] || tokens['default'];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(`${orchestratorUrl}/api/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': serviceToken,
          'X-Service-Name': 'rez-web-widget',
        },
        body: JSON.stringify({
          type: 'chat',
          intent: request.intent,
          context: request.context,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Orchestrator returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as OrchestratorResponse;

      return {
        response: data.response || 'I\'m here to help! How can I assist you today?',
        intent: data.intent,
        entities: data.entities,
        confidence: data.confidence,
      };
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Orchestrator request timed out');
      }

      throw error;
    }
  }
}

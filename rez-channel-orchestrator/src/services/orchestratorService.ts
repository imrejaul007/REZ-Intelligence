import axios from 'axios';
import { logger } from '../utils/logger';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4006';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'core-brain-token-123';

export interface MessageRequest {
  message: string;
  userId: string;
  channel: string;
  metadata?: Record<string, unknown>;
}

export interface MessageResponse {
  content: string;
  format: 'text' | 'image' | 'audio' | 'video' | 'buttons' | 'carousel';
  buttons?: Array<{ title: string; action: string }>;
  cards?: Array<{ title: string; description: string; imageUrl?: string }>;
}

// Expert agent endpoints
const EXPERT_ENDPOINTS = {
  culinary: 'http://localhost:3001/api/culinary/chat',
  hospitality: 'http://localhost:3000/api/v1/hospitality/chat',
  health: 'http://localhost:3011/api/v1/health/chat',
  travel: 'http://localhost:3003/api/v1/travel/chat',
  fitness: 'http://localhost:3010/api/v1/fitness/chat',
  retail: 'http://localhost:3004/api/v1/retail/chat',
  salon: 'http://localhost:3005/api/v1/salon/chat',
  education: 'http://localhost:3006/api/v1/education/chat'
};

class OrchestratorService {
  private responseQueue: Map<string, MessageResponse[]> = new Map();

  // Route message to appropriate expert based on content
  private selectExpert(message: string): { endpoint: string; expert: string } {
    const lowerMessage = message.toLowerCase();

    // Food ordering
    if (lowerMessage.match(/order|food|biryani|burger|pizza|restaurant|menu|eat|dinner|lunch|breakfast/i)) {
      return { endpoint: EXPERT_ENDPOINTS.culinary, expert: 'culinary' };
    }

    // Hotel/stay
    if (lowerMessage.match(/hotel|room|stay|book|checkin|checkout|accommodation/i)) {
      return { endpoint: EXPERT_ENDPOINTS.hospitality, expert: 'hospitality' };
    }

    // Health/medical
    if (lowerMessage.match(/doctor|medical|health|clinic|hospital|appointment|symptom/i)) {
      return { endpoint: EXPERT_ENDPOINTS.health, expert: 'health' };
    }

    // Travel
    if (lowerMessage.match(/travel|trip|flight|book|vacation|tour| destination/i)) {
      return { endpoint: EXPERT_ENDPOINTS.travel, expert: 'travel' };
    }

    // Fitness
    if (lowerMessage.match(/gym|workout|fitness|exercise|training/i)) {
      return { endpoint: EXPERT_ENDPOINTS.fitness, expert: 'fitness' };
    }

    // Retail/shopping
    if (lowerMessage.match(/shop|buy|product|store|price|discount/i)) {
      return { endpoint: EXPERT_ENDPOINTS.retail, expert: 'retail' };
    }

    // Salon/beauty
    if (lowerMessage.match(/salon|beauty|spa|haircut|massage|facial/i)) {
      return { endpoint: EXPERT_ENDPOINTS.salon, expert: 'salon' };
    }

    // Education
    if (lowerMessage.match(/course|learn|study|education|class|tutorial/i)) {
      return { endpoint: EXPERT_ENDPOINTS.education, expert: 'education' };
    }

    // Default to culinary
    return { endpoint: EXPERT_ENDPOINTS.culinary, expert: 'culinary' };
  }

  async routeMessage(request: MessageRequest): Promise<MessageResponse | null> {
    try {
      logger.info('Routing message', {
        channel: request.channel,
        userId: request.userId,
        messageLength: request.message.length
      });

      // Select the appropriate expert based on message content
      const { endpoint, expert } = this.selectExpert(request.message);
      logger.info(`Selected expert: ${expert}`, { endpoint });

      // Try calling the expert directly first
      try {
        const expertResponse = await this.callExpert(endpoint, request);
        if (expertResponse) {
          return expertResponse;
        }
      } catch (expertError) {
        logger.warn(`Expert ${expert} failed, trying orchestrator`, { error: (expertError as Error).message });
      }

      // Fallback to orchestrator
      const response = await axios.post(
        `${ORCHESTRATOR_URL}/api/v2/message/process`,
        {
          message: request.message,
          channel: request.channel,
          userId: request.userId,
          metadata: {
            ...request.metadata,
            source: 'channel-orchestrator',
            timestamp: new Date().toISOString()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          },
          timeout: 30000
        }
      );

      if (response.data?.primaryResponse?.content) {
        return {
          content: response.data.primaryResponse.content,
          format: response.data.primaryResponse.format || 'text'
        };
      }

      return null;
    } catch (error) {
      logger.error('Routing failed', {
        error: error.message,
        channel: request.channel,
        userId: request.userId
      });
      return null;
    }
  }

  private async callExpert(endpoint: string, request: MessageRequest): Promise<MessageResponse | null> {
    // Try culinary-style endpoint
    if (endpoint.includes('/culinary/')) {
      const response = await axios.post(endpoint, {
        message: request.message,
        userId: request.userId
      }, { timeout: 10000 });

      if (response.data?.data?.response) {
        return {
          content: response.data.data.response,
          format: 'text'
        };
      }
    }

    // Try hospitality-style endpoint
    if (endpoint.includes('/hospitality/')) {
      const response = await axios.post(endpoint, {
        sessionId: request.userId,
        message: request.message
      }, { timeout: 10000 });

      if (response.data?.message) {
        return {
          content: response.data.message,
          format: 'text'
        };
      }
    }

    return null;
  }

  async queueResponse(userId: string, response: MessageResponse): Promise<void> {
    const queue = this.responseQueue.get(userId) || [];
    queue.push(response);
    this.responseQueue.set(userId, queue);

    setTimeout(() => {
      const q = this.responseQueue.get(userId);
      if (q && q.length > 0) {
        q.shift();
        if (q.length === 0) {
          this.responseQueue.delete(userId);
        }
      }
    }, 5 * 60 * 1000);
  }

  async getResponse(userId: string): Promise<MessageResponse | null> {
    const queue = this.responseQueue.get(userId);
    if (queue && queue.length > 0) {
      return queue.shift() || null;
    }
    return null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${ORCHESTRATOR_URL}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const orchestratorService = new OrchestratorService();

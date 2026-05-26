/**
 * REZ Care Integration Service
 *
 * Expert services use this to register with and communicate with REZ Care.
 * This enables the central support hub to route tickets to industry experts.
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './utils/logger';

export interface ExpertRegistration {
  serviceId: string;
  serviceName: string;
  industry: string;
  capabilities: string[];
  endpoints: {
    chat: string;
    health: string;
  };
  status: 'active' | 'inactive';
}

export interface ExpertConfig {
  REZ_CARE_URL: string;
  INTERNAL_SERVICE_TOKEN: string;
  SERVICE_NAME: string;
  INDUSTRY: string;
  PORT: string;
}

export class RezCareIntegration {
  private http: AxiosInstance;
  private config: ExpertConfig;
  private registration: ExpertRegistration | null = null;

  constructor(config: ExpertConfig) {
    this.config = config;
    this.http = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': config.INTERNAL_SERVICE_TOKEN,
      },
    });
  }

  /**
   * Register this expert service with REZ Care
   */
  async register(): Promise<boolean> {
    try {
      const baseUrl = `http://localhost:${this.config.PORT}`;

      this.registration = {
        serviceId: `expert-${this.config.SERVICE_NAME.toLowerCase()}`,
        serviceName: this.config.SERVICE_NAME,
        industry: this.config.INDUSTRY,
        capabilities: this.getCapabilities(),
        endpoints: {
          chat: `${baseUrl}/api/v1/chat`,
          health: `${baseUrl}/health`,
        },
        status: 'active',
      };

      const response = await this.http.post(
        `${this.config.REZ_CARE_URL}/api/internal/expert/register`,
        this.registration
      );

      if (response.data?.success) {
        logger.info(`[REZ Care] Registered as expert: ${this.config.SERVICE_NAME}`);
        return true;
      }

      return false;
    } catch (error) {
      if (error.response?.status === 409) {
        logger.info(`[REZ Care] Already registered: ${this.config.SERVICE_NAME}`);
        return true;
      }
      logger.warn(`[REZ Care] Registration failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Report metrics to REZ Care
   */
  async reportMetrics(metrics: {
    conversationsHandled: number;
    avgResponseTime: number;
    satisfactionScore?: number;
    escalationRate?: number;
  }): Promise<void> {
    try {
      await this.http.post(
        `${this.config.REZ_CARE_URL}/api/internal/expert/metrics`,
        {
          serviceName: this.config.SERVICE_NAME,
          ...metrics,
        }
      );
    } catch (error) {
      logger.debug(`[REZ Care] Metrics report failed: ${error.message}`);
    }
  }

  /**
   * Send ticket context to REZ Care for cross-referencing
   */
  async syncTicketContext(ticketId: string, context): Promise<void> {
    try {
      await this.http.post(
        `${this.config.REZ_CARE_URL}/api/internal/expert/context`,
        {
          ticketId,
          expertName: this.config.SERVICE_NAME,
          context,
        }
      );
    } catch (error) {
      logger.debug(`[REZ Care] Context sync failed: ${error.message}`);
    }
  }

  /**
   * Get customer history from REZ Care
   */
  async getCustomerHistory(customerId: string): Promise<unknown> {
    try {
      const response = await this.http.get(
        `${this.config.REZ_CARE_URL}/api/internal/customer/${customerId}/history`
      );
      return response.data;
    } catch (error) {
      logger.debug(`[REZ Care] Customer history fetch failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Enrich expert response with REZ Care insights
   */
  async getEnrichmentData(sessionId: string): Promise<{
    sentiment?: string;
    churnRisk?: number;
    ltv?: number;
    segment?: string;
  }> {
    try {
      const response = await this.http.get(
        `${this.config.REZ_CARE_URL}/api/internal/enrichment/${sessionId}`
      );
      return response.data;
    } catch {
      return {};
    }
  }

  /**
   * Log conversation for analytics
   */
  async logConversation(conversation: {
    sessionId: string;
    customerId?: string;
    messages: Array<{ role: string; content: string }>;
    resolution?: string;
    duration: number;
  }): Promise<void> {
    try {
      await this.http.post(
        `${this.config.REZ_CARE_URL}/api/internal/conversation/log`,
        {
          expertService: this.config.SERVICE_NAME,
          ...conversation,
        }
      );
    } catch (error) {
      logger.debug(`[REZ Care] Conversation log failed: ${error.message}`);
    }
  }

  /**
   * Get industry-specific capabilities
   * Override in subclasses for specific industries
   */
  protected getCapabilities(): string[] {
    return [
      'general_inquiry',
      'complaint_resolution',
      'product_information',
      'booking_assistance',
    ];
  }

  /**
   * Check if REZ Care is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.http.get(`${this.config.REZ_CARE_URL}/health`);
      return response.data?.status === 'ok';
    } catch {
      return false;
    }
  }
}

/**
 * Create REZ Care integration instance
 */
export function createRezCareIntegration(): RezCareIntegration {
  return new RezCareIntegration({
    REZ_CARE_URL: process.env.REZ_CARE_URL || 'http://localhost:4058',
    INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
    SERVICE_NAME: process.env.SERVICE_NAME || 'expert-unknown',
    INDUSTRY: process.env.INDUSTRY || 'general',
    PORT: process.env.PORT || '3000',
  });
}

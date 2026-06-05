import { config } from '../config';
import { logger } from '../utils/logger';

interface IntentRequest {
  intent: string;
  merchantId: string;
  customerId?: string;
  sessionId?: string;
  entities?: Record<string, any>;
  context?: Record<string, any>;
}

interface NotificationRequest {
  merchantId: string;
  type: 'expiry_alert' | 'demand_signal' | 'recommendation' | 'price_change';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
  channels?: ('email' | 'sms' | 'push' | 'in_app')[];
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  error?: string;
}

class RABTULPlatform {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.rabtulPlatformUrl || 'https://rabtul.rez.com';
  }

  /**
   * Send intent to RABTUL platform for NLP processing
   */
  async sendIntent(request: IntentRequest): Promise<{
    intent: string;
    confidence: number;
    entities: Record<string, any>;
    response: string;
  }> {
    const startTime = Date.now();

    try {
      logger.debug('Sending intent to RABTUL', {
        intent: request.intent,
        merchantId: request.merchantId,
      });

      // Simulate RABTUL intent processing
      // In production, this would be an actual API call
      const intent = request.intent.toLowerCase();
      let response = '';
      let confidence = 0.85;

      if (intent.includes('expiry') || intent.includes('waste')) {
        response = 'I can help you with expiry management and waste reduction. We predict expiry dates and suggest optimal discount levels.';
      } else if (intent.includes('demand') || intent.includes('forecast')) {
        response = 'I can help you forecast demand for your products. Our AI analyzes historical data, seasonal patterns, and external factors.';
      } else if (intent.includes('recommend') || intent.includes('product')) {
        response = 'I can provide personalized product recommendations based on customer history and preferences.';
      } else if (intent.includes('supplier') || intent.includes('vendor')) {
        response = 'I can help optimize your supplier selection based on performance metrics and reliability scores.';
      } else {
        response = 'I can help with various grocery intelligence tasks including expiry prediction, demand forecasting, and recommendations.';
        confidence = 0.75;
      }

      const latency = Date.now() - startTime;
      logger.info('Intent processed by RABTUL', {
        intent: request.intent,
        latency,
        confidence,
      });

      return {
        intent: request.intent,
        confidence,
        entities: request.entities || {},
        response,
      };
    } catch (error) {
      logger.error('RABTUL intent processing failed', { error, intent: request.intent });
      throw error;
    }
  }

  /**
   * Send notification through RABTUL platform
   */
  async sendNotification(request: NotificationRequest): Promise<{
    notificationId: string;
    status: 'sent' | 'queued' | 'failed';
    channels: string[];
  }> {
    try {
      logger.info('Sending notification via RABTUL', {
        merchantId: request.merchantId,
        type: request.type,
        title: request.title,
      });

      // Simulate notification sending
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        notificationId,
        status: 'sent',
        channels: request.channels || ['in_app'],
      };
    } catch (error) {
      logger.error('RABTUL notification failed', { error, type: request.type });
      throw error;
    }
  }

  /**
   * Send expiry alert notification
   */
  async sendExpiryAlert(
    merchantId: string,
    productName: string,
    daysRemaining: number,
    suggestedAction: string
  ): Promise<void> {
    await this.sendNotification({
      merchantId,
      type: 'expiry_alert',
      title: `Expiry Alert: ${productName}`,
      message: `${productName} will expire in ${daysRemaining} days. Suggested action: ${suggestedAction}`,
      priority: daysRemaining <= 2 ? 'high' : 'medium',
      channels: ['in_app', 'email'],
      data: {
        productName,
        daysRemaining,
        suggestedAction,
      },
    });
  }

  /**
   * Send demand signal notification
   */
  async sendDemandSignal(
    merchantId: string,
    productName: string,
    signalType: string,
    value: number
  ): Promise<void> {
    await this.sendNotification({
      merchantId,
      type: 'demand_signal',
      title: `Demand Signal: ${productName}`,
      message: `${signalType} demand detected for ${productName}. Value: ${value}%`,
      priority: 'low',
      data: {
        productName,
        signalType,
        value,
      },
    });
  }

  /**
   * Health check for RABTUL platform connection
   */
  async healthCheck(): Promise<HealthResponse> {
    const startTime = Date.now();

    try {
      // Simulate health check
      // In production, this would ping the actual RABTUL API
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'degraded',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const rabtulPlatform = new RABTULPlatform();

export default rabtulPlatform;
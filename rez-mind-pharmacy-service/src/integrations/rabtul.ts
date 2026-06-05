import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * RABTUL Integration Service
 * Handles communication with RABTUL platform for notifications, customer profiles, and intents
 */
export class RabtulIntegration {
  private notificationClient: AxiosInstance;
  private intentClient: AxiosInstance;
  private customerProfileClient: AxiosInstance;

  constructor() {
    // Notification Service Client
    this.notificationClient = axios.create({
      baseURL: config.notificationServiceUrl || 'http://localhost:4004',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intent Service Client
    this.intentClient = axios.create({
      baseURL: config.intentServiceUrl || 'http://localhost:4006',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Customer Profile Service Client
    this.customerProfileClient = axios.create({
      baseURL: config.customerProfileServiceUrl || 'http://localhost:4010',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for internal auth
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    const addAuthHeader = (config: any) => {
      config.headers['X-Internal-Token'] = config.internalServiceToken || config.INTERNAL_SERVICE_TOKEN || config.headers['X-Internal-Token'];
      return config;
    };

    [this.notificationClient, this.intentClient, this.customerProfileClient].forEach(client => {
      client.interceptors.request.use(addAuthHeader);
      client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
          logger.error('RABTUL API Error', {
            status: error.response?.status,
            message: error.message,
            url: error.config?.url,
          });
          return Promise.reject(error);
        }
      );
    });
  }

  /**
   * Send notification via RABTUL Notification Service
   */
  async sendNotification(params: {
    customerId: string;
    channel: 'sms' | 'email' | 'whatsapp' | 'push';
    message: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    notificationId?: string;
    error?: string;
  }> {
    try {
      logger.info('Sending notification via RABTUL', {
        customerId: params.customerId,
        channel: params.channel,
      });

      const response = await this.notificationClient.post('/notifications/send', {
        recipientId: params.customerId,
        channel: params.channel,
        content: {
          body: params.message,
        },
        metadata: {
          source: 'rez-mind-pharmacy',
          ...params.metadata,
        },
      });

      return {
        success: true,
        notificationId: response.data?.notificationId,
      };
    } catch (error) {
      logger.error('Failed to send notification', { error, customerId: params.customerId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send refill reminder notification
   */
  async sendRefillReminder(params: {
    customerId: string;
    customerName?: string;
    drugName: string;
    prescriptionId: string;
    refillDate: Date;
    pharmacyName?: string;
  }): Promise<{
    success: boolean;
    notificationId?: string;
    error?: string;
  }> {
    const message = `Reminder: Your prescription for ${params.drugName} is due for a refill${
      params.pharmacyName ? ` at ${params.pharmacyName}` : ''
    }. Please visit us soon or use our app to schedule a pickup.`;

    return this.sendNotification({
      customerId: params.customerId,
      channel: 'sms', // Default to SMS for reminders
      message,
      metadata: {
        type: 'refill_reminder',
        drugName: params.drugName,
        prescriptionId: params.prescriptionId,
        refillDate: params.refillDate.toISOString(),
      },
    });
  }

  /**
   * Send compliance alert notification
   */
  async sendComplianceAlert(params: {
    customerId: string;
    alertType: string;
    severity: string;
    description: string;
    actionRequired: string;
  }): Promise<{
    success: boolean;
    notificationId?: string;
    error?: string;
  }> {
    const severityEmoji = {
      CRITICAL: '🚨',
      HIGH: '⚠️',
      MEDIUM: '📋',
      LOW: 'ℹ️',
    };

    const message = `${severityEmoji[params.severity as keyof typeof severityEmoji] || 'ℹ️'} Pharmacy Alert: ${params.description}. Action: ${params.actionRequired}`;

    return this.sendNotification({
      customerId: params.customerId,
      channel: 'sms',
      message,
      metadata: {
        type: 'compliance_alert',
        alertType: params.alertType,
        severity: params.severity,
      },
    });
  }

  /**
   * Send drug interaction warning to pharmacist
   */
  async sendInteractionWarning(params: {
    pharmacistId: string;
    patientId: string;
    drug1: string;
    drug2: string;
    severity: string;
    recommendation: string;
  }): Promise<{
    success: boolean;
    notificationId?: string;
    error?: string;
  }> {
    const severityPrefix = {
      SEVERE: '🚨 SEVERE INTERACTION',
      MODERATE: '⚠️ MODERATE INTERACTION',
      MILD: 'ℹ️ MINOR INTERACTION',
    };

    const message = `${severityPrefix[params.severity as keyof typeof severityPrefix] || '⚠️'} DETECTED\n\nPatient: ${params.patientId}\nDrugs: ${params.drug1} + ${params.drug2}\n\nRecommendation: ${params.recommendation}`;

    return this.sendNotification({
      customerId: params.pharmacistId,
      channel: 'push', // Push notification for urgent alerts
      message,
      metadata: {
        type: 'interaction_warning',
        patientId: params.patientId,
        severity: params.severity,
      },
    });
  }

  /**
   * Get customer health profile from RABTUL
   */
  async getCustomerHealthProfile(customerId: string): Promise<{
    success: boolean;
    profile?: {
      customerId: string;
      conditions: string[];
      allergies: string[];
      medications: Array<{
        drugId: string;
        name: string;
        dosage: string;
        category: string;
      }>;
      riskFactors: string[];
    };
    error?: string;
  }> {
    try {
      logger.info('Fetching customer health profile from RABTUL', { customerId });

      const response = await this.customerProfileClient.get(`/profiles/${customerId}`);

      return {
        success: true,
        profile: response.data?.profile,
      };
    } catch (error) {
      logger.error('Failed to fetch customer profile', { error, customerId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update customer health profile in RABTUL
   */
  async updateCustomerHealthProfile(customerId: string, profileData: {
    conditions?: string[];
    allergies?: string[];
    medications?: Array<{
      drugId: string;
      name: string;
      dosage: string;
      category: string;
    }>;
    riskFactors?: string[];
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Updating customer health profile in RABTUL', { customerId });

      await this.customerProfileClient.put(`/profiles/${customerId}`, profileData);

      return { success: true };
    } catch (error) {
      logger.error('Failed to update customer profile', { error, customerId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Analyze customer intent from RABTUL Intent Service
   */
  async analyzeCustomerIntent(customerId: string, context: {
    action: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    intent?: {
      primaryIntent: string;
      confidence: number;
      suggestedAction: string;
    };
    error?: string;
  }> {
    try {
      logger.info('Analyzing customer intent via RABTUL', { customerId, action: context.action });

      const response = await this.intentClient.post('/intent/analyze', {
        customerId,
        context: {
          source: 'pharmacy_service',
          action: context.action,
          ...context.metadata,
        },
      });

      return {
        success: true,
        intent: response.data?.intent,
      };
    } catch (error) {
      logger.error('Failed to analyze customer intent', { error, customerId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Predict customer refill intent
   */
  async predictRefillIntent(customerId: string, drugId: string): Promise<{
    success: boolean;
    prediction?: {
      likelyToRefill: boolean;
      confidence: number;
      optimalReminderDate: Date;
    };
    error?: string;
  }> {
    try {
      const response = await this.intentClient.post('/intent/predict', {
        customerId,
        context: {
          action: 'refill',
          drugId,
          source: 'pharmacy_service',
        },
      });

      return {
        success: true,
        prediction: response.data?.prediction,
      };
    } catch (error) {
      logger.error('Failed to predict refill intent', { error, customerId, drugId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Health check for RABTUL integration
   */
  async healthCheck(): Promise<{
    status: 'up' | 'down';
    services: Record<string, { status: string; latency?: number; error?: string }>;
  }> {
    const services: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Check Notification Service
    const notifStart = Date.now();
    try {
      await this.notificationClient.get('/health');
      services.notification = { status: 'up', latency: Date.now() - notifStart };
    } catch (error) {
      services.notification = { status: 'down', error: error instanceof Error ? error.message : 'Unknown' };
    }

    // Check Intent Service
    const intentStart = Date.now();
    try {
      await this.intentClient.get('/health');
      services.intent = { status: 'up', latency: Date.now() - intentStart };
    } catch (error) {
      services.intent = { status: 'down', error: error instanceof Error ? error.message : 'Unknown' };
    }

    // Check Customer Profile Service
    const profileStart = Date.now();
    try {
      await this.customerProfileClient.get('/health');
      services.customerProfile = { status: 'up', latency: Date.now() - profileStart };
    } catch (error) {
      services.customerProfile = { status: 'down', error: error instanceof Error ? error.message : 'Unknown' };
    }

    const allUp = Object.values(services).every(s => s.status === 'up');

    return {
      status: allUp ? 'up' : 'degraded',
      services,
    };
  }
}

export const rabtulIntegration = new RabtulIntegration();
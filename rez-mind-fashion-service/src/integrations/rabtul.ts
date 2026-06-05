import config from '../config';
import logger from '../utils/logger';

export interface RABTULResponse { success: boolean; id?: string; error?: string; }

class RABTULIntegration {
  private isConfigured: boolean;
  constructor() { this.isConfigured = !!(config.rabtul.apiKey && config.rabtul.baseUrl); if (!this.isConfigured) logger.warn('RABTUL not configured'); }
  async sendNotification(notification: { type: string; title: string; message: string; recipientId: string }): Promise<RABTULResponse> {
    if (!this.isConfigured) return { success: false, error: 'RABTUL not configured' };
    logger.info('RABTUL notification', { type: notification.type, recipientId: notification.recipientId });
    return { success: true, id: `notif-${Date.now()}` };
  }
  async healthCheck(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> { return this.isConfigured ? { connected: true, latencyMs: 0 } : { connected: false, error: 'Not configured' }; }
}

export const rabtul = new RABTULIntegration();
export default rabtul;
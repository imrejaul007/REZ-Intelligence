/**
 * RABTUL Platform Integration for Fraud Detection Service
 *
 * Uses RABTUL services for:
 * - Analytics (fraud metrics)
 * - Notifications (fraud alerts)
 * - Profile (user verification)
 */

const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';

export const fraudIntegrations = {
  /**
   * Track fraud detection event
   */
  async trackFraudEvent(
    userId: string,
    eventType: string,
    risk: number,
    details: Record<string, any>
  ): Promise<void> {
    await fetch(`${ANALYTICS_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
      body: JSON.stringify({
        event: `fraud_${eventType}`,
        userId,
        properties: { risk, ...details },
        timestamp: new Date().toISOString(),
      }),
    });
  },

  /**
   * Get user profile for verification
   */
  async getUserForVerification(userId: string): Promise<any | null> {
    try {
      const res = await fetch(`${PROFILE_URL}/api/profiles/${userId}`, {
        headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' },
      });
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  },

  /**
   * Send fraud alert
   */
  async sendFraudAlert(
    userId: string,
    alertType: 'warning' | 'critical',
    message: string
  ): Promise<void> {
    await fetch(`${NOTIFICATION_URL}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
      body: JSON.stringify({
        userId,
        type: 'push',
        title: alertType === 'critical' ? '🔴 Fraud Alert' : '⚠️ Security Notice',
        message,
        data: { type: 'fraud_alert', severity: alertType },
      }),
    });
  },

  /**
   * Track fraud prevention
   */
  async trackPrevention(action: string, userId: string, success: boolean): Promise<void> {
    await fetch(`${ANALYTICS_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
      body: JSON.stringify({
        event: 'fraud_prevention',
        userId,
        properties: { action, success },
        timestamp: new Date().toISOString(),
      }),
    });
  },
};

export default fraudIntegrations;

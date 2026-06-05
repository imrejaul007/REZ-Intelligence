/**
 * REZ Review Response Engine - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4307';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class ReviewIntegration {

  /** Get merchant settings */
  static async getMerchantSettings(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}/settings`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return { brandVoice: 'professional', responseStyle: 'friendly' };
    }
  }

  /** Generate AI response using HOJAI */
  static async generateAIResponse(review: any, merchantSettings: any): Promise<string> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/generate-review-response`,
        {
          review,
          merchantSettings,
          intent: 'review_response'
        },
        { headers, timeout: 15000 }
      );
      return response.data.response || 'Thank you for your feedback!';
    } catch {
      return 'Thank you for your review!';
    }
  }

  /** Send notification when review needs attention */
  static async sendNotification(
    merchantId: string,
    review: any,
    type: 'negative' | 'escalated' | 'response_needed'
  ): Promise<void> {
    try {
      await axios.post(
        `${NOTIFICATION_SERVICE}/api/notifications/send`,
        {
          merchantId,
          type: type === 'negative' ? 'urgent_review_alert' : 'review_alert',
          title: `${type === 'negative' ? '⚠️' : '📝'} New ${type} review`,
          body: review.text?.substring(0, 100),
          priority: type === 'negative' ? 'high' : 'normal',
          data: { reviewId: review._id }
        },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Track sentiment to HOJAI */
  static async trackSentiment(merchantId: string, sentimentData: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/sentiment`,
        {
          merchantId,
          ...sentimentData,
          source: 'review_response_engine'
        },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Get customer for personalization */
  static async getCustomer(customerId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/customers/${customerId}`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }
}

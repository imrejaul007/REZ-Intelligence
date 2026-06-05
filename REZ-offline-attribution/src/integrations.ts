/**
 * REZ Offline Attribution - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const QR_SERVICE = process.env.QR_SERVICE_URL || 'http://localhost:4306';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class OfflineAttributionIntegration {

  /** Get customer from RABTUL */
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

  /** Award cashback for attribution */
  static async awardCashback(
    customerId: string,
    merchantId: string,
    amount: number,
    reason: string
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${WALLET_SERVICE}/api/cashback/award`,
        {
          customerId,
          merchantId,
          amount,
          reason,
          source: 'offline_attribution'
        },
        { headers, timeout: 10000 }
      );
      return response.data.success === true;
    } catch {
      return false;
    }
  }

  /** Get QR code data */
  static async getQRData(qrCodeId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${QR_SERVICE}/api/qr/${qrCodeId}`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Track attribution event */
  static async trackAttribution(merchantId: string, data: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/attribution`,
        {
          merchantId,
          ...data,
          source: 'offline_attribution'
        },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Get touchpoint data from campaign */
  static async getCampaignTouchpoints(campaignId: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${QR_SERVICE}/api/campaigns/${campaignId}/touchpoints`,
        { headers, timeout: 10000 }
      );
      return response.data.touchpoints || [];
    } catch {
      return [];
    }
  }
}

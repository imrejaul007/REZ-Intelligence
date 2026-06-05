/**
 * REZ Incrementality Testing - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const ANALYTICS_SERVICE = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4304';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class IncrementalityIntegration {

  /** Get merchant for experiment setup */
  static async getMerchantForExperiment(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}/experiment-context`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Send incrementality results to HOJAI */
  static async sendResultsToHOJAI(experimentId: string, results: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/incrementality`,
        { experimentId, ...results },
        { headers, timeout: 10000 }
      );
    } catch {}
  }

  /** Get AI model for incrementality analysis */
  static async getAIAnalysis(experiment: any): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/incrementality-analysis`,
        experiment,
        { headers, timeout: 15000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Store results in analytics */
  static async storeInAnalytics(experiment: any): Promise<void> {
    try {
      await axios.post(
        `${ANALYTICS_SERVICE}/api/incrementality`,
        experiment,
        { headers, timeout: 10000 }
      );
    } catch {}
  }
}

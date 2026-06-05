/**
 * REZ Prompt Studio - Ecosystem Integration
 */

import axios from 'axios';

const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class PromptStudioIntegration {

  /** Get AI capabilities from HOJAI */
  static async getAICapabilities(): Promise<any> {
    try {
      const response = await axios.get(
        `${HOJAI_BRAIN}/api/ai/capabilities`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return { models: ['claude', 'gpt-4'], maxTokens: 100000 };
    }
  }

  /** Test prompt with AI */
  static async testPrompt(prompt: string, context: any): Promise<string> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/test-prompt`,
        { prompt, context },
        { headers, timeout: 30000 }
      );
      return response.data.response || 'No response';
    } catch {
      return 'AI test failed';
    }
  }

  /** Get prompt template from HOJAI */
  static async getPromptTemplate(category: string): Promise<any> {
    try {
      const response = await axios.get(
        `${HOJAI_BRAIN}/api/prompts/templates/${category}`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Save prompt to knowledge base */
  static async saveToKnowledgeBase(merchantId: string, prompt: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/knowledge/prompts`,
        { merchantId, ...prompt },
        { headers, timeout: 10000 }
      );
    } catch {}
  }

  /** Get user permissions */
  static async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/users/${userId}/permissions`,
        { headers, timeout: 5000 }
      );
      return response.data.permissions || [];
    } catch {
      return ['prompt:read'];
    }
  }
}

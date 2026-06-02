// REZ Knowledge Service - REZ Mind Integration Service
// Optional integration with REZ Mind AI for advanced personalization

import config from '../config';
import { IUnifiedUserProfile } from '../models';

interface MindRequest {
  userId: string;
  context: string;
  data: Record<string, unknown>;
}

interface MindResponse {
  success?: boolean;
  insights?: unknown;
  recommendations?: unknown[];
  error?: string;
}

export class RezMindService {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private enabled: boolean;

  constructor() {
    this.baseUrl = process.env.REZ_MIND_SERVICE_URL || 'http://localhost:3001';
    this.apiKey = process.env.REZ_MIND_API_KEY || '';
    this.timeout = 10000;
    this.enabled = !!this.baseUrl;
  }

  private async makeRequest(endpoint: string, data: unknown): Promise<MindResponse> {
    if (!this.enabled) {
      return { success: false, error: 'REZ Mind service not configured' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Service-Name': config.service.name,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`REZ Mind API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('REZ Mind request timed out', { endpoint });
        } else {
          console.error('REZ Mind request failed:', error);
        }
      }
      return { success: false, error: 'REZ Mind service unavailable' };
    }
  }

  async getUserInsights(profile: IUnifiedUserProfile): Promise<MindResponse> {
    const request: MindRequest = {
      userId: profile.userId,
      context: 'knowledge_service',
      data: {
        name: profile.name,
        email: profile.email,
        preferences: profile.preferences,
        history: profile.history,
        recentSignals: profile.signals.slice(-10),
      },
    };

    return this.makeRequest('/api/insights', request);
  }

  async getPersonalization(profile: IUnifiedUserProfile, app: string): Promise<MindResponse> {
    const request: MindRequest = {
      userId: profile.userId,
      context: `${app}_personalization`,
      data: {
        name: profile.name,
        preferences: profile.preferences[app as keyof typeof profile.preferences],
        history: profile.history,
        signals: profile.signals.filter((s) => s.source === app),
      },
    };

    return this.makeRequest('/api/personalize', request);
  }

  async predictBehavior(
    profile: IUnifiedUserProfile,
    action: string
  ): Promise<MindResponse> {
    const request: MindRequest = {
      userId: profile.userId,
      context: 'behavior_prediction',
      data: {
        name: profile.name,
        history: profile.history,
        targetAction: action,
        signals: profile.signals.slice(-50),
      },
    };

    return this.makeRequest('/api/predict', request);
  }

  async getRecommendations(
    profile: IUnifiedUserProfile,
    context: string
  ): Promise<MindResponse> {
    const request: MindRequest = {
      userId: profile.userId,
      context,
      data: {
        name: profile.name,
        preferences: profile.preferences,
        history: profile.history,
      },
    };

    return this.makeRequest('/api/recommend', request);
  }

  async analyzeSentiment(
    userId: string,
    feedback: string
  ): Promise<MindResponse> {
    return this.makeRequest('/api/sentiment', {
      userId,
      text: feedback,
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const rezMindService = new RezMindService();
export default rezMindService;

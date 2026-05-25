/**
 * REZ Intelligence SDK - Core Client
 *
 * Unified TypeScript client for all REZ Intelligence services
 */

import type {
  IntelligenceClientConfig,
  ApiResponse,
  UserProfile,
  UserPrediction,
  UserSegment,
  IntentPrediction,
  Recommendation,
  Sequence,
  Habit,
  BehavioralTransition,
  UserContext,
  SignalAggregation,
  LocationContext,
  NearbyPlace,
  PredictionExplanation,
  DecisionResult,
  HealthCheckResult,
} from './types';
import logger from './utils/logger';

export class IntelligenceClient {
  private config: Required<IntelligenceClientConfig>;
  private baseUrl: string;

  constructor(config: IntelligenceClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost',
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTtl: config.cacheTtl || 60000,
    };
    this.baseUrl = this.config.baseUrl;
  }

  // ============================================
  // USER PROFILE
  // ============================================

  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await this.request<UserProfile>(`/api/profiles/${userId}`);
      return response;
    } catch (error) {
      logger.error('Failed to get user profile', { userId, error });
      return { success: false, error: 'Failed to fetch user profile' };
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await this.request<UserProfile>(`/api/profiles/${userId}`, {
        method: 'PUT',
        body: updates,
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to update user profile' };
    }
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  async predictChurn(userId: string): Promise<ApiResponse<UserPrediction>> {
    try {
      const response = await this.request<UserPrediction>(`/api/predict/churn/${userId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to predict churn' };
    }
  }

  async predictLTV(userId: string): Promise<ApiResponse<UserPrediction>> {
    try {
      const response = await this.request<UserPrediction>(`/api/predict/ltv/${userId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to predict LTV' };
    }
  }

  async predictNextPurchase(userId: string): Promise<ApiResponse<UserPrediction>> {
    try {
      const response = await this.request<UserPrediction>(`/api/predict/next-purchase/${userId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to predict next purchase' };
    }
  }

  // ============================================
  // INTENT
  // ============================================

  async predictIntent(userId: string, context?: UserContext): Promise<ApiResponse<IntentPrediction>> {
    try {
      const response = await this.request<IntentPrediction>('/api/intent/predict', {
        method: 'POST',
        body: { userId, context },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to predict intent' };
    }
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  async getRecommendations(userId: string, options?: {
    type?: string;
    limit?: number;
    context?: Record<string, unknown>;
  }): Promise<ApiResponse<Recommendation[]>> {
    try {
      const params = new URLSearchParams({ userId });
      if (options?.type) params.append('type', options.type);
      if (options?.limit) params.append('limit', String(options.limit));

      const response = await this.request<Recommendation[]>(`/api/recommendations?${params}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to get recommendations' };
    }
  }

  async getPersonalizedFeed(userId: string, limit = 20): Promise<ApiResponse<Recommendation[]>> {
    try {
      const response = await this.request<Recommendation[]>('/api/recommendations/feed', {
        method: 'POST',
        body: { userId, limit },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to get personalized feed' };
    }
  }

  // ============================================
  // SEGMENTS
  // ============================================

  async getUserSegments(userId: string): Promise<ApiResponse<UserSegment[]>> {
    try {
      const response = await this.request<UserSegment[]>(`/api/segments/user/${userId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to get user segments' };
    }
  }

  async getSegments(): Promise<ApiResponse<UserSegment[]>> {
    try {
      const response = await this.request<UserSegment[]>('/api/segments');
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to get segments' };
    }
  }

  // ============================================
  // TEMPORAL INTELLIGENCE
  // ============================================

  async analyzeSequence(entityId: string, events: { eventType: string; timestamp: Date }[]): Promise<ApiResponse<Sequence>> {
    try {
      const response = await this.request<Sequence>('/api/sequences', {
        method: 'POST',
        body: { entityId, events },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to analyze sequence' };
    }
  }

  async detectHabits(userId: string, events: { eventType: string; timestamp: Date }[]): Promise<ApiResponse<Habit[]>> {
    try {
      const response = await this.request<Habit[]>('/api/habits', {
        method: 'POST',
        body: { entityId: userId, entityType: 'user', events },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to detect habits' };
    }
  }

  async getLifecycle(userId: string): Promise<ApiResponse<{ currentStage: string; progression: number }>> {
    try {
      const response = await this.request<{ currentStage: string; progression: number }>(`/api/lifecycle/${userId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to get lifecycle' };
    }
  }

  // ============================================
  // SIGNALS
  // ============================================

  async getSignals(userId: string): Promise<ApiResponse<SignalAggregation>> {
    try {
      const response = await this.request<SignalAggregation>(`/api/signals/${userId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to get signals' };
    }
  }

  async trackEvent(userId: string, event: string, properties?: Record<string, unknown>): Promise<ApiResponse<void>> {
    try {
      const response = await this.request<void>('/api/events', {
        method: 'POST',
        body: { userId, event, properties, timestamp: new Date() },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to track event' };
    }
  }

  // ============================================
  // LOCATION
  // ============================================

  async getLocationContext(userId: string): Promise<ApiResponse<LocationContext>> {
    try {
      const response = await this.request<LocationContext>(`/api/location/context/${userId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to get location context' };
    }
  }

  async searchNearby(lat: number, lng: number, radius = 5000): Promise<ApiResponse<NearbyPlace[]>> {
    try {
      const response = await this.request<NearbyPlace[]>('/api/search/nearby', {
        method: 'POST',
        body: { location: { lat, lng }, radius },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to search nearby' };
    }
  }

  async predictLocation(userId: string): Promise<ApiResponse<{ location: { lat: number; lng: number }; probability: number }>> {
    try {
      const response = await this.request<{ location: { lat: number; lng: number }; probability: number }>(
        `/api/location/predict/${userId}`
      );
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to predict location' };
    }
  }

  // ============================================
  // EXPLAINABILITY
  // ============================================

  async explainPrediction(predictionId: string): Promise<ApiResponse<PredictionExplanation>> {
    try {
      const response = await this.request<PredictionExplanation>(`/api/explain/${predictionId}`);
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to explain prediction' };
    }
  }

  async explainUserChurn(userId: string): Promise<ApiResponse<PredictionExplanation>> {
    try {
      const response = await this.request<PredictionExplanation>('/api/explain', {
        method: 'POST',
        body: { entityType: 'user', entityId: userId, predictionType: 'churn' },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to explain churn prediction' };
    }
  }

  // ============================================
  // DECISIONS
  // ============================================

  async makeDecision(context: Record<string, unknown>, options: { id: string; name: string }[]): Promise<ApiResponse<DecisionResult>> {
    try {
      const response = await this.request<DecisionResult>('/api/decisions', {
        method: 'POST',
        body: { context, options },
      });
      return response;
    } catch (error) {
      return { success: false, error: 'Failed to make decision' };
    }
  }

  // ============================================
  // HEALTH
  // ============================================

  async healthCheck(): Promise<HealthCheckResult> {
    const services = [
      { name: 'intent' as const, url: '/api/intent/health' },
      { name: 'predictive' as const, url: '/api/predict/health' },
      { name: 'signal' as const, url: '/api/signals/health' },
      { name: 'temporal' as const, url: '/api/health' },
      { name: 'recommendation' as const, url: '/api/recommendations/health' },
    ];

    const results = await Promise.all(
      services.map(async (s) => {
        const start = Date.now();
        try {
          await this.request(`${s.url}`);
          return { name: s.name, status: 'healthy' as const, latency: Date.now() - start, uptime: 100, lastChecked: new Date() };
        } catch {
          return { name: s.name, status: 'degraded' as const, latency: Date.now() - start, uptime: 0, lastChecked: new Date() };
        }
      })
    );

    const healthyCount = results.filter(r => r.status === 'healthy').length;
    return {
      overall: healthyCount === results.length ? 'healthy' : healthyCount > 0 ? 'degraded' : 'unhealthy',
      services: results,
      timestamp: new Date(),
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json() as ApiResponse<T>;
      return json;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
}

// Export singleton factory
let clientInstance: IntelligenceClient | null = null;

export function getIntelligenceClient(config?: IntelligenceClientConfig): IntelligenceClient {
  if (!clientInstance) {
    clientInstance = new IntelligenceClient(config);
  }
  return clientInstance;
}

export default IntelligenceClient;

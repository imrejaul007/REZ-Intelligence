/**
 * REZ Intelligence SDK - Enhanced Client
 *
 * Unified TypeScript client for all REZ Intelligence services
 * Supports 3 client types: REZ_ECOSYSTEM, NON_REZ, RABTUL_SAAS
 */

import crypto from 'crypto';
import {
  type IntelligenceClientConfig,
  type ApiResponse,
  type UserProfile,
  type IntentPrediction,
  type Recommendation,
  type ChurnPrediction,
  type LTVPrediction,
  type Workflow,
  type Execution,
  type TimelineEvent,
  type TenantContext,
  type CreateWorkflowRequest,
  type CreateExecutionRequest,
  type IntentPredictRequest,
  type RecommendationRequest,
  type BatchIntentRequest,
  type TrackEventRequest,
  type ChurnPredictRequest,
  type LTVPredictRequest,
  type WorkflowList,
  type HealthResponse,
  type UserPreferences,
  type CreateTenantRequest,
  type TenantResponse,
  type PrivacyCheckRequest,
  type PrivacyCheckResponse,
  type KnowledgeEntry,
  type SearchRequest,
  ClientType,
  IntelligenceLevel,
  IntentCategory,
  ExecutionStatus,
  WorkflowStatus,
} from './types';

export * from './types';

export class REZIntelligenceClient {
  private config: Required<IntelligenceClientConfig>;
  private baseUrl: string;
  private tenantContext: TenantContext | null = null;

  constructor(config: IntelligenceClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:4300',
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      internalToken: config.internalToken || '',
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTtl: config.cacheTtl || 60000,
    };
    this.baseUrl = this.config.baseUrl;
  }

  // ============================================
  // AUTH & TENANT
  // ============================================

  /**
   * Set tenant context for the client
   */
  setTenantContext(tenant: TenantContext): void {
    this.tenantContext = tenant;
  }

  /**
   * Get current tenant context
   */
  getTenantContext(): TenantContext | null {
    return this.tenantContext;
  }

  // ============================================
  // INTENT PREDICTION
  // ============================================

  /**
   * Predict user intent from context signals
   */
  async predictIntent(request: IntentPredictRequest): Promise<ApiResponse<IntentPrediction>> {
    return this.request<IntentPrediction>('/api/intent/predict', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Batch predict intents for multiple users
   */
  async batchPredictIntent(request: BatchIntentRequest): Promise<ApiResponse<{ predictions: IntentPrediction[] }>> {
    return this.request('/api/intent/batch-predict', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Submit intent prediction feedback
   */
  async submitIntentFeedback(
    userId: string,
    predictedIntent: string,
    actualIntent: string
  ): Promise<ApiResponse<void>> {
    return this.request('/api/intent/feedback', {
      method: 'POST',
      body: { userId, predictedIntent, actualIntent },
    });
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(request: RecommendationRequest): Promise<ApiResponse<{ recommendations: Recommendation[] }>> {
    return this.request('/api/recommendations', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Get "For You Today" personalized feed
   */
  async getForYouFeed(
    userId: string,
    limit = 20
  ): Promise<ApiResponse<{ items: Recommendation[]; lastUpdated: string }>> {
    return this.request(`/api/recommendations/for-you?userId=${userId}&limit=${limit}`);
  }

  // ============================================
  // USER PROFILE
  // ============================================

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    return this.request(`/api/profile/${userId}`);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, 'displayName' | 'avatar' | 'preferences'>>
  ): Promise<ApiResponse<UserProfile>> {
    return this.request(`/api/profile/${userId}`, {
      method: 'PUT',
      body: updates,
    });
  }

  // ============================================
  // WORKFLOWS
  // ============================================

  /**
   * Create a new workflow
   */
  async createWorkflow(request: CreateWorkflowRequest): Promise<ApiResponse<Workflow>> {
    return this.request('/api/workflows', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * List workflows
   */
  async listWorkflows(page = 1, limit = 20): Promise<ApiResponse<WorkflowList>> {
    return this.request(`/api/workflows?page=${page}&limit=${limit}`);
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<ApiResponse<Workflow>> {
    return this.request(`/api/workflows/${workflowId}`);
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<CreateWorkflowRequest>
  ): Promise<ApiResponse<Workflow>> {
    return this.request(`/api/workflows/${workflowId}`, {
      method: 'PUT',
      body: updates,
    });
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/workflows/${workflowId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // EXECUTIONS
  // ============================================

  /**
   * Trigger workflow execution
   */
  async triggerExecution(request: CreateExecutionRequest): Promise<ApiResponse<Execution>> {
    return this.request('/api/executions', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<ApiResponse<Execution>> {
    return this.request(`/api/executions/${executionId}`);
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<ApiResponse<Execution>> {
    return this.request(`/api/executions/${executionId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Retry failed execution
   */
  async retryExecution(executionId: string): Promise<ApiResponse<Execution>> {
    return this.request(`/api/executions/${executionId}/retry`, {
      method: 'POST',
    });
  }

  // ============================================
  // EVENTS
  // ============================================

  /**
   * Track a user event
   */
  async trackEvent(request: TrackEventRequest): Promise<ApiResponse<{ eventId: string }>> {
    return this.request('/api/events', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Track batch of events
   */
  async trackBatchEvents(
    events: TrackEventRequest[]
  ): Promise<ApiResponse<{ processed: number; failed: number }>> {
    return this.request('/api/events/batch', {
      method: 'POST',
      body: { events },
    });
  }

  // ============================================
  // ML PREDICTIONS
  // ============================================

  /**
   * Predict churn probability
   */
  async predictChurn(request: ChurnPredictRequest): Promise<ApiResponse<ChurnPrediction>> {
    return this.request('/api/predict/churn', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Predict lifetime value
   */
  async predictLTV(request: LTVPredictRequest): Promise<ApiResponse<LTVPrediction>> {
    return this.request('/api/predict/ltv', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Predict revisit probability
   */
  async predictRevisit(userId: string): Promise<ApiResponse<{ probability: number; timeframe: string }>> {
    return this.request('/api/predict/revisit', {
      method: 'POST',
      body: { userId },
    });
  }

  // ============================================
  // TIMELINE
  // ============================================

  /**
   * Add timeline event
   */
  async addTimelineEvent(event: TimelineEvent): Promise<ApiResponse<{ eventId: string }>> {
    return this.request('/api/timeline/event', {
      method: 'POST',
      body: event,
    });
  }

  /**
   * Get user timeline
   */
  async getTimeline(
    userId: string,
    options?: { limit?: number; type?: string }
  ): Promise<ApiResponse<{ events: TimelineEvent[] }>> {
    const params = new URLSearchParams({ userId });
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.type) params.append('type', options.type);

    return this.request(`/api/timeline?${params}`);
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<ApiResponse<UserPreferences>> {
    return this.request(`/api/preferences/${userId}`);
  }

  // ============================================
  // KNOWLEDGE GRAPH
  // ============================================

  /**
   * Search knowledge base
   */
  async searchKnowledge(request: SearchRequest): Promise<ApiResponse<{ results: KnowledgeEntry[] }>> {
    return this.request('/api/knowledge/search', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Add knowledge entry
   */
  async addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id'>): Promise<ApiResponse<KnowledgeEntry>> {
    return this.request('/api/knowledge/entries', {
      method: 'POST',
      body: entry,
    });
  }

  // ============================================
  // PRIVACY
  // ============================================

  /**
   * Check cross-tenant data access
   */
  async canAccessData(request: PrivacyCheckRequest): Promise<ApiResponse<PrivacyCheckResponse>> {
    return this.request('/api/privacy/can-access', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Check if intent can be shared
   */
  async canShareIntent(
    userId: string,
    intent: string,
    confidence: number
  ): Promise<ApiResponse<PrivacyCheckResponse>> {
    return this.request('/api/privacy/can-share-intent', {
      method: 'POST',
      body: { userId, intent, confidence },
    });
  }

  /**
   * Filter data based on privacy settings
   */
  async filterByPrivacy(data: Record<string, unknown>): Promise<ApiResponse<{ filtered: Record<string, unknown> }>> {
    return this.request('/api/privacy/filter', {
      method: 'POST',
      body: data,
    });
  }

  // ============================================
  // TENANT MANAGEMENT (Admin only)
  // ============================================

  /**
   * Create a new tenant
   */
  async createTenant(request: CreateTenantRequest): Promise<ApiResponse<TenantResponse>> {
    return this.request('/api/tenants', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * List tenants
   */
  async listTenants(clientType?: ClientType): Promise<ApiResponse<{ tenants: TenantResponse[] }>> {
    const url = clientType ? `/api/tenants?clientType=${clientType}` : '/api/tenants';
    return this.request(url);
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<ApiResponse<TenantResponse>> {
    return this.request(`/api/tenants/${tenantId}`);
  }

  // ============================================
  // HEALTH
  // ============================================

  /**
   * Health check
   */
  async healthCheck(): Promise<ApiResponse<HealthResponse>> {
    return this.request('/health');
  }

  /**
   * Get all service statuses
   */
  async getServiceStatuses(): Promise<ApiResponse<{ services: Record<string, 'healthy' | 'degraded' | 'unhealthy'> }>> {
    return this.request('/api/services');
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown }
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': this.generateRequestId(),
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    if (this.config.internalToken) {
      headers['X-Internal-Token'] = this.config.internalToken;
    }

    if (this.tenantContext) {
      headers['X-Tenant-ID'] = this.tenantContext.tenantId;
      headers['X-Client-Type'] = this.tenantContext.clientType;
    }

    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          code: errorBody.error?.code || `HTTP_${response.status}`,
        } as ApiResponse<T>;
      }

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            code: 'TIMEOUT',
          } as ApiResponse<T>;
        }
        return {
          success: false,
          error: error.message,
          code: 'NETWORK_ERROR',
        } as ApiResponse<T>;
      }

      return {
        success: false,
        error: 'Unknown error',
        code: 'UNKNOWN',
      } as ApiResponse<T>;
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

let clientInstance: REZIntelligenceClient | null = null;

export function getIntelligenceClient(config?: IntelligenceClientConfig): REZIntelligenceClient {
  if (!clientInstance) {
    clientInstance = new REZIntelligenceClient(config);
  }
  return clientInstance;
}

export function createIntelligenceClient(config: IntelligenceClientConfig): REZIntelligenceClient {
  return new REZIntelligenceClient(config);
}

// ============================================
// RE-EXPORTS FROM TYPES
// ============================================

export {
  ClientType,
  IntelligenceLevel,
  IntentCategory,
  ExecutionStatus,
  WorkflowStatus,
};

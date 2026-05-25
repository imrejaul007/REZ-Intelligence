/**
 * REZ Care - Ecosystem Services Integration
 *
 * Connects to REZ infrastructure services:
 * - REZ-memory-layer (4201) - Customer Timeline
 * - REZ-unified-profile (4060) - Unified Profile
 * - REZ-workflow-builder (4045) - Automation Workflows
 * - Vector Search - RAG/Knowledge Base
 *
 * Updated: May 21, 2026
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// ============================================
// SERVICE URLs
// ============================================

const MEMORY_LAYER_URL = process.env.REZ_MEMORY_URL || 'http://localhost:4201';
const UNIFIED_PROFILE_URL = process.env.REZ_UNIFIED_PROFILE_URL || 'http://localhost:4060';
const WORKFLOW_BUILDER_URL = process.env.REZ_WORKFLOW_URL || 'http://localhost:4045';
const VECTOR_SEARCH_URL = process.env.VECTOR_SEARCH_URL || 'http://localhost:4127';

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

// ============================================
// TYPES
// ============================================

// Customer Timeline Event
export interface TimelineEvent {
  id?: string;
  customerId: string;
  eventType: 'ticket' | 'chat' | 'refund' | 'payment' | 'order' | 'loyalty' | 'delivery' | 'support' | 'compensation';
  source: string;
  timestamp?: Date;
  data: Record<string, unknown>;
  sentiment?: number;
  intent?: string;
  category?: string;
}

// Unified Profile
export interface UnifiedCustomerProfile {
  customerId: string;
  identity: {
    email?: string;
    phone?: string;
    name?: string;
  };
  segments: string[];
  signalScores: {
    engagement: number;
    loyalty: number;
    risk: number;
  };
  lifetimeMetrics: {
    ltv: number;
    orders: number;
    avgOrderValue: number;
  };
  churnRisk?: number;
  sentiment?: number;
  lastActivity?: Date;
}

// Workflow
export interface WorkflowTrigger {
  workflowName: string;
  customerId: string;
  data?: Record<string, unknown>;
}

// Vector Search
export interface KnowledgeSearchResult {
  id: string;
  content: string;
  title: string;
  category: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// MEMORY LAYER SERVICE
// ============================================

class MemoryLayerService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: MEMORY_LAYER_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });
  }

  /**
   * Add event to customer timeline
   */
  async addToTimeline(event: TimelineEvent): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const response = await this.client.post('/api/timeline', {
        ...event,
        timestamp: event.timestamp || new Date(),
      });

      logger.info('[Memory] Added event to timeline', {
        customerId: event.customerId,
        eventType: event.eventType,
      });

      return { success: true, eventId: response.data.eventId };
    } catch (error) {
      logger.error('[Memory] Failed to add timeline event', {
        customerId: event.customerId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get customer timeline
   */
  async getTimeline(
    customerId: string,
    options?: { limit?: number; type?: string; startDate?: Date; endDate?: Date }
  ): Promise<{ events: TimelineEvent[]; error?: string }> {
    try {
      const response = await this.client.get(`/api/timeline/${customerId}`, {
        params: options,
      });

      return { events: response.data.events || [] };
    } catch (error) {
      logger.error('[Memory] Failed to get timeline', {
        customerId,
        error: error.message,
      });
      return { events: [], error: error.message };
    }
  }

  /**
   * Get timeline summary (aggregated)
   */
  async getTimelineSummary(customerId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    lastActivity?: Date;
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/timeline/${customerId}/summary`);
      return response.data;
    } catch (error) {
      return { total: 0, byType: {}, error: error.message };
    }
  }

  /**
   * Detect patterns in customer journey
   */
  async detectPatterns(customerId: string): Promise<{
    patterns: string[];
    insights: string[];
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/timeline/${customerId}/patterns`);
      return response.data;
    } catch (error) {
      return { patterns: [], insights: [], error: error.message };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// ============================================
// UNIFIED PROFILE SERVICE
// ============================================

class UnifiedProfileService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: UNIFIED_PROFILE_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });
  }

  /**
   * Get unified customer profile
   */
  async getProfile(customerId: string): Promise<{
    profile: UnifiedCustomerProfile | null;
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/profiles/${customerId}`);

      const profile: UnifiedCustomerProfile = {
        customerId: response.data.customerId || customerId,
        identity: response.data.identity || {},
        segments: response.data.segments || [],
        signalScores: response.data.signalScores || { engagement: 0, loyalty: 0, risk: 0 },
        lifetimeMetrics: response.data.lifetimeMetrics || { ltv: 0, orders: 0, avgOrderValue: 0 },
        churnRisk: response.data.churnRisk,
        sentiment: response.data.sentiment,
        lastActivity: response.data.lastActivity,
      };

      return { profile };
    } catch (error) {
      logger.error('[Profile] Failed to get unified profile', {
        customerId,
        error: error.message,
      });
      return { profile: null, error: error.message };
    }
  }

  /**
   * Update customer profile
   */
  async updateProfile(customerId: string, updates: Partial<UnifiedCustomerProfile>): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.client.patch(`/api/profiles/${customerId}`, updates);
      return { success: true };
    } catch (error) {
      logger.error('[Profile] Failed to update profile', {
        customerId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get customer segments
   */
  async getSegments(customerId: string): Promise<{
    segments: string[];
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/profiles/${customerId}/segments`);
      return { segments: response.data.segments || [] };
    } catch (error) {
      return { segments: [], error: error.message };
    }
  }

  /**
   * Get signal scores
   */
  async getSignalScores(customerId: string): Promise<{
    scores: UnifiedCustomerProfile['signalScores'];
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/profiles/${customerId}/signals`);
      return { scores: response.data || { engagement: 0, loyalty: 0, risk: 0 } };
    } catch (error) {
      return { scores: { engagement: 0, loyalty: 0, risk: 0 }, error: error.message };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// ============================================
// WORKFLOW BUILDER SERVICE
// ============================================

class WorkflowBuilderService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: WORKFLOW_BUILDER_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });
  }

  /**
   * Trigger workflow by name
   */
  async triggerWorkflow(workflowName: string, customerId: string, data?: Record<string, unknown>): Promise<{
    success: boolean;
    executionId?: string;
    error?: string;
  }> {
    try {
      const response = await this.client.post(`/api/workflows/${workflowName}/trigger`, {
        customerId,
        ...data,
      });

      logger.info('[Workflow] Triggered workflow', {
        workflowName,
        customerId,
        executionId: response.data.executionId,
      });

      return { success: true, executionId: response.data.executionId };
    } catch (error) {
      logger.error('[Workflow] Failed to trigger', {
        workflowName,
        customerId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(executionId: string): Promise<{
    status: string;
    result?;
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/workflows/executions/${executionId}`);
      return { status: response.data.status, result: response.data.result };
    } catch (error) {
      return { status: 'unknown', error: error.message };
    }
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(executionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post(`/api/workflows/executions/${executionId}/cancel`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// ============================================
// VECTOR SEARCH SERVICE (RAG)
// ============================================

class VectorSearchService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: VECTOR_SEARCH_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });
  }

  /**
   * Semantic search for knowledge base
   */
  async semanticSearch(
    query: string,
    options?: { limit?: number; category?: string; threshold?: number }
  ): Promise<{
    results: KnowledgeSearchResult[];
    error?: string;
  }> {
    try {
      const response = await this.client.post('/api/search', {
        query,
        limit: options?.limit || 5,
        filters: options?.category ? { category: options.category } : undefined,
        threshold: options?.threshold || 0.7,
      });

      return { results: response.data.results || [] };
    } catch (error) {
      logger.error('[Vector] Semantic search failed', {
        query,
        error: error.message,
      });
      return { results: [], error: error.message };
    }
  }

  /**
   * Index document for RAG
   */
  async indexDocument(document: {
    id: string;
    title: string;
    content: string;
    category: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post('/api/documents', document);
      return { success: true };
    } catch (error) {
      logger.error('[Vector] Index failed', {
        docId: document.id,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get relevant context for AI
   */
  async getRAGContext(
    query: string,
    customerId?: string
  ): Promise<{
    context: string;
    sources: string[];
    error?: string;
  }> {
    try {
      const response = await this.client.post('/api/rag/context', {
        query,
        customerId,
      });

      return {
        context: response.data.context || '',
        sources: response.data.sources || [],
      };
    } catch (error) {
      return { context: '', sources: [], error: error.message };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

export const memoryLayer = new MemoryLayerService();
export const unifiedProfile = new UnifiedProfileService();
export const workflowBuilder = new WorkflowBuilderService();
export const vectorSearch = new VectorSearchService();

// ============================================
// UNIFIED CUSTOMER ENRICHMENT
// ============================================

/**
 * Get enriched customer data combining all services
 */
export async function enrichCustomerContext(
  customerId: string,
  supportContext?: { ticketId?: string; message?: string }
): Promise<{
  profile: UnifiedCustomerProfile | null;
  timeline: TimelineEvent[];
  patterns: string[];
  ragContext?: string;
  error?: string;
}> {
  // Parallel fetch all data
  const [profileResult, timelineResult, patternsResult] = await Promise.all([
    unifiedProfile.getProfile(customerId),
    memoryLayer.getTimeline(customerId, { limit: 20 }),
    memoryLayer.detectPatterns(customerId),
  ]);

  // Get RAG context if support context provided
  let ragContext: string | undefined;
  if (supportContext?.message) {
    const ragResult = await vectorSearch.getRAGContext(supportContext.message, customerId);
    ragContext = ragResult.context;
  }

  return {
    profile: profileResult.profile,
    timeline: timelineResult.events,
    patterns: patternsResult.patterns,
    ragContext,
    error: profileResult.error || timelineResult.error,
  };
}

/**
 * Record support interaction to timeline
 */
export async function recordSupportInteraction(
  customerId: string,
  interaction: {
    type: 'ticket' | 'chat' | 'refund' | 'compensation';
    data: Record<string, unknown>;
    sentiment?: number;
    intent?: string;
    category?: string;
  }
): Promise<void> {
  await memoryLayer.addToTimeline({
    customerId,
    eventType: interaction.type,
    source: 'REZ-care',
    data: interaction.data,
    sentiment: interaction.sentiment,
    intent: interaction.intent,
    category: interaction.category,
  });
}

/**
 * Trigger support workflow automation
 */
export async function triggerSupportWorkflow(
  workflowName: string,
  customerId: string,
  context: {
    ticketId?: string;
    category?: string;
    sentiment?: number;
    ltv?: number;
    churnRisk?: number;
  }
): Promise<{ success: boolean; executionId?: string }> {
  return workflowBuilder.triggerWorkflow(workflowName, customerId, context);
}

/**
 * Get AI-suggested response using RAG
 */
export async function getAISuggestedResponse(
  customerId: string,
  ticketContext: {
    message: string;
    category: string;
    sentiment?: number;
  }
): Promise<{
  suggestion: string;
  sources: string[];
  confidence: number;
}> {
  // Get RAG context
  const ragResult = await vectorSearch.getRAGContext(ticketContext.message, customerId);

  // Get customer profile for context
  const profileResult = await unifiedProfile.getProfile(customerId);

  // Build enriched prompt context
  const context = `
Customer Profile:
- Segments: ${profileResult.profile?.segments.join(', ') || 'Unknown'}
- LTV: ₹${profileResult.profile?.lifetimeMetrics?.ltv || 0}
- Churn Risk: ${profileResult.profile?.churnRisk ? 'High' : 'Normal'}

Ticket Context:
- Category: ${ticketContext.category}
- Sentiment: ${ticketContext.sentiment || 'neutral'}
- Message: ${ticketContext.message}

Relevant Knowledge:
${ragResult.context || 'No specific knowledge found.'}
  `.trim();

  // In production, this would call Claude/GPT with the context
  // For now, return structured suggestion
  return {
    suggestion: ragResult.context || 'Based on the customer context and knowledge base.',
    sources: ragResult.sources,
    confidence: ragResult.sources.length > 0 ? 0.85 : 0.5,
  };
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkAllServicesHealth(): Promise<Record<string, boolean>> {
  const [memory, profile, workflow, vector] = await Promise.all([
    memoryLayer.healthCheck().catch(() => false),
    unifiedProfile.healthCheck().catch(() => false),
    workflowBuilder.healthCheck().catch(() => false),
    vectorSearch.healthCheck().catch(() => false),
  ]);

  return {
    'memory-layer': memory,
    'unified-profile': profile,
    'workflow-builder': workflow,
    'vector-search': vector,
  };
}

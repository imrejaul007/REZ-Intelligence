/**
 * REZ Care Service - Service Integrations
 *
 * INTEGRATES with existing services instead of duplicating.
 *
 * Existing services we use:
 * - REZ-support-copilot (4033) - Sentiment, history, AI suggestions
 * - REZ-merchant-intelligence (4122) - Merchant insights
 * - rez-knowledge-base-service (4005) - KB search
 *
 * Unique value we add:
 * - CSAT surveys & tracking
 * - Proactive issue detection
 * - Self-service recovery
 * - Auto-ticket creation
 * - Merchant communication
 * - Cross-platform issue memory
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// Service URLs from environment
const SERVICES = {
  supportCopilot: {
    url: process.env.SUPPORT_COPILOT_URL || 'http://localhost:4033',
    token: process.env.INTERNAL_SERVICE_TOKEN,
  },
  merchantIntelligence: {
    url: process.env.MERCHANT_INTELLIGENCE_URL || 'http://localhost:4122',
    token: process.env.INTERNAL_SERVICE_TOKEN,
  },
  knowledgeBase: {
    url: process.env.KB_SERVICE_URL || 'http://localhost:4005',
    token: process.env.INTERNAL_SERVICE_TOKEN,
  },
};

interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function callService<T>(
  serviceName: keyof typeof SERVICES,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: Record<string, any>;
    params?: Record<string, string>;
  } = {}
): Promise<ServiceResponse<T>> {
  const service = SERVICES[serviceName];
  const { method = 'GET', body, params } = options;

  try {
    const url = new URL(path, service.url);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await axios({
      method,
      url: url.toString(),
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': service.token || '',
      },
      timeout: 10000,
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    logger.warn(`Service ${serviceName} call failed: ${path}`, {
      error: error.message,
      status: error.response?.status,
    });
    return { success: false, error: error.message };
  }
}

// ============================================
// SUPPORT COPILOT INTEGRATIONS
// ============================================

/**
 * Get user support history from REZ-support-copilot
 */
export async function getSupportHistory(userId: string): Promise<{
  totalTickets: number;
  openTickets: number;
  avgResolutionTime: number;
  sentiment: string;
  lastTicket?: any;
}> {
  const result = await callService('supportCopilot', `/user/${userId}/history`);

  if (result.success && result.data) {
    const data = result.data as any;
    return {
      totalTickets: data.totalTickets || 0,
      openTickets: data.openTickets || 0,
      avgResolutionTime: data.avgResolutionTime || 0,
      sentiment: data.sentiment || 'neutral',
      lastTicket: data.lastTicket,
    };
  }

  // Return defaults if service unavailable
  return {
    totalTickets: 0,
    openTickets: 0,
    avgResolutionTime: 0,
    sentiment: 'neutral',
  };
}

/**
 * Get AI suggestions for a ticket from REZ-support-copilot
 */
export async function getTicketSuggestions(ticketId: string): Promise<{
  suggestions: string[];
  similarTickets: any[];
}> {
  const result = await callService('supportCopilot', `/ticket/${ticketId}/suggestions`);

  if (result.success && result.data) {
    const data = result.data as any;
    return {
      suggestions: data.suggestions || [],
      similarTickets: data.similarTickets || [],
    };
  }

  return { suggestions: [], similarTickets: [] };
}

/**
 * Get sentiment analysis from REZ-support-copilot
 */
export async function getSentimentAnalysis(text: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  keywords: string[];
}> {
  const result = await callService<{
    sentiment: string;
    score: number;
    keywords: string[];
  }>('supportCopilot', '/analyze/sentiment', {
    method: 'POST',
    body: { text },
  });

  if (result.success && result.data) {
    return {
      sentiment: result.data.sentiment as any,
      score: result.data.score || 3,
      keywords: result.data.keywords || [],
    };
  }

  return { sentiment: 'neutral', score: 3, keywords: [] };
}

/**
 * Get support analytics from REZ-support-copilot
 */
export async function getSupportAnalytics(): Promise<{
  totalTickets: number;
  openTickets: number;
  resolvedToday: number;
  avgResolutionTime: number;
  sentimentBreakdown: Record<string, number>;
}> {
  const result = await callService<{
    totalTickets: number;
    openTickets: number;
    resolvedToday: number;
    avgResolutionTime: number;
    sentimentBreakdown: Record<string, number>;
  }>('supportCopilot', '/analytics');

  if (result.success && result.data) {
    return result.data;
  }

  return {
    totalTickets: 0,
    openTickets: 0,
    resolvedToday: 0,
    avgResolutionTime: 0,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
  };
}

// ============================================
// MERCHANT INTELLIGENCE INTEGRATIONS
// ============================================

/**
 * Get merchant dashboard from REZ-merchant-intelligence
 */
export async function getMerchantDashboard(merchantId: string): Promise<{
  overview: {
    totalCustomers: number;
    monthlyRevenue: number;
    repeatRate: number;
  };
  segments: Record<string, number>;
  predictions: any;
  recommendations: any[];
}> {
  const result = await callService('merchantIntelligence', `/merchant/${merchantId}/dashboard`);

  if (result.success && result.data) {
    return result.data as any;
  }

  return {
    overview: { totalCustomers: 0, monthlyRevenue: 0, repeatRate: 0 },
    segments: {},
    predictions: null,
    recommendations: [],
  };
}

/**
 * Get merchant customer list from REZ-merchant-intelligence
 */
export async function getMerchantCustomers(merchantId: string, options?: {
  limit?: number;
  segment?: string;
}): Promise<{
  customers: any[];
  total: number;
}> {
  const result = await callService<{ customers: any[]; total: number }>(
    'merchantIntelligence',
    `/merchant/${merchantId}/customers`,
    { params: options as Record<string, string> }
  );

  if (result.success && result.data) {
    return result.data;
  }

  return { customers: [], total: 0 };
}

/**
 * Get customer predictions for a merchant
 */
export async function getCustomerPredictions(merchantId: string, customerId: string): Promise<{
  churnRisk: number;
  repeatLikelihood: number;
  ltvTier: string;
}> {
  const result = await callService<{
    churnRisk: number;
    repeatLikelihood: number;
    ltvTier: string;
  }>('merchantIntelligence', `/merchant/${merchantId}/customers/${customerId}/predictions`);

  if (result.success && result.data) {
    return result.data;
  }

  return { churnRisk: 0, repeatLikelihood: 0, ltvTier: 'standard' };
}

/**
 * Get merchant recommendations
 */
export async function getMerchantRecommendations(merchantId: string): Promise<{
  recommendations: any[];
  priority: string[];
}> {
  const result = await callService<{ recommendations: any[]; priority: string[] }>(
    'merchantIntelligence',
    `/merchant/${merchantId}/recommendations`
  );

  if (result.success && result.data) {
    return result.data;
  }

  return { recommendations: [], priority: [] };
}

// ============================================
// KNOWLEDGE BASE INTEGRATIONS
// ============================================

/**
 * Search knowledge base
 */
export async function searchKnowledgeBase(query: string, options?: {
  category?: string;
  limit?: number;
}): Promise<{
  articles: any[];
  suggestions: string[];
}> {
  const result = await callService<{ articles: any[]; suggestions: string[] }>(
    'knowledgeBase',
    '/search',
    { params: { q: query, limit: options.limit, category: options.category } as any }
  );

  if (result.success && result.data) {
    return result.data;
  }

  return { articles: [], suggestions: [] };
}

/**
 * Get KB article
 */
export async function getKBArticle(articleId: string): Promise<any | null> {
  const result = await callService('knowledgeBase', `/articles/${articleId}`);

  if (result.success && result.data) {
    return result.data;
  }

  return null;
}

/**
 * Get FAQ for category
 */
export async function getFAQs(category: string): Promise<{
  faqs: any[];
}> {
  const result = await callService<{ faqs: any[] }>('knowledgeBase', `/faq/${category}`);

  if (result.success && result.data) {
    return result.data;
  }

  return { faqs: [] };
}

/**
 * Get merchant KB
 */
export async function getMerchantKB(merchantId: string): Promise<{
  faqs: any[];
  policies: any[];
  menu: any;
}> {
  const result = await callService<{
    faqs: any[];
    policies: any[];
    menu: any;
  }>('knowledgeBase', `/merchants/${merchantId}`);

  if (result.success && result.data) {
    return result.data;
  }

  return { faqs: [], policies: [], menu: null };
}

// ============================================
// UNIFIED CUSTOMER VIEW (Aggregates All Services)
// ============================================

/**
 * Get unified customer view by integrating all services
 */
export async function getUnifiedCustomerView(customerId: string, phone?: string): Promise<{
  support: {
    totalTickets: number;
    openTickets: number;
    sentiment: string;
  };
  merchantInsights: {
    totalMerchants: number;
    repeatMerchants: number;
  };
  kbSuggestions: any[];
}> {
  const [supportHistory, merchantCustomers, kbSearch] = await Promise.all([
    phone ? getSupportHistory(phone) : Promise.resolve({ totalTickets: 0, openTickets: 0, avgResolutionTime: 0, sentiment: 'neutral' }),
    // Note: Would need merchant ID list for full integration
    Promise.resolve({ customers: [], total: 0 }),
    searchKnowledgeBase(customerId).catch(() => ({ articles: [], suggestions: [] })),
  ]);

  return {
    support: {
      totalTickets: supportHistory.totalTickets,
      openTickets: supportHistory.openTickets,
      sentiment: supportHistory.sentiment,
    },
    merchantInsights: {
      totalMerchants: merchantCustomers.total,
      repeatMerchants: 0, // Would calculate from customer list
    },
    kbSuggestions: kbSearch.articles.slice(0, 3),
  };
}

// ============================================
// SERVICE HEALTH CHECK
// ============================================

/**
 * Check health of all integrated services
 */
export async function checkServiceHealth(): Promise<{
  supportCopilot: boolean;
  merchantIntelligence: boolean;
  knowledgeBase: boolean;
}> {
  const [copilot, merchant, kb] = await Promise.all([
    callService('supportCopilot', '/health').then(r => r.success).catch(() => false),
    callService('merchantIntelligence', '/health').then(r => r.success).catch(() => false),
    callService('knowledgeBase', '/health').then(r => r.success).catch(() => false),
  ]);

  return {
    supportCopilot: copilot,
    merchantIntelligence: merchant,
    knowledgeBase: kb,
  };
}

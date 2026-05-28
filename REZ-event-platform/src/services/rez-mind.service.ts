/**
 * ReZ Mind AI Integration Service
 * Handles all AI/ML analysis calls to the ReZ Mind platform
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger.js';

// ReZ Mind API configuration
const REZ_MIND_BASE_URL = process.env.REZ_MIND_ENDPOINT || 'https://rezmind.rezapp.com';
const REZ_MIND_API_KEY = process.env.REZ_MIND_API_KEY;
const REZ_MIND_TIMEOUT = parseInt(process.env.REZ_MIND_TIMEOUT || '10000', 10); // 10 seconds default
const REZ_MIND_RETRY_ATTEMPTS = parseInt(process.env.REZ_MIND_RETRY_ATTEMPTS || '2', 10);

// Request timeout configuration
const TIMEOUT_CONFIG = {
  timeout: REZ_MIND_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    ...(REZ_MIND_API_KEY && { 'Authorization': `Bearer ${REZ_MIND_API_KEY}` }),
  },
};

interface RezMindResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: boolean;
}

/**
 * Create axios instance with retry logic
 */
function createRezMindClient(): AxiosInstance {
  const client = axios.create({
    baseURL: REZ_MIND_BASE_URL,
    ...TIMEOUT_CONFIG,
  });

  // Request interceptor for logging
  client.interceptors.request.use(
    (config) => {
      logger.debug('ReZ Mind API request', {
        url: config.url,
        method: config.method,
      });
      return config;
    },
    (error) => {
      logger.error('ReZ Mind request error', { error: error.message });
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };

      // Retry logic for specific errors
      if (
        originalRequest &&
        !originalRequest._retryCount &&
        (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.response?.status === 503)
      ) {
        originalRequest._retryCount = 1;
        while (originalRequest._retryCount < REZ_MIND_RETRY_ATTEMPTS) {
          originalRequest._retryCount++;
          try {
            logger.info('ReZ Mind API retry', {
              attempt: originalRequest._retryCount,
              url: originalRequest.url,
            });
            const response = await axios(originalRequest);
            return response;
          } catch (retryError) {
            if (originalRequest._retryCount >= REZ_MIND_RETRY_ATTEMPTS) {
              throw retryError;
            }
          }
        }
      }
      throw error;
    }
  );

  return client;
}

const rezMindClient = createRezMindClient();

/**
 * Generic API call wrapper with fallback
 */
async function callRezMind<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  fallbackValue: T
): Promise<RezMindResponse<T>> {
  if (!REZ_MIND_API_KEY) {
    logger.warn('ReZ Mind API key not configured, using fallback');
    return { success: false, data: fallbackValue, error: 'API key not configured', fallback: true };
  }

  try {
    const response = await rezMindClient.post<T>(endpoint, payload);
    logger.info('ReZ Mind API success', { endpoint });
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.error('ReZ Mind API error', {
      endpoint,
      error: axiosError.message,
      code: axiosError.code,
      status: axiosError.response?.status,
    });

    // Return fallback value on error
    return {
      success: false,
      data: fallbackValue,
      error: axiosError.message,
      fallback: true,
    };
  }
}

// ============================================
// INVENTORY ANALYSIS
// ============================================

export interface InventoryAnalysisInput {
  inventoryId: string;
  productId: string;
  productName: string;
  currentQuantity: number;
  threshold: number;
  warehouseId?: string;
  sku?: string;
  supplierId?: string;
  suggestedReorderQuantity?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventTimestamp: string;
}

export interface InventoryAnalysisResult {
  predictedRestockDate: string;
  recommendedReorderQuantity: number;
  confidence: number;
  leadTimeDays: number;
  seasonalFactor: number;
  recommendations: string[];
  urgency: 'immediate' | 'soon' | 'normal';
  alternativeProducts?: string[];
  supplierRecommendation?: string;
}

const INVENTORY_ANALYSIS_FALLBACK: InventoryAnalysisResult = {
  predictedRestockDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  recommendedReorderQuantity: 100,
  confidence: 0,
  leadTimeDays: 7,
  seasonalFactor: 1.0,
  recommendations: ['Monitor inventory levels', 'Contact supplier for restock'],
  urgency: 'soon',
};

/**
 * Analyze inventory patterns and predict restocking needs
 */
export async function analyzeInventoryPatterns(
  input: InventoryAnalysisInput
): Promise<RezMindResponse<InventoryAnalysisResult>> {
  logger.info('Analyzing inventory patterns with ReZ Mind', {
    inventoryId: input.inventoryId,
    productName: input.productName,
    currentQuantity: input.currentQuantity,
    threshold: input.threshold,
  });

  const payload = {
    event_type: 'inventory.low',
    inventory_id: input.inventoryId,
    product_id: input.productId,
    product_name: input.productName,
    current_quantity: input.currentQuantity,
    threshold: input.threshold,
    warehouse_id: input.warehouseId,
    sku: input.sku,
    supplier_id: input.supplierId,
    suggested_reorder_quantity: input.suggestedReorderQuantity,
    severity: input.severity,
    timestamp: input.eventTimestamp,
  };

  return callRezMind<InventoryAnalysisResult>(
    '/api/v1/ai/inventory/analyze',
    payload,
    {
      ...INVENTORY_ANALYSIS_FALLBACK,
      recommendedReorderQuantity: input.suggestedReorderQuantity || Math.max(input.threshold * 2, 50),
    }
  );
}

// ============================================
// ORDER ANALYSIS
// ============================================

export interface OrderAnalysisInput {
  orderId: string;
  customerId: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  paymentMethod: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  eventTimestamp: string;
}

export interface OrderAnalysisResult {
  customerSegment: string;
  lifetimeValueImpact: number;
  churnRisk: 'low' | 'medium' | 'high';
  crossSellRecommendations: string[];
  nextBestAction: string;
  fulfillmentPriority: 'standard' | 'express' | 'priority';
  deliveryEstimate: string;
  fraudRisk: number;
  confidence: number;
}

const ORDER_ANALYSIS_FALLBACK: OrderAnalysisResult = {
  customerSegment: 'standard',
  lifetimeValueImpact: 0,
  churnRisk: 'low',
  crossSellRecommendations: [],
  nextBestAction: 'order_confirmation',
  fulfillmentPriority: 'standard',
  deliveryEstimate: '5-7 business days',
  fraudRisk: 0,
  confidence: 0,
};

/**
 * Analyze order patterns and update customer profiles
 */
export async function analyzeOrderPatterns(
  input: OrderAnalysisInput
): Promise<RezMindResponse<OrderAnalysisResult>> {
  logger.info('Analyzing order patterns with ReZ Mind', {
    orderId: input.orderId,
    customerId: input.customerId,
    total: input.total,
    itemCount: input.items.length,
  });

  const payload = {
    event_type: 'order.completed',
    order_id: input.orderId,
    customer_id: input.customerId,
    items: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    shipping: input.shipping,
    total: input.total,
    currency: input.currency,
    payment_method: input.paymentMethod,
    shipping_address: input.shippingAddress,
    timestamp: input.eventTimestamp,
  };

  return callRezMind<OrderAnalysisResult>(
    '/api/v1/ai/commerce/order-analyze',
    payload,
    {
      ...ORDER_ANALYSIS_FALLBACK,
      lifetimeValueImpact: input.total,
    }
  );
}

// ============================================
// PAYMENT ANALYSIS
// ============================================

export interface PaymentAnalysisInput {
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: string;
  transactionId: string;
  gateway: string;
  eventTimestamp: string;
}

export interface PaymentAnalysisResult {
  fraudScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  fraudIndicators: string[];
  recommendedAction: 'approve' | 'review' | 'reject';
  creditScoreImpact: number;
  anomalyScore: number;
  velocityCheck: {
    passed: boolean;
    transactionsLastHour: number;
    maxAllowed: number;
  };
  geoAnomaly: boolean;
  confidence: number;
}

const PAYMENT_ANALYSIS_FALLBACK: PaymentAnalysisResult = {
  fraudScore: 0,
  riskLevel: 'low',
  fraudIndicators: [],
  recommendedAction: 'approve',
  creditScoreImpact: 0,
  anomalyScore: 0,
  velocityCheck: { passed: true, transactionsLastHour: 0, maxAllowed: 10 },
  geoAnomaly: false,
  confidence: 0,
};

/**
 * Analyze payment for fraud detection and risk assessment
 */
export async function analyzePaymentRisk(
  input: PaymentAnalysisInput
): Promise<RezMindResponse<PaymentAnalysisResult>> {
  logger.info('Analyzing payment risk with ReZ Mind', {
    paymentId: input.paymentId,
    orderId: input.orderId,
    customerId: input.customerId,
    amount: input.amount,
    currency: input.currency,
  });

  const payload = {
    event_type: 'payment.success',
    payment_id: input.paymentId,
    order_id: input.orderId,
    customer_id: input.customerId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    transaction_id: input.transactionId,
    gateway: input.gateway,
    timestamp: input.eventTimestamp,
  };

  return callRezMind<PaymentAnalysisResult>(
    '/api/v1/ai/fraud/analyze',
    payload,
    PAYMENT_ANALYSIS_FALLBACK
  );
}

// ============================================
// AD/GROWTH EVENT ANALYSIS
// ============================================

export interface AdAnalysisInput {
  eventType: 'impression' | 'click' | 'conversion';
  adId: string;
  campaignId: string;
  merchantId: string;
  userId?: string;
  placement?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  platform?: string;
  location?: string;
  value?: number;
  currency?: string;
  eventTimestamp: string;
}

export interface AdAnalysisResult {
  engagementScore: number;
  targetAudienceMatch: number;
  roiProjection: number;
  attributionScore: number;
  conversionProbability: number;
  recommendedBid: number;
  nextBestChannel: string;
  audienceSegment: string;
  confidence: number;
}

const AD_ANALYSIS_FALLBACK: AdAnalysisResult = {
  engagementScore: 0,
  targetAudienceMatch: 0,
  roiProjection: 0,
  attributionScore: 0,
  conversionProbability: 0,
  recommendedBid: 0,
  nextBestChannel: 'unknown',
  audienceSegment: 'general',
  confidence: 0,
};

/**
 * Analyze ad performance and engagement
 */
export async function analyzeAdPerformance(
  input: AdAnalysisInput
): Promise<RezMindResponse<AdAnalysisResult>> {
  logger.info('Analyzing ad performance with ReZ Mind', {
    eventType: input.eventType,
    adId: input.adId,
    campaignId: input.campaignId,
    value: input.value,
  });

  const payload = {
    event_type: `ad.${input.eventType}`,
    ad_id: input.adId,
    campaign_id: input.campaignId,
    merchant_id: input.merchantId,
    user_id: input.userId,
    placement: input.placement,
    device_type: input.deviceType,
    platform: input.platform,
    location: input.location,
    value: input.value,
    currency: input.currency,
    timestamp: input.eventTimestamp,
  };

  return callRezMind<AdAnalysisResult>(
    '/api/v1/ai/ads/analyze',
    payload,
    AD_ANALYSIS_FALLBACK
  );
}

// ============================================
// CAMPAIGN ANALYSIS
// ============================================

export interface CampaignAnalysisInput {
  campaignId: string;
  campaignName: string;
  merchantId: string;
  channel: 'ads' | 'marketing' | 'notification' | 'affiliate';
  budget?: number;
  startDate?: string;
  endDate?: string;
  eventTimestamp: string;
}

export interface CampaignAnalysisResult {
  projectedReach: number;
  projectedConversions: number;
  recommendedBudget: number;
  optimalChannels: string[];
  targetAudience: string[];
  predictedCPI: number;
  predictedROAS: number;
  campaignHealth: 'underperforming' | 'on_track' | 'exceeding';
  recommendations: string[];
  confidence: number;
}

const CAMPAIGN_ANALYSIS_FALLBACK: CampaignAnalysisResult = {
  projectedReach: 0,
  projectedConversions: 0,
  recommendedBudget: 0,
  optimalChannels: [],
  targetAudience: [],
  predictedCPI: 0,
  predictedROAS: 0,
  campaignHealth: 'on_track',
  recommendations: [],
  confidence: 0,
};

/**
 * Analyze campaign for optimization recommendations
 */
export async function analyzeCampaignPerformance(
  input: CampaignAnalysisInput
): Promise<RezMindResponse<CampaignAnalysisResult>> {
  logger.info('Analyzing campaign with ReZ Mind', {
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    channel: input.channel,
    budget: input.budget,
  });

  const payload = {
    event_type: 'campaign.created',
    campaign_id: input.campaignId,
    campaign_name: input.campaignName,
    merchant_id: input.merchantId,
    channel: input.channel,
    budget: input.budget,
    start_date: input.startDate,
    end_date: input.endDate,
    timestamp: input.eventTimestamp,
  };

  return callRezMind<CampaignAnalysisResult>(
    '/api/v1/ai/campaigns/analyze',
    payload,
    {
      ...CAMPAIGN_ANALYSIS_FALLBACK,
      recommendedBudget: input.budget || 0,
    }
  );
}

// ============================================
// VOUCHER ANALYSIS
// ============================================

export interface VoucherAnalysisInput {
  voucherId: string;
  campaignId: string;
  merchantId: string;
  userId: string;
  voucherCode: string;
  discountType: 'percentage' | 'fixed' | 'bogo';
  discountValue: number;
  minOrderValue?: number;
  expiresAt?: string;
  eventTimestamp: string;
}

export interface VoucherAnalysisResult {
  redemptionProbability: number;
  optimalTiming: string;
  customerTier: 'new' | 'returning' | 'vip';
  roiProjection: number;
  cannibalizationRisk: number;
  recommendations: string[];
  expirationRisk: 'low' | 'medium' | 'high';
  confidence: number;
}

const VOUCHER_ANALYSIS_FALLBACK: VoucherAnalysisResult = {
  redemptionProbability: 0.3,
  optimalTiming: new Date().toISOString(),
  customerTier: 'returning',
  roiProjection: 0,
  cannibalizationRisk: 0,
  recommendations: ['Send reminder before expiration'],
  expirationRisk: 'medium',
  confidence: 0,
};

/**
 * Analyze voucher for redemption prediction
 */
export async function analyzeVoucherPerformance(
  input: VoucherAnalysisInput
): Promise<RezMindResponse<VoucherAnalysisResult>> {
  logger.info('Analyzing voucher with ReZ Mind', {
    voucherId: input.voucherId,
    campaignId: input.campaignId,
    userId: input.userId,
    discountType: input.discountType,
    discountValue: input.discountValue,
  });

  const payload = {
    event_type: 'voucher.issued',
    voucher_id: input.voucherId,
    campaign_id: input.campaignId,
    merchant_id: input.merchantId,
    user_id: input.userId,
    voucher_code: input.voucherCode,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    min_order_value: input.minOrderValue,
    expires_at: input.expiresAt,
    timestamp: input.eventTimestamp,
  };

  return callRezMind<VoucherAnalysisResult>(
    '/api/v1/ai/loyalty/voucher-analyze',
    payload,
    VOUCHER_ANALYSIS_FALLBACK
  );
}

// ============================================
// NOTIFICATION ANALYSIS
// ============================================

export interface NotificationAnalysisInput {
  notificationId: string;
  campaignId?: string;
  merchantId: string;
  userId: string;
  channel: 'push' | 'email' | 'sms' | 'in_app';
  templateId?: string;
  title?: string;
  openedAt?: string;
  eventTimestamp: string;
}

export interface NotificationAnalysisResult {
  engagementPrediction: number;
  optimalSendTime: string;
  channelPreference: 'push' | 'email' | 'sms' | 'in_app';
  unsubscribeRisk: number;
  spamScore: number;
  contentRelevance: number;
  recommendedFollowUp: string;
  confidence: number;
}

const NOTIFICATION_ANALYSIS_FALLBACK: NotificationAnalysisResult = {
  engagementPrediction: 0.5,
  optimalSendTime: new Date().toISOString(),
  channelPreference: 'push',
  unsubscribeRisk: 0,
  spamScore: 0,
  contentRelevance: 0,
  recommendedFollowUp: 'no_followup',
  confidence: 0,
};

/**
 * Analyze notification for engagement prediction
 */
export async function analyzeNotificationPerformance(
  input: NotificationAnalysisInput
): Promise<RezMindResponse<NotificationAnalysisResult>> {
  const eventType = input.openedAt ? 'notification.opened' : 'notification.sent';

  logger.info('Analyzing notification with ReZ Mind', {
    eventType,
    notificationId: input.notificationId,
    userId: input.userId,
    channel: input.channel,
  });

  const payload = {
    event_type: eventType,
    notification_id: input.notificationId,
    campaign_id: input.campaignId,
    merchant_id: input.merchantId,
    user_id: input.userId,
    channel: input.channel,
    template_id: input.templateId,
    title: input.title,
    opened_at: input.openedAt,
    timestamp: input.eventTimestamp,
  };

  return callRezMind<NotificationAnalysisResult>(
    '/api/v1/ai/notifications/analyze',
    payload,
    NOTIFICATION_ANALYSIS_FALLBACK
  );
}

// ============================================
// HEALTH CHECK
// ============================================

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unavailable';
  latency: number;
  apiKeyConfigured: boolean;
  fallbackActive: boolean;
}

/**
 * Check ReZ Mind API health
 */
export async function checkRezMindHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  if (!REZ_MIND_API_KEY) {
    return {
      status: 'degraded',
      latency: 0,
      apiKeyConfigured: false,
      fallbackActive: true,
    };
  }

  try {
    const response = await rezMindClient.get('/api/v1/health', { timeout: 3000 });
    const latency = Date.now() - startTime;

    return {
      status: response.status === 200 ? 'healthy' : 'degraded',
      latency,
      apiKeyConfigured: true,
      fallbackActive: false,
    };
  } catch (error) {
    logger.warn('ReZ Mind health check failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return {
      status: 'unavailable',
      latency: Date.now() - startTime,
      apiKeyConfigured: true,
      fallbackActive: true,
    };
  }
}

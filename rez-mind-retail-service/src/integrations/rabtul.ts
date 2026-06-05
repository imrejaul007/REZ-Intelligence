/**
 * RABTUL SDK Integration for REZ Mind Retail Service
 *
 * This module provides integration with the RABTUL SDK for:
 * - Intent graph for customer personalization
 * - Intent tracking for recommendation conversions
 * - WhatsApp notifications for deal alerts
 * - JWT validation via auth service
 *
 * SDK Documentation: /RABTUL-Technologies/REZ-connector-sdk/
 */

import { REZ } from '@rez/sdk';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

// RABTUL SDK Configuration
const RABTUL_CONFIG = {
  apiKey: process.env.RABTUL_SDK_API_KEY || 'dev-api-key',
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'staging') || 'development',
  timeout: parseInt(process.env.RABTUL_SDK_TIMEOUT || '30000', 10),
  retries: parseInt(process.env.RABTUL_SDK_RETRIES || '3', 10),
};

// Service URLs
const SERVICE_URLS = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4002',
  wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:4003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',
  intent: process.env.INTENT_SERVICE_URL || 'http://localhost:4006',
};

// Initialize RABTUL SDK Client
const rezClient = new REZ(RABTUL_CONFIG);

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'internal-service-token';

// ============================================
// Intent Graph Integration
// ============================================

export interface CustomerIntentProfile {
  preferences: string[];
  interests: string[];
  budget: string;
  preferredCategories: string[];
  shoppingFrequency?: string;
  priceSensitivity?: number;
}

export interface IntentContext {
  merchantId?: string;
  category?: string;
  sessionType?: string;
}

/**
 * Get customer intent/preferences from RABTUL Intent Graph
 */
export async function getCustomerIntent(
  customerId: string,
  context?: IntentContext
): Promise<{
  success: boolean;
  intent?: CustomerIntentProfile;
  error?: string;
}> {
  try {
    const result = await fetch(`${SERVICE_URLS.intent}/api/intent/${customerId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RABTUL_SDK_API_KEY || 'dev-key'}`,
      },
    });

    if (!result.ok) {
      logger.warn('Intent service unavailable', { status: result.status, customerId });
      return { success: false, error: 'Intent service unavailable' };
    }

    const data = await result.json();
    logger.info('Customer intent retrieved from RABTUL', {
      customerId,
      hasPreferences: !!data.preferences,
    });

    return {
      success: true,
      intent: data as CustomerIntentProfile,
    };
  } catch (error) {
    logger.error('Failed to get customer intent', { error, customerId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get personalized product recommendations using Intent Graph
 */
export async function getPersonalizedRecommendations(
  customerId: string,
  baseRecommendations: Array<{ productId: string; productName: string; score: number }>,
  context?: IntentContext
): Promise<Array<{ productId: string; productName: string; score: number; intentMatch?: number }>> {
  const intentResult = await getCustomerIntent(customerId, context);

  if (!intentResult.success || !intentResult.intent) {
    return baseRecommendations;
  }

  const { preferences, interests, preferredCategories } = intentResult.intent;

  return baseRecommendations.map((rec) => {
    // Calculate intent match based on preferences and interests
    const matchedPreferences = preferences.filter(
      (p) => rec.productName.toLowerCase().includes(p.toLowerCase())
    ).length;
    const matchedInterests = interests.filter(
      (i) => rec.productName.toLowerCase().includes(i.toLowerCase())
    ).length;
    const matchedCategories = preferredCategories.filter(
      (c) => rec.productName.toLowerCase().includes(c.toLowerCase())
    ).length;

    const intentMatch = Math.min(
      100,
      Math.round(
        ((matchedPreferences + matchedInterests + matchedCategories * 2) /
          Math.max(preferences.length + interests.length + preferredCategories.length, 1)) *
          100
      )
    );

    return {
      ...rec,
      intentMatch,
    };
  });
}

// ============================================
// Intent Tracking
// ============================================

export interface RecommendationConversionEventData {
  customerId: string;
  merchantId: string;
  sessionId: string;
  recommendations: Array<{
    productId: string;
    productName: string;
    score: number;
    price: number;
  }>;
  conversionType: 'click' | 'add_to_cart' | 'purchase' | 'save';
  convertedProducts?: string[];
  totalValue?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Track recommendation conversion events
 */
export async function trackRecommendationConversion(
  data: RecommendationConversionEventData
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const eventPayload = {
      user_id: data.customerId,
      event_type: 'retail_recommendation_conversion',
      action: data.conversionType,
      properties: {
        merchant_id: data.merchantId,
        session_id: data.sessionId,
        recommendations_shown: data.recommendations.length,
        converted_products: data.convertedProducts,
        conversion_type: data.conversionType,
        total_value: data.totalValue,
        conversion_rate: data.recommendations.length > 0
          ? (data.convertedProducts?.length || 0) / data.recommendations.length
          : 0,
        top_product_shown: data.recommendations[0]?.productName,
        top_product_price: data.recommendations[0]?.price,
        ...data.metadata,
      },
      timestamp: new Date().toISOString(),
    };

    const result = await fetch(`${SERVICE_URLS.intent}/api/events/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RABTUL_SDK_API_KEY || 'dev-key'}`,
      },
      body: JSON.stringify(eventPayload),
    });

    if (!result.ok) {
      logger.warn('Intent tracking failed', {
        status: result.status,
        sessionId: data.sessionId,
      });
      return { success: false, error: 'Intent service returned error' };
    }

    const responseData = await result.json();
    logger.info('Recommendation conversion tracked', {
      sessionId: data.sessionId,
      conversionType: data.conversionType,
      eventId: responseData.eventId,
    });

    return { success: true, eventId: responseData.eventId };
  } catch (error) {
    logger.error('Failed to track recommendation conversion', {
      error,
      sessionId: data.sessionId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Notification Connector
// ============================================

export interface DealAlertData {
  customerId: string;
  customerPhone: string;
  customerName: string;
  dealTitle: string;
  dealDescription: string;
  originalPrice?: number;
  discountedPrice: number;
  discountPercentage?: number;
  validUntil: string;
  merchantName: string;
  productUrl?: string;
}

/**
 * Send WhatsApp notification for deal alerts
 */
export async function sendDealAlertWhatsApp(
  data: DealAlertData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    let priceInfo = `₹${data.discountedPrice.toLocaleString('en-IN')}`;
    if (data.originalPrice) {
      priceInfo = `~~₹${data.originalPrice.toLocaleString('en-IN')}~~ ${priceInfo}`;
    }

    let discountInfo = '';
    if (data.discountPercentage) {
      discountInfo = `🔥 *${data.discountPercentage}% OFF*\n`;
    }

    const message = `🛍️ *Deal Alert for You!*\n\n` +
      `Hi ${data.customerName},\n\n` +
      `${data.dealTitle}\n\n` +
      `${data.dealDescription}\n\n` +
      `${discountInfo}` +
      `💰 Price: ${priceInfo}\n` +
      `⏰ Valid until: ${data.validUntil}\n\n` +
      (data.productUrl ? `🔗 ${data.productUrl}\n\n` : '') +
      `From ${data.merchantName}`;

    const result = await rezClient.notifications.send({
      user_id: data.customerId,
      channel: 'whatsapp',
      title: `Deal: ${data.dealTitle}`,
      body: message,
      data: {
        dealTitle: data.dealTitle,
        discountedPrice: data.discountedPrice,
        originalPrice: data.originalPrice,
        discountPercentage: data.discountPercentage,
        validUntil: data.validUntil,
        type: 'deal_alert',
      },
    });

    logger.info('Deal alert WhatsApp sent via RABTUL SDK', {
      customerId: data.customerId,
      dealTitle: data.dealTitle,
    });

    return { success: true, messageId: result.data as string };
  } catch (error) {
    logger.error('Failed to send deal alert WhatsApp', {
      error,
      customerId: data.customerId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Auth Connector (JWT Validation)
// ============================================

export interface AuthUser {
  userId: string;
  merchantId?: string;
  role: string;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * JWT Authentication middleware using RABTUL
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header provided' });
      return;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    const token = parts[1];

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token has expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    logger.error('Authentication error', { error });
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Internal service token authentication using RABTUL
 */
export function authenticateInternalService(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const serviceToken = req.headers['x-internal-service-token'] as string;

    if (!serviceToken) {
      res.status(401).json({ error: 'No internal service token provided' });
      return;
    }

    if (serviceToken !== INTERNAL_SERVICE_TOKEN) {
      res.status(403).json({ error: 'Invalid internal service token' });
      return;
    }

    req.user = {
      userId: 'internal-service',
      role: 'service',
    };

    next();
  } catch (error) {
    logger.error('Internal service authentication error', { error });
    res.status(401).json({ error: 'Internal service authentication failed' });
  }
}

// ============================================
// Service Export
// ============================================

export const rabtul = {
  intent: {
    getIntent: getCustomerIntent,
    getPersonalizedRecommendations,
    trackConversion: trackRecommendationConversion,
  },
  notifications: {
    sendDealAlertWhatsApp,
    client: rezClient.notifications,
  },
  auth: {
    authenticate,
    authenticateInternalService,
  },
  config: RABTUL_CONFIG,
  urls: SERVICE_URLS,
};

export default rabtul;
/**
 * Analytics Tracking Service
 *
 * Provides centralized event tracking for user acquisition, engagement, and conversion.
 * Events are sent to the analytics backend and can be enriched with UTM data.
 */

import { logger } from './logger'

export const AnalyticsEvents = {
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  ORDER_CREATED: 'order_created',
  ORDER_COMPLETED: 'order_completed',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  COINS_EARNED: 'coins_earned',
  COINS_REDEEMED: 'coins_redeemed',
  COINS_EXPIRED: 'coins_expired',
  CAMPAIGN_CLICK: 'campaign_click',
  REFERRAL_SENT: 'referral_sent',
  REFERRAL_COMPLETED: 'referral_completed',
} as const

export type AnalyticsEventType = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]

export interface AnalyticsEventProperties {
  userId?: string
  orderId?: string
  orderNumber?: string
  amount?: number
  currency?: string
  paymentMethod?: string
  coinsAmount?: number
  campaignId?: string
  referralCode?: string
  referredBy?: string
  source?: string
  medium?: string
  campaign?: string
  deviceRisk?: string
  isNewUser?: boolean
  method?: string
  status?: string
  errorMessage?: string
  [key: string]: string | number | boolean | undefined
}

export interface AnalyticsContext {
  ipAddress?: string
  userAgent?: string
  referer?: string
  sessionId?: string
  deviceId?: string
}

export function track(
  event: AnalyticsEventType | string,
  properties?: AnalyticsEventProperties,
  context?: AnalyticsContext,
): void {
  const enrichedProperties = {
    ...properties,
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
  }

  if (process.env.NODE_ENV !== 'production' || process.env.ANALYTICS_DEBUG === 'true') {
    logger.debug(`[Analytics] ${event}`, enrichedProperties)
  }

  if (process.env.NODE_ENV === 'production' && process.env.ANALYTICS_API_URL) {
    sendToAnalyticsBackend(event, enrichedProperties, context).catch((err) => {
      logger.error('[Analytics] Failed to send event', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }
}

async function sendToAnalyticsBackend(
  event: string,
  properties: Record<string, unknown>,
  context?: AnalyticsContext,
): Promise<void> {
  const apiUrl = process.env.ANALYTICS_API_URL
  if (!apiUrl) return

  const payload = {
    event,
    properties,
    context: {
      ...context,
      library: {
        name: 'rez-analytics',
        version: '1.0.0',
      },
    },
  }

  const response = await fetch(`${apiUrl}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ANALYTICS_API_KEY || '',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Analytics API error: ${response.status} ${response.statusText}`)
  }
}

/**
 * Track user signup event
 */
export function trackUserSignup(
  userId: string,
  properties?: {
    method?: 'phone' | 'email' | 'social'
    referralCode?: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
  },
): void {
  track(AnalyticsEvents.USER_SIGNUP, {
    userId,
    method: properties?.method,
    referralCode: properties?.referralCode,
    source: properties?.utmSource,
    medium: properties?.utmMedium,
    campaign: properties?.utmCampaign,
    isNewUser: true,
  })
}

/**
 * Track user login event
 */
export function trackUserLogin(
  userId: string,
  properties?: {
    method?: 'phone' | 'pin' | 'social'
    deviceRisk?: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
  },
): void {
  track(AnalyticsEvents.USER_LOGIN, {
    userId,
    method: properties?.method,
    deviceRisk: properties?.deviceRisk,
    source: properties?.utmSource,
    medium: properties?.utmMedium,
    campaign: properties?.utmCampaign,
    isNewUser: false,
  })
}

/**
 * Track order creation event
 */
export function trackOrderCreated(
  orderId: string,
  userId: string,
  properties?: {
    orderNumber?: string
    amount?: number
    currency?: string
    itemCount?: number
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
  },
): void {
  track(AnalyticsEvents.ORDER_CREATED, {
    orderId,
    userId,
    orderNumber: properties?.orderNumber,
    amount: properties?.amount,
    currency: properties?.currency || 'INR',
    itemCount: properties?.itemCount,
    source: properties?.utmSource,
    medium: properties?.utmMedium,
    campaign: properties?.utmCampaign,
  })
}

/**
 * Track order completion event
 */
export function trackOrderCompleted(
  orderId: string,
  userId: string,
  properties?: {
    orderNumber?: string
    amount?: number
    currency?: string
    coinsEarned?: number
  },
): void {
  track(AnalyticsEvents.ORDER_COMPLETED, {
    orderId,
    userId,
    orderNumber: properties?.orderNumber,
    amount: properties?.amount,
    currency: properties?.currency || 'INR',
    coinsAmount: properties?.coinsEarned,
  })
}

/**
 * Track payment success event
 */
export function trackPaymentSuccess(
  orderId: string,
  userId: string,
  properties?: {
    amount?: number
    currency?: string
    paymentMethod?: string
    transactionId?: string
  },
): void {
  track(AnalyticsEvents.PAYMENT_SUCCESS, {
    orderId,
    userId,
    amount: properties?.amount,
    currency: properties?.currency || 'INR',
    paymentMethod: properties?.paymentMethod,
    status: 'success',
  })
}

/**
 * Track payment failure event
 */
export function trackPaymentFailed(
  orderId: string,
  userId: string,
  properties?: {
    amount?: number
    currency?: string
    paymentMethod?: string
    errorMessage?: string
    failureReason?: string
  },
): void {
  track(AnalyticsEvents.PAYMENT_FAILED, {
    orderId,
    userId,
    amount: properties?.amount,
    currency: properties?.currency || 'INR',
    paymentMethod: properties?.paymentMethod,
    errorMessage: properties?.errorMessage,
    status: 'failed',
  })
}

/**
 * Track coins earned event
 */
export function trackCoinsEarned(
  userId: string,
  coinsAmount: number,
  properties?: {
    source?: 'order' | 'referral' | 'promotion' | 'daily_bonus'
    orderId?: string
    campaignId?: string
  },
): void {
  track(AnalyticsEvents.COINS_EARNED, {
    userId,
    coinsAmount,
    source: properties?.source,
    orderId: properties?.orderId,
    campaignId: properties?.campaignId,
  })
}

/**
 * Track coins redeemed event
 */
export function trackCoinsRedeemed(
  userId: string,
  coinsAmount: number,
  properties?: {
    rewardId?: string
    rewardName?: string
    orderId?: string
  },
): void {
  track(AnalyticsEvents.COINS_REDEEMED, {
    userId,
    coinsAmount,
    rewardId: properties?.rewardId,
    rewardName: properties?.rewardName,
    orderId: properties?.orderId,
  })
}

/**
 * Track referral sent event
 */
export function trackReferralSent(
  userId: string,
  referredUserId: string,
  properties?: {
    referralCode?: string
    channel?: 'sms' | 'whatsapp' | 'email' | 'link'
    utmSource?: string
  },
): void {
  track(AnalyticsEvents.REFERRAL_SENT, {
    userId,
    referredBy: referredUserId,
    referralCode: properties?.referralCode,
    channel: properties?.channel,
    source: properties?.utmSource,
  })
}

/**
 * Track referral completed event (when referred user signs up)
 */
export function trackReferralCompleted(
  referrerUserId: string,
  referredUserId: string,
  properties?: {
    referralCode?: string
    rewardCoins?: number
  },
): void {
  track(AnalyticsEvents.REFERRAL_COMPLETED, {
    userId: referrerUserId,
    referredBy: referredUserId,
    referralCode: properties?.referralCode,
    coinsAmount: properties?.rewardCoins,
  })
}

/**
 * MCP Analytics - RABTUL Analytics Integration
 */

import axios from 'axios';

const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'https://rez-analytics-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Track event
 */
export async function trackEvent(eventName: string, properties: Record<string, unknown> = {}): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${ANALYTICS_URL}/api/track`, {
      event: eventName,
      properties,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Track page view
 */
export async function trackPageView(userId: string, page: string, properties?: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  return trackEvent('page_view', { userId, page, ...properties });
}

/**
 * Track user action
 */
export async function trackAction(userId: string, action: string, properties?: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  return trackEvent('user_action', { userId, action, ...properties });
}

/**
 * Track conversion
 */
export async function trackConversion(userId: string, conversionType: string, value?: number): Promise<{ success: boolean; error?: string }> {
  return trackEvent('conversion', { userId, conversionType, value });
}

/**
 * Get user analytics
 */
export async function getUserAnalytics(userId: string): Promise<{ analytics: unknown; error?: string }> {
  try {
    const res = await axios.get(`${ANALYTICS_URL}/api/analytics/user/${userId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { analytics: res.data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { analytics: null, error: message };
  }
}

/**
 * Get dashboard metrics
 */
export async function getDashboardMetrics(startDate: string, endDate: string): Promise<{ metrics: unknown; error?: string }> {
  try {
    const res = await axios.get(`${ANALYTICS_URL}/api/analytics/dashboard`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      params: { startDate, endDate },
    });
    return { metrics: res.data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { metrics: null, error: message };
  }
}

/**
 * Get funnel analytics
 */
export async function getFunnelAnalytics(funnelId: string): Promise<{ funnel: unknown; error?: string }> {
  try {
    const res = await axios.get(`${ANALYTICS_URL}/api/analytics/funnel/${funnelId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { funnel: res.data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { funnel: null, error: message };
  }
}

export const mcpAnalyticsRABTUL = {
  trackEvent,
  trackPageView,
  trackAction,
  trackConversion,
  getUserAnalytics,
  getDashboardMetrics,
  getFunnelAnalytics,
};

export default mcpAnalyticsRABTUL;

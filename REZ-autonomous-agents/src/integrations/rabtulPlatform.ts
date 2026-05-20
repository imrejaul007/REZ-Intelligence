/**
 * RABTUL Platform Integration for Autonomous Agents
 * Connects agents to core RABTUL services
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface PlatformConfig {
  baseUrl: string;
  token: string;
}

const platformConfig: PlatformConfig = {
  baseUrl: AUTH_URL.replace('/api/auth', ''),
  token: INTERNAL_TOKEN,
};

async function internalRequest(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${platformConfig.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': platformConfig.token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Platform API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// WALLET OPERATIONS
// ============================================

export const walletOperations = {
  /**
   * Award coins to user
   */
  async awardCoins(userId: string, amount: number, reason: string): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        amount,
        reason: `agent_${reason}`,
        metadata: { source: 'autonomous_agents' },
      }),
    });
  },

  /**
   * Deduct coins from user
   */
  async deductCoins(userId: string, amount: number, reason: string): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/deduct`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        amount,
        reason: `agent_deduct_${reason}`,
      }),
    });
  },

  /**
   * Get user balance
   */
  async getBalance(userId: string): Promise<number> {
    const data = await internalRequest(`${WALLET_URL}/api/wallet/balance/${userId}`);
    return data.coins || 0;
  },

  /**
   * Transfer between users
   */
  async transfer(fromUserId: string, toUserId: string, amount: number): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/transfer`, {
      method: 'POST',
      body: JSON.stringify({
        fromUserId,
        toUserId,
        amount,
        reason: 'agent_transfer',
      }),
    });
  },
};

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

export const notificationOperations = {
  /**
   * Send push notification
   */
  async sendPush(userId: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        notification: { title, body, data },
      }),
    });
  },

  /**
   * Send SMS
   */
  async sendSms(userId: string, message: string): Promise<void> {
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/sms`, {
      method: 'POST',
      body: JSON.stringify({ userId, message }),
    });
  },

  /**
   * Send email
   */
  async sendEmail(userId: string, subject: string, html: string): Promise<void> {
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/email`, {
      method: 'POST',
      body: JSON.stringify({ userId, subject, html }),
    });
  },

  /**
   * Broadcast to user segment
   */
  async broadcast(segment: string, title: string, body: string): Promise<void> {
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ segment, notification: { title, body } }),
    });
  },
};

// ============================================
// ANALYTICS OPERATIONS
// ============================================

export const analyticsOperations = {
  /**
   * Track agent action
   */
  async trackAgentAction(agentType: string, action: string, properties?: Record<string, any>): Promise<void> {
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: `agent_${action}`,
        properties: {
          agent_type: agentType,
          ...properties,
        },
      }),
    });
  },

  /**
   * Get dashboard data
   */
  async getDashboard(metric: string, period: string): Promise<any> {
    return internalRequest(`${ANALYTICS_URL}/api/dashboard/${metric}`, {
      method: 'GET',
    });
  },

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<any> {
    return internalRequest(`${ANALYTICS_URL}/api/users/${userId}/analytics`);
  },
};

// ============================================
// PROFILE OPERATIONS
// ============================================

export const profileOperations = {
  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<any> {
    return internalRequest(`${PROFILE_URL}/api/profiles/${userId}`);
  },

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Record<string, any>): Promise<any> {
    return internalRequest(`${PROFILE_URL}/api/profiles/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Get user segments
   */
  async getSegments(userId: string): Promise<string[]> {
    const data = await internalRequest(`${PROFILE_URL}/api/segments/${userId}`);
    return data.segments || [];
  },
};

// ============================================
// AUTH OPERATIONS
// ============================================

export const authOperations = {
  /**
   * Verify internal token
   */
  async verifyToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const data = await internalRequest(`${AUTH_URL}/api/auth/verify`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return { valid: true, userId: data.userId };
    } catch {
      return { valid: false };
    }
  },
};

// ============================================
// AGENT ACTIONS BRIDGE
// ============================================

export const agentActions = {
  /**
   * Personalization: Send personalized offer
   */
  async sendPersonalizedOffer(userId: string, offer: { title: string; discount: number; expiresAt: string }): Promise<void> {
    await Promise.all([
      notificationOperations.sendPush(userId, offer.title, `Get ${offer.discount}% off!`),
      analyticsOperations.trackAgentAction('personalization', 'offer_sent', { discount: offer.discount }),
    ]);
  },

  /**
   * Scarcity: Alert low inventory
   */
  async alertLowInventory(productId: string, productName: string, urgency: 'high' | 'medium' | 'low'): Promise<void> {
    await analyticsOperations.trackAgentAction('scarcity', 'low_inventory_alert', {
      product_id: productId,
      product_name: productName,
      urgency,
    });
  },

  /**
   * Demand Signal: Publish demand trend
   */
  async publishDemandTrend(category: string, velocity: number): Promise<void> {
    await analyticsOperations.trackAgentAction('demand_signal', 'trend_published', {
      category,
      velocity,
    });
  },

  /**
   * Revenue Attribution: Log campaign ROI
   */
  async logCampaignROI(campaignId: string, roi: number, conversions: number): Promise<void> {
    await analyticsOperations.trackAgentAction('revenue_attribution', 'campaign_roi', {
      campaign_id: campaignId,
      roi,
      conversions,
    });
  },

  /**
   * Support: Create escalation ticket
   */
  async createSupportTicket(userId: string, issue: string, priority: 'high' | 'medium' | 'low'): Promise<void> {
    await notificationOperations.sendPush(userId, 'Support Ticket Created', `Your issue has been logged. #${priority} priority.`);
    await analyticsOperations.trackAgentAction('support', 'ticket_created', { priority });
  },
};

export default {
  wallet: walletOperations,
  notifications: notificationOperations,
  analytics: analyticsOperations,
  profile: profileOperations,
  auth: authOperations,
  actions: agentActions,
};

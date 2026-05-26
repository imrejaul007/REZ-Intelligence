/**
 * RABTUL Platform Integration for Realtime Segments
 * Connect segment changes to RABTUL actions
 */

const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

async function internalRequest<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Platform API error: ${response.status}`);
  }

  return response.json() as T;
}

// ============================================
// SEGMENT TRIGGERED ACTIONS
// ============================================

export interface SegmentEvent {
  userId: string;
  segmentId: string;
  segmentName: string;
  eventType: 'USER_ENTERED_SEGMENT' | 'USER_EXITED_SEGMENT';
  timestamp: string;
}

export const segmentActions = {
  /**
   * Reward user when they enter high-value segment
   */
  async rewardHighSpender(userId: string): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        amount: 200,
        reason: 'segment_upgrade_high_spender',
        metadata: { source: 'realtime_segments' },
      }),
    });
  },

  /**
   * Reward user when they become loyal customer
   */
  async rewardLoyalCustomer(userId: string): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        amount: 100,
        reason: 'segment_upgrade_loyal_customer',
        metadata: { source: 'realtime_segments' },
      }),
    });
  },

  /**
   * Reward user when they become power user
   */
  async rewardPowerUser(userId: string): Promise<void> {
    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        amount: 150,
        reason: 'segment_upgrade_power_user',
        metadata: { source: 'realtime_segments' },
      }),
    });
  },

  /**
   * Notify at-risk users
   */
  async notifyAtRiskUser(userId: string, riskLevel: string): Promise<void> {
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        notification: {
          title: 'We value your business',
          body: 'Here is a special offer to welcome you back!',
          data: {
            action: 'at_risk_retention',
            segment: 'at_risk',
            risk_level: riskLevel,
          },
        },
      }),
    });
  },

  /**
   * Notify dormant users
   */
  async notifyDormantUser(userId: string): Promise<void> {
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        notification: {
          title: 'We miss you!',
          body: 'It has been a while. Here is 10% off your next order!',
          data: {
            action: 'dormant_reengagement',
            segment: 'dormant',
          },
        },
      }),
    });
  },

  /**
   * Update profile with segment membership
   */
  async updateProfileWithSegments(userId: string, segments: string[]): Promise<void> {
    await internalRequest(`${PROFILE_URL}/api/profiles/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        loyalty: {
          segments,
          lastSegmentUpdate: new Date().toISOString(),
        },
      }),
    });
  },

  /**
   * Alert sales for high spenders
   */
  async alertSalesForHighSpender(userId: string, spendLevel: string): Promise<void> {
    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId: 'sales_team',
        notification: {
          title: 'High Spender Alert',
          body: `User ${userId} has upgraded to high spender tier: ${spendLevel}`,
          data: {
            action: 'view_high_spender',
            user_id: userId,
            segment: 'high_spender',
          },
        },
      }),
    });
  },
};

// ============================================
// ANALYTICS OPERATIONS
// ============================================

export const analyticsOperations = {
  /**
   * Track segment membership changes
   */
  async trackSegmentChange(
    event: SegmentEvent,
    previousMembership: boolean,
    currentMembership: boolean
  ): Promise<void> {
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: event.eventType,
        properties: {
          user_id: event.userId,
          segment_id: event.segmentId,
          segment_name: event.segmentName,
          previous_membership: previousMembership,
          current_membership: currentMembership,
          timestamp: event.timestamp,
        },
      }),
    });
  },

  /**
   * Track segment stats
   */
  async trackSegmentStats(segmentId: string, memberCount: number): Promise<void> {
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'segment_stats',
        properties: {
          segment_id: segmentId,
          member_count: memberCount,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  },
};

// ============================================
// SEGMENT ACTION HANDLERS
// ============================================

interface UserDataWithSignals {
  signals?: {
    competitor?: {
      switchRisk?: string;
    };
  };
}

const segmentHandlers: Record<string, (userId: string, userData?: unknown) => Promise<void>> = {
  high_spender: async (userId) => {
    await segmentActions.rewardHighSpender(userId);
    await segmentActions.alertSalesForHighSpender(userId, 'high');
  },
  loyal_customer: async (userId) => {
    await segmentActions.rewardLoyalCustomer(userId);
  },
  power_user: async (userId) => {
    await segmentActions.rewardPowerUser(userId);
  },
  at_risk: async (userId, userData) => {
    const userDataRecord = userData as UserDataWithSignals | undefined;
    const competitor = userDataRecord?.signals?.competitor;
    const riskLevel = competitor?.switchRisk || 'HIGH';
    await segmentActions.notifyAtRiskUser(userId, riskLevel);
  },
  dormant: async (userId) => {
    await segmentActions.notifyDormantUser(userId);
  },
};

export const handleSegmentEnter = async (
  event: SegmentEvent,
  userData?: unknown
): Promise<void> => {
  const handler = segmentHandlers[event.segmentId];
  if (handler) {
    await handler(event.userId, userData);
  }

  await analyticsOperations.trackSegmentChange(event, false, true);
};

export const handleSegmentExit = async (event: SegmentEvent): Promise<void> => {
  await analyticsOperations.trackSegmentChange(event, true, false);
};

export default {
  actions: segmentActions,
  analytics: analyticsOperations,
  handlers: { handleSegmentEnter, handleSegmentExit },
};

/**
 * RABTUL Platform Integration for Signal Aggregator
 * Connect signals to RABTUL actions and analytics
 */

const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

async function internalRequest(url: string, options: RequestInit = {}): Promise<any> {
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

  return response.json();
}

// ============================================
// SEGMENT-BASED ACTIONS
// ============================================

export interface SignalScores {
  userId: string;
  overall: number;
  behavioral: number;
  engagement: number;
  social: number;
  competitor: number;
  location: number;
}

export const segmentActions = {
  /**
   * Reward high-value users based on signals
   */
  async rewardHighValueUser(scores: SignalScores): Promise<void> {
    if (scores.overall < 75) return;

    const rewardTiers: Record<string, number> = {
      high: 100,
      medium: 50,
      low: 25,
    };

    let tier = 'low';
    if (scores.overall >= 90) tier = 'high';
    else if (scores.overall >= 75) tier = 'medium';

    await internalRequest(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({
        userId: scores.userId,
        amount: rewardTiers[tier],
        reason: 'signal_based_reward',
        metadata: {
          overall_score: scores.overall,
          tier,
          engagement_score: scores.engagement,
        },
      }),
    });

    // Track analytics
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'signal_reward_sent',
        properties: {
          user_id: scores.userId,
          overall_score: scores.overall,
          tier,
        },
      }),
    });
  },

  /**
   * Notify at-risk users
   */
  async notifyAtRiskUser(scores: SignalScores): Promise<void> {
    if (scores.overall > 40) return;

    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId: scores.userId,
        notification: {
          title: 'We miss you!',
          body: 'Here is a special offer just for you.',
          data: {
            action: 'reengagement',
            risk_level: scores.overall < 20 ? 'critical' : 'high',
          },
        },
      }),
    });
  },

  /**
   * Update profile with signal scores
   */
  async updateProfileWithSignals(userId: string, scores: SignalScores): Promise<void> {
    await internalRequest(`${PROFILE_URL}/api/profiles/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        behavioral: {
          signalOverall: scores.overall,
          signalEngagement: scores.engagement,
          signalSocial: scores.social,
          signalBehavioral: scores.behavioral,
          signalCompetitor: scores.competitor,
          signalLocation: scores.location,
          lastSignalUpdate: new Date().toISOString(),
        },
      }),
    });
  },

  /**
   * Send to sales team for power users
   */
  async alertSalesForPowerUser(scores: SignalScores): Promise<void> {
    if (scores.engagement < 80) return;

    await internalRequest(`${NOTIFICATION_URL}/api/notifications/push`, {
      method: 'POST',
      body: JSON.stringify({
        userId: 'sales_team',
        notification: {
          title: 'Power User Alert',
          body: `User ${scores.userId} has engagement score: ${scores.engagement}`,
          data: {
            action: 'view_power_user',
            user_id: scores.userId,
            engagement_score: scores.engagement,
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
   * Log signal aggregation for observability
   */
  async logSignalAggregation(
    userId: string,
    scores: SignalScores,
    latencyMs: number
  ): Promise<void> {
    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'signal_aggregation_completed',
        properties: {
          user_id: userId,
          overall_score: scores.overall,
          behavioral_score: scores.behavioral,
          engagement_score: scores.engagement,
          social_score: scores.social,
          competitor_score: scores.competitor,
          location_score: scores.location,
          latency_ms: latencyMs,
        },
      }),
    });
  },

  /**
   * Track segment membership changes
   */
  async trackSegmentChange(
    userId: string,
    oldSegments: string[],
    newSegments: string[]
  ): Promise<void> {
    const added = newSegments.filter(s => !oldSegments.includes(s));
    const removed = oldSegments.filter(s => !newSegments.includes(s));

    if (added.length === 0 && removed.length === 0) return;

    await internalRequest(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'segment_membership_changed',
        properties: {
          user_id: userId,
          segments_added: added,
          segments_removed: removed,
          old_segments: oldSegments,
          new_segments: newSegments,
        },
      }),
    });
  },
};

export default {
  actions: segmentActions,
  analytics: analyticsOperations,
};

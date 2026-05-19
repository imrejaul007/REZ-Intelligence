/**
 * RABTUL Platform Integration for Cohort Service
 *
 * Uses RABTUL services for:
 * - Analytics (cohort tracking)
 * - Profile (user data)
 * - Notifications (alerts)
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';

interface CohortData {
  cohortId: string;
  userIds: string[];
  startDate: string;
  endDate?: string;
}

export const cohortIntegrations = {
  /**
   * Track cohort analytics
   */
  async trackCohort(cohort: CohortData): Promise<void> {
    await fetch(`${ANALYTICS_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
      body: JSON.stringify({
        event: 'cohort_tracked',
        properties: cohort,
        timestamp: new Date().toISOString(),
      }),
    });
  },

  /**
   * Get user profiles for cohort
   */
  async getUserProfiles(userIds: string[]): Promise<any[]> {
    const profiles = await Promise.all(
      userIds.map(async (userId) => {
        const res = await fetch(`${PROFILE_URL}/api/profiles/${userId}`, {
          headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' },
        });
        return res.ok ? res.json() : null;
      })
    );
    return profiles.filter(Boolean);
  },

  /**
   * Send cohort notification
   */
  async notifyCohort(userIds: string[], title: string, message: string): Promise<void> {
    await fetch(`${NOTIFICATION_URL}/api/notifications/send-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
      body: JSON.stringify({ userIds, type: 'push', title, message }),
    });
  },
};

export default cohortIntegrations;

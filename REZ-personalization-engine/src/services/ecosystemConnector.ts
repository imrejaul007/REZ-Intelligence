/**
 * REZ Personalization Engine - Ecosystem Connector
 */

import axios from 'axios';

const ECOSYSTEM_URL = process.env.ECOSYSTEM_URL || 'http://localhost:4105';

// ============================================
// PERSONALIZATION EVENTS
// ============================================

export async function onPersonalizationUpdate(userId: string, preferences: object): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'PERSONALIZATION_ENGINE',
    action: 'preferences_updated',
    data: preferences,
  });
}

export async function onFeedView(userId: string, itemId: string): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'PERSONALIZATION_ENGINE',
    action: 'personalized_feed_view',
    data: { itemId },
  });
}

export async function healthCheck(): Promise<boolean> {
  try {
    await axios.get(`${ECOSYSTEM_URL}/health`);
    return true;
  } catch {
    return false;
  }
}

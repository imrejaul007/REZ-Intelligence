/**
 * REZ CDP Service - Ecosystem Connector
 */

import axios from 'axios';

const ECOSYSTEM_URL = process.env.ECOSYSTEM_URL || 'http://localhost:4105';

// ============================================
// PROFILE EVENTS
// ============================================

export async function onProfileUpdate(userId: string, traits: object): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'CDP',
    action: 'profile_updated',
    data: traits,
  });
}

export async function onSegmentChange(userId: string, oldSegment: string, newSegment: string): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'CDP',
    action: 'segment_changed',
    data: { oldSegment, newSegment },
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

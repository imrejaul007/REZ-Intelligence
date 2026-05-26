/**
 * REZ Identity Graph - Ecosystem Connector
 * Connects identity resolution to ecosystem
 */

import axios from 'axios';

const ECOSYSTEM_URL = process.env['ECOSYSTEM_URL'] || 'http://localhost:4105';
const SIGNALS_URL = process.env['SIGNALS_URL'] || 'http://localhost:4121';

// ============================================
// IDENTITY EVENTS
// ============================================

export async function onIdentityResolved(userId: string, identifiers: object): Promise<void> {
  // Send to ecosystem
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'IDENTITY_GRAPH',
    action: 'identity_resolved',
    data: { identifiers },
  });

  // Send to signals aggregator
  await axios.post(`${SIGNALS_URL}/api/signals`, {
    userId,
    action: 'identity_linked',
    source: 'IDENTITY_GRAPH',
    data: { identifiers },
  });
}

export async function onProfilesMerged(sourceId: string, targetId: string): Promise<void> {
  // Notify ecosystem
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId: targetId,
    source: 'IDENTITY_GRAPH',
    action: 'profiles_merged',
    data: { mergedFrom: sourceId },
  });
}

export async function onFraudDetected(userId: string, fraudScore: number): Promise<void> {
  // High fraud → alert ecosystem
  if (fraudScore > 0.8) {
    await axios.post(`${ECOSYSTEM_URL}/api/alerts`, {
      type: 'FRAUD_DETECTED',
      userId,
      fraudScore,
      action: 'BLOCK_USER',
    });
  }
}

// ============================================
// QUERIES
// ============================================

export async function getUnifiedProfile(userId: string): Promise<unknown> {
  const response = await axios.get(`${ECOSYSTEM_URL}/api/v1/profile/${userId}`);
  return response.data;
}

export async function getUserTransactions(userId: string): Promise<unknown[]> {
  const response = await axios.get(`${ECOSYSTEM_URL}/api/loyalty/transactions/${userId}`);
  return response.data.transactions || [];
}

export async function getUserSignals(userId: string): Promise<unknown[]> {
  const response = await axios.get(`${SIGNALS_URL}/api/users/${userId}/signals`);
  return response.data.signals || [];
}

// ============================================
// HEALTH
// ============================================

export async function healthCheck(): Promise<boolean> {
  try {
    await axios.get(`${ECOSYSTEM_URL}/health`);
    return true;
  } catch {
    return false;
  }
}

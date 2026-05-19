/**
 * REZ Signal Aggregator - Ecosystem Connector
 */

import axios from 'axios';

const ECOSYSTEM_URL = process.env.ECOSYSTEM_URL || 'http://localhost:4105';
const PREDICTIVE_URL = process.env.PREDICTIVE_URL || 'http://localhost:4123';

// ============================================
// SIGNAL EVENTS
// ============================================

export async function onSignalsAggregated(userId: string, aggregate: object): Promise<void> {
  // Send aggregated data to predictive engine
  await axios.post(`${PREDICTIVE_URL}/api/features`, {
    userId,
    features: aggregate,
    source: 'SIGNAL_AGGREGATOR',
  });

  // Update ecosystem profile
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'SIGNAL_AGGREGATOR',
    action: 'signals_aggregated',
    data: aggregate,
  });
}

export async function onBehaviorChange(userId: string, oldBehavior: object, newBehavior: object): Promise<void> {
  // Notify ecosystem
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'SIGNAL_AGGREGATOR',
    action: 'behavior_change_detected',
    data: { oldBehavior, newBehavior },
  });
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

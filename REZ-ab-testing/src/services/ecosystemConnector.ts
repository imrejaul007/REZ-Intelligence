/**
 * REZ A/B Testing - Ecosystem Connector
 */

import axios from 'axios';

const ECOSYSTEM_URL = process.env.ECOSYSTEM_URL || 'http://localhost:4105';
const LOYALTY_URL = process.env.LOYALTY_URL || 'http://localhost:4097';

// ============================================
// EXPERIMENT EVENTS
// ============================================

export async function onExperimentView(userId: string, experimentId: string, variant: string): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'AB_TESTING',
    action: 'experiment_viewed',
    data: { experimentId, variant },
  });
}

export async function onExperimentConversion(userId: string, experimentId: string, variant: string): Promise<void> {
  // Award loyalty coins for conversion
  await axios.post(`${LOYALTY_URL}/api/earn`, {
    userId,
    amount: 5,
    source: 'AB_TESTING',
    description: `Experiment ${experimentId} conversion`,
  });

  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'AB_TESTING',
    action: 'experiment_converted',
    data: { experimentId, variant },
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

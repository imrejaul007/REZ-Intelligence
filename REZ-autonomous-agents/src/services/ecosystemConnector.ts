/**
 * REZ Autonomous Agents - Ecosystem Connector
 * Connects autonomous agents to REZ ecosystem
 */

import axios from 'axios';

const ECOSYSTEM_URL = process.env.ECOSYSTEM_URL || 'http://localhost:4105';
const LOYALTY_URL = process.env.LOYALTY_URL || 'http://localhost:4097';
const SIGNALS_URL = process.env.SIGNALS_URL || 'http://localhost:4121';
const WALLET_URL = process.env.WALLET_URL || 'http://localhost:4004';

// ============================================
// AGENT TYPES
// ============================================

export type AgentType =
  | 'support'
  | 'sales'
  | 'marketing'
  | 'operations'
  | 'hr'
  | 'finance'
  | 'inventory'
  | 'customer_success';

interface Agent {
  id: string;
  type: AgentType;
  name: string;
  enabled: boolean;
}

// ============================================
// AGENT ACTIONS
// ============================================

export async function createAgent(type: AgentType, name: string): Promise<Agent> {
  const response = await axios.post(`${ECOSYSTEM_URL}/api/agents`, { type, name });
  return response.data;
}

export async function getAgent(agentId: string): Promise<Agent> {
  const response = await axios.get(`${ECOSYSTEM_URL}/api/agents/${agentId}`);
  return response.data;
}

export async function listAgents(): Promise<Agent[]> {
  const response = await axios.get(`${ECOSYSTEM_URL}/api/agents`);
  return response.data.agents;
}

// ============================================
// ECOSYSTEM INTEGRATIONS
// ============================================

export async function sendSignal(userId: string, action: string, data: object): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/v1/signals`, {
    userId,
    source: 'AUTONOMOUS_AGENT',
    action,
    data,
  });
}

export async function getUserProfile(userId: string): Promise<unknown> {
  const response = await axios.get(`${ECOSYSTEM_URL}/api/v1/profile/${userId}`);
  return response.data.profile;
}

export async function awardLoyaltyCoins(userId: string, amount: number, reason: string): Promise<void> {
  await axios.post(`${LOYALTY_URL}/api/earn`, {
    userId,
    amount,
    source: 'AUTONOMOUS_AGENT',
    description: reason,
  });
}

export async function sendNotification(userId: string, message: string, type: string): Promise<void> {
  await axios.post(`${ECOSYSTEM_URL}/api/notifications/send`, {
    userId,
    message,
    type,
  });
}

export async function trackEvent(userId: string, event: string, properties: object): Promise<void> {
  await axios.post(`${SIGNALS_URL}/api/events`, {
    userId,
    event,
    properties,
    source: 'AUTONOMOUS_AGENT',
  });
}

// ============================================
// AGENT TEMPLATES
// ============================================

export const AGENT_TEMPLATES = {
  support: {
    type: 'support',
    capabilities: [
      'answer_questions',
      'process_refunds',
      'escalate_tickets',
      'track_orders',
    ],
    integrations: ['loyalty', 'wallet', 'signals'],
  },
  sales: {
    type: 'sales',
    capabilities: [
      'qualify_leads',
      'send_offers',
      'track_conversions',
      'update_crm',
    ],
    integrations: ['loyalty', 'signals', 'notifications'],
  },
  marketing: {
    type: 'marketing',
    capabilities: [
      'send_campaigns',
      'analyze_engagement',
      'optimize_content',
      'track_attribution',
    ],
    integrations: ['signals', 'attribution', 'notifications'],
  },
  operations: {
    type: 'operations',
    capabilities: [
      'track_orders',
      'update_inventory',
      'manage_shipments',
      'handle_returns',
    ],
    integrations: ['orders', 'inventory', 'logistics'],
  },
  hr: {
    type: 'hr',
    capabilities: [
      'onboard_employees',
      'track_attendance',
      'process_payroll',
      'send_notifications',
    ],
    integrations: ['corpperks', 'notifications', 'loyalty'],
  },
};

// ============================================
// HEALTH CHECK
// ============================================

export async function healthCheck(): Promise<boolean> {
  try {
    await axios.get(`${ECOSYSTEM_URL}/health`);
    return true;
  } catch {
    return false;
  }
}

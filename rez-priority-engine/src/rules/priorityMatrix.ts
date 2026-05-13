import { PriorityTier, PriorityTierValue } from '../models/PriorityRule';

export interface PriorityMatrixEntry {
  tier: PriorityTierValue;
  name: string;
  scoreRange: {
    min: number;
    max: number;
  };
  description: string;
  responseTimeSla: {
    critical: number;
    target: number;
  };
  escalationPolicy: {
    autoEscalate: boolean;
    escalationDelayMinutes: number;
    maxEscalations: number;
  };
  routingConfig: {
    pool: string;
    minAgents: number;
    maxQueueSize: number;
    overflowEnabled: boolean;
  };
}

export const PRIORITY_MATRIX: Record<PriorityTierValue, PriorityMatrixEntry> = {
  [PriorityTier.EMERGENCY]: {
    tier: PriorityTier.EMERGENCY,
    name: 'EMERGENCY',
    scoreRange: { min: 95, max: 100 },
    description: 'Critical incidents requiring immediate human intervention',
    responseTimeSla: { critical: 30, target: 60 },
    escalationPolicy: {
      autoEscalate: true,
      escalationDelayMinutes: 0,
      maxEscalations: 3,
    },
    routingConfig: {
      pool: 'emergency-response',
      minAgents: 2,
      maxQueueSize: 5,
      overflowEnabled: false,
    },
  },
  [PriorityTier.PAYMENT_FRAUD]: {
    tier: PriorityTier.PAYMENT_FRAUD,
    name: 'PAYMENT/FRAUD',
    scoreRange: { min: 80, max: 94 },
    description: 'Payment issues and fraud detection requiring urgent attention',
    responseTimeSla: { critical: 60, target: 300 },
    escalationPolicy: {
      autoEscalate: true,
      escalationDelayMinutes: 5,
      maxEscalations: 5,
    },
    routingConfig: {
      pool: 'payment-security',
      minAgents: 3,
      maxQueueSize: 20,
      overflowEnabled: true,
    },
  },
  [PriorityTier.SUPPORT]: {
    tier: PriorityTier.SUPPORT,
    name: 'SUPPORT',
    scoreRange: { min: 60, max: 79 },
    description: 'Customer support requests requiring human assistance',
    responseTimeSla: { critical: 300, target: 900 },
    escalationPolicy: {
      autoEscalate: true,
      escalationDelayMinutes: 15,
      maxEscalations: 3,
    },
    routingConfig: {
      pool: 'customer-support',
      minAgents: 2,
      maxQueueSize: 50,
      overflowEnabled: true,
    },
  },
  [PriorityTier.DOMAIN_EXPERT]: {
    tier: PriorityTier.DOMAIN_EXPERT,
    name: 'DOMAIN EXPERT',
    scoreRange: { min: 45, max: 59 },
    description: 'Requests requiring specialized domain knowledge',
    responseTimeSla: { critical: 600, target: 1800 },
    escalationPolicy: {
      autoEscalate: false,
      escalationDelayMinutes: 30,
      maxEscalations: 2,
    },
    routingConfig: {
      pool: 'domain-experts',
      minAgents: 1,
      maxQueueSize: 100,
      overflowEnabled: true,
    },
  },
  [PriorityTier.SALES]: {
    tier: PriorityTier.SALES,
    name: 'SALES',
    scoreRange: { min: 30, max: 44 },
    description: 'Sales inquiries and lead handling',
    responseTimeSla: { critical: 1800, target: 3600 },
    escalationPolicy: {
      autoEscalate: false,
      escalationDelayMinutes: 60,
      maxEscalations: 1,
    },
    routingConfig: {
      pool: 'sales',
      minAgents: 1,
      maxQueueSize: 200,
      overflowEnabled: true,
    },
  },
  [PriorityTier.LOYALTY]: {
    tier: PriorityTier.LOYALTY,
    name: 'LOYALTY',
    scoreRange: { min: 15, max: 29 },
    description: 'Loyalty program and retention activities',
    responseTimeSla: { critical: 3600, target: 14400 },
    escalationPolicy: {
      autoEscalate: false,
      escalationDelayMinutes: 120,
      maxEscalations: 1,
    },
    routingConfig: {
      pool: 'loyalty',
      minAgents: 1,
      maxQueueSize: 500,
      overflowEnabled: true,
    },
  },
  [PriorityTier.ANALYTICS]: {
    tier: PriorityTier.ANALYTICS,
    name: 'ANALYTICS',
    scoreRange: { min: 0, max: 14 },
    description: 'Internal analytics and reporting requests',
    responseTimeSla: { critical: 7200, target: 28800 },
    escalationPolicy: {
      autoEscalate: false,
      escalationDelayMinutes: 240,
      maxEscalations: 0,
    },
    routingConfig: {
      pool: 'analytics',
      minAgents: 1,
      maxQueueSize: 1000,
      overflowEnabled: true,
    },
  },
};

export function getTierForScore(score: number): PriorityTierValue {
  for (const [tier, entry] of Object.entries(PRIORITY_MATRIX)) {
    if (score >= entry.scoreRange.min && score <= entry.scoreRange.max) {
      return parseInt(tier, 10) as PriorityTierValue;
    }
  }
  return PriorityTier.ANALYTICS;
}

export function getMatrixEntry(tier: PriorityTierValue): PriorityMatrixEntry | undefined {
  return PRIORITY_MATRIX[tier];
}

export function calculatePriorityScore(
  baseTier: PriorityTierValue,
  modifiers: {
    customerTier?: number;
    timeSensitivity?: number;
    businessImpact?: number;
    complexity?: number;
  } = {}
): number {
  const baseEntry = PRIORITY_MATRIX[baseTier];
  if (!baseEntry) return 0;

  let score = (baseEntry.scoreRange.min + baseEntry.scoreRange.max) / 2;

  if (modifiers.customerTier !== undefined) {
    score += modifiers.customerTier * 2;
  }

  if (modifiers.timeSensitivity !== undefined) {
    score += modifiers.timeSensitivity * 5;
  }

  if (modifiers.businessImpact !== undefined) {
    score += modifiers.businessImpact * 3;
  }

  if (modifiers.complexity !== undefined) {
    score -= modifiers.complexity * 2;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export default PRIORITY_MATRIX;

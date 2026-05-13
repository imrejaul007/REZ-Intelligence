import { PriorityTier, RuleType } from '../models/PriorityRule';
import { PriorityRuleInput } from '../models/PriorityRule';

export interface EmergencyCondition {
  pattern: RegExp | string;
  keywords?: string[];
  priorityBoost: number;
  targetTier: number;
  description: string;
}

export const EMERGENCY_PATTERNS: EmergencyCondition[] = [
  {
    pattern: /\b(suicide|self.?harm|cutting|overdose|poison)\b/i,
    keywords: ['help me', 'want to die', 'end it all'],
    priorityBoost: 100,
    targetTier: PriorityTier.EMERGENCY,
    description: 'Mental health crisis - immediate intervention required',
  },
  {
    pattern: /\b(hack|breach|stolen|card.?fraud|unauthorized)\b/i,
    keywords: ['someone used my card', 'account hacked', 'suspicious activity'],
    priorityBoost: 95,
    targetTier: PriorityTier.EMERGENCY,
    description: 'Security incident - fraud detection',
  },
  {
    pattern: /\b(heart attack|choking|unconscious|not breathing)\b/i,
    keywords: ['cant breathe', 'unresponsive', 'medical emergency'],
    priorityBoost: 100,
    targetTier: PriorityTier.EMERGENCY,
    description: 'Medical emergency - direct to emergency services guidance',
  },
  {
    pattern: /\b(fire|gas leak|armed|shooting|threat)\b/i,
    keywords: ['immediate danger', 'need help now', 'urgent'],
    priorityBoost: 100,
    targetTier: PriorityTier.EMERGENCY,
    description: 'Safety threat - immediate escalation',
  },
  {
    pattern: /\b(bomb|terrorist|hostage)\b/i,
    keywords: [],
    priorityBoost: 100,
    targetTier: PriorityTier.EMERGENCY,
    description: 'Critical security threat - emergency protocol',
  },
];

export const EMERGENCY_ROUTING_CONFIG = {
  requiredAgents: 2,
  maxWaitTime: 30,
  autoEscalate: true,
  silentMode: false,
  recordAllInteractions: true,
  notifySecurity: true,
  notifyManagement: true,
  fallbackQueue: 'emergency-fallback',
};

export function detectEmergency(intent: string): EmergencyCondition | null {
  for (const emergency of EMERGENCY_PATTERNS) {
    if (typeof emergency.pattern === 'string') {
      if (intent.toLowerCase().includes(emergency.pattern.toLowerCase())) {
        return emergency;
      }
    } else if (emergency.pattern.test(intent)) {
      return emergency;
    }

    if (emergency.keywords) {
      const lowerIntent = intent.toLowerCase();
      for (const keyword of emergency.keywords) {
        if (lowerIntent.includes(keyword.toLowerCase())) {
          return emergency;
        }
      }
    }
  }

  return null;
}

export function createEmergencyRules(): PriorityRuleInput[] {
  return [
    {
      name: 'Mental Health Crisis Detection',
      description: 'Detect and escalate mental health crisis situations',
      ruleType: RuleType.EMERGENCY,
      priorityTier: PriorityTier.EMERGENCY,
      conditions: [
        {
          field: 'intent',
          operator: 'regex',
          value: '\\b(suicide|self.?harm|cutting|overdose|want to die|end it all)\\b',
        },
      ],
      actions: {
        routeTo: 'emergency-response',
        escalate: true,
        notify: ['crisis-team', 'supervisor', 'security'],
        tags: ['crisis', 'mental-health', 'immediate'],
        slaMinutes: 1,
      },
      enabled: true,
      metadata: { category: 'health', requiresDocumentation: true },
    },
    {
      name: 'Fraud Detection Emergency',
      description: 'Immediate fraud detection and account security response',
      ruleType: RuleType.FRAUD,
      priorityTier: PriorityTier.PAYMENT_FRAUD,
      conditions: [
        {
          field: 'intent',
          operator: 'regex',
          value: '\\b(hack|breach|stolen card|unauthorized access|account compromised)\\b',
        },
      ],
      actions: {
        routeTo: 'payment-security',
        escalate: true,
        notify: ['fraud-team', 'security', 'compliance'],
        tags: ['fraud', 'security', 'urgent'],
        slaMinutes: 5,
      },
      enabled: true,
      metadata: { category: 'security', requiresDocumentation: true },
    },
    {
      name: 'Safety Threat Detection',
      description: 'Detect immediate safety threats',
      ruleType: RuleType.EMERGENCY,
      priorityTier: PriorityTier.EMERGENCY,
      conditions: [
        {
          field: 'intent',
          operator: 'regex',
          value: '\\b(fire|gas leak|armed|shooting|threat|danger)\\b',
        },
      ],
      actions: {
        routeTo: 'emergency-response',
        escalate: true,
        notify: ['emergency-services', 'security', 'management'],
        tags: ['safety', 'emergency', 'critical'],
        slaMinutes: 0,
      },
      enabled: true,
      metadata: { category: 'safety', requiresDocumentation: true },
    },
  ];
}

export function getEmergencySLA(tier: number): { critical: number; target: number } {
  if (tier === PriorityTier.EMERGENCY) {
    return { critical: 30, target: 60 };
  }
  return { critical: 60, target: 300 };
}

export default {
  EMERGENCY_PATTERNS,
  EMERGENCY_ROUTING_CONFIG,
  detectEmergency,
  createEmergencyRules,
  getEmergencySLA,
};

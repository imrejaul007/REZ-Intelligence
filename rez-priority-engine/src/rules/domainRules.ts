import { PriorityTier, RuleType } from '../models/PriorityRule';
import { PriorityRuleInput } from '../models/PriorityRule';

export interface DomainExpertise {
  domain: string;
  agents: string[];
  keywords: string[];
  priorityBoost: number;
  targetTier: number;
  avgHandlingTime: number;
  requiredSkills: string[];
}

export const DOMAIN_EXPERTISE: DomainExpertise[] = [
  {
    domain: 'hotel-ota',
    agents: ['hotel-expert-1', 'hotel-expert-2', 'hotel-expert-3'],
    keywords: [
      'hotel booking',
      'reservation',
      'check-in',
      'check-out',
      'room upgrade',
      'hotel cancellation',
      'booking modification',
    ],
    priorityBoost: 50,
    targetTier: PriorityTier.DOMAIN_EXPERT,
    avgHandlingTime: 15,
    requiredSkills: ['hotel-systems', 'reservations', 'property-management'],
  },
  {
    domain: 'ad-bazaar',
    agents: ['ad-expert-1', 'ad-expert-2'],
    keywords: [
      'advertising',
      'campaign',
      'ad budget',
      'impressions',
      'click rate',
      'ad performance',
      'targeting',
    ],
    priorityBoost: 50,
    targetTier: PriorityTier.DOMAIN_EXPERT,
    avgHandlingTime: 20,
    requiredSkills: ['ad-platform', 'campaign-management', 'analytics'],
  },
  {
    domain: 'rendez',
    agents: ['rendez-expert-1', 'rendez-expert-2'],
    keywords: [
      'appointment',
      'booking',
      'scheduling',
      'calendar',
      'availability',
      'service provider',
    ],
    priorityBoost: 50,
    targetTier: PriorityTier.DOMAIN_EXPERT,
    avgHandlingTime: 10,
    requiredSkills: ['scheduling', 'calendar-integration', 'provider-management'],
  },
  {
    domain: 'rental',
    agents: ['rental-expert-1', 'rental-expert-2'],
    keywords: [
      'rental car',
      'vehicle',
      'reservation',
      'pickup',
      'dropoff',
      'insurance',
      'upgrade',
    ],
    priorityBoost: 50,
    targetTier: PriorityTier.DOMAIN_EXPERT,
    avgHandlingTime: 15,
    requiredSkills: ['vehicle-management', 'insurance', 'fleet-systems'],
  },
  {
    domain: 'flight',
    agents: ['flight-expert-1', 'flight-expert-2'],
    keywords: [
      'flight booking',
      'airline',
      'flight cancellation',
      'reschedule',
      'boarding pass',
      'flight status',
      'seat selection',
    ],
    priorityBoost: 50,
    targetTier: PriorityTier.DOMAIN_EXPERT,
    avgHandlingTime: 18,
    requiredSkills: ['gds-systems', 'airline-apis', 'fare-rules'],
  },
];

export const DOMAIN_ROUTING_CONFIG = {
  fallbackEnabled: true,
  crossDomainEnabled: true,
  maxQueueTime: 600,
  skillMatchingStrictness: 0.8,
  loadBalancingAlgorithm: 'least-loaded',
};

export function detectDomain(intent: string): DomainExpertise | null {
  const lowerIntent = intent.toLowerCase();

  for (const domain of DOMAIN_EXPERTISE) {
    for (const keyword of domain.keywords) {
      if (lowerIntent.includes(keyword.toLowerCase())) {
        return domain;
      }
    }
  }

  return null;
}

export function createDomainRules(): PriorityRuleInput[] {
  const rules: PriorityRuleInput[] = [];

  for (const domain of DOMAIN_EXPERTISE) {
    rules.push({
      name: `${domain.domain} - General Inquiry`,
      description: `Route ${domain.domain} inquiries to domain experts`,
      ruleType: RuleType.DOMAIN,
      priorityTier: domain.targetTier as PriorityTier,
      conditions: [
        {
          field: 'intent',
          operator: 'in',
          value: domain.keywords.slice(0, 3),
        },
      ],
      actions: {
        routeTo: `${domain.domain}-experts`,
        escalate: false,
        notify: [`${domain.domain}-team`],
        tags: [domain.domain, 'domain-expert'],
        slaMinutes: 30,
      },
      enabled: true,
      domain: domain.domain,
      metadata: {
        requiredSkills: domain.requiredSkills,
        avgHandlingTime: domain.avgHandlingTime,
      },
    });

    rules.push({
      name: `${domain.domain} - Urgent Inquiry`,
      description: `Route urgent ${domain.domain} inquiries with priority`,
      ruleType: RuleType.DOMAIN,
      priorityTier: PriorityTier.SUPPORT,
      conditions: [
        {
          field: 'intent',
          operator: 'contains',
          value: 'urgent',
        },
        {
          field: 'domain',
          operator: 'eq',
          value: domain.domain,
        },
      ],
      actions: {
        routeTo: `${domain.domain}-urgent`,
        escalate: true,
        notify: [`${domain.domain}-team`, 'supervisor'],
        tags: [domain.domain, 'urgent'],
        slaMinutes: 10,
      },
      enabled: true,
      domain: domain.domain,
      metadata: {
        requiredSkills: domain.requiredSkills,
        urgent: true,
      },
    });
  }

  rules.push({
    name: 'Cross-Domain Inquiry',
    description: 'Handle inquiries spanning multiple domains',
    ruleType: RuleType.DOMAIN,
    priorityTier: PriorityTier.SUPPORT,
    conditions: [
      {
        field: 'intent',
        operator: 'contains',
        value: 'multiple',
      },
    ],
    actions: {
      routeTo: 'cross-domain',
      escalate: false,
      notify: ['triage-team'],
      tags: ['cross-domain', 'complex'],
      slaMinutes: 45,
    },
    enabled: true,
    metadata: { requiresTriage: true },
  });

  return rules;
}

export function calculateDomainMatchScore(
  intent: string,
  domain: DomainExpertise
): number {
  const lowerIntent = intent.toLowerCase();
  let score = 0;

  for (const keyword of domain.keywords) {
    if (lowerIntent.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }

  const domainNameMatches = lowerIntent.includes(domain.domain.toLowerCase());
  if (domainNameMatches) {
    score += 20;
  }

  return Math.min(100, score);
}

export function getDomainAgents(domain: string): string[] {
  const domainExpertise = DOMAIN_EXPERTISE.find(
    (d) => d.domain === domain
  );
  return domainExpertise?.agents || [];
}

export default {
  DOMAIN_EXPERTISE,
  DOMAIN_ROUTING_CONFIG,
  detectDomain,
  createDomainRules,
  calculateDomainMatchScore,
  getDomainAgents,
};

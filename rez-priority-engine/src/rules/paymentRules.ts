import { PriorityTier, RuleType } from '../models/PriorityRule';
import { PriorityRuleInput } from '../models/PriorityRule';

export interface PaymentCondition {
  type: 'payment_issue' | 'refund_request' | 'billing_dispute' | 'subscription' | 'fraud_suspect';
  keywords: string[];
  priorityBoost: number;
  targetTier: number;
  slaMinutes: number;
  description: string;
}

export const PAYMENT_CONDITIONS: PaymentCondition[] = [
  {
    type: 'fraud_suspect',
    keywords: [
      'unauthorized transaction',
      'someone used my card',
      'fraudulent charge',
      'card compromised',
      'suspicious activity',
      'not my purchase',
    ],
    priorityBoost: 90,
    targetTier: PriorityTier.PAYMENT_FRAUD,
    slaMinutes: 5,
    description: 'Suspected fraud - immediate review required',
  },
  {
    type: 'payment_issue',
    keywords: [
      'payment failed',
      'transaction declined',
      'cant pay',
      'payment not working',
      'unable to complete payment',
      'payment error',
    ],
    priorityBoost: 75,
    targetTier: PriorityTier.PAYMENT_FRAUD,
    slaMinutes: 15,
    description: 'Payment processing issue - customer cannot complete transaction',
  },
  {
    type: 'refund_request',
    keywords: [
      'refund',
      'money back',
      'cancel and refund',
      'return and refund',
      'get my money back',
    ],
    priorityBoost: 60,
    targetTier: PriorityTier.SUPPORT,
    slaMinutes: 30,
    description: 'Refund request - standard processing',
  },
  {
    type: 'billing_dispute',
    keywords: [
      'wrong charge',
      'overcharged',
      'billing error',
      'duplicate charge',
      'never received',
      'dispute',
    ],
    priorityBoost: 70,
    targetTier: PriorityTier.PAYMENT_FRAUD,
    slaMinutes: 20,
    description: 'Billing dispute - requires investigation',
  },
  {
    type: 'subscription',
    keywords: [
      'cancel subscription',
      'change plan',
      'upgrade',
      'downgrade',
      'subscription issue',
      'billing cycle',
    ],
    priorityBoost: 45,
    targetTier: PriorityTier.SUPPORT,
    slaMinutes: 60,
    description: 'Subscription management - standard queue',
  },
];

export const FRAUD_INDICATORS = {
  highRiskPatterns: [
    /\b(stolen|fake|counterfeit)\s*(card)?\b/i,
    /\b(multiple|multiple)\s*(failed|declined)\s*(attempts|transactions)\b/i,
    /\b(unusual|abnormal)\s*(location|device|ip)\b/i,
    /\b(vpn|proxy|tor)\s*(detected|used)\b/i,
    /\b(different|cross)\s*(country|region)\s*(transaction|purchase)\b/i,
  ],
  velocityRules: {
    maxTransactionsPerHour: 10,
    maxAmountPerHour: 5000,
    maxCardsPerAccount: 3,
    maxFailedAttempts: 5,
  },
};

export function detectPaymentIssue(intent: string): PaymentCondition | null {
  const lowerIntent = intent.toLowerCase();

  for (const condition of PAYMENT_CONDITIONS) {
    for (const keyword of condition.keywords) {
      if (lowerIntent.includes(keyword.toLowerCase())) {
        return condition;
      }
    }
  }

  return null;
}

export function detectFraudIndicators(intent: string): { isFraudulent: boolean; indicators: string[] } {
  const indicators: string[] = [];

  for (const pattern of FRAUD_INDICATORS.highRiskPatterns) {
    if (pattern.test(intent)) {
      indicators.push(pattern.source);
    }
  }

  return {
    isFraudulent: indicators.length >= 2,
    indicators,
  };
}

export function createPaymentRules(): PriorityRuleInput[] {
  return [
    {
      name: 'Fraud Detection - Unauthorized Transaction',
      description: 'Detect unauthorized transaction attempts',
      ruleType: RuleType.FRAUD,
      priorityTier: PriorityTier.PAYMENT_FRAUD,
      conditions: [
        {
          field: 'intent',
          operator: 'contains',
          value: 'unauthorized',
        },
        {
          field: 'intent',
          operator: 'contains',
          value: 'transaction',
        },
      ],
      actions: {
        routeTo: 'payment-security',
        escalate: true,
        notify: ['fraud-team', 'security'],
        tags: ['fraud', 'unauthorized', 'high-priority'],
        slaMinutes: 5,
      },
      enabled: true,
      metadata: { requiresInvestigation: true },
    },
    {
      name: 'Payment Processing Failure',
      description: 'Handle payment processing failures',
      ruleType: RuleType.PAYMENT,
      priorityTier: PriorityTier.PAYMENT_FRAUD,
      conditions: [
        {
          field: 'intent',
          operator: 'in',
          value: ['payment failed', 'transaction declined', 'payment error', 'unable to pay'],
        },
      ],
      actions: {
        routeTo: 'payment-support',
        escalate: false,
        notify: ['payment-team'],
        tags: ['payment', 'failed', 'processing'],
        slaMinutes: 15,
      },
      enabled: true,
      metadata: { category: 'payment' },
    },
    {
      name: 'Refund Request - High Value',
      description: 'Process high-value refund requests with priority',
      ruleType: RuleType.PAYMENT,
      priorityTier: PriorityTier.SUPPORT,
      conditions: [
        {
          field: 'intent',
          operator: 'contains',
          value: 'refund',
        },
        {
          field: 'metadata.amount',
          operator: 'gt',
          value: 1000,
        },
      ],
      actions: {
        routeTo: 'refund-processing',
        escalate: false,
        notify: ['refund-team', 'finance'],
        tags: ['refund', 'high-value'],
        slaMinutes: 30,
      },
      enabled: true,
      metadata: { requiresApproval: true, threshold: 1000 },
    },
    {
      name: 'Billing Dispute Investigation',
      description: 'Route billing disputes for investigation',
      ruleType: RuleType.PAYMENT,
      priorityTier: PriorityTier.PAYMENT_FRAUD,
      conditions: [
        {
          field: 'intent',
          operator: 'contains',
          value: 'dispute',
        },
      ],
      actions: {
        routeTo: 'billing-disputes',
        escalate: false,
        notify: ['billing-team', 'compliance'],
        tags: ['billing', 'dispute', 'investigation'],
        slaMinutes: 20,
      },
      enabled: true,
      metadata: { requiresDocumentation: true },
    },
    {
      name: 'Subscription Cancellation - Churn Risk',
      description: 'Handle subscription cancellations with retention focus',
      ruleType: RuleType.SUPPORT,
      priorityTier: PriorityTier.LOYALTY,
      conditions: [
        {
          field: 'intent',
          operator: 'contains',
          value: 'cancel subscription',
        },
      ],
      actions: {
        routeTo: 'retention',
        escalate: false,
        notify: ['retention-team'],
        tags: ['subscription', 'cancellation', 'retention'],
        slaMinutes: 30,
      },
      enabled: true,
      metadata: { churnRisk: true, requiresRetentionOffer: true },
    },
  ];
}

export function calculatePaymentRiskScore(
  factors: {
    amount?: number;
    transactionCount?: number;
    failedAttempts?: number;
    isNewCard?: boolean;
    isInternational?: boolean;
    hasVpn?: boolean;
  }
): number {
  let score = 0;

  if (factors.amount && factors.amount > 1000) score += 30;
  else if (factors.amount && factors.amount > 500) score += 15;

  if (factors.transactionCount && factors.transactionCount > 5) score += 25;
  else if (factors.transactionCount && factors.transactionCount > 3) score += 10;

  if (factors.failedAttempts && factors.failedAttempts > 3) score += 20;
  else if (factors.failedAttempts && factors.failedAttempts > 1) score += 10;

  if (factors.isNewCard) score += 10;
  if (factors.isInternational) score += 15;
  if (factors.hasVpn) score += 25;

  return Math.min(100, score);
}

export default {
  PAYMENT_CONDITIONS,
  FRAUD_INDICATORS,
  detectPaymentIssue,
  detectFraudIndicators,
  createPaymentRules,
  calculatePaymentRiskScore,
};

import { PriorityTier, PriorityTierValue } from '../models/PriorityRule';
import { detectEmergency, EmergencyCondition } from '../rules/emergencyRules';
import { detectPaymentIssue, PaymentCondition } from '../rules/paymentRules';
import { detectDomain, DomainExpertise } from '../rules/domainRules';
import { logger } from '../utils/logger.js';

export interface ClassifiedIntent {
  intent: string;
  primaryType: IntentType;
  confidence: number;
  priorityTier: PriorityTierValue;
  priorityScore: number;
  modifiers: IntentModifiers;
  detectedPatterns: DetectedPattern[];
}

export type IntentType =
  | 'emergency'
  | 'payment'
  | 'fraud'
  | 'support'
  | 'domain'
  | 'sales'
  | 'loyalty'
  | 'analytics'
  | 'general';

export interface IntentModifiers {
  urgency: number;
  complexity: number;
  customerTier: number;
  businessImpact: number;
  domainMatch: string | null;
}

export interface DetectedPattern {
  type: 'emergency' | 'payment' | 'domain' | 'custom';
  pattern: string;
  confidence: number;
  matchedKeyword?: string;
}

const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  emergency: [
    /\b(emergency|urgent|critical|asap|immediate)\b/i,
    /\b(help|danger|threat|safety)\b/i,
  ],
  payment: [
    /\b(payment|pay|transaction|refund|charge|invoice|billing)\b/i,
    /\b(card|card|bank|account)\b/i,
  ],
  fraud: [
    /\b(fraud|stolen|hack|unauthorized|suspicious|scam)\b/i,
    /\b(security|breach|compromise)\b/i,
  ],
  support: [
    /\b(help|support|issue|problem|question|assistance)\b/i,
    /\b(cannot|cant|unable|not working|broken)\b/i,
  ],
  domain: [
    /\b(booking|reservation|hotel|flight|car|rental)\b/i,
    /\b(schedule|appointment|service)\b/i,
  ],
  sales: [
    /\b(buy|purchase|order|pricing|cost|deal|offer)\b/i,
    /\b(subscribe|signup|sign up|register)\b/i,
  ],
  loyalty: [
    /\b(points|rewards|membership|vip|gold|silver|bronze)\b/i,
    /\b(loyalty|reward|cashback|discount|coupon)\b/i,
  ],
  analytics: [
    /\b(report|analytics|metrics|dashboard|data|insights)\b/i,
    /\b(statistics| trends|analysis)\b/i,
  ],
  general: [],
};

const SALES_KEYWORDS = [
  'buy now',
  'purchase',
  'order now',
  'special offer',
  'discount',
  'deal',
  'pricing',
  'subscription',
  'upgrade',
  'premium',
];

const LOYALTY_KEYWORDS = [
  'loyalty points',
  'rewards',
  'membership',
  'vip',
  'cashback',
  'coupon',
  'discount code',
  'my points',
];

const ANALYTICS_KEYWORDS = [
  'report',
  'analytics',
  'metrics',
  'dashboard',
  'data export',
  'insights',
  'trends',
];

export class IntentClassifier {
  private cache: Map<string, ClassifiedIntent> = new Map();
  private maxCacheSize = 1000;

  classify(intent: string, context?: Record<string, unknown>): ClassifiedIntent {
    const cacheKey = `${intent}:${JSON.stringify(context || {})}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const detectedPatterns: DetectedPattern[] = [];
    const modifiers: IntentModifiers = {
      urgency: 0,
      complexity: 0,
      customerTier: context?.customerTier as number || 0,
      businessImpact: 0,
      domainMatch: null,
    };

    let primaryType: IntentType = 'general';
    let confidence = 0.5;
    let priorityTier: PriorityTierValue = PriorityTier.ANALYTICS;
    let priorityScore = 10;

    const emergencyMatch = detectEmergency(intent);
    if (emergencyMatch) {
      primaryType = 'emergency';
      confidence = 0.95;
      priorityTier = emergencyMatch.targetTier as PriorityTierValue;
      priorityScore = emergencyMatch.priorityBoost;
      modifiers.urgency = 100;
      modifiers.businessImpact = 100;
      detectedPatterns.push({
        type: 'emergency',
        pattern: emergencyMatch.description,
        confidence: 0.95,
      });
    }

    if (primaryType !== 'emergency') {
      const paymentMatch = detectPaymentIssue(intent);
      if (paymentMatch) {
        primaryType = paymentMatch.type === 'fraud_suspect' ? 'fraud' : 'payment';
        confidence = 0.85;
        priorityTier = paymentMatch.targetTier as PriorityTierValue;
        priorityScore = paymentMatch.priorityBoost;
        modifiers.urgency = 70;
        modifiers.businessImpact = 80;
        detectedPatterns.push({
          type: 'payment',
          pattern: paymentMatch.description,
          confidence: 0.85,
          matchedKeyword: paymentMatch.keywords.find(k =>
            intent.toLowerCase().includes(k.toLowerCase())
          ),
        });
      }
    }

    // Domain detection for general/support intents
    if (primaryType !== 'emergency' && primaryType !== 'payment' && primaryType !== 'fraud') {
      const domainMatch = detectDomain(intent);
      if (domainMatch) {
        primaryType = 'domain';
        confidence = 0.8;
        priorityTier = domainMatch.targetTier as PriorityTierValue;
        priorityScore = domainMatch.priorityBoost;
        modifiers.domainMatch = domainMatch.domain;
        modifiers.complexity = 40;
        detectedPatterns.push({
          type: 'domain',
          pattern: domainMatch.domain,
          confidence: 0.8,
        });
      }
    }

    if (primaryType === 'general') {
      for (const [type, patterns] of Object.entries(INTENT_PATTERNS)) {
        if (type === 'general') continue;

        for (const pattern of patterns) {
          if (pattern.test(intent)) {
            primaryType = type as IntentType;
            confidence = 0.7;
            priorityTier = this.getDefaultTierForType(primaryType);
            priorityScore = this.getDefaultScoreForType(primaryType);
            break;
          }
        }
        if (primaryType !== 'general') break;
      }
    }

    const lowerIntent = intent.toLowerCase();
    for (const keyword of SALES_KEYWORDS) {
      if (lowerIntent.includes(keyword)) {
        primaryType = 'sales';
        confidence = Math.max(confidence, 0.75);
        priorityTier = PriorityTier.SALES;
        priorityScore = 35;
        break;
      }
    }

    for (const keyword of LOYALTY_KEYWORDS) {
      if (lowerIntent.includes(keyword)) {
        primaryType = 'loyalty';
        confidence = Math.max(confidence, 0.75);
        priorityTier = PriorityTier.LOYALTY;
        priorityScore = 20;
        break;
      }
    }

    for (const keyword of ANALYTICS_KEYWORDS) {
      if (lowerIntent.includes(keyword)) {
        primaryType = 'analytics';
        confidence = Math.max(confidence, 0.8);
        priorityTier = PriorityTier.ANALYTICS;
        priorityScore = 10;
        break;
      }
    }

    if (context?.customerTier && typeof context.customerTier === 'number') {
      priorityScore += context.customerTier * 3;
    }

    if (context?.userId) {
      modifiers.businessImpact += 5;
    }

    if (lowerIntent.includes('asap') || lowerIntent.includes('immediately') || lowerIntent.includes('right now')) {
      modifiers.urgency += 30;
      priorityScore = Math.min(100, priorityScore + 15);
    }

    priorityScore = Math.max(0, Math.min(100, priorityScore));
    confidence = Math.max(0, Math.min(1, confidence));

    const result: ClassifiedIntent = {
      intent,
      primaryType,
      confidence,
      priorityTier,
      priorityScore,
      modifiers,
      detectedPatterns,
    };

    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(cacheKey, result);

    logger.debug('Intent classified', {
      intent: intent.substring(0, 50),
      primaryType,
      confidence,
      priorityTier,
      priorityScore,
    });

    return result;
  }

  private getDefaultTierForType(type: IntentType): PriorityTierValue {
    const tierMap: Record<IntentType, PriorityTierValue> = {
      emergency: PriorityTier.EMERGENCY,
      payment: PriorityTier.PAYMENT_FRAUD,
      fraud: PriorityTier.PAYMENT_FRAUD,
      support: PriorityTier.SUPPORT,
      domain: PriorityTier.DOMAIN_EXPERT,
      sales: PriorityTier.SALES,
      loyalty: PriorityTier.LOYALTY,
      analytics: PriorityTier.ANALYTICS,
      general: PriorityTier.ANALYTICS,
    };
    return tierMap[type];
  }

  private getDefaultScoreForType(type: IntentType): number {
    const scoreMap: Record<IntentType, number> = {
      emergency: 95,
      payment: 70,
      fraud: 80,
      support: 60,
      domain: 50,
      sales: 35,
      loyalty: 20,
      analytics: 10,
      general: 10,
    };
    return scoreMap[type];
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Intent classifier cache cleared');
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const intentClassifier = new IntentClassifier();

export default intentClassifier;

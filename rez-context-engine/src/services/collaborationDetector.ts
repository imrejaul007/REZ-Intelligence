import {
  EntryContext,
  MerchantCategory,
  EntryPointType,
  QRCodeType,
} from '../models/EntryContext';
import {
  RoutingDecision,
  ExpertType,
  CollaborationRequirement,
} from '../models/RoutingDecision';
import { logger } from '../utils/logger';

/**
 * Collaboration trigger rules
 */
interface CollaborationTrigger {
  id: string;
  name: string;
  condition: (context: EntryContext, decision: RoutingDecision) => boolean;
  required: boolean;
  secondaryExperts: ExpertType[];
  reason: string;
  minConfidence?: number;
}

/**
 * Categories that commonly require collaboration
 */
const MULTI_DOMAIN_CATEGORIES: Record<string, MerchantCategory[]> = {
  'hotel+restaurant': [MerchantCategory.HOSPITALITY, MerchantCategory.CULINARY],
  'hotel+spa': [MerchantCategory.HOSPITALITY, MerchantCategory.SALON],
  'fitness+health': [MerchantCategory.FITNESS, MerchantCategory.HEALTH],
  'retail+health': [MerchantCategory.RETAIL, MerchantCategory.HEALTH],
  'salon+health': [MerchantCategory.SALON, MerchantCategory.HEALTH],
};

/**
 * Entry type collaboration patterns
 */
const ENTRY_COLLABORATION_PATTERNS: Record<EntryPointType, { required: boolean; reason: string }> = {
  [EntryPointType.VOICE]: {
    required: false,
    reason: 'Voice input may need multi-domain understanding',
  },
  [EntryPointType.API]: {
    required: false,
    reason: 'API requests may span multiple domains',
  },
  [EntryPointType.WEB]: {
    required: false,
    reason: 'Web sessions may navigate across domains',
  },
  [EntryPointType.UNKNOWN]: {
    required: true,
    reason: 'Unknown entry requires broader context',
  },
  [EntryPointType.QR_CODE]: { required: false, reason: '' },
  [EntryPointType.APP]: { required: false, reason: '' },
  [EntryPointType.TEXT]: { required: false, reason: '' },
  [EntryPointType.DEEP_LINK]: { required: false, reason: '' },
  [EntryPointType.NOTIFICATION]: { required: false, reason: '' },
};

/**
 * Merchant category collaboration patterns
 */
const CATEGORY_COLLABORATION_PATTERNS: Record<MerchantCategory, { required: boolean; secondary?: ExpertType[] }> = {
  [MerchantCategory.HOSPITALITY]: { required: false },
  [MerchantCategory.CULINARY]: {
    required: true,
    secondary: [ExpertType.RETAIL],
  }, // Food delivery might need retail for groceries
  [MerchantCategory.FITNESS]: {
    required: true,
    secondary: [ExpertType.HEALTH],
  }, // Fitness often involves health tracking
  [MerchantCategory.HEALTH]: {
    required: true,
    secondary: [ExpertType.FITNESS],
  }, // Health services may need fitness advice
  [MerchantCategory.RETAIL]: {
    required: false,
  },
  [MerchantCategory.SALON]: {
    required: true,
    secondary: [ExpertType.HEALTH],
  }, // Beauty services may involve health considerations
  [MerchantCategory.ENTERTAINMENT]: {
    required: false,
  },
  [MerchantCategory.TRAVEL]: {
    required: true,
    secondary: [ExpertType.HOSPITALITY, ExpertType.CULINARY],
  }, // Travel often involves hotels and dining
  [MerchantCategory.UNKNOWN]: {
    required: true,
    secondary: [ExpertType.GENERAL],
  },
};

export interface CollaborationDetectionResult {
  collaboration: CollaborationRequirement;
  triggers: string[];
}

/**
 * Service for detecting when collaboration between experts is needed
 */
export class CollaborationDetector {
  private triggers: CollaborationTrigger[];

  constructor() {
    this.triggers = this.initializeTriggers();
  }

  /**
   * Initialize collaboration triggers
   */
  private initializeTriggers(): CollaborationTrigger[] {
    return [
      // QR codes that indicate multi-service locations
      {
        id: 'hotel-resort-qr',
        name: 'Hotel Resort QR Collaboration',
        condition: (ctx) =>
          ctx.qrCodeType === QRCodeType.HOTEL &&
          (ctx.merchantName?.toLowerCase().includes('resort') ||
            ctx.merchantName?.toLowerCase().includes('spa') ||
            ctx.merchantName?.toLowerCase().includes('restaurant') ||
            ctx.merchantName?.toLowerCase().includes('gym')),
        required: true,
        secondaryExperts: [ExpertType.CULINARY, ExpertType.SALON, ExpertType.FITNESS],
        reason: 'Resort/hotel with multiple services detected',
      },

      // Fitness centers with health services
      {
        id: 'fitness-health-qr',
        name: 'Fitness Health Collaboration',
        condition: (ctx) =>
          ctx.qrCodeType === QRCodeType.GYM &&
          (ctx.merchantName?.toLowerCase().includes('health') ||
            ctx.merchantName?.toLowerCase().includes('medical') ||
            ctx.merchantName?.toLowerCase().includes('wellness')),
        required: true,
        secondaryExperts: [ExpertType.HEALTH],
        reason: 'Fitness center with health services detected',
      },

      // Salons with health services
      {
        id: 'salon-health-qr',
        name: 'Salon Health Collaboration',
        condition: (ctx) =>
          ctx.qrCodeType === QRCodeType.SALON &&
          (ctx.merchantName?.toLowerCase().includes('medical') ||
            ctx.merchantName?.toLowerCase().includes('dermatology') ||
            ctx.merchantName?.toLowerCase().includes('spa')),
        required: true,
        secondaryExperts: [ExpertType.HEALTH],
        reason: 'Salon with health/medical services detected',
      },

      // Unknown entry types need broader context
      {
        id: 'unknown-entry',
        name: 'Unknown Entry Collaboration',
        condition: (ctx) => ctx.entryType === EntryPointType.UNKNOWN,
        required: true,
        secondaryExperts: [ExpertType.GENERAL],
        reason: 'Unknown entry type requires multi-expert context gathering',
        minConfidence: 0.5,
      },

      // Low confidence decisions
      {
        id: 'low-confidence',
        name: 'Low Confidence Collaboration',
        condition: (_, decision) => decision.primaryConfidence < 0.7,
        required: false,
        secondaryExperts: [ExpertType.GENERAL],
        reason: 'Low confidence in primary expert - seeking additional context',
        minConfidence: 0.5,
      },
    ];
  }

  /**
   * Detect collaboration requirements for a routing decision
   */
  async detect(
    context: EntryContext,
    decision: RoutingDecision
  ): Promise<CollaborationDetectionResult> {
    const startTime = Date.now();
    const triggers: string[] = [];
    let required = false;
    const secondaryExperts: ExpertType[] = [];

    try {
      // Check entry type pattern
      const entryPattern = ENTRY_COLLABORATION_PATTERNS[context.entryType];
      if (entryPattern?.required) {
        required = true;
        triggers.push(`entry-type:${context.entryType}`);
      }

      // Check merchant category pattern
      const categoryPattern = CATEGORY_COLLABORATION_PATTERNS[context.merchantCategory];
      if (categoryPattern?.required) {
        required = true;
        secondaryExperts.push(...(categoryPattern.secondary || []));
        triggers.push(`category:${context.merchantCategory}`);
      }

      // Check custom triggers
      for (const trigger of this.triggers) {
        if (trigger.condition(context, decision)) {
          triggers.push(`trigger:${trigger.id}`);

          if (trigger.minConfidence && decision.primaryConfidence < trigger.minConfidence) {
            continue;
          }

          if (trigger.required) {
            required = true;
          }

          for (const expert of trigger.secondaryExperts) {
            if (!secondaryExperts.includes(expert)) {
              secondaryExperts.push(expert);
            }
          }
        }
      }

      // Remove primary expert from secondary list
      const filteredSecondary = secondaryExperts.filter(
        (expert) => expert !== decision.primaryExpert
      );

      const collaboration: CollaborationRequirement = {
        required,
        primary: decision.primaryExpert,
        secondary: filteredSecondary.length > 0 ? filteredSecondary : undefined,
        reason: required ? this.generateCollaborationReason(triggers, context) : undefined,
        confidence: this.calculateCollaborationConfidence(context, decision, triggers),
      };

      const processingTime = Date.now() - startTime;
      logger.debug('Collaboration detection completed', {
        sessionId: context.sessionId,
        required,
        secondaryCount: filteredSecondary.length,
        processingTimeMs: processingTime,
      });

      return {
        collaboration,
        triggers,
      };
    } catch (error) {
      logger.error('Collaboration detection failed', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate a human-readable reason for collaboration
   */
  private generateCollaborationReason(triggers: string[], context: EntryContext): string {
    if (triggers.length === 0) {
      return 'General collaboration recommended for comprehensive assistance';
    }

    const reasons: string[] = [];

    for (const trigger of triggers) {
      if (trigger.startsWith('trigger:')) {
        const triggerObj = this.triggers.find((t) => `trigger:${t.id}` === trigger);
        if (triggerObj) {
          reasons.push(triggerObj.reason);
        }
      } else if (trigger.startsWith('entry-type:')) {
        const entryType = trigger.replace('entry-type:', '');
        const pattern = ENTRY_COLLABORATION_PATTERNS[entryType as EntryPointType];
        if (pattern?.reason) {
          reasons.push(pattern.reason);
        }
      } else if (trigger.startsWith('category:')) {
        const category = trigger.replace('category:', '');
        reasons.push(`Merchant category ${category} benefits from multi-expert collaboration`);
      }
    }

    return reasons.length > 0
      ? reasons.join('; ')
      : 'Multi-domain context detected, collaboration recommended';
  }

  /**
   * Calculate confidence score for collaboration recommendation
   */
  private calculateCollaborationConfidence(
    context: EntryContext,
    decision: RoutingDecision,
    triggers: string[]
  ): number {
    let confidence = 0.3; // Base confidence

    // Increase based on triggers
    confidence += triggers.length * 0.15;

    // Increase based on entry type
    const entryPattern = ENTRY_COLLABORATION_PATTERNS[context.entryType];
    if (entryPattern?.required) {
      confidence += 0.2;
    }

    // Increase based on merchant category
    const categoryPattern = CATEGORY_COLLABORATION_PATTERNS[context.merchantCategory];
    if (categoryPattern?.required) {
      confidence += 0.25;
    }

    // Decrease based on primary decision confidence
    confidence -= (1 - decision.primaryConfidence) * 0.3;

    // Decrease for known QR types (high certainty)
    if (context.qrCodeType && context.qrCodeType !== QRCodeType.GENERAL) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Add a custom collaboration trigger
   */
  addTrigger(trigger: Omit<CollaborationTrigger, 'id'>): void {
    const newTrigger: CollaborationTrigger = {
      ...trigger,
      id: `custom-${Date.now()}`,
    };
    this.triggers.push(newTrigger);
    logger.info('Custom collaboration trigger added', {
      triggerId: newTrigger.id,
      name: newTrigger.name,
    });
  }

  /**
   * Remove a collaboration trigger
   */
  removeTrigger(triggerId: string): boolean {
    const index = this.triggers.findIndex((t) => t.id === triggerId);
    if (index !== -1) {
      this.triggers.splice(index, 1);
      logger.info('Collaboration trigger removed', { triggerId });
      return true;
    }
    return false;
  }

  /**
   * Get all active collaboration triggers
   */
  getTriggers(): CollaborationTrigger[] {
    return [...this.triggers];
  }

  /**
   * Check if two experts should collaborate based on context
   */
  shouldCollaborate(expert1: ExpertType, expert2: ExpertType, context: EntryContext): boolean {
    // Experts should collaborate if they serve related categories
    const relatedPairs: Array<[ExpertType, ExpertType][]> = [
      [ExpertType.HOSPITALITY, ExpertType.CULINARY],
      [ExpertType.HOSPITALITY, ExpertType.SALON],
      [ExpertType.FITNESS, ExpertType.HEALTH],
      [ExpertType.HEALTH, ExpertType.SALON],
      [ExpertType.RETAIL, ExpertType.CULINARY],
      [ExpertType.HOSPITALITY, ExpertType.TRAVEL],
    ];

    return relatedPairs.some(
      (pair) =>
        (pair[0] === expert1 && pair[1] === expert2) ||
        (pair[1] === expert1 && pair[0] === expert2)
    );
  }
}

// Export singleton instance
export const collaborationDetector = new CollaborationDetector();

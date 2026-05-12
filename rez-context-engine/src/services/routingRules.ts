import { v4 as uuidv4 } from 'uuid';
import {
  EntryContext,
  MerchantCategory,
  QRCodeType,
  ReZPlatform,
  EntryPointType,
} from '../models/EntryContext';
import {
  RoutingDecision,
  ExpertType,
  RoutingPriority,
  RoutingReason,
  createDefaultRoutingDecision,
} from '../models/RoutingDecision';
import { logger } from '../utils/logger';

/**
 * Routing rule definition
 */
interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  condition: (context: EntryContext) => boolean;
  expert: ExpertType;
  confidence: number;
  reason: string;
}

/**
 * Mapping from QR code types to expert types
 */
const QR_TO_EXPERT: Record<QRCodeType, ExpertType> = {
  [QRCodeType.HOTEL]: ExpertType.HOSPITALITY,
  [QRCodeType.RESTAURANT]: ExpertType.CULINARY,
  [QRCodeType.GYM]: ExpertType.FITNESS,
  [QRCodeType.CLINIC]: ExpertType.HEALTH,
  [QRCodeType.RETAIL]: ExpertType.RETAIL,
  [QRCodeType.SALON]: ExpertType.SALON,
  [QRCodeType.GENERAL]: ExpertType.GENERAL,
};

/**
 * Mapping from merchant categories to expert types
 */
const CATEGORY_TO_EXPERT: Record<MerchantCategory, ExpertType> = {
  [MerchantCategory.HOSPITALITY]: ExpertType.HOSPITALITY,
  [MerchantCategory.CULINARY]: ExpertType.CULINARY,
  [MerchantCategory.FITNESS]: ExpertType.FITNESS,
  [MerchantCategory.HEALTH]: ExpertType.HEALTH,
  [MerchantCategory.RETAIL]: ExpertType.RETAIL,
  [MerchantCategory.SALON]: ExpertType.SALON,
  [MerchantCategory.ENTERTAINMENT]: ExpertType.GENERAL,
  [MerchantCategory.TRAVEL]: ExpertType.HOSPITALITY,
  [MerchantCategory.UNKNOWN]: ExpertType.GENERAL,
};

/**
 * Mapping from ReZ platforms to expert types
 */
const PLATFORM_TO_EXPERT: Record<ReZPlatform, ExpertType> = {
  [ReZPlatform.WEB_MENU]: ExpertType.CULINARY,
  [ReZPlatform.STAY]: ExpertType.HOSPITALITY,
  [ReZPlatform.FIT]: ExpertType.FITNESS,
  [ReZPlatform.HEALTH]: ExpertType.HEALTH,
  [ReZPlatform.GENERAL]: ExpertType.GENERAL,
};

/**
 * Expert routing priority based on entry type
 */
const ENTRY_TYPE_PRIORITY: Record<EntryPointType, RoutingPriority> = {
  [EntryPointType.QR_CODE]: RoutingPriority.HIGH,
  [EntryPointType.APP]: RoutingPriority.HIGH,
  [EntryPointType.DEEP_LINK]: RoutingPriority.HIGH,
  [EntryPointType.VOICE]: RoutingPriority.MEDIUM,
  [EntryPointType.TEXT]: RoutingPriority.MEDIUM,
  [EntryPointType.WEB]: RoutingPriority.MEDIUM,
  [EntryPointType.API]: RoutingPriority.LOW,
  [EntryPointType.NOTIFICATION]: RoutingPriority.LOW,
  [EntryPointType.UNKNOWN]: RoutingPriority.LOW,
};

export interface RoutingResult {
  decision: RoutingDecision;
  rulesApplied: string[];
  processingTimeMs: number;
}

/**
 * Routing rules engine that determines which expert should handle a request
 */
export class RoutingRulesEngine {
  private rules: RoutingRule[];

  constructor() {
    this.rules = this.initializeRules();
  }

  /**
   * Initialize routing rules
   */
  private initializeRules(): RoutingRule[] {
    return [
      // QR Code Rules (highest priority)
      {
        id: 'qr-hotel',
        name: 'QR Hotel Rule',
        priority: 100,
        condition: (ctx) => ctx.qrCodeType === QRCodeType.HOTEL,
        expert: ExpertType.HOSPITALITY,
        confidence: 0.95,
        reason: 'QR code indicates hotel/hospitality context',
      },
      {
        id: 'qr-restaurant',
        name: 'QR Restaurant Rule',
        priority: 100,
        condition: (ctx) => ctx.qrCodeType === QRCodeType.RESTAURANT,
        expert: ExpertType.CULINARY,
        confidence: 0.95,
        reason: 'QR code indicates restaurant/culinary context',
      },
      {
        id: 'qr-gym',
        name: 'QR Gym Rule',
        priority: 100,
        condition: (ctx) => ctx.qrCodeType === QRCodeType.GYM,
        expert: ExpertType.FITNESS,
        confidence: 0.95,
        reason: 'QR code indicates gym/fitness context',
      },
      {
        id: 'qr-clinic',
        name: 'QR Clinic Rule',
        priority: 100,
        condition: (ctx) => ctx.qrCodeType === QRCodeType.CLINIC,
        expert: ExpertType.HEALTH,
        confidence: 0.95,
        reason: 'QR code indicates clinic/health context',
      },
      {
        id: 'qr-retail',
        name: 'QR Retail Rule',
        priority: 100,
        condition: (ctx) => ctx.qrCodeType === QRCodeType.RETAIL,
        expert: ExpertType.RETAIL,
        confidence: 0.95,
        reason: 'QR code indicates retail context',
      },
      {
        id: 'qr-salon',
        name: 'QR Salon Rule',
        priority: 100,
        condition: (ctx) => ctx.qrCodeType === QRCodeType.SALON,
        expert: ExpertType.SALON,
        confidence: 0.95,
        reason: 'QR code indicates salon/beauty context',
      },

      // ReZ Platform Rules
      {
        id: 'rez-web-menu',
        name: 'ReZ Web Menu Rule',
        priority: 90,
        condition: (ctx) => ctx.rePlatform === ReZPlatform.WEB_MENU,
        expert: ExpertType.CULINARY,
        confidence: 0.9,
        reason: 'ReZ platform: Web Menu (culinary)',
      },
      {
        id: 'rez-stay',
        name: 'ReZ Stay Rule',
        priority: 90,
        condition: (ctx) => ctx.rePlatform === ReZPlatform.STAY,
        expert: ExpertType.HOSPITALITY,
        confidence: 0.9,
        reason: 'ReZ platform: Stay (hospitality)',
      },
      {
        id: 'rez-fit',
        name: 'ReZ Fit Rule',
        priority: 90,
        condition: (ctx) => ctx.rePlatform === ReZPlatform.FIT,
        expert: ExpertType.FITNESS,
        confidence: 0.9,
        reason: 'ReZ platform: Fit (fitness)',
      },
      {
        id: 'rez-health',
        name: 'ReZ Health Rule',
        priority: 90,
        condition: (ctx) => ctx.rePlatform === ReZPlatform.HEALTH,
        expert: ExpertType.HEALTH,
        confidence: 0.9,
        reason: 'ReZ platform: Health',
      },

      // Merchant Category Rules
      {
        id: 'cat-hospitality',
        name: 'Merchant Category Hospitality',
        priority: 80,
        condition: (ctx) => ctx.merchantCategory === MerchantCategory.HOSPITALITY,
        expert: ExpertType.HOSPITALITY,
        confidence: 0.85,
        reason: 'Merchant category: Hospitality',
      },
      {
        id: 'cat-culinary',
        name: 'Merchant Category Culinary',
        priority: 80,
        condition: (ctx) => ctx.merchantCategory === MerchantCategory.CULINARY,
        expert: ExpertType.CULINARY,
        confidence: 0.85,
        reason: 'Merchant category: Culinary',
      },
      {
        id: 'cat-fitness',
        name: 'Merchant Category Fitness',
        priority: 80,
        condition: (ctx) => ctx.merchantCategory === MerchantCategory.FITNESS,
        expert: ExpertType.FITNESS,
        confidence: 0.85,
        reason: 'Merchant category: Fitness',
      },
      {
        id: 'cat-health',
        name: 'Merchant Category Health',
        priority: 80,
        condition: (ctx) => ctx.merchantCategory === MerchantCategory.HEALTH,
        expert: ExpertType.HEALTH,
        confidence: 0.85,
        reason: 'Merchant category: Health',
      },
      {
        id: 'cat-retail',
        name: 'Merchant Category Retail',
        priority: 80,
        condition: (ctx) => ctx.merchantCategory === MerchantCategory.RETAIL,
        expert: ExpertType.RETAIL,
        confidence: 0.85,
        reason: 'Merchant category: Retail',
      },
      {
        id: 'cat-salon',
        name: 'Merchant Category Salon',
        priority: 80,
        condition: (ctx) => ctx.merchantCategory === MerchantCategory.SALON,
        expert: ExpertType.SALON,
        confidence: 0.85,
        reason: 'Merchant category: Salon',
      },

      // Entry Type Fallback Rules
      {
        id: 'entry-qr',
        name: 'QR Entry Type Fallback',
        priority: 70,
        condition: (ctx) => ctx.entryType === EntryPointType.QR_CODE,
        expert: ExpertType.GENERAL,
        confidence: 0.6,
        reason: 'QR code entry type (generic)',
      },
      {
        id: 'entry-voice',
        name: 'Voice Entry Type Fallback',
        priority: 70,
        condition: (ctx) => ctx.entryType === EntryPointType.VOICE,
        expert: ExpertType.GENERAL,
        confidence: 0.5,
        reason: 'Voice entry type (requires context inference)',
      },
      {
        id: 'entry-app',
        name: 'App Entry Type Fallback',
        priority: 70,
        condition: (ctx) => ctx.entryType === EntryPointType.APP,
        expert: ExpertType.GENERAL,
        confidence: 0.5,
        reason: 'App entry type (requires context inference)',
      },
    ];
  }

  /**
   * Determine routing decision from entry context
   */
  async determineRouting(context: EntryContext): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      const decision = createDefaultRoutingDecision(context.sessionId);
      decision.id = uuidv4();
      decision.entryContextId = context.id;
      decision.userId = context.userId;

      const rulesApplied: string[] = [];
      const reasons: RoutingReason[] = [];

      // Apply rules and collect results
      const matchingRules = this.rules
        .filter((rule) => rule.condition(context))
        .sort((a, b) => b.priority - a.priority);

      if (matchingRules.length > 0) {
        // Use highest priority rule for primary expert
        const primaryRule = matchingRules[0];
        decision.primaryExpert = primaryRule.expert;
        decision.primaryConfidence = primaryRule.confidence;
        decision.priority = ENTRY_TYPE_PRIORITY[context.entryType];

        reasons.push({
          rule: primaryRule.id,
          score: primaryRule.confidence,
          description: primaryRule.reason,
        });
        rulesApplied.push(primaryRule.id);

        // Check for secondary matches (for fallback)
        if (matchingRules.length > 1) {
          const secondaryRule = matchingRules[1];
          decision.fallbackExpert = secondaryRule.expert;
          decision.fallbackConfidence = secondaryRule.confidence;
          rulesApplied.push(secondaryRule.id);
        }

        // Add other matching rules as reasons
        for (let i = 1; i < Math.min(matchingRules.length, 4); i++) {
          reasons.push({
            rule: matchingRules[i].id,
            score: matchingRules[i].confidence,
            description: matchingRules[i].reason,
          });
        }
      } else {
        // No matching rules - use defaults based on context
        const fallback = this.getFallbackExpert(context);
        decision.primaryExpert = fallback.expert;
        decision.primaryConfidence = fallback.confidence;
        decision.priority = ENTRY_TYPE_PRIORITY[context.entryType];

        reasons.push({
          rule: 'fallback',
          score: fallback.confidence,
          description: fallback.reason,
        });
        rulesApplied.push('fallback');
      }

      decision.primaryReasons = reasons;

      // Build context summary
      decision.contextSummary = {
        entryType: context.entryType,
        merchantCategory: context.merchantCategory,
        qrCodeType: context.qrCodeType,
        rePlatform: context.rePlatform,
      };

      decision.processingTimeMs = Date.now() - startTime;
      decision.rulesApplied = rulesApplied;
      decision.decidedAt = new Date();

      logger.info('Routing decision made', {
        sessionId: context.sessionId,
        expert: decision.primaryExpert,
        confidence: decision.primaryConfidence,
        rulesApplied,
        processingTimeMs: decision.processingTimeMs,
      });

      return {
        decision,
        rulesApplied,
        processingTimeMs: decision.processingTimeMs,
      };
    } catch (error) {
      logger.error('Routing decision failed', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get fallback expert based on available context
   */
  private getFallbackExpert(context: EntryContext): {
    expert: ExpertType;
    confidence: number;
    reason: string;
  } {
    // Try merchant category
    if (context.merchantCategory !== MerchantCategory.UNKNOWN) {
      return {
        expert: CATEGORY_TO_EXPERT[context.merchantCategory],
        confidence: 0.7,
        reason: `Fallback based on merchant category: ${context.merchantCategory}`,
      };
    }

    // Try QR code type
    if (context.qrCodeType && context.qrCodeType !== QRCodeType.GENERAL) {
      return {
        expert: QR_TO_EXPERT[context.qrCodeType],
        confidence: 0.7,
        reason: `Fallback based on QR type: ${context.qrCodeType}`,
      };
    }

    // Try ReZ platform
    if (context.rePlatform && context.rePlatform !== ReZPlatform.GENERAL) {
      return {
        expert: PLATFORM_TO_EXPERT[context.rePlatform],
        confidence: 0.7,
        reason: `Fallback based on platform: ${context.rePlatform}`,
      };
    }

    // Default to general expert
    return {
      expert: ExpertType.GENERAL,
      confidence: 0.3,
      reason: 'No specific context available, defaulting to general expert',
    };
  }

  /**
   * Add a custom routing rule
   */
  addRule(rule: Omit<RoutingRule, 'id'>): void {
    const newRule: RoutingRule = {
      ...rule,
      id: `custom-${uuidv4()}`,
    };
    this.rules.push(newRule);
    logger.info('Custom routing rule added', { ruleId: newRule.id, name: newRule.name });
  }

  /**
   * Remove a routing rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      logger.info('Routing rule removed', { ruleId });
      return true;
    }
    return false;
  }

  /**
   * Get all active routing rules
   */
  getRules(): RoutingRule[] {
    return [...this.rules];
  }

  /**
   * Get expert type for a QR code type
   */
  getExpertForQRCode(qrType: QRCodeType): ExpertType {
    return QR_TO_EXPERT[qrType] || ExpertType.GENERAL;
  }

  /**
   * Get expert type for a merchant category
   */
  getExpertForCategory(category: MerchantCategory): ExpertType {
    return CATEGORY_TO_EXPERT[category] || ExpertType.GENERAL;
  }

  /**
   * Get expert type for a ReZ platform
   */
  getExpertForPlatform(platform: ReZPlatform): ExpertType {
    return PLATFORM_TO_EXPERT[platform] || ExpertType.GENERAL;
  }
}

// Export singleton instance
export const routingRulesEngine = new RoutingRulesEngine();

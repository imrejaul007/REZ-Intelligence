"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routingRulesEngine = exports.RoutingRulesEngine = void 0;
const uuid_1 = require("uuid");
const EntryContext_1 = require("../models/EntryContext");
const RoutingDecision_1 = require("../models/RoutingDecision");
const logger_js_1 = require("../utils/logger.js");
/**
 * Mapping from QR code types to expert types
 */
const QR_TO_EXPERT = {
    [EntryContext_1.QRCodeType.HOTEL]: RoutingDecision_1.ExpertType.HOSPITALITY,
    [EntryContext_1.QRCodeType.RESTAURANT]: RoutingDecision_1.ExpertType.CULINARY,
    [EntryContext_1.QRCodeType.GYM]: RoutingDecision_1.ExpertType.FITNESS,
    [EntryContext_1.QRCodeType.CLINIC]: RoutingDecision_1.ExpertType.HEALTH,
    [EntryContext_1.QRCodeType.RETAIL]: RoutingDecision_1.ExpertType.RETAIL,
    [EntryContext_1.QRCodeType.SALON]: RoutingDecision_1.ExpertType.SALON,
    [EntryContext_1.QRCodeType.GENERAL]: RoutingDecision_1.ExpertType.GENERAL,
};
/**
 * Mapping from merchant categories to expert types
 */
const CATEGORY_TO_EXPERT = {
    [EntryContext_1.MerchantCategory.HOSPITALITY]: RoutingDecision_1.ExpertType.HOSPITALITY,
    [EntryContext_1.MerchantCategory.CULINARY]: RoutingDecision_1.ExpertType.CULINARY,
    [EntryContext_1.MerchantCategory.FITNESS]: RoutingDecision_1.ExpertType.FITNESS,
    [EntryContext_1.MerchantCategory.HEALTH]: RoutingDecision_1.ExpertType.HEALTH,
    [EntryContext_1.MerchantCategory.RETAIL]: RoutingDecision_1.ExpertType.RETAIL,
    [EntryContext_1.MerchantCategory.SALON]: RoutingDecision_1.ExpertType.SALON,
    [EntryContext_1.MerchantCategory.ENTERTAINMENT]: RoutingDecision_1.ExpertType.GENERAL,
    [EntryContext_1.MerchantCategory.TRAVEL]: RoutingDecision_1.ExpertType.HOSPITALITY,
    [EntryContext_1.MerchantCategory.UNKNOWN]: RoutingDecision_1.ExpertType.GENERAL,
};
/**
 * Mapping from ReZ platforms to expert types
 */
const PLATFORM_TO_EXPERT = {
    [EntryContext_1.ReZPlatform.WEB_MENU]: RoutingDecision_1.ExpertType.CULINARY,
    [EntryContext_1.ReZPlatform.STAY]: RoutingDecision_1.ExpertType.HOSPITALITY,
    [EntryContext_1.ReZPlatform.FIT]: RoutingDecision_1.ExpertType.FITNESS,
    [EntryContext_1.ReZPlatform.HEALTH]: RoutingDecision_1.ExpertType.HEALTH,
    [EntryContext_1.ReZPlatform.GENERAL]: RoutingDecision_1.ExpertType.GENERAL,
};
/**
 * Expert routing priority based on entry type
 */
const ENTRY_TYPE_PRIORITY = {
    [EntryContext_1.EntryPointType.QR_CODE]: RoutingDecision_1.RoutingPriority.HIGH,
    [EntryContext_1.EntryPointType.APP]: RoutingDecision_1.RoutingPriority.HIGH,
    [EntryContext_1.EntryPointType.DEEP_LINK]: RoutingDecision_1.RoutingPriority.HIGH,
    [EntryContext_1.EntryPointType.VOICE]: RoutingDecision_1.RoutingPriority.MEDIUM,
    [EntryContext_1.EntryPointType.TEXT]: RoutingDecision_1.RoutingPriority.MEDIUM,
    [EntryContext_1.EntryPointType.WEB]: RoutingDecision_1.RoutingPriority.MEDIUM,
    [EntryContext_1.EntryPointType.API]: RoutingDecision_1.RoutingPriority.LOW,
    [EntryContext_1.EntryPointType.NOTIFICATION]: RoutingDecision_1.RoutingPriority.LOW,
    [EntryContext_1.EntryPointType.UNKNOWN]: RoutingDecision_1.RoutingPriority.LOW,
};
/**
 * Routing rules engine that determines which expert should handle a request
 */
class RoutingRulesEngine {
    rules;
    constructor() {
        this.rules = this.initializeRules();
    }
    /**
     * Initialize routing rules
     */
    initializeRules() {
        return [
            // QR Code Rules (highest priority)
            {
                id: 'qr-hotel',
                name: 'QR Hotel Rule',
                priority: 100,
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.HOTEL,
                expert: RoutingDecision_1.ExpertType.HOSPITALITY,
                confidence: 0.95,
                reason: 'QR code indicates hotel/hospitality context',
            },
            {
                id: 'qr-restaurant',
                name: 'QR Restaurant Rule',
                priority: 100,
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.RESTAURANT,
                expert: RoutingDecision_1.ExpertType.CULINARY,
                confidence: 0.95,
                reason: 'QR code indicates restaurant/culinary context',
            },
            {
                id: 'qr-gym',
                name: 'QR Gym Rule',
                priority: 100,
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.GYM,
                expert: RoutingDecision_1.ExpertType.FITNESS,
                confidence: 0.95,
                reason: 'QR code indicates gym/fitness context',
            },
            {
                id: 'qr-clinic',
                name: 'QR Clinic Rule',
                priority: 100,
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.CLINIC,
                expert: RoutingDecision_1.ExpertType.HEALTH,
                confidence: 0.95,
                reason: 'QR code indicates clinic/health context',
            },
            {
                id: 'qr-retail',
                name: 'QR Retail Rule',
                priority: 100,
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.RETAIL,
                expert: RoutingDecision_1.ExpertType.RETAIL,
                confidence: 0.95,
                reason: 'QR code indicates retail context',
            },
            {
                id: 'qr-salon',
                name: 'QR Salon Rule',
                priority: 100,
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.SALON,
                expert: RoutingDecision_1.ExpertType.SALON,
                confidence: 0.95,
                reason: 'QR code indicates salon/beauty context',
            },
            // ReZ Platform Rules
            {
                id: 'rez-web-menu',
                name: 'ReZ Web Menu Rule',
                priority: 90,
                condition: (ctx) => ctx.rePlatform === EntryContext_1.ReZPlatform.WEB_MENU,
                expert: RoutingDecision_1.ExpertType.CULINARY,
                confidence: 0.9,
                reason: 'ReZ platform: Web Menu (culinary)',
            },
            {
                id: 'rez-stay',
                name: 'ReZ Stay Rule',
                priority: 90,
                condition: (ctx) => ctx.rePlatform === EntryContext_1.ReZPlatform.STAY,
                expert: RoutingDecision_1.ExpertType.HOSPITALITY,
                confidence: 0.9,
                reason: 'ReZ platform: Stay (hospitality)',
            },
            {
                id: 'rez-fit',
                name: 'ReZ Fit Rule',
                priority: 90,
                condition: (ctx) => ctx.rePlatform === EntryContext_1.ReZPlatform.FIT,
                expert: RoutingDecision_1.ExpertType.FITNESS,
                confidence: 0.9,
                reason: 'ReZ platform: Fit (fitness)',
            },
            {
                id: 'rez-health',
                name: 'ReZ Health Rule',
                priority: 90,
                condition: (ctx) => ctx.rePlatform === EntryContext_1.ReZPlatform.HEALTH,
                expert: RoutingDecision_1.ExpertType.HEALTH,
                confidence: 0.9,
                reason: 'ReZ platform: Health',
            },
            // Merchant Category Rules
            {
                id: 'cat-hospitality',
                name: 'Merchant Category Hospitality',
                priority: 80,
                condition: (ctx) => ctx.merchantCategory === EntryContext_1.MerchantCategory.HOSPITALITY,
                expert: RoutingDecision_1.ExpertType.HOSPITALITY,
                confidence: 0.85,
                reason: 'Merchant category: Hospitality',
            },
            {
                id: 'cat-culinary',
                name: 'Merchant Category Culinary',
                priority: 80,
                condition: (ctx) => ctx.merchantCategory === EntryContext_1.MerchantCategory.CULINARY,
                expert: RoutingDecision_1.ExpertType.CULINARY,
                confidence: 0.85,
                reason: 'Merchant category: Culinary',
            },
            {
                id: 'cat-fitness',
                name: 'Merchant Category Fitness',
                priority: 80,
                condition: (ctx) => ctx.merchantCategory === EntryContext_1.MerchantCategory.FITNESS,
                expert: RoutingDecision_1.ExpertType.FITNESS,
                confidence: 0.85,
                reason: 'Merchant category: Fitness',
            },
            {
                id: 'cat-health',
                name: 'Merchant Category Health',
                priority: 80,
                condition: (ctx) => ctx.merchantCategory === EntryContext_1.MerchantCategory.HEALTH,
                expert: RoutingDecision_1.ExpertType.HEALTH,
                confidence: 0.85,
                reason: 'Merchant category: Health',
            },
            {
                id: 'cat-retail',
                name: 'Merchant Category Retail',
                priority: 80,
                condition: (ctx) => ctx.merchantCategory === EntryContext_1.MerchantCategory.RETAIL,
                expert: RoutingDecision_1.ExpertType.RETAIL,
                confidence: 0.85,
                reason: 'Merchant category: Retail',
            },
            {
                id: 'cat-salon',
                name: 'Merchant Category Salon',
                priority: 80,
                condition: (ctx) => ctx.merchantCategory === EntryContext_1.MerchantCategory.SALON,
                expert: RoutingDecision_1.ExpertType.SALON,
                confidence: 0.85,
                reason: 'Merchant category: Salon',
            },
            // Entry Type Fallback Rules
            {
                id: 'entry-qr',
                name: 'QR Entry Type Fallback',
                priority: 70,
                condition: (ctx) => ctx.entryType === EntryContext_1.EntryPointType.QR_CODE,
                expert: RoutingDecision_1.ExpertType.GENERAL,
                confidence: 0.6,
                reason: 'QR code entry type (generic)',
            },
            {
                id: 'entry-voice',
                name: 'Voice Entry Type Fallback',
                priority: 70,
                condition: (ctx) => ctx.entryType === EntryContext_1.EntryPointType.VOICE,
                expert: RoutingDecision_1.ExpertType.GENERAL,
                confidence: 0.5,
                reason: 'Voice entry type (requires context inference)',
            },
            {
                id: 'entry-app',
                name: 'App Entry Type Fallback',
                priority: 70,
                condition: (ctx) => ctx.entryType === EntryContext_1.EntryPointType.APP,
                expert: RoutingDecision_1.ExpertType.GENERAL,
                confidence: 0.5,
                reason: 'App entry type (requires context inference)',
            },
        ];
    }
    /**
     * Determine routing decision from entry context
     */
    async determineRouting(context) {
        const startTime = Date.now();
        try {
            const decision = (0, RoutingDecision_1.createDefaultRoutingDecision)(context.sessionId);
            decision.id = (0, uuid_1.v4)();
            decision.entryContextId = context.id;
            decision.userId = context.userId;
            const rulesApplied = [];
            const reasons = [];
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
            }
            else {
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
            logger_js_1.logger.info('Routing decision made', {
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
        }
        catch (error) {
            logger_js_1.logger.error('Routing decision failed', {
                sessionId: context.sessionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    /**
     * Get fallback expert based on available context
     */
    getFallbackExpert(context) {
        // Try merchant category
        if (context.merchantCategory !== EntryContext_1.MerchantCategory.UNKNOWN) {
            return {
                expert: CATEGORY_TO_EXPERT[context.merchantCategory],
                confidence: 0.7,
                reason: `Fallback based on merchant category: ${context.merchantCategory}`,
            };
        }
        // Try QR code type
        if (context.qrCodeType && context.qrCodeType !== EntryContext_1.QRCodeType.GENERAL) {
            return {
                expert: QR_TO_EXPERT[context.qrCodeType],
                confidence: 0.7,
                reason: `Fallback based on QR type: ${context.qrCodeType}`,
            };
        }
        // Try ReZ platform
        if (context.rePlatform && context.rePlatform !== EntryContext_1.ReZPlatform.GENERAL) {
            return {
                expert: PLATFORM_TO_EXPERT[context.rePlatform],
                confidence: 0.7,
                reason: `Fallback based on platform: ${context.rePlatform}`,
            };
        }
        // Default to general expert
        return {
            expert: RoutingDecision_1.ExpertType.GENERAL,
            confidence: 0.3,
            reason: 'No specific context available, defaulting to general expert',
        };
    }
    /**
     * Add a custom routing rule
     */
    addRule(rule) {
        const newRule = {
            ...rule,
            id: `custom-${(0, uuid_1.v4)()}`,
        };
        this.rules.push(newRule);
        logger_js_1.logger.info('Custom routing rule added', { ruleId: newRule.id, name: newRule.name });
    }
    /**
     * Remove a routing rule by ID
     */
    removeRule(ruleId) {
        const index = this.rules.findIndex((r) => r.id === ruleId);
        if (index !== -1) {
            this.rules.splice(index, 1);
            logger_js_1.logger.info('Routing rule removed', { ruleId });
            return true;
        }
        return false;
    }
    /**
     * Get all active routing rules
     */
    getRules() {
        return [...this.rules];
    }
    /**
     * Get expert type for a QR code type
     */
    getExpertForQRCode(qrType) {
        return QR_TO_EXPERT[qrType] || RoutingDecision_1.ExpertType.GENERAL;
    }
    /**
     * Get expert type for a merchant category
     */
    getExpertForCategory(category) {
        return CATEGORY_TO_EXPERT[category] || RoutingDecision_1.ExpertType.GENERAL;
    }
    /**
     * Get expert type for a ReZ platform
     */
    getExpertForPlatform(platform) {
        return PLATFORM_TO_EXPERT[platform] || RoutingDecision_1.ExpertType.GENERAL;
    }
}
exports.RoutingRulesEngine = RoutingRulesEngine;
// Export singleton instance
exports.routingRulesEngine = new RoutingRulesEngine();
//# sourceMappingURL=routingRules.js.map
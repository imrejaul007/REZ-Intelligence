"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collaborationDetector = exports.CollaborationDetector = void 0;
const EntryContext_1 = require("../models/EntryContext");
const RoutingDecision_1 = require("../models/RoutingDecision");
const logger_js_1 = require("../utils/logger.js");
/**
 * Categories that commonly require collaboration
 */
const MULTI_DOMAIN_CATEGORIES = {
    'hotel+restaurant': [EntryContext_1.MerchantCategory.HOSPITALITY, EntryContext_1.MerchantCategory.CULINARY],
    'hotel+spa': [EntryContext_1.MerchantCategory.HOSPITALITY, EntryContext_1.MerchantCategory.SALON],
    'fitness+health': [EntryContext_1.MerchantCategory.FITNESS, EntryContext_1.MerchantCategory.HEALTH],
    'retail+health': [EntryContext_1.MerchantCategory.RETAIL, EntryContext_1.MerchantCategory.HEALTH],
    'salon+health': [EntryContext_1.MerchantCategory.SALON, EntryContext_1.MerchantCategory.HEALTH],
};
/**
 * Entry type collaboration patterns
 */
const ENTRY_COLLABORATION_PATTERNS = {
    [EntryContext_1.EntryPointType.VOICE]: {
        required: false,
        reason: 'Voice input may need multi-domain understanding',
    },
    [EntryContext_1.EntryPointType.API]: {
        required: false,
        reason: 'API requests may span multiple domains',
    },
    [EntryContext_1.EntryPointType.WEB]: {
        required: false,
        reason: 'Web sessions may navigate across domains',
    },
    [EntryContext_1.EntryPointType.UNKNOWN]: {
        required: true,
        reason: 'Unknown entry requires broader context',
    },
    [EntryContext_1.EntryPointType.QR_CODE]: { required: false, reason: '' },
    [EntryContext_1.EntryPointType.APP]: { required: false, reason: '' },
    [EntryContext_1.EntryPointType.TEXT]: { required: false, reason: '' },
    [EntryContext_1.EntryPointType.DEEP_LINK]: { required: false, reason: '' },
    [EntryContext_1.EntryPointType.NOTIFICATION]: { required: false, reason: '' },
};
/**
 * Merchant category collaboration patterns
 */
const CATEGORY_COLLABORATION_PATTERNS = {
    [EntryContext_1.MerchantCategory.HOSPITALITY]: { required: false },
    [EntryContext_1.MerchantCategory.CULINARY]: {
        required: true,
        secondary: [RoutingDecision_1.ExpertType.RETAIL],
    }, // Food delivery might need retail for groceries
    [EntryContext_1.MerchantCategory.FITNESS]: {
        required: true,
        secondary: [RoutingDecision_1.ExpertType.HEALTH],
    }, // Fitness often involves health tracking
    [EntryContext_1.MerchantCategory.HEALTH]: {
        required: true,
        secondary: [RoutingDecision_1.ExpertType.FITNESS],
    }, // Health services may need fitness advice
    [EntryContext_1.MerchantCategory.RETAIL]: {
        required: false,
    },
    [EntryContext_1.MerchantCategory.SALON]: {
        required: true,
        secondary: [RoutingDecision_1.ExpertType.HEALTH],
    }, // Beauty services may involve health considerations
    [EntryContext_1.MerchantCategory.ENTERTAINMENT]: {
        required: false,
    },
    [EntryContext_1.MerchantCategory.TRAVEL]: {
        required: true,
        secondary: [RoutingDecision_1.ExpertType.HOSPITALITY, RoutingDecision_1.ExpertType.CULINARY],
    }, // Travel often involves hotels and dining
    [EntryContext_1.MerchantCategory.UNKNOWN]: {
        required: true,
        secondary: [RoutingDecision_1.ExpertType.GENERAL],
    },
};
/**
 * Service for detecting when collaboration between experts is needed
 */
class CollaborationDetector {
    triggers;
    constructor() {
        this.triggers = this.initializeTriggers();
    }
    /**
     * Initialize collaboration triggers
     */
    initializeTriggers() {
        return [
            // QR codes that indicate multi-service locations
            {
                id: 'hotel-resort-qr',
                name: 'Hotel Resort QR Collaboration',
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.HOTEL &&
                    (ctx.merchantName?.toLowerCase().includes('resort') ||
                        ctx.merchantName?.toLowerCase().includes('spa') ||
                        ctx.merchantName?.toLowerCase().includes('restaurant') ||
                        ctx.merchantName?.toLowerCase().includes('gym')),
                required: true,
                secondaryExperts: [RoutingDecision_1.ExpertType.CULINARY, RoutingDecision_1.ExpertType.SALON, RoutingDecision_1.ExpertType.FITNESS],
                reason: 'Resort/hotel with multiple services detected',
            },
            // Fitness centers with health services
            {
                id: 'fitness-health-qr',
                name: 'Fitness Health Collaboration',
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.GYM &&
                    (ctx.merchantName?.toLowerCase().includes('health') ||
                        ctx.merchantName?.toLowerCase().includes('medical') ||
                        ctx.merchantName?.toLowerCase().includes('wellness')),
                required: true,
                secondaryExperts: [RoutingDecision_1.ExpertType.HEALTH],
                reason: 'Fitness center with health services detected',
            },
            // Salons with health services
            {
                id: 'salon-health-qr',
                name: 'Salon Health Collaboration',
                condition: (ctx) => ctx.qrCodeType === EntryContext_1.QRCodeType.SALON &&
                    (ctx.merchantName?.toLowerCase().includes('medical') ||
                        ctx.merchantName?.toLowerCase().includes('dermatology') ||
                        ctx.merchantName?.toLowerCase().includes('spa')),
                required: true,
                secondaryExperts: [RoutingDecision_1.ExpertType.HEALTH],
                reason: 'Salon with health/medical services detected',
            },
            // Unknown entry types need broader context
            {
                id: 'unknown-entry',
                name: 'Unknown Entry Collaboration',
                condition: (ctx) => ctx.entryType === EntryContext_1.EntryPointType.UNKNOWN,
                required: true,
                secondaryExperts: [RoutingDecision_1.ExpertType.GENERAL],
                reason: 'Unknown entry type requires multi-expert context gathering',
                minConfidence: 0.5,
            },
            // Low confidence decisions
            {
                id: 'low-confidence',
                name: 'Low Confidence Collaboration',
                condition: (_, decision) => decision.primaryConfidence < 0.7,
                required: false,
                secondaryExperts: [RoutingDecision_1.ExpertType.GENERAL],
                reason: 'Low confidence in primary expert - seeking additional context',
                minConfidence: 0.5,
            },
        ];
    }
    /**
     * Detect collaboration requirements for a routing decision
     */
    async detect(context, decision) {
        const startTime = Date.now();
        const triggers = [];
        let required = false;
        const secondaryExperts = [];
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
            const filteredSecondary = secondaryExperts.filter((expert) => expert !== decision.primaryExpert);
            const collaboration = {
                required,
                primary: decision.primaryExpert,
                secondary: filteredSecondary.length > 0 ? filteredSecondary : undefined,
                reason: required ? this.generateCollaborationReason(triggers, context) : undefined,
                confidence: this.calculateCollaborationConfidence(context, decision, triggers),
            };
            const processingTime = Date.now() - startTime;
            logger_js_1.logger.debug('Collaboration detection completed', {
                sessionId: context.sessionId,
                required,
                secondaryCount: filteredSecondary.length,
                processingTimeMs: processingTime,
            });
            return {
                collaboration,
                triggers,
            };
        }
        catch (error) {
            logger_js_1.logger.error('Collaboration detection failed', {
                sessionId: context.sessionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    /**
     * Generate a human-readable reason for collaboration
     */
    generateCollaborationReason(triggers, context) {
        if (triggers.length === 0) {
            return 'General collaboration recommended for comprehensive assistance';
        }
        const reasons = [];
        for (const trigger of triggers) {
            if (trigger.startsWith('trigger:')) {
                const triggerObj = this.triggers.find((t) => `trigger:${t.id}` === trigger);
                if (triggerObj) {
                    reasons.push(triggerObj.reason);
                }
            }
            else if (trigger.startsWith('entry-type:')) {
                const entryType = trigger.replace('entry-type:', '');
                const pattern = ENTRY_COLLABORATION_PATTERNS[entryType];
                if (pattern?.reason) {
                    reasons.push(pattern.reason);
                }
            }
            else if (trigger.startsWith('category:')) {
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
    calculateCollaborationConfidence(context, decision, triggers) {
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
        if (context.qrCodeType && context.qrCodeType !== EntryContext_1.QRCodeType.GENERAL) {
            confidence -= 0.2;
        }
        return Math.max(0, Math.min(1, confidence));
    }
    /**
     * Add a custom collaboration trigger
     */
    addTrigger(trigger) {
        const newTrigger = {
            ...trigger,
            id: `custom-${Date.now()}`,
        };
        this.triggers.push(newTrigger);
        logger_js_1.logger.info('Custom collaboration trigger added', {
            triggerId: newTrigger.id,
            name: newTrigger.name,
        });
    }
    /**
     * Remove a collaboration trigger
     */
    removeTrigger(triggerId) {
        const index = this.triggers.findIndex((t) => t.id === triggerId);
        if (index !== -1) {
            this.triggers.splice(index, 1);
            logger_js_1.logger.info('Collaboration trigger removed', { triggerId });
            return true;
        }
        return false;
    }
    /**
     * Get all active collaboration triggers
     */
    getTriggers() {
        return [...this.triggers];
    }
    /**
     * Check if two experts should collaborate based on context
     */
    shouldCollaborate(expert1, expert2, context) {
        // Experts should collaborate if they serve related categories
        const relatedPairs = [
            [RoutingDecision_1.ExpertType.HOSPITALITY, RoutingDecision_1.ExpertType.CULINARY],
            [RoutingDecision_1.ExpertType.HOSPITALITY, RoutingDecision_1.ExpertType.SALON],
            [RoutingDecision_1.ExpertType.FITNESS, RoutingDecision_1.ExpertType.HEALTH],
            [RoutingDecision_1.ExpertType.HEALTH, RoutingDecision_1.ExpertType.SALON],
            [RoutingDecision_1.ExpertType.RETAIL, RoutingDecision_1.ExpertType.CULINARY],
            [RoutingDecision_1.ExpertType.HOSPITALITY, RoutingDecision_1.ExpertType.TRAVEL],
        ];
        return relatedPairs.some((pair) => (pair[0] === expert1 && pair[1] === expert2) ||
            (pair[1] === expert1 && pair[0] === expert2));
    }
}
exports.CollaborationDetector = CollaborationDetector;
// Export singleton instance
exports.collaborationDetector = new CollaborationDetector();
//# sourceMappingURL=collaborationDetector.js.map
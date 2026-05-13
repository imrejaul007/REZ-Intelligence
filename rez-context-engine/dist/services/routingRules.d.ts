import { EntryContext, MerchantCategory, QRCodeType, ReZPlatform } from '../models/EntryContext';
import { RoutingDecision, ExpertType } from '../models/RoutingDecision';
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
export interface RoutingResult {
    decision: RoutingDecision;
    rulesApplied: string[];
    processingTimeMs: number;
}
/**
 * Routing rules engine that determines which expert should handle a request
 */
export declare class RoutingRulesEngine {
    private rules;
    constructor();
    /**
     * Initialize routing rules
     */
    private initializeRules;
    /**
     * Determine routing decision from entry context
     */
    determineRouting(context: EntryContext): Promise<RoutingResult>;
    /**
     * Get fallback expert based on available context
     */
    private getFallbackExpert;
    /**
     * Add a custom routing rule
     */
    addRule(rule: Omit<RoutingRule, 'id'>): void;
    /**
     * Remove a routing rule by ID
     */
    removeRule(ruleId: string): boolean;
    /**
     * Get all active routing rules
     */
    getRules(): RoutingRule[];
    /**
     * Get expert type for a QR code type
     */
    getExpertForQRCode(qrType: QRCodeType): ExpertType;
    /**
     * Get expert type for a merchant category
     */
    getExpertForCategory(category: MerchantCategory): ExpertType;
    /**
     * Get expert type for a ReZ platform
     */
    getExpertForPlatform(platform: ReZPlatform): ExpertType;
}
export declare const routingRulesEngine: RoutingRulesEngine;
export {};
//# sourceMappingURL=routingRules.d.ts.map
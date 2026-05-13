"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpertTypeDescriptions = exports.RoutingDecisionInputSchema = exports.RoutingPriority = exports.ExpertType = void 0;
exports.createDefaultRoutingDecision = createDefaultRoutingDecision;
const zod_1 = require("zod");
const EntryContext_1 = require("./EntryContext");
/**
 * Expert types for routing decisions
 */
var ExpertType;
(function (ExpertType) {
    ExpertType["HOSPITALITY"] = "HOSPITALITY_EXPERT";
    ExpertType["CULINARY"] = "CULINARY_EXPERT";
    ExpertType["FITNESS"] = "FITNESS_EXPERT";
    ExpertType["HEALTH"] = "HEALTH_EXPERT";
    ExpertType["RETAIL"] = "RETAIL_EXPERT";
    ExpertType["SALON"] = "SALON_EXPERT";
    ExpertType["GENERAL"] = "GENERAL_EXPERT";
})(ExpertType || (exports.ExpertType = ExpertType = {}));
/**
 * Routing priority levels
 */
var RoutingPriority;
(function (RoutingPriority) {
    RoutingPriority[RoutingPriority["CRITICAL"] = 1] = "CRITICAL";
    RoutingPriority[RoutingPriority["HIGH"] = 2] = "HIGH";
    RoutingPriority[RoutingPriority["MEDIUM"] = 3] = "MEDIUM";
    RoutingPriority[RoutingPriority["LOW"] = 4] = "LOW";
})(RoutingPriority || (exports.RoutingPriority = RoutingPriority = {}));
/**
 * Schema for routing decision input validation
 */
exports.RoutingDecisionInputSchema = zod_1.z.object({
    entryContext: zod_1.z.instanceof(Object).optional(),
    userId: zod_1.z.string().optional(),
    intent: zod_1.z.string().optional(),
    entities: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        value: zod_1.z.string(),
        confidence: zod_1.z.number(),
    })).optional(),
    sessionHistory: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'assistant']),
        content: zod_1.z.string(),
        timestamp: zod_1.z.string(),
    })).optional(),
    preferences: zod_1.z.record(zod_1.z.unknown()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/**
 * Create a default routing decision
 */
function createDefaultRoutingDecision(sessionId) {
    const now = new Date();
    return {
        id: '',
        sessionId,
        entryContextId: '',
        primaryExpert: ExpertType.GENERAL,
        primaryConfidence: 0,
        primaryReasons: [],
        priority: RoutingPriority.MEDIUM,
        collaboration: {
            required: false,
            primary: ExpertType.GENERAL,
            confidence: 0,
        },
        contextSummary: {
            entryType: EntryContext_1.EntryPointType.UNKNOWN,
            merchantCategory: EntryContext_1.MerchantCategory.UNKNOWN,
        },
        processingTimeMs: 0,
        rulesApplied: [],
        version: '1.0.0',
        decidedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes
    };
}
/**
 * Expert type descriptions
 */
exports.ExpertTypeDescriptions = {
    [ExpertType.HOSPITALITY]: 'Expert in hotel bookings, accommodations, travel, and hospitality services',
    [ExpertType.CULINARY]: 'Expert in restaurant orders, food delivery, recipes, and culinary experiences',
    [ExpertType.FITNESS]: 'Expert in gym memberships, workout plans, fitness tracking, and wellness',
    [ExpertType.HEALTH]: 'Expert in medical appointments, clinic services, health consultations, and wellness',
    [ExpertType.RETAIL]: 'Expert in shopping, product recommendations, and retail services',
    [ExpertType.SALON]: 'Expert in salon appointments, beauty services, and personal care',
    [ExpertType.GENERAL]: 'General purpose assistant for general inquiries',
};
//# sourceMappingURL=RoutingDecision.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTENT_METADATA = exports.RiskAssessmentSchema = exports.AddToBlacklistSchema = exports.UpdateCaseStatusSchema = exports.CreateFraudCaseSchema = exports.CheckBlacklistSchema = exports.AnalyzeTransactionSchema = exports.FraudIntent = void 0;
const zod_1 = require("zod");
// Intent types for fraud-specific operations
var FraudIntent;
(function (FraudIntent) {
    FraudIntent["ANALYZE_TRANSACTION"] = "ANALYZE_TRANSACTION";
    FraudIntent["CHECK_BLACKLIST"] = "CHECK_BLACKLIST";
    FraudIntent["ASSESS_RISK"] = "ASSESS_RISK";
    FraudIntent["CREATE_FRAUD_CASE"] = "CREATE_FRAUD_CASE";
    FraudIntent["UPDATE_CASE_STATUS"] = "UPDATE_CASE_STATUS";
    FraudIntent["GET_CASE_DETAILS"] = "GET_CASE_DETAILS";
    FraudIntent["LIST_FRAUD_CASES"] = "LIST_FRAUD_CASES";
    FraudIntent["GET_RISK_PROFILE"] = "GET_RISK_PROFILE";
    FraudIntent["UPDATE_RISK_PROFILE"] = "UPDATE_RISK_PROFILE";
    FraudIntent["ADD_TO_BLACKLIST"] = "ADD_TO_BLACKLIST";
    FraudIntent["REMOVE_FROM_BLACKLIST"] = "REMOVE_FROM_BLACKLIST";
    FraudIntent["GET_BLACKLIST_STATS"] = "GET_BLACKLIST_STATS";
    FraudIntent["GENERATE_ALERT"] = "GENERATE_ALERT";
    FraudIntent["ESCALATE_CASE"] = "ESCALATE_CASE";
    FraudIntent["MARK_FALSE_POSITIVE"] = "MARK_FALSE_POSITIVE";
    FraudIntent["RESOLVE_CASE"] = "RESOLVE_CASE";
})(FraudIntent || (exports.FraudIntent = FraudIntent = {}));
// Zod schemas for intent validation
exports.AnalyzeTransactionSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
    userId: zod_1.z.string().optional(),
    accountId: zod_1.z.string().optional(),
    orderId: zod_1.z.string().optional(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3),
    merchantCategory: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().optional(),
    deviceFingerprint: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().optional(),
    billingCountry: zod_1.z.string().optional(),
    billingCity: zod_1.z.string().optional(),
    shippingCountry: zod_1.z.string().optional(),
    shippingCity: zod_1.z.string().optional(),
    isNewPaymentMethod: zod_1.z.boolean().optional(),
    isVerified: zod_1.z.boolean().optional(),
    twoFactorEnabled: zod_1.z.boolean().optional(),
});
exports.CheckBlacklistSchema = zod_1.z.object({
    type: zod_1.z.enum(['IP_ADDRESS', 'DEVICE_FINGERPRINT', 'EMAIL', 'PHONE', 'CARD_HASH', 'ACCOUNT', 'USER']),
    value: zod_1.z.string().min(1),
});
exports.CreateFraudCaseSchema = zod_1.z.object({
    userId: zod_1.z.string().optional(),
    accountId: zod_1.z.string().optional(),
    transactionId: zod_1.z.string().optional(),
    orderId: zod_1.z.string().optional(),
    severity: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    detectedPatterns: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        name: zod_1.z.string(),
        score: zod_1.z.number().min(0).max(100),
        evidence: zod_1.z.record(zod_1.z.unknown()).optional(),
    })).optional(),
    riskFactors: zod_1.z.array(zod_1.z.string()).optional(),
    notes: zod_1.z.string().optional(),
});
exports.UpdateCaseStatusSchema = zod_1.z.object({
    caseId: zod_1.z.string().min(1),
    status: zod_1.z.enum(['OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED', 'ESCALATED']),
    notes: zod_1.z.string().optional(),
    reviewedBy: zod_1.z.string().optional(),
});
exports.AddToBlacklistSchema = zod_1.z.object({
    type: zod_1.z.enum(['IP_ADDRESS', 'DEVICE_FINGERPRINT', 'EMAIL', 'PHONE', 'CARD_HASH', 'ACCOUNT', 'USER']),
    value: zod_1.z.string().min(1),
    reason: zod_1.z.enum([
        'FRAUD_CONFIRMED', 'CHARGEBACK', 'REFUND_ABUSE', 'POLICY_VIOLATION',
        'VELOCITY_VIOLATION', 'CARD_TESTING', 'BOT_ACTIVITY', 'MANUAL_REVIEW',
        'ACCOUNT_TAKEOVER', 'TEST_ACCOUNT', 'OTHER'
    ]),
    severity: zod_1.z.enum(['WARN', 'BLOCK', 'INVESTIGATE']).default('BLOCK'),
    userId: zod_1.z.string().optional(),
    transactionId: zod_1.z.string().optional(),
    isPermanent: zod_1.z.boolean().default(true),
    expiresAt: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
exports.RiskAssessmentSchema = zod_1.z.object({
    userId: zod_1.z.string().optional(),
    accountId: zod_1.z.string().optional(),
    transactionId: zod_1.z.string().optional(),
    amount: zod_1.z.number().optional(),
    includeHistory: zod_1.z.boolean().default(true),
});
exports.INTENT_METADATA = {
    [FraudIntent.ANALYZE_TRANSACTION]: {
        name: FraudIntent.ANALYZE_TRANSACTION,
        description: 'Analyze a transaction for fraud indicators',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    [FraudIntent.CHECK_BLACKLIST]: {
        name: FraudIntent.CHECK_BLACKLIST,
        description: 'Check if an entity is blacklisted',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 200 },
    },
    [FraudIntent.ASSESS_RISK]: {
        name: FraudIntent.ASSESS_RISK,
        description: 'Assess overall risk for a user or account',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    [FraudIntent.CREATE_FRAUD_CASE]: {
        name: FraudIntent.CREATE_FRAUD_CASE,
        description: 'Create a new fraud investigation case',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
    [FraudIntent.UPDATE_CASE_STATUS]: {
        name: FraudIntent.UPDATE_CASE_STATUS,
        description: 'Update the status of a fraud case',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    [FraudIntent.GET_CASE_DETAILS]: {
        name: FraudIntent.GET_CASE_DETAILS,
        description: 'Get details of a specific fraud case',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    [FraudIntent.LIST_FRAUD_CASES]: {
        name: FraudIntent.LIST_FRAUD_CASES,
        description: 'List fraud cases with filters',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
    [FraudIntent.GET_RISK_PROFILE]: {
        name: FraudIntent.GET_RISK_PROFILE,
        description: 'Get risk profile for a user',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    [FraudIntent.UPDATE_RISK_PROFILE]: {
        name: FraudIntent.UPDATE_RISK_PROFILE,
        description: 'Update user risk profile',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
    [FraudIntent.ADD_TO_BLACKLIST]: {
        name: FraudIntent.ADD_TO_BLACKLIST,
        description: 'Add an entity to the blacklist',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
    [FraudIntent.REMOVE_FROM_BLACKLIST]: {
        name: FraudIntent.REMOVE_FROM_BLACKLIST,
        description: 'Remove an entity from the blacklist',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
    [FraudIntent.GET_BLACKLIST_STATS]: {
        name: FraudIntent.GET_BLACKLIST_STATS,
        description: 'Get blacklist statistics',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    [FraudIntent.GENERATE_ALERT]: {
        name: FraudIntent.GENERATE_ALERT,
        description: 'Generate a fraud alert',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    [FraudIntent.ESCALATE_CASE]: {
        name: FraudIntent.ESCALATE_CASE,
        description: 'Escalate a fraud case for review',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
    [FraudIntent.MARK_FALSE_POSITIVE]: {
        name: FraudIntent.MARK_FALSE_POSITIVE,
        description: 'Mark a fraud case as false positive',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
    [FraudIntent.RESOLVE_CASE]: {
        name: FraudIntent.RESOLVE_CASE,
        description: 'Resolve a fraud case',
        requiresAuth: true,
        rateLimit: { windowMs: 60000, maxRequests: 50 },
    },
};
//# sourceMappingURL=fraudIntents.js.map
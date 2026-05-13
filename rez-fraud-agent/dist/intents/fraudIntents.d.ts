import { z } from 'zod';
import { FraudPatternType } from '../config/patterns';
import { RiskLevel } from '../models/RiskProfile';
export declare enum FraudIntent {
    ANALYZE_TRANSACTION = "ANALYZE_TRANSACTION",
    CHECK_BLACKLIST = "CHECK_BLACKLIST",
    ASSESS_RISK = "ASSESS_RISK",
    CREATE_FRAUD_CASE = "CREATE_FRAUD_CASE",
    UPDATE_CASE_STATUS = "UPDATE_CASE_STATUS",
    GET_CASE_DETAILS = "GET_CASE_DETAILS",
    LIST_FRAUD_CASES = "LIST_FRAUD_CASES",
    GET_RISK_PROFILE = "GET_RISK_PROFILE",
    UPDATE_RISK_PROFILE = "UPDATE_RISK_PROFILE",
    ADD_TO_BLACKLIST = "ADD_TO_BLACKLIST",
    REMOVE_FROM_BLACKLIST = "REMOVE_FROM_BLACKLIST",
    GET_BLACKLIST_STATS = "GET_BLACKLIST_STATS",
    GENERATE_ALERT = "GENERATE_ALERT",
    ESCALATE_CASE = "ESCALATE_CASE",
    MARK_FALSE_POSITIVE = "MARK_FALSE_POSITIVE",
    RESOLVE_CASE = "RESOLVE_CASE"
}
export declare const AnalyzeTransactionSchema: z.ZodObject<{
    transactionId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    accountId: z.ZodOptional<z.ZodString>;
    orderId: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    currency: z.ZodString;
    merchantCategory: z.ZodOptional<z.ZodString>;
    merchantId: z.ZodOptional<z.ZodString>;
    deviceFingerprint: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    billingCountry: z.ZodOptional<z.ZodString>;
    billingCity: z.ZodOptional<z.ZodString>;
    shippingCountry: z.ZodOptional<z.ZodString>;
    shippingCity: z.ZodOptional<z.ZodString>;
    isNewPaymentMethod: z.ZodOptional<z.ZodBoolean>;
    isVerified: z.ZodOptional<z.ZodBoolean>;
    twoFactorEnabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    transactionId: string;
    amount: number;
    currency: string;
    merchantCategory?: string | undefined;
    ipAddress?: string | undefined;
    deviceFingerprint?: string | undefined;
    userId?: string | undefined;
    accountId?: string | undefined;
    twoFactorEnabled?: boolean | undefined;
    isNewPaymentMethod?: boolean | undefined;
    billingCountry?: string | undefined;
    shippingCountry?: string | undefined;
    orderId?: string | undefined;
    merchantId?: string | undefined;
    billingCity?: string | undefined;
    shippingCity?: string | undefined;
    isVerified?: boolean | undefined;
}, {
    transactionId: string;
    amount: number;
    currency: string;
    merchantCategory?: string | undefined;
    ipAddress?: string | undefined;
    deviceFingerprint?: string | undefined;
    userId?: string | undefined;
    accountId?: string | undefined;
    twoFactorEnabled?: boolean | undefined;
    isNewPaymentMethod?: boolean | undefined;
    billingCountry?: string | undefined;
    shippingCountry?: string | undefined;
    orderId?: string | undefined;
    merchantId?: string | undefined;
    billingCity?: string | undefined;
    shippingCity?: string | undefined;
    isVerified?: boolean | undefined;
}>;
export declare const CheckBlacklistSchema: z.ZodObject<{
    type: z.ZodEnum<["IP_ADDRESS", "DEVICE_FINGERPRINT", "EMAIL", "PHONE", "CARD_HASH", "ACCOUNT", "USER"]>;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "IP_ADDRESS" | "DEVICE_FINGERPRINT" | "EMAIL" | "PHONE" | "CARD_HASH" | "ACCOUNT" | "USER";
    value: string;
}, {
    type: "IP_ADDRESS" | "DEVICE_FINGERPRINT" | "EMAIL" | "PHONE" | "CARD_HASH" | "ACCOUNT" | "USER";
    value: string;
}>;
export declare const CreateFraudCaseSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    accountId: z.ZodOptional<z.ZodString>;
    transactionId: z.ZodOptional<z.ZodString>;
    orderId: z.ZodOptional<z.ZodString>;
    severity: z.ZodDefault<z.ZodEnum<["LOW", "MEDIUM", "HIGH", "CRITICAL"]>>;
    detectedPatterns: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        name: z.ZodString;
        score: z.ZodNumber;
        evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        name: string;
        score: number;
        evidence?: Record<string, unknown> | undefined;
    }, {
        type: string;
        name: string;
        score: number;
        evidence?: Record<string, unknown> | undefined;
    }>, "many">>;
    riskFactors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    severity: "HIGH" | "CRITICAL" | "LOW" | "MEDIUM";
    transactionId?: string | undefined;
    userId?: string | undefined;
    accountId?: string | undefined;
    notes?: string | undefined;
    riskFactors?: string[] | undefined;
    orderId?: string | undefined;
    detectedPatterns?: {
        type: string;
        name: string;
        score: number;
        evidence?: Record<string, unknown> | undefined;
    }[] | undefined;
}, {
    transactionId?: string | undefined;
    userId?: string | undefined;
    accountId?: string | undefined;
    notes?: string | undefined;
    riskFactors?: string[] | undefined;
    severity?: "HIGH" | "CRITICAL" | "LOW" | "MEDIUM" | undefined;
    orderId?: string | undefined;
    detectedPatterns?: {
        type: string;
        name: string;
        score: number;
        evidence?: Record<string, unknown> | undefined;
    }[] | undefined;
}>;
export declare const UpdateCaseStatusSchema: z.ZodObject<{
    caseId: z.ZodString;
    status: z.ZodEnum<["OPEN", "UNDER_REVIEW", "CONFIRMED", "FALSE_POSITIVE", "RESOLVED", "ESCALATED"]>;
    notes: z.ZodOptional<z.ZodString>;
    reviewedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "UNDER_REVIEW" | "OPEN" | "CONFIRMED" | "FALSE_POSITIVE" | "RESOLVED" | "ESCALATED";
    caseId: string;
    notes?: string | undefined;
    reviewedBy?: string | undefined;
}, {
    status: "UNDER_REVIEW" | "OPEN" | "CONFIRMED" | "FALSE_POSITIVE" | "RESOLVED" | "ESCALATED";
    caseId: string;
    notes?: string | undefined;
    reviewedBy?: string | undefined;
}>;
export declare const AddToBlacklistSchema: z.ZodObject<{
    type: z.ZodEnum<["IP_ADDRESS", "DEVICE_FINGERPRINT", "EMAIL", "PHONE", "CARD_HASH", "ACCOUNT", "USER"]>;
    value: z.ZodString;
    reason: z.ZodEnum<["FRAUD_CONFIRMED", "CHARGEBACK", "REFUND_ABUSE", "POLICY_VIOLATION", "VELOCITY_VIOLATION", "CARD_TESTING", "BOT_ACTIVITY", "MANUAL_REVIEW", "ACCOUNT_TAKEOVER", "TEST_ACCOUNT", "OTHER"]>;
    severity: z.ZodDefault<z.ZodEnum<["WARN", "BLOCK", "INVESTIGATE"]>>;
    userId: z.ZodOptional<z.ZodString>;
    transactionId: z.ZodOptional<z.ZodString>;
    isPermanent: z.ZodDefault<z.ZodBoolean>;
    expiresAt: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "IP_ADDRESS" | "DEVICE_FINGERPRINT" | "EMAIL" | "PHONE" | "CARD_HASH" | "ACCOUNT" | "USER";
    value: string;
    severity: "WARN" | "BLOCK" | "INVESTIGATE";
    reason: "CARD_TESTING" | "ACCOUNT_TAKEOVER" | "FRAUD_CONFIRMED" | "CHARGEBACK" | "REFUND_ABUSE" | "POLICY_VIOLATION" | "VELOCITY_VIOLATION" | "BOT_ACTIVITY" | "MANUAL_REVIEW" | "TEST_ACCOUNT" | "OTHER";
    isPermanent: boolean;
    transactionId?: string | undefined;
    userId?: string | undefined;
    notes?: string | undefined;
    expiresAt?: string | undefined;
}, {
    type: "IP_ADDRESS" | "DEVICE_FINGERPRINT" | "EMAIL" | "PHONE" | "CARD_HASH" | "ACCOUNT" | "USER";
    value: string;
    reason: "CARD_TESTING" | "ACCOUNT_TAKEOVER" | "FRAUD_CONFIRMED" | "CHARGEBACK" | "REFUND_ABUSE" | "POLICY_VIOLATION" | "VELOCITY_VIOLATION" | "BOT_ACTIVITY" | "MANUAL_REVIEW" | "TEST_ACCOUNT" | "OTHER";
    transactionId?: string | undefined;
    userId?: string | undefined;
    notes?: string | undefined;
    severity?: "WARN" | "BLOCK" | "INVESTIGATE" | undefined;
    expiresAt?: string | undefined;
    isPermanent?: boolean | undefined;
}>;
export declare const RiskAssessmentSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    accountId: z.ZodOptional<z.ZodString>;
    transactionId: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    includeHistory: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    includeHistory: boolean;
    transactionId?: string | undefined;
    amount?: number | undefined;
    userId?: string | undefined;
    accountId?: string | undefined;
}, {
    transactionId?: string | undefined;
    amount?: number | undefined;
    userId?: string | undefined;
    accountId?: string | undefined;
    includeHistory?: boolean | undefined;
}>;
export interface IntentHandler<TInput, TOutput> {
    handle(input: TInput): Promise<TOutput>;
    validate(input: unknown): TInput;
}
export interface FraudAnalysisResponse {
    decision: 'ALLOW' | 'DENY' | 'CHALLENGE' | 'REVIEW';
    riskScore: number;
    riskLevel: RiskLevel;
    detectedPatterns: Array<{
        type: FraudPatternType;
        name: string;
        score: number;
        evidence: Record<string, unknown>;
    }>;
    riskFactors: string[];
    message: string;
    caseId?: string;
    requiresAction: boolean;
    processingTimeMs: number;
}
export interface FraudCaseResponse {
    caseId: string;
    status: string;
    severity: string;
    riskScore: number;
    detectedPatterns: Array<{
        type: string;
        name: string;
        score: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export interface RiskProfileResponse {
    profileId: string;
    userId: string;
    riskLevel: RiskLevel;
    riskScore: number;
    totalTransactions: number;
    fraudCaseCount: number;
    isKnownFraudster: boolean;
    accountStanding: string;
    lastRiskAssessmentAt?: Date;
}
export interface BlacklistResponse {
    entryId: string;
    type: string;
    value: string;
    reason: string;
    severity: string;
    isActive: boolean;
    addedAt: Date;
    expiresAt?: Date;
}
export interface IntentMetadata {
    name: FraudIntent;
    description: string;
    requiresAuth: boolean;
    rateLimit?: {
        windowMs: number;
        maxRequests: number;
    };
}
export declare const INTENT_METADATA: Record<FraudIntent, IntentMetadata>;
//# sourceMappingURL=fraudIntents.d.ts.map
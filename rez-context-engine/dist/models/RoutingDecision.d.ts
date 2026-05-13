import { z } from 'zod';
import { MerchantCategory, EntryPointType, QRCodeType, ReZPlatform } from './EntryContext';
/**
 * Expert types for routing decisions
 */
export declare enum ExpertType {
    HOSPITALITY = "HOSPITALITY_EXPERT",
    CULINARY = "CULINARY_EXPERT",
    FITNESS = "FITNESS_EXPERT",
    HEALTH = "HEALTH_EXPERT",
    RETAIL = "RETAIL_EXPERT",
    SALON = "SALON_EXPERT",
    GENERAL = "GENERAL_EXPERT"
}
/**
 * Routing priority levels
 */
export declare enum RoutingPriority {
    CRITICAL = 1,
    HIGH = 2,
    MEDIUM = 3,
    LOW = 4
}
/**
 * Reasons for routing decisions
 */
export interface RoutingReason {
    rule: string;
    score: number;
    description: string;
}
/**
 * Collaboration requirement
 */
export interface CollaborationRequirement {
    required: boolean;
    primary: ExpertType;
    secondary?: ExpertType[];
    reason?: string;
    confidence: number;
}
/**
 * Schema for routing decision input validation
 */
export declare const RoutingDecisionInputSchema: z.ZodObject<{
    entryContext: z.ZodOptional<z.ZodType<Object, z.ZodTypeDef, Object>>;
    userId: z.ZodOptional<z.ZodString>;
    intent: z.ZodOptional<z.ZodString>;
    entities: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        value: z.ZodString;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        type: string;
        confidence: number;
    }, {
        value: string;
        type: string;
        confidence: number;
    }>, "many">>;
    sessionHistory: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        content: z.ZodString;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }, {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }>, "many">>;
    preferences: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    entryContext?: Object | undefined;
    intent?: string | undefined;
    entities?: {
        value: string;
        type: string;
        confidence: number;
    }[] | undefined;
    sessionHistory?: {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }[] | undefined;
    preferences?: Record<string, unknown> | undefined;
}, {
    userId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    entryContext?: Object | undefined;
    intent?: string | undefined;
    entities?: {
        value: string;
        type: string;
        confidence: number;
    }[] | undefined;
    sessionHistory?: {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }[] | undefined;
    preferences?: Record<string, unknown> | undefined;
}>;
export type RoutingDecisionInput = z.infer<typeof RoutingDecisionInputSchema>;
/**
 * Routing decision structure that determines which expert handles the request
 */
export interface RoutingDecision {
    id: string;
    sessionId: string;
    entryContextId: string;
    userId?: string;
    primaryExpert: ExpertType;
    primaryConfidence: number;
    primaryReasons: RoutingReason[];
    fallbackExpert?: ExpertType;
    fallbackConfidence?: number;
    priority: RoutingPriority;
    collaboration: CollaborationRequirement;
    contextSummary: {
        entryType: EntryPointType;
        merchantCategory: MerchantCategory;
        qrCodeType?: QRCodeType;
        rePlatform?: ReZPlatform;
        detectedIntent?: string;
    };
    processingTimeMs: number;
    rulesApplied: string[];
    version: string;
    decidedAt: Date;
    expiresAt: Date;
}
/**
 * Create a default routing decision
 */
export declare function createDefaultRoutingDecision(sessionId: string): RoutingDecision;
/**
 * Expert type descriptions
 */
export declare const ExpertTypeDescriptions: Record<ExpertType, string>;
//# sourceMappingURL=RoutingDecision.d.ts.map
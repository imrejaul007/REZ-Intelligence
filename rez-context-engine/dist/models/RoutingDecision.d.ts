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
    entryContext: z.ZodOptional<z.ZodCustom<Object, Object>>;
    userId: z.ZodOptional<z.ZodString>;
    intent: z.ZodOptional<z.ZodString>;
    entities: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        value: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>>>;
    sessionHistory: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
        timestamp: z.ZodString;
    }, z.core.$strip>>>;
    preferences: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
    metadata: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
}, z.core.$strip>;
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
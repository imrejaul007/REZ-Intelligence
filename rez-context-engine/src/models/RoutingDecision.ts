import { z } from 'zod';
import { EntryContext, MerchantCategory, EntryPointType, QRCodeType, ReZPlatform } from './EntryContext';

/**
 * Expert types for routing decisions
 */
export enum ExpertType {
  HOSPITALITY = 'HOSPITALITY_EXPERT',
  CULINARY = 'CULINARY_EXPERT',
  FITNESS = 'FITNESS_EXPERT',
  HEALTH = 'HEALTH_EXPERT',
  RETAIL = 'RETAIL_EXPERT',
  SALON = 'SALON_EXPERT',
  GENERAL = 'GENERAL_EXPERT',
}

/**
 * Routing priority levels
 */
export enum RoutingPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
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
export const RoutingDecisionInputSchema = z.object({
  entryContext: z.instanceof(Object).optional(),
  userId: z.string().optional(),
  intent: z.string().optional(),
  entities: z.array(z.object({
    type: z.string(),
    value: z.string(),
    confidence: z.number(),
  })).optional(),
  sessionHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.string(),
  })).optional(),
  preferences: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RoutingDecisionInput = z.infer<typeof RoutingDecisionInputSchema>;

/**
 * Routing decision structure that determines which expert handles the request
 */
export interface RoutingDecision {
  id: string;
  sessionId: string;
  entryContextId: string;
  userId?: string;

  // Primary routing
  primaryExpert: ExpertType;
  primaryConfidence: number;
  primaryReasons: RoutingReason[];

  // Fallback routing
  fallbackExpert?: ExpertType;
  fallbackConfidence?: number;

  // Priority
  priority: RoutingPriority;

  // Collaboration
  collaboration: CollaborationRequirement;

  // Context summary
  contextSummary: {
    entryType: EntryPointType;
    merchantCategory: MerchantCategory;
    qrCodeType?: QRCodeType;
    rePlatform?: ReZPlatform;
    detectedIntent?: string;
  };

  // Processing metadata
  processingTimeMs: number;
  rulesApplied: string[];
  version: string;

  // Timestamps
  decidedAt: Date;
  expiresAt: Date;
}

/**
 * Create a default routing decision
 */
export function createDefaultRoutingDecision(sessionId: string): RoutingDecision {
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
      entryType: EntryPointType.UNKNOWN,
      merchantCategory: MerchantCategory.UNKNOWN,
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
export const ExpertTypeDescriptions: Record<ExpertType, string> = {
  [ExpertType.HOSPITALITY]: 'Expert in hotel bookings, accommodations, travel, and hospitality services',
  [ExpertType.CULINARY]: 'Expert in restaurant orders, food delivery, recipes, and culinary experiences',
  [ExpertType.FITNESS]: 'Expert in gym memberships, workout plans, fitness tracking, and wellness',
  [ExpertType.HEALTH]: 'Expert in medical appointments, clinic services, health consultations, and wellness',
  [ExpertType.RETAIL]: 'Expert in shopping, product recommendations, and retail services',
  [ExpertType.SALON]: 'Expert in salon appointments, beauty services, and personal care',
  [ExpertType.GENERAL]: 'General purpose assistant for general inquiries',
};

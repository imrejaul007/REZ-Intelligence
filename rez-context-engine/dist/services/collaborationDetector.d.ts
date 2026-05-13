import { EntryContext } from '../models/EntryContext';
import { RoutingDecision, ExpertType, CollaborationRequirement } from '../models/RoutingDecision';
/**
 * Collaboration trigger rules
 */
interface CollaborationTrigger {
    id: string;
    name: string;
    condition: (context: EntryContext, decision: RoutingDecision) => boolean;
    required: boolean;
    secondaryExperts: ExpertType[];
    reason: string;
    minConfidence?: number;
}
export interface CollaborationDetectionResult {
    collaboration: CollaborationRequirement;
    triggers: string[];
}
/**
 * Service for detecting when collaboration between experts is needed
 */
export declare class CollaborationDetector {
    private triggers;
    constructor();
    /**
     * Initialize collaboration triggers
     */
    private initializeTriggers;
    /**
     * Detect collaboration requirements for a routing decision
     */
    detect(context: EntryContext, decision: RoutingDecision): Promise<CollaborationDetectionResult>;
    /**
     * Generate a human-readable reason for collaboration
     */
    private generateCollaborationReason;
    /**
     * Calculate confidence score for collaboration recommendation
     */
    private calculateCollaborationConfidence;
    /**
     * Add a custom collaboration trigger
     */
    addTrigger(trigger: Omit<CollaborationTrigger, 'id'>): void;
    /**
     * Remove a collaboration trigger
     */
    removeTrigger(triggerId: string): boolean;
    /**
     * Get all active collaboration triggers
     */
    getTriggers(): CollaborationTrigger[];
    /**
     * Check if two experts should collaborate based on context
     */
    shouldCollaborate(expert1: ExpertType, expert2: ExpertType, context: EntryContext): boolean;
}
export declare const collaborationDetector: CollaborationDetector;
export {};
//# sourceMappingURL=collaborationDetector.d.ts.map
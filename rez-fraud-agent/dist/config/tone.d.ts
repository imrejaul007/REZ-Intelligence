export declare enum ToneType {
    PROFESSIONAL = "professional",
    ALERT = "alert",
    CAUTIOUS = "cautious",
    URGENT = "urgent",
    REASSURING = "reassuring"
}
export interface ToneConfig {
    type: ToneType;
    prefix: string;
    suffix: string;
    emoji?: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
}
export declare const TONE_CONFIGS: Record<ToneType, ToneConfig>;
export declare function getToneForRiskScore(riskScore: number): ToneConfig;
export declare function formatMessageWithTone(message: string, tone: ToneConfig): string;
export declare function getUrgencyLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical';
//# sourceMappingURL=tone.d.ts.map
import { MerchantCategory, EntryContext } from '../models/EntryContext';
export interface MerchantDetectionResult {
    category: MerchantCategory;
    confidence: number;
    matchedKeywords: string[];
    source: 'qr_code' | 'platform' | 'name' | 'explicit' | 'default';
}
/**
 * Service for detecting merchant category from various sources
 */
export declare class MerchantTypeDetector {
    /**
     * Detect merchant category from entry context
     */
    detect(context: EntryContext): Promise<MerchantDetectionResult>;
    /**
     * Detect merchant category from merchant name using keyword matching
     */
    private detectFromMerchantName;
    /**
     * Detect merchant category from text input (for dynamic detection)
     */
    detectFromText(text: string): MerchantDetectionResult;
    /**
     * Get all possible categories for a merchant name (for ambiguity detection)
     */
    getPossibleCategories(merchantName: string): MerchantDetectionResult[];
}
export declare const merchantTypeDetector: MerchantTypeDetector;
//# sourceMappingURL=merchantTypeDetector.d.ts.map
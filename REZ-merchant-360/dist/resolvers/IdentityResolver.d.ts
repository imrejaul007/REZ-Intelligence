/**
 * IdentityResolver.ts - Identity Resolution Operations
 */
import { Merchant360 } from '../MerchantProfile';
import { IdentityNode, IdentityEdge, IdentityResolutionResult, MatchCandidate, GraphQuery } from '../MerchantGraph';
export interface MergeRequest {
    source_merchant_id: string;
    target_merchant_id: string;
    strategy?: 'prefer_newer' | 'prefer_existing' | 'merge_all';
    attribute_conflicts?: Record<string, {
        source: unknown;
        target: unknown;
        resolved: unknown;
    }>;
}
export interface MergeResult {
    success: boolean;
    merged_merchant?: Merchant360;
    error?: string;
}
export interface IdentityLink {
    source_merchant_id: string;
    target_merchant_id: string;
    relationship_type: IdentityEdge['relationship_type'];
    confidence: number;
    evidence: Record<string, unknown>;
    linked_at: string;
}
export interface DuplicateDetectionResult {
    has_duplicates: boolean;
    groups: {
        primary_merchant_id: string;
        duplicate_ids: string[];
        confidence: number;
        reason: string;
    }[];
}
export declare class IdentityResolver {
    private graph;
    private matchThreshold;
    constructor(matchThreshold?: number);
    /**
     * Resolve identity for a merchant profile
     */
    resolveIdentity(merchant: Partial<Merchant360>): Promise<IdentityResolutionResult>;
    /**
     * Find potential duplicate merchants
     */
    detectDuplicates(merchants: Merchant360[]): Promise<DuplicateDetectionResult>;
    /**
     * Merge two merchant profiles
     */
    mergeMerchants(request: MergeRequest): Promise<MergeResult>;
    /**
     * Link two merchants with a relationship
     */
    linkMerchants(link: IdentityLink): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Unlink two merchants
     */
    unlinkMerchants(sourceId: string, targetId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get all links for a merchant
     */
    getLinks(merchantId: string): Promise<IdentityLink[]>;
    /**
     * Find match candidates for a merchant
     */
    findMatches(merchant: Partial<Merchant360>): Promise<MatchCandidate[]>;
    /**
     * Import identity graph from external source
     */
    importGraph(data: {
        nodes: IdentityNode[];
        edges: IdentityEdge[];
    }): void;
    /**
     * Export identity graph
     */
    exportGraph(): {
        nodes: IdentityNode[];
        edges: IdentityEdge[];
    };
    /**
     * Query identity graph
     */
    queryGraph(query: GraphQuery): IdentityNode[];
    /**
     * Get connected merchants (merchant network)
     */
    getMerchantNetwork(merchantId: string, maxDepth?: number): Promise<{
        merchant_id: string;
        business_name: string;
        relationship: string;
        confidence: number;
        distance: number;
    }[]>;
    /**
     * Analyze identity resolution quality
     */
    analyzeQuality(): Promise<{
        total_merchants: number;
        total_links: number;
        avg_confidence: number;
        low_confidence_count: number;
        orphan_nodes: number;
        graph_connected_components: number;
    }>;
    /**
     * Create verification record for identity match
     */
    createVerification(sourceMerchantId: string, targetMerchantId: string, verificationType: 'manual' | 'automated' | 'document'): {
        verification_id: string;
        source_merchant_id: string;
        target_merchant_id: string;
        type: string;
        status: 'pending' | 'approved' | 'rejected';
        created_at: string;
    };
    /**
     * Batch link multiple merchants
     */
    batchLink(links: IdentityLink[]): Promise<{
        successful: number;
        failed: number;
        errors: string[];
    }>;
}
//# sourceMappingURL=IdentityResolver.d.ts.map
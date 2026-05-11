/**
 * MerchantGraph.ts - Identity Resolution for Unified Merchant Identity
 * Implements entity resolution across multiple data sources
 */
import { Merchant360 } from './MerchantProfile';
export interface IdentityNode {
    id: string;
    merchant_id: string;
    source: string;
    source_id: string;
    confidence: number;
    attributes: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
export interface IdentityEdge {
    id: string;
    source_node_id: string;
    target_node_id: string;
    relationship_type: 'same_as' | 'related_to' | 'parent_of' | 'child_of';
    confidence: number;
    evidence: Record<string, unknown>;
    created_at: string;
}
export interface MatchCandidate {
    merchant: Merchant360;
    confidence: number;
    matching_attributes: string[];
    evidence: Record<string, unknown>;
}
export interface IdentityResolutionResult {
    resolved: boolean;
    merchant_id?: string;
    confidence: number;
    candidates: MatchCandidate[];
    merge_required: boolean;
    merge_suggestions?: {
        attribute: string;
        source_values: unknown[];
        suggested_value: unknown;
    }[];
}
export interface GraphQuery {
    merchant_id?: string;
    source?: string;
    min_confidence?: number;
    relationship_types?: IdentityEdge['relationship_type'][];
}
export declare class MerchantGraph {
    private nodes;
    private edges;
    private merchantIndex;
    private sourceIndex;
    private matchThreshold;
    constructor(matchThreshold?: number);
    /**
     * Add a new identity node from a source
     */
    addNode(merchant_id: string, source: string, source_id: string, attributes: Record<string, unknown>, confidence?: number): IdentityNode;
    /**
     * Link two identity nodes
     */
    addEdge(sourceNodeId: string, targetNodeId: string, relationshipType: IdentityEdge['relationship_type'], evidence?: Record<string, unknown>): IdentityEdge | null;
    /**
     * Find potential matches for a merchant profile
     */
    findMatches(merchant: Partial<Merchant360>): MatchCandidate[];
    /**
     * Resolve identity by finding or creating the correct merchant
     */
    resolveIdentity(merchant: Partial<Merchant360>): IdentityResolutionResult;
    /**
     * Merge two merchant profiles
     */
    mergeMerchants(sourceId: string, targetId: string): Merchant360 | null;
    /**
     * Get merchant by ID
     */
    getMerchantById(merchantId: string): Merchant360 | null;
    /**
     * Query the graph
     */
    query(query: GraphQuery): IdentityNode[];
    /**
     * Get connected nodes (graph traversal)
     */
    getConnectedNodes(nodeId: string, maxDepth?: number): IdentityNode[];
    /**
     * Generate a unique node ID
     */
    private generateNodeId;
    /**
     * Generate searchable signatures for matching
     */
    private generateSignatures;
    /**
     * Calculate match score between two merchants
     */
    private calculateMatchScore;
    /**
     * Calculate edge confidence from evidence
     */
    private calculateEdgeConfidence;
    /**
     * Generate merge suggestions
     */
    private generateMergeSuggestions;
    private normalizeEmail;
    private normalizePhone;
    private normalizeBusinessName;
    private normalizeAddress;
    private calculateSimilarity;
    private levenshteinDistance;
    private mergeString;
    private mergeAddresses;
    private mergeFinances;
    private mergeCatalog;
    private mergeInventory;
    private mergeCRM;
    private mergeLoyalty;
    private mergeStaff;
    exportGraph(): {
        nodes: IdentityNode[];
        edges: IdentityEdge[];
    };
    importGraph(data: {
        nodes: IdentityNode[];
        edges: IdentityEdge[];
    }): void;
}
//# sourceMappingURL=MerchantGraph.d.ts.map
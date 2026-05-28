"use strict";
/**
 * IdentityResolver.ts - Identity Resolution Operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityResolver = void 0;
const MerchantProfile_1 = require("../MerchantProfile");
const MerchantGraph_1 = require("../MerchantGraph");
const uuid_1 = require("uuid");
class IdentityResolver {
    graph;
    matchThreshold;
    constructor(matchThreshold = 0.85) {
        this.graph = new MerchantGraph_1.MerchantGraph(matchThreshold);
        this.matchThreshold = matchThreshold;
    }
    /**
     * Resolve identity for a merchant profile
     */
    async resolveIdentity(merchant) {
        return this.graph.resolveIdentity(merchant);
    }
    /**
     * Find potential duplicate merchants
     */
    async detectDuplicates(merchants) {
        const groups = [];
        const processed = new Set();
        for (const merchant of merchants) {
            if (processed.has(merchant.merchant_id))
                continue;
            const matches = this.graph.findMatches(merchant);
            const highConfidenceMatches = matches.filter(m => m.confidence >= this.matchThreshold);
            if (highConfidenceMatches.length > 0) {
                const group = {
                    primary_merchant_id: merchant.merchant_id,
                    duplicate_ids: highConfidenceMatches.map(m => m.merchant.merchant_id),
                    confidence: highConfidenceMatches[0].confidence,
                    reason: `Matched on: ${highConfidenceMatches[0].matching_attributes.join(', ')}`,
                };
                groups.push(group);
                // Mark all as processed
                processed.add(merchant.merchant_id);
                highConfidenceMatches.forEach(m => processed.add(m.merchant.merchant_id));
            }
        }
        return {
            has_duplicates: groups.length > 0,
            groups,
        };
    }
    /**
     * Merge two merchant profiles
     */
    async mergeMerchants(request) {
        try {
            const source = this.graph.getMerchantById(request.source_merchant_id);
            const target = this.graph.getMerchantById(request.target_merchant_id);
            if (!source) {
                return { success: false, error: 'Source merchant not found' };
            }
            if (!target) {
                return { success: false, error: 'Target merchant not found' };
            }
            const merged = this.graph.mergeMerchants(request.source_merchant_id, request.target_merchant_id);
            if (!merged) {
                return { success: false, error: 'Merge failed' };
            }
            // Validate merged profile
            const validated = (0, MerchantProfile_1.validateMerchantProfile)(merged);
            // Update graph with merged merchant
            this.graph.addNode(validated.merchant_id, 'merged', validated.merchant_id, validated, 1.0);
            return { success: true, merged_merchant: validated };
        }
        catch (error) {
            const err = error;
            return { success: false, error: err.message || 'Merge failed' };
        }
    }
    /**
     * Link two merchants with a relationship
     */
    async linkMerchants(link) {
        try {
            // Find nodes for both merchants
            const sourceNodes = this.graph.query({ merchant_id: link.source_merchant_id });
            const targetNodes = this.graph.query({ merchant_id: link.target_merchant_id });
            if (sourceNodes.length === 0 || targetNodes.length === 0) {
                return { success: false, error: 'One or both merchants not found in graph' };
            }
            const sourceNode = sourceNodes[0];
            const targetNode = targetNodes[0];
            this.graph.addEdge(sourceNode.id, targetNode.id, link.relationship_type, link.evidence);
            return { success: true };
        }
        catch (error) {
            const err = error;
            return { success: false, error: err.message };
        }
    }
    /**
     * Unlink two merchants
     */
    async unlinkMerchants(sourceId, targetId) {
        // Note: In production, this would require tracking edge IDs
        // For now, this is a simplified implementation
        return { success: true };
    }
    /**
     * Get all links for a merchant
     */
    async getLinks(merchantId) {
        const nodes = this.graph.query({ merchant_id: merchantId });
        if (nodes.length === 0)
            return [];
        const links = [];
        const node = nodes[0];
        // Get connected nodes
        const connected = this.graph.getConnectedNodes(node.id, 1);
        for (const connNode of connected) {
            if (connNode.id === node.id)
                continue;
            // Connected nodes share a relationship
            links.push({
                source_merchant_id: merchantId,
                target_merchant_id: connNode.merchant_id,
                relationship_type: 'related_to',
                confidence: Math.min(node.confidence, connNode.confidence),
                evidence: {},
                linked_at: new Date().toISOString(),
            });
        }
        return links;
    }
    /**
     * Find match candidates for a merchant
     */
    async findMatches(merchant) {
        return this.graph.findMatches(merchant);
    }
    /**
     * Import identity graph from external source
     */
    importGraph(data) {
        this.graph.importGraph(data);
    }
    /**
     * Export identity graph
     */
    exportGraph() {
        return this.graph.exportGraph();
    }
    /**
     * Query identity graph
     */
    queryGraph(query) {
        return this.graph.query(query);
    }
    /**
     * Get connected merchants (merchant network)
     */
    async getMerchantNetwork(merchantId, maxDepth = 3) {
        const nodes = this.graph.query({ merchant_id: merchantId });
        if (nodes.length === 0)
            return [];
        const node = nodes[0];
        const connected = this.graph.getConnectedNodes(node.id, maxDepth);
        const network = [];
        for (const connNode of connected) {
            if (connNode.merchant_id === merchantId)
                continue;
            const merchant = this.graph.getMerchantById(connNode.merchant_id);
            if (merchant) {
                network.push({
                    merchant_id: merchant.merchant_id,
                    business_name: merchant.business_name,
                    relationship: 'related',
                    confidence: connNode.confidence,
                    distance: 1, // Simplified
                });
            }
        }
        return network;
    }
    /**
     * Analyze identity resolution quality
     */
    async analyzeQuality() {
        const allNodes = this.graph.query({});
        const allEdges = this.graph.exportGraph().edges;
        const merchantIds = new Set(allNodes.map(n => n.merchant_id));
        const totalLinks = allEdges.filter(e => e.relationship_type === 'same_as').length;
        const avgConfidence = allNodes.length > 0
            ? allNodes.reduce((sum, n) => sum + n.confidence, 0) / allNodes.length
            : 0;
        const lowConfidenceCount = allNodes.filter(n => n.confidence < this.matchThreshold).length;
        return {
            total_merchants: merchantIds.size,
            total_links: totalLinks,
            avg_confidence: avgConfidence,
            low_confidence_count: lowConfidenceCount,
            orphan_nodes: 0, // Would require graph traversal
            graph_connected_components: 0, // Would require graph traversal
        };
    }
    /**
     * Create verification record for identity match
     */
    createVerification(sourceMerchantId, targetMerchantId, verificationType) {
        return {
            verification_id: (0, uuid_1.v4)(),
            source_merchant_id: sourceMerchantId,
            target_merchant_id: targetMerchantId,
            type: verificationType,
            status: 'pending',
            created_at: new Date().toISOString(),
        };
    }
    /**
     * Batch link multiple merchants
     */
    async batchLink(links) {
        let successful = 0;
        let failed = 0;
        const errors = [];
        for (const link of links) {
            const result = await this.linkMerchants(link);
            if (result.success) {
                successful++;
            }
            else {
                failed++;
                errors.push(`Link ${link.source_merchant_id} -> ${link.target_merchant_id}: ${result.error}`);
            }
        }
        return { successful, failed, errors };
    }
}
exports.IdentityResolver = IdentityResolver;
//# sourceMappingURL=IdentityResolver.js.map
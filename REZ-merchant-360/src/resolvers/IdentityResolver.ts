/**
 * IdentityResolver.ts - Identity Resolution Operations
 */

import { Merchant360, Address, validateMerchantProfile } from '../MerchantProfile';
import {
  MerchantGraph,
  IdentityNode,
  IdentityEdge,
  IdentityResolutionResult,
  MatchCandidate,
  GraphQuery,
} from '../MerchantGraph';
import { v4 as uuidv4 } from 'uuid';

export interface MergeRequest {
  source_merchant_id: string;
  target_merchant_id: string;
  strategy?: 'prefer_newer' | 'prefer_existing' | 'merge_all';
  attribute_conflicts?: Record<string, { source: unknown; target: unknown; resolved: unknown }>;
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

export class IdentityResolver {
  private graph: MerchantGraph;
  private matchThreshold: number;

  constructor(matchThreshold: number = 0.85) {
    this.graph = new MerchantGraph(matchThreshold);
    this.matchThreshold = matchThreshold;
  }

  /**
   * Resolve identity for a merchant profile
   */
  async resolveIdentity(merchant: Partial<Merchant360>): Promise<IdentityResolutionResult> {
    return this.graph.resolveIdentity(merchant);
  }

  /**
   * Find potential duplicate merchants
   */
  async detectDuplicates(merchants: Merchant360[]): Promise<DuplicateDetectionResult> {
    const groups: DuplicateDetectionResult['groups'] = [];
    const processed = new Set<string>();

    for (const merchant of merchants) {
      if (processed.has(merchant.merchant_id)) continue;

      const matches = this.graph.findMatches(merchant);
      const highConfidenceMatches = matches.filter(m => m.confidence >= this.matchThreshold);

      if (highConfidenceMatches.length > 0) {
        const group: DuplicateDetectionResult['groups'][0] = {
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
  async mergeMerchants(request: MergeRequest): Promise<MergeResult> {
    try {
      const source = this.graph.getMerchantById(request.source_merchant_id);
      const target = this.graph.getMerchantById(request.target_merchant_id);

      if (!source) {
        return { success: false, error: 'Source merchant not found' };
      }

      if (!target) {
        return { success: false, error: 'Target merchant not found' };
      }

      const merged = this.graph.mergeMerchants(
        request.source_merchant_id,
        request.target_merchant_id
      );

      if (!merged) {
        return { success: false, error: 'Merge failed' };
      }

      // Validate merged profile
      const validated = validateMerchantProfile(merged);

      // Update graph with merged merchant
      this.graph.addNode(
        validated.merchant_id,
        'merged',
        validated.merchant_id,
        validated as unknown as Record<string, unknown>,
        1.0
      );

      return { success: true, merged_merchant: validated };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message || 'Merge failed' };
    }
  }

  /**
   * Link two merchants with a relationship
   */
  async linkMerchants(link: IdentityLink): Promise<{ success: boolean; error?: string }> {
    try {
      // Find nodes for both merchants
      const sourceNodes = this.graph.query({ merchant_id: link.source_merchant_id });
      const targetNodes = this.graph.query({ merchant_id: link.target_merchant_id });

      if (sourceNodes.length === 0 || targetNodes.length === 0) {
        return { success: false, error: 'One or both merchants not found in graph' };
      }

      const sourceNode = sourceNodes[0];
      const targetNode = targetNodes[0];

      this.graph.addEdge(
        sourceNode.id,
        targetNode.id,
        link.relationship_type,
        link.evidence
      );

      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  }

  /**
   * Unlink two merchants
   */
  async unlinkMerchants(
    sourceId: string,
    targetId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Note: In production, this would require tracking edge IDs
    // For now, this is a simplified implementation
    return { success: true };
  }

  /**
   * Get all links for a merchant
   */
  async getLinks(
    merchantId: string
  ): Promise<IdentityLink[]> {
    const nodes = this.graph.query({ merchant_id: merchantId });
    if (nodes.length === 0) return [];

    const links: IdentityLink[] = [];
    const node = nodes[0];

    // Get connected nodes
    const connected = this.graph.getConnectedNodes(node.id, 1);

    for (const connNode of connected) {
      if (connNode.id === node.id) continue;

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
  async findMatches(merchant: Partial<Merchant360>): Promise<MatchCandidate[]> {
    return this.graph.findMatches(merchant);
  }

  /**
   * Import identity graph from external source
   */
  importGraph(data: { nodes: IdentityNode[]; edges: IdentityEdge[] }): void {
    this.graph.importGraph(data);
  }

  /**
   * Export identity graph
   */
  exportGraph(): { nodes: IdentityNode[]; edges: IdentityEdge[] } {
    return this.graph.exportGraph();
  }

  /**
   * Query identity graph
   */
  queryGraph(query: GraphQuery): IdentityNode[] {
    return this.graph.query(query);
  }

  /**
   * Get connected merchants (merchant network)
   */
  async getMerchantNetwork(merchantId: string, maxDepth: number = 3): Promise<{
    merchant_id: string;
    business_name: string;
    relationship: string;
    confidence: number;
    distance: number;
  }[]> {
    const nodes = this.graph.query({ merchant_id: merchantId });
    if (nodes.length === 0) return [];

    const node = nodes[0];
    const connected = this.graph.getConnectedNodes(node.id, maxDepth);

    const network: {
      merchant_id: string;
      business_name: string;
      relationship: string;
      confidence: number;
      distance: number;
    }[] = [];

    for (const connNode of connected) {
      if (connNode.merchant_id === merchantId) continue;

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
  async analyzeQuality(): Promise<{
    total_merchants: number;
    total_links: number;
    avg_confidence: number;
    low_confidence_count: number;
    orphan_nodes: number;
    graph_connected_components: number;
  }> {
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
  createVerification(
    sourceMerchantId: string,
    targetMerchantId: string,
    verificationType: 'manual' | 'automated' | 'document'
  ): {
    verification_id: string;
    source_merchant_id: string;
    target_merchant_id: string;
    type: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
  } {
    return {
      verification_id: uuidv4(),
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
  async batchLink(
    links: IdentityLink[]
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const link of links) {
      const result = await this.linkMerchants(link);
      if (result.success) {
        successful++;
      } else {
        failed++;
        errors.push(`Link ${link.source_merchant_id} -> ${link.target_merchant_id}: ${result.error}`);
      }
    }

    return { successful, failed, errors };
  }
}

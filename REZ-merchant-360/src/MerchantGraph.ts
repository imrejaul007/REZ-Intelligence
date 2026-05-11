/**
 * MerchantGraph.ts - Identity Resolution for Unified Merchant Identity
 * Implements entity resolution across multiple data sources
 */

import { v4 as uuidv4 } from 'uuid';
import { Merchant360, Address } from './MerchantProfile';
import { createHash } from 'crypto';

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

export class MerchantGraph {
  private nodes: Map<string, IdentityNode> = new Map();
  private edges: Map<string, IdentityEdge> = new Map();
  private merchantIndex: Map<string, Set<string>> = new Map(); // merchant_id -> node_ids
  private sourceIndex: Map<string, Set<string>> = new Map(); // source -> node_ids
  private matchThreshold: number;

  constructor(matchThreshold: number = 0.85) {
    this.matchThreshold = matchThreshold;
  }

  /**
   * Add a new identity node from a source
   */
  addNode(
    merchant_id: string,
    source: string,
    source_id: string,
    attributes: Record<string, unknown>,
    confidence: number = 1.0
  ): IdentityNode {
    const nodeId = this.generateNodeId(source, source_id);
    const now = new Date().toISOString();

    const node: IdentityNode = {
      id: nodeId,
      merchant_id,
      source,
      source_id,
      confidence,
      attributes,
      created_at: now,
      updated_at: now,
    };

    this.nodes.set(nodeId, node);

    // Update indexes
    if (!this.merchantIndex.has(merchant_id)) {
      this.merchantIndex.set(merchant_id, new Set());
    }
    this.merchantIndex.get(merchant_id)!.add(nodeId);

    if (!this.sourceIndex.has(source)) {
      this.sourceIndex.set(source, new Set());
    }
    this.sourceIndex.get(source)!.add(nodeId);

    return node;
  }

  /**
   * Link two identity nodes
   */
  addEdge(
    sourceNodeId: string,
    targetNodeId: string,
    relationshipType: IdentityEdge['relationship_type'],
    evidence: Record<string, unknown> = {}
  ): IdentityEdge | null {
    const sourceNode = this.nodes.get(sourceNodeId);
    const targetNode = this.nodes.get(targetNodeId);

    if (!sourceNode || !targetNode) {
      return null;
    }

    // Calculate edge confidence based on evidence strength
    const confidence = this.calculateEdgeConfidence(evidence);

    const edgeId = uuidv4();
    const now = new Date().toISOString();

    const edge: IdentityEdge = {
      id: edgeId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      relationship_type: relationshipType,
      confidence,
      evidence,
      created_at: now,
    };

    this.edges.set(edgeId, edge);

    // Also add reverse edge for 'same_as' and 'related_to'
    if (relationshipType === 'same_as' || relationshipType === 'related_to') {
      const reverseEdge: IdentityEdge = {
        id: uuidv4(),
        source_node_id: targetNodeId,
        target_node_id: sourceNodeId,
        relationship_type: relationshipType,
        confidence,
        evidence,
        created_at: now,
      };
      this.edges.set(reverseEdge.id, reverseEdge);
    }

    return edge;
  }

  /**
   * Find potential matches for a merchant profile
   */
  findMatches(merchant: Partial<Merchant360>): MatchCandidate[] {
    const candidates: MatchCandidate[] = [];
    const querySignatures = this.generateSignatures(merchant);

    for (const [nodeId, node] of this.nodes) {
      if (node.merchant_id === merchant.merchant_id) {
        continue; // Skip self
      }

      const existingMerchant = this.getMerchantById(node.merchant_id);
      if (!existingMerchant) continue;

      const matchResult = this.calculateMatchScore(merchant, existingMerchant, querySignatures);

      if (matchResult.score >= this.matchThreshold) {
        candidates.push({
          merchant: existingMerchant,
          confidence: matchResult.score,
          matching_attributes: matchResult.matchedAttributes,
          evidence: matchResult.evidence,
        });
      }
    }

    // Sort by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);

    return candidates;
  }

  /**
   * Resolve identity by finding or creating the correct merchant
   */
  resolveIdentity(merchant: Partial<Merchant360>): IdentityResolutionResult {
    const matches = this.findMatches(merchant);

    if (matches.length === 0) {
      // No matches found - create new merchant
      return {
        resolved: false,
        merchant_id: merchant.merchant_id,
        confidence: 1.0,
        candidates: [],
        merge_required: false,
      };
    }

    const topMatch = matches[0];

    if (topMatch.confidence >= 0.95) {
      // High confidence match - use existing merchant
      return {
        resolved: true,
        merchant_id: topMatch.merchant.merchant_id,
        confidence: topMatch.confidence,
        candidates: matches,
        merge_required: false,
      };
    }

    // Medium confidence - suggest merge
    const mergeSuggestions = this.generateMergeSuggestions(merchant, topMatch.merchant) || [];

    return {
      resolved: true,
      merchant_id: topMatch.merchant.merchant_id,
      confidence: topMatch.confidence,
      candidates: matches,
      merge_required: mergeSuggestions.length > 0,
      merge_suggestions: mergeSuggestions,
    };
  }

  /**
   * Merge two merchant profiles
   */
  mergeMerchants(sourceId: string, targetId: string): Merchant360 | null {
    const source = this.getMerchantById(sourceId);
    const target = this.getMerchantById(targetId);

    if (!source || !target) {
      return null;
    }

    const merged: Merchant360 = {
      ...target,
      // Identity - prefer longer/more complete values
      business_name: this.mergeString(source.business_name, target.business_name, 'longest'),
      brand_names: [...new Set([...source.brand_names, ...target.brand_names])],
      verticals: [...new Set([...source.verticals, ...target.verticals])],

      // Contact - prefer non-empty values
      email: target.email || source.email,
      phone: target.phone || source.phone,
      addresses: this.mergeAddresses(source.addresses, target.addresses),

      // Module Data - sum numeric values, prefer max for counts
      finances: this.mergeFinances(source.finances, target.finances),
      catalog: this.mergeCatalog(source.catalog, target.catalog),
      inventory: this.mergeInventory(source.inventory, target.inventory),
      crm: this.mergeCRM(source.crm, target.crm),
      loyalty: this.mergeLoyalty(source.loyalty, target.loyalty),
      staff: this.mergeStaff(source.staff, target.staff),

      // Use latest timestamps
      updated_at: new Date().toISOString(),
    };

    return merged;
  }

  /**
   * Get merchant by ID
   */
  getMerchantById(merchantId: string): Merchant360 | null {
    const nodeIds = this.merchantIndex.get(merchantId);
    if (!nodeIds || nodeIds.size === 0) {
      return null;
    }

    // For now, return first node's stored merchant
    // In production, this would aggregate from a database
    const firstNodeId = [...nodeIds][0];
    const node = this.nodes.get(firstNodeId);
    if (!node) return null;

    // Reconstruct merchant from node attributes
    return node.attributes as unknown as Merchant360;
  }

  /**
   * Query the graph
   */
  query(query: GraphQuery): IdentityNode[] {
    const results: IdentityNode[] = [];

    for (const [nodeId, node] of this.nodes) {
      if (query.merchant_id && node.merchant_id !== query.merchant_id) continue;
      if (query.source && node.source !== query.source) continue;
      if (query.min_confidence && node.confidence < query.min_confidence) continue;

      results.push(node);
    }

    return results;
  }

  /**
   * Get connected nodes (graph traversal)
   */
  getConnectedNodes(nodeId: string, maxDepth: number = 2): IdentityNode[] {
    const visited = new Set<string>();
    const result: IdentityNode[] = [];
    const queue: { nodeId: string; depth: number }[] = [{ nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId: currentId, depth } = queue.shift()!;

      if (visited.has(currentId) || depth > maxDepth) continue;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (node) {
        result.push(node);
      }

      // Find connected edges
      for (const edge of this.edges.values()) {
        if (edge.source_node_id === currentId) {
          queue.push({ nodeId: edge.target_node_id, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Generate a unique node ID
   */
  private generateNodeId(source: string, sourceId: string): string {
    return createHash('sha256')
      .update(`${source}:${sourceId}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate searchable signatures for matching
   */
  private generateSignatures(merchant: Partial<Merchant360>): string[] {
    const signatures: string[] = [];

    if (merchant.email) {
      signatures.push(this.normalizeEmail(merchant.email));
    }

    if (merchant.phone) {
      signatures.push(this.normalizePhone(merchant.phone));
    }

    if (merchant.business_name) {
      signatures.push(this.normalizeBusinessName(merchant.business_name));
    }

    for (const address of merchant.addresses || []) {
      signatures.push(this.normalizeAddress(address));
    }

    return signatures;
  }

  /**
   * Calculate match score between two merchants
   */
  private calculateMatchScore(
    incoming: Partial<Merchant360>,
    existing: Merchant360,
    signatures: string[]
  ): { score: number; matchedAttributes: string[]; evidence: Record<string, unknown> } {
    let totalWeight = 0;
    let matchedWeight = 0;
    const matchedAttributes: string[] = [];
    const evidence: Record<string, unknown> = {};

    const weights: Record<string, number> = {
      email: 0.3,
      phone: 0.25,
      business_name: 0.25,
      address: 0.15,
      tax_id: 0.05,
    };

    // Email match
    if (incoming.email && existing.email) {
      totalWeight += weights.email;
      if (this.normalizeEmail(incoming.email) === this.normalizeEmail(existing.email)) {
        matchedWeight += weights.email;
        matchedAttributes.push('email');
        evidence.email_match = true;
      }
    }

    // Phone match
    if (incoming.phone && existing.phone) {
      totalWeight += weights.phone;
      if (this.normalizePhone(incoming.phone) === this.normalizePhone(existing.phone)) {
        matchedWeight += weights.phone;
        matchedAttributes.push('phone');
        evidence.phone_match = true;
      }
    }

    // Business name match (with fuzzy matching)
    if (incoming.business_name && existing.business_name) {
      totalWeight += weights.business_name;
      const similarity = this.calculateSimilarity(
        this.normalizeBusinessName(incoming.business_name),
        this.normalizeBusinessName(existing.business_name)
      );
      if (similarity >= 0.8) {
        matchedWeight += weights.business_name * similarity;
        matchedAttributes.push('business_name');
        evidence.business_name_similarity = similarity;
      }
    }

    // Address match
    if ((incoming.addresses || []).length > 0 && existing.addresses.length > 0) {
      totalWeight += weights.address;
      for (const incomingAddr of incoming.addresses!) {
        for (const existingAddr of existing.addresses) {
          if (this.normalizeAddress(incomingAddr) === this.normalizeAddress(existingAddr)) {
            matchedWeight += weights.address;
            matchedAttributes.push('address');
            evidence.address_match = true;
            break;
          }
        }
      }
    }

    const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;

    return { score, matchedAttributes, evidence };
  }

  /**
   * Calculate edge confidence from evidence
   */
  private calculateEdgeConfidence(evidence: Record<string, unknown>): number {
    let confidence = 0.5; // Base confidence

    if (evidence.email_match) confidence += 0.2;
    if (evidence.phone_match) confidence += 0.15;
    if (evidence.verified) confidence += 0.3;
    if (evidence.manual_review) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate merge suggestions
   */
  private generateMergeSuggestions(
    incoming: Partial<Merchant360>,
    existing: Merchant360
  ): IdentityResolutionResult['merge_suggestions'] {
    const suggestions: NonNullable<IdentityResolutionResult['merge_suggestions']> = [];

    if (incoming.business_name && existing.business_name &&
        incoming.business_name !== existing.business_name) {
      suggestions.push({
        attribute: 'business_name',
        source_values: [incoming.business_name, existing.business_name],
        suggested_value: incoming.business_name.length > existing.business_name.length
          ? incoming.business_name
          : existing.business_name,
      });
    }

    if (incoming.email && existing.email && incoming.email !== existing.email) {
      suggestions.push({
        attribute: 'email',
        source_values: [incoming.email, existing.email],
        suggested_value: incoming.email, // Prefer newer value
      });
    }

    return suggestions;
  }

  // Normalization helpers
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim().replace(/[^a-z0-9@.]/g, '');
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^1/, '');
  }

  private normalizeBusinessName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  }

  private normalizeAddress(address: Address): string {
    return `${address.street},${address.city},${address.state},${address.postal_code}`
      .toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9,]/g, '');
  }

  // Similarity calculation
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    const longerLength = longer.length;
    const editDistance = this.levenshteinDistance(longer, shorter);

    return (longerLength - editDistance) / longerLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Merge helpers
  private mergeString(val1: string | undefined, val2: string | undefined, strategy: 'longest' | 'first' = 'longest'): string {
    if (!val1) return val2 || '';
    if (!val2) return val1;
    return strategy === 'longest' ? (val1.length > val2.length ? val1 : val2) : val1;
  }

  private mergeAddresses(addrs1: Address[], addrs2: Address[]): Address[] {
    const merged = [...addrs2];
    for (const addr1 of addrs1) {
      const exists = merged.some(a =>
        this.normalizeAddress(a) === this.normalizeAddress(addr1)
      );
      if (!exists) {
        merged.push(addr1);
      }
    }
    return merged;
  }

  private mergeFinances(f1: Merchant360['finances'], f2: Merchant360['finances']): Merchant360['finances'] {
    return {
      wallet_balance: f1.wallet_balance + f2.wallet_balance,
      pending_payouts: f1.pending_payouts + f2.pending_payouts,
      monthly_revenue: f1.monthly_revenue + f2.monthly_revenue,
      lifetime_revenue: f1.lifetime_revenue + f2.lifetime_revenue,
      credit_score: Math.max(f1.credit_score, f2.credit_score),
    };
  }

  private mergeCatalog(c1: Merchant360['catalog'], c2: Merchant360['catalog']): Merchant360['catalog'] {
    return {
      total_products: c1.total_products + c2.total_products,
      active_products: c1.active_products + c2.active_products,
      categories: [...new Set([...c1.categories, ...c2.categories])],
    };
  }

  private mergeInventory(i1: Merchant360['inventory'], i2: Merchant360['inventory']): Merchant360['inventory'] {
    return {
      total_items: i1.total_items + i2.total_items,
      low_stock_alerts: i1.low_stock_alerts + i2.low_stock_alerts,
      suppliers: [...new Set([...i1.suppliers, ...i2.suppliers])],
    };
  }

  private mergeCRM(c1: Merchant360['crm'], c2: Merchant360['crm']): Merchant360['crm'] {
    return {
      total_customers: c1.total_customers + c2.total_customers,
      monthly_customers: c1.monthly_customers + c2.monthly_customers,
      avg_rating: (c1.avg_rating + c2.avg_rating) / 2,
      reviews_count: c1.reviews_count + c2.reviews_count,
    };
  }

  private mergeLoyalty(l1: Merchant360['loyalty'], l2: Merchant360['loyalty']): Merchant360['loyalty'] {
    return {
      program_active: l1.program_active || l2.program_active,
      active_members: l1.active_members + l2.active_members,
      monthly_points_issued: l1.monthly_points_issued + l2.monthly_points_issued,
    };
  }

  private mergeStaff(s1: Merchant360['staff'], s2: Merchant360['staff']): Merchant360['staff'] {
    return {
      total: s1.total + s2.total,
      admins: s1.admins + s2.admins,
      employees: s1.employees + s2.employees,
    };
  }

  // Export/Import for persistence
  exportGraph(): { nodes: IdentityNode[]; edges: IdentityEdge[] } {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
    };
  }

  importGraph(data: { nodes: IdentityNode[]; edges: IdentityEdge[] }): void {
    this.nodes.clear();
    this.edges.clear();
    this.merchantIndex.clear();
    this.sourceIndex.clear();

    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
      if (!this.merchantIndex.has(node.merchant_id)) {
        this.merchantIndex.set(node.merchant_id, new Set());
      }
      this.merchantIndex.get(node.merchant_id)!.add(node.id);
      if (!this.sourceIndex.has(node.source)) {
        this.sourceIndex.set(node.source, new Set());
      }
      this.sourceIndex.get(node.source)!.add(node.id);
    }

    for (const edge of data.edges) {
      this.edges.set(edge.id, edge);
    }
  }
}

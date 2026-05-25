/**
 * REZ Merchant Graph - Core Service
 *
 * Merchant Intelligence Graph - Relationship mapping and network analysis
 */

import { v4 as uuidv4 } from 'uuid';
import logger from './utils/logger';
import type {
  Merchant,
  MerchantRelationship,
  MerchantNetwork,
  GraphQuery,
  GraphResult,
  GraphNode,
  GraphEdge,
  InfluenceAnalysis,
  OpportunityAnalysis,
  SearchMerchantsRequest,
  CreateRelationshipRequest,
} from './types';

// In-memory stores
const merchants = new Map<string, Merchant>();
const relationships = new Map<string, MerchantRelationship>();
const networks = new Map<string, MerchantNetwork>();

// ============================================
// MERCHANT MANAGEMENT
// ============================================

export async function createMerchant(merchant: Omit<Merchant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Merchant> {
  const newMerchant: Merchant = {
    ...merchant,
    id: uuidv4(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  merchants.set(newMerchant.id, newMerchant);
  logger.info('Merchant created', { merchantId: newMerchant.id, name: newMerchant.name });
  return newMerchant;
}

export async function getMerchant(merchantId: string): Promise<Merchant | null> {
  return merchants.get(merchantId) || null;
}

export async function searchMerchants(request: SearchMerchantsRequest): Promise<{ success: boolean; merchants?: Merchant[]; total?: number; error?: string }> {
  try {
    let results = Array.from(merchants.values());

    if (request.query) {
      const query = request.query.toLowerCase();
      results = results.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query)
      );
    }

    if (request.filters?.type?.length) {
      results = results.filter(m => request.filters!.type!.includes(m.type));
    }

    if (request.filters?.minScore !== undefined) {
      results = results.filter(m => (m.score?.overall || 0) >= request.filters!.minScore!);
    }

    if (request.sortBy) {
      results.sort((a, b) => {
        let aVal: number, bVal: number;
        switch (request.sortBy) {
          case 'score': aVal = a.score?.overall || 0; bVal = b.score?.overall || 0; break;
          case 'name': return a.name.localeCompare(b.name);
          default: aVal = 0; bVal = 0;
        }
        return request.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    const offset = request.offset || 0;
    const limit = request.limit || 20;
    const paginatedResults = results.slice(offset, offset + limit);

    return { success: true, merchants: paginatedResults, total: results.length };
  } catch (error) {
    return { success: false, error: 'Search failed' };
  }
}

// ============================================
// RELATIONSHIP MANAGEMENT
// ============================================

export async function createRelationship(request: CreateRelationshipRequest): Promise<{ success: boolean; relationship?: MerchantRelationship; error?: string }> {
  try {
    const relationship: MerchantRelationship = {
      id: uuidv4(),
      sourceMerchantId: request.sourceMerchantId,
      targetMerchantId: request.targetMerchantId,
      type: request.type,
      strength: 0.5,
      bidirectional: request.bidirectional || false,
      metadata: request.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    relationships.set(relationship.id, relationship);

    // Update merchant relationships
    const sourceMerchant = merchants.get(request.sourceMerchantId);
    const targetMerchant = merchants.get(request.targetMerchantId);

    if (sourceMerchant) {
      sourceMerchant.relationships = sourceMerchant.relationships || [];
      sourceMerchant.relationships.push(relationship.id);
      merchants.set(sourceMerchant.id, sourceMerchant);
    }
    if (targetMerchant) {
      targetMerchant.relationships = targetMerchant.relationships || [];
      targetMerchant.relationships.push(relationship.id);
      merchants.set(targetMerchant.id, targetMerchant);
    }

    logger.info('Relationship created', { relationshipId: relationship.id });
    return { success: true, relationship };
  } catch (error) {
    return { success: false, error: 'Failed to create relationship' };
  }
}

export async function getRelationship(relationshipId: string): Promise<MerchantRelationship | null> {
  return relationships.get(relationshipId) || null;
}

export async function getMerchantRelationships(merchantId: string): Promise<MerchantRelationship[]> {
  return Array.from(relationships.values()).filter(
    r => r.sourceMerchantId === merchantId || r.targetMerchantId === merchantId
  );
}

// ============================================
// GRAPH QUERIES
// ============================================

export async function queryGraph(query: GraphQuery): Promise<GraphResult> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const visited = new Set<string>();

  // Start from initial nodes
  for (const nodeId of query.startNodes) {
    await addNodeToResult(nodeId, nodes, visited);
  }

  // Traverse relationships
  const maxDepth = query.depth || 1;
  for (let depth = 0; depth < maxDepth; depth++) {
    const currentNodes = nodes.filter(n => !n.properties['_depth'] || n.properties['_depth'] === depth);
    for (const node of currentNodes) {
      const nodeRelationships = Array.from(relationships.values()).filter(
        r => r.sourceMerchantId === node.id || r.targetMerchantId === node.id
      );

      for (const rel of nodeRelationships) {
        if (query.relationshipTypes && !query.relationshipTypes.includes(rel.type)) continue;

        // Add edge
        const edge: GraphEdge = {
          id: rel.id,
          source: rel.sourceMerchantId,
          target: rel.targetMerchantId,
          type: rel.type,
          weight: rel.strength,
        };
        edges.push(edge);

        // Add connected node
        const neighborId = rel.sourceMerchantId === node.id ? rel.targetMerchantId : rel.sourceMerchantId;
        if (!visited.has(neighborId)) {
          await addNodeToResult(neighborId, nodes, visited, depth + 1);
        }
      }
    }

    if (nodes.length >= (query.limit || 100)) break;
  }

  return {
    nodes,
    edges,
    statistics: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      avgDegree: edges.length * 2 / Math.max(1, nodes.length),
      density: edges.length / Math.max(1, nodes.length * (nodes.length - 1) / 2),
      components: countComponents(nodes, edges),
      avgClustering: 0.3,
    },
  };
}

async function addNodeToResult(nodeId: string, nodes: GraphNode[], visited: Set<string>, depth = 0): Promise<void> {
  const merchant = merchants.get(nodeId);
  if (!merchant) return;

  visited.add(nodeId);
  nodes.push({
    id: merchant.id,
    type: 'merchant',
    label: merchant.name,
    properties: {
      category: merchant.category,
      type: merchant.type,
      _depth: depth,
    },
    score: merchant.score?.overall,
  });
}

function countComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  edges.forEach(e => {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  });

  let components = 0;
  const visited = new Set<string>();

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    components++;
    const stack = [node.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      adjacency.get(current)?.forEach(neighbor => {
        if (!visited.has(neighbor)) stack.push(neighbor);
      });
    }
  }

  return components;
}

// ============================================
// NETWORK ANALYSIS
// ============================================

export async function analyzeInfluence(merchantId: string): Promise<InfluenceAnalysis | null> {
  const merchant = merchants.get(merchantId);
  if (!merchant) return null;

  // Get direct relationships
  const directRels = Array.from(relationships.values()).filter(
    r => r.sourceMerchantId === merchantId || r.targetMerchantId === merchantId
  );

  // Get indirect (2nd degree) relationships
  const directIds = new Set(directRels.map(r =>
    r.sourceMerchantId === merchantId ? r.targetMerchantId : r.sourceMerchantId
  ));

  const indirectRels = Array.from(relationships.values()).filter(
    r => directIds.has(r.sourceMerchantId) || directIds.has(r.targetMerchantId)
  );

  return {
    merchantId,
    influenceScore: 0.5 + (directRels.length * 0.1),
    reach: {
      direct: directRels.length,
      indirect: indirectRels.length,
      total: directRels.length + indirectRels.length,
    },
    impactMetrics: {
      avgTransactionImpact: 1000,
      customerOverlap: 0.2,
      referralRate: 0.15,
    },
    topInfluencedMerchants: directRels.map(r => ({
      merchantId: r.sourceMerchantId === merchantId ? r.targetMerchantId : r.sourceMerchantId,
      influenceStrength: r.strength,
    })),
  };
}

export async function analyzeOpportunities(merchantId: string): Promise<OpportunityAnalysis | null> {
  const merchant = merchants.get(merchantId);
  if (!merchant) return null;

  const opportunities = [];

  // Find merchants in same category for partnership
  const sameCategory = Array.from(merchants.values()).filter(
    m => m.id !== merchantId && m.category === merchant.category
  );
  if (sameCategory.length > 0) {
    opportunities.push({
      type: 'partnership' as const,
      score: 0.7,
      description: 'Partnership opportunities in same category',
      targetMerchants: sameCategory.slice(0, 5).map(m => m.id),
    });
  }

  // Find complementary merchants
  const complementary = Array.from(merchants.values()).filter(
    m => m.id !== merchantId && m.category !== merchant.category
  );
  if (complementary.length > 0) {
    opportunities.push({
      type: 'expansion' as const,
      score: 0.6,
      description: 'Cross-category expansion opportunities',
      targetMerchants: complementary.slice(0, 5).map(m => m.id),
    });
  }

  return {
    merchantId,
    opportunities,
    competitiveAdvantages: ['Established brand', 'Strong location', 'Loyal customer base'],
    marketGaps: ['Online presence', 'Mobile app integration'],
  };
}

// ============================================
// HEALTH & STATS
// ============================================

export function getHealthStatus() {
  return {
    status: 'healthy' as const,
    uptime: Date.now(),
    merchants: merchants.size,
    relationships: relationships.size,
    networks: networks.size,
    lastProcessed: new Date(),
  };
}

export function getStats() {
  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  merchants.forEach(m => {
    byType[m.type] = (byType[m.type] || 0) + 1;
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
  });

  return {
    totalMerchants: merchants.size,
    totalRelationships: relationships.size,
    totalNetworks: networks.size,
    avgRelationshipsPerMerchant: merchants.size > 0 ? relationships.size / merchants.size : 0,
    byType,
    byCategory,
  };
}

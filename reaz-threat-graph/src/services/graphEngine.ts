/**
 * Graph Engine
 *
 * Core graph operations for the REZ Threat Graph.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ThreatGraphEntity,
  EntityType,
  ServiceType,
  EntityIdentity,
  EntityConnection,
  ConnectionType,
  UniversalScores,
  FraudIndicator,
  FraudNetwork,
  FraudRingMember,
  FraudPattern,
  FraudRingType
} from '../types/index.js';

// ============================================
// GRAPH ENGINE CLASS
// ============================================

export class GraphEngine {
  // In-memory graph storage (would use Neo4j/MongoDB in production)
  private entities: Map<string, ThreatGraphEntity> = new Map();
  private connections: Map<string, EntityConnection[]> = new Map();
  private fraudNetworks: Map<string, FraudNetwork> = new Map();

  // Indexes for fast lookup
  private identityIndex: Map<string, string> = new Map(); // identifier -> entityId
  private serviceIndex: Map<ServiceType, Set<string>> = new Map();

  constructor() {
    // Initialize service indexes
    const services: ServiceType[] = [
      'corpid', 'wasil', 'ridza', 'rez-ride', 'airzy',
      'risacare', 'rez-merchant', 'buzzlocal', 'mytalent', 'corp-os'
    ];
    services.forEach(s => this.serviceIndex.set(s, new Set()));
  }

  // ============================================
  // ENTITY OPERATIONS
  // ============================================

  /**
   * Create or update an entity
   */
  upsertEntity(entity: Omit<ThreatGraphEntity, 'entityId' | 'firstSeen' | 'lastUpdated'>): ThreatGraphEntity {
    let existingEntity = this.entities.get(entity.primaryService + '_' + entity.identities[0]?.identifier);

    if (existingEntity) {
      // Update existing
      existingEntity = {
        ...existingEntity,
        ...entity,
        lastUpdated: new Date()
      };
      this.entities.set(existingEntity.entityId, existingEntity);
    } else {
      // Create new
      const newEntity: ThreatGraphEntity = {
        ...entity,
        entityId: `${entity.entityType}_${uuidv4().slice(0, 12)}`,
        firstSeen: new Date(),
        lastUpdated: new Date()
      };

      this.entities.set(newEntity.entityId, newEntity);

      // Index by identity
      for (const identity of entity.identities) {
        this.identityIndex.set(`${identity.service}:${identity.identifier}`, newEntity.entityId);
      }

      // Index by service
      const serviceSet = this.serviceIndex.get(entity.primaryService);
      if (serviceSet) {
        serviceSet.add(newEntity.entityId);
      }

      existingEntity = newEntity;
    }

    return existingEntity;
  }

  /**
   * Get entity by ID
   */
  getEntity(entityId: string): ThreatGraphEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get entity by identity
   */
  getEntityByIdentity(service: ServiceType, identifier: string): ThreatGraphEntity | undefined {
    const entityId = this.identityIndex.get(`${service}:${identifier}`);
    if (!entityId) return undefined;
    return this.entities.get(entityId);
  }

  /**
   * Get all entities for a service
   */
  getEntitiesByService(service: ServiceType): ThreatGraphEntity[] {
    const entityIds = this.serviceIndex.get(service);
    if (!entityIds) return [];
    return Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter((e): e is ThreatGraphEntity => e !== undefined);
  }

  // ============================================
  // CONNECTION OPERATIONS
  // ============================================

  /**
   * Link two entities
   */
  linkEntities(
    sourceEntityId: string,
    targetEntityId: string,
    relationship: ConnectionType,
    weight = 1.0
  ): EntityConnection {
    // Get or create connection list for source
    let connections = this.connections.get(sourceEntityId) || [];

    // Check if connection exists
    const existingIndex = connections.findIndex(c => c.targetEntityId === targetEntityId);
    if (existingIndex >= 0) {
      // Update existing
      connections[existingIndex] = {
        ...connections[existingIndex],
        relationship,
        confidence: Math.min(1, connections[existingIndex].confidence + 0.1),
        lastSeen: new Date(),
        weight
      };
    } else {
      // Add new
      connections.push({
        targetEntityId,
        relationship,
        confidence: 0.8,
        firstSeen: new Date(),
        lastSeen: new Date(),
        weight
      });
    }

    this.connections.set(sourceEntityId, connections);
    return connections[existingIndex >= 0 ? existingIndex : connections.length - 1];
  }

  /**
   * Get connections for an entity
   */
  getConnections(entityId: string): EntityConnection[] {
    return this.connections.get(entityId) || [];
  }

  /**
   * Get connected entities
   */
  getConnectedEntities(entityId: string, depth = 1): ThreatGraphEntity[] {
    const visited = new Set<string>();
    const result: ThreatGraphEntity[] = [];

    const traverse = (currentId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);

      const connections = this.connections.get(currentId) || [];
      for (const conn of connections) {
        const entity = this.entities.get(conn.targetEntityId);
        if (entity && !visited.has(entity.entityId)) {
          result.push(entity);
          traverse(entity.entityId, currentDepth + 1);
        }
      }
    };

    traverse(entityId, 0);
    return result;
  }

  // ============================================
  // SCORE OPERATIONS
  // ============================================

  /**
   * Update entity scores
   */
  updateScores(entityId: string, scores: Partial<UniversalScores>): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    entity.scores = {
      ...entity.scores,
      ...scores
    };
    entity.lastUpdated = new Date();
  }

  /**
   * Calculate aggregated trust score across services
   */
  calculateTrustScore(entityId: string): UniversalScores {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return {
        trustScore: 500,
        fraudScore: 50,
        reputationScore: 500,
        riskScore: 50
      };
    }

    // Base scores from primary service
    const baseScores = { ...entity.scores };

    // Get all connected entities and their influence
    const connections = this.connections.get(entityId) || [];
    let trustSum = baseScores.trustScore;
    let fraudSum = baseScores.fraudScore;
    let weight = 1.0;

    for (const conn of connections) {
      const connected = this.entities.get(conn.targetEntityId);
      if (connected) {
        const influence = conn.weight || 1;
        trustSum += connected.scores.trustScore * influence * conn.confidence;
        fraudSum += connected.scores.fraudScore * influence * conn.confidence;
        weight += influence * conn.confidence;
      }
    }

    return {
      trustScore: Math.round(trustSum / weight),
      fraudScore: Math.round(fraudSum / weight),
      reputationScore: Math.round((baseScores.reputationScore + baseScores.trustScore) / 2),
      riskScore: Math.round(fraudSum / weight)
    };
  }

  // ============================================
  // FRAUD NETWORK DETECTION
  // ============================================

  /**
   * Detect fraud networks
   */
  detectFraudNetwork(service: ServiceType, timeWindowDays: number, minConnections: number): FraudNetwork[] {
    const networks: FraudNetwork[] = [];

    // Get all entities for this service
    const entities = this.getEntitiesByService(service);

    // Find entities with high fraud scores
    const suspiciousEntities = entities.filter(e =>
      e.scores.fraudScore > 70 || e.scores.riskScore > 70
    );

    // Group by connections
    const visited = new Set<string>();

    for (const entity of suspiciousEntities) {
      if (visited.has(entity.entityId)) continue;

      const ring = this.buildFraudRing(entity, minConnections, visited);
      if (ring) {
        networks.push(ring);
      }
    }

    return networks;
  }

  /**
   * Build a fraud ring from a starting entity
   */
  private buildFraudRing(
    startEntity: ThreatGraphEntity,
    minConnections: number,
    visited: Set<string>
  ): FraudNetwork | null {
    const members: FraudRingMember[] = [];
    const patterns: FraudPattern[] = [];
    const connectedSet = new Set<string>();

    // BFS to find connected suspicious entities
    const queue: ThreatGraphEntity[] = [startEntity];
    connectedSet.add(startEntity.entityId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current.entityId);

      members.push({
        entityId: current.entityId,
        role: this.determineRole(current),
        fraudScore: current.scores.fraudScore,
        connections: this.getConnections(current.entityId).length,
        services: current.services
      });

      // Get connected entities
      const connections = this.getConnections(current.entityId);
      for (const conn of connections) {
        if (connectedSet.has(conn.targetEntityId)) continue;

        const connected = this.entities.get(conn.targetEntityId);
        if (!connected) continue;

        // Check if connected entity is also suspicious
        if (connected.scores.fraudScore > 60 || conn.confidence > 0.7) {
          connectedSet.add(conn.targetEntityId);
          queue.push(connected);

          // Detect pattern
          const pattern = this.detectConnectionPattern(conn);
          if (pattern) {
            const existing = patterns.find(p => p.pattern === pattern.pattern);
            if (existing) {
              existing.occurrences++;
            } else {
              patterns.push(pattern);
            }
          }
        }
      }
    }

    // Only return if we have enough connections
    if (members.length < minConnections) {
      return null;
    }

    const ringId = `ring_${uuidv4().slice(0, 8)}`;

    const network: FraudNetwork = {
      ringId,
      ringType: this.determineRingType(patterns),
      members,
      patterns,
      financialImpact: this.calculateImpact(members),
      status: 'active',
      detectedAt: new Date(),
      updatedAt: new Date()
    };

    this.fraudNetworks.set(ringId, network);
    return network;
  }

  /**
   * Determine entity role in fraud ring
   */
  private determineRole(entity: ThreatGraphEntity): FraudRingMember['role'] {
    const connections = this.getConnections(entity.entityId);

    // Master: High fraud score + many outgoing connections
    const outgoing = connections.filter(c => c.relationship === 'reported_by' || c.relationship === 'transaction_partner');
    if (entity.scores.fraudScore > 80 && outgoing.length > 5) {
      return 'master';
    }

    // Mule: Moderate fraud + specific patterns
    if (entity.scores.fraudScore > 60 && entity.tags.includes('quick_transfer')) {
      return 'mule';
    }

    return 'unknown';
  }

  /**
   * Detect connection pattern
   */
  private detectConnectionPattern(connection: EntityConnection): FraudPattern | null {
    const patternMap: Record<ConnectionType, { pattern: string; description: string }> = {
      'same_device': { pattern: 'SAME_DEVICE', description: 'Entities sharing same device' },
      'same_person': { pattern: 'SAME_PERSON', description: 'Entities belong to same person' },
      'same_location': { pattern: 'SAME_LOCATION', description: 'Entities at same location' },
      'same_account': { pattern: 'SAME_ACCOUNT', description: 'Entities sharing account' },
      'frequent_merchant': { pattern: 'FREQUENT_MERCHANT', description: 'Frequent merchant relationship' },
      'frequent_customer': { pattern: 'FREQUENT_CUSTOMER', description: 'Frequent customer relationship' },
      'related_company': { pattern: 'RELATED_COMPANY', description: 'Related company structure' },
      'family_member': { pattern: 'FAMILY', description: 'Family relationship' },
      'colleague': { pattern: 'COLLEAGUE', description: 'Work colleague relationship' },
      'shared_ip': { pattern: 'SHARED_IP', description: 'Shared IP address' },
      'transaction_partner': { pattern: 'TRANSFER', description: 'Money transfer pattern' },
      'reported_by': { pattern: 'REPORTED', description: 'Entities with fraud reports' },
      'blocked_by': { pattern: 'BLOCKED', description: 'Blocked entities' }
    };

    const info = patternMap[connection.relationship];
    if (!info) return null;

    return {
      pattern: info.pattern,
      description: info.description,
      severity: connection.confidence > 0.8 ? 'HIGH' : 'MEDIUM',
      occurrences: 1
    };
  }

  /**
   * Determine fraud ring type
   */
  private determineRingType(patterns: FraudPattern[]): FraudRingType {
    const patternSet = new Set(patterns.map(p => p.pattern));

    if (patternSet.has('TRANSFER') && patternSet.has('QUICK_TRANSFER')) {
      return 'mule_network';
    }
    if (patternSet.has('SAME_DEVICE') && patternSet.has('SAME_PERSON')) {
      return 'synthetic_identity';
    }
    if (patternSet.has('FREQUENT_MERCHANT') || patternSet.has('FREQUENT_CUSTOMER')) {
      return 'merchant_scam';
    }
    if (patternSet.has('REPORTED') && patternSet.has('BLOCKED')) {
      return 'fraud_ring';
    }

    return 'coordinated_abuse';
  }

  /**
   * Calculate financial impact
   */
  private calculateImpact(members: FraudRingMember[]): FraudNetwork['financialImpact'] {
    // Simplified calculation
    const totalFraud = members.reduce((sum, m) => sum + (m.fraudScore * 1000), 0);

    return {
      totalFraudAmount: totalFraud,
      affectedTransactions: members.length * 5,
      affectedMerchants: Math.ceil(members.length / 3),
      affectedUsers: members.length * 2,
      currency: 'INR'
    };
  }

  // ============================================
  // GRAPH TRAVERSAL
  // ============================================

  /**
   * Find shortest path between two entities
   */
  findPath(sourceId: string, targetId: string, maxDepth = 5): string[] | null {
    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [{ id: sourceId, path: [sourceId] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === targetId) {
        return path;
      }

      if (path.length >= maxDepth) continue;
      if (visited.has(id)) continue;
      visited.add(id);

      const connections = this.connections.get(id) || [];
      for (const conn of connections) {
        if (!visited.has(conn.targetEntityId)) {
          queue.push({
            id: conn.targetEntityId,
            path: [...path, conn.targetEntityId]
          });
        }
      }
    }

    return null;
  }

  /**
   * Find all paths between two entities
   */
  findAllPaths(sourceId: string, targetId: string, maxDepth = 3): string[][] {
    const results: string[][] = [];

    const dfs = (current: string, target: string, path: string[], depth: number) => {
      if (depth > maxDepth) return;
      if (current === target) {
        results.push([...path]);
        return;
      }

      const connections = this.connections.get(current) || [];
      for (const conn of connections) {
        if (!path.includes(conn.targetEntityId)) {
          path.push(conn.targetEntityId);
          dfs(conn.targetEntityId, target, path, depth + 1);
          path.pop();
        }
      }
    };

    dfs(sourceId, targetId, [sourceId], 0);
    return results;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get graph statistics
   */
  getStats(): {
    totalEntities: number;
    totalConnections: number;
    totalNetworks: number;
    byService: Record<ServiceType, number>;
    byRiskLevel: Record<string, number>;
  } {
    const byService: Record<string, number> = {};
    const byRiskLevel = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

    let totalConnections = 0;

    for (const entity of this.entities.values()) {
      byService[entity.primaryService] = (byService[entity.primaryService] || 0) + 1;

      if (entity.scores.riskScore < 20) byRiskLevel.LOW++;
      else if (entity.scores.riskScore < 40) byRiskLevel.MEDIUM++;
      else if (entity.scores.riskScore < 70) byRiskLevel.HIGH++;
      else byRiskLevel.CRITICAL++;

      totalConnections += this.connections.get(entity.entityId)?.length || 0;
    }

    return {
      totalEntities: this.entities.size,
      totalConnections,
      totalNetworks: this.fraudNetworks.size,
      byService: byService as Record<ServiceType, number>,
      byRiskLevel
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.entities.clear();
    this.connections.clear();
    this.fraudNetworks.clear();
    this.identityIndex.clear();
    this.serviceIndex.forEach(s => s.clear());
  }
}

// Export singleton
export const graphEngine = new GraphEngine();

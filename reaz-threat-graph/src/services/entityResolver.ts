/**
 * Entity Resolver
 *
 * Cross-platform identity resolution and entity linking.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ThreatGraphEntity,
  EntityType,
  ServiceType,
  EntityIdentity,
  UniversalScores,
  FraudIndicator,
  TrustScoreResponse
} from '../types/index.js';
import { graphEngine } from './graphEngine.js';

// ============================================
// ENTITY RESOLVER CLASS
// ============================================

export class EntityResolver {
  /**
   * Resolve an entity across services
   */
  resolve(service: ServiceType, identifier: string): ThreatGraphEntity | null {
    // First try direct lookup
    const existing = graphEngine.getEntityByIdentity(service, identifier);
    if (existing) {
      return existing;
    }

    return null;
  }

  /**
   * Link identities across services
   */
  linkIdentities(
    primaryEntityId: string,
    secondaryService: ServiceType,
    secondaryIdentifier: string
  ): ThreatGraphEntity | null {
    const primary = graphEngine.getEntity(primaryEntityId);
    if (!primary) return null;

    // Add new identity
    primary.identities.push({
      service: secondaryService,
      identifier: secondaryIdentifier,
      verified: false
    });

    // Create cross-service connection
    const secondaryEntity = graphEngine.getEntityByIdentity(secondaryService, secondaryIdentifier);
    if (secondaryEntity) {
      // Link to existing entity
      graphEngine.linkEntities(primaryEntityId, secondaryEntity.entityId, 'same_person', 1.0);
    }

    primary.lastUpdated = new Date();
    return primary;
  }

  /**
   * Create a new entity
   */
  createEntity(config: {
    type: EntityType;
    primaryService: ServiceType;
    primaryIdentifier: string;
    identifierType: 'phone' | 'email' | 'device_id' | 'user_id' | 'merchant_id';
    verified?: boolean;
  }): ThreatGraphEntity {
    const entity: ThreatGraphEntity = {
      entityId: `${config.type}_${uuidv4().slice(0, 12)}`,
      entityType: config.type,
      primaryService: config.primaryService,
      services: [config.primaryService],
      identities: [{
        service: config.primaryService,
        identifier: config.primaryIdentifier,
        verified: config.verified || false,
        verifiedAt: config.verified ? new Date() : undefined
      }],
      connections: [],
      scores: {
        trustScore: 500,
        fraudScore: 50,
        reputationScore: 500,
        riskScore: 50
      },
      fraudIndicators: [],
      badges: [],
      tags: [],
      firstSeen: new Date(),
      lastUpdated: new Date(),
      status: 'active'
    };

    return graphEngine.upsertEntity(entity);
  }

  /**
   * Merge two entities
   */
  mergeEntities(sourceId: string, targetId: string): ThreatGraphEntity | null {
    const source = graphEngine.getEntity(sourceId);
    const target = graphEngine.getEntity(targetId);

    if (!source || !target) return null;

    // Merge identities
    const mergedIdentities = [...target.identities];
    for (const identity of source.identities) {
      if (!mergedIdentities.find(i => i.service === identity.service && i.identifier === identity.identifier)) {
        mergedIdentities.push(identity);
      }
    }

    // Merge services
    const mergedServices = [...new Set([...target.services, ...source.services])];

    // Merge connections
    const sourceConnections = graphEngine.getConnections(sourceId);
    const targetConnections = graphEngine.getConnections(targetId);
    const mergedConnections = [...targetConnections];

    for (const conn of sourceConnections) {
      if (!mergedConnections.find(c => c.targetEntityId === conn.targetEntityId)) {
        graphEngine.linkEntities(targetId, conn.targetEntityId, conn.relationship, conn.weight || 0.5);
      }
    }

    // Average scores (with weighting)
    const totalWeight = 2;
    const mergedScores: UniversalScores = {
      trustScore: Math.round((target.scores.trustScore * 1.5 + source.scores.trustScore * 0.5) / totalWeight),
      fraudScore: Math.round((target.scores.fraudScore * 1.5 + source.scores.fraudScore * 0.5) / totalWeight),
      reputationScore: Math.round((target.scores.reputationScore * 1.5 + source.scores.reputationScore * 0.5) / totalWeight),
      riskScore: Math.round((target.scores.riskScore * 1.5 + source.scores.riskScore * 0.5) / totalWeight)
    };

    // Merge fraud indicators
    const mergedIndicators = [...target.fraudIndicators];
    for (const indicator of source.fraudIndicators) {
      if (!mergedIndicators.find(i => i.indicator === indicator.indicator)) {
        mergedIndicators.push(indicator);
      }
    }

    // Update target entity
    target.identities = mergedIdentities;
    target.services = mergedServices;
    target.scores = mergedScores;
    target.fraudIndicators = mergedIndicators;
    target.lastUpdated = new Date();

    // Delete source entity
    graphEngine.entities.delete(sourceId);

    return target;
  }

  /**
   * Calculate trust score for an entity
   */
  calculateTrustScore(entityId: string, includeBreakdown = false): TrustScoreResponse | null {
    const entity = graphEngine.getEntity(entityId);
    if (!entity) return null;

    const scores = graphEngine.calculateTrustScore(entityId);

    // Get breakdown
    let breakdown: TrustScoreResponse['breakdown'] | undefined;
    if (includeBreakdown) {
      breakdown = {
        trustScore: this.getTrustBreakdown(entity),
        fraudScore: this.getFraudBreakdown(entity),
        reputationScore: this.getReputationBreakdown(entity),
        riskScore: this.getRiskBreakdown(entity)
      };
    }

    // Get cross-service summary
    const crossServiceSummary = entity.services.map(service => ({
      service,
      trustScore: entity.scores.trustScore,
      transactions: Math.floor(Math.random() * 100) // Placeholder
    }));

    return {
      entityId: entity.entityId,
      entityType: entity.entityType,
      scores,
      breakdown,
      badges: entity.badges,
      crossServiceSummary,
      lastUpdated: entity.lastUpdated.toISOString()
    };
  }

  /**
   * Get trust score breakdown
   */
  private getTrustBreakdown(entity: ThreatGraphEntity) {
    const factors = [];

    // Verified identity
    const verifiedIdentities = entity.identities.filter(i => i.verified).length;
    if (verifiedIdentities > 0) {
      factors.push({
        factor: 'identity_verified',
        contribution: Math.min(100, verifiedIdentities * 30),
        details: `${verifiedIdentities} verified identities`
      });
    }

    // Service tenure
    factors.push({
      factor: 'service_tenure',
      contribution: Math.min(50, Math.floor((Date.now() - entity.firstSeen.getTime()) / (1000 * 60 * 60 * 24 * 30))),
      details: `Active since ${entity.firstSeen.toLocaleDateString()}`
    });

    // Connections
    if (entity.connections.length > 0) {
      factors.push({
        factor: 'network_connections',
        contribution: Math.min(50, entity.connections.length * 5),
        details: `${entity.connections.length} connections`
      });
    }

    return factors;
  }

  /**
   * Get fraud score breakdown
   */
  private getFraudBreakdown(entity: ThreatGraphEntity) {
    const factors = [];

    // Fraud indicators
    for (const indicator of entity.fraudIndicators) {
      factors.push({
        factor: indicator.indicator,
        contribution: indicator.severity === 'CRITICAL' ? 40 :
                      indicator.severity === 'HIGH' ? 25 :
                      indicator.severity === 'MEDIUM' ? 15 : 5,
        details: `${indicator.severity} - ${indicator.source}`
      });
    }

    // Risk score
    factors.push({
      factor: 'base_risk_score',
      contribution: entity.scores.riskScore,
      details: `Risk level: ${entity.scores.riskScore > 70 ? 'High' : entity.scores.riskScore > 40 ? 'Medium' : 'Low'}`
    });

    return factors;
  }

  /**
   * Get reputation breakdown
   */
  private getReputationBreakdown(entity: ThreatGraphEntity) {
    const factors = [];

    // Badges
    for (const badge of entity.badges) {
      factors.push({
        factor: badge,
        contribution: 20,
        details: badge.replace(/_/g, ' ')
      });
    }

    // Reviews (would come from external service)
    factors.push({
      factor: 'community_trust',
      contribution: 50,
      details: 'Based on community feedback'
    });

    return factors;
  }

  /**
   * Get risk breakdown
   */
  private getRiskBreakdown(entity: ThreatGraphEntity) {
    const factors = [];

    // Status
    if (entity.status !== 'active') {
      factors.push({
        factor: 'account_status',
        contribution: 30,
        details: `Status: ${entity.status}`
      });
    }

    // Fraud indicators
    if (entity.fraudIndicators.length > 0) {
      factors.push({
        factor: 'fraud_indicators',
        contribution: entity.fraudIndicators.reduce((sum, i) =>
          sum + (i.severity === 'CRITICAL' ? 40 : i.severity === 'HIGH' ? 25 : 10), 0),
        details: `${entity.fraudIndicators.length} fraud indicators`
      });
    }

    // Tags
    for (const tag of entity.tags) {
      if (tag.includes('suspicious') || tag.includes('blocked')) {
        factors.push({
          factor: tag,
          contribution: 20,
          details: `Tag: ${tag}`
        });
      }
    }

    return factors;
  }
}

// Export singleton
export const entityResolver = new EntityResolver();

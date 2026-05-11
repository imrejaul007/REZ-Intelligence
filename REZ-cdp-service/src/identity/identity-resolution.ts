import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';

/**
 * Identity types supported by the system
 */
export type IdentityType = 'email' | 'phone' | 'device_id' | 'cookie_id' | 'user_id' | 'account_id';

/**
 * Individual identity record
 */
export interface Identity {
  id: string;
  type: IdentityType;
  value: string;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  confidence: number;
  profileId?: string;
}

/**
 * Identity graph node
 */
export interface IdentityNode {
  identityId: string;
  identities: Identity[];
  primaryProfileId?: string;
  profileIds: string[];
  linkedAt: string;
  linkConfidence: number;
}

/**
 * Identity link record
 */
export interface IdentityLink {
  id: string;
  identity1Id: string;
  identity2Id: string;
  type: 'deterministic' | 'probabilistic';
  confidence: number;
  createdAt: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Identity resolution request
 */
export interface ResolutionRequest {
  identities: Array<{
    type: IdentityType;
    value: string;
    confidence?: number;
  }>;
  profileId?: string;
  linkExisting?: boolean;
}

/**
 * Identity resolution result
 */
export interface ResolutionResult {
  identityId: string;
  existingIdentityId?: string;
  profiles: string[];
  action: 'created' | 'merged' | 'linked' | 'found';
  confidence: number;
  newIdentities: Identity[];
  linkedIdentities: Identity[];
}

/**
 * Identity graph structure
 */
export interface IdentityGraph {
  identityId: string;
  nodes: Array<{
    id: string;
    type: IdentityType;
    value: string;
    profileId?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    confidence: number;
    type: 'deterministic' | 'probabilistic';
  }>;
}

/**
 * Identity Resolver - Cross-device identity resolution service
 */
export class IdentityResolver {
  private identities: Map<string, Identity> = new Map();
  private identityByValue: Map<string, Map<IdentityType, string>> = new Map();
  private identityLinks: Map<string, IdentityLink> = new Map();
  private identityGraphs: Map<string, Set<string>> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeSampleIdentities();
  }

  /**
   * Initialize sample identity data
   */
  private initializeSampleIdentities(): void {
    const sampleIdentities: Identity[] = [
      {
        id: 'iden_prof_001_email',
        type: 'email',
        value: 'john.smith@example.com',
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date('2024-01-15').toISOString(),
        verified: true,
        confidence: 1.0,
        profileId: 'prof_001'
      },
      {
        id: 'iden_prof_001_phone',
        type: 'phone',
        value: '+1-555-0101',
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date('2024-01-15').toISOString(),
        verified: true,
        confidence: 0.95,
        profileId: 'prof_001'
      },
      {
        id: 'iden_prof_001_device',
        type: 'device_id',
        value: 'device_abc123',
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date('2024-01-15').toISOString(),
        verified: false,
        confidence: 0.7,
        profileId: 'prof_001'
      },
      {
        id: 'iden_prof_002_email',
        type: 'email',
        value: 'sarah.j@example.com',
        createdAt: new Date('2024-02-20').toISOString(),
        updatedAt: new Date('2024-02-20').toISOString(),
        verified: true,
        confidence: 1.0,
        profileId: 'prof_002'
      }
    ];

    sampleIdentities.forEach(identity => {
      this.identities.set(identity.id, identity);
      this.addToIndex(identity);
    });

    // Create identity links
    const links: IdentityLink[] = [
      {
        id: 'link_001',
        identity1Id: 'iden_prof_001_email',
        identity2Id: 'iden_prof_001_phone',
        type: 'deterministic',
        confidence: 1.0,
        createdAt: new Date('2024-01-15').toISOString(),
        reason: 'Same profile signup'
      },
      {
        id: 'link_002',
        identity1Id: 'iden_prof_001_email',
        identity2Id: 'iden_prof_001_device',
        type: 'probabilistic',
        confidence: 0.7,
        createdAt: new Date('2024-01-15').toISOString(),
        reason: 'Same session'
      }
    ];

    links.forEach(link => {
      this.identityLinks.set(link.id, link);
      this.addToGraph(link.identity1Id, link.identity2Id);
    });

    this.logger.info('Identity resolver initialized with sample data', {
      identities: sampleIdentities.length,
      links: links.length
    });
  }

  /**
   * Add identity to value index
   */
  private addToIndex(identity: Identity): void {
    if (!this.identityByValue.has(identity.value)) {
      this.identityByValue.set(identity.value, new Map());
    }
    this.identityByValue.get(identity.value)!.set(identity.type, identity.id);
  }

  /**
   * Add identities to graph
   */
  private addToGraph(identity1Id: string, identity2Id: string): void {
    if (!this.identityGraphs.has(identity1Id)) {
      this.identityGraphs.set(identity1Id, new Set());
    }
    if (!this.identityGraphs.has(identity2Id)) {
      this.identityGraphs.set(identity2Id, new Set());
    }
    this.identityGraphs.get(identity1Id)!.add(identity2Id);
    this.identityGraphs.get(identity2Id)!.add(identity1Id);
  }

  /**
   * Resolve identity - find or create identity record
   */
  async resolveIdentity(request: ResolutionRequest): Promise<ResolutionResult> {
    const { identities: incomingIdentities, profileId, linkExisting = true } = request;

    const result: ResolutionResult = {
      identityId: '',
      profiles: [],
      action: 'created',
      confidence: 0,
      newIdentities: [],
      linkedIdentities: []
    };

    const processedIdentities: Identity[] = [];
    let existingIdentity: Identity | null = null;
    let existingProfileIds = new Set<string>();

    // Check each incoming identity for existing records
    for (const incoming of incomingIdentities) {
      const index = this.identityByValue.get(incoming.value)?.get(incoming.type);
      if (index) {
        const existing = this.identities.get(index);
        if (existing) {
          if (!existingIdentity || existing.confidence > existingIdentity.confidence) {
            existingIdentity = existing;
          }
          if (existing.profileId) {
            existingProfileIds.add(existing.profileId);
          }
          result.linkedIdentities.push(existing);
        }
      } else {
        // Create new identity
        const newIdentity = await this.createIdentity({
          type: incoming.type,
          value: incoming.value,
          confidence: incoming.confidence || 0.8,
          profileId
        });
        result.newIdentities.push(newIdentity);
        processedIdentities.push(newIdentity);
      }
    }

    if (existingIdentity) {
      result.existingIdentityId = existingIdentity.id;
      result.identityId = existingIdentity.id;
      result.action = 'found';
      result.confidence = existingIdentity.confidence;
      result.profiles = Array.from(existingProfileIds);

      // Link new identities to existing identity graph
      if (linkExisting && processedIdentities.length > 0) {
        const links: IdentityLink[] = [];
        for (const newIdentity of processedIdentities) {
          const link = await this.linkIdentities({
            identity1Id: existingIdentity!.id,
            identity2Id: newIdentity.id,
            confidence: Math.min(existingIdentity!.confidence, newIdentity.confidence),
            type: 'probabilistic',
            reason: 'Resolution match'
          });
          links.push(link);
          result.linkedIdentities.push(newIdentity);
        }
        result.action = 'linked';
      }
    } else if (processedIdentities.length > 0) {
      result.identityId = processedIdentities[0].id;
      result.action = 'created';
      result.confidence = processedIdentities.reduce((acc, i) => acc + i.confidence, 0) / processedIdentities.length;
      if (processedIdentities[0].profileId) {
        result.profiles = [processedIdentities[0].profileId!];
      }
    }

    this.logger.info('Identity resolved', {
      action: result.action,
      identityId: result.identityId,
      newCount: result.newIdentities.length,
      linkedCount: result.linkedIdentities.length
    });

    return result;
  }

  /**
   * Create a new identity record
   */
  async createIdentity(data: {
    type: IdentityType;
    value: string;
    confidence?: number;
    verified?: boolean;
    profileId?: string;
  }): Promise<Identity> {
    const id = `iden_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const identity: Identity = {
      id,
      type: data.type,
      value: data.value,
      createdAt: now,
      updatedAt: now,
      verified: data.verified || false,
      confidence: data.confidence || 0.5,
      profileId: data.profileId
    };

    this.identities.set(id, identity);
    this.addToIndex(identity);

    this.logger.info('Identity created', { id, type: identity.type, value: identity.value });
    return identity;
  }

  /**
   * Link two identities together
   */
  async linkIdentities(data: {
    identity1Id: string;
    identity2Id: string;
    confidence?: number;
    type?: 'deterministic' | 'probabilistic';
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<IdentityLink> {
    const identity1 = this.identities.get(data.identity1Id);
    const identity2 = this.identities.get(data.identity2Id);

    if (!identity1 || !identity2) {
      throw new Error('One or both identities not found');
    }

    const id = `link_${uuidv4().slice(0, 8)}`;
    const link: IdentityLink = {
      id,
      identity1Id: data.identity1Id,
      identity2Id: data.identity2Id,
      type: data.type || 'probabilistic',
      confidence: data.confidence || 0.5,
      createdAt: new Date().toISOString(),
      reason: data.reason,
      metadata: data.metadata
    };

    this.identityLinks.set(id, link);
    this.addToGraph(data.identity1Id, data.identity2Id);

    // If both have profiles, they should be the same
    if (identity1.profileId && identity2.profileId && identity1.profileId !== identity2.profileId) {
      this.logger.warn('Linking identities with different profiles', {
        identity1Id: data.identity1Id,
        identity2Id: data.identity2Id,
        profile1: identity1.profileId,
        profile2: identity2.profileId
      });
    }

    // Update profile reference if needed
    if (!identity1.profileId && identity2.profileId) {
      identity1.profileId = identity2.profileId;
      this.identities.set(identity1.id, identity1);
    } else if (!identity2.profileId && identity1.profileId) {
      identity2.profileId = identity1.profileId;
      this.identities.set(identity2.id, identity2);
    }

    this.logger.info('Identities linked', { linkId: id, confidence: link.confidence });
    return link;
  }

  /**
   * Unmerge identities
   */
  async unmergeIdentities(data: {
    identity1Id: string;
    identity2Id: string;
    reason?: string;
  }): Promise<{ success: boolean; removedLinks: string[] }> {
    const removedLinks: string[] = [];

    for (const [linkId, link] of this.identityLinks) {
      if ((link.identity1Id === data.identity1Id && link.identity2Id === data.identity2Id) ||
          (link.identity1Id === data.identity2Id && link.identity2Id === data.identity1Id)) {
        this.identityLinks.delete(linkId);
        removedLinks.push(linkId);
      }
    }

    // Remove from graph
    const graph1 = this.identityGraphs.get(data.identity1Id);
    const graph2 = this.identityGraphs.get(data.identity2Id);
    if (graph1) graph1.delete(data.identity2Id);
    if (graph2) graph2.delete(data.identity1Id);

    this.logger.info('Identities unmerged', { removedLinks: removedLinks.length });
    return { success: true, removedLinks };
  }

  /**
   * Get all identities for a profile
   */
  async getIdentitiesForProfile(profileId: string): Promise<Identity[]> {
    return Array.from(this.identities.values()).filter(
      i => i.profileId === profileId
    );
  }

  /**
   * Get identity graph for an identity
   */
  async getIdentityGraph(identityId: string): Promise<IdentityGraph> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identity not found: ${identityId}`);
    }

    const nodes: IdentityGraph['nodes'] = [];
    const edges: IdentityGraph['edges'] = [];
    const visited = new Set<string>();

    // BFS to traverse the graph
    const queue = [identityId];
    visited.add(identityId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = this.identities.get(currentId);

      if (current) {
        nodes.push({
          id: current.id,
          type: current.type,
          value: current.value,
          profileId: current.profileId
        });

        // Find connected identities
        const graph = this.identityGraphs.get(currentId);
        if (graph) {
          for (const linkedId of graph) {
            if (!visited.has(linkedId)) {
              visited.add(linkedId);
              queue.push(linkedId);
            }

            // Add edge
            const linked = this.identities.get(linkedId);
            if (linked) {
              edges.push({
                from: currentId,
                to: linkedId,
                confidence: this.getLinkConfidence(currentId, linkedId),
                type: this.getLinkType(currentId, linkedId)
              });
            }
          }
        }
      }
    }

    return {
      identityId,
      nodes,
      edges
    };
  }

  /**
   * Get link confidence between two identities
   */
  private getLinkConfidence(id1: string, id2: string): number {
    for (const link of this.identityLinks.values()) {
      if ((link.identity1Id === id1 && link.identity2Id === id2) ||
          (link.identity1Id === id2 && link.identity2Id === id1)) {
        return link.confidence;
      }
    }
    return 0;
  }

  /**
   * Get link type between two identities
   */
  private getLinkType(id1: string, id2: string): 'deterministic' | 'probabilistic' {
    for (const link of this.identityLinks.values()) {
      if ((link.identity1Id === id1 && link.identity2Id === id2) ||
          (link.identity1Id === id2 && link.identity2Id === id1)) {
        return link.type;
      }
    }
    return 'probabilistic';
  }

  /**
   * Find profiles that might be the same person (probabilistic matching)
   */
  async findPotentialMatches(criteria: {
    email?: string;
    phone?: string;
    deviceId?: string;
    cookieId?: string;
  }): Promise<Array<{ identity: Identity; confidence: number; matchReason: string }>> {
    const matches: Array<{ identity: Identity; confidence: number; matchReason: string }> = [];

    for (const [value, typeMap] of this.identityByValue) {
      for (const [type, identityId] of typeMap) {
        const identity = this.identities.get(identityId);
        if (!identity) continue;

        let confidence = 0;
        let reasons: string[] = [];

        // Check type-specific matching rules
        if (type === 'email' && criteria.email) {
          if (this.normalizeEmail(value) === this.normalizeEmail(criteria.email)) {
            confidence += 0.6;
            reasons.push('Email match');
          }
        }

        if (type === 'phone' && criteria.phone) {
          if (this.normalizePhone(value) === this.normalizePhone(criteria.phone)) {
            confidence += 0.6;
            reasons.push('Phone match');
          }
        }

        if (type === 'device_id' && criteria.deviceId && value === criteria.deviceId) {
          confidence += 0.4;
          reasons.push('Device ID match');
        }

        if (confidence > 0) {
          matches.push({
            identity,
            confidence,
            matchReason: reasons.join(', ')
          });
        }
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Normalize email for comparison
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim().replace(/\s+/g, '');
  }

  /**
   * Normalize phone for comparison
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Get identity by ID
   */
  async getIdentity(id: string): Promise<Identity | null> {
    return this.identities.get(id) || null;
  }

  /**
   * Update identity verification status
   */
  async verifyIdentity(id: string, verified: boolean): Promise<Identity> {
    const identity = this.identities.get(id);
    if (!identity) {
      throw new Error(`Identity not found: ${id}`);
    }

    identity.verified = verified;
    identity.updatedAt = new Date().toISOString();
    identity.confidence = verified ? 1.0 : identity.confidence;
    this.identities.set(id, identity);

    return identity;
  }

  /**
   * Delete identity
   */
  async deleteIdentity(id: string): Promise<void> {
    const identity = this.identities.get(id);
    if (!identity) {
      throw new Error(`Identity not found: ${id}`);
    }

    // Remove from index
    const valueIndex = this.identityByValue.get(identity.value);
    if (valueIndex) {
      valueIndex.delete(identity.type);
      if (valueIndex.size === 0) {
        this.identityByValue.delete(identity.value);
      }
    }

    // Remove from graph
    const graph = this.identityGraphs.get(id);
    if (graph) {
      for (const linkedId of graph) {
        const linkedGraph = this.identityGraphs.get(linkedId);
        if (linkedGraph) {
          linkedGraph.delete(id);
        }
      }
      this.identityGraphs.delete(id);
    }

    // Remove links
    for (const [linkId, link] of this.identityLinks) {
      if (link.identity1Id === id || link.identity2Id === id) {
        this.identityLinks.delete(linkId);
      }
    }

    this.identities.delete(id);
    this.logger.info('Identity deleted', { id });
  }

  /**
   * Get identity statistics
   */
  async getStatistics(): Promise<{
    totalIdentities: number;
    byType: Record<IdentityType, number>;
    verifiedCount: number;
    totalLinks: number;
    averageConfidence: number;
  }> {
    const identities = Array.from(this.identities.values());
    const byType: Record<IdentityType, number> = {
      email: 0,
      phone: 0,
      device_id: 0,
      cookie_id: 0,
      user_id: 0,
      account_id: 0
    };

    let totalConfidence = 0;
    let verifiedCount = 0;

    for (const identity of identities) {
      byType[identity.type]++;
      totalConfidence += identity.confidence;
      if (identity.verified) verifiedCount++;
    }

    return {
      totalIdentities: identities.length,
      byType,
      verifiedCount,
      totalLinks: this.identityLinks.size,
      averageConfidence: identities.length > 0 ? totalConfidence / identities.length : 0
    };
  }
}

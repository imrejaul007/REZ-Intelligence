/**
 * REZ Agent Orchestrator - Consumer Identity Graph
 *
 * Unified identity layer linking all consumer touchpoints
 */

export interface UnifiedProfile {
  id: string;
  primaryIdentifier: {
    phone?: string;
    email?: string;
    deviceId?: string;
  };
  linkedProfiles: LinkedProfile[];
  mergedAt: Date;
  sources: string[];
  confidence: number;
}

export interface LinkedProfile {
  profileId: string;
  source: 'merchant' | 'consumer' | 'engagement' | 'dooh' | 'qr' | 'creator';
  merchantId?: string;
  merchantName?: string;
  attributes: ProfileAttributes;
  firstSeen: Date;
  lastSeen: Date;
  interactions: Interaction[];
}

export interface ProfileAttributes {
  name?: string;
  phone?: string;
  email?: string;
  deviceId?: string;
  age?: number;
  gender?: string;
  location?: { lat: number; lng: number; city?: string };
  preferences?: string[];
  tags?: string[];
  segments?: string[];
  lifetimeValue?: number;
  avgOrderValue?: number;
  visitFrequency?: number;
}

export interface Interaction {
  id: string;
  type: InteractionType;
  source: string;
  merchantId?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export type InteractionType =
  | 'order'
  | 'visit'
  | 'campaign_view'
  | 'campaign_click'
  | 'offer_view'
  | 'offer_redeem'
  | 'review'
  | 'referral'
  | 'loyalty_earn'
  | 'loyalty_redeem'
  | 'qr_scan'
  | 'dooh_interaction'
  | 'app_download'
  | 'app_open'
  | 'notification_open'
  | 'whatsapp_message';

export interface CrossAppJourney {
  unifiedId: string;
  events: JourneyEvent[];
  totalSpend: number;
  totalOrders: number;
  firstInteraction: Date;
  lastInteraction: Date;
}

export interface JourneyEvent {
  timestamp: Date;
  source: string;
  type: InteractionType;
  merchantId?: string;
  context: Record<string, unknown>;
}

export interface Segment {
  id: string;
  name: string;
  criteria: SegmentCriteria;
  memberCount: number;
  updatedAt: Date;
}

export interface SegmentCriteria {
  type: 'and' | 'or';
  conditions: Condition[];
}

export interface Condition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'between';
  value: unknown;
}

export class ConsumerIdentityGraph {
  private profiles: Map<string, UnifiedProfile> = new Map();
  private phoneIndex: Map<string, string> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private deviceIndex: Map<string, string> = new Map();
  private segments: Map<string, Segment> = new Map();

  /**
   * Create or update a profile
   */
  createProfile(
    source: UnifiedProfile['linkedProfiles'][0]['source'],
    attributes: ProfileAttributes,
    merchantId?: string
  ): UnifiedProfile {
    const profileId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const linkedProfile: LinkedProfile = {
      profileId,
      source,
      merchantId,
      attributes,
      firstSeen: new Date(),
      lastSeen: new Date(),
      interactions: [],
    };

    // Check if profile exists by phone/email/device
    let unifiedId: string | undefined;

    if (attributes.phone) {
      unifiedId = this.phoneIndex.get(attributes.phone);
    }
    if (!unifiedId && attributes.email) {
      unifiedId = this.emailIndex.get(attributes.email);
    }
    if (!unifiedId && attributes.deviceId) {
      unifiedId = this.deviceIndex.get(attributes.deviceId);
    }

    if (unifiedId) {
      // Add to existing unified profile
      const unified = this.profiles.get(unifiedId)!;
      unified.linkedProfiles.push(linkedProfile);
      unified.sources.push(source);
      unified.confidence = Math.min(unified.confidence + 0.1, 1.0);
      return unified;
    }

    // Create new unified profile
    const unifiedProfile: UnifiedProfile = {
      id: `unified-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      primaryIdentifier: {
        phone: attributes.phone,
        email: attributes.email,
        deviceId: attributes.deviceId,
      },
      linkedProfiles: [linkedProfile],
      mergedAt: new Date(),
      sources: [source],
      confidence: 0.5,
    };

    this.profiles.set(unifiedProfile.id, unifiedProfile);

    // Update indexes
    if (attributes.phone) {
      this.phoneIndex.set(attributes.phone, unifiedProfile.id);
    }
    if (attributes.email) {
      this.emailIndex.set(attributes.email, unifiedProfile.id);
    }
    if (attributes.deviceId) {
      this.deviceIndex.set(attributes.deviceId, unifiedProfile.id);
    }

    return unifiedProfile;
  }

  /**
   * Get unified profile by identifier
   */
  getProfile(identifier: { phone?: string; email?: string; deviceId?: string }): UnifiedProfile | undefined {
    if (identifier.phone) {
      const unifiedId = this.phoneIndex.get(identifier.phone);
      if (unifiedId) return this.profiles.get(unifiedId);
    }
    if (identifier.email) {
      const unifiedId = this.emailIndex.get(identifier.email);
      if (unifiedId) return this.profiles.get(unifiedId);
    }
    if (identifier.deviceId) {
      const unifiedId = this.deviceIndex.get(identifier.deviceId);
      if (unifiedId) return this.profiles.get(unifiedId);
    }
    return undefined;
  }

  /**
   * Get full journey across all apps
   */
  getCrossAppJourney(unifiedId: string): CrossAppJourney | undefined {
    const profile = this.profiles.get(unifiedId);
    if (!profile) return undefined;

    const allEvents: JourneyEvent[] = [];

    for (const linked of profile.linkedProfiles) {
      for (const interaction of linked.interactions) {
        allEvents.push({
          timestamp: interaction.timestamp,
          source: interaction.source,
          type: interaction.type,
          merchantId: interaction.merchantId,
          context: interaction.metadata,
        });
      }
    }

    allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const totalSpend = allEvents
      .filter((e) => e.context?.amount)
      .reduce((sum, e) => sum + (e.context.amount as number) || 0, 0);

    const totalOrders = allEvents.filter((e) => e.type === 'order').length;

    return {
      unifiedId,
      events: allEvents,
      totalSpend,
      totalOrders,
      firstInteraction: allEvents[allEvents.length - 1]?.timestamp || new Date(),
      lastInteraction: allEvents[0]?.timestamp || new Date(),
    };
  }

  /**
   * Record an interaction
   */
  recordInteraction(
    unifiedId: string,
    source: string,
    type: InteractionType,
    metadata: Record<string, unknown>,
    merchantId?: string
  ): void {
    const profile = this.profiles.get(unifiedId);
    if (!profile) return;

    // Update last seen for all linked profiles
    for (const linked of profile.linkedProfiles) {
      linked.lastSeen = new Date();
    }

    // Find or create interaction
    const linkedProfile = profile.linkedProfiles.find(
      (lp) => lp.source === source && lp.merchantId === merchantId
    ) || profile.linkedProfiles[0];

    const interaction: Interaction = {
      id: `interaction-${Date.now()}`,
      type,
      source,
      merchantId,
      timestamp: new Date(),
      metadata,
    };

    linkedProfile.interactions.push(interaction);

    // Update aggregate attributes
    if (metadata.amount) {
      linkedProfile.attributes.lifetimeValue =
        (linkedProfile.attributes.lifetimeValue || 0) + (metadata.amount as number);
    }
  }

  /**
   * Create or update segment
   */
  createSegment(criteria: SegmentCriteria, name: string): Segment {
    const segment: Segment = {
      id: `segment-${Date.now()}`,
      name,
      criteria,
      memberCount: 0,
      updatedAt: new Date(),
    };

    this.segments.set(segment.id, segment);
    this.recalculateSegment(segment.id);

    return segment;
  }

  /**
   * Get members of a segment
   */
  getSegmentMembers(segmentId: string): UnifiedProfile[] {
    const segment = this.segments.get(segmentId);
    if (!segment) return [];

    return this.queryProfiles(segment.criteria);
  }

  /**
   * Query profiles matching criteria
   */
  queryProfiles(criteria: SegmentCriteria): UnifiedProfile[] {
    const results: UnifiedProfile[] = [];

    for (const profile of this.profiles.values()) {
      if (this.matchesCriteria(profile, criteria)) {
        results.push(profile);
      }
    }

    return results;
  }

  /**
   * Check if profile matches criteria
   */
  private matchesCriteria(profile: UnifiedProfile, criteria: SegmentCriteria): boolean {
    const results = criteria.conditions.map((condition) =>
      this.matchesCondition(profile, condition)
    );

    if (criteria.type === 'and') {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Check single condition
   */
  private matchesCondition(profile: UnifiedProfile, condition: Condition): boolean {
    // Get value from any linked profile
    let value: unknown;
    for (const linked of profile.linkedProfiles) {
      value = (linked.attributes as Record<string, unknown>)[condition.field];
      if (value !== undefined) break;
    }

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return (value as number) > (condition.value as number);
      case 'lt':
        return (value as number) < (condition.value as number);
      case 'gte':
        return (value as number) >= (condition.value as number);
      case 'lte':
        return (value as number) <= (condition.value as number);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'between':
        const [min, max] = condition.value as [number, number];
        return (value as number) >= min && (value as number) <= max;
      default:
        return false;
    }
  }

  /**
   * Recalculate segment member count
   */
  recalculateSegment(segmentId: string): void {
    const segment = this.segments.get(segmentId);
    if (!segment) return;

    const members = this.getSegmentMembers(segmentId);
    segment.memberCount = members.length;
    segment.updatedAt = new Date();
  }

  /**
   * Merge two profiles
   */
  mergeProfiles(unifiedId1: string, unifiedId2: string): UnifiedProfile | undefined {
    const profile1 = this.profiles.get(unifiedId1);
    const profile2 = this.profiles.get(unifiedId2);

    if (!profile1 || !profile2) return undefined;

    // Merge linked profiles
    const merged: UnifiedProfile = {
      ...profile1,
      linkedProfiles: [...profile1.linkedProfiles, ...profile2.linkedProfiles],
      sources: [...new Set([...profile1.sources, ...profile2.sources])],
      confidence: Math.min(profile1.confidence + profile2.confidence, 1.0),
      mergedAt: new Date(),
    };

    // Remove old profile
    this.profiles.delete(unifiedId2);

    // Update merged profile
    this.profiles.set(merged.id, merged);

    return merged;
  }

  /**
   * Get LTV across all apps
   */
  getUnifiedLTV(unifiedId: string): {
    total: number;
    bySource: Record<string, number>;
    avgOrder: number;
    predictedLTV: number;
  } {
    const journey = this.getCrossAppJourney(unifiedId);
    if (!journey) {
      return { total: 0, bySource: {}, avgOrder: 0, predictedLTV: 0 };
    }

    const bySource: Record<string, number> = {};
    for (const event of journey.events) {
      if (event.context?.amount) {
        bySource[event.source] = (bySource[event.source] || 0) + (event.context.amount as number);
      }
    }

    const avgOrder = journey.totalOrders > 0 ? journey.totalSpend / journey.totalOrders : 0;

    // Simple LTV prediction based on frequency
    const daysActive = Math.max(
      1,
      (journey.lastInteraction.getTime() - journey.firstInteraction.getTime()) / (1000 * 60 * 60 * 24)
    );
    const monthlySpend = (journey.totalSpend / daysActive) * 30;
    const predictedLTV = monthlySpend * 24; // 24-month prediction

    return {
      total: journey.totalSpend,
      bySource,
      avgOrder,
      predictedLTV,
    };
  }

  /**
   * Get analytics
   */
  getAnalytics(): {
    totalProfiles: number;
    bySource: Record<string, number>;
    totalInteractions: number;
    segments: number;
    avgLTV: number;
  } {
    let totalInteractions = 0;
    let totalLTV = 0;
    const bySource: Record<string, number> = {};

    for (const profile of this.profiles.values()) {
      for (const linked of profile.linkedProfiles) {
        totalInteractions += linked.interactions.length;
        bySource[linked.source] = (bySource[linked.source] || 0) + 1;
        totalLTV += linked.attributes.lifetimeValue || 0;
      }
    }

    return {
      totalProfiles: this.profiles.size,
      bySource,
      totalInteractions,
      segments: this.segments.size,
      avgLTV: this.profiles.size > 0 ? totalLTV / this.profiles.size : 0,
    };
  }
}

export const identityGraph = new ConsumerIdentityGraph();

/**
 * RelationshipMapper - Graph Relationship Definitions
 * Maps and manages relationship types between entities in the consumer graph
 */

import {
  GraphRelationship,
  AppType,
} from '../types';

export type RelationshipType =
  | 'USES_DEVICE'
  | 'LINKS_TO'
  | 'IN_HOUSEHOLD_WITH'
  | 'REFERRED'
  | 'PURCHASED'
  | 'VIEWED'
  | 'WISHLISTED'
  | 'REVIEWED'
  | 'SCANNED'
  | 'REDEEMED'
  | 'REFERRED_BY'
  | 'SHARES_CARD_WITH'
  | 'VISITED_LOCATION'
  | 'PARTICIPATED_IN';

export interface RelationshipDefinition {
  type: RelationshipType;
  sourceLabel: string;
  targetLabel: string;
  properties?: Record<string, unknown>;
  weight?: number;
  bidirectional?: boolean;
}

export class RelationshipMapper {
  private definitions: Map<RelationshipType, RelationshipDefinition>;

  constructor() {
    this.definitions = new Map();
    this.initializeDefaultRelationships();
  }

  private initializeDefaultRelationships(): void {
    // Device relationships
    this.definitions.set('USES_DEVICE', {
      type: 'USES_DEVICE',
      sourceLabel: 'Consumer',
      targetLabel: 'Device',
      properties: {
        linked_at: { type: 'datetime', required: false },
        last_seen: { type: 'datetime', required: false },
        device_type: { type: 'string', required: false },
      },
      weight: 1.0,
    });

    // Platform linking
    this.definitions.set('LINKS_TO', {
      type: 'LINKS_TO',
      sourceLabel: 'Consumer',
      targetLabel: 'PlatformAccount',
      properties: {
        source_app: { type: 'string', required: false },
        target_app: { type: 'string', required: false },
        created_at: { type: 'datetime', required: false },
      },
      weight: 0.9,
    });

    // Household relationship
    this.definitions.set('IN_HOUSEHOLD_WITH', {
      type: 'IN_HOUSEHOLD_WITH',
      sourceLabel: 'Consumer',
      targetLabel: 'Consumer',
      bidirectional: true,
      properties: {
        created_at: { type: 'datetime', required: false },
        household_id: { type: 'string', required: false },
      },
      weight: 0.8,
    });

    // Referral relationships
    this.definitions.set('REFERRED', {
      type: 'REFERRED',
      sourceLabel: 'Consumer',
      targetLabel: 'Consumer',
      properties: {
        referral_code: { type: 'string', required: false },
        created_at: { type: 'datetime', required: false },
        reward_earned: { type: 'number', required: false },
      },
      weight: 0.7,
    });

    this.definitions.set('REFERRED_BY', {
      type: 'REFERRED_BY',
      sourceLabel: 'Consumer',
      targetLabel: 'Consumer',
      properties: {
        referral_code: { type: 'string', required: false },
        created_at: { type: 'datetime', required: false },
      },
      weight: 0.7,
    });

    // Purchase relationships
    this.definitions.set('PURCHASED', {
      type: 'PURCHASED',
      sourceLabel: 'Consumer',
      targetLabel: 'Product',
      properties: {
        order_id: { type: 'string', required: false },
        quantity: { type: 'number', required: false },
        price: { type: 'number', required: false },
        timestamp: { type: 'datetime', required: false },
      },
      weight: 0.6,
    });

    // Browsing relationships
    this.definitions.set('VIEWED', {
      type: 'VIEWED',
      sourceLabel: 'Consumer',
      targetLabel: 'Product',
      properties: {
        session_id: { type: 'string', required: false },
        duration: { type: 'number', required: false },
        timestamp: { type: 'datetime', required: false },
      },
      weight: 0.3,
    });

    this.definitions.set('WISHLISTED', {
      type: 'WISHLISTED',
      sourceLabel: 'Consumer',
      targetLabel: 'Product',
      properties: {
        added_at: { type: 'datetime', required: false },
        list_id: { type: 'string', required: false },
      },
      weight: 0.5,
    });

    // Review relationship
    this.definitions.set('REVIEWED', {
      type: 'REVIEWED',
      sourceLabel: 'Consumer',
      targetLabel: 'Product',
      properties: {
        rating: { type: 'number', required: false },
        comment: { type: 'string', required: false },
        timestamp: { type: 'datetime', required: false },
      },
      weight: 0.4,
    });

    // DOOH relationships
    this.definitions.set('SCANNED', {
      type: 'SCANNED',
      sourceLabel: 'Consumer',
      targetLabel: 'DOOHCampaign',
      properties: {
        location_id: { type: 'string', required: false },
        timestamp: { type: 'datetime', required: false },
        reward_earned: { type: 'number', required: false },
      },
      weight: 0.5,
    });

    this.definitions.set('REDEEMED', {
      type: 'REDEEMED',
      sourceLabel: 'Consumer',
      targetLabel: 'Offer',
      properties: {
        timestamp: { type: 'datetime', required: false },
        points_spent: { type: 'number', required: false },
        discount_received: { type: 'number', required: false },
      },
      weight: 0.6,
    });

    // Wallet relationships
    this.definitions.set('SHARES_CARD_WITH', {
      type: 'SHARES_CARD_WITH',
      sourceLabel: 'Consumer',
      targetLabel: 'Consumer',
      bidirectional: true,
      properties: {
        card_id: { type: 'string', required: false },
        created_at: { type: 'datetime', required: false },
      },
      weight: 0.9,
    });

    // Location relationships
    this.definitions.set('VISITED_LOCATION', {
      type: 'VISITED_LOCATION',
      sourceLabel: 'Consumer',
      targetLabel: 'Location',
      properties: {
        timestamp: { type: 'datetime', required: false },
        duration: { type: 'number', required: false },
        check_in: { type: 'boolean', required: false },
      },
      weight: 0.4,
    });

    // Campaign relationships
    this.definitions.set('PARTICIPATED_IN', {
      type: 'PARTICIPATED_IN',
      sourceLabel: 'Consumer',
      targetLabel: 'Campaign',
      properties: {
        campaign_id: { type: 'string', required: false },
        joined_at: { type: 'datetime', required: false },
        status: { type: 'string', required: false },
      },
      weight: 0.5,
    });
  }

  /**
   * Get relationship definition
   */
  getDefinition(type: RelationshipType): RelationshipDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   * Check if relationship is bidirectional
   */
  isBidirectional(type: RelationshipType): boolean {
    const def = this.definitions.get(type);
    return def?.bidirectional ?? false;
  }

  /**
   * Get weight for relationship
   */
  getWeight(type: RelationshipType): number {
    const def = this.definitions.get(type);
    return def?.weight ?? 0.5;
  }

  /**
   * Validate relationship properties
   */
  validateProperties(type: RelationshipType, properties: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const def = this.definitions.get(type);
    if (!def) {
      return { valid: false, errors: ['Unknown relationship type'] };
    }

    const errors: string[] = [];
    const requiredProps = def.properties
      ? Object.entries(def.properties).filter(([, schema]) => schema.required)
      : [];

    for (const [name, schema] of requiredProps) {
      if (properties[name] === undefined || properties[name] === null) {
        errors.push(`Missing required property: ${name}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create relationship with defaults
   */
  createRelationship(
    type: RelationshipType,
    source: string,
    target: string,
    properties?: Record<string, unknown>
  ): GraphRelationship {
    const def = this.definitions.get(type);
    const now = new Date().toISOString();

    const defaultProps: Record<string, unknown> = {
      created_at: now,
    };

    // Add type-specific defaults
    if (type === 'USES_DEVICE') {
      defaultProps.linked_at = now;
      defaultProps.last_seen = now;
    }

    return {
      type,
      source,
      target,
      properties: {
        ...defaultProps,
        ...properties,
      },
      weight: def?.weight ?? 0.5,
    };
  }

  /**
   * Get inverse relationship type
   */
  getInverseRelationship(type: RelationshipType): RelationshipType | null {
    const inverses: Partial<Record<RelationshipType, RelationshipType>> = {
      'REFERRED': 'REFERRED_BY',
      'REFERRED_BY': 'REFERRED',
      'USES_DEVICE': 'USED_BY',
      'PURCHASED': 'PURCHASED_BY',
    };
    return inverses[type] || null;
  }

  /**
   * Calculate relationship strength
   */
  calculateStrength(relationship: GraphRelationship): number {
    let strength = relationship.weight ?? 0.5;

    // Adjust by recency
    const createdAt = relationship.properties.created_at
      ? new Date(relationship.properties.created_at).getTime()
      : Date.now();
    const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

    // Decay for older relationships
    if (daysSinceCreation > 30) {
      strength *= Math.max(0.5, 1 - (daysSinceCreation - 30) / 365);
    }

    // Boost for frequent interactions
    if (relationship.properties.interaction_count) {
      strength = Math.min(1, strength + Math.log(relationship.properties.interaction_count) * 0.1);
    }

    return strength;
  }

  /**
   * Get all relationship types
   */
  getAllRelationshipTypes(): RelationshipType[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * Get relationship types for a label
   */
  getRelationshipsForLabel(label: string): RelationshipDefinition[] {
    return Array.from(this.definitions.values()).filter(
      (def) => def.sourceLabel === label || def.targetLabel === label
    );
  }

  /**
   * Serialize relationship for storage
   */
  serialize(relationship: GraphRelationship): string {
    return JSON.stringify({
      ...relationship,
      serialized_at: new Date().toISOString(),
    });
  }

  /**
   * Deserialize relationship from storage
   */
  deserialize(data: string): GraphRelationship {
    const parsed = JSON.parse(data);
    return {
      type: parsed.type,
      source: parsed.source,
      target: parsed.target,
      properties: parsed.properties || {},
      weight: parsed.weight,
    };
  }
}

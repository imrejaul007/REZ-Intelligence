/**
 * Types for Identity Integration
 */

// ============================================
// Identity Graph Types
// ============================================

export interface IdentityNode {
  id: string;
  type: 'user' | 'device' | 'email' | 'phone' | 'session';
  identifiers: {
    userId?: string;
    phone?: string;
    email?: string;
    deviceId?: string;
    sessionId?: string;
  };
  platform: string;
  firstSeen: Date;
  lastSeen: Date;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface IdentityEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'same_user' | 'household' | 'device_share' | 'account_link';
  confidence: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IdentityResolutionResult {
  resolved: boolean;
  primaryId?: string;
  nodes?: IdentityNode[];
  edges?: IdentityEdge[];
  confidence?: number;
  mergeSuggestions?: {
    sourceId: string;
    targetId: string;
    confidence: number;
  }[];
}

// ============================================
// Customer Profile Types
// ============================================

export interface CustomerProfile {
  userId: string;
  primaryIdentifiers: {
    phone?: string;
    email?: string;
  };
  platforms: {
    platform: string;
    userId: string;
    linkedAt: Date;
  }[];
  segments: string[];
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimeValue: number;
  firstPurchase?: Date;
  lastPurchase?: Date;
  totalOrders: number;
  averageOrderValue: number;
  preferredChannels: string[];
  metadata?: Record<string, unknown>;
}

// ============================================
// Relationship Types
// ============================================

export interface CustomerRelationship {
  customerId: string;
  relatedCustomerId: string;
  relationshipType: 'family' | 'friend' | 'colleague' | 'household';
  strength: number;
  createdAt: Date;
}

export interface CustomerConnections {
  customerId: string;
  connections: CustomerRelationship[];
  totalConnections: number;
}

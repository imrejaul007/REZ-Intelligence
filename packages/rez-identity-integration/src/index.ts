/**
 * REZ Identity Integration - Unified Client
 *
 * Consolidates all identity services under a single interface:
 * - REZ-identity-graph (primary)
 * - REZ-universal-user-graph (cross-platform)
 * - REZ-consumer-graph (consumer relationships)
 * - REZ-identity-bridge (bridging)
 */

import type {
  IdentityNode,
  IdentityEdge,
  IdentityResolutionResult,
  CustomerProfile,
} from './types';

// ============================================
// Configuration
// ============================================

export const IDENTITY_ENDPOINTS = {
  identityGraph: process.env.IDENTITY_GRAPH_URL || 'http://localhost:4050',
  universalUserGraph: process.env.UNIVERSAL_USER_GRAPH_URL || 'http://localhost:4055',
  consumerGraph: process.env.CONSUMER_GRAPH_URL || 'http://localhost:4055',
  identityBridge: process.env.IDENTITY_BRIDGE_URL || 'http://localhost:4092',
} as const;

export interface IdentityConfig {
  internalToken: string;
  timeout?: number;
  maxRetries?: number;
}

// ============================================
// Types
// ============================================

export interface ResolveIdentityRequest {
  identifiers: {
    phone?: string;
    email?: string;
    deviceId?: string;
    userId?: string;
  };
  source: string;
  mergeIfFound?: boolean;
}

export interface LinkIdentitiesRequest {
  primaryId: string;
  secondaryId: string;
  linkType: 'phone' | 'email' | 'device' | 'account';
  confidence: number;
}

export interface Customer360Request {
  userId: string;
  includeRelationships?: boolean;
  includeDevices?: boolean;
  includeTransactions?: boolean;
}

// ============================================
// Identity Client
// ============================================

export class IdentityClient {
  private config: Required<IdentityConfig>;
  private baseUrl: string;

  constructor(config: IdentityConfig) {
    this.config = {
      internalToken: config.internalToken,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    };
    this.baseUrl = IDENTITY_ENDPOINTS.identityGraph;
  }

  // ============================================
  // Identity Resolution
  // ============================================

  /**
   * Resolve identity from multiple identifiers
   */
  async resolve(request: ResolveIdentityRequest): Promise<IdentityResolutionResult> {
    const response = await this.fetch(`${this.baseUrl}/api/v1/identity/resolve`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response as IdentityResolutionResult;
  }

  /**
   * Get identity graph for a user
   */
  async getIdentityGraph(userId: string): Promise<{
    nodes: IdentityNode[];
    edges: IdentityEdge[];
  }> {
    const response = await this.fetch(`${this.baseUrl}/api/v1/identity/${userId}/graph`);
    return response as { nodes: IdentityNode[]; edges: IdentityEdge[] };
  }

  /**
   * Link two identities
   */
  async linkIdentities(request: LinkIdentitiesRequest): Promise<{ success: boolean }> {
    const response = await this.fetch(`${this.baseUrl}/api/v1/identity/link`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response as { success: boolean };
  }

  /**
   * Unlink identities
   */
  async unlinkIdentities(primaryId: string, secondaryId: string): Promise<{ success: boolean }> {
    const response = await this.fetch(`${this.baseUrl}/api/v1/identity/unlink`, {
      method: 'POST',
      body: JSON.stringify({ primaryId, secondaryId }),
    });
    return response as { success: boolean };
  }

  // ============================================
  // Universal User Graph (Cross-Platform)
  // ============================================

  /**
   * Get universal profile across all platforms
   */
  async getUniversalProfile(userId: string): Promise<CustomerProfile> {
    const url = IDENTITY_ENDPOINTS.universalUserGraph.replace('/api/v1', '/api/v1/universal');
    const response = await this.fetch(`${url}/profile/${userId}`);
    return response as CustomerProfile;
  }

  /**
   * Get all linked accounts for a user
   */
  async getLinkedAccounts(userId: string): Promise<{
    accounts: {
      platform: string;
      userId: string;
      linkedAt: Date;
    }[];
  }> {
    const url = IDENTITY_ENDPOINTS.universalUserGraph.replace('/api/v1', '/api/v1/universal');
    const response = await this.fetch(`${url}/accounts/${userId}`);
    return response as { accounts: { platform: string; userId: string; linkedAt: Date }[] };
  }

  /**
   * Merge two user profiles
   */
  async mergeProfiles(sourceId: string, targetId: string): Promise<{ success: boolean }> {
    const url = IDENTITY_ENDPOINTS.universalUserGraph.replace('/api/v1', '/api/v1/universal');
    const response = await this.fetch(`${url}/merge`, {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId }),
    });
    return response as { success: boolean };
  }

  // ============================================
  // Consumer Graph (Relationships)
  // ============================================

  /**
   * Get consumer profile with relationships
   */
  async getConsumerProfile(userId: string): Promise<CustomerProfile> {
    const url = IDENTITY_ENDPOINTS.consumerGraph.replace('/api/v1', '/api/v1/consumer');
    const response = await this.fetch(`${url}/profile/${userId}`);
    return response as CustomerProfile;
  }

  /**
   * Get customer 360 view
   */
  async getCustomer360(request: Customer360Request): Promise<CustomerProfile> {
    const url = IDENTITY_ENDPOINTS.consumerGraph.replace('/api/v1', '/api/v1/consumer');
    const response = await this.fetch(`${url}/360/${request.userId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response as CustomerProfile;
  }

  // ============================================
  // Identity Bridge
  // ============================================

  /**
   * Create cross-platform identity bridge
   */
  async createBridge(data: {
    sourcePlatform: string;
    sourceId: string;
    targetPlatform: string;
    targetId: string;
  }): Promise<{ bridgeId: string }> {
    const response = await this.fetch(`${IDENTITY_ENDPOINTS.identityBridge}/api/v1/bridge`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response as { bridgeId: string };
  }

  /**
   * Get bridges for a user
   */
  async getBridges(userId: string): Promise<{
    bridges: {
      id: string;
      platform: string;
      userId: string;
      createdAt: Date;
    }[];
  }> {
    const response = await this.fetch(`${IDENTITY_ENDPOINTS.identityBridge}/api/v1/bridge/${userId}`);
    return response as { bridges: { id: string; platform: string; userId: string; createdAt: Date }[] };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async fetch(url: string, options: RequestInit = {}): Promise<unknown> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': this.config.internalToken,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Identity API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// ============================================
// Utility Functions
// ============================================

export function getInternalToken(): string {
  return process.env.INTERNAL_SERVICE_TOKEN || '';
}

export function createIdentityClient(config?: Partial<IdentityConfig>): IdentityClient {
  return new IdentityClient({
    internalToken: config?.internalToken || getInternalToken(),
    timeout: config?.timeout,
    maxRetries: config?.maxRetries,
  });
}

// ============================================
// Default Export
// ============================================

export default IdentityClient;

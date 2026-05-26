import logger from './utils/logger.js';

/**
 * REZ-identity-graph → Commerce Graph Sync
 *
 * Syncs identity data to the unified commerce graph
 */

import axios from 'axios';

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

interface IdentityUpdate {
  userId: string;
  phone?: string;
  email?: string;
  deviceIds?: string[];
  segments?: string[];
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimeValue?: number;
  interests?: string[];
  location?: { lat: number; lng: number };
}

interface IdentityNode {
  userId: string;
  type: string;
  identifiers: Record<string, string>;
  platform: string;
  confidence: number;
}

// ============================================
// COMMERCE GRAPH SYNC
// ============================================

class CommerceGraphSync {
  /**
   * Sync identity update to Commerce Graph
   */
  async syncIdentityUpdate(update: IdentityUpdate): Promise<void> {
    try {
      await axios.patch(
        `${COMMERCE_GRAPH_URL}/api/customers/${update.userId}`,
        {
          $set: {
            'segments': update.segments,
            'tier': update.tier,
            'lifetimeValue': update.lifetimeValue,
            'interests': update.interests,
            'location': update.location,
            ...(update.phone && { 'phone': update.phone }),
            ...(update.email && { 'email': update.email }),
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[CommerceSync] Identity synced for ${update.userId}`);
    } catch (error) {
      logger.error(`[CommerceSync] Failed to sync identity: ${error.message}`);
    }
  }

  /**
   * Create or update customer node in Commerce Graph
   */
  async upsertCustomerNode(node: {
    userId: string;
    phone?: string;
    email?: string;
    deviceIds?: string[];
    segments?: string[];
    tier?: string;
  }): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/customers`,
        node,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[CommerceSync] Customer node upserted: ${node.userId}`);
    } catch (error) {
      // Ignore if already exists
      if (!error.message?.includes('409')) {
        logger.error(`[CommerceSync] Failed to upsert customer: ${error.message}`);
      }
    }
  }

  /**
   * Link identity to customer
   */
  async linkIdentityToCustomer(
    userId: string,
    identityType: 'phone' | 'email' | 'device',
    identityValue: string
  ): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}/identities`,
        {
          type: identityType,
          value: identityValue
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[CommerceSync] Identity linked: ${identityType} -> ${userId}`);
    } catch (error) {
      logger.error(`[CommerceSync] Failed to link identity: ${error.message}`);
    }
  }

  /**
   * Get customer data from Commerce Graph
   */
  async getCustomerFromGraph(userId: string): Promise<unknown> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/customers/${userId}`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data;
    } catch (error) {
      logger.error(`[CommerceSync] Failed to get customer: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch sync identities
   */
  async batchSync(updates: IdentityUpdate[]): Promise<void> {
    await Promise.all(updates.map(update => this.syncIdentityUpdate(update)));
    logger.info(`[CommerceSync] Batch synced ${updates.length} identities`);
  }
}

export const commerceGraphSync = new CommerceGraphSync();

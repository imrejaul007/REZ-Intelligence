/**
 * GraphEngine - Graph Database Operations
 * Manages Neo4j graph database interactions for consumer relationships
 */

import neo4j, { Driver, Session, Record as Neo4jRecord } from 'neo4j-driver';
import winston from 'winston';
import {
  ConsumerGraphConfig,
  Consumer360,
  GraphNode,
  GraphRelationship,
  QueryResult,
  AppType,
} from '../types';

export class GraphEngine {
  private driver: Driver | null = null;
  private config: ConsumerGraphConfig;
  private logger: winston.Logger;
  private connected: boolean = false;

  constructor(config: ConsumerGraphConfig) {
    this.config = config;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.initializeDriver();
  }

  private async initializeDriver(): Promise<void> {
    try {
      this.driver = neo4j.driver(
        this.config.neo4j.uri,
        neo4j.auth.basic(this.config.neo4j.user, this.config.neo4j.password),
        {
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 30000,
        }
      );

      // Test connection
      await this.driver.verifyConnectivity();
      this.connected = true;
      this.logger.info('Connected to Neo4j', { uri: this.config.neo4j.uri });
    } catch (error) {
      this.logger.warn('Neo4j connection failed, running in memory mode', { error });
      this.connected = false;
    }
  }

  private async getSession(): Promise<Session | null> {
    if (!this.driver || !this.connected) {
      return null;
    }
    return this.driver.session();
  }

  // ============================================
  // CONSUMER NODE OPERATIONS
  // ============================================

  /**
   * Create a consumer node in the graph
   */
  async createConsumerNode(consumer: Consumer360): Promise<void> {
    const session = await this.getSession();
    if (!session) {
      this.logger.info('Running in memory mode - skipping graph creation');
      return;
    }

    try {
      await session.run(
        `
        MERGE (c:Consumer {user_id: $userId})
        SET c.email = $email,
            c.phone = $phone,
            c.created_at = datetime($createdAt),
            c.updated_at = datetime(),
            c.loyalty_tier = $loyaltyTier,
            c.total_spent = $totalSpent,
            c.total_orders = $totalOrders,
            c.points_balance = $pointsBalance
        `,
        {
          userId: consumer.user_id,
          email: consumer.primary_email || '',
          phone: consumer.primary_phone || '',
          createdAt: consumer.created_at,
          loyaltyTier: consumer.loyalty.tier,
          totalSpent: consumer.transactions.total_spent,
          totalOrders: consumer.transactions.total_orders,
          pointsBalance: consumer.loyalty.points_balance,
        }
      );
      this.logger.debug('Consumer node created/updated', { userId: consumer.user_id });
    } catch (error) {
      this.logger.error('Failed to create consumer node', { error, userId: consumer.user_id });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a consumer node
   */
  async deleteConsumerNode(userId: string): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (c:Consumer {user_id: $userId})
        DETACH DELETE c
        `,
        { userId }
      );
      this.logger.debug('Consumer node deleted', { userId });
    } catch (error) {
      this.logger.error('Failed to delete consumer node', { error, userId });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Update consumer node properties
   */
  async updateConsumerNode(userId: string, properties: Partial<Consumer360>): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    try {
      const setClauses: string[] = ['c.updated_at = datetime()'];
      const params: Record<string, unknown> = { userId };

      if (properties.primary_email !== undefined) {
        setClauses.push('c.email = $email');
        params.email = properties.primary_email;
      }
      if (properties.primary_phone !== undefined) {
        setClauses.push('c.phone = $phone');
        params.phone = properties.primary_phone;
      }
      if (properties.loyalty) {
        setClauses.push('c.loyalty_tier = $loyaltyTier');
        params.loyaltyTier = properties.loyalty.tier;
      }
      if (properties.transactions) {
        setClauses.push('c.total_spent = $totalSpent');
        setClauses.push('c.total_orders = $totalOrders');
        params.totalSpent = properties.transactions.total_spent;
        params.totalOrders = properties.transactions.total_orders;
      }

      await session.run(
        `
        MATCH (c:Consumer {user_id: $userId})
        SET ${setClauses.join(', ')}
        `,
        params
      );
      this.logger.debug('Consumer node updated', { userId });
    } catch (error) {
      this.logger.error('Failed to update consumer node', { error, userId });
      throw error;
    } finally {
      await session.close();
    }
  }

  // ============================================
  // DEVICE RELATIONSHIPS
  // ============================================

  /**
   * Create device link relationship
   */
  async createDeviceLink(
    userId: string,
    deviceId: string,
    deviceType: string
  ): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MERGE (c:Consumer {user_id: $userId})
        MERGE (d:Device {device_id: $deviceId})
        MERGE (c)-[r:USES_DEVICE]->(d)
        SET r.device_type = $deviceType,
            r.linked_at = datetime(),
            r.last_seen = datetime()
        `,
        { userId, deviceId, deviceType }
      );
      this.logger.debug('Device link created', { userId, deviceId });
    } catch (error) {
      this.logger.error('Failed to create device link', { error, userId, deviceId });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Find consumers by device
   */
  async findConsumersByDevice(deviceId: string): Promise<string[]> {
    const session = await this.getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        MATCH (c:Consumer)-[:USES_DEVICE]->(d:Device {device_id: $deviceId})
        RETURN c.user_id as userId
        `,
        { deviceId }
      );
      return result.records.map((record: Neo4jRecord) => record.get('userId') as string);
    } catch (error) {
      this.logger.error('Failed to find consumers by device', { error, deviceId });
      return [];
    } finally {
      await session.close();
    }
  }

  // ============================================
  // PLATFORM LINKS
  // ============================================

  /**
   * Create platform link relationship
   */
  async createPlatformLink(
    userId: string,
    sourceApp: AppType,
    targetApp: AppType,
    targetUserId: string
  ): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (c:Consumer {user_id: $userId})
        MERGE (t:PlatformAccount {user_id: $targetUserId, app: $targetApp})
        MERGE (c)-[r:LINKS_TO]->(t)
        SET r.source_app = $sourceApp,
            r.created_at = datetime()
        `,
        { userId, sourceApp, targetApp, targetUserId }
      );
      this.logger.debug('Platform link created', { userId, sourceApp, targetApp });
    } catch (error) {
      this.logger.error('Failed to create platform link', { error });
      throw error;
    } finally {
      await session.close();
    }
  }

  // ============================================
  // CONSUMER RELATIONSHIPS
  // ============================================

  /**
   * Create household relationship
   */
  async createHouseholdLink(userId1: string, userId2: string): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (c1:Consumer {user_id: $userId1})
        MATCH (c2:Consumer {user_id: $userId2})
        MERGE (c1)-[r:IN_HOUSEHOLD_WITH]->(c2)
        SET r.created_at = datetime()
        `,
        { userId1, userId2 }
      );
      this.logger.debug('Household link created', { userId1, userId2 });
    } catch (error) {
      this.logger.error('Failed to create household link', { error });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create referral relationship
   */
  async createReferralLink(referrerId: string, referredId: string, code: string): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (referrer:Consumer {user_id: $referrerId})
        MATCH (referred:Consumer {user_id: $referredId})
        MERGE (referrer)-[r:REFERRED]->(referred)
        SET r.referral_code = $code,
            r.created_at = datetime()
        `,
        { referrerId, referredId, code }
      );
      this.logger.debug('Referral link created', { referrerId, referredId });
    } catch (error) {
      this.logger.error('Failed to create referral link', { error });
      throw error;
    } finally {
      await session.close();
    }
  }

  // ============================================
  // QUERIES
  // ============================================

  /**
   * Get complete consumer graph
   */
  async getConsumerGraph(userId: string): Promise<{
    nodes: GraphNode[];
    relationships: GraphRelationship[];
  }> {
    const session = await this.getSession();
    if (!session) {
      return { nodes: [], relationships: [] };
    }

    try {
      const result = await session.run(
        `
        MATCH (c:Consumer {user_id: $userId})
        OPTIONAL MATCH path = (c)-[r]-(connected)
        RETURN c, relationships(path) as rels, nodes(path) as connectedNodes
        `,
        { userId }
      );

      const nodes: GraphNode[] = [];
      const relationships: GraphRelationship[] = [];

      for (const record of result.records) {
        const consumer = record.get('c') as { properties?: Record<string, unknown> };
        const props = consumer?.properties || {};
        nodes.push({
          id: String(props.user_id || ''),
          labels: ['Consumer'],
          properties: props,
          created_at: String(props.created_at || new Date().toISOString()),
          updated_at: String(props.updated_at || new Date().toISOString()),
        });

        const connectedNodes = record.get('connectedNodes') || [];
        const rels = record.get('rels') || [];

        for (let i = 0; i < connectedNodes.length; i++) {
          const node = connectedNodes[i] as { properties?: Record<string, unknown>; labels?: string[] };
          const nodeProps = node?.properties || {};
          nodes.push({
            id: String(nodeProps.device_id || nodeProps.user_id || `node_${i}`),
            labels: node?.labels || [],
            properties: nodeProps,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          const rel = rels[i] as { type?: string; properties?: Record<string, unknown> };
          if (rel) {
            relationships.push({
              type: rel.type || 'connected',
              source: String(props.user_id || ''),
              target: String(nodeProps.device_id || nodeProps.user_id || ''),
              properties: rel.properties || {},
            });
          }
        }
      }

      return { nodes, relationships };
    } catch (error) {
      this.logger.error('Failed to get consumer graph', { error, userId });
      return { nodes: [], relationships: [] };
    } finally {
      await session.close();
    }
  }

  /**
   * Find related consumers
   */
  async findRelatedConsumers(
    userId: string,
    relationshipType?: string
  ): Promise<string[]> {
    const session = await this.getSession();
    if (!session) return [];

    try {
      const query = relationshipType
        ? `
          MATCH (c:Consumer {user_id: $userId})-[r:${relationshipType}]-(related:Consumer)
          RETURN DISTINCT related.user_id as relatedId
        `
        : `
          MATCH (c:Consumer {user_id: $userId})-[r]-(related:Consumer)
          RETURN DISTINCT related.user_id as relatedId
        `;

      const result = await session.run(query, { userId });
      return result.records.map((record: Neo4jRecord) => record.get('relatedId') as string);
    } catch (error) {
      this.logger.error('Failed to find related consumers', { error, userId });
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Count related consumers by type
   */
  async countRelatedByType(userId: string, type: string): Promise<number> {
    const session = await this.getSession();
    if (!session) return 0;

    try {
      const result = await session.run(
        `
        MATCH (c:Consumer {user_id: $userId})-[r:${type}]-(related:Consumer)
        RETURN count(DISTINCT related) as count
        `,
        { userId }
      );
      return (result.records[0]?.get('count') as number) || 0;
    } catch (error) {
      this.logger.error('Failed to count related consumers', { error, userId, type });
      return 0;
    } finally {
      await session.close();
    }
  }

  /**
   * Merge consumer nodes
   */
  async mergeConsumerNodes(sourceUserId: string, targetUserId: string): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (source:Consumer {user_id: $sourceUserId})
        MATCH (target:Consumer {user_id: $targetUserId})

        // Transfer all relationships from source to target
        OPTIONAL MATCH (source)-[r]-(connected)
        FOREACH (rel IN relationships(r) |
          MERGE (target)-[newRel:TYPE(r)]-(connected)
          SET newRel = properties(r)
        )

        // Delete source node
        DETACH DELETE source
        `,
        { sourceUserId, targetUserId }
      );
      this.logger.debug('Consumer nodes merged', { sourceUserId, targetUserId });
    } catch (error) {
      this.logger.error('Failed to merge consumer nodes', { error });
      throw error;
    } finally {
      await session.close();
    }
  }

  // ============================================
  // ADVANCED QUERIES
  // ============================================

  /**
   * Find potential duplicate consumers (same email/phone)
   */
  async findPotentialDuplicates(): Promise<Array<[string, string]>> {
    const session = await this.getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        MATCH (c1:Consumer), (c2:Consumer)
        WHERE c1 < c2
          AND (
            (c1.email <> '' AND c1.email = c2.email)
            OR (c1.phone <> '' AND c1.phone = c2.phone)
          )
        RETURN c1.user_id as id1, c2.user_id as id2
        `
      );
      return result.records.map(
        (record: Neo4jRecord) => [record.get('id1') as string, record.get('id2') as string]
      );
    } catch (error) {
      this.logger.error('Failed to find potential duplicates', { error });
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get consumer network (friends, family, connections)
   */
  async getConsumerNetwork(userId: string, depth: number = 2): Promise<{
    users: GraphNode[];
    edges: GraphRelationship[];
  }> {
    const session = await this.getSession();
    if (!session) return { users: [], edges: [] };

    try {
      const result = await session.run(
        `
        MATCH path = (c:Consumer {user_id: $userId})-[:IN_HOUSEHOLD_WITH|REFERRED*1..${depth}]-(related:Consumer)
        WITH nodes(path) as ns, relationships(path) as rs
        UNWIND ns as n
        WITH collect(DISTINCT n) as nodes, rs
        UNWIND rs as r
        RETURN nodes, collect(DISTINCT r) as relationships
        `,
        { userId }
      );

      const nodes: GraphNode[] = [];
      const edges: GraphRelationship[] = [];

      for (const record of result.records) {
        const graphNodes = record.get('nodes') as unknown[];
        const graphRels = record.get('relationships') as unknown[];

        for (const node of graphNodes) {
          const n = node as { properties?: Record<string, unknown>; labels?: string[] };
          const props = n?.properties || {};
          nodes.push({
            id: String(props.user_id || ''),
            labels: n?.labels || [],
            properties: props,
            created_at: String(props.created_at || new Date().toISOString()),
            updated_at: String(props.updated_at || new Date().toISOString()),
          });
        }

        for (const rel of graphRels) {
          const r = rel as { type?: string; start?: { properties?: Record<string, unknown> }; end?: { properties?: Record<string, unknown> }; properties?: Record<string, unknown> };
          edges.push({
            type: r.type || 'connected',
            source: String(r.start?.properties?.user_id || ''),
            target: String(r.end?.properties?.user_id || ''),
            properties: r.properties || {},
          });
        }
      }

      return { users: nodes, edges };
    } catch (error) {
      this.logger.error('Failed to get consumer network', { error, userId });
      return { users: [], edges: [] };
    } finally {
      await session.close();
    }
  }

  /**
   * Get community detection for consumers
   */
  async getCommunities(minSize: number = 3): Promise<Array<{
    communityId: string;
    members: string[];
  }>> {
    const session = await this.getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        CALL gds.graph.project(
          'consumerGraph',
          'Consumer',
          {
            IN_HOUSEHOLD_WITH: { orientation: 'UNDIRECTED' },
            REFERRED: { orientation: 'UNDIRECTED' }
          }
        )
        YIELD graphName
        RETURN graphName
        `
      );

      // Note: Full community detection would require GDS plugin
      // This is a simplified version
      return [];
    } catch (error) {
      this.logger.error('Failed to get communities', { error });
      return [];
    } finally {
      await session.close();
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.connected = false;
      this.logger.info('Neo4j connection closed');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

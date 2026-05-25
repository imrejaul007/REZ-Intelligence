/**
 * ConsumerGraph - Main Graph Orchestrator
 * Unified consumer identity management for REZ Commerce OS
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import {
  Consumer360,
  ConsumerGraphConfig,
  CreateConsumerRequest,
  LinkAccountRequest,
  AggregatedProfileResponse,
  IdentitySignal,
  AppType,
} from './types';
import { ConsumerProfile } from './ConsumerProfile';
import { IdentityResolver, ResolutionResult } from './IdentityResolver';
import { GraphEngine } from './graph/GraphEngine';
import { RelationshipMapper } from './graph/RelationshipMapper';
import { DeviceResolver } from './identity/DeviceResolver';
import { CrossPlatformLinker } from './identity/CrossPlatformLinker';

// Module imports
import { WalletModule } from './modules/WalletModule';
import { BrowsingModule } from './modules/BrowsingModule';
import { LoyaltyModule } from './modules/LoyaltyModule';
import { PaymentModule } from './modules/PaymentModule';
import { DOOHModule } from './modules/DOOHModule';
import { ReferralModule } from './modules/ReferralModule';
import { HotelModule } from './modules/HotelModule';
import { IntentModule } from './modules/IntentModule';

export class ConsumerGraph {
  private config: ConsumerGraphConfig;
  private logger: winston.Logger;
  private identityResolver: IdentityResolver;
  private graphEngine: GraphEngine;
  private relationshipMapper: RelationshipMapper;
  private deviceResolver: DeviceResolver;
  private crossPlatformLinker: CrossPlatformLinker;

  // Data stores
  private profiles: Map<string, ConsumerProfile>;
  private emailIndex: Map<string, string>; // email -> userId
  private phoneIndex: Map<string, string>; // phone -> userId

  // Modules
  private walletModule: WalletModule;
  private browsingModule: BrowsingModule;
  private loyaltyModule: LoyaltyModule;
  private paymentModule: PaymentModule;
  private doohModule: DOOHModule;
  private referralModule: ReferralModule;
  private hotelModule: HotelModule;
  private intentModule: IntentModule;

  constructor(config: ConsumerGraphConfig) {
    this.config = config;
    this.logger = this.createLogger();
    this.profiles = new Map();
    this.emailIndex = new Map();
    this.phoneIndex = new Map();

    // Initialize core components
    this.identityResolver = new IdentityResolver({
      deterministic: {
        enabled: true,
        weight: 1.0,
        signals: ['email', 'phone', 'account_id'],
      },
      probabilistic: {
        enabled: true,
        weight: 0.7,
        device_graph_weight: 0.5,
        behavioral_weight: 0.3,
        threshold: config.identity?.match_threshold ?? 0.75,
      },
    });

    this.graphEngine = new GraphEngine(config);
    this.relationshipMapper = new RelationshipMapper();
    this.deviceResolver = new DeviceResolver(config.identity?.device_graph_enabled ?? true);
    this.crossPlatformLinker = new CrossPlatformLinker();

    // Initialize modules
    this.walletModule = new WalletModule(this, config.services.wallet_service_url);
    this.browsingModule = new BrowsingModule(this, config.services.browsing_service_url);
    this.loyaltyModule = new LoyaltyModule(this, config.services.loyalty_service_url);
    this.paymentModule = new PaymentModule(this);
    this.doohModule = new DOOHModule(this);
    this.referralModule = new ReferralModule(this);
    this.hotelModule = new HotelModule(this);
    this.intentModule = new IntentModule(this, config.services.intent_service_url);

    this.logger.info('ConsumerGraph initialized', { config: { ...config, neo4j: { ...config.neo4j, password: '***' } } });
  }

  private createLogger(): winston.Logger {
    return winston.createLogger({
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
  }

  // ============================================
  // CONSUMER LIFECYCLE
  // ============================================

  /**
   * Create a new consumer profile
   */
  async createConsumer(request: CreateConsumerRequest): Promise<ConsumerProfile> {
    this.logger.info('Creating new consumer', { source: request.source });

    // Process identity signals
    const signals: IdentitySignal[] = [];
    if (request.email) {
      signals.push({
        type: 'email',
        value: request.email,
        source: request.source,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        hashed: false,
      });
    }
    if (request.phone) {
      signals.push({
        type: 'phone',
        value: request.phone,
        source: request.source,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        hashed: false,
      });
    }
    if (request.device_id) {
      signals.push({
        type: 'device_id',
        value: request.device_id,
        source: request.source,
        confidence: 0.8,
        timestamp: new Date().toISOString(),
        hashed: false,
      });
    }

    // Resolve identity
    let canonicalUserId: string = uuidv4();
    for (const signal of signals) {
      const result = await this.identityResolver.processSignal(signal);
      if (result.cluster.canonical_user_id) {
        canonicalUserId = result.cluster.canonical_user_id;
        break;
      }
    }

    // Check if profile already exists
    if (this.profiles.has(canonicalUserId)) {
      this.logger.warn('Consumer already exists, returning existing profile', { userId: canonicalUserId });
      return this.profiles.get(canonicalUserId)!;
    }

    // Create new profile
    const profile = new ConsumerProfile({
      user_id: canonicalUserId,
      primary_email: request.email?.toLowerCase() || '',
      primary_phone: request.phone || '',
      ...request.initial_data,
    });

    // Add to indexes
    this.profiles.set(canonicalUserId, profile);
    if (request.email) {
      this.emailIndex.set(request.email.toLowerCase(), canonicalUserId);
    }
    if (request.phone) {
      this.phoneIndex.set(request.phone, canonicalUserId);
    }

    // Add data source
    profile.addDataSource(request.source);

    // Create graph node
    await this.graphEngine.createConsumerNode(profile.toJSON());

    this.logger.info('Consumer created successfully', { userId: canonicalUserId });
    return profile;
  }

  /**
   * Get consumer by ID
   */
  async getConsumer(userId: string): Promise<ConsumerProfile | null> {
    return this.profiles.get(userId) || null;
  }

  /**
   * Get consumer by email
   */
  async getConsumerByEmail(email: string): Promise<ConsumerProfile | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    if (userId) {
      return this.profiles.get(userId) || null;
    }
    return null;
  }

  /**
   * Get consumer by phone
   */
  async getConsumerByPhone(phone: string): Promise<ConsumerProfile | null> {
    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    const userId = this.phoneIndex.get(normalizedPhone);
    if (userId) {
      return this.profiles.get(userId) || null;
    }
    return null;
  }

  /**
   * Get full consumer 360 profile (aggregated from all sources)
   */
  async getAggregatedProfile(userId: string): Promise<AggregatedProfileResponse | null> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return null;
    }

    // Aggregate data from all modules
    const dataSources: string[] = [profile.toJSON().metadata.data_sources];

    // Get module data
    const [
      walletData,
      browsingData,
      loyaltyData,
      doohData,
      intentData,
    ] = await Promise.all([
      this.walletModule.getWalletSummary(userId),
      this.browsingModule.getBrowsingSummary(userId),
      this.loyaltyModule.getLoyaltySummary(userId),
      this.doohModule.getDOOHSummary(userId),
      this.intentModule.getIntentProfile(userId),
    ]);

    // Update profile with aggregated data
    if (walletData) {
      profile.merge({ wallets: walletData.wallets });
      dataSources.push('wallet_service');
    }
    if (browsingData) {
      profile.merge({ browsing: browsingData });
      dataSources.push('browsing_service');
    }
    if (loyaltyData) {
      profile.merge({ loyalty: loyaltyData });
      dataSources.push('loyalty_service');
    }
    if (doohData) {
      profile.merge({ dooh: doohData });
      dataSources.push('dooh_service');
    }
    if (intentData) {
      profile.merge({ intent: intentData });
      dataSources.push('intent_service');
    }

    // Update metadata
    const updatedProfile = profile.toJSON();
    updatedProfile.metadata.last_aggregated = new Date().toISOString();
    updatedProfile.metadata.data_sources = [...new Set(dataSources.flat())];

    return {
      success: true,
      consumer: updatedProfile,
      last_updated: new Date().toISOString(),
      sources: updatedProfile.metadata.data_sources,
    };
  }

  /**
   * Delete consumer (with GDPR compliance)
   */
  async deleteConsumer(userId: string, reason?: string): Promise<boolean> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return false;
    }

    const profileData = profile.toJSON();

    // Remove from indexes
    if (profileData.primary_email) {
      this.emailIndex.delete(profileData.primary_email.toLowerCase());
    }
    if (profileData.primary_phone) {
      this.phoneIndex.delete(profileData.primary_phone);
    }

    // Delete from all linked apps
    for (const app of profileData.apps) {
      await this.crossPlatformLinker.unlinkApp(userId, app.app);
    }

    // Delete from graph
    await this.graphEngine.deleteConsumerNode(userId);

    // Remove from storage
    this.profiles.delete(userId);

    this.logger.info('Consumer deleted', { userId, reason });
    return true;
  }

  // ============================================
  // IDENTITY LINKING
  // ============================================

  /**
   * Link account to existing consumer
   */
  async linkAccount(request: LinkAccountRequest): Promise<ResolutionResult> {
    this.logger.info('Linking account', { userId: request.user_id, linkType: request.link_type });

    const profile = this.profiles.get(request.user_id);
    if (!profile) {
      throw new Error('Consumer not found');
    }

    const signal: IdentitySignal = {
      type: request.link_type === 'email' ? 'email' :
        request.link_type === 'phone' ? 'phone' :
          request.link_type === 'device' ? 'device_id' : 'device_id',
      value: request.link_value,
      source: 'account_link',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
    };

    const result = await this.identityResolver.processSignal(signal);

    // Update profile indexes
    if (request.link_type === 'email') {
      this.emailIndex.set(request.link_value.toLowerCase(), request.user_id);
      profile.setIdentity(request.link_value, undefined);
    } else if (request.link_type === 'phone') {
      this.phoneIndex.set(request.link_value.replace(/[^\d+]/g, ''), request.user_id);
      profile.setIdentity(undefined, request.link_value);
    } else if (request.link_type === 'device') {
      profile.addDevice({
        device_id: request.link_value,
        type: 'web',
        primary: false,
        trust_score: 0.5,
      });
    }

    return result;
  }

  /**
   * Link consumer across platforms
   */
  async linkPlatform(
    userId: string,
    sourceApp: AppType,
    targetApp: AppType,
    targetUserId: string
  ): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new Error('Consumer not found');
    }

    // Link in cross-platform linker
    await this.crossPlatformLinker.linkApps(userId, sourceApp, targetApp, targetUserId);

    // Update profile
    profile.linkApp(targetApp, targetUserId);

    // Create graph relationship
    await this.graphEngine.createPlatformLink(userId, sourceApp, targetApp, targetUserId);

    this.logger.info('Platforms linked', { userId, sourceApp, targetApp });
  }

  // ============================================
  // DEVICE MANAGEMENT
  // ============================================

  /**
   * Resolve device to consumer
   */
  async resolveDevice(
    deviceId: string,
    signals: IdentitySignal[]
  ): Promise<{ userId: string | null; confidence: number }> {
    return this.deviceResolver.resolve(deviceId, signals);
  }

  /**
   * Link device to consumer
   */
  async linkDevice(
    userId: string,
    deviceId: string,
    deviceType: 'ios' | 'android' | 'web' | 'tablet' | 'kiosk',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new Error('Consumer not found');
    }

    profile.addDevice({
      device_id: deviceId,
      type: deviceType,
      primary: metadata?.primary ?? false,
      trust_score: metadata?.trust_score ?? 0.5,
      platform: metadata?.platform,
      app_version: metadata?.app_version,
    });

    // Update device resolver
    await this.deviceResolver.linkDevice(userId, deviceId);

    // Create graph relationship
    await this.graphEngine.createDeviceLink(userId, deviceId, deviceType);

    this.logger.info('Device linked', { userId, deviceId, deviceType });
  }

  // ============================================
  // GRAPH OPERATIONS
  // ============================================

  /**
   * Get consumer's relationship graph
   */
  async getRelationshipGraph(userId: string): Promise<unknown> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new Error('Consumer not found');
    }

    return this.graphEngine.getConsumerGraph(userId);
  }

  /**
   * Find related consumers (same household, etc.)
   */
  async findRelatedConsumers(
    userId: string,
    relationshipType?: string
  ): Promise<string[]> {
    return this.graphEngine.findRelatedConsumers(userId, relationshipType);
  }

  /**
   * Get consumer network insights
   */
  async getNetworkInsights(userId: string): Promise<{
    connections: number;
    sharedDevices: number;
    sharedHousehold: number;
    influence: number;
  }> {
    const graph = await this.getRelationshipGraph(userId);
    const profile = this.profiles.get(userId);

    return {
      connections: graph?.relationships?.length || 0,
      sharedDevices: profile?.toJSON().devices.length || 0,
      sharedHousehold: await this.graphEngine.countRelatedByType(userId, 'household'),
      influence: await this.calculateInfluenceScore(userId),
    };
  }

  private async calculateInfluenceScore(userId: string): Promise<number> {
    // Base influence on loyalty tier
    const profile = this.profiles.get(userId);
    if (!profile) return 0;

    const tierScores = { bronze: 0.2, silver: 0.4, gold: 0.6, platinum: 0.8, vip: 1.0 };
    const tierScore = tierScores[profile.toJSON().loyalty.tier] || 0.2;

    // Adjust by referral count
    const referralBonus = Math.min(0.2, profile.toJSON().loyalty.referral_count * 0.02);

    // Adjust by transaction volume
    const avgOrderValue = profile.toJSON().transactions.avg_order_value;
    const volumeBonus = Math.min(0.1, avgOrderValue / 10000);

    return Math.min(1, tierScore + referralBonus + volumeBonus);
  }

  // ============================================
  // MODULE DELEGATION
  // ============================================

  getWalletModule(): WalletModule {
    return this.walletModule;
  }

  getBrowsingModule(): BrowsingModule {
    return this.browsingModule;
  }

  getLoyaltyModule(): LoyaltyModule {
    return this.loyaltyModule;
  }

  getPaymentModule(): PaymentModule {
    return this.paymentModule;
  }

  getDOOHModule(): DOOHModule {
    return this.doohModule;
  }

  getReferralModule(): ReferralModule {
    return this.referralModule;
  }

  getHotelModule(): HotelModule {
    return this.hotelModule;
  }

  getIntentModule(): IntentModule {
    return this.intentModule;
  }

  getIdentityResolver(): IdentityResolver {
    return this.identityResolver;
  }

  getGraphEngine(): GraphEngine {
    return this.graphEngine;
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Merge two consumer profiles
   */
  async mergeConsumers(
    sourceUserId: string,
    targetUserId: string,
    preserveSource: boolean = false
  ): Promise<ConsumerProfile> {
    this.logger.info('Merging consumers', { sourceUserId, targetUserId });

    const sourceProfile = this.profiles.get(sourceUserId);
    const targetProfile = this.profiles.get(targetUserId);

    if (!sourceProfile || !targetProfile) {
      throw new Error('One or both consumers not found');
    }

    // Merge data
    const sourceData = sourceProfile.toJSON();
    const mergedProfile = ConsumerProfile.fromJSON({
      ...targetProfile.toJSON(),
      // Merge devices
      devices: [
        ...targetProfile.toJSON().devices,
        ...sourceData.devices.filter(
          (d) => !targetProfile.toJSON().devices.some((td) => td.device_id === d.device_id)
        ),
      ],
      // Merge apps
      apps: [
        ...targetProfile.toJSON().apps,
        ...sourceData.apps.filter(
          (a) => !targetProfile.toJSON().apps.some((ta) => ta.app === a.app)
        ),
      ],
      // Merge wallets
      wallets: targetProfile.toJSON().wallets.map((w) => {
        const sourceWallet = sourceData.wallets.find((sw) => sw.type === w.type);
        if (sourceWallet) {
          return { ...w, balance: w.balance + sourceWallet.balance };
        }
        return w;
      }),
      // Merge loyalty points
      loyalty: {
        ...targetProfile.toJSON().loyalty,
        points_balance:
          targetProfile.toJSON().loyalty.points_balance +
          sourceData.loyalty.points_balance,
        lifetime_points:
          targetProfile.toJSON().loyalty.lifetime_points + sourceData.loyalty.lifetime_points,
        referral_count:
          targetProfile.toJSON().loyalty.referral_count + sourceData.loyalty.referral_count,
      },
      // Merge transactions
      transactions: {
        ...targetProfile.toJSON().transactions,
        total_orders:
          targetProfile.toJSON().transactions.total_orders + sourceData.transactions.total_orders,
        total_spent: targetProfile.toJSON().transactions.total_spent + sourceData.transactions.total_spent,
        avg_order_value:
          (targetProfile.toJSON().transactions.total_spent + sourceData.transactions.total_spent) /
          (targetProfile.toJSON().transactions.total_orders + sourceData.transactions.total_orders),
      },
      // Merge data sources
      metadata: {
        ...targetProfile.toJSON().metadata,
        data_sources: [
          ...new Set([
            ...targetProfile.toJSON().metadata.data_sources,
            ...sourceData.metadata.data_sources,
          ]),
        ],
      },
    });

    // Update indexes
    if (sourceData.primary_email) {
      this.emailIndex.delete(sourceData.primary_email.toLowerCase());
      if (!mergedProfile.toJSON().primary_email) {
        mergedProfile.setIdentity(sourceData.primary_email, undefined);
      }
    }
    if (sourceData.primary_phone) {
      this.phoneIndex.delete(sourceData.primary_phone);
      if (!mergedProfile.toJSON().primary_phone) {
        mergedProfile.setIdentity(undefined, sourceData.primary_phone);
      }
    }

    if (preserveSource) {
      // Mark source as merged but keep minimal record
      sourceProfile.merge({
        metadata: {
          ...sourceData.metadata,
          segment_tags: ['merged'],
        },
      });
    } else {
      // Delete source profile
      await this.deleteConsumer(sourceUserId, 'Merged into another profile');
    }

    // Update target profile
    this.profiles.set(targetUserId, mergedProfile);

    // Update graph
    await this.graphEngine.mergeConsumerNodes(sourceUserId, targetUserId);

    this.logger.info('Consumers merged', {
      targetUserId,
      devicesMerged: sourceData.devices.length,
      appsMerged: sourceData.apps.length,
    });

    return mergedProfile;
  }

  /**
   * Search consumers by criteria
   */
  async searchConsumers(criteria: {
    email?: string;
    phone?: string;
    tier?: string;
    minSpent?: number;
    maxSpent?: number;
    segment?: string;
  }): Promise<Consumer360[]> {
    const results: Consumer360[] = [];

    for (const profile of this.profiles.values()) {
      const data = profile.toJSON();
      let matches = true;

      if (criteria.email && !data.primary_email?.toLowerCase().includes(criteria.email.toLowerCase())) {
        matches = false;
      }
      if (criteria.phone && !data.primary_phone?.includes(criteria.phone)) {
        matches = false;
      }
      if (criteria.tier && data.loyalty.tier !== criteria.tier) {
        matches = false;
      }
      if (criteria.minSpent && data.transactions.total_spent < criteria.minSpent) {
        matches = false;
      }
      if (criteria.maxSpent && data.transactions.total_spent > criteria.maxSpent) {
        matches = false;
      }
      if (criteria.segment && !data.metadata.segment_tags.includes(criteria.segment)) {
        matches = false;
      }

      if (matches) {
        results.push(data);
      }
    }

    return results;
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get consumer statistics
   */
  async getStatistics(): Promise<{
    totalConsumers: number;
    byTier: Record<string, number>;
    avgLifetimeValue: number;
    avgOrders: number;
    topSegments: string[];
  }> {
    const stats = {
      totalConsumers: this.profiles.size,
      byTier: {} as Record<string, number>,
      avgLifetimeValue: 0,
      avgOrders: 0,
      topSegments: [] as string[],
    };

    const segmentCounts: Record<string, number> = {};
    let totalSpent = 0;
    let totalOrders = 0;

    for (const profile of this.profiles.values()) {
      const data = profile.toJSON();

      // Count tiers
      stats.byTier[data.loyalty.tier] = (stats.byTier[data.loyalty.tier] || 0) + 1;

      // Sum metrics
      totalSpent += data.transactions.total_spent;
      totalOrders += data.transactions.total_orders;

      // Count segments
      for (const segment of data.metadata.segment_tags) {
        segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
      }
    }

    // Calculate averages
    if (this.profiles.size > 0) {
      stats.avgLifetimeValue = totalSpent / this.profiles.size;
      stats.avgOrders = totalOrders / this.profiles.size;
    }

    // Get top segments
    stats.topSegments = Object.entries(segmentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([segment]) => segment);

    return stats;
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  async save(): Promise<string> {
    return JSON.stringify({
      profiles: Array.from(this.profiles.entries()).map(([id, p]) => [id, p.toJSON()]),
      emailIndex: Array.from(this.emailIndex.entries()),
      phoneIndex: Array.from(this.phoneIndex.entries()),
    });
  }

  async load(data: string): Promise<void> {
    const parsed = JSON.parse(data);

    this.profiles = new Map(
      parsed.profiles.map(([id, data]: [string, Consumer360]) => [id, ConsumerProfile.fromJSON(data)])
    );

    this.emailIndex = new Map(parsed.emailIndex);
    this.phoneIndex = new Map(parsed.phoneIndex);
  }
}

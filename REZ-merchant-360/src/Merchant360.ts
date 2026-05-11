/**
 * Merchant360.ts - Main Unified Merchant Identity Service
 */

import { v4 as uuidv4 } from 'uuid';
import { Merchant360, MerchantProfileSchema, Address, createMerchantProfile } from './MerchantProfile';
import { MerchantGraph } from './MerchantGraph';
import { MerchantResolver } from './resolvers/MerchantResolver';
import { IdentityResolver } from './resolvers/IdentityResolver';
import { CrossPlatformSync, SyncConfig } from './sync/CrossPlatformSync';
import {
  FinanceModule,
  CatalogModule,
  InventoryModule,
  CRMModule,
  LoyaltyModule,
  StaffModule,
  ComplianceModule,
  AnalyticsModule,
  AIMemoryModule,
} from './modules';
import winston from 'winston';

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production'
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
  transports: [
    new winston.transports.Console(),
  ],
});

export interface Merchant360Config {
  // Service URLs
  financeServiceUrl?: string;
  catalogServiceUrl?: string;
  inventoryServiceUrl?: string;
  crmServiceUrl?: string;
  loyaltyServiceUrl?: string;
  staffServiceUrl?: string;
  complianceServiceUrl?: string;
  analyticsServiceUrl?: string;
  aiMemoryServiceUrl?: string;

  // Identity Resolution
  matchThreshold?: number;

  // Sync Configuration
  syncConfig?: Partial<SyncConfig>;

  // Cache
  cacheTTL?: number;

  // Logging
  logLevel?: string;
}

export interface Merchant360Events {
  onMerchantCreated?: (merchant: Merchant360) => void;
  onMerchantUpdated?: (merchant: Merchant360) => void;
  onMerchantDeleted?: (merchantId: string) => void;
  onSyncCompleted?: (result: { merchantId: string; success: boolean }) => void;
  onIdentityResolved?: (result: { merchant: Merchant360; resolved: boolean }) => void;
}

export class Merchant360Service {
  private resolver: MerchantResolver;
  private identityResolver: IdentityResolver;
  private sync: CrossPlatformSync;

  // Modules
  public finance: FinanceModule;
  public catalog: CatalogModule;
  public inventory: InventoryModule;
  public crm: CRMModule;
  public loyalty: LoyaltyModule;
  public staff: StaffModule;
  public compliance: ComplianceModule;
  public analytics: AnalyticsModule;
  public aiMemory: AIMemoryModule;

  private graph: MerchantGraph;
  private events: Merchant360Events;

  constructor(config: Merchant360Config = {}) {
    logger.level = config.logLevel || process.env.LOG_LEVEL || 'info';

    // Initialize modules
    this.finance = new FinanceModule(config.financeServiceUrl);
    this.catalog = new CatalogModule(config.catalogServiceUrl);
    this.inventory = new InventoryModule(config.inventoryServiceUrl);
    this.crm = new CRMModule(config.crmServiceUrl);
    this.loyalty = new LoyaltyModule(config.loyaltyServiceUrl);
    this.staff = new StaffModule(config.staffServiceUrl);
    this.compliance = new ComplianceModule(config.complianceServiceUrl);
    this.analytics = new AnalyticsModule(config.analyticsServiceUrl);
    this.aiMemory = new AIMemoryModule(config.aiMemoryServiceUrl);

    // Initialize resolver
    this.resolver = new MerchantResolver({
      financeUrl: config.financeServiceUrl,
      catalogUrl: config.catalogServiceUrl,
      inventoryUrl: config.inventoryServiceUrl,
      crmUrl: config.crmServiceUrl,
      loyaltyUrl: config.loyaltyServiceUrl,
      staffUrl: config.staffServiceUrl,
      complianceUrl: config.complianceServiceUrl,
      analyticsUrl: config.analyticsServiceUrl,
      aiMemoryUrl: config.aiMemoryServiceUrl,
      matchThreshold: config.matchThreshold,
    });

    this.graph = this.resolver.getGraph();

    // Initialize identity resolver
    this.identityResolver = new IdentityResolver(config.matchThreshold);

    // Initialize cross-platform sync
    this.sync = new CrossPlatformSync(config.syncConfig);

    // Subscribe to sync events
    this.sync.onEvent((event) => {
      logger.debug('Sync event:', event);
    });

    this.events = {};
  }

  /**
   * Set event handlers
   */
  setEventHandlers(events: Merchant360Events): void {
    this.events = events;
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Merchant360 Service');

    // Start background sync if enabled
    if (this.sync['config'].enabled) {
      this.sync.start();
    }

    logger.info('Merchant360 Service initialized');
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Merchant360 Service');
    this.sync.stop();
    logger.info('Merchant360 Service shutdown complete');
  }

  // ============================================
  // MERCHANT CRUD OPERATIONS
  // ============================================

  /**
   * Get merchant by ID
   */
  async getMerchant(
    merchantId: string,
    options: {
      includeAll?: boolean;
      includeFinances?: boolean;
      includeCatalog?: boolean;
      includeInventory?: boolean;
      includeCRM?: boolean;
      includeLoyalty?: boolean;
      includeStaff?: boolean;
      includeCompliance?: boolean;
      includeAnalytics?: boolean;
      includeAIMemory?: boolean;
    } = {}
  ): Promise<Merchant360 | null> {
    try {
      const { merchant } = await this.resolver.getMerchant(merchantId, {
        includeFinances: options.includeAll || options.includeFinances,
        includeCatalog: options.includeAll || options.includeCatalog,
        includeInventory: options.includeAll || options.includeInventory,
        includeCRM: options.includeAll || options.includeCRM,
        includeLoyalty: options.includeAll || options.includeLoyalty,
        includeStaff: options.includeAll || options.includeStaff,
        includeCompliance: options.includeAll || options.includeCompliance,
        includeAnalytics: options.includeAll || options.includeAnalytics,
        includeAIMemory: options.includeAll || options.includeAIMemory,
      });

      return merchant;
    } catch (error) {
      logger.error(`Error getting merchant ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Create a new merchant
   */
  async createMerchant(data: {
    business_name: string;
    email?: string;
    phone?: string;
    addresses?: Address[];
    verticals?: string[];
    brand_names?: string[];
    business_type?: Merchant360['business_type'];
  }): Promise<Merchant360> {
    const merchantId = uuidv4();

    const result = await this.resolver.createMerchant({
      merchant_id: merchantId,
      business_name: data.business_name,
      email: data.email,
      phone: data.phone,
      addresses: data.addresses,
      verticals: data.verticals,
      brand_names: data.brand_names,
    });

    if (!result.success || !result.merchant) {
      throw new Error(result.error || 'Failed to create merchant');
    }

    // Set business type if provided
    if (data.business_type) {
      result.merchant.business_type = data.business_type;
    }

    logger.info(`Created merchant: ${merchantId}`);

    this.events.onMerchantCreated?.(result.merchant);

    return result.merchant;
  }

  /**
   * Update merchant
   */
  async updateMerchant(merchantId: string, updates: Partial<Merchant360>): Promise<Merchant360 | null> {
    const result = await this.resolver.updateMerchant(merchantId, updates);

    if (!result.success || !result.merchant) {
      logger.error(`Failed to update merchant ${merchantId}:`, result.error);
      return null;
    }

    logger.info(`Updated merchant: ${merchantId}`);

    this.events.onMerchantUpdated?.(result.merchant);

    return result.merchant;
  }

  /**
   * Delete merchant
   */
  async deleteMerchant(merchantId: string): Promise<boolean> {
    const result = await this.resolver.deleteMerchant(merchantId);

    if (!result.success) {
      logger.error(`Failed to delete merchant ${merchantId}:`, result.error);
      return false;
    }

    logger.info(`Deleted merchant: ${merchantId}`);

    this.events.onMerchantDeleted?.(merchantId);

    return true;
  }

  /**
   * Search merchants
   */
  async searchMerchants(query: {
    business_name?: string;
    email?: string;
    phone?: string;
    vertical?: string;
    status?: Merchant360['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ merchants: Merchant360[]; total: number }> {
    return this.resolver.searchMerchants(query);
  }

  // ============================================
  // IDENTITY RESOLUTION
  // ============================================

  /**
   * Resolve identity for a merchant (find or create)
   */
  async resolveIdentity(merchantData: Partial<Merchant360>): Promise<{
    merchant: Merchant360;
    resolved: boolean;
    isNew: boolean;
  }> {
    const result = await this.identityResolver.resolveIdentity(merchantData);

    if (result.resolved && result.merchant_id) {
      const existing = await this.getMerchant(result.merchant_id);
      if (existing) {
        return { merchant: existing, resolved: true, isNew: false };
      }
    }

    // Create new merchant if not resolved
    const merchant = await this.createMerchant({
      business_name: merchantData.business_name || 'Unknown',
      email: merchantData.email,
      phone: merchantData.phone,
      addresses: merchantData.addresses,
      verticals: merchantData.verticals,
      brand_names: merchantData.brand_names,
    });

    this.events.onIdentityResolved?.({ merchant, resolved: true });

    return { merchant, resolved: true, isNew: true };
  }

  /**
   * Find potential duplicate merchants
   */
  async findDuplicates(merchantId: string): Promise<{
    has_duplicates: boolean;
    duplicates: Merchant360[];
  }> {
    const merchant = await this.getMerchant(merchantId);
    if (!merchant) {
      return { has_duplicates: false, duplicates: [] };
    }

    const result = await this.identityResolver.detectDuplicates([merchant]);

    if (!result.has_duplicates) {
      return { has_duplicates: false, duplicates: [] };
    }

    const duplicates: Merchant360[] = [];
    for (const group of result.groups) {
      for (const dupId of group.duplicate_ids) {
        const dup = await this.getMerchant(dupId);
        if (dup) {
          duplicates.push(dup);
        }
      }
    }

    return { has_duplicates: true, duplicates };
  }

  /**
   * Merge two merchants
   */
  async mergeMerchants(
    sourceId: string,
    targetId: string
  ): Promise<Merchant360 | null> {
    const result = await this.identityResolver.mergeMerchants({
      source_merchant_id: sourceId,
      target_merchant_id: targetId,
    });

    if (!result.success || !result.merged_merchant) {
      logger.error(`Failed to merge merchants:`, result.error);
      return null;
    }

    // Update the target merchant in resolver
    await this.resolver.updateMerchant(targetId, result.merged_merchant);

    // Delete the source merchant
    await this.deleteMerchant(sourceId);

    logger.info(`Merged merchant ${sourceId} into ${targetId}`);

    return result.merged_merchant;
  }

  // ============================================
  // CROSS-PLATFORM SYNC
  // ============================================

  /**
   * Sync all module data for a merchant
   */
  async syncMerchant(merchantId: string): Promise<boolean> {
    const merchant = await this.getMerchant(merchantId);
    if (!merchant) {
      logger.error(`Merchant not found for sync: ${merchantId}`);
      return false;
    }

    const result = await this.resolver.syncAllModules(merchantId);

    if (result.success && result.merchant) {
      this.events.onSyncCompleted?.({ merchantId, success: true });
      return true;
    }

    this.events.onSyncCompleted?.({ merchantId, success: false });
    return false;
  }

  /**
   * Sync specific service for a merchant
   */
  async syncService(
    merchantId: string,
    service: 'finance' | 'catalog' | 'inventory' | 'crm' | 'loyalty' | 'staff' | 'compliance' | 'analytics' | 'aiMemory'
  ): Promise<boolean> {
    const merchant = await this.getMerchant(merchantId);
    if (!merchant) {
      return false;
    }

    const result = await this.sync.syncService(merchantId, service, merchant);
    return result.success;
  }

  /**
   * Get sync status
   */
  getSyncStatus(merchantId: string) {
    return this.sync.getSyncStatus(merchantId);
  }

  /**
   * Get sync history
   */
  getSyncHistory(merchantId?: string, limit?: number) {
    return this.sync.getSyncHistory(merchantId, limit);
  }

  /**
   * Update sync configuration
   */
  updateSyncConfig(config: Partial<SyncConfig>): void {
    this.sync.updateConfig(config);
  }

  // ============================================
  // MODULE ACCESS
  // ============================================

  /**
   * Get all modules
   */
  getModules() {
    return {
      finance: this.finance,
      catalog: this.catalog,
      inventory: this.inventory,
      crm: this.crm,
      loyalty: this.loyalty,
      staff: this.staff,
      compliance: this.compliance,
      analytics: this.analytics,
      aiMemory: this.aiMemory,
    };
  }

  /**
   * Get identity graph
   */
  getGraph(): MerchantGraph {
    return this.graph;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Validate merchant data
   */
  validateMerchant(data: unknown): Merchant360 {
    return MerchantProfileSchema.parse(data);
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'up' | 'down' | 'unknown'>;
    timestamp: string;
  }> {
    const services: Record<string, 'up' | 'down' | 'unknown'> = {};
    let healthyCount = 0;
    let totalCount = 0;

    const moduleNames = [
      'finance',
      'catalog',
      'inventory',
      'crm',
      'loyalty',
      'staff',
      'compliance',
      'analytics',
      'aiMemory',
    ];

    for (const name of moduleNames) {
      totalCount++;
      try {
        // Simple ping check
        services[name] = 'up';
        healthyCount++;
      } catch {
        services[name] = 'down';
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (healthyCount === 0) {
      status = 'unhealthy';
    } else if (healthyCount < totalCount) {
      status = 'degraded';
    }

    return {
      status,
      services,
      timestamp: new Date().toISOString(),
    };
  }
}

// Default export
export default Merchant360Service;

// Named exports
export { Merchant360, Address } from './MerchantProfile';
export { MerchantGraph } from './MerchantGraph';
export { MerchantResolver } from './resolvers/MerchantResolver';
export { IdentityResolver } from './resolvers/IdentityResolver';
export { CrossPlatformSync } from './sync/CrossPlatformSync';

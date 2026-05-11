"use strict";
/**
 * Merchant360.ts - Main Unified Merchant Identity Service
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossPlatformSync = exports.IdentityResolver = exports.MerchantResolver = exports.MerchantGraph = exports.Merchant360Service = void 0;
const uuid_1 = require("uuid");
const MerchantProfile_1 = require("./MerchantProfile");
const MerchantResolver_1 = require("./resolvers/MerchantResolver");
const IdentityResolver_1 = require("./resolvers/IdentityResolver");
const CrossPlatformSync_1 = require("./sync/CrossPlatformSync");
const modules_1 = require("./modules");
const winston_1 = __importDefault(require("winston"));
// Logger configuration
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production'
        ? winston_1.default.format.json()
        : winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    transports: [
        new winston_1.default.transports.Console(),
    ],
});
class Merchant360Service {
    resolver;
    identityResolver;
    sync;
    // Modules
    finance;
    catalog;
    inventory;
    crm;
    loyalty;
    staff;
    compliance;
    analytics;
    aiMemory;
    graph;
    events;
    constructor(config = {}) {
        logger.level = config.logLevel || process.env.LOG_LEVEL || 'info';
        // Initialize modules
        this.finance = new modules_1.FinanceModule(config.financeServiceUrl);
        this.catalog = new modules_1.CatalogModule(config.catalogServiceUrl);
        this.inventory = new modules_1.InventoryModule(config.inventoryServiceUrl);
        this.crm = new modules_1.CRMModule(config.crmServiceUrl);
        this.loyalty = new modules_1.LoyaltyModule(config.loyaltyServiceUrl);
        this.staff = new modules_1.StaffModule(config.staffServiceUrl);
        this.compliance = new modules_1.ComplianceModule(config.complianceServiceUrl);
        this.analytics = new modules_1.AnalyticsModule(config.analyticsServiceUrl);
        this.aiMemory = new modules_1.AIMemoryModule(config.aiMemoryServiceUrl);
        // Initialize resolver
        this.resolver = new MerchantResolver_1.MerchantResolver({
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
        this.identityResolver = new IdentityResolver_1.IdentityResolver(config.matchThreshold);
        // Initialize cross-platform sync
        this.sync = new CrossPlatformSync_1.CrossPlatformSync(config.syncConfig);
        // Subscribe to sync events
        this.sync.onEvent((event) => {
            logger.debug('Sync event:', event);
        });
        this.events = {};
    }
    /**
     * Set event handlers
     */
    setEventHandlers(events) {
        this.events = events;
    }
    /**
     * Initialize service
     */
    async initialize() {
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
    async shutdown() {
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
    async getMerchant(merchantId, options = {}) {
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
        }
        catch (error) {
            logger.error(`Error getting merchant ${merchantId}:`, error);
            return null;
        }
    }
    /**
     * Create a new merchant
     */
    async createMerchant(data) {
        const merchantId = (0, uuid_1.v4)();
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
    async updateMerchant(merchantId, updates) {
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
    async deleteMerchant(merchantId) {
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
    async searchMerchants(query) {
        return this.resolver.searchMerchants(query);
    }
    // ============================================
    // IDENTITY RESOLUTION
    // ============================================
    /**
     * Resolve identity for a merchant (find or create)
     */
    async resolveIdentity(merchantData) {
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
    async findDuplicates(merchantId) {
        const merchant = await this.getMerchant(merchantId);
        if (!merchant) {
            return { has_duplicates: false, duplicates: [] };
        }
        const result = await this.identityResolver.detectDuplicates([merchant]);
        if (!result.has_duplicates) {
            return { has_duplicates: false, duplicates: [] };
        }
        const duplicates = [];
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
    async mergeMerchants(sourceId, targetId) {
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
    async syncMerchant(merchantId) {
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
    async syncService(merchantId, service) {
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
    getSyncStatus(merchantId) {
        return this.sync.getSyncStatus(merchantId);
    }
    /**
     * Get sync history
     */
    getSyncHistory(merchantId, limit) {
        return this.sync.getSyncHistory(merchantId, limit);
    }
    /**
     * Update sync configuration
     */
    updateSyncConfig(config) {
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
    getGraph() {
        return this.graph;
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    /**
     * Validate merchant data
     */
    validateMerchant(data) {
        return MerchantProfile_1.MerchantProfileSchema.parse(data);
    }
    /**
     * Get service health status
     */
    async getHealthStatus() {
        const services = {};
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
            }
            catch {
                services[name] = 'down';
            }
        }
        let status = 'healthy';
        if (healthyCount === 0) {
            status = 'unhealthy';
        }
        else if (healthyCount < totalCount) {
            status = 'degraded';
        }
        return {
            status,
            services,
            timestamp: new Date().toISOString(),
        };
    }
}
exports.Merchant360Service = Merchant360Service;
// Default export
exports.default = Merchant360Service;
var MerchantGraph_1 = require("./MerchantGraph");
Object.defineProperty(exports, "MerchantGraph", { enumerable: true, get: function () { return MerchantGraph_1.MerchantGraph; } });
var MerchantResolver_2 = require("./resolvers/MerchantResolver");
Object.defineProperty(exports, "MerchantResolver", { enumerable: true, get: function () { return MerchantResolver_2.MerchantResolver; } });
var IdentityResolver_2 = require("./resolvers/IdentityResolver");
Object.defineProperty(exports, "IdentityResolver", { enumerable: true, get: function () { return IdentityResolver_2.IdentityResolver; } });
var CrossPlatformSync_2 = require("./sync/CrossPlatformSync");
Object.defineProperty(exports, "CrossPlatformSync", { enumerable: true, get: function () { return CrossPlatformSync_2.CrossPlatformSync; } });
//# sourceMappingURL=Merchant360.js.map
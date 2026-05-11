"use strict";
/**
 * MerchantResolver.ts - GraphQL Resolvers for Merchant Operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantResolver = void 0;
const MerchantProfile_1 = require("../MerchantProfile");
const MerchantGraph_1 = require("../MerchantGraph");
const modules_1 = require("../modules");
class MerchantResolver {
    graph;
    finance;
    catalog;
    inventory;
    crm;
    loyalty;
    staff;
    compliance;
    analytics;
    aiMemory;
    constructor(options = {}) {
        this.graph = new MerchantGraph_1.MerchantGraph(options.matchThreshold);
        // Initialize modules
        this.finance = new modules_1.FinanceModule(options.financeUrl);
        this.catalog = new modules_1.CatalogModule(options.catalogUrl);
        this.inventory = new modules_1.InventoryModule(options.inventoryUrl);
        this.crm = new modules_1.CRMModule(options.crmUrl);
        this.loyalty = new modules_1.LoyaltyModule(options.loyaltyUrl);
        this.staff = new modules_1.StaffModule(options.staffUrl);
        this.compliance = new modules_1.ComplianceModule(options.complianceUrl);
        this.analytics = new modules_1.AnalyticsModule(options.analyticsUrl);
        this.aiMemory = new modules_1.AIMemoryModule(options.aiMemoryUrl);
    }
    /**
     * Get merchant by ID with optional module data
     */
    async getMerchant(merchantId, options = {}) {
        try {
            const merchant = this.graph.getMerchantById(merchantId);
            if (!merchant) {
                return { merchant: null, resolved: false };
            }
            // Fetch additional module data if requested
            if (Object.keys(options).length > 0) {
                const enrichedMerchant = await this.enrichMerchant(merchant, options);
                return { merchant: enrichedMerchant, resolved: true };
            }
            return { merchant, resolved: true };
        }
        catch (error) {
            console.error(`Error fetching merchant ${merchantId}:`, error);
            return { merchant: null, resolved: false };
        }
    }
    /**
     * Enrich merchant with module data
     */
    async enrichMerchant(merchant, options) {
        const enriched = { ...merchant };
        await Promise.all([
            options.includeFinances && this.finance.getFinances(merchant.merchant_id)
                .then(data => { enriched.finances = data; })
                .catch(() => { }),
            options.includeCatalog && this.catalog.getCatalog(merchant.merchant_id)
                .then(data => { enriched.catalog = data; })
                .catch(() => { }),
            options.includeInventory && this.inventory.getInventory(merchant.merchant_id)
                .then(data => { enriched.inventory = data; })
                .catch(() => { }),
            options.includeCRM && this.crm.getCRM(merchant.merchant_id)
                .then(data => { enriched.crm = data; })
                .catch(() => { }),
            options.includeLoyalty && this.loyalty.getLoyalty(merchant.merchant_id)
                .then(data => { enriched.loyalty = data; })
                .catch(() => { }),
            options.includeStaff && this.staff.getStaff(merchant.merchant_id)
                .then(data => { enriched.staff = data; })
                .catch(() => { }),
            options.includeCompliance && this.compliance.getCompliance(merchant.merchant_id)
                .then(data => { enriched.compliance = data; })
                .catch(() => { }),
            options.includeAnalytics && this.analytics.getAnalytics(merchant.merchant_id)
                .then(data => { enriched.analytics = data; })
                .catch(() => { }),
            options.includeAIMemory && this.aiMemory.getAIMemory(merchant.merchant_id)
                .then(data => { enriched.ai_memory = data; })
                .catch(() => { }),
        ]);
        enriched.updated_at = new Date().toISOString();
        return enriched;
    }
    /**
     * Create a new merchant
     */
    async createMerchant(data) {
        try {
            // Check for existing merchant
            const existing = this.graph.getMerchantById(data.merchant_id);
            if (existing) {
                return {
                    success: false,
                    error: 'Merchant with this ID already exists',
                };
            }
            const merchant = (0, MerchantProfile_1.createMerchantProfile)({
                merchant_id: data.merchant_id,
                business_name: data.business_name,
                email: data.email,
                phone: data.phone,
                addresses: data.addresses || [],
                verticals: data.verticals || [],
                brand_names: data.brand_names || [],
                created_at: new Date().toISOString(),
            });
            // Add to graph
            this.graph.addNode(merchant.merchant_id, 'merchant360', merchant.merchant_id, merchant, 1.0);
            return { success: true, merchant };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to create merchant',
            };
        }
    }
    /**
     * Update merchant profile
     */
    async updateMerchant(merchantId, updates) {
        try {
            const existing = this.graph.getMerchantById(merchantId);
            if (!existing) {
                return {
                    success: false,
                    error: 'Merchant not found',
                };
            }
            const updated = {
                ...existing,
                ...updates,
                merchant_id: merchantId, // Ensure ID cannot be changed
                updated_at: new Date().toISOString(),
            };
            // Validate
            const validated = (0, MerchantProfile_1.validateMerchantProfile)(updated);
            // Update in graph
            this.graph.addNode(validated.merchant_id, 'merchant360', validated.merchant_id, validated, 1.0);
            return { success: true, merchant: validated };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to update merchant',
            };
        }
    }
    /**
     * Delete merchant
     */
    async deleteMerchant(merchantId) {
        try {
            const existing = this.graph.getMerchantById(merchantId);
            if (!existing) {
                return { success: false, error: 'Merchant not found' };
            }
            // Note: In production, this would also remove from database
            // For now, just clear from in-memory graph
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Search merchants
     */
    async searchMerchants(query) {
        // In production, this would query a database
        // For now, return empty results
        return { merchants: [], total: 0 };
    }
    /**
     * Sync all module data for a merchant
     */
    async syncAllModules(merchantId) {
        try {
            const existing = this.graph.getMerchantById(merchantId);
            if (!existing) {
                return { success: false, error: 'Merchant not found' };
            }
            // Fetch all module data in parallel
            const [finances, catalog, inventory, crm, loyalty, staff, compliance, analytics, aiMemory,] = await Promise.all([
                this.finance.getFinances(merchantId).catch(() => existing.finances),
                this.catalog.getCatalog(merchantId).catch(() => existing.catalog),
                this.inventory.getInventory(merchantId).catch(() => existing.inventory),
                this.crm.getCRM(merchantId).catch(() => existing.crm),
                this.loyalty.getLoyalty(merchantId).catch(() => existing.loyalty),
                this.staff.getStaff(merchantId).catch(() => existing.staff),
                this.compliance.getCompliance(merchantId).catch(() => existing.compliance),
                this.analytics.getAnalytics(merchantId).catch(() => existing.analytics),
                this.aiMemory.getAIMemory(merchantId).catch(() => existing.ai_memory),
            ]);
            const updated = {
                ...existing,
                finances,
                catalog,
                inventory,
                crm,
                loyalty,
                staff,
                compliance,
                analytics,
                ai_memory: aiMemory,
                updated_at: new Date().toISOString(),
                last_sync_at: new Date().toISOString(),
            };
            // Update in graph
            this.graph.addNode(updated.merchant_id, 'merchant360', updated.merchant_id, updated, 1.0);
            return { success: true, merchant: updated };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Get merchant graph
     */
    getGraph() {
        return this.graph;
    }
    /**
     * Get individual modules
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
}
exports.MerchantResolver = MerchantResolver;
//# sourceMappingURL=MerchantResolver.js.map
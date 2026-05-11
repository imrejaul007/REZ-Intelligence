"use strict";
/**
 * REZ Merchant 360 - Unified Merchant Identity Service
 *
 * Main entry point for the Merchant360 service
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIMemoryModule = exports.AnalyticsModule = exports.ComplianceModule = exports.StaffModule = exports.LoyaltyModule = exports.CRMModule = exports.InventoryModule = exports.CatalogModule = exports.FinanceModule = exports.CrossPlatformSync = exports.IdentityResolver = exports.MerchantResolver = exports.MerchantGraph = exports.MerchantProfileSchema = exports.validateMerchantProfile = exports.createMerchantProfile = exports.default = exports.Merchant360Service = void 0;
exports.createService = createService;
exports.getService = getService;
exports.resetService = resetService;
require("dotenv/config");
// Re-export main service
var Merchant360_1 = require("./Merchant360");
Object.defineProperty(exports, "Merchant360Service", { enumerable: true, get: function () { return Merchant360_1.Merchant360Service; } });
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(Merchant360_1).default; } });
// Re-export types from MerchantProfile
var MerchantProfile_1 = require("./MerchantProfile");
Object.defineProperty(exports, "createMerchantProfile", { enumerable: true, get: function () { return MerchantProfile_1.createMerchantProfile; } });
Object.defineProperty(exports, "validateMerchantProfile", { enumerable: true, get: function () { return MerchantProfile_1.validateMerchantProfile; } });
Object.defineProperty(exports, "MerchantProfileSchema", { enumerable: true, get: function () { return MerchantProfile_1.MerchantProfileSchema; } });
// Re-export graph types
var MerchantGraph_1 = require("./MerchantGraph");
Object.defineProperty(exports, "MerchantGraph", { enumerable: true, get: function () { return MerchantGraph_1.MerchantGraph; } });
// Re-export resolvers
var resolvers_1 = require("./resolvers");
Object.defineProperty(exports, "MerchantResolver", { enumerable: true, get: function () { return resolvers_1.MerchantResolver; } });
Object.defineProperty(exports, "IdentityResolver", { enumerable: true, get: function () { return resolvers_1.IdentityResolver; } });
// Re-export sync
var CrossPlatformSync_1 = require("./sync/CrossPlatformSync");
Object.defineProperty(exports, "CrossPlatformSync", { enumerable: true, get: function () { return CrossPlatformSync_1.CrossPlatformSync; } });
// Re-export modules
var modules_1 = require("./modules");
Object.defineProperty(exports, "FinanceModule", { enumerable: true, get: function () { return modules_1.FinanceModule; } });
Object.defineProperty(exports, "CatalogModule", { enumerable: true, get: function () { return modules_1.CatalogModule; } });
Object.defineProperty(exports, "InventoryModule", { enumerable: true, get: function () { return modules_1.InventoryModule; } });
Object.defineProperty(exports, "CRMModule", { enumerable: true, get: function () { return modules_1.CRMModule; } });
Object.defineProperty(exports, "LoyaltyModule", { enumerable: true, get: function () { return modules_1.LoyaltyModule; } });
Object.defineProperty(exports, "StaffModule", { enumerable: true, get: function () { return modules_1.StaffModule; } });
Object.defineProperty(exports, "ComplianceModule", { enumerable: true, get: function () { return modules_1.ComplianceModule; } });
Object.defineProperty(exports, "AnalyticsModule", { enumerable: true, get: function () { return modules_1.AnalyticsModule; } });
Object.defineProperty(exports, "AIMemoryModule", { enumerable: true, get: function () { return modules_1.AIMemoryModule; } });
// ============================================
// SERVICE FACTORY
// ============================================
const Merchant360_2 = require("./Merchant360");
let serviceInstance = null;
/**
 * Create or get the singleton service instance
 */
function createService(config) {
    if (!serviceInstance) {
        serviceInstance = new Merchant360_2.Merchant360Service(config);
    }
    return serviceInstance;
}
/**
 * Get the singleton service instance
 */
function getService() {
    if (!serviceInstance) {
        return createService();
    }
    return serviceInstance;
}
/**
 * Reset the singleton instance (for testing)
 */
function resetService() {
    serviceInstance = null;
}
// ============================================
// CLI / STANDALONE MODE
// ============================================
async function main() {
    console.log('Starting REZ Merchant 360 Service...');
    const service = createService();
    // Initialize
    await service.initialize();
    console.log('Service initialized successfully');
    // Handle graceful shutdown
    const shutdown = async () => {
        console.log('Shutting down...');
        await service.shutdown();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
// ============================================
// EXAMPLE USAGE
// ============================================
/**
 * Example: Creating a new merchant
 *
 * ```typescript
 * import { createService, Address } from '@rez-commerce/merchant-360';
 *
 * const service = createService({
 *   matchThreshold: 0.85,
 * });
 *
 * await service.initialize();
 *
 * const address: Address = {
 *   type: 'business',
 *   street: '123 Main St',
 *   city: 'San Francisco',
 *   state: 'CA',
 *   postal_code: '94102',
 *   country: 'US',
 *   is_primary: true,
 * };
 *
 * const merchant = await service.createMerchant({
 *   business_name: 'Acme Coffee Shop',
 *   email: 'contact@acmecoffee.com',
 *   phone: '+1-555-123-4567',
 *   addresses: [address],
 *   verticals: ['restaurant', 'coffee_shop'],
 *   brand_names: ['Acme Coffee'],
 * });
 *
 * console.log('Created merchant:', merchant.merchant_id);
 *
 * // Sync all module data
 * await service.syncMerchant(merchant.merchant_id);
 *
 * // Get enriched merchant data
 * const enriched = await service.getMerchant(merchant.merchant_id, {
 *   includeAll: true,
 * });
 *
 * console.log('Finances:', enriched?.finances);
 * console.log('Customers:', enriched?.crm.total_customers);
 * ```
 */
/**
 * Example: Identity Resolution
 *
 * ```typescript
 * // Find or create merchant based on identity matching
 * const { merchant, resolved, isNew } = await service.resolveIdentity({
 *   business_name: 'Acme Coffee Shop',
 *   email: 'contact@acmecoffee.com',
 *   phone: '+1-555-123-4567',
 * });
 *
 * if (isNew) {
 *   console.log('New merchant created:', merchant.merchant_id);
 * } else {
 *   console.log('Existing merchant found:', merchant.merchant_id);
 * }
 * ```
 */
/**
 * Example: Merchant Merge
 *
 * ```typescript
 * // Find duplicates
 * const { has_duplicates, duplicates } = await service.findDuplicates('merchant-id');
 *
 * if (has_duplicates) {
 *   console.log('Found duplicates:', duplicates.map(d => d.merchant_id));
 *
 *   // Merge into primary
 *   const merged = await service.mergeMerchants(
 *     duplicates[0].merchant_id, // source (will be deleted)
 *     'merchant-id' // target (will be kept)
 *   );
 *
 *   console.log('Merged merchant:', merged?.business_name);
 * }
 * ```
 */
/**
 * Example: Cross-Platform Sync
 *
 * ```typescript
 * // Sync specific service
 * await service.syncService('merchant-id', 'crm');
 *
 * // Get sync status
 * const status = service.getSyncStatus('merchant-id');
 * console.log('Last sync:', status.last_sync_at);
 *
 * // Update sync config
 * service.updateSyncConfig({
 *   intervalMs: 30000, // 30 seconds
 *   services: { crm: true, finance: false },
 * });
 * ```
 */
//# sourceMappingURL=index.js.map
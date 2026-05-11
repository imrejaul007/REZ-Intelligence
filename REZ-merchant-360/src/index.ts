/**
 * REZ Merchant 360 - Unified Merchant Identity Service
 *
 * Main entry point for the Merchant360 service
 */

import 'dotenv/config';

// Re-export main service
export { Merchant360Service, default } from './Merchant360';
export type { Merchant360Config, Merchant360Events } from './Merchant360';

// Re-export types from MerchantProfile
export {
  Merchant360,
  Address,
  BusinessHours,
  Finances,
  Catalog,
  Inventory,
  CRM,
  Loyalty,
  Staff,
  Compliance,
  Analytics,
  AIMemory,
  createMerchantProfile,
  validateMerchantProfile,
  MerchantProfileSchema,
} from './MerchantProfile';

export type {
  Vertical,
  Supplier,
} from './MerchantProfile';

// Re-export graph types
export {
  MerchantGraph,
} from './MerchantGraph';

export type {
  IdentityNode,
  IdentityEdge,
  IdentityResolutionResult,
  MatchCandidate,
  GraphQuery,
} from './MerchantGraph';

// Re-export resolvers
export {
  MerchantResolver,
  IdentityResolver,
} from './resolvers';

export type {
  MerchantQueryOptions,
  MerchantQueryResult,
  MerchantUpdateResult,
  MergeRequest,
  MergeResult,
  IdentityLink,
  DuplicateDetectionResult,
} from './resolvers';

// Re-export sync
export {
  CrossPlatformSync,
} from './sync/CrossPlatformSync';

export type {
  SyncConfig,
  SyncResult,
  SyncStatus,
  SyncEvent,
} from './sync/CrossPlatformSync';

// Re-export modules
export {
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

// Module types
export type {
  Transaction,
  PayoutSummary,
  FinancialSummary,
} from './modules/FinanceModule';

export type {
  Product,
  ProductVariant,
  Category,
  CatalogSummary,
} from './modules/CatalogModule';

export type {
  InventoryItem,
  Warehouse,
  StockAlert,
  InventorySummary,
} from './modules/InventoryModule';

export type {
  Customer,
  Review,
  Feedback,
  CRMSummary,
} from './modules/CRMModule';

export type {
  LoyaltyProgram,
  LoyaltyMember,
  LoyaltyTier,
  LoyaltyTransaction,
  LoyaltySummary,
} from './modules/LoyaltyModule';

export type {
  StaffMember,
  Role,
  StaffSummary,
  TimeEntry,
  Schedule,
} from './modules/StaffModule';

export type {
  KYCVerification,
  TaxInfo,
  License,
  ComplianceCheck,
  ComplianceSummary,
} from './modules/ComplianceModule';

export type {
  SalesMetrics,
  CustomerMetrics,
  ProductMetrics,
  TrafficMetrics,
  TimeSeriesData,
  DashboardData,
  AnalyticsSummary,
} from './modules/AnalyticsModule';

export type {
  MerchantPreference,
  AutomationRule,
  Conversation,
  AIMemorySummary,
  SemanticSearchResult,
} from './modules/AIMemoryModule';

// ============================================
// SERVICE FACTORY
// ============================================

import { Merchant360Service, Merchant360Config } from './Merchant360';

let serviceInstance: Merchant360Service | null = null;

/**
 * Create or get the singleton service instance
 */
export function createService(config?: Merchant360Config): Merchant360Service {
  if (!serviceInstance) {
    serviceInstance = new Merchant360Service(config);
  }
  return serviceInstance;
}

/**
 * Get the singleton service instance
 */
export function getService(): Merchant360Service {
  if (!serviceInstance) {
    return createService();
  }
  return serviceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetService(): void {
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

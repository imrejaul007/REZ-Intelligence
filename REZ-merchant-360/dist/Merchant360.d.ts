/**
 * Merchant360.ts - Main Unified Merchant Identity Service
 */
import { Merchant360, Address } from './MerchantProfile';
import { MerchantGraph } from './MerchantGraph';
import { SyncConfig } from './sync/CrossPlatformSync';
import { FinanceModule, CatalogModule, InventoryModule, CRMModule, LoyaltyModule, StaffModule, ComplianceModule, AnalyticsModule, AIMemoryModule } from './modules';
export interface Merchant360Config {
    financeServiceUrl?: string;
    catalogServiceUrl?: string;
    inventoryServiceUrl?: string;
    crmServiceUrl?: string;
    loyaltyServiceUrl?: string;
    staffServiceUrl?: string;
    complianceServiceUrl?: string;
    analyticsServiceUrl?: string;
    aiMemoryServiceUrl?: string;
    matchThreshold?: number;
    syncConfig?: Partial<SyncConfig>;
    cacheTTL?: number;
    logLevel?: string;
}
export interface Merchant360Events {
    onMerchantCreated?: (merchant: Merchant360) => void;
    onMerchantUpdated?: (merchant: Merchant360) => void;
    onMerchantDeleted?: (merchantId: string) => void;
    onSyncCompleted?: (result: {
        merchantId: string;
        success: boolean;
    }) => void;
    onIdentityResolved?: (result: {
        merchant: Merchant360;
        resolved: boolean;
    }) => void;
}
export declare class Merchant360Service {
    private resolver;
    private identityResolver;
    private sync;
    finance: FinanceModule;
    catalog: CatalogModule;
    inventory: InventoryModule;
    crm: CRMModule;
    loyalty: LoyaltyModule;
    staff: StaffModule;
    compliance: ComplianceModule;
    analytics: AnalyticsModule;
    aiMemory: AIMemoryModule;
    private graph;
    private events;
    constructor(config?: Merchant360Config);
    /**
     * Set event handlers
     */
    setEventHandlers(events: Merchant360Events): void;
    /**
     * Initialize service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
    /**
     * Get merchant by ID
     */
    getMerchant(merchantId: string, options?: {
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
    }): Promise<Merchant360 | null>;
    /**
     * Create a new merchant
     */
    createMerchant(data: {
        business_name: string;
        email?: string;
        phone?: string;
        addresses?: Address[];
        verticals?: string[];
        brand_names?: string[];
        business_type?: Merchant360['business_type'];
    }): Promise<Merchant360>;
    /**
     * Update merchant
     */
    updateMerchant(merchantId: string, updates: Partial<Merchant360>): Promise<Merchant360 | null>;
    /**
     * Delete merchant
     */
    deleteMerchant(merchantId: string): Promise<boolean>;
    /**
     * Search merchants
     */
    searchMerchants(query: {
        business_name?: string;
        email?: string;
        phone?: string;
        vertical?: string;
        status?: Merchant360['status'];
        limit?: number;
        offset?: number;
    }): Promise<{
        merchants: Merchant360[];
        total: number;
    }>;
    /**
     * Resolve identity for a merchant (find or create)
     */
    resolveIdentity(merchantData: Partial<Merchant360>): Promise<{
        merchant: Merchant360;
        resolved: boolean;
        isNew: boolean;
    }>;
    /**
     * Find potential duplicate merchants
     */
    findDuplicates(merchantId: string): Promise<{
        has_duplicates: boolean;
        duplicates: Merchant360[];
    }>;
    /**
     * Merge two merchants
     */
    mergeMerchants(sourceId: string, targetId: string): Promise<Merchant360 | null>;
    /**
     * Sync all module data for a merchant
     */
    syncMerchant(merchantId: string): Promise<boolean>;
    /**
     * Sync specific service for a merchant
     */
    syncService(merchantId: string, service: 'finance' | 'catalog' | 'inventory' | 'crm' | 'loyalty' | 'staff' | 'compliance' | 'analytics' | 'aiMemory'): Promise<boolean>;
    /**
     * Get sync status
     */
    getSyncStatus(merchantId: string): import("./sync/CrossPlatformSync").SyncStatus;
    /**
     * Get sync history
     */
    getSyncHistory(merchantId?: string, limit?: number): import("./sync/CrossPlatformSync").SyncResult[];
    /**
     * Update sync configuration
     */
    updateSyncConfig(config: Partial<SyncConfig>): void;
    /**
     * Get all modules
     */
    getModules(): {
        finance: FinanceModule;
        catalog: CatalogModule;
        inventory: InventoryModule;
        crm: CRMModule;
        loyalty: LoyaltyModule;
        staff: StaffModule;
        compliance: ComplianceModule;
        analytics: AnalyticsModule;
        aiMemory: AIMemoryModule;
    };
    /**
     * Get identity graph
     */
    getGraph(): MerchantGraph;
    /**
     * Validate merchant data
     */
    validateMerchant(data: unknown): Merchant360;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: Record<string, 'up' | 'down' | 'unknown'>;
        timestamp: string;
    }>;
}
export default Merchant360Service;
export { Merchant360, Address } from './MerchantProfile';
export { MerchantGraph } from './MerchantGraph';
export { MerchantResolver } from './resolvers/MerchantResolver';
export { IdentityResolver } from './resolvers/IdentityResolver';
export { CrossPlatformSync } from './sync/CrossPlatformSync';
//# sourceMappingURL=Merchant360.d.ts.map
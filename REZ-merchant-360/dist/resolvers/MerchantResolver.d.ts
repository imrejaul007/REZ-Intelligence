/**
 * MerchantResolver.ts - GraphQL Resolvers for Merchant Operations
 */
import { Merchant360, Address } from '../MerchantProfile';
import { MerchantGraph, IdentityResolutionResult } from '../MerchantGraph';
import { FinanceModule, CatalogModule, InventoryModule, CRMModule, LoyaltyModule, StaffModule, ComplianceModule, AnalyticsModule, AIMemoryModule } from '../modules';
export interface MerchantQueryOptions {
    includeFinances?: boolean;
    includeCatalog?: boolean;
    includeInventory?: boolean;
    includeCRM?: boolean;
    includeLoyalty?: boolean;
    includeStaff?: boolean;
    includeCompliance?: boolean;
    includeAnalytics?: boolean;
    includeAIMemory?: boolean;
}
export interface MerchantQueryResult {
    merchant: Merchant360 | null;
    resolved: boolean;
    resolutionResult?: IdentityResolutionResult;
}
export interface MerchantUpdateResult {
    success: boolean;
    merchant?: Merchant360;
    error?: string;
}
export declare class MerchantResolver {
    private graph;
    private finance;
    private catalog;
    private inventory;
    private crm;
    private loyalty;
    private staff;
    private compliance;
    private analytics;
    private aiMemory;
    constructor(options?: {
        financeUrl?: string;
        catalogUrl?: string;
        inventoryUrl?: string;
        crmUrl?: string;
        loyaltyUrl?: string;
        staffUrl?: string;
        complianceUrl?: string;
        analyticsUrl?: string;
        aiMemoryUrl?: string;
        matchThreshold?: number;
    });
    /**
     * Get merchant by ID with optional module data
     */
    getMerchant(merchantId: string, options?: MerchantQueryOptions): Promise<MerchantQueryResult>;
    /**
     * Enrich merchant with module data
     */
    private enrichMerchant;
    /**
     * Create a new merchant
     */
    createMerchant(data: {
        merchant_id: string;
        business_name: string;
        email?: string;
        phone?: string;
        addresses?: Address[];
        verticals?: string[];
        brand_names?: string[];
    }): Promise<MerchantUpdateResult>;
    /**
     * Update merchant profile
     */
    updateMerchant(merchantId: string, updates: Partial<Merchant360>): Promise<MerchantUpdateResult>;
    /**
     * Delete merchant
     */
    deleteMerchant(merchantId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
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
     * Sync all module data for a merchant
     */
    syncAllModules(merchantId: string): Promise<MerchantUpdateResult>;
    /**
     * Get merchant graph
     */
    getGraph(): MerchantGraph;
    /**
     * Get individual modules
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
}
//# sourceMappingURL=MerchantResolver.d.ts.map
/**
 * CatalogModule.ts - Product Catalog Services for Merchant360
 */
import { Catalog } from '../MerchantProfile';
export interface Product {
    id: string;
    merchant_id: string;
    name: string;
    sku: string;
    description: string;
    price: number;
    compare_at_price?: number;
    category: string;
    tags: string[];
    status: 'active' | 'draft' | 'archived';
    inventory_count: number;
    images: string[];
    variants: ProductVariant[];
    created_at: string;
    updated_at: string;
}
export interface ProductVariant {
    id: string;
    name: string;
    sku: string;
    price: number;
    inventory_count: number;
    options: Record<string, string>;
}
export interface Category {
    id: string;
    name: string;
    slug: string;
    parent_id?: string;
    product_count: number;
    children?: Category[];
}
export interface CatalogSummary {
    total_products: number;
    active_products: number;
    draft_products: number;
    archived_products: number;
    categories: string[];
    avg_product_rating?: number;
    last_product_update?: string;
}
export declare class CatalogModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get catalog summary for a merchant
     */
    getCatalog(merchantId: string): Promise<Catalog>;
    /**
     * Get detailed catalog summary
     */
    getCatalogSummary(merchantId: string): Promise<CatalogSummary>;
    /**
     * Get all products for a merchant
     */
    getProducts(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        status?: Product['status'];
        category?: string;
        search?: string;
        sort_by?: 'name' | 'price' | 'created_at' | 'updated_at';
        sort_order?: 'asc' | 'desc';
    }): Promise<Product[]>;
    /**
     * Get single product by ID
     */
    getProduct(merchantId: string, productId: string): Promise<Product | null>;
    /**
     * Create a new product
     */
    createProduct(merchantId: string, product: Partial<Product>): Promise<Product>;
    /**
     * Update a product
     */
    updateProduct(merchantId: string, productId: string, updates: Partial<Product>): Promise<Product>;
    /**
     * Delete a product
     */
    deleteProduct(merchantId: string, productId: string): Promise<boolean>;
    /**
     * Get all categories
     */
    getCategories(merchantId: string): Promise<Category[]>;
    /**
     * Create a new category
     */
    createCategory(merchantId: string, category: Partial<Category>): Promise<Category>;
    /**
     * Bulk update product status
     */
    bulkUpdateStatus(merchantId: string, productIds: string[], status: Product['status']): Promise<{
        updated: number;
        failed: number;
    }>;
    /**
     * Sync catalog from external source
     */
    syncCatalog(merchantId: string, sourceData: Partial<Catalog>): Promise<Catalog>;
    private getDefaultCatalog;
    private getDefaultCatalogSummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=CatalogModule.d.ts.map
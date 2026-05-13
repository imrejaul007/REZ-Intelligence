import { BaseConnector } from './baseConnector';
import type { Logger, RetryOptions, CircuitBreakerOptions, Product, ProductSearchFilters, ProductSearchResult } from '../types';
export interface ProductCreateRequest {
    name: string;
    description?: string;
    price: number;
    currency?: string;
    images?: string[];
    category?: string;
    tags?: string[];
    inventory?: {
        quantity: number;
        lowStockThreshold?: number;
    };
    metadata?: Record<string, unknown>;
}
export interface ProductUpdateRequest {
    name?: string;
    description?: string;
    price?: number;
    images?: string[];
    category?: string;
    tags?: string[];
    inventory?: {
        quantity?: number;
        lowStockThreshold?: number;
    };
    metadata?: Record<string, unknown>;
}
export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    parentId?: string;
    image?: string;
    productCount: number;
    children?: Category[];
}
export interface InventoryUpdate {
    productId: string;
    quantity: number;
    reason: string;
    reference?: string;
}
export interface InventoryStatus {
    productId: string;
    available: number;
    reserved: number;
    total: number;
    lowStock: boolean;
    lowStockThreshold: number;
}
export declare class CatalogConnector extends BaseConnector {
    constructor(baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Search products
     */
    searchProducts(filters: ProductSearchFilters, options?: {
        page?: number;
        pageSize?: number;
    }): Promise<ProductSearchResult>;
    /**
     * Get product by ID
     */
    getProduct(productId: string): Promise<Product>;
    /**
     * Get products by IDs
     */
    getProductsByIds(productIds: string[]): Promise<Product[]>;
    /**
     * Create product
     */
    createProduct(product: ProductCreateRequest): Promise<Product>;
    /**
     * Update product
     */
    updateProduct(productId: string, updates: ProductUpdateRequest): Promise<Product>;
    /**
     * Delete product
     */
    deleteProduct(productId: string): Promise<void>;
    /**
     * Get all categories
     */
    getCategories(options?: {
        includeProducts?: boolean;
    }): Promise<Category[]>;
    /**
     * Get category by ID or slug
     */
    getCategory(identifier: string): Promise<Category>;
    /**
     * Get products in category
     */
    getCategoryProducts(categoryId: string, options?: {
        page?: number;
        pageSize?: number;
        sortBy?: 'price' | 'name' | 'newest' | 'popular';
        sortOrder?: 'asc' | 'desc';
    }): Promise<ProductSearchResult>;
    /**
     * Get inventory status
     */
    getInventoryStatus(productId: string): Promise<InventoryStatus>;
    /**
     * Update inventory
     */
    updateInventory(update: InventoryUpdate): Promise<InventoryStatus>;
    /**
     * Reserve inventory
     */
    reserveInventory(productId: string, quantity: number, orderId?: string, expiresIn?: number): Promise<{
        reservationId: string;
        productId: string;
        quantity: number;
        expiresAt: string;
    }>;
    /**
     * Release reserved inventory
     */
    releaseInventory(reservationId: string, reason?: string): Promise<InventoryStatus>;
    /**
     * Confirm inventory reservation
     */
    confirmReservation(reservationId: string): Promise<InventoryStatus>;
    /**
     * Get related products
     */
    getRelatedProducts(productId: string, limit?: number): Promise<Product[]>;
    /**
     * Get featured products
     */
    getFeaturedProducts(category?: string, limit?: number): Promise<Product[]>;
    /**
     * Get new arrivals
     */
    getNewArrivals(category?: string, limit?: number): Promise<Product[]>;
    /**
     * Get low stock products
     */
    getLowStockProducts(threshold?: number): Promise<Product[]>;
    /**
     * Check product availability
     */
    checkAvailability(productId: string, quantity: number): Promise<{
        available: boolean;
        availableQuantity: number;
        requestedQuantity: number;
    }>;
    /**
     * Get product reviews
     */
    getProductReviews(productId: string, options?: {
        page?: number;
        pageSize?: number;
        rating?: number;
    }): Promise<{
        reviews: {
            reviewId: string;
            userId: string;
            rating: number;
            comment: string;
            createdAt: string;
            verified: boolean;
        }[];
        averageRating: number;
        totalReviews: number;
        ratingDistribution: {
            rating: number;
            count: number;
        }[];
    }>;
}
export declare function createCatalogConnector(baseUrl: string, authToken: string, options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
}): CatalogConnector;
//# sourceMappingURL=catalog.d.ts.map
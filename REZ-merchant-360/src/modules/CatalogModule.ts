/**
 * CatalogModule.ts - Product Catalog Services for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
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

export class CatalogModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: Catalog; timestamp: number }> = new Map();
  private cacheTTL: number = 120000; // 2 minutes default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.CATALOG_SERVICE_URL || 'http://localhost:4002',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Get catalog summary for a merchant
   */
  async getCatalog(merchantId: string): Promise<Catalog> {
    const cacheKey = `catalog:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getCatalogSummary(merchantId);

      const catalog: Catalog = {
        total_products: summary.total_products,
        active_products: summary.active_products,
        categories: summary.categories,
        last_product_update: summary.last_product_update,
        avg_product_rating: summary.avg_product_rating,
      };

      this.cache.set(cacheKey, { data: catalog, timestamp: Date.now() });
      return catalog;
    } catch (error) {
      console.error(`Failed to fetch catalog for merchant ${merchantId}:`, error);
      return this.getDefaultCatalog();
    }
  }

  /**
   * Get detailed catalog summary
   */
  async getCatalogSummary(merchantId: string): Promise<CatalogSummary> {
    try {
      const response = await this.client.get<CatalogSummary>(
        `/merchants/${merchantId}/catalog/summary`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch catalog summary for merchant ${merchantId}:`, error);
      return this.getDefaultCatalogSummary();
    }
  }

  /**
   * Get all products for a merchant
   */
  async getProducts(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: Product['status'];
      category?: string;
      search?: string;
      sort_by?: 'name' | 'price' | 'created_at' | 'updated_at';
      sort_order?: 'asc' | 'desc';
    } = {}
  ): Promise<Product[]> {
    try {
      const response = await this.client.get<Product[]>(
        `/merchants/${merchantId}/products`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch products for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Get single product by ID
   */
  async getProduct(merchantId: string, productId: string): Promise<Product | null> {
    try {
      const response = await this.client.get<Product>(
        `/merchants/${merchantId}/products/${productId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch product ${productId} for merchant ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Create a new product
   */
  async createProduct(merchantId: string, product: Partial<Product>): Promise<Product> {
    try {
      const response = await this.client.post<Product>(
        `/merchants/${merchantId}/products`,
        product
      );
      this.cache.delete(`catalog:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create product for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Update a product
   */
  async updateProduct(
    merchantId: string,
    productId: string,
    updates: Partial<Product>
  ): Promise<Product> {
    try {
      const response = await this.client.patch<Product>(
        `/merchants/${merchantId}/products/${productId}`,
        updates
      );
      this.cache.delete(`catalog:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update product ${productId} for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(merchantId: string, productId: string): Promise<boolean> {
    try {
      await this.client.delete(`/merchants/${merchantId}/products/${productId}`);
      this.cache.delete(`catalog:${merchantId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete product ${productId} for merchant ${merchantId}:`, error);
      return false;
    }
  }

  /**
   * Get all categories
   */
  async getCategories(merchantId: string): Promise<Category[]> {
    try {
      const response = await this.client.get<Category[]>(
        `/merchants/${merchantId}/categories`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch categories for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Create a new category
   */
  async createCategory(merchantId: string, category: Partial<Category>): Promise<Category> {
    try {
      const response = await this.client.post<Category>(
        `/merchants/${merchantId}/categories`,
        category
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to create category for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk update product status
   */
  async bulkUpdateStatus(
    merchantId: string,
    productIds: string[],
    status: Product['status']
  ): Promise<{ updated: number; failed: number }> {
    try {
      const response = await this.client.post<{ updated: number }>(
        `/merchants/${merchantId}/products/bulk-status`,
        { product_ids: productIds, status }
      );
      this.cache.delete(`catalog:${merchantId}`);
      return { updated: response.data.updated, failed: productIds.length - response.data.updated };
    } catch (error) {
      console.error(`Failed to bulk update products for merchant ${merchantId}:`, error);
      return { updated: 0, failed: productIds.length };
    }
  }

  /**
   * Sync catalog from external source
   */
  async syncCatalog(merchantId: string, sourceData: Partial<Catalog>): Promise<Catalog> {
    const current = await this.getCatalog(merchantId);
    const updated: Catalog = {
      ...current,
      ...sourceData,
      categories: sourceData.categories || current.categories,
    };

    // In a real implementation, this would sync to the catalog service
    this.cache.delete(`catalog:${merchantId}`);
    return updated;
  }

  private getDefaultCatalog(): Catalog {
    return {
      total_products: 0,
      active_products: 0,
      categories: [],
    };
  }

  private getDefaultCatalogSummary(): CatalogSummary {
    return {
      total_products: 0,
      active_products: 0,
      draft_products: 0,
      archived_products: 0,
      categories: [],
    };
  }

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`catalog:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}

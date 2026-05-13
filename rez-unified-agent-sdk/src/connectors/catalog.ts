import { BaseConnector } from './baseConnector';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  Product,
  ProductSearchFilters,
  ProductSearchResult,
  HttpResponse,
} from '../types';

// ============================================================================
// Catalog Service Types
// ============================================================================

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

// ============================================================================
// Catalog Connector
// ============================================================================

export class CatalogConnector extends BaseConnector {
  constructor(
    baseUrl: string,
    authToken: string,
    options: {
      logger?: Logger;
      timeout?: number;
      retry?: RetryOptions;
      circuitBreaker?: CircuitBreakerOptions;
    } = {},
  ) {
    super('catalog-service', baseUrl, authToken, options);
  }

  /**
   * Search products
   */
  async searchProducts(
    filters: ProductSearchFilters,
    options?: {
      page?: number;
      pageSize?: number;
    },
  ): Promise<ProductSearchResult> {
    this.logger.debug('Searching products', { filters, options });

    const params: Record<string, string> = {};

    if (filters.query) params.query = filters.query;
    if (filters.category) params.category = filters.category;
    if (filters.priceRange) {
      params.minPrice = String(filters.priceRange[0]);
      params.maxPrice = String(filters.priceRange[1]);
    }
    if (filters.rating) params.rating = String(filters.rating);
    if (filters.inStock !== undefined) params.inStock = String(filters.inStock);
    if (filters.tags?.length) params.tags = filters.tags.join(',');
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);

    const response = await this.get<ProductSearchResult>('/products/search', params);
    return response.data;
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<Product> {
    this.logger.debug('Getting product', { productId });

    const response = await this.get<Product>(`/products/${productId}`);
    return response.data;
  }

  /**
   * Get products by IDs
   */
  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    this.logger.debug('Getting products by IDs', { count: productIds.length });

    const response = await this.post<Product[]>('/products/batch', { ids: productIds });
    return response.data;
  }

  /**
   * Create product
   */
  async createProduct(product: ProductCreateRequest): Promise<Product> {
    this.logger.info('Creating product', {
      name: product.name,
      price: product.price,
    });

    const response = await this.post<Product>('/products', product);
    this.logger.info('Product created', { productId: response.data.productId });
    return response.data;
  }

  /**
   * Update product
   */
  async updateProduct(productId: string, updates: ProductUpdateRequest): Promise<Product> {
    this.logger.info('Updating product', { productId });

    const response = await this.patch<Product>(`/products/${productId}`, updates);
    this.logger.info('Product updated', { productId });
    return response.data;
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: string): Promise<void> {
    this.logger.info('Deleting product', { productId });

    await this.delete(`/products/${productId}`);
    this.logger.info('Product deleted', { productId });
  }

  /**
   * Get all categories
   */
  async getCategories(options?: {
    includeProducts?: boolean;
  }): Promise<Category[]> {
    this.logger.debug('Getting categories');

    const params: Record<string, string> = {};
    if (options?.includeProducts) params.includeProducts = 'true';

    const response = await this.get<Category[]>('/categories', params);
    return response.data;
  }

  /**
   * Get category by ID or slug
   */
  async getCategory(identifier: string): Promise<Category> {
    this.logger.debug('Getting category', { identifier });

    const response = await this.get<Category>(`/categories/${identifier}`);
    return response.data;
  }

  /**
   * Get products in category
   */
  async getCategoryProducts(
    categoryId: string,
    options?: {
      page?: number;
      pageSize?: number;
      sortBy?: 'price' | 'name' | 'newest' | 'popular';
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<ProductSearchResult> {
    this.logger.debug('Getting category products', { categoryId });

    const params: Record<string, string> = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.sortBy) params.sortBy = options.sortBy;
    if (options?.sortOrder) params.sortOrder = options.sortOrder;

    const response = await this.get<ProductSearchResult>(
      `/categories/${categoryId}/products`,
      params,
    );
    return response.data;
  }

  /**
   * Get inventory status
   */
  async getInventoryStatus(productId: string): Promise<InventoryStatus> {
    this.logger.debug('Getting inventory status', { productId });

    const response = await this.get<InventoryStatus>(`/inventory/${productId}`);
    return response.data;
  }

  /**
   * Update inventory
   */
  async updateInventory(update: InventoryUpdate): Promise<InventoryStatus> {
    this.logger.info('Updating inventory', {
      productId: update.productId,
      quantity: update.quantity,
      reason: update.reason,
    });

    const response = await this.post<InventoryStatus>('/inventory/update', update);
    this.logger.info('Inventory updated', { productId: update.productId });
    return response.data;
  }

  /**
   * Reserve inventory
   */
  async reserveInventory(
    productId: string,
    quantity: number,
    orderId?: string,
    expiresIn?: number,
  ): Promise<{
    reservationId: string;
    productId: string;
    quantity: number;
    expiresAt: string;
  }> {
    this.logger.debug('Reserving inventory', { productId, quantity, orderId });

    const response = await this.post<{
      reservationId: string;
      productId: string;
      quantity: number;
      expiresAt: string;
    }>('/inventory/reserve', {
      productId,
      quantity,
      orderId,
      expiresIn,
    });
    return response.data;
  }

  /**
   * Release reserved inventory
   */
  async releaseInventory(
    reservationId: string,
    reason?: string,
  ): Promise<InventoryStatus> {
    this.logger.debug('Releasing inventory', { reservationId });

    const response = await this.post<InventoryStatus>('/inventory/release', {
      reservationId,
      reason,
    });
    return response.data;
  }

  /**
   * Confirm inventory reservation
   */
  async confirmReservation(reservationId: string): Promise<InventoryStatus> {
    this.logger.debug('Confirming inventory reservation', { reservationId });

    const response = await this.post<InventoryStatus>('/inventory/confirm', {
      reservationId,
    });
    return response.data;
  }

  /**
   * Get related products
   */
  async getRelatedProducts(
    productId: string,
    limit?: number,
  ): Promise<Product[]> {
    this.logger.debug('Getting related products', { productId });

    const params: Record<string, string> = {};
    if (limit) params.limit = String(limit);

    const response = await this.get<Product[]>(`/products/${productId}/related`, params);
    return response.data;
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(
    category?: string,
    limit?: number,
  ): Promise<Product[]> {
    this.logger.debug('Getting featured products', { category });

    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (limit) params.limit = String(limit);

    const response = await this.get<Product[]>('/products/featured', params);
    return response.data;
  }

  /**
   * Get new arrivals
   */
  async getNewArrivals(
    category?: string,
    limit?: number,
  ): Promise<Product[]> {
    this.logger.debug('Getting new arrivals', { category });

    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (limit) params.limit = String(limit);

    const response = await this.get<Product[]>('/products/new', params);
    return response.data;
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold?: number): Promise<Product[]> {
    this.logger.debug('Getting low stock products');

    const params: Record<string, string> = {};
    if (threshold) params.threshold = String(threshold);

    const response = await this.get<Product[]>('/products/low-stock', params);
    return response.data;
  }

  /**
   * Check product availability
   */
  async checkAvailability(
    productId: string,
    quantity: number,
  ): Promise<{
    available: boolean;
    availableQuantity: number;
    requestedQuantity: number;
  }> {
    this.logger.debug('Checking availability', { productId, quantity });

    const response = await this.post<{
      available: boolean;
      availableQuantity: number;
      requestedQuantity: number;
    }>('/products/availability', {
      productId,
      quantity,
    });
    return response.data;
  }

  /**
   * Get product reviews
   */
  async getProductReviews(
    productId: string,
    options?: {
      page?: number;
      pageSize?: number;
      rating?: number;
    },
  ): Promise<{
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
  }> {
    this.logger.debug('Getting product reviews', { productId });

    const params: Record<string, string> = {};
    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.rating) params.rating = String(options.rating);

    const response = await this.get<{
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
    }>(`/products/${productId}/reviews`, params);
    return response.data;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCatalogConnector(
  baseUrl: string,
  authToken: string,
  options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
  },
): CatalogConnector {
  return new CatalogConnector(baseUrl, authToken, options);
}

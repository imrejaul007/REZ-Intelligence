import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum ProductCategory {
  WOMENS_CLOTHING = 'womens-clothing',
  MENS_CLOTHING = 'mens-clothing',
  SHOES = 'shoes',
  ACCESSORIES = 'accessories',
  ELECTRONICS = 'electronics',
  HOME = 'home',
  BEAUTY = 'beauty',
  SPORTS = 'sports',
  KIDS = 'kids'
}

export enum SortOption {
  RELEVANCE = 'relevance',
  PRICE_LOW_TO_HIGH = 'price_low_to_high',
  PRICE_HIGH_TO_LOW = 'price_high_to_low',
  RATING = 'rating',
  NEWEST = 'newest',
  BEST_SELLING = 'best_selling'
}

export enum ShopperTier {
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const ProductSearchSchema = z.object({
  query: z.string().min(1).max(200),
  category: z.string().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  brands: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  inStock: z.boolean().optional(),
  sort: z.nativeEnum(SortOption).optional()
});

export const ShopperSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  preferences: z.array(z.string()).optional(),
  sizes: z.record(z.string()).optional(),
  tier: z.nativeEnum(ShopperTier).optional()
});

export const ChatMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  shopper: ShopperSchema.optional(),
  context: z.object({
    currentCategory: z.string().optional(),
    budget: z.number().optional(),
    wishlist: z.array(z.string()).optional()
  }).optional()
});

// ============================================
// TYPES
// ============================================

export type ProductSearch = z.infer<typeof ProductSearchSchema>;
export type Shopper = z.infer<typeof ShopperSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  colors?: Array<{ name: string; hex: string; inStock: boolean }>;
  sizes?: Array<{ name: string; inStock: boolean }>;
  materials?: string[];
  features: string[];
  careInstructions?: string[];
  images?: string[];
  inStock: boolean;
  stockCount?: number;
  tags: string[];
}

export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  brands?: string[];
  colors?: string[];
  sizes?: string[];
  rating?: number;
  inStock?: boolean;
  sort?: SortOption;
  category?: string;
  subcategory?: string;
}

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  addedAt: Date;
  notes?: string;
}

export interface RetailContext {
  shopper: Shopper | null;
  sessionId: string;
  conversationHistory: string[];
  currentCategory: string | null;
  currentSearch: ProductSearch | null;
  wishlist: WishlistItem[];
  budget: number | null;
}

export interface RetailResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions: RetailAction[];
  processingTime?: number;
}

export interface RetailAction {
  type: 'refine_search' | 'filter_by_price' | 'sort_results' | 'show_more_recommendations' |
        'add_to_wishlist' | 'view_details' | 'add_to_cart' | 'check_size_guide' |
        'notify_when_available' | 'show_alternatives' | 'save_my_size' | 'show_measurement_guide' |
        'view_wishlist' | 'continue_shopping' | 'browse_categories' | 'browse_subcategory' |
        'show_deals' | 'show_popular_items' | 'show_new_arrivals' | 'select_product' |
        'search_again' | 'select_category' | 'add_all_to_cart' | 'share_wishlist' |
        'get_recommendations' | 'select_products';
  data: Record<string, unknown>;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface ServiceConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  logLevel: string;
  serviceName: string;
  version: string;
}

// ============================================
// ERROR TYPES
// ============================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError['errors'] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

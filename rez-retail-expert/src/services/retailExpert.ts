import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORIES, SIZE_GUIDES } from '../config/knowledge.js';

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
  dimensions?: { width?: string; height?: string; weight?: string; depth?: string; capacity?: string; diameter?: string };
  inStock: boolean;
  stockCount?: number;
  tags: string[];
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (metadata.stack) {
    msg += `\n${metadata.stack}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
    }),
    new winston.transports.File({
      filename: 'logs/retail-agent-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/retail-agent.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

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

export interface ProductSearch {
  id: string;
  query: string;
  category?: string;
  filters: SearchFilters;
  results: Product[];
  totalResults: number;
  createdAt: Date;
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

export interface Shopper {
  id: string;
  name: string;
  email: string;
  preferences: string[];
  sizes: Record<string, string>;
  tier: 'basic' | 'premium' | 'enterprise';
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

export class RetailExpert {
  private readonly agentId: string;
  private readonly agentName: string;
  private products: Map<string, Product>;
  private wishlists: Map<string, WishlistItem[]>;
  private searches: Map<string, ProductSearch>;
  private productCounter: number;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Retail Expert';
    this.products = new Map();
    this.wishlists = new Map();
    this.searches = new Map();
    this.productCounter = 1000;
    this.initializeProducts();
    logger.info('Retail Expert initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  private initializeProducts(): void {
    const sampleProducts: Product[] = [
      {
        id: 'prod-001',
        name: 'Classic Denim Jacket',
        brand: 'Levi\'s',
        category: 'womens-clothing',
        subcategory: 'Jackets',
        description: 'A timeless denim jacket that goes with everything. Features classic button closure, chest pockets, and a comfortable fit.',
        price: 89.99,
        originalPrice: 98.00,
        currency: 'USD',
        rating: 4.7,
        reviewCount: 2453,
        colors: [
          { name: 'Medium Wash', hex: '#5B7A9D', inStock: true },
          { name: 'Dark Wash', hex: '#2C3E50', inStock: true },
          { name: 'Light Wash', hex: '#A8C4D9', inStock: false }
        ],
        sizes: [
          { name: 'XS', inStock: true },
          { name: 'S', inStock: true },
          { name: 'M', inStock: true },
          { name: 'L', inStock: true },
          { name: 'XL', inStock: false }
        ],
        materials: ['100% Cotton', 'Denim'],
        features: ['Classic fit', 'Button closure', 'Chest pockets', 'Machine washable'],
        careInstructions: ['Machine wash cold', 'Tumble dry low', 'Iron if needed'],
        images: ['denim-jacket-1.jpg', 'denim-jacket-2.jpg'],
        inStock: true,
        stockCount: 150,
        tags: ['denim', 'jacket', 'classic', 'casual']
      },
      {
        id: 'prod-002',
        name: 'Premium Cashmere Sweater',
        brand: 'Everlane',
        category: 'womens-clothing',
        subcategory: 'Tops',
        description: 'Luxuriously soft cashmere sweater in a relaxed fit. Perfect for layering or wearing on its own.',
        price: 165.00,
        currency: 'USD',
        rating: 4.9,
        reviewCount: 892,
        colors: [
          { name: 'Oatmeal', hex: '#E8DFD0', inStock: true },
          { name: 'Charcoal', hex: '#4A4A4A', inStock: true },
          { name: 'Navy', hex: '#1B2838', inStock: true }
        ],
        sizes: [
          { name: 'XS', inStock: true },
          { name: 'S', inStock: true },
          { name: 'M', inStock: true },
          { name: 'L', inStock: true }
        ],
        materials: ['100% Grade-A Mongolian Cashmere'],
        features: ['Relaxed fit', 'Ribbed trim', 'Crew neck', 'Sustainable'],
        careInstructions: ['Hand wash cold', 'Lay flat to dry', 'Do not tumble dry'],
        images: ['cashmere-sweater-1.jpg'],
        inStock: true,
        stockCount: 45,
        tags: ['cashmere', 'sweater', 'luxury', 'cozy']
      },
      {
        id: 'prod-003',
        name: 'White Leather Sneakers',
        brand: 'Common Projects',
        category: 'shoes',
        subcategory: 'Sneakers',
        description: 'Minimalist leather sneakers with signature gold numbering. The epitome of understated luxury.',
        price: 495.00,
        currency: 'USD',
        rating: 4.8,
        reviewCount: 567,
        colors: [
          { name: 'White', hex: '#FFFFFF', inStock: true },
          { name: 'Black', hex: '#000000', inStock: true }
        ],
        sizes: [
          { name: '7', inStock: true },
          { name: '8', inStock: true },
          { name: '9', inStock: true },
          { name: '10', inStock: true },
          { name: '11', inStock: true }
        ],
        materials: ['Italian leather', 'Rubber sole'],
        features: ['Hand-stitched', 'Gold numbering', 'Leather lining', 'Made in Italy'],
        careInstructions: ['Wipe clean with damp cloth', 'Use leather conditioner'],
        images: ['common-projects-1.jpg'],
        inStock: true,
        stockCount: 23,
        tags: ['luxury', 'sneakers', 'minimalist', 'leather']
      },
      {
        id: 'prod-004',
        name: 'Wireless Noise-Canceling Headphones',
        brand: 'Sony',
        category: 'electronics',
        subcategory: 'Headphones',
        description: 'Industry-leading noise cancellation with exceptional sound quality. 30-hour battery life.',
        price: 349.99,
        originalPrice: 399.99,
        currency: 'USD',
        rating: 4.7,
        reviewCount: 15234,
        colors: [
          { name: 'Black', hex: '#000000', inStock: true },
          { name: 'Silver', hex: '#C0C0C0', inStock: true },
          { name: 'Midnight Blue', hex: '#191970', inStock: true }
        ],
        features: ['Industry-leading ANC', '30-hour battery', 'Speak-to-chat', 'Multipoint connection', 'Hi-Res Audio'],
        dimensions: { width: '7.84"', height: '7.84"', weight: '8.99 oz' },
        images: ['sony-headphones-1.jpg'],
        inStock: true,
        stockCount: 230,
        tags: ['headphones', 'wireless', 'noise-canceling', 'audio']
      },
      {
        id: 'prod-005',
        name: 'Canvas Weekender Bag',
        brand: 'Madewell',
        category: 'accessories',
        subcategory: 'Bags',
        description: 'Durable canvas weekender with leather handles. Perfect for weekend getaways.',
        price: 178.00,
        currency: 'USD',
        rating: 4.6,
        reviewCount: 1243,
        colors: [
          { name: 'Khaki', hex: '#C3B091', inStock: true },
          { name: 'Navy', hex: '#000080', inStock: true },
          { name: 'Black', hex: '#000000', inStock: true }
        ],
        features: ['Cotton canvas', 'Leather handles', 'Interior pockets', 'Detachable strap', 'Washable'],
        dimensions: { width: '22"', height: '11"', depth: '11"' },
        images: ['weekender-1.jpg'],
        inStock: true,
        stockCount: 67,
        tags: ['bag', 'weekender', 'travel', 'canvas']
      },
      {
        id: 'prod-006',
        name: 'Japanese Ceramic Mug Set',
        brand: 'Walnut',
        category: 'home',
        subcategory: 'Kitchen',
        description: 'Handcrafted ceramic mugs in a minimalist Japanese style. Set of 4.',
        price: 64.00,
        currency: 'USD',
        rating: 4.9,
        reviewCount: 456,
        colors: [
          { name: 'Cream', hex: '#FFFDD0', inStock: true },
          { name: 'Charcoal', hex: '#36454F', inStock: true },
          { name: 'Sage', hex: '#9DC183', inStock: true }
        ],
        features: ['Handcrafted', 'Microwave safe', 'Dishwasher safe', '12 oz capacity'],
        dimensions: { height: '3.5"', diameter: '3.5"', capacity: '12 oz' },
        images: ['mugs-1.jpg'],
        inStock: true,
        stockCount: 89,
        tags: ['mugs', 'ceramic', 'kitchen', 'minimalist']
      }
    ];

    for (const product of sampleProducts) {
      this.products.set(product.id, product);
    }
  }

  async processRetailQuery(
    context: RetailContext,
    message: string
  ): Promise<RetailResponse> {
    const startTime = Date.now();
    logger.info('Processing retail query', { sessionId: context.sessionId, messageLength: message.length });

    try {
      const intent = this.identifyIntent(message);
      const entities = this.extractEntities(message);

      let response: RetailResponse;

      switch (intent) {
        case 'search_product':
          response = await this.handleProductSearch(context, entities, message);
          break;
        case 'get_recommendations':
          response = await this.handleRecommendations(context, entities);
          break;
        case 'compare_products':
          response = await this.handleComparison(context, entities);
          break;
        case 'sizing_help':
          response = await this.handleSizingHelp(context, entities);
          break;
        case 'check_availability':
          response = await this.handleAvailabilityCheck(context, entities);
          break;
        case 'product_details':
          response = await this.handleProductDetails(context, entities);
          break;
        case 'wishlist':
          response = await this.handleWishlist(context, entities);
          break;
        case 'browse_category':
          response = await this.handleCategoryBrowse(context, entities);
          break;
        default:
          response = await this.handleGeneralRetail(context, entities, message);
      }

      response.processingTime = Date.now() - startTime;
      return response;

    } catch (error) {
      logger.error('Error processing retail query', { error, sessionId: context.sessionId });
      throw error;
    }
  }

  private identifyIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (this.matches(lowerMessage, ['find', 'search', 'looking for', 'want', 'need', 'show me', 'can you find'])) {
      return 'search_product';
    }
    if (this.matches(lowerMessage, ['recommend', 'suggest', 'similar', 'you might like', 'paired with'])) {
      return 'get_recommendations';
    }
    if (this.matches(lowerMessage, ['compare', 'versus', 'vs', 'difference between', 'which is better'])) {
      return 'compare_products';
    }
    if (this.matches(lowerMessage, ['size', 'fit', 'runs', 'true to size', 'measurements', 'size guide'])) {
      return 'sizing_help';
    }
    if (this.matches(lowerMessage, ['in stock', 'available', '库存', 'when back'])) {
      return 'check_availability';
    }
    if (this.matches(lowerMessage, ['details', 'specs', 'material', 'about this', 'description'])) {
      return 'product_details';
    }
    if (this.matches(lowerMessage, ['wishlist', 'save', 'favorite', 'heart', 'save for later'])) {
      return 'wishlist';
    }
    if (this.matches(lowerMessage, ['browse', 'categories', 'shop', 'show me the'])) {
      return 'browse_category';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractEntities(message: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    const priceMatch = message.match(/\$?\s*(\d{2,4})(?:\s*(?:-|to)\s*\$?\s*(\d{2,4}))?/);
    if (priceMatch) {
      entities.priceMin = parseInt(priceMatch[1]);
      if (priceMatch[2]) {
        entities.priceMax = parseInt(priceMatch[2]);
      }
    }

    for (const category of CATEGORIES) {
      const categoryKeywords = [
        category.name.toLowerCase(),
        category.id.replace(/-/g, ' '),
        ...category.subcategories.map(s => s.toLowerCase())
      ];
      if (categoryKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
        entities.category = category.id;
        break;
      }
    }

    const sizeMatch = message.match(/\b(XS|S|M|L|XL|XXL|\d{1,2})\b/i);
    if (sizeMatch) {
      entities.size = sizeMatch[1].toUpperCase();
    }

    for (const product of this.products.values()) {
      if (message.toLowerCase().includes(product.name.toLowerCase()) ||
          message.toLowerCase().includes(product.brand.toLowerCase())) {
        entities.productId = product.id;
        entities.productName = product.name;
        break;
      }
    }

    if (message.toLowerCase().includes('under') || message.toLowerCase().includes('budget')) {
      entities.budget = true;
    }
    if (message.toLowerCase().includes('top rated') || message.toLowerCase().includes('best')) {
      entities.sortBy = SortOption.RATING;
    }
    if (message.toLowerCase().includes('cheapest') || message.toLowerCase().includes('low to high')) {
      entities.sortBy = SortOption.PRICE_LOW_TO_HIGH;
    }

    return entities;
  }

  private async handleProductSearch(
    context: RetailContext,
    entities: Record<string, unknown>,
    message: string
  ): Promise<RetailResponse> {
    let products = Array.from(this.products.values());

    if (entities.category) {
      products = products.filter(p => p.category === entities.category);
    }

    if (entities.priceMin) {
      products = products.filter(p => p.price >= (entities.priceMin as number));
    }
    if (entities.priceMax) {
      products = products.filter(p => p.price <= (entities.priceMax as number));
    }

    if (entities.sortBy) {
      products = this.sortProducts(products, entities.sortBy as SortOption);
    } else {
      products = this.sortProducts(products, SortOption.RELEVANCE);
    }

    let responseMessage = '';

    if (products.length === 0) {
      responseMessage = "I couldn't find exact matches for that search. Let me suggest some popular items instead:\n\n";
      products = this.sortProducts(Array.from(this.products.values()), SortOption.RATING).slice(0, 4);
    } else {
      responseMessage = `I found ${products.length} great options for you:\n\n`;
    }

    for (const product of products.slice(0, 5)) {
      responseMessage += this.formatProductCard(product);
    }

    responseMessage += "\nWould you like more details on any of these, or refine your search?";

    return {
      success: true,
      message: responseMessage,
      data: { products: products.slice(0, 5) },
      actions: [
        { type: 'refine_search', data: { category: entities.category } },
        { type: 'filter_by_price', data: {} },
        { type: 'sort_results', data: {} }
      ]
    };
  }

  private async handleRecommendations(
    context: RetailContext,
    entities: Record<string, unknown>
  ): Promise<RetailResponse> {
    const category = entities.category as string || 'womens-clothing';
    let products = Array.from(this.products.values()).filter(p => p.category === category);

    if (context.shopper?.preferences) {
      const tags = context.shopper.preferences;
      products = products.sort((a, b) => {
        const aMatches = a.tags.filter(t => tags.includes(t)).length;
        const bMatches = b.tags.filter(t => tags.includes(t)).length;
        return bMatches - aMatches;
      });
    }

    products = this.sortProducts(products, SortOption.RATING).slice(0, 4);

    let responseMessage = `Based on your preferences, here are some items I think you'll love:\n\n`;

    for (const product of products) {
      responseMessage += this.formatProductCard(product);
    }

    responseMessage += "\nWant me to show you more options or search for something specific?";

    return {
      success: true,
      message: responseMessage,
      data: { products },
      actions: [
        { type: 'show_more_recommendations', data: {} },
        { type: 'add_to_wishlist', data: { products: products.map(p => p.id) } }
      ]
    };
  }

  private async handleComparison(
    context: RetailContext,
    entities: Record<string, unknown>
  ): Promise<RetailResponse> {
    const productId = entities.productId as string;

    if (!productId) {
      return {
        success: true,
        message: "Which products would you like to compare? Please share the product names or IDs.",
        actions: [{ type: 'select_products', data: {} }]
      };
    }

    const product = this.products.get(productId);
    if (!product) {
      return {
        success: true,
        message: `I couldn't find that product. Could you provide more details about what you're looking for?`,
        actions: [{ type: 'search_again', data: {} }]
      };
    }

    const similarProducts = Array.from(this.products.values())
      .filter(p => p.category === product.category && p.id !== product.id)
      .slice(0, 2);

    const allProducts = [product, ...similarProducts];

    let responseMessage = `Here's a comparison of ${allProducts.length} items:\n\n`;

    responseMessage += `| Product | Price | Rating | In Stock | Key Features |\n`;
    responseMessage += `|---------|-------|--------|----------|--------------|\n`;

    for (const p of allProducts) {
      const price = p.originalPrice ? `$${p.price} (was $${p.originalPrice})` : `$${p.price}`;
      const features = p.features.slice(0, 2).join(', ');
      responseMessage += `| ${p.name} | ${price} | ${p.rating}/5 | ${p.inStock ? 'Yes' : 'No'} | ${features} |\n`;
    }

    responseMessage += "\nWould you like more details on any of these items?";

    return {
      success: true,
      message: responseMessage,
      data: { products: allProducts },
      actions: [
        { type: 'view_details', data: { products: allProducts.map(p => p.id) } },
        { type: 'add_to_cart', data: {} }
      ]
    };
  }

  private async handleSizingHelp(
    context: RetailContext,
    entities: Record<string, unknown>
  ): Promise<RetailResponse> {
    const category = entities.category as string || 'womens-tops';
    const sizeGuide = SIZE_GUIDES.find(sg => sg.category === category);

    if (!sizeGuide) {
      return {
        success: true,
        message: "I can help with sizing! Which item or category are you interested in? For example: women's tops, men's pants, shoes, etc.",
        actions: [{ type: 'select_category', data: {} }]
      };
    }

    let responseMessage = `Here's the size guide for ${category}:\n\n`;
    responseMessage += `**Measurements:** ${sizeGuide.measurements.join(', ')}\n\n`;
    responseMessage += `| Size | ${sizeGuide.measurements.join(' | ') } |\n`;
    responseMessage += `|------|${sizeGuide.measurements.map(() => '------').join('|')}|\n`;

    for (const [size, measurements] of Object.entries(sizeGuide.sizes)) {
      const values = Object.values(measurements).join(' | ');
      responseMessage += `| ${size} | ${values} |\n`;
    }

    responseMessage += `\n**Fit Notes:** ${sizeGuide.fitNotes}\n\n`;

    if (context.shopper?.sizes) {
      const shopperSize = context.shopper.sizes[category];
      if (shopperSize) {
        responseMessage += `Based on your saved preferences, you wear size ${shopperSize} in this category.\n\n`;
      }
    }

    responseMessage += "Need help measuring yourself? I can guide you through it!";

    return {
      success: true,
      message: responseMessage,
      data: { sizeGuide },
      actions: [
        { type: 'save_my_size', data: { category } },
        { type: 'show_measurement_guide', data: {} }
      ]
    };
  }

  private async handleAvailabilityCheck(
    context: RetailContext,
    entities: Record<string, unknown>
  ): Promise<RetailResponse> {
    const productId = entities.productId as string;

    if (!productId) {
      return {
        success: true,
        message: "Which product would you like to check availability for?",
        actions: [{ type: 'select_product', data: {} }]
      };
    }

    const product = this.products.get(productId);
    if (!product) {
      return {
        success: true,
        message: "I couldn't find that product. Could you share more details?",
        actions: [{ type: 'search_again', data: {} }]
      };
    }

    let responseMessage = `**${product.name}** by ${product.brand}\n\n`;

    if (product.inStock) {
      responseMessage += `In Stock! `;
      if (product.stockCount && product.stockCount < 20) {
        responseMessage += `Only ${product.stockCount} left - order soon!\n\n`;
      } else {
        responseMessage += `\n\n`;
      }

      if (product.sizes) {
        const availableSizes = product.sizes.filter(s => s.inStock);
        const outOfStockSizes = product.sizes.filter(s => !s.inStock);

        responseMessage += `**Available Sizes:** ${availableSizes.map(s => s.name).join(', ')}\n`;
        if (outOfStockSizes.length > 0) {
          responseMessage += `**Out of Stock:** ${outOfStockSizes.map(s => s.name).join(', ')}\n`;
        }
      }

      if (product.colors) {
        responseMessage += `\n**Available Colors:**\n`;
        for (const color of product.colors) {
          responseMessage += `${color.inStock ? '[In Stock]' : '[Out]'} ${color.name}\n`;
        }
      }
    } else {
      responseMessage += `Currently Out of Stock\n\n`;
      responseMessage += `Would you like me to notify you when it's back?`;
    }

    return {
      success: true,
      message: responseMessage,
      data: { product },
      actions: [
        { type: 'notify_when_available', data: { productId: product.id } },
        { type: 'show_alternatives', data: { category: product.category } }
      ]
    };
  }

  private async handleProductDetails(
    context: RetailContext,
    entities: Record<string, unknown>
  ): Promise<RetailResponse> {
    const productId = entities.productId as string;

    if (!productId) {
      return {
        success: true,
        message: "Which product would you like to know more about?",
        actions: [{ type: 'select_product', data: {} }]
      };
    }

    const product = this.products.get(productId);
    if (!product) {
      return {
        success: true,
        message: "I couldn't find that product. Could you provide more details?",
        actions: [{ type: 'search_again', data: {} }]
      };
    }

    let responseMessage = `**${product.name}**\n`;
    responseMessage += `by ${product.brand}\n\n`;

    const price = product.originalPrice
      ? `$${product.price} (was $${product.originalPrice})`
      : `$${product.price}`;
    responseMessage += `**Price:** ${price}\n`;
    responseMessage += `**Rating:** ${product.rating}/5 (${product.reviewCount.toLocaleString()} reviews)\n\n`;

    responseMessage += `**Description:**\n${product.description}\n\n`;

    responseMessage += `**Key Features:**\n`;
    for (const feature of product.features) {
      responseMessage += `• ${feature}\n`;
    }

    if (product.materials) {
      responseMessage += `\n**Materials:** ${product.materials.join(', ')}\n`;
    }

    if (product.careInstructions) {
      responseMessage += `\n**Care Instructions:**\n`;
      for (const instruction of product.careInstructions) {
        responseMessage += `• ${instruction}\n`;
      }
    }

    if (product.sizes) {
      const availableSizes = product.sizes.filter(s => s.inStock);
      responseMessage += `\n**Available Sizes:** ${availableSizes.map(s => s.name).join(', ')}\n`;
    }

    if (product.colors) {
      responseMessage += `\n**Colors Available:** ${product.colors.map(c => c.name).join(', ')}\n`;
    }

    return {
      success: true,
      message: responseMessage,
      data: { product },
      actions: [
        { type: 'add_to_cart', data: { productId: product.id } },
        { type: 'add_to_wishlist', data: { productId: product.id } },
        { type: 'check_size_guide', data: { category: product.category } }
      ]
    };
  }

  private async handleWishlist(
    context: RetailContext,
    entities: Record<string, unknown>
  ): Promise<RetailResponse> {
    const productId = entities.productId as string;

    if (!productId) {
      const wishlist = context.wishlist;

      if (wishlist.length === 0) {
        return {
          success: true,
          message: "Your wishlist is empty. Start browsing and save items you love!",
          actions: [
            { type: 'browse_categories', data: {} },
            { type: 'get_recommendations', data: {} }
          ]
        };
      }

      let responseMessage = `Your wishlist (${wishlist.length} items):\n\n`;
      for (const item of wishlist) {
        responseMessage += `**${item.product.name}** - $${item.product.price}\n`;
      }

      responseMessage += "\nWould you like to add any of these to your cart?";

      return {
        success: true,
        message: responseMessage,
        data: { wishlist },
        actions: [
          { type: 'add_all_to_cart', data: {} },
          { type: 'share_wishlist', data: {} },
          { type: 'continue_shopping', data: {} }
        ]
      };
    }

    const product = this.products.get(productId);
    if (!product) {
      return {
        success: true,
        message: "I couldn't find that product.",
        actions: [{ type: 'search_again', data: {} }]
      };
    }

    const wishlistItem: WishlistItem = {
      id: uuidv4(),
      productId: product.id,
      product,
      addedAt: new Date()
    };

    const updatedWishlist = [...context.wishlist, wishlistItem];

    return {
      success: true,
      message: `Added **${product.name}** to your wishlist!\n\nYou can keep browsing or view your full wishlist anytime.`,
      data: { wishlist: updatedWishlist },
      actions: [
        { type: 'view_wishlist', data: {} },
        { type: 'continue_shopping', data: {} }
      ]
    };
  }

  private async handleCategoryBrowse(
    context: RetailContext,
    entities: Record<string, unknown>
  ): Promise<RetailResponse> {
    const categoryId = entities.category as string;

    if (categoryId) {
      const category = CATEGORIES.find(c => c.id === categoryId);
      if (category) {
        const products = Array.from(this.products.values())
          .filter(p => p.category === categoryId)
          .slice(0, 6);

        let responseMessage = `**${category.name}**\n${category.description}\n\n`;
        responseMessage += `**Popular subcategories:** ${category.subcategories.slice(0, 5).join(', ')}\n\n`;

        if (products.length > 0) {
          responseMessage += `**Featured Items:**\n\n`;
          for (const product of products) {
            responseMessage += this.formatProductCard(product);
          }
        }

        return {
          success: true,
          message: responseMessage,
          data: { category, products },
          actions: [
            { type: 'browse_subcategory', data: { category: category.id } },
            { type: 'sort_results', data: {} }
          ]
        };
      }
    }

    let responseMessage = "Here's our product catalog:\n\n";
    for (const category of CATEGORIES) {
      responseMessage += `**${category.name}**\n${category.description}\n\n`;
    }
    responseMessage += "Which category interests you?";

    return {
      success: true,
      message: responseMessage,
      data: { categories: CATEGORIES },
      actions: [
        { type: 'browse_subcategory', data: { categories: CATEGORIES.map(c => c.id) } }
      ]
    };
  }

  private async handleGeneralRetail(
    context: RetailContext,
    entities: Record<string, unknown>,
    message: string
  ): Promise<RetailResponse> {
    const greeting = this.isGreeting(message);

    if (greeting) {
      return {
        success: true,
        message: "Hello, shopper! I'm your REZ Retail Expert, ready to help you find amazing products.\n\nI can help you with:\n- Finding specific items\n- Getting personalized recommendations\n- Comparing products\n- Understanding sizing\n- Checking availability\n\nWhat are you looking for today?",
        actions: [
          { type: 'browse_categories', data: {} },
          { type: 'show_deals', data: {} },
          { type: 'get_recommendations', data: {} }
        ]
      };
    }

    return {
      success: true,
      message: "I'd love to help you find what you're looking for! Could you tell me:\n\n- What type of product you're interested in\n- Any specific brands or styles you prefer\n- Your budget range\n- Who it's for (yourself, a gift, etc.)\n\nOr just browse our categories to get inspired!",
      actions: [
        { type: 'browse_categories', data: {} },
        { type: 'show_popular_items', data: {} },
        { type: 'show_new_arrivals', data: {} }
      ]
    };
  }

  private formatProductCard(product: Product): string {
    const price = product.originalPrice
      ? `$${product.price} (was $${product.originalPrice})`
      : `$${product.price}`;
    const stars = this.getStarRating(product.rating);

    let card = `**${product.name}** by ${product.brand}\n`;
    card += `${price} | ${stars} (${product.reviewCount} reviews)\n`;
    card += product.inStock ? 'In Stock' : 'Out of Stock';
    card += `\n${product.description.substring(0, 100)}...\n\n`;

    return card;
  }

  private getStarRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    return '★'.repeat(fullStars) +
           (halfStar ? '½' : '') +
           '☆'.repeat(emptyStars);
  }

  private sortProducts(products: Product[], sortBy: SortOption): Product[] {
    switch (sortBy) {
      case SortOption.PRICE_LOW_TO_HIGH:
        return products.sort((a, b) => a.price - b.price);
      case SortOption.PRICE_HIGH_TO_LOW:
        return products.sort((a, b) => b.price - a.price);
      case SortOption.RATING:
        return products.sort((a, b) => b.rating - a.rating);
      case SortOption.NEWEST:
        return products.sort((a, b) => b.id.localeCompare(a.id));
      default:
        return products;
    }
  }

  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'start'];
    return greetings.some(g => message.toLowerCase().includes(g));
  }

  getProduct(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  searchProducts(query: string, filters?: SearchFilters): Product[] {
    const lowerQuery = query.toLowerCase();
    let results = Array.from(this.products.values()).filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.brand.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );

    if (filters?.priceMin) {
      results = results.filter(p => p.price >= filters.priceMin!);
    }
    if (filters?.priceMax) {
      results = results.filter(p => p.price <= filters.priceMax!);
    }
    if (filters?.category) {
      results = results.filter(p => p.category === filters.category);
    }
    if (filters?.sort) {
      results = this.sortProducts(results, filters.sort);
    }

    return results;
  }
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

export const retailExpert = new RetailExpert();

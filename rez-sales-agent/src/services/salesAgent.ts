import winston from 'winston';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...metadata } = info;
  let msg = `${ts} [${level}]: ${message}`;
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
      filename: 'logs/sales-agent-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/sales-agent.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost'
}

export enum CustomerSegment {
  NEW_CUSTOMER = 'new_customer',
  RETURNING = 'returning',
  VIP = 'vip',
  ENTERPRISE = 'enterprise'
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  segment: CustomerSegment;
  lifetimeValue: number;
  totalOrders: number;
  averageOrderValue: number;
  lastPurchaseDate: Date | null;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: string;
  customerId: string | null;
  email: string;
  name: string;
  phone: string | null;
  company: string | null;
  status: LeadStatus;
  source: string;
  score: number;
  notes: string[];
  assignedTo: string | null;
  products: string[];
  estimatedValue: number;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface SalesConversation {
  id: string;
  leadId: string;
  messages: SalesMessage[];
  startedAt: Date;
  endedAt: Date | null;
  outcome: 'converted' | 'lost' | 'pending' | null;
}

export interface SalesMessage {
  id: string;
  role: 'customer' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  entities?: Record<string, unknown>;
}

export interface SalesContext {
  customer: Customer | null;
  lead: Lead | null;
  conversation: SalesConversation | null;
  recentProducts: string[];
  browsingHistory: string[];
  cart: CartItem[];
  preferences: Record<string, unknown>;
}

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  inventory: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  images: string[];
  isActive: boolean;
}

export class SalesAgent {
  private readonly agentId: string;
  private readonly agentName: string;
  private conversationHistory: Map<string, SalesConversation>;
  private activeLeads: Map<string, Lead>;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Sales Agent';
    this.conversationHistory = new Map();
    this.activeLeads = new Map();
    logger.info('Sales Agent initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  async processCustomerIntent(
    context: SalesContext,
    message: string,
    sessionId: string
  ): Promise<SalesResponse> {
    const startTime = Date.now();
    logger.info('Processing customer intent', { sessionId, messageLength: message.length });

    try {
      const intent = this.identifyIntent(message);
      const entities = this.extractEntities(message);

      let response: SalesResponse;
      switch (intent) {
        case 'product_inquiry':
          response = await this.handleProductInquiry(context, entities);
          break;
        case 'pricing_question':
          response = await this.handlePricingQuestion(context, entities);
          break;
        case 'purchase_intent':
          response = await this.handlePurchaseIntent(context, entities);
          break;
        case 'discount_request':
          response = await this.handleDiscountRequest(context, entities);
          break;
        case 'product_comparison':
          response = await this.handleProductComparison(context, entities);
          break;
        case 'stock_check':
          response = await this.handleStockCheck(context, entities);
          break;
        case 'recommendation_request':
          response = await this.handleRecommendationRequest(context);
          break;
        default:
          response = await this.handleGeneralInquiry(context, message);
      }

      this.recordMessage(sessionId, {
        role: 'agent',
        content: response.message,
        intent,
        entities
      });

      response.processingTime = Date.now() - startTime;
      return response;

    } catch (error) {
      logger.error('Error processing intent', { error, sessionId });
      throw error;
    }
  }

  private identifyIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (this.matches(lowerMessage, ['how much', 'price', 'cost', 'pricing', 'discount', 'offer', 'deal'])) {
      return 'pricing_question';
    }
    if (this.matches(lowerMessage, ['in stock', 'available', 'when', 'delivery', 'shipping'])) {
      return 'stock_check';
    }
    if (this.matches(lowerMessage, ['recommend', 'suggestion', 'what do you think', 'best for'])) {
      return 'recommendation_request';
    }
    if (this.matches(lowerMessage, ['compare', 'difference', 'vs', 'versus', 'better'])) {
      return 'product_comparison';
    }
    if (this.matches(lowerMessage, ['buy', 'purchase', 'order', 'checkout', 'cart', 'add to'])) {
      return 'purchase_intent';
    }
    if (this.matches(lowerMessage, ['discount', 'coupon', 'promo', 'reduce', 'cheaper'])) {
      return 'discount_request';
    }
    if (this.matches(lowerMessage, ['tell me about', 'features', 'specs', 'details', 'information'])) {
      return 'product_inquiry';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractEntities(message: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};
    const lowerMessage = message.toLowerCase();

    const priceMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
      entities.price = parseFloat(priceMatch[1]);
    }

    const quantityMatch = message.match(/(\d+)\s*(?:units?|items?|pieces?|qty)/i);
    if (quantityMatch) {
      entities.quantity = parseInt(quantityMatch[1], 10);
    }

    const categories = ['hotel', 'flight', 'package', 'activity', 'tour', 'transfer', 'insurance'];
    for (const category of categories) {
      if (lowerMessage.includes(category)) {
        entities.category = category;
        break;
      }
    }

    const productNames = ['deluxe room', 'premium suite', 'standard room', 'villa'];
    for (const product of productNames) {
      if (lowerMessage.includes(product)) {
        entities.productName = product;
        break;
      }
    }

    return entities;
  }

  private async handleProductInquiry(
    context: SalesContext,
    entities: Record<string, unknown>
  ): Promise<SalesResponse> {
    const productInfo = this.getProductDetails(entities.productName as string);

    if (!productInfo) {
      return {
        success: false,
        message: "I couldn't find specific information about that product. Could you please provide more details or browse our catalog?",
        actions: [{ type: 'show_catalog', data: { category: entities.category } }]
      };
    }

    const upsellOpportunity = this.identifyUpsellOpportunity(context, productInfo);

    return {
      success: true,
      message: this.formatProductDescription(productInfo),
      data: { product: productInfo },
      actions: upsellOpportunity ? [{ type: 'suggest_upsell', data: upsellOpportunity }] : []
    };
  }

  private async handlePricingQuestion(
    context: SalesContext,
    entities: Record<string, unknown>
  ): Promise<SalesResponse> {
    const { calculateDynamicPrice } = await import('./pricingService');
    const product = this.getProductDetails(entities.productName as string);

    if (!product) {
      return {
        success: false,
        message: "I'd be happy to help with pricing. Could you let me know which product you're interested in?",
        actions: [{ type: 'prompt_product_selection', data: {} }]
      };
    }

    const customerSegment = context.customer?.segment || CustomerSegment.NEW_CUSTOMER;
    const dynamicPrice = calculateDynamicPrice(product.basePrice, {
      segment: customerSegment,
      quantity: entities.quantity as number || 1,
      timeToTravel: this.estimateTimeToTravel(context),
      inventoryLevel: product.inventory,
      demandScore: this.calculateDemandScore(product)
    });

    const priceBreakdown = this.generatePriceBreakdown(product.basePrice, dynamicPrice);

    let message = `The ${product.name} is currently priced at $${dynamicPrice.toFixed(2)}`;
    if (dynamicPrice < product.basePrice) {
      message += ` (including a ${((1 - dynamicPrice / product.basePrice) * 100).toFixed(0)}% discount for ${this.getSegmentLabel(customerSegment)})`;
    }
    message += '.';
    message += `\n\n${priceBreakdown}`;

    return {
      success: true,
      message,
      data: {
        product: product.name,
        originalPrice: product.basePrice,
        dynamicPrice,
        discount: dynamicPrice < product.basePrice ? product.basePrice - dynamicPrice : 0,
        segment: customerSegment
      },
      actions: [
        { type: 'add_to_cart', data: { productId: product.id, price: dynamicPrice } },
        { type: 'show_payment_options', data: {} }
      ]
    };
  }

  private async handlePurchaseIntent(
    context: SalesContext,
    entities: Record<string, unknown>
  ): Promise<SalesResponse> {
    const product = this.getProductDetails(entities.productName as string);

    if (!product) {
      return {
        success: false,
        message: "I'd like to help you make a purchase. Could you tell me which product you're interested in?",
        actions: [{ type: 'show_catalog', data: {} }]
      };
    }

    if (product.inventory <= 0) {
      return {
        success: false,
        message: `Unfortunately, ${product.name} is currently out of stock. Would you like me to notify you when it's back, or suggest alternatives?`,
        actions: [
          { type: 'notify_when_available', data: { productId: product.id } },
          { type: 'suggest_alternatives', data: { category: product.category } }
        ]
      };
    }

    const { calculateDynamicPrice } = await import('./pricingService');
    const customerSegment = context.customer?.segment || CustomerSegment.NEW_CUSTOMER;
    const price = calculateDynamicPrice(product.basePrice, {
      segment: customerSegment,
      quantity: entities.quantity as number || 1,
      timeToTravel: this.estimateTimeToTravel(context),
      inventoryLevel: product.inventory,
      demandScore: this.calculateDemandScore(product)
    });

    return {
      success: true,
      message: `Great choice! ${product.name} is available and I can offer it at $${price.toFixed(2)}. Would you like to proceed to checkout?`,
      data: {
        product,
        finalPrice: price,
        availableQuantity: product.inventory,
        estimatedDelivery: this.calculateDeliveryTime()
      },
      actions: [
        { type: 'proceed_to_checkout', data: { productId: product.id, price, quantity: 1 } },
        { type: 'add_to_cart', data: { productId: product.id, price, quantity: 1 } }
      ]
    };
  }

  private async handleDiscountRequest(
    context: SalesContext,
    entities: Record<string, unknown>
  ): Promise<SalesResponse> {
    const product = this.getProductDetails(entities.productName as string);
    const { getDiscountEligibility } = await import('./pricingService');

    const eligibility = getDiscountEligibility({
      customerId: context.customer?.id || null,
      segment: context.customer?.segment || CustomerSegment.NEW_CUSTOMER,
      lifetimeValue: context.customer?.lifetimeValue || 0,
      totalOrders: context.customer?.totalOrders || 0,
      cartValue: context.cart.reduce((sum, item) => sum + item.totalPrice, 0)
    });

    let message: string;
    let applicableDiscounts: string[] = [];

    if (eligibility.eligible) {
      message = `Great news! Based on your ${this.getSegmentLabel(context.customer?.segment || CustomerSegment.NEW_CUSTOMER)} status, you're eligible for the following discounts:\n\n`;
      for (const discount of eligibility.applicableDiscounts) {
        message += `- ${discount.name}: ${discount.description}\n`;
        applicableDiscounts.push(discount.code);
      }

      if (eligibility.loyaltyBonus) {
        message += `\nAdditionally, you have a loyalty bonus of ${eligibility.loyaltyBonus}% available!`;
        applicableDiscounts.push('LOYALTY_BONUS');
      }
    } else {
      message = `I understand you want the best value. Based on your profile, here's what I can offer:\n\n`;
      for (const suggestion of eligibility.suggestions) {
        message += `- ${suggestion}\n`;
      }
    }

    return {
      success: true,
      message,
      data: {
        eligible: eligibility.eligible,
        applicableDiscounts,
        potentialSavings: eligibility.potentialSavings,
        nextTier: eligibility.nextTier
      },
      actions: [{ type: 'apply_discounts', data: { discounts: applicableDiscounts } }]
    };
  }

  private async handleProductComparison(
    context: SalesContext,
    entities: Record<string, unknown>
  ): Promise<SalesResponse> {
    const comparison = this.generateProductComparison(context);

    return {
      success: true,
      message: comparison.message,
      data: comparison.data as Record<string, unknown>,
      actions: [{ type: 'display_comparison_table', data: comparison.data as Record<string, unknown> }]
    };
  }

  private async handleStockCheck(
    context: SalesContext,
    entities: Record<string, unknown>
  ): Promise<SalesResponse> {
    const product = this.getProductDetails(entities.productName as string);

    if (!product) {
      return {
        success: false,
        message: "I couldn't find that product in our inventory. Could you provide more details?",
        actions: [{ type: 'show_catalog', data: {} }]
      };
    }

    let stockMessage: string;
    if (product.inventory > 10) {
      stockMessage = `Yes, ${product.name} is in stock! We have ${product.inventory} units available.`;
    } else if (product.inventory > 0) {
      stockMessage = `Good news! ${product.name} is available, but only ${product.inventory} units left. I'd recommend ordering soon!`;
    } else {
      stockMessage = `Unfortunately, ${product.name} is currently out of stock. Expected restock: ${this.getExpectedRestockDate(product)}.`;
    }

    return {
      success: true,
      message: stockMessage,
      data: {
        productId: product.id,
        inStock: product.inventory > 0,
        quantity: product.inventory,
        restockDate: product.inventory === 0 ? this.getExpectedRestockDate(product) : null
      },
      actions: product.inventory > 0
        ? [{ type: 'reserve_item', data: { productId: product.id } }]
        : [{ type: 'notify_when_available', data: { productId: product.id } }]
    };
  }

  private async handleRecommendationRequest(context: SalesContext): Promise<SalesResponse> {
    const { getRecommendations } = await import('./productRecommendation');
    const recommendations = await getRecommendations(context);

    const message = recommendations.length > 0
      ? `Based on your preferences and browsing history, here are my top recommendations for you:\n\n${recommendations.map((rec, i) => `${i + 1}. ${rec.name} - $${rec.price.toFixed(2)}${rec.matchReason ? ` (${rec.matchReason})` : ''}`).join('\n\n')}`
      : "I'm still learning your preferences. Browse a few products and I'll have personalized recommendations for you!";

    return {
      success: true,
      message,
      data: { recommendations },
      actions: recommendations.length > 0
        ? [{ type: 'show_product_details', data: { productIds: recommendations.map(r => r.id) } }]
        : []
    };
  }

  private async handleGeneralInquiry(
    context: SalesContext,
    message: string
  ): Promise<SalesResponse> {
    const greeting = this.isGreeting(message)
      ? "Hello! I'm your REZ sales assistant. How can I help you find the perfect product today?"
      : "I want to make sure I understand you correctly. Could you tell me more about what you're looking for?";

    return {
      success: true,
      message: greeting,
      actions: [{ type: 'suggest_categories', data: { categories: ['hotels', 'flights', 'packages', 'activities'] } }]
    };
  }

  private getProductDetails(productName?: string): Product | null {
    const products: Product[] = [
      {
        id: 'prod_001',
        name: 'Deluxe Ocean View Room',
        description: 'Spacious room with panoramic ocean views, king-size bed, and premium amenities.',
        category: 'hotel',
        basePrice: 299.99,
        inventory: 15,
        rating: 4.8,
        reviewCount: 342,
        tags: ['ocean view', 'premium', 'spacious'],
        images: ['deluxe-ocean-1.jpg', 'deluxe-ocean-2.jpg'],
        isActive: true
      },
      {
        id: 'prod_002',
        name: 'Premium Suite with Private Pool',
        description: 'Luxury suite featuring a private infinity pool, separate living area, and butler service.',
        category: 'hotel',
        basePrice: 599.99,
        inventory: 5,
        rating: 4.9,
        reviewCount: 128,
        tags: ['luxury', 'private pool', 'butler'],
        images: ['suite-pool-1.jpg', 'suite-pool-2.jpg'],
        isActive: true
      },
      {
        id: 'prod_003',
        name: 'Standard Garden Room',
        description: 'Comfortable room with garden views, perfect for budget-conscious travelers.',
        category: 'hotel',
        basePrice: 149.99,
        inventory: 25,
        rating: 4.5,
        reviewCount: 567,
        tags: ['budget-friendly', 'garden view'],
        images: ['standard-garden-1.jpg'],
        isActive: true
      },
      {
        id: 'prod_004',
        name: 'Adventure Tour Package',
        description: '5-day adventure package including hiking, zip-lining, and jungle exploration.',
        category: 'package',
        basePrice: 899.99,
        inventory: 12,
        rating: 4.7,
        reviewCount: 89,
        tags: ['adventure', 'nature', 'group'],
        images: ['adventure-1.jpg', 'adventure-2.jpg'],
        isActive: true
      },
      {
        id: 'prod_005',
        name: 'Airport Transfer Service',
        description: 'Premium private transfer between airport and hotel with meet & greet.',
        category: 'transfer',
        basePrice: 79.99,
        inventory: 100,
        rating: 4.6,
        reviewCount: 234,
        tags: ['convenience', 'private', 'airport'],
        images: ['transfer-1.jpg'],
        isActive: true
      }
    ];

    if (!productName) return null;

    const lowerName = productName.toLowerCase();
    return products.find(p =>
      p.name.toLowerCase().includes(lowerName) ||
      p.tags.some(tag => lowerName.includes(tag.toLowerCase()))
    ) || null;
  }

  private identifyUpsellOpportunity(context: SalesContext, product: Product): { product: Product; reason: string } | null {
    if (product.category === 'hotel' && context.cart.some(item => item.productId === 'prod_005')) {
      const suite = this.getProductDetails('suite');
      if (suite && suite.inventory > 0) {
        return { product: suite, reason: 'Complete your luxury experience with our premium suite upgrade' };
      }
    }

    if (product.inventory < 5) {
      const alternative = this.getAllProducts().find(p => p.category === product.category && p.id !== product.id && p.inventory > 10);
      if (alternative) {
        return { product: alternative, reason: 'This popular item is selling fast - here\'s a similar option that\'s available' };
      }
    }

    return null;
  }

  private getAllProducts(): Product[] {
    return [
      { id: 'prod_001', name: 'Deluxe Ocean View Room', description: '', category: 'hotel', basePrice: 299.99, inventory: 15, rating: 4.8, reviewCount: 342, tags: [], images: [], isActive: true },
      { id: 'prod_002', name: 'Premium Suite with Private Pool', description: '', category: 'hotel', basePrice: 599.99, inventory: 5, rating: 4.9, reviewCount: 128, tags: [], images: [], isActive: true },
      { id: 'prod_003', name: 'Standard Garden Room', description: '', category: 'hotel', basePrice: 149.99, inventory: 25, rating: 4.5, reviewCount: 567, tags: [], images: [], isActive: true },
      { id: 'prod_004', name: 'Adventure Tour Package', description: '', category: 'package', basePrice: 899.99, inventory: 12, rating: 4.7, reviewCount: 89, tags: [], images: [], isActive: true },
      { id: 'prod_005', name: 'Airport Transfer Service', description: '', category: 'transfer', basePrice: 79.99, inventory: 100, rating: 4.6, reviewCount: 234, tags: [], images: [], isActive: true }
    ];
  }

  private formatProductDescription(product: Product): string {
    return `${product.name}\n\n${product.description}\n\n` +
      `Price: $${product.basePrice.toFixed(2)} per night\n` +
      `Rating: ${'★'.repeat(Math.floor(product.rating))}${product.rating % 1 >= 0.5 ? '½' : ''} (${product.reviewCount} reviews)\n` +
      `Availability: ${product.inventory > 10 ? 'In Stock' : product.inventory > 0 ? `Only ${product.inventory} left` : 'Out of Stock'}\n` +
      `Features: ${product.tags.join(', ')}`;
  }

  private generatePriceBreakdown(originalPrice: number, finalPrice: number): string {
    const breakdown: string[] = [];
    breakdown.push(`Base Price: $${originalPrice.toFixed(2)}`);

    if (finalPrice < originalPrice) {
      const discount = ((originalPrice - finalPrice) / originalPrice * 100).toFixed(0);
      breakdown.push(`Discount Applied: -${discount}%`);
    }

    breakdown.push(`Final Price: $${finalPrice.toFixed(2)}`);
    return breakdown.join('\n');
  }

  private estimateTimeToTravel(context: SalesContext): number {
    if (context.recentProducts.length > 0) {
      return crypto.randomInt(30) + 1;
    }
    return 14;
  }

  private calculateDemandScore(product: Product): number {
    const reviewVelocity = product.reviewCount / 30;
    const inventoryPressure = product.inventory < 10 ? 0.8 : product.inventory < 20 ? 0.5 : 0.2;
    return Math.min(1, reviewVelocity * 0.1 + inventoryPressure);
  }

  private calculateDeliveryTime(): string {
    const days = crypto.randomInt(3) + 1;
    return `Within ${days} business day${days > 1 ? 's' : ''}`;
  }

  private getExpectedRestockDate(product: Product): string {
    const restockDays = crypto.randomInt(7) + 3;
    const date = new Date();
    date.setDate(date.getDate() + restockDays);
    return date.toISOString().split('T')[0];
  }

  private getSegmentLabel(segment: CustomerSegment): string {
    const labels: Record<CustomerSegment, string> = {
      [CustomerSegment.NEW_CUSTOMER]: 'New Customer',
      [CustomerSegment.RETURNING]: 'Returning Customer',
      [CustomerSegment.VIP]: 'VIP Member',
      [CustomerSegment.ENTERPRISE]: 'Enterprise Partner'
    };
    return labels[segment];
  }

  private generateProductComparison(context: SalesContext): { message: string; data: unknown } {
    const products = this.getAllProducts().filter(p => p.category === 'hotel').slice(0, 3);

    const comparisonTable = products.map(p => ({
      name: p.name,
      price: `$${p.basePrice.toFixed(2)}`,
      rating: `${p.rating}/5`,
      inventory: p.inventory > 10 ? 'High' : p.inventory > 0 ? 'Low' : 'None',
      keyFeature: p.tags[0] || 'Standard'
    }));

    return {
      message: 'Here\'s a comparison of our top hotel options:\n\n' +
        comparisonTable.map(p =>
          `• ${p.name}\n  Price: ${p.price} | Rating: ${p.rating} | Stock: ${p.inventory} | ${p.keyFeature}`
        ).join('\n\n'),
      data: { products: comparisonTable }
    };
  }

  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings'];
    return greetings.some(g => message.toLowerCase().includes(g));
  }

  private recordMessage(sessionId: string, message: Omit<SalesMessage, 'id' | 'timestamp'>): void {
    let conversation = this.conversationHistory.get(sessionId);

    if (!conversation) {
      conversation = {
        id: uuidv4(),
        leadId: sessionId,
        messages: [],
        startedAt: new Date(),
        endedAt: null,
        outcome: null
      };
      this.conversationHistory.set(sessionId, conversation);
    }

    conversation.messages.push({
      id: uuidv4(),
      timestamp: new Date(),
      ...message
    });
  }

  async createLead(leadData: Partial<Lead>): Promise<Lead> {
    const lead: Lead = {
      id: uuidv4(),
      customerId: leadData.customerId || null,
      email: leadData.email || '',
      name: leadData.name || '',
      phone: leadData.phone || null,
      company: leadData.company || null,
      status: LeadStatus.NEW,
      source: leadData.source || 'direct',
      score: 0,
      notes: [],
      assignedTo: null,
      products: [],
      estimatedValue: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null
    };

    this.activeLeads.set(lead.id, lead);
    logger.info('New lead created', { leadId: lead.id, email: lead.email });

    return lead;
  }

  async updateLeadScore(leadId: string, scoreDelta: number): Promise<Lead | null> {
    const lead = this.activeLeads.get(leadId);
    if (!lead) {
      logger.warn('Lead not found for score update', { leadId });
      return null;
    }

    lead.score = Math.max(0, Math.min(100, lead.score + scoreDelta));
    lead.updatedAt = new Date();
    logger.info('Lead score updated', { leadId, newScore: lead.score });

    return lead;
  }

  getLead(leadId: string): Lead | undefined {
    return this.activeLeads.get(leadId);
  }

  getAllLeads(): Lead[] {
    return Array.from(this.activeLeads.values());
  }
}

export interface SalesResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions: SalesAction[];
  processingTime?: number;
}

export interface SalesAction {
  type: 'add_to_cart' | 'proceed_to_checkout' | 'show_catalog' | 'suggest_upsell' |
        'show_payment_options' | 'notify_when_available' | 'suggest_alternatives' |
        'prompt_product_selection' | 'suggest_categories' | 'display_comparison_table' |
        'apply_discounts' | 'reserve_item' | 'show_product_details';
  data: Record<string, unknown>;
}

export const salesAgent = new SalesAgent();

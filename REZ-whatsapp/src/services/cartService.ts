import { v4 as uuidv4 } from 'uuid';
import { Session, ISession } from '../models/Session';
import { CartItem, SessionState } from '../types/whatsapp';
import { logger } from '../utils/logger';

export interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

export interface CartOperationResult {
  success: boolean;
  cart?: CartSummary;
  error?: string;
}

export class CartService {
  private defaultDeliveryFee: number = 40; // INR
  private freeDeliveryThreshold: number = 499; // INR
  private maxQuantityPerItem: number = 99;
  private maxCartItems: number = 50;

  constructor(options?: {
    defaultDeliveryFee?: number;
    freeDeliveryThreshold?: number;
    maxQuantityPerItem?: number;
    maxCartItems?: number;
  }) {
    if (options) {
      this.defaultDeliveryFee = options.defaultDeliveryFee ?? this.defaultDeliveryFee;
      this.freeDeliveryThreshold = options.freeDeliveryThreshold ?? this.freeDeliveryThreshold;
      this.maxQuantityPerItem = options.maxQuantityPerItem ?? this.maxQuantityPerItem;
      this.maxCartItems = options.maxCartItems ?? this.maxCartItems;
    }
  }

  /**
   * Add item to cart
   */
  async addItem(
    sessionId: string,
    item: CartItem
  ): Promise<CartOperationResult> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Validate item
      const validation = this.validateCartItem(item);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check cart size limit
      if (session.context.cart.length >= this.maxCartItems) {
        return {
          success: false,
          error: `Cart limit reached. Maximum ${this.maxCartItems} items allowed.`,
        };
      }

      // Add item (handles duplicates internally)
      session.addToCart(item);
      session.state = SessionState.ADDING_TO_CART;
      session.lastActivity = new Date();
      await session.save();

      logger.info('Item added to cart', {
        sessionId,
        productId: item.productId,
        quantity: item.quantity,
      });

      return {
        success: true,
        cart: this.calculateCartSummary(session),
      };
    } catch (error) {
      logger.error('Failed to add item to cart', {
        sessionId,
        productId: item.productId,
        error,
      });
      return {
        success: false,
        error: 'Failed to add item to cart',
      };
    }
  }

  /**
   * Update item quantity
   */
  async updateItem(
    sessionId: string,
    productId: string,
    quantity: number
  ): Promise<CartOperationResult> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Check if item exists
      const existingItem = session.context.cart.find(
        (item) => item.productId === productId
      );
      if (!existingItem) {
        return { success: false, error: 'Item not found in cart' };
      }

      // Validate quantity
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        return this.removeItem(sessionId, productId);
      }

      if (quantity > this.maxQuantityPerItem) {
        return {
          success: false,
          error: `Maximum quantity per item is ${this.maxQuantityPerItem}`,
        };
      }

      // Update quantity
      (session as any).updateCartItem(productId, quantity);
      session.lastActivity = new Date();
      await session.save();

      logger.info('Cart item updated', {
        sessionId,
        productId,
        newQuantity: quantity,
      });

      return {
        success: true,
        cart: this.calculateCartSummary(session),
      };
    } catch (error) {
      logger.error('Failed to update cart item', {
        sessionId,
        productId,
        error,
      });
      return {
        success: false,
        error: 'Failed to update item quantity',
      };
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(
    sessionId: string,
    productId: string
  ): Promise<CartOperationResult> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      (session as any).removeFromCart(productId);
      session.lastActivity = new Date();
      await session.save();

      logger.info('Item removed from cart', {
        sessionId,
        productId,
      });

      return {
        success: true,
        cart: this.calculateCartSummary(session),
      };
    } catch (error) {
      logger.error('Failed to remove cart item', {
        sessionId,
        productId,
        error,
      });
      return {
        success: false,
        error: 'Failed to remove item from cart',
      };
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(sessionId: string): Promise<CartOperationResult> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      session.clearCart();
      session.state = SessionState.IDLE;
      session.lastActivity = new Date();
      await session.save();

      logger.info('Cart cleared', { sessionId });

      return {
        success: true,
        cart: this.calculateCartSummary(session),
      };
    } catch (error) {
      logger.error('Failed to clear cart', {
        sessionId,
        error,
      });
      return {
        success: false,
        error: 'Failed to clear cart',
      };
    }
  }

  /**
   * Get cart summary
   */
  async getCart(sessionId: string): Promise<CartOperationResult> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      return {
        success: true,
        cart: this.calculateCartSummary(session),
      };
    } catch (error) {
      logger.error('Failed to get cart', {
        sessionId,
        error,
      });
      return {
        success: false,
        error: 'Failed to get cart',
      };
    }
  }

  /**
   * Apply discount code
   */
  async applyDiscount(
    sessionId: string,
    discountCode: string
  ): Promise<CartOperationResult> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // In production, validate discount code against discount service
      const discountResult = await this.validateDiscountCode(discountCode);
      if (!discountResult.valid) {
        return { success: false, error: discountResult.error || 'Invalid discount code' };
      }

      // Store discount in session metadata
      session.metadata = {
        ...session.metadata,
        discountCode,
        discountAmount: discountResult.discountAmount,
        discountType: discountResult.discountType,
      };

      session.lastActivity = new Date();
      await session.save();

      logger.info('Discount applied', {
        sessionId,
        discountCode,
        amount: discountResult.discountAmount,
      });

      return {
        success: true,
        cart: this.calculateCartSummary(session),
      };
    } catch (error) {
      logger.error('Failed to apply discount', {
        sessionId,
        discountCode,
        error,
      });
      return {
        success: false,
        error: 'Failed to apply discount',
      };
    }
  }

  /**
   * Remove discount
   */
  async removeDiscount(sessionId: string): Promise<CartOperationResult> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const metadata = session.metadata as any;
      const currentDiscount = metadata?.discountCode;
      if (!currentDiscount) {
        return { success: false, error: 'No discount applied' };
      }

      // Remove discount from metadata
      const newMetadata: Record<string, unknown> = {};
      Object.keys(metadata).forEach((key) => {
        if (!['discountCode', 'discountAmount', 'discountType'].includes(key)) {
          newMetadata[key] = metadata[key];
        }
      });
      session.metadata = newMetadata;

      session.lastActivity = new Date();
      await session.save();

      logger.info('Discount removed', { sessionId });

      return {
        success: true,
        cart: this.calculateCartSummary(session),
      };
    } catch (error) {
      logger.error('Failed to remove discount', {
        sessionId,
        error,
      });
      return {
        success: false,
        error: 'Failed to remove discount',
      };
    }
  }

  /**
   * Calculate cart summary with totals
   */
  private calculateCartSummary(session: ISession): CartSummary {
    const items = session.context.cart;
    const itemCount = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const subtotal = (session as any).getCartTotal?.() || items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 0), 0);

    // Calculate discount
    let discount = 0;
    const metadata = session.metadata as any || {};
    const discountCode = metadata.discountCode;
    const discountAmount = metadata.discountAmount;
    const discountType = metadata.discountType;

    if (discountCode && discountAmount) {
      if (discountType === 'percentage') {
        discount = subtotal * ((discountAmount as number) / 100);
      } else {
        discount = discountAmount as number;
      }
    }

    // Calculate delivery fee
    const effectiveSubtotal = subtotal - discount;
    const deliveryFee =
      effectiveSubtotal >= this.freeDeliveryThreshold || effectiveSubtotal === 0
        ? 0
        : this.defaultDeliveryFee;

    // Calculate total
    const total = effectiveSubtotal + deliveryFee;

    return {
      items,
      itemCount,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      deliveryFee,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Validate cart item
   */
  private validateCartItem(item: CartItem): { valid: boolean; error?: string } {
    if (!item.productId) {
      return { valid: false, error: 'Product ID is required' };
    }
    if (!item.name) {
      return { valid: false, error: 'Product name is required' };
    }
    if (typeof item.price !== 'number' || item.price < 0) {
      return { valid: false, error: 'Invalid price' };
    }
    if (typeof item.quantity !== 'number' || item.quantity < 1) {
      return { valid: false, error: 'Invalid quantity' };
    }
    if (item.quantity > this.maxQuantityPerItem) {
      return {
        valid: false,
        error: `Maximum quantity is ${this.maxQuantityPerItem}`,
      };
    }
    if (!item.merchantId) {
      return { valid: false, error: 'Merchant ID is required' };
    }

    return { valid: true };
  }

  /**
   * Validate discount code (placeholder - integrate with discount service)
   */
  private async validateDiscountCode(
    code: string
  ): Promise<{
    valid: boolean;
    discountAmount?: number;
    discountType?: 'percentage' | 'fixed';
    error?: string;
  }> {
    // Mock validation - replace with actual discount service integration
    const validCodes: Record<string, { amount: number; type: 'percentage' | 'fixed' }> = {
      'SAVE10': { amount: 10, type: 'percentage' },
      'FLAT50': { amount: 50, type: 'fixed' },
      'FIRST100': { amount: 100, type: 'fixed' },
    };

    const discount = validCodes[code.toUpperCase()];
    if (!discount) {
      return { valid: false, error: 'Invalid discount code' };
    }

    return {
      valid: true,
      discountAmount: discount.amount,
      discountType: discount.type,
    };
  }

  /**
   * Get cart by user ID (across all sessions)
   */
  async getCartByUser(userId: string, merchantId?: string): Promise<CartSummary | null> {
    const session = await Session.findOne({ userId, ...(merchantId && { merchantId }) });
    if (!session) {
      return null;
    }
    return this.calculateCartSummary(session);
  }

  /**
   * Merge guest cart into user cart
   */
  async mergeCarts(
    sourceSessionId: string,
    targetSessionId: string
  ): Promise<CartOperationResult> {
    try {
      const [sourceSession, targetSession] = await Promise.all([
        Session.findOne({ sessionId: sourceSessionId }),
        Session.findOne({ sessionId: targetSessionId }),
      ]);

      if (!sourceSession || !targetSession) {
        return { success: false, error: 'Session not found' };
      }

      // Merge items from source to target
      for (const item of sourceSession.context.cart) {
        const existingItem = targetSession.context.cart.find(
          (i) => i.productId === item.productId
        );
        if (existingItem) {
          // Combine quantities (up to max)
          const newQty = Math.min(
            existingItem.quantity + item.quantity,
            this.maxQuantityPerItem
          );
          (targetSession as any).updateCartItem?.(item.productId, newQty);
        } else {
          (targetSession as any).addToCart?.(item);
        }
      }

      // Clear source cart
      sourceSession.clearCart();
      await Promise.all([sourceSession.save(), targetSession.save()]);

      logger.info('Carts merged', {
        sourceSessionId,
        targetSessionId,
      });

      return {
        success: true,
        cart: this.calculateCartSummary(targetSession),
      };
    } catch (error) {
      logger.error('Failed to merge carts', {
        sourceSessionId,
        targetSessionId,
        error,
      });
      return {
        success: false,
        error: 'Failed to merge carts',
      };
    }
  }
}

export default CartService;

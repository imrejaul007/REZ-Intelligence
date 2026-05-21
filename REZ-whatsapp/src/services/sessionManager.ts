import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { Session, ISession } from '../models/Session';
import {
  SessionState,
  SessionCreateInput,
  ConversationContext,
  CartItem,
  MessageRecord,
} from '../types/whatsapp';
import { logger } from '../utils/logger';

export class SessionManager {
  private redis: Redis;
  private defaultTimeout: number;
  private readonly SESSION_PREFIX = 'whatsapp:session:';
  private readonly CONTEXT_PREFIX = 'whatsapp:context:';

  constructor(redis: Redis, defaultTimeoutHours: number = 24) {
    this.redis = redis;
    this.defaultTimeout = defaultTimeoutHours * 60 * 60; // Convert to seconds
  }

  /**
   * Create a new WhatsApp session
   */
  async createSession(input: SessionCreateInput): Promise<ISession> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultTimeout * 1000);

    const context: ConversationContext = {
      cart: [],
      conversationHistory: [],
    };

    const session = await Session.create({
      sessionId,
      userId: input.userId,
      merchantId: input.merchantId,
      phoneNumber: input.phoneNumber,
      state: SessionState.IDLE,
      context,
      lastActivity: now,
      expiresAt,
      metadata: {
        source: input.source || 'unknown',
        ...input.metadata,
      },
    });

    // Cache session state in Redis for fast access
    await this.cacheSession(session);

    logger.info('Session created', {
      sessionId,
      userId: input.userId,
      merchantId: input.merchantId,
    });

    return session;
  }

  /**
   * Get session by sessionId
   */
  async getSession(sessionId: string): Promise<ISession | null> {
    // Try Redis cache first
    const cached = await this.getCachedSession(sessionId);
    if (cached) {
      return cached;
    }

    // Fall back to MongoDB
    const session = await Session.findOne({ sessionId });
    if (session) {
      await this.cacheSession(session);
    }

    return session;
  }

  /**
   * Get session by userId
   */
  async getSessionByUser(
    userId: string,
    merchantId?: string
  ): Promise<ISession | null> {
    const query: Record<string, unknown> = {
      userId,
      expiresAt: { $gt: new Date() },
    };
    if (merchantId) {
      query.merchantId = merchantId;
    }

    return Session.findOne(query).sort({ lastActivity: -1 });
  }

  /**
   * Update session state with state machine validation
   */
  async updateSessionState(
    sessionId: string,
    newState: SessionState
  ): Promise<ISession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      logger.warn('Session not found for state update', { sessionId });
      return null;
    }

    // Validate state transition
    const validTransitions = this.getValidTransitions(session.state);
    if (!validTransitions.includes(newState)) {
      logger.warn('Invalid state transition', {
        sessionId,
        from: session.state,
        to: newState,
      });
      // Allow the transition but log warning
    }

    session.state = newState;
    session.lastActivity = new Date();
    await session.save();

    await this.cacheSession(session);

    logger.info('Session state updated', {
      sessionId,
      newState,
    });

    return session;
  }

  /**
   * Get valid state transitions from current state
   */
  private getValidTransitions(currentState: SessionState): SessionState[] {
    const transitions: Record<SessionState, SessionState[]> = {
      [SessionState.IDLE]: [
        SessionState.BROWSING,
        SessionState.SEARCHING,
        SessionState.SUPPORT,
      ],
      [SessionState.BROWSING]: [
        SessionState.VIEWING_PRODUCT,
        SessionState.SEARCHING,
        SessionState.CART_REVIEW,
        SessionState.IDLE,
      ],
      [SessionState.SEARCHING]: [
        SessionState.BROWSING,
        SessionState.VIEWING_PRODUCT,
        SessionState.IDLE,
      ],
      [SessionState.VIEWING_PRODUCT]: [
        SessionState.ADDING_TO_CART,
        SessionState.BROWSING,
        SessionState.CART_REVIEW,
        SessionState.CHECKOUT,
      ],
      [SessionState.ADDING_TO_CART]: [
        SessionState.CART_REVIEW,
        SessionState.VIEWING_PRODUCT,
      ],
      [SessionState.CART_REVIEW]: [
        SessionState.CHECKOUT,
        SessionState.BROWSING,
        SessionState.VIEWING_PRODUCT,
      ],
      [SessionState.CHECKOUT]: [
        SessionState.PAYMENT_PENDING,
        SessionState.CART_REVIEW,
      ],
      [SessionState.PAYMENT_PENDING]: [
        SessionState.ORDER_CONFIRMED,
        SessionState.CHECKOUT,
      ],
      [SessionState.ORDER_CONFIRMED]: [
        SessionState.TRACKING,
        SessionState.IDLE,
      ],
      [SessionState.SUPPORT]: [SessionState.IDLE],
      [SessionState.TRACKING]: [SessionState.IDLE, SessionState.ORDER_CONFIRMED],
      [SessionState.COMPLETED]: [SessionState.IDLE],
      [SessionState.EXPIRED]: [SessionState.IDLE],
    };

    return transitions[currentState] || [SessionState.IDLE];
  }

  /**
   * Add item to cart
   */
  async addToCart(
    sessionId: string,
    item: CartItem
  ): Promise<ISession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.addToCart(item);
    session.state = SessionState.ADDING_TO_CART;
    session.lastActivity = new Date();
    await session.save();

    await this.cacheSession(session);

    logger.info('Item added to cart', {
      sessionId,
      productId: item.productId,
      quantity: item.quantity,
    });

    return session;
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    sessionId: string,
    productId: string,
    quantity: number
  ): Promise<ISession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    (session as any).updateCartItem?.(productId, quantity);
    await session.save();
    return session;

    session.lastActivity = new Date();
    await session.save();

    await this.cacheSession(session);

    logger.info('Cart item updated', {
      sessionId,
      productId,
      quantity,
    });

    return session;
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(
    sessionId: string,
    productId: string
  ): Promise<ISession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.removeFromCart(productId);
    session.lastActivity = new Date();
    await session.save();

    await this.cacheSession(session);

    logger.info('Item removed from cart', {
      sessionId,
      productId,
    });

    return session;
  }

  /**
   * Clear cart
   */
  async clearCart(sessionId: string): Promise<ISession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.clearCart();
    session.state = SessionState.IDLE;
    session.lastActivity = new Date();
    await session.save();

    await this.cacheSession(session);

    logger.info('Cart cleared', { sessionId });

    return session;
  }

  /**
   * Get cart total
   */
  async getCartTotal(sessionId: string): Promise<number> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return 0;
    }
    return (session as any).getCartTotal?.() || 0;
  }

  /**
   * Add message to conversation history
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    messageId: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    (session as any).addMessage?.(role, content, messageId);
    session.lastActivity = new Date();
    await session.save();

    await this.cacheSession(session);
  }

  /**
   * Extend session expiration
   */
  async extendSession(
    sessionId: string,
    additionalHours?: number
  ): Promise<ISession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const hours = additionalHours || Math.floor(this.defaultTimeout / 3600);
    session.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    session.lastActivity = new Date();
    await session.save();

    await this.cacheSession(session);

    logger.info('Session extended', {
      sessionId,
      newExpiry: session.expiresAt,
    });

    return session;
  }

  /**
   * End session gracefully
   */
  async endSession(sessionId: string): Promise<ISession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.state = SessionState.COMPLETED;
    session.lastActivity = new Date();
    await session.save();

    // Remove from cache
    await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);

    logger.info('Session ended', { sessionId });

    return session;
  }

  /**
   * Mark session as expired
   */
  async expireSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    session.state = SessionState.EXPIRED;
    session.expiresAt = new Date();
    await session.save();

    await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);

    logger.info('Session expired', { sessionId });
  }

  /**
   * Cache session in Redis
   */
  private async cacheSession(session: ISession): Promise<void> {
    const cacheKey = `${this.SESSION_PREFIX}${session.sessionId}`;
    const cacheData = {
      sessionId: session.sessionId,
      userId: session.userId,
      merchantId: session.merchantId,
      state: session.state,
      lastActivity: session.lastActivity.toISOString(),
    };

    // Cache for slightly less than MongoDB expiry for consistency
    const ttl = Math.floor(this.defaultTimeout * 0.95);
    await this.redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
  }

  /**
   * Get cached session from Redis
   */
  private async getCachedSession(
    sessionId: string
  ): Promise<ISession | null> {
    const cached = await this.redis.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!cached) {
      return null;
    }

    try {
      const data = JSON.parse(cached);
      // Return the full session from MongoDB with fresh data
      return Session.findOne({ sessionId: data.sessionId });
    } catch (error) {
      logger.error('Failed to parse cached session', { sessionId, error });
      return null;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await Session.updateMany(
      {
        expiresAt: { $lt: new Date() },
        state: { $ne: SessionState.EXPIRED },
      },
      {
        $set: { state: SessionState.EXPIRED },
      }
    );

    logger.info('Expired sessions cleaned up', {
      count: result.modifiedCount,
    });

    return result.modifiedCount;
  }

  /**
   * Get session statistics
   */
  async getStats(merchantId?: string): Promise<{
    total: number;
    active: number;
    byState: Record<string, number>;
    avgCartValue: number;
  }> {
    const matchStage: Record<string, unknown> = {};
    if (merchantId) {
      matchStage.merchantId = merchantId;
    }
    matchStage.expiresAt = { $gt: new Date() };

    const stats = await Session.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$state',
          count: { $sum: 1 },
        },
      },
    ]);

    const byState: Record<string, number> = {};
    let total = 0;
    stats.forEach((s) => {
      byState[s._id] = s.count;
      total += s.count;
    });

    // Calculate average cart value
    const cartStats = await Session.aggregate([
      {
        $match: {
          ...matchStage,
          'context.cart': { $ne: [] },
        },
      },
      {
        $project: {
          cartTotal: {
            $reduce: {
              input: '$context.cart',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  { $multiply: ['$$this.price', '$$this.quantity'] },
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          avgCartValue: { $avg: '$cartTotal' },
        },
      },
    ]);

    return {
      total,
      active: total,
      byState,
      avgCartValue: cartStats[0]?.avgCartValue || 0,
    };
  }
}

export default SessionManager;

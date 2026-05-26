import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Session, ISession } from '../models/Session';
import {
  SessionState,
  SessionCreateInput,
  ConversationContext,
  CartItem,
  MessageRecord,
} from '../types/whatsapp';
import { logger } from '../utils/logger.js';

// ==================== CONSTANTS ====================

const LOCK_TTL_MS = 5000; // 5 second lock for cart operations
const LOCK_RETRY_COUNT = 3;
const LOCK_RETRY_DELAY_MS = 100;

export class SessionManager {
  private redis: Redis;
  private defaultTimeout: number;
  private readonly SESSION_PREFIX = 'whatsapp:session:';
  private readonly CONTEXT_PREFIX = 'whatsapp:context:';
  private readonly LOCK_PREFIX = 'lock:session:';

  constructor(redis: Redis, defaultTimeoutHours: number = 24) {
    this.redis = redis;
    this.defaultTimeout = defaultTimeoutHours * 60 * 60;
  }

  // ==================== DISTRIBUTED LOCK ====================

  private async acquireLock(sessionId: string): Promise<string | null> {
    const token = `${Date.now()}-${randomUUID().replace(/-/g, '')}`;

    for (let i = 0; i < LOCK_RETRY_COUNT; i++) {
      const result = await this.redis.set(
        `${this.LOCK_PREFIX}${sessionId}`,
        token,
        'PX',
        LOCK_TTL_MS,
        'NX'
      );

      if (result === 'OK') {
        return token;
      }

      if (i < LOCK_RETRY_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY_MS * Math.pow(2, i)));
      }
    }

    return null;
  }

  private async releaseLock(sessionId: string, token: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, `${this.LOCK_PREFIX}${sessionId}`, token);
    return result === 1;
  }

  // ==================== SESSION OPERATIONS ====================

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

    await this.cacheSession(session);

    logger.info('Session created', {
      sessionId,
      userId: input.userId,
      merchantId: input.merchantId,
    });

    return session;
  }

  async getSession(sessionId: string): Promise<ISession | null> {
    const cached = await this.getCachedSession(sessionId);
    if (cached) {
      return cached;
    }

    const session = await Session.findOne({ sessionId });
    if (session) {
      await this.cacheSession(session);
    }

    return session;
  }

  async getSessionByUser(userId: string, merchantId?: string): Promise<ISession | null> {
    const query: Record<string, unknown> = {
      userId,
      expiresAt: { $gt: new Date() },
    };
    if (merchantId) {
      query.merchantId = merchantId;
    }

    return Session.findOne(query).sort({ lastActivity: -1 });
  }

  async updateSessionState(
    sessionId: string,
    newState: SessionState
  ): Promise<ISession | null> {
    // Acquire lock for state updates
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) {
      logger.warn('Could not acquire lock for state update', { sessionId });
      return null;
    }

    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        logger.warn('Session not found for state update', { sessionId });
        return null;
      }

      // Validate state transition (warning only)
      const validTransitions = this.getValidTransitions(session.state);
      if (!validTransitions.includes(newState)) {
        logger.warn('Invalid state transition', {
          sessionId,
          from: session.state,
          to: newState,
        });
      }

      session.state = newState;
      session.lastActivity = new Date();
      await session.save();
      await this.cacheSession(session);

      logger.info('Session state updated', { sessionId, newState });
      return session;
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  private getValidTransitions(currentState: SessionState): SessionState[] {
    const transitions: Record<SessionState, SessionState[]> = {
      [SessionState.IDLE]: [SessionState.BROWSING, SessionState.SEARCHING, SessionState.SUPPORT],
      [SessionState.BROWSING]: [SessionState.VIEWING_PRODUCT, SessionState.SEARCHING, SessionState.CART_REVIEW, SessionState.IDLE],
      [SessionState.SEARCHING]: [SessionState.BROWSING, SessionState.VIEWING_PRODUCT, SessionState.IDLE],
      [SessionState.VIEWING_PRODUCT]: [SessionState.ADDING_TO_CART, SessionState.BROWSING, SessionState.CART_REVIEW, SessionState.CHECKOUT],
      [SessionState.ADDING_TO_CART]: [SessionState.CART_REVIEW, SessionState.VIEWING_PRODUCT],
      [SessionState.CART_REVIEW]: [SessionState.CHECKOUT, SessionState.BROWSING, SessionState.VIEWING_PRODUCT],
      [SessionState.CHECKOUT]: [SessionState.PAYMENT_PENDING, SessionState.CART_REVIEW],
      [SessionState.PAYMENT_PENDING]: [SessionState.ORDER_CONFIRMED, SessionState.CHECKOUT],
      [SessionState.ORDER_CONFIRMED]: [SessionState.TRACKING, SessionState.IDLE],
      [SessionState.SUPPORT]: [SessionState.IDLE],
      [SessionState.TRACKING]: [SessionState.IDLE, SessionState.ORDER_CONFIRMED],
      [SessionState.COMPLETED]: [SessionState.IDLE],
      [SessionState.EXPIRED]: [SessionState.IDLE],
    };
    return transitions[currentState] || [SessionState.IDLE];
  }

  // ==================== CART OPERATIONS WITH DISTRIBUTED LOCK ====================

  /**
   * Add item to cart - thread-safe with distributed lock
   */
  async addToCart(sessionId: string, item: CartItem): Promise<{ success: boolean; session?: ISession | null; error?: string }> {
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) {
      return { success: false, error: 'Cart is being modified, please retry' };
    }

    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Read current cart
      const cart = session.context?.cart || [];
      const existingIndex = cart.findIndex(i => i.productId === item.productId);

      if (existingIndex >= 0) {
        cart[existingIndex].quantity += item.quantity;
      } else {
        cart.push(item);
      }

      // Update session atomically
      await Session.updateOne(
        { sessionId },
        {
          $set: {
            'context.cart': cart,
            state: SessionState.ADDING_TO_CART,
            lastActivity: new Date(),
          },
        }
      );

      // Invalidate cache
      await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);

      logger.info('Item added to cart', {
        sessionId,
        productId: item.productId,
        quantity: item.quantity,
      });

      const updatedSession = await this.getSession(sessionId);
      return { success: true, session: updatedSession };
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  /**
   * Update cart item - thread-safe with distributed lock
   */
  async updateCartItem(
    sessionId: string,
    productId: string,
    quantity: number
  ): Promise<{ success: boolean; session?: ISession | null; error?: string }> {
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) {
      return { success: false, error: 'Cart is being modified, please retry' };
    }

    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const cart = session.context?.cart || [];
      const existingIndex = cart.findIndex(i => i.productId === productId);

      if (existingIndex < 0) {
        return { success: false, error: 'Item not found in cart' };
      }

      if (quantity <= 0) {
        cart.splice(existingIndex, 1);
      } else {
        cart[existingIndex].quantity = quantity;
      }

      await Session.updateOne(
        { sessionId },
        {
          $set: {
            'context.cart': cart,
            lastActivity: new Date(),
          },
        }
      );

      await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);

      logger.info('Cart item updated', { sessionId, productId, quantity });

      const updatedSession = await this.getSession(sessionId);
      return { success: true, session: updatedSession };
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  /**
   * Remove item from cart - thread-safe with distributed lock
   */
  async removeFromCart(
    sessionId: string,
    productId: string
  ): Promise<{ success: boolean; session?: ISession | null; error?: string }> {
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) {
      return { success: false, error: 'Cart is being modified, please retry' };
    }

    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const cart = session.context?.cart || [];
      const newCart = cart.filter(i => i.productId !== productId);

      await Session.updateOne(
        { sessionId },
        {
          $set: {
            'context.cart': newCart,
            lastActivity: new Date(),
          },
        }
      );

      await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);

      logger.info('Item removed from cart', { sessionId, productId });

      const updatedSession = await this.getSession(sessionId);
      return { success: true, session: updatedSession };
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  /**
   * Clear cart - thread-safe with distributed lock
   */
  async clearCart(sessionId: string): Promise<{ success: boolean; session?: ISession | null; error?: string }> {
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) {
      return { success: false, error: 'Cart is being modified, please retry' };
    }

    try {
      await Session.updateOne(
        { sessionId },
        {
          $set: {
            'context.cart': [],
            state: SessionState.IDLE,
            lastActivity: new Date(),
          },
        }
      );

      await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);

      logger.info('Cart cleared', { sessionId });

      const updatedSession = await this.getSession(sessionId);
      return { success: true, session: updatedSession };
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  async getCartTotal(sessionId: string): Promise<number> {
    const session = await this.getSession(sessionId);
    if (!session) return 0;
    return session.getCartTotal();
  }

  // ==================== MESSAGE OPERATIONS ====================

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    messageId: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.addMessage(role, content, messageId);
    session.lastActivity = new Date();
    await session.save();
    await this.cacheSession(session);
  }

  async extendSession(sessionId: string, additionalHours?: number): Promise<ISession | null> {
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) return null;

    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;

      const hours = additionalHours || Math.floor(this.defaultTimeout / 3600);
      session.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      session.lastActivity = new Date();
      await session.save();
      await this.cacheSession(session);

      logger.info('Session extended', { sessionId, newExpiry: session.expiresAt });
      return session;
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  async endSession(sessionId: string): Promise<ISession | null> {
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) return null;

    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;

      session.state = SessionState.COMPLETED;
      session.lastActivity = new Date();
      await session.save();
      await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);

      logger.info('Session ended', { sessionId });
      return session;
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  async expireSession(sessionId: string): Promise<void> {
    const lockToken = await this.acquireLock(sessionId);
    if (!lockToken) return;

    try {
      await Session.updateOne(
        { sessionId },
        {
          $set: {
            state: SessionState.EXPIRED,
            expiresAt: new Date(),
          },
        }
      );
      await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);
      logger.info('Session expired', { sessionId });
    } finally {
      await this.releaseLock(sessionId, lockToken);
    }
  }

  // ==================== CACHE OPERATIONS ====================

  private async cacheSession(session: ISession): Promise<void> {
    const cacheKey = `${this.SESSION_PREFIX}${session.sessionId}`;
    const ttl = Math.floor(this.defaultTimeout * 0.95);
    await this.redis.setex(cacheKey, ttl, JSON.stringify({
      sessionId: session.sessionId,
      userId: session.userId,
      state: session.state,
      lastActivity: session.lastActivity.toISOString(),
    }));
  }

  private async getCachedSession(sessionId: string): Promise<ISession | null> {
    const cached = await this.redis.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!cached) return null;

    try {
      return await Session.findOne({ sessionId });
    } catch {
      logger.error('Failed to parse cached session', { sessionId });
      return null;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await Session.updateMany(
      { expiresAt: { $lt: new Date() }, state: { $ne: SessionState.EXPIRED } },
      { $set: { state: SessionState.EXPIRED } }
    );

    logger.info('Expired sessions cleaned up', { count: result.modifiedCount });
    return result.modifiedCount;
  }

  async getStats(merchantId?: string): Promise<{
    total: number;
    active: number;
    byState: Record<string, number>;
    avgCartValue: number;
  }> {
    const matchStage: Record<string, unknown> = {};
    if (merchantId) matchStage.merchantId = merchantId;
    matchStage.expiresAt = { $gt: new Date() };

    const stats = await Session.aggregate([
      { $match: matchStage },
      { $group: { _id: '$state', count: { $sum: 1 } } },
    ]);

    const byState: Record<string, number> = {};
    let total = 0;
    stats.forEach((s) => {
      byState[s._id] = s.count;
      total += s.count;
    });

    const cartStats = await Session.aggregate([
      { $match: { ...matchStage, 'context.cart': { $ne: [] } } },
      { $project: { cartTotal: { $sum: { $map: { input: '$context.cart', as: 'i', in: { $multiply: ['$$i.price', '$$i.quantity'] } } } } } },
      { $group: { _id: null, avgCartValue: { $avg: '$cartTotal' } } },
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

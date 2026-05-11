/**
 * BrowsingModule - Consumer Browsing Behavior Tracking
 * Tracks and analyzes consumer browsing patterns across platforms
 */

import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';
import { BrowsingEvent, BrowsingSummary } from '../types';

export interface ProductView {
  product_id: string;
  product_name: string;
  category_id: string;
  brand_id?: string;
  price: number;
  view_count: number;
  added_to_cart: boolean;
  added_to_wishlist: boolean;
  last_viewed: string;
}

export interface SearchQuery {
  query: string;
  count: number;
  last_searched: string;
  results_clicked: number;
}

export class BrowsingModule {
  private consumerGraph: ConsumerGraph;
  private httpClient: AxiosInstance;
  private logger: winston.Logger;

  // Local storage
  private productViews: Map<string, Map<string, ProductView>>; // userId -> productId -> ProductView
  private searchHistory: Map<string, SearchQuery[]>;
  private sessions: Map<string, { userId: string; startTime: string; events: number }>;

  constructor(consumerGraph: ConsumerGraph, baseUrl: string) {
    this.consumerGraph = consumerGraph;
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
    this.productViews = new Map();
    this.searchHistory = new Map();
    this.sessions = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.logger.info('BrowsingModule initialized');
  }

  // ============================================
  // BROWSE EVENTS
  // ============================================

  /**
   * Record a browsing event
   */
  async recordEvent(event: BrowsingEvent): Promise<void> {
    const profile = this.consumerGraph.getConsumer(event.user_id);
    if (!profile) {
      this.logger.warn('Consumer not found for browsing event', { userId: event.user_id });
      return;
    }

    switch (event.event_type) {
      case 'page_view':
        await this.recordPageView(event);
        profile.recordBrowsingEvent('session', event.session_id);
        break;
      case 'search':
        await this.recordSearch(event);
        profile.recordBrowsingEvent('search');
        break;
      case 'product_view':
        await this.recordProductView(event);
        profile.recordBrowsingEvent('product_view');
        break;
      case 'add_to_cart':
        await this.recordCartAdd(event);
        break;
      case 'add_to_wishlist':
        profile.recordBrowsingEvent('wishlist');
        await this.recordWishlistAdd(event);
        break;
    }

    // Track session
    this.trackSession(event.user_id, event.session_id);

    this.logger.debug('Browsing event recorded', {
      userId: event.user_id,
      eventType: event.event_type,
    });
  }

  private async recordPageView(event: BrowsingEvent): Promise<void> {
    try {
      await this.httpClient.post('/events/page-view', {
        user_id: event.user_id,
        session_id: event.session_id,
        page_url: event.payload.page_url,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.warn('Failed to sync page view to service', { error });
    }
  }

  private async recordSearch(event: BrowsingEvent): Promise<void> {
    const query = event.payload.search_query || '';

    if (!this.searchHistory.has(event.user_id)) {
      this.searchHistory.set(event.user_id, []);
    }

    const queries = this.searchHistory.get(event.user_id)!;
    const existing = queries.find((q) => q.query === query);

    if (existing) {
      existing.count++;
      existing.last_searched = event.timestamp;
    } else {
      queries.push({
        query,
        count: 1,
        last_searched: event.timestamp,
        results_clicked: 0,
      });
    }

    try {
      await this.httpClient.post('/events/search', {
        user_id: event.user_id,
        session_id: event.session_id,
        search_query: query,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.warn('Failed to sync search to service', { error });
    }
  }

  private async recordProductView(event: BrowsingEvent): Promise<void> {
    const productId = event.payload.product_id;
    if (!productId) return;

    if (!this.productViews.has(event.user_id)) {
      this.productViews.set(event.user_id, new Map());
    }

    const views = this.productViews.get(event.user_id)!;
    const existing = views.get(productId);

    if (existing) {
      existing.view_count++;
      existing.last_viewed = event.timestamp;
    } else {
      views.set(productId, {
        product_id: productId,
        product_name: '',
        category_id: event.payload.category_id || '',
        view_count: 1,
        added_to_cart: false,
        added_to_wishlist: false,
        last_viewed: event.timestamp,
      });
    }

    try {
      await this.httpClient.post('/events/product-view', {
        user_id: event.user_id,
        session_id: event.session_id,
        product_id: productId,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.warn('Failed to sync product view to service', { error });
    }
  }

  private async recordCartAdd(event: BrowsingEvent): Promise<void> {
    const productId = event.payload.product_id;
    if (!productId) return;

    const views = this.productViews.get(event.user_id);
    if (views) {
      const productView = views.get(productId);
      if (productView) {
        productView.added_to_cart = true;
      }
    }

    try {
      await this.httpClient.post('/events/cart-add', {
        user_id: event.user_id,
        session_id: event.session_id,
        product_id: productId,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.warn('Failed to sync cart add to service', { error });
    }
  }

  private async recordWishlistAdd(event: BrowsingEvent): Promise<void> {
    const productId = event.payload.product_id;
    if (!productId) return;

    const views = this.productViews.get(event.user_id);
    if (views) {
      const productView = views.get(productId);
      if (productView) {
        productView.added_to_wishlist = true;
      }
    }

    try {
      await this.httpClient.post('/events/wishlist-add', {
        user_id: event.user_id,
        session_id: event.session_id,
        product_id: productId,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.warn('Failed to sync wishlist add to service', { error });
    }
  }

  private trackSession(userId: string, sessionId: string): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.events++;
    } else {
      this.sessions.set(sessionId, {
        userId,
        startTime: new Date().toISOString(),
        events: 1,
      });
    }
  }

  // ============================================
  // SUMMARIES
  // ============================================

  /**
   * Get browsing summary for consumer
   */
  async getBrowsingSummary(userId: string): Promise<BrowsingSummary | null> {
    try {
      // Try to get from browsing service
      const response = await this.httpClient.get(`/browsing/summary/${userId}`);
      return response.data;
    } catch (error) {
      // Fall back to local data
      return this.getLocalBrowsingSummary(userId);
    }
  }

  private getLocalBrowsingSummary(userId: string): BrowsingSummary | null {
    const profile = this.consumerGraph.getConsumer(userId);
    if (!profile) return null;

    const consumerData = profile.toJSON();
    const views = this.productViews.get(userId) || new Map();
    const searches = this.searchHistory.get(userId) || [];
    const userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );

    return {
      sessions: userSessions.length,
      search_queries: searches.reduce((sum, q) => sum + q.count, 0),
      products_viewed: views.size,
      wishlists: Array.from(views.values()).filter((v) => v.added_to_wishlist).length,
      cart_abandons: 0, // Would need cart service integration
      avg_session_duration: this.calculateAvgSessionDuration(userSessions),
      last_session: userSessions.length > 0
        ? userSessions.sort(
            (a, b) =>
              new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          )[0].startTime
        : '',
    };
  }

  private calculateAvgSessionDuration(
    sessions: { userId: string; startTime: string; events: number }[]
  ): number {
    if (sessions.length === 0) return 0;
    // Simplified: estimate based on events (in production, track actual duration)
    const totalEvents = sessions.reduce((sum, s) => sum + s.events, 0);
    return (totalEvents / sessions.length) * 120; // ~2 minutes per event
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get most viewed products
   */
  async getMostViewedProducts(
    userId: string,
    limit: number = 10
  ): Promise<ProductView[]> {
    const views = this.productViews.get(userId) || new Map();
    return Array.from(views.values())
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, limit);
  }

  /**
   * Get search history
   */
  async getSearchHistory(userId: string, limit: number = 50): Promise<SearchQuery[]> {
    const searches = this.searchHistory.get(userId) || [];
    return searches
      .sort(
        (a, b) =>
          new Date(b.last_searched).getTime() - new Date(a.last_searched).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Get abandoned cart items
   */
  async getAbandonedCartItems(userId: string): Promise<ProductView[]> {
    const views = this.productViews.get(userId) || new Map();
    return Array.from(views.values()).filter(
      (v) => v.added_to_cart && !v.added_to_wishlist
    );
  }

  /**
   * Get abandoned wishlist items
   */
  async getAbandonedWishlistItems(userId: string): Promise<ProductView[]> {
    const views = this.productViews.get(userId) || new Map();
    return Array.from(views.values())
      .filter((v) => v.added_to_wishlist && v.added_to_cart)
      .sort((a, b) => new Date(b.last_viewed).getTime() - new Date(a.last_viewed).getTime());
  }

  /**
   * Get category affinities based on browsing
   */
  async getCategoryAffinities(userId: string): Promise<Record<string, number>> {
    const views = this.productViews.get(userId) || new Map();
    const affinities: Record<string, number> = {};
    const totalViews = views.size;

    if (totalViews === 0) return affinities;

    for (const view of views.values()) {
      if (view.category_id) {
        affinities[view.category_id] = (affinities[view.category_id] || 0) + 1;
      }
    }

    // Normalize to 0-1
    for (const category in affinities) {
      affinities[category] = affinities[category] / totalViews;
    }

    return affinities;
  }
}

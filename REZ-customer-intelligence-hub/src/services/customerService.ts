import axios, { AxiosInstance } from 'axios';
import config from '../config/index.js';
import logger from './utils/logger.js';
import type {
  UnifiedProfile,
  OrderSummary,
  PaymentSummary,
  ReviewSummary,
  PredictionSummary,
  Recommendation,
  CustomerOverview,
} from '../types/index.js';

/**
 * Service to aggregate customer data from multiple sources
 */
class CustomerService {
  private orderClient: AxiosInstance;
  private paymentClient: AxiosInstance;
  private reviewClient: AxiosInstance;
  private segmentsClient: AxiosInstance;
  private rfmClient: AxiosInstance;
  private recommendationClient: AxiosInstance;

  constructor() {
    // Initialize HTTP clients for each service
    this.orderClient = axios.create({
      baseURL: config.services.orderServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.paymentClient = axios.create({
      baseURL: config.services.paymentServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.reviewClient = axios.create({
      baseURL: config.services.reviewServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.segmentsClient = axios.create({
      baseURL: config.services.segmentsServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.rfmClient = axios.create({
      baseURL: config.services.rfmServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.recommendationClient = axios.create({
      baseURL: config.services.recommendationServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get unified profile for a user
   */
  async getProfile(userId: string): Promise<UnifiedProfile> {
    try {
      // In production, this would call the identity service
      // For now, return a mock profile structure
      const response = await this.orderClient.get(`/api/orders/customer/${userId}/profile`).catch(() => null);

      if (response?.data) {
        return response.data;
      }

      // Return default profile structure
      return {
        userId,
        email: undefined,
        phone: undefined,
        firstName: undefined,
        lastName: undefined,
        fullName: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(`Failed to fetch profile for user ${userId}`, { error });
      return {
        userId,
        email: undefined,
        phone: undefined,
        firstName: undefined,
        lastName: undefined,
        fullName: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get order summary for a user
   */
  async getOrderSummary(userId: string): Promise<OrderSummary> {
    try {
      const response = await this.orderClient.get(`/api/orders/customer/${userId}/summary`);

      if (response?.data) {
        return response.data;
      }
    } catch (error) {
      logger.warn(`Failed to fetch orders for user ${userId}`, { error });
    }

    // Return empty summary
    return {
      totalOrders: 0,
      totalSpend: 0,
      averageOrderValue: 0,
    };
  }

  /**
   * Get payment summary for a user
   */
  async getPaymentSummary(userId: string): Promise<PaymentSummary> {
    try {
      const response = await this.paymentClient.get(`/api/payments/customer/${userId}/summary`);

      if (response?.data) {
        return response.data;
      }
    } catch (error) {
      logger.warn(`Failed to fetch payments for user ${userId}`, { error });
    }

    // Return empty summary
    return {
      totalPayments: 0,
      totalAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
    };
  }

  /**
   * Get review summary for a user
   */
  async getReviewSummary(userId: string): Promise<ReviewSummary> {
    try {
      const response = await this.reviewClient.get(`/api/reviews/customer/${userId}/summary`);

      if (response?.data) {
        return response.data;
      }
    } catch (error) {
      logger.warn(`Failed to fetch reviews for user ${userId}`, { error });
    }

    // Return empty summary
    return {
      totalReviews: 0,
    };
  }

  /**
   * Get segments for a user
   */
  async getSegments(userId: string): Promise<string[]> {
    try {
      // Try RFM service first
      const rfmResponse = await this.rfmClient.get(`/api/rfm/scores/${userId}`);
      if (rfmResponse?.data?.segment) {
        return [rfmResponse.data.segment];
      }

      // Try segments service
      const segmentsResponse = await this.segmentsClient.get(`/api/segments/customer/${userId}`);
      if (segmentsResponse?.data?.segments) {
        return segmentsResponse.data.segments;
      }
    } catch (error) {
      logger.warn(`Failed to fetch segments for user ${userId}`, { error });
    }

    return [];
  }

  /**
   * Get predictions for a user
   */
  async getPredictions(userId: string): Promise<PredictionSummary> {
    try {
      // This would integrate with ML prediction services
      const response = await this.segmentsClient.get(`/api/predictions/customer/${userId}`);

      if (response?.data) {
        return response.data;
      }
    } catch (error) {
      logger.warn(`Failed to fetch predictions for user ${userId}`, { error });
    }

    // Return default predictions
    return {
      churnRisk: 'LOW',
      churnProbability: 0.1,
      engagementScore: 50,
    };
  }

  /**
   * Get recommendations for a user
   */
  async getRecommendations(userId: string, limit: number = 10): Promise<Recommendation[]> {
    try {
      const response = await this.recommendationClient.get(
        `/api/recommendations/customer/${userId}?limit=${limit}`
      );

      if (response?.data?.recommendations) {
        return response.data.recommendations;
      }
    } catch (error) {
      logger.warn(`Failed to fetch recommendations for user ${userId}`, { error });
    }

    return [];
  }

  /**
   * Get complete customer overview
   */
  async getCustomerOverview(userId: string): Promise<CustomerOverview> {
    logger.info(`Fetching customer overview for user ${userId}`);

    // Fetch all data in parallel
    const [profile, orders, payments, reviews, segments, predictions, recommendations] = await Promise.all([
      this.getProfile(userId),
      this.getOrderSummary(userId),
      this.getPaymentSummary(userId),
      this.getReviewSummary(userId),
      this.getSegments(userId),
      this.getPredictions(userId),
      this.getRecommendations(userId, 10),
    ]);

    return {
      userId,
      profile,
      orders,
      payments,
      reviews,
      segments,
      predictions,
      recommendations,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Get order history for a user
   */
  async getOrderHistory(
    userId: string,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<{ orders: unknown[]; total: number }> {
    try {
      const { limit = 20, offset = 0, status } = options;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (status) {
        params.append('status', status);
      }

      const response = await this.orderClient.get(
        `/api/orders/customer/${userId}?${params.toString()}`
      );

      if (response?.data) {
        return {
          orders: response.data.orders || [],
          total: response.data.total || 0,
        };
      }
    } catch (error) {
      logger.warn(`Failed to fetch order history for user ${userId}`, { error });
    }

    return { orders: [], total: 0 };
  }
}

export const customerService = new CustomerService();

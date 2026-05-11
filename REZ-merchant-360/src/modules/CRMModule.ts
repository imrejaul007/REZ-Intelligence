/**
 * CRMModule.ts - Customer Relationship Management for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
import { CRM } from '../MerchantProfile';

export interface Customer {
  id: string;
  merchant_id: string;
  email?: string;
  phone?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  tags: string[];
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  first_order_date?: string;
  last_order_date?: string;
  lifetime_value: number;
  status: 'active' | 'inactive' | 'churned';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  merchant_id: string;
  customer_id: string;
  customer_name: string;
  order_id?: string;
  rating: number;
  title?: string;
  content?: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  response?: string;
  response_date?: string;
  helpful_count: number;
  created_at: string;
}

export interface Feedback {
  id: string;
  merchant_id: string;
  customer_id: string;
  customer_name: string;
  type: 'complaint' | 'suggestion' | 'compliment' | 'question';
  subject: string;
  content: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  resolution?: string;
  resolved_at?: string;
  created_at: string;
}

export interface CRMSummary {
  total_customers: number;
  active_customers: number;
  new_customers_this_month: number;
  returning_customers: number;
  churned_customers: number;
  monthly_customers: number;
  avg_rating: number;
  reviews_count: number;
  total_feedback: number;
  satisfaction_rate: number;
  top_customer_tags: string[];
}

export class CRMModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: CRM; timestamp: number }> = new Map();
  private cacheTTL: number = 180000; // 3 minutes default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.CRM_SERVICE_URL || 'http://localhost:4004',
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
   * Get CRM summary for a merchant
   */
  async getCRM(merchantId: string): Promise<CRM> {
    const cacheKey = `crm:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getCRMSummary(merchantId);

      const crm: CRM = {
        total_customers: summary.total_customers,
        monthly_customers: summary.monthly_customers,
        avg_rating: summary.avg_rating,
        reviews_count: summary.reviews_count,
        total_feedback: summary.total_feedback,
        satisfaction_rate: summary.satisfaction_rate,
      };

      this.cache.set(cacheKey, { data: crm, timestamp: Date.now() });
      return crm;
    } catch (error) {
      console.error(`Failed to fetch CRM for merchant ${merchantId}:`, error);
      return this.getDefaultCRM();
    }
  }

  /**
   * Get detailed CRM summary
   */
  async getCRMSummary(merchantId: string): Promise<CRMSummary> {
    try {
      const response = await this.client.get<CRMSummary>(
        `/merchants/${merchantId}/crm/summary`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch CRM summary for merchant ${merchantId}:`, error);
      return this.getDefaultCRMSummary();
    }
  }

  /**
   * Get all customers
   */
  async getCustomers(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: Customer['status'];
      tag?: string;
      search?: string;
      sort_by?: 'name' | 'total_spent' | 'total_orders' | 'created_at' | 'lifetime_value';
      sort_order?: 'asc' | 'desc';
    } = {}
  ): Promise<Customer[]> {
    try {
      const response = await this.client.get<Customer[]>(
        `/merchants/${merchantId}/customers`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch customers for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Get single customer
   */
  async getCustomer(merchantId: string, customerId: string): Promise<Customer | null> {
    try {
      const response = await this.client.get<Customer>(
        `/merchants/${merchantId}/customers/${customerId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch customer ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Create or update customer
   */
  async upsertCustomer(merchantId: string, customer: Partial<Customer>): Promise<Customer> {
    try {
      const response = await this.client.post<Customer>(
        `/merchants/${merchantId}/customers`,
        customer
      );
      this.cache.delete(`crm:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to upsert customer for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Update customer tags
   */
  async updateCustomerTags(
    merchantId: string,
    customerId: string,
    tags: string[]
  ): Promise<Customer> {
    try {
      const response = await this.client.patch<Customer>(
        `/merchants/${merchantId}/customers/${customerId}`,
        { tags }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to update customer tags:`, error);
      throw error;
    }
  }

  /**
   * Add customer note
   */
  async addCustomerNote(
    merchantId: string,
    customerId: string,
    note: string
  ): Promise<boolean> {
    try {
      await this.client.post(
        `/merchants/${merchantId}/customers/${customerId}/notes`,
        { content: note }
      );
      return true;
    } catch (error) {
      console.error(`Failed to add customer note:`, error);
      return false;
    }
  }

  /**
   * Get reviews
   */
  async getReviews(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: Review['status'];
      min_rating?: number;
      max_rating?: number;
    } = {}
  ): Promise<Review[]> {
    try {
      const response = await this.client.get<Review[]>(
        `/merchants/${merchantId}/reviews`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch reviews for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Respond to review
   */
  async respondToReview(
    merchantId: string,
    reviewId: string,
    response: string
  ): Promise<Review> {
    try {
      const responseData = await this.client.patch<Review>(
        `/merchants/${merchantId}/reviews/${reviewId}`,
        {
          response,
          response_date: new Date().toISOString(),
        }
      );
      this.cache.delete(`crm:${merchantId}`);
      return responseData.data;
    } catch (error) {
      console.error(`Failed to respond to review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Get feedback
   */
  async getFeedback(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: Feedback['type'];
      status?: Feedback['status'];
      priority?: Feedback['priority'];
    } = {}
  ): Promise<Feedback[]> {
    try {
      const response = await this.client.get<Feedback[]>(
        `/merchants/${merchantId}/feedback`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch feedback for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Create feedback
   */
  async createFeedback(merchantId: string, feedback: Partial<Feedback>): Promise<Feedback> {
    try {
      const response = await this.client.post<Feedback>(
        `/merchants/${merchantId}/feedback`,
        feedback
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to create feedback:`, error);
      throw error;
    }
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(
    merchantId: string,
    feedbackId: string,
    status: Feedback['status'],
    resolution?: string
  ): Promise<Feedback> {
    try {
      const response = await this.client.patch<Feedback>(
        `/merchants/${merchantId}/feedback/${feedbackId}`,
        {
          status,
          resolution,
          resolved_at: status === 'resolved' ? new Date().toISOString() : undefined,
        }
      );
      this.cache.delete(`crm:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update feedback status:`, error);
      throw error;
    }
  }

  /**
   * Get customer segments
   */
  async getSegments(merchantId: string): Promise<{
    id: string;
    name: string;
    description: string;
    customer_count: number;
    criteria: Record<string, unknown>;
  }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/crm/segments`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch segments for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Export customer data
   */
  async exportCustomers(
    merchantId: string,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/customers/export`,
        { params: { format } }
      );
      return response.data.url;
    } catch (error) {
      console.error(`Failed to export customers:`, error);
      throw error;
    }
  }

  /**
   * Sync CRM from external source
   */
  async syncCRM(merchantId: string, sourceData: Partial<CRM>): Promise<CRM> {
    const current = await this.getCRM(merchantId);
    const updated: CRM = {
      ...current,
      ...sourceData,
    };

    this.cache.delete(`crm:${merchantId}`);
    return updated;
  }

  private getDefaultCRM(): CRM {
    return {
      total_customers: 0,
      monthly_customers: 0,
      avg_rating: 0,
      reviews_count: 0,
    };
  }

  private getDefaultCRMSummary(): CRMSummary {
    return {
      total_customers: 0,
      active_customers: 0,
      new_customers_this_month: 0,
      returning_customers: 0,
      churned_customers: 0,
      monthly_customers: 0,
      avg_rating: 0,
      reviews_count: 0,
      total_feedback: 0,
      satisfaction_rate: 100,
      top_customer_tags: [],
    };
  }

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`crm:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}

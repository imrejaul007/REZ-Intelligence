/**
 * CRMModule.ts - Customer Relationship Management for Merchant360
 */
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
export declare class CRMModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get CRM summary for a merchant
     */
    getCRM(merchantId: string): Promise<CRM>;
    /**
     * Get detailed CRM summary
     */
    getCRMSummary(merchantId: string): Promise<CRMSummary>;
    /**
     * Get all customers
     */
    getCustomers(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        status?: Customer['status'];
        tag?: string;
        search?: string;
        sort_by?: 'name' | 'total_spent' | 'total_orders' | 'created_at' | 'lifetime_value';
        sort_order?: 'asc' | 'desc';
    }): Promise<Customer[]>;
    /**
     * Get single customer
     */
    getCustomer(merchantId: string, customerId: string): Promise<Customer | null>;
    /**
     * Create or update customer
     */
    upsertCustomer(merchantId: string, customer: Partial<Customer>): Promise<Customer>;
    /**
     * Update customer tags
     */
    updateCustomerTags(merchantId: string, customerId: string, tags: string[]): Promise<Customer>;
    /**
     * Add customer note
     */
    addCustomerNote(merchantId: string, customerId: string, note: string): Promise<boolean>;
    /**
     * Get reviews
     */
    getReviews(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        status?: Review['status'];
        min_rating?: number;
        max_rating?: number;
    }): Promise<Review[]>;
    /**
     * Respond to review
     */
    respondToReview(merchantId: string, reviewId: string, response: string): Promise<Review>;
    /**
     * Get feedback
     */
    getFeedback(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        type?: Feedback['type'];
        status?: Feedback['status'];
        priority?: Feedback['priority'];
    }): Promise<Feedback[]>;
    /**
     * Create feedback
     */
    createFeedback(merchantId: string, feedback: Partial<Feedback>): Promise<Feedback>;
    /**
     * Update feedback status
     */
    updateFeedbackStatus(merchantId: string, feedbackId: string, status: Feedback['status'], resolution?: string): Promise<Feedback>;
    /**
     * Get customer segments
     */
    getSegments(merchantId: string): Promise<{
        id: string;
        name: string;
        description: string;
        customer_count: number;
        criteria: Record<string, unknown>;
    }[]>;
    /**
     * Export customer data
     */
    exportCustomers(merchantId: string, format?: 'csv' | 'json'): Promise<string>;
    /**
     * Sync CRM from external source
     */
    syncCRM(merchantId: string, sourceData: Partial<CRM>): Promise<CRM>;
    private getDefaultCRM;
    private getDefaultCRMSummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=CRMModule.d.ts.map
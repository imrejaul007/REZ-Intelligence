/**
 * Merchant 360 - UNIFIED MERCHANT IDENTITY
 * One profile for every merchant across all verticals
 */

export interface Merchant360 {
  // Core Identity
  merchant_id: string;
  business_name: string;
  brand_names: string[];
  verticals: Vertical[];
  registered_at: string;
  verified: boolean;

  // Contact
  email: string;
  phone: string;
  whatsapp?: string;
  addresses: Address[];

  // Finance Module
  finances: {
    wallet_balance: number;
    pending_payouts: number;
    monthly_revenue: number;
    lifetime_revenue: number;
    credit_score: number;
    tax_compliant: boolean;
    kyc_verified: boolean;
  };

  // Catalog Module
  catalog: {
    total_products: number;
    active_products: number;
    categories: string[];
    last_product_update: string;
  };

  // Inventory Module
  inventory: {
    total_items: number;
    low_stock_alerts: number;
    out_of_stock: number;
    suppliers: Supplier[];
    reorder_alerts: number;
  };

  // CRM Module
  crm: {
    total_customers: number;
    monthly_customers: number;
    avg_rating: number;
    reviews_count: number;
    last_review: string;
  };

  // Loyalty Module
  loyalty: {
    program_active: boolean;
    active_members: number;
    monthly_points_issued: number;
    monthly_points_redeemed: number;
  };

  // Staff Module
  staff: {
    total: number;
    admins: number;
    employees: number;
    locations: number;
  };

  // AI Memory Module
  ai_memory: {
    preferences_set: boolean;
    automation_rules: number;
    last_interaction: string;
    common_queries: string[];
  };

  // Compliance Module
  compliance: {
    food_license: boolean;
    gst_registered: boolean;
    pan_verified: boolean;
    bank_verified: boolean;
  };

  // Analytics Module
  analytics: {
    dau: number;
    mau: number;
    conversion_rate: number;
    avg_order_value: number;
  };

  // Unified timestamp
  updated_at: string;
}

export type Vertical = 'restaurant' | 'hotel' | 'salon' | 'fitness' | 'retail' | 'grocery' | 'pharmacy';

export interface Address {
  type: 'billing' | 'shipping' | 'restaurant' | 'hotel' | 'salon';
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
}

export interface Supplier {
  supplier_id: string;
  name: string;
  lead_time_days: number;
  moq: number;
  cost_per_unit: number;
}
